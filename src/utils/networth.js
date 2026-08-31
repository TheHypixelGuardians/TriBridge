const {SerialQueue} = require('./serialQueue');
const {isValidMinecraftName} = require('./minecraftName');
const {lookupProfile} = require('./mojang');

/** @type {NetworthProvider} */
const defaultProvider = require('./skycryptProvider');

/**
 * One SkyBlock profile's networth figures.
 *
 * @typedef {object} ProfileNetworth
 * @property {string} profileId
 * @property {string} cuteName
 * @property {string|null} gameMode
 * @property {boolean} current Whether this is the player's selected profile.
 * @property {number} networth Includes cosmetics and soulbound items.
 * @property {number} unsoulbound The same total with soulbound items excluded.
 * @property {number} purse
 * @property {number} bank
 * @property {number} personalBank
 * @property {boolean} noInventory Inventory API off — every figure is an undercount.
 * @property {Record<string, {total: number, unsoulbound: number}>} types
 */

/**
 * @typedef {{ok: true, profiles: ProfileNetworth[]}
 *        | {ok: false, code: string, detail?: string}} ProviderResult
 */

/**
 * Where networth figures come from. Implemented by utils/skycryptProvider.js.
 *
 * Everything in this file is deliberately provider-agnostic — that is why the
 * failure codes are generic (`upstream-error`, not `skycrypt-error`). Swapping to
 * the Hypixel API plus the `skyhelper-networth` package means writing a second
 * module with these three properties and changing the require above.
 *
 * @typedef {object} NetworthProvider
 * @property {string} name For logs.
 * @property {string} attribution Credit line for the embed footer.
 * @property {(player: {username: string, uuid: string|null}) => Promise<ProviderResult>} fetchNetworth
 */

// One lookup per requester per this long. Checked before the cache, not after:
// even a cache hit costs a guild-chat packet, and Hypixel mutes accounts that
// talk too fast.
const COOLDOWN_MS = 20_000;
const COOLDOWN_LIMIT = 500;

// A success is worth holding on to — the upstream response is measured in
// megabytes. A miss is worth holding on to for a different reason: a mistyped
// name repeated twenty times must cost one request, not twenty. Transient
// failures get a short one so a blip does not stick around for ten minutes.
const CACHE_TTL_OK = 10 * 60_000;
const CACHE_TTL_MISS = 5 * 60_000;
const CACHE_TTL_TRANSIENT = 30_000;
const CACHE_LIMIT = 500;

const MISS_CODES = new Set(['unknown-player', 'no-profiles', 'no-networth']);
const TRANSIENT_CODES = new Set(['timeout', 'network', 'upstream-error', 'upstream-busy', 'malformed']);

// Everything upstream runs through one key. Blunt on purpose: these are
// multi-megabyte JSON.parse calls on the same thread as a live Discord gateway,
// and with the cache and single-flight in front of it this queue is empty almost
// always. The ceiling is what stops a 15-second upstream stall turning into a
// backlog of answers that arrive long after anyone cares.
const QUEUE_KEY = 'networth';
const MAX_QUEUED = 4;

const queue = new SerialQueue();

/** @type {Map<string, number>} requester key → when they last asked. */
const lastAsk = new Map();

/** @type {Map<string, {result: object, expiresAt: number}>} */
const cache = new Map();

/** @type {Map<string, Promise>} in-flight lookups, keyed by lowercase name. */
const inflight = new Map();

let queued = 0;

const UNITS = [[1e12, 't'], [1e9, 'b'], [1e6, 'm'], [1e3, 'k']];

/**
 * Compact coin count: `12.4b`, `998m`, `4.1k`.
 *
 * Never wider than six characters for any plausible networth, which is what the
 * 100-character guild-chat budget in utils/networthReply.js is calculated
 * against. One wart: a value just under a unit boundary rounds up within the
 * smaller unit rather than promoting, so 999.94 billion reads `1000b` rather
 * than `1t`. Unambiguous, still six characters, not worth the extra branch.
 *
 * @param {number} value
 * @returns {string}
 */
function formatCoins(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return '0';

    for (const [size, suffix] of UNITS) {
        if (amount < size) continue;

        const scaled = amount / size;
        // Three significant figures, so the string stays narrow at every scale.
        const text = scaled >= 100 ? String(Math.round(scaled)) : scaled.toFixed(1);
        return `${text.replace(/\.0$/, '')}${suffix}`;
    }

    return String(Math.round(amount));
}

/**
 * Full coin count with thousands separators, for the Discord embed.
 *
 * @param {number} value
 * @returns {string}
 */
function formatExact(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '0';
    return Math.round(amount).toLocaleString('en-US');
}

/**
 * Picks the profile to report: the richest one.
 *
 * Ties go to the player's selected profile, then to the lowest profile id purely
 * so the answer is deterministic rather than dependent on key order.
 *
 * Known wart, and the reason the reply carries an `(API off)` marker: a profile
 * whose owner has the inventory API disabled reports an undercount, so it can
 * lose to a profile it should have beaten. Making that visible is better than
 * guessing at the missing value.
 *
 * @param {ProfileNetworth[]} profiles
 * @returns {ProfileNetworth|null}
 */
function pickBest(profiles) {
    if (!Array.isArray(profiles) || profiles.length === 0) return null;

    let best = null;
    for (const profile of profiles) {
        if (!best) {
            best = profile;
            continue;
        }
        if (profile.networth !== best.networth) {
            if (profile.networth > best.networth) best = profile;
            continue;
        }
        if (profile.current !== best.current) {
            if (profile.current) best = profile;
            continue;
        }
        if (profile.profileId < best.profileId) best = profile;
    }

    return best;
}

