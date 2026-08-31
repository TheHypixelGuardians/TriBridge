const fs = require("fs");
const path = require("path");
const { getLinkByName } = require("./linkedAccounts");

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

let cachedConfig = null;
let expiryTimer = null;

function loadConfig() {
  if (cachedConfig) return cachedConfig;

  try {
    const data = fs.readFileSync(CONFIG_PATH, "utf-8");
    cachedConfig = { ...defaults(), ...JSON.parse(data) };
  } catch {
    cachedConfig = defaults();
  }

  // The gate indexes these on every message, so a hand-edited file must not
  // be able to turn `.includes` into a TypeError.
  for (const key of ["testerIds", "testChannelIds", "excludedChannelIds"]) {
    if (!Array.isArray(cachedConfig[key])) cachedConfig[key] = [];
  }

  // Same for the two bridge switches: a hand-edited `"false"` is a truthy
  // string, which would read as "on" and quietly do the opposite of the file.
  for (const key of ["disguiseToMinecraft", "disguiseToDiscord"]) {
    if (typeof cachedConfig[key] !== "boolean") cachedConfig[key] = true;
  }

  return cachedConfig;
}

function saveConfig(config) {
  cachedConfig = config;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
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
    stop();
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
 * @returns {boolean}
 */
function appliesToGuildChat(mcName, channelId) {
  if (!isActive()) return false;

  const config = loadConfig();
  if (!config.disguiseToDiscord) return false;

  const name = String(mcName ?? "").toLowerCase();

  if (config.target.mcName && config.target.mcName.toLowerCase() === name)
    return false;

  if (config.mode === "test") {
    if (!config.testChannelIds.includes(channelId)) return false;
    const link = getLinkByName(mcName);
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
 * @returns {object} The new state.
 */
function start({ target, durationMs, startedBy, mode }) {
  const config = loadConfig();

  config.mode = mode;
  config.target = target;
  config.startedBy = startedBy;
  config.startedAt = Date.now();
  config.expiresAt =
    durationMs === null || durationMs === undefined
      ? null
      : Date.now() + durationMs;

  saveConfig(config);
  return getState();
}

/**
 * Ends the effect, leaving the tester and channel lists intact so the next run
 * does not have to be set up from scratch.
 *
 * @returns {{mode: string, target: object|null, expiresAt: number|null, startedBy: string|null, startedAt: number|null}}
 *   What was running, for the benefit of whoever announces the end.
 */
function stop() {
  const config = loadConfig();

  const previous = {
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

  saveConfig(config);
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
    onEnd(stop());
    return;
  }

  expiryTimer = setTimeout(
    () => {
      expiryTimer = null;

      const state = loadConfig();
      if (state.mode === "off") return;

      if (state.expiresAt !== null && Date.now() >= state.expiresAt) {
        onEnd(stop());
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
 */
function setList(key, ids) {
  const config = loadConfig();
  config[key] = [...new Set(ids.map(String))];
  saveConfig(config);
  return config[key];
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
 * @returns {boolean} The stored value.
 */
function setDirection(key, enabled) {
  const config = loadConfig();
  config[key] = Boolean(enabled);
  saveConfig(config);
  return config[key];
}

module.exports = {
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
