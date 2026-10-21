const path = require("path");
const { getLinkByName } = require("./linkedAccounts");
const store = require("./configStore");

const CONFIG_NAME = "globalProfile";

// The import source and the local snapshot of the database row — see
// configStore.js.
const CONFIG_PATH = path.join(
  __dirname,
  "..",
  "..",
  "globalProfileConfig.json",
);

// setTimeout keeps its delay in a signed 32-bit int and fires *immediately* if
// handed anything larger, so long effects re-arm in chunks of this size.
const MAX_TIMEOUT = 2 ** 31 - 1;

/**
 * Fresh defaults on every call — the arrays must not be shared between the
 * cache and a later reset.
 */
function defaults() {
  return {
    mode: "off",
    target: null,
    expiresAt: null,
    startedBy: null,
    startedAt: null,
    testerIds: [],
    testChannelIds: [],
    excludedChannelIds: [],
    disguiseToMinecraft: true,
    disguiseToDiscord: true,
  };
}

let cachedConfig = defaults();
let expiryTimer = null;
let ending = null;

/**
 * @param {object|undefined} raw A stored document or a legacy file.
 * @returns {object}
 */
function normalise(raw) {
  const config = { ...defaults(), ...raw };

  // The gate indexes these on every message, so a hand-edited file must not
  // be able to turn `.includes` into a TypeError.
  for (const key of ["testerIds", "testChannelIds", "excludedChannelIds"]) {
    if (!Array.isArray(config[key])) config[key] = [];
  }

  // Same for the two bridge switches: a hand-edited `"false"` is a truthy
  // string, which would read as "on" and quietly do the opposite of the file.
  for (const key of ["disguiseToMinecraft", "disguiseToDiscord"]) {
    if (typeof config[key] !== "boolean") config[key] = true;
  }

  return config;
}

/**
 * Loads the state from the database (or, with `{ fromSnapshot: true }`, from
 * its local snapshot). Must finish before anything reads it.
 */
async function load(options) {
  ({ data: cachedConfig } = await store.load(
    CONFIG_NAME,
    CONFIG_PATH,
    normalise,
    options,
  ));
}

function loadConfig() {
  return cachedConfig;
}

/**
 * Saves a change, then applies it — see `configStore.commit`.
 *
 * @template T
 * @param {(draft: object) => T} edit
 * @returns {Promise<T>}
 */
function change(edit) {
  return store.commit(CONFIG_NAME, loadConfig, edit, (saved) => {
    cachedConfig = saved;
  });
}

/**
 * @returns {object} A copy of the stored state, safe for callers to read from
 *   without reaching into the cache.
 */
function getState() {
  const config = loadConfig();
  return {
    ...config,
    target: config.target ? { ...config.target } : null,
    testerIds: [...config.testerIds],
    testChannelIds: [...config.testChannelIds],
    excludedChannelIds: [...config.excludedChannelIds],
  };
}

/**
 * @returns {{userId: string, name: string, avatarURL: string|null, mcName: string|null, mcUuid: string|null}|null}
 *   The identity everybody is currently being shown as.
 */
function getTarget() {
  const target = loadConfig().target;
  return target ? { ...target } : null;
}

/**
 * Whether a global profile change is running right now.
 *
 * This is the authoritative check, not the expiry timer: a lapsed effect is
 * cleared here on read, so a timer lost to a restart or a clock jump can never
 * leave the disguise stuck on.
 *
 * @returns {boolean}
 */
function isActive() {
  const config = loadConfig();
  if (config.mode === "off" || !config.target) return false;

  if (config.expiresAt !== null && Date.now() >= config.expiresAt) {
    // Reads as off from here on, whatever the save does. One stop at a time:
    // this runs on every message, and each would otherwise queue its own.
    ending ??= stop()
      .catch(logSaveError)
      .finally(() => {
        ending = null;
      });
    return false;
  }

  return true;
}

/**
 * The gate for Discord → anywhere. Called once per message, so it stays cheap:
 * cached config reads and array lookups only.
 *
 * @param {string} userId Author of the message.
 * @param {string} channelId Channel the message was sent in.
 * @returns {boolean}
 */
function appliesTo(userId, channelId) {
  if (!isActive()) return false;

  const config = loadConfig();

  // They already wear that face; reposting would cost a send and a delete to
  // produce exactly the same message.
  if (userId === config.target.userId) return false;

  if (config.mode === "test") {
    return (
      config.testerIds.includes(userId) &&
      config.testChannelIds.includes(channelId)
    );
  }

  return !config.excludedChannelIds.includes(channelId);
}

/**
 * Whether the Discord → guild chat leg of the disguise is switched on.
 *
 * This governs the name guild chat is told, and nothing else. The Discord
 * repost still wears the target's face either way, so switching it off stops
 * the disguise at the bridge rather than turning it off outright.
 *
 * @returns {boolean}
 */
function disguisesToMinecraft() {
  return loadConfig().disguiseToMinecraft;
}

/**
 * The gate for guild chat → Discord.
 *
 * Test mode has no Discord author to check, so it leans on the account link:
 * only a tester's *own* Minecraft messages are rewritten. Without that, testing
 * would silently relabel guild members who never agreed to take part.
 *
 * @param {string} mcName The Minecraft name that spoke in guild chat.
 * @param {string} channelId The bridge channel the message is headed for.
 * @returns {Promise<boolean>} Async only because the link lookup it needs in
 *   test mode is.
 */