/**
 * Whether this requester asked too recently, and consumes their slot if not.
 *
 * Sweeps on insert rather than on a timer, the same shape as utils/relayDedupe.js.
 *
 * @param {string} requesterKey
 * @returns {number} Seconds left on the cooldown, or 0 if they may ask.
 */
function consumeCooldown(requesterKey) {
    const now = Date.now();

    if (lastAsk.size > COOLDOWN_LIMIT) {
        for (const [key, at] of lastAsk) {
            if (now - at > COOLDOWN_MS) lastAsk.delete(key);
        }
    }

    const previous = lastAsk.get(requesterKey);
    if (previous && now - previous < COOLDOWN_MS) {
        return Math.max(1, Math.ceil((COOLDOWN_MS - (now - previous)) / 1000));
    }

    lastAsk.set(requesterKey, now);
    return 0;
}

/**
 * @param {string} key
 * @returns {object|null}
 */
function readCache(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.result;
}

/**
 * @param {string} key
 * @param {object} result
 */
function writeCache(key, result) {
    let ttl = CACHE_TTL_OK;
    if (!result.ok) {
        if (MISS_CODES.has(result.code)) ttl = CACHE_TTL_MISS;
        else if (TRANSIENT_CODES.has(result.code)) ttl = CACHE_TTL_TRANSIENT;
            // Anything else (busy, cooldown) is about us, not about the player, and
        // caching it would answer the next person with our own backpressure.
        else return;
    }

    const now = Date.now();
    if (cache.size > CACHE_LIMIT) {
        for (const [key2, entry] of cache) {
            if (now > entry.expiresAt) cache.delete(key2);
        }
    }

    cache.set(key, {result, expiresAt: now + ttl});
}

/**
 * Resolves the name and fetches the figures. One of these runs at a time.
 *
 * @param {string} requested
 * @param {NetworthProvider} provider
 * @returns {Promise<object>}
 */
async function fetchFresh(requested, provider) {
    let player = {username: requested, uuid: null};

    // Mojang first. It costs about 200ms and buys canonical casing, a uuid for
    // the embed avatar, typos never reaching the multi-megabyte endpoint, and —
    // the reason it is not optional — the only way to tell "no such account"
    // apart from "SkyCrypt has never loaded them", which need opposite advice.
    try {
        const profile = await lookupProfile(requested);
        if (!profile) return {ok: false, code: 'unknown-player', detail: requested};
        player = {username: profile.name, uuid: profile.uuid};
    } catch (error) {
        // Fail open when Mojang is unreachable, the same way /link does: "we
        // could not check" must never be reported as "it is not there".
        console.error('Mojang lookup failed during a networth lookup:', error?.message ?? error);
    }

    const result = await provider.fetchNetworth(player);
    if (!result.ok) return {...result, detail: result.detail ?? player.username};

    const best = pickBest(result.profiles);
    if (!best) return {ok: false, code: 'no-networth', detail: player.username};

    return {
        ok: true,
        player: {name: player.username, uuid: player.uuid},
        best,
        profiles: result.profiles,
        attribution: provider.attribution,
    };
}

/**
 * Looks up a player's SkyBlock networth.
 *
 * Never throws and never resolves to anything the reply layer cannot phrase:
 * every path returns either a success or a `code` from the table in
 * utils/networthReply.js.
 *
 * @param {object} options
 * @param {string} options.username Name to look up, any casing.
 * @param {string} options.requesterKey Who is asking — `mc:<name>` or `d:<id>`.
 * @param {NetworthProvider} [options.provider] Override, for offline tests.
 * @returns {Promise<object>}
 */
async function lookup({username, requesterKey, provider = defaultProvider}) {
    // First, so that one reply costs one cooldown however it turns out.
    const wait = consumeCooldown(String(requesterKey));
    if (wait > 0) return {ok: false, code: 'cooldown', detail: String(wait)};

    const requested = String(username ?? '').trim();
    // Handled here rather than by the callers so that "one reply costs one
    // cooldown" holds for every outcome, including `!nw` typed on its own.
    if (!requested) return {ok: false, code: 'usage'};
    if (!isValidMinecraftName(requested)) {
        return {ok: false, code: 'invalid-name', detail: requested};
    }

    const key = requested.toLowerCase();

    const cached = readCache(key);
    if (cached) return cached;

    // Between the cache and the queue on purpose: three people asking about the
    // same player at once should make one request and should not occupy three
    // queue slots waiting to find that out.
    const existing = inflight.get(key);
    if (existing) return existing;

    if (queued >= MAX_QUEUED) return {ok: false, code: 'busy'};

    const promise = (async () => {
        queued += 1;
        try {
            const result = await queue.run(QUEUE_KEY, () => fetchFresh(requested, provider));
            writeCache(key, result);
            return result;
        } catch (error) {
            console.error('Networth lookup failed:', error);
            return {ok: false, code: 'error'};
        } finally {
            queued -= 1;
            if (inflight.get(key) === promise) inflight.delete(key);
        }
    })();

    inflight.set(key, promise);
    return promise;
}

/**
 * Clears the cooldown, cache and in-flight state. For offline tests only.
 */
function resetState() {
    lastAsk.clear();
    cache.clear();
    inflight.clear();
    queued = 0;
}

module.exports = {
    lookup,
    pickBest,
    formatCoins,
    formatExact,
    resetState,
    COOLDOWN_MS,
    CACHE_TTL_OK,
};
