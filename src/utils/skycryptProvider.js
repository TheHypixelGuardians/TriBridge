// SkyCrypt's public API. This is the only file in the bot that knows SkyCrypt
// exists — everything above it talks to the NetworthProvider interface described
// in utils/networth.js, so swapping to the Hypixel API plus the
// `skyhelper-networth` package later means writing a sibling of this file and
// changing one require.
const SKYCRYPT_PROFILE_URL = "https://sky.shiiyu.moe/api/v2/profile/";

// Generous next to mojang.js's 5s: this endpoint recomputes an entire SkyBlock
// profile and is measured in seconds even when it is healthy.
const TIMEOUT_MS = 15_000;

// SkyCrypt sits behind Cloudflare, which answers an anonymous fetch with 403.
// Identify the bot properly rather than looking like a scraper.
const USER_AGENT = "TriBridge (+https://github.com/Trilleo/THGBridge)";

// The response carries `raw` (the whole Hypixel profile blob) plus every
// computed stat for every profile, so it runs to megabytes. This is a cheap net
// against a pathological one — note `response.json()` buffers regardless and the
// header is absent under chunked encoding, so it is a guard, not a guarantee.
const MAX_BODY_BYTES = 32 * 1024 * 1024;

// Long enough for every real profile name ("Pomegranate" is 11). Clamped here,
// at the untrusted boundary, because the 100-character guild-chat budget is
// calculated against it.
const MAX_CUTE_NAME = 12;

// Networth categories Hypixel could plausibly grow; anything past this is a
// changed upstream shape, not data we want to cache.
const MAX_TYPE_KEYS = 32;

/**
 * Coerces an upstream number, treating anything unusable as zero.
 *
 * @param {unknown} value
 * @returns {number}
 */
function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Maps a SkyCrypt error message and HTTP status onto a failure code.
 *
 * The status is the real behaviour and the message match is a nicety — SkyCrypt
 * is free to reword its errors, so a miss here degrades to `upstream-error`
 * rather than to something wrong.
 *
 * @param {string} message
 * @param {number} status
 * @returns {{ok: false, code: string, detail?: string}}
 */
function classify(message, status) {
  if (/no skyblock profiles/i.test(message))
    return { ok: false, code: "no-profiles" };
  if (/rate limit|too many/i.test(message))
    return { ok: false, code: "upstream-busy" };
  if (status === 429 || status === 503)
    return { ok: false, code: "upstream-busy" };

  return { ok: false, code: "upstream-error", detail: String(status) };
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function clampCuteName(value) {
  const text = String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim();
  if (!text) return "Unknown";
  return text.length > MAX_CUTE_NAME ? text.slice(0, MAX_CUTE_NAME) : text;
}

/**
 * Copies the per-category totals, key by key.
 *
 * Deliberately not a spread: `types` is upstream data, and with
 * `onlyNetworth: true` the categories should hold two numbers each — but a
 * changed shape must not be able to smuggle a large structure into a cache that
 * lives for ten minutes. Empty categories are dropped, which is most of them for
 * most players.
 *
 * @param {unknown} types
 * @returns {Record<string, {total: number, unsoulbound: number}>}
 */
function projectTypes(types) {
  const output = {};
  if (!types || typeof types !== "object") return output;

  let kept = 0;
  for (const [key, value] of Object.entries(types)) {
    if (kept >= MAX_TYPE_KEYS) break;
    if (key.length > 32) continue;

    const total = num(value?.total);
    if (total <= 0) continue;

    output[key] = { total, unsoulbound: num(value?.unsoulboundTotal) };
    kept += 1;
  }

  return output;
}

/**
 * Reduces the multi-megabyte response to the handful of numbers we need.
 *
 * The point of this function is that its argument becomes unreachable the moment
 * it returns: nothing it emits holds a reference into `body`, so `profile.raw`
 * and every computed stat section are collected instead of being cached. What
 * survives is a few hundred bytes per player.
 *
 * @param {object} body Parsed SkyCrypt response.
 * @returns {import('./networth').ProfileNetworth[]}
 */
function project(body) {
  const profiles = [];
  if (!body?.profiles || typeof body.profiles !== "object") return profiles;

  for (const entry of Object.values(body.profiles)) {
    const networth = entry?.data?.networth;
    if (!networth || typeof networth !== "object") continue;

    // SkyCrypt computes this with getPreDecodedNetworth, so `networth`
    // already counts cosmetics and soulbound items; `unsoulboundNetworth` is
    // the same total with soulbound excluded.
    const total = Number(networth.networth);
    if (!Number.isFinite(total)) continue;

    profiles.push({
      profileId: String(entry.profile_id ?? ""),
      cuteName: clampCuteName(entry.cute_name),
      gameMode: typeof entry.game_mode === "string" ? entry.game_mode : null,
      current: entry.current === true,
      networth: total,
      unsoulbound: num(networth.unsoulboundNetworth),
      purse: num(networth.purse),
      bank: num(networth.bank),
      personalBank: num(networth.personalBank),
      noInventory: networth.noInventory === true,
      types: projectTypes(networth.types),
    });
  }

  return profiles;
}

/**
 * Fetches every profile's networth for one player.
 *
 * Never throws: every failure comes back as a code the reply layer knows how to
 * phrase. This is the mojang.js convention taken one step further — there the
 * caller distinguishes "no such player" from "unreachable" by null vs. throw,
 * and here there are a dozen outcomes rather than two.
 *
 * @param {{username: string, uuid?: string|null}} player
 * @returns {Promise<import('./networth').ProviderResult>}
 */
async function fetchNetworth(player) {
  const username = String(player?.username ?? "");

  let response;
  try {
    response = await fetch(
      SKYCRYPT_PROFILE_URL + encodeURIComponent(username),
      {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
  } catch (error) {
    // AbortSignal.timeout rejects with a TimeoutError; anything else is DNS,
    // TLS or the socket dying, which is worth telling apart because only one
    // of the two is worth suggesting a retry for.
    if (error?.name === "TimeoutError") return { ok: false, code: "timeout" };
    return {
      ok: false,
      code: "network",
      detail: error?.message ?? String(error),
    };
  }

  if (!response.ok) {
    let message = "";
    try {
      const failure = await response.json();
      if (typeof failure?.error === "string") message = failure.error;
    } catch {
      // Cloudflare and other intermediaries answer with HTML. The status is
      // all we get, and classify() falls back to exactly that.
    }
    return classify(message, response.status);
  }

  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, code: "malformed", detail: `${declared} bytes` };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return { ok: false, code: "malformed" };
  }

  // A 200 carrying an `error` key happens for the cache-only misses this
  // endpoint is prone to, so it is classified rather than treated as data.
  if (typeof body?.error === "string" && body.error) {
    return classify(body.error, response.status);
  }

  if (!body?.profiles || typeof body.profiles !== "object") {
    return { ok: false, code: "malformed" };
  }

  const profiles = project(body);
  if (profiles.length === 0) return { ok: false, code: "no-networth" };

  return { ok: true, profiles };
}

module.exports = {
  name: "SkyCrypt",
  attribution: "Data from SkyCrypt",
  fetchNetworth,
  // Exported for offline tests against a saved fixture.
  project,
  TIMEOUT_MS,
};