async function appliesToGuildChat(mcName, channelId) {
  if (!isActive()) return false;

  const config = loadConfig();
  if (!config.disguiseToDiscord) return false;

  const name = String(mcName ?? "").toLowerCase();

  if (config.target.mcName && config.target.mcName.toLowerCase() === name)
    return false;

  if (config.mode === "test") {
    if (!config.testChannelIds.includes(channelId)) return false;
    const link = await getLinkByName(mcName);
    return Boolean(link) && config.testerIds.includes(link.discordId);
  }

  return !config.excludedChannelIds.includes(channelId);
}

/**
 * Begins a global profile change.
 *
 * The target's identity is snapshotted rather than looked up per message: the
 * hot path runs on every message in the server and must not fetch a member.
 *
 * @param {{
 *   target: {userId: string, name: string, avatarURL: string|null, mcName: string|null, mcUuid: string|null},
 *   durationMs: number|null,
 *   startedBy: string,
 *   mode: 'test'|'live',
 * }} options `durationMs: null` runs until somebody stops it.
 * @returns {Promise<object>} The new state. Rejects when it could not be
 *   saved, and then nothing is running: a disguise the database does not know
 *   about would outlive the audit trail and vanish on restart.
 */
async function start({ target, durationMs, startedBy, mode }) {
  await change((config) => {
    config.mode = mode;
    config.target = target;
    config.startedBy = startedBy;
    config.startedAt = Date.now();
    config.expiresAt =
      durationMs === null || durationMs === undefined
        ? null
        : Date.now() + durationMs;
  });
  return getState();
}

/**
 * Ends the effect, leaving the tester and channel lists intact so the next run
 * does not have to be set up from scratch.
 *
 * @returns {Promise<{mode: string, target: object|null, expiresAt: number|null, startedBy: string|null, startedAt: number|null}>}
 *   What was running, for the benefit of whoever announces the end. Rejects
 *   when the end could not be saved, and then it is still running.
 */
async function stop() {
  const previous = await change((config) => {
    const was = {
      mode: config.mode,
      target: config.target ? { ...config.target } : null,
      expiresAt: config.expiresAt,
      startedBy: config.startedBy,
      startedAt: config.startedAt,
    };

    config.mode = "off";
    config.target = null;
    config.expiresAt = null;
    config.startedBy = null;
    config.startedAt = null;

    return was;
  });

  clearExpiry();
  return previous;
}

function clearExpiry() {
  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }
}

/**
 * Schedules `onEnd` for when the running effect lapses.
 *
 * The timer exists only to *announce* the end and is safe to miss — `isActive`
 * is what actually decides whether the disguise applies.
 *
 * @param {(previous: object) => void} onEnd Handed the state that just ended.
 */
function armExpiry(onEnd) {
  clearExpiry();

  const config = loadConfig();
  if (config.mode === "off" || config.expiresAt === null) return;

  const remaining = config.expiresAt - Date.now();
  if (remaining <= 0) {
    // A failed save is announced on the next start instead, by
    // 004restoreGlobalProfile, which will find the lapsed effect still stored.
    stop().then(onEnd, logSaveError);
    return;
  }

  expiryTimer = setTimeout(
    () => {
      expiryTimer = null;

      const state = loadConfig();
      if (state.mode === "off") return;

      if (state.expiresAt !== null && Date.now() >= state.expiresAt) {
        stop().then(onEnd, logSaveError);
        return;
      }

      // Only a chunk of a longer wait has elapsed; queue the next one.
      armExpiry(onEnd);
    },
    Math.min(remaining, MAX_TIMEOUT),
  );

  if (expiryTimer.unref) expiryTimer.unref();
}

/**
 * Replaces one of the scope lists wholesale — the panel's select menus hand
 * back the full selection rather than a single addition.
 *
 * @param {'testerIds'|'testChannelIds'|'excludedChannelIds'} key
 * @param {string[]} ids
 * @returns {Promise<string[]>} The stored list.
 */
async function setList(key, ids) {
  const list = [...new Set(ids.map(String))];
  await change((config) => {
    config[key] = list;
  });
  return list;
}

const setTesters = (ids) => setList("testerIds", ids);
const setTestChannels = (ids) => setList("testChannelIds", ids);
const setExcludedChannels = (ids) => setList("excludedChannelIds", ids);

/**
 * Switches one leg of the bridge disguise on or off.
 *
 * Kept out of {@link start} and {@link stop} on purpose: like the tester and
 * channel lists, this is settings rather than part of a run, so it survives an
 * effect ending and applies to the next one.
 *
 * @param {'disguiseToMinecraft'|'disguiseToDiscord'} key
 * @param {boolean} enabled
 * @returns {Promise<boolean>} The stored value.
 */
async function setDirection(key, enabled) {
  const value = Boolean(enabled);
  await change((config) => {
    config[key] = value;
  });
  return value;
}

function logSaveError(error) {
  console.error("Failed to save the global profile change:", error);
}

module.exports = {
  load,
  normalise,
  getState,
  getTarget,
  isActive,
  appliesTo,
  appliesToGuildChat,
  disguisesToMinecraft,
  start,
  stop,
  armExpiry,
  clearExpiry,
  setTesters,
  setTestChannels,
  setExcludedChannels,
  setDirection,
};
