const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "..", "guildsConfig.json");

// A key is the stable identity of a Hypixel guild: the autocomplete value, the
// bot registry key and `bot.tribridgeGuildKey`. Lowercase so it never depends on
// how an admin typed it.
const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,15}$/;

// Minimum length 2 is deliberate: `!a` as a routing prefix would swallow far too
// much ordinary chat.
const TAG_PATTERN = /^[A-Za-z0-9]{2,8}$/;

const COLOR_PATTERN = /^#?[0-9a-fA-F]{6}$/;

// Today's relay embed colour, so a seeded single-guild install looks unchanged.
const DEFAULT_COLOR = "#2ECC71";

let cachedConfig = null;

function defaults() {
  return {
    version: 1,
    defaultKey: null,
    broadcastByDefault: true,
    guilds: [],
  };
}

function loadConfig() {
  if (cachedConfig) return cachedConfig;

  try {
    const data = fs.readFileSync(CONFIG_PATH, "utf-8");
    cachedConfig = { ...defaults(), ...JSON.parse(data) };
  } catch {
    cachedConfig = defaults();
  }

  // Guard against a hand-edited file: everything downstream assumes an array
  // of objects and a boolean, and a bad type here would surface far away.
  if (!Array.isArray(cachedConfig.guilds)) cachedConfig.guilds = [];
  cachedConfig.guilds = cachedConfig.guilds.filter(
    (g) => g && typeof g === "object",
  );
  if (typeof cachedConfig.broadcastByDefault !== "boolean") {
    cachedConfig.broadcastByDefault = true;
  }

  return cachedConfig;
}

function saveConfig(config) {
  cachedConfig = config;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/** @returns {boolean} Whether the registry file exists on disk. */
function configExists() {
  return fs.existsSync(CONFIG_PATH);
}

function copy(guild) {
  return guild ? { ...guild } : null;
}

/**
 * Normalises a colour to `#RRGGBB`, or null when it isn't one.
 *
 * @param {string} value
 * @returns {string|null}
 */
function normalizeColor(value) {
  const trimmed = String(value ?? "").trim();
  if (!COLOR_PATTERN.test(trimmed)) return null;
  return `#${trimmed.replace(/^#/, "").toUpperCase()}`;
}

/**
 * The colour a guild's relayed messages are shown in, always a usable value.
 *
 * @param {object|null} guild
 * @returns {string}
 */
function colorOf(guild) {
  return normalizeColor(guild?.color) ?? DEFAULT_COLOR;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** @returns {object[]} Every registered Hypixel guild, in registry order. */
function getAll() {
  return loadConfig().guilds.map(copy);
}

/** @returns {object[]} Only the guilds the bot should be connected to. */
function getEnabled() {
  return loadConfig()
    .guilds.filter((g) => g.enabled !== false)
    .map(copy);
}

/**
 * Guilds taking part in the guild-to-guild bridge.
 *
 * Opt-in, and absent from an existing config, so upgrading never starts
 * forwarding chat between guilds that were only ever meant to share a Discord
 * channel. The flag covers both directions at once: a guild that does not send
 * its chat elsewhere does not receive anyone else's either.
 *
 * @returns {object[]}
 */
function getCrossBridged() {
  return loadConfig()
    .guilds.filter((g) => g.enabled !== false && g.crossBridge === true)
    .map(copy);
}

/**
 * @param {string} key
 * @returns {object|null}
 */
function get(key) {
  if (!key) return null;
  const wanted = String(key).toLowerCase();
  return copy(loadConfig().guilds.find((g) => g.key === wanted) ?? null);
}

/**
 * The guild a command acts on when no `guild` option was given.
 *
 * Falls back to the first enabled guild when `defaultKey` is stale (the default
 * was removed or disabled by hand), so commands keep working rather than
 * refusing everything.
 *
 * @returns {object|null}
 */
function getDefault() {
  const config = loadConfig();
  const named = config.guilds.find(
    (g) => g.key === config.defaultKey && g.enabled !== false,
  );
  if (named) return copy(named);
  return copy(config.guilds.find((g) => g.enabled !== false) ?? null);
}

/**
 * Whether a tag would collide with a bot chat command such as `!nw`.
 *
 * Required lazily: utils/chatCommands.js reads the registry to let an install
 * that already has a guild tagged `nw` keep it, and requiring it at the top of
 * this file would make that a cycle. This runs only when an admin adds or edits
 * a guild, so the lookup cost is irrelevant.
 *
 * @param {string} tag
 * @returns {boolean}
 */
function isReservedTag(tag) {
  const { RESERVED_TAGS } = require("./chatCommands");
  return RESERVED_TAGS.has(String(tag ?? "").toLowerCase());
}

/**
 * @param {string} tag
 * @returns {object|null} Matched case-insensitively.
 */
function getByTag(tag) {
  if (!tag) return null;
  const wanted = String(tag).toLowerCase();
  return copy(
    loadConfig().guilds.find((g) => String(g.tag).toLowerCase() === wanted) ??
      null,
  );
}

/**
 * Resolves whatever a user typed into a guild key.
 *
 * Autocomplete is only a hint — Discord lets a user submit arbitrary text into
 * an autocompleted option — so every command must run its raw option value
 * through this rather than indexing the bot registry directly.
 *
 * @param {string} input A key, tag or display name.
 * @returns {string|null} The canonical key, or null when nothing matches.
 */
function resolveKey(input) {
  const wanted = String(input ?? "")
    .trim()
    .toLowerCase();
  if (!wanted) return null;

  const { guilds } = loadConfig();
  const match =
    guilds.find((g) => g.key === wanted) ??
    guilds.find((g) => String(g.tag).toLowerCase() === wanted) ??
    guilds.find((g) => String(g.name).toLowerCase() === wanted);

  return match ? match.key : null;
}

/** @returns {number} */
function count() {
  return loadConfig().guilds.length;
}

/** @returns {boolean} Whether any Hypixel guild is registered at all. */
function isConfigured() {
  return count() > 0;
}

/** @returns {boolean} Whether an untagged bridge message goes to every guild. */
function broadcastByDefault() {
  return loadConfig().broadcastByDefault !== false;
}

/**
 * Whether relayed messages should carry a `[TAG]` suffix.
 *
 * False with one guild, which is what keeps a single-guild install looking
 * exactly as it did before multi-guild support: no tag anybody has to read past
 * when there is nothing to disambiguate.
 *
 * @returns {boolean}
 */
function shouldShowTags() {
  return count() > 1;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Registers a new Hypixel guild.
 *
 * The account is lowercased here and never touched again: prismarine-auth names
 * its token cache after `sha1(account)`, so normalising it later would silently
 * start a fresh device-code flow against a different cache file.
 *
 * @param {{key: string, name: string, tag: string, account: string,
 *   color?: string, addedBy?: string|null}} input
 * @returns {{ok: true, guild: object} | {ok: false, reason: string}}
 */
function add(input) {
  const key = String(input.key ?? "")
    .trim()
    .toLowerCase();
  if (!KEY_PATTERN.test(key)) return { ok: false, reason: "invalid-key" };

  const name = String(input.name ?? "").trim();
  if (!name || name.length > 64) return { ok: false, reason: "invalid-name" };

  const tag = String(input.tag ?? "").trim();
  if (!TAG_PATTERN.test(tag)) return { ok: false, reason: "invalid-tag" };
  if (isReservedTag(tag)) return { ok: false, reason: "reserved-tag" };

  const account = String(input.account ?? "")
    .trim()
    .toLowerCase();
  if (!account || account.length > 128 || /\s/.test(account)) {
    return { ok: false, reason: "invalid-account" };
  }

  const color = input.color ? normalizeColor(input.color) : DEFAULT_COLOR;
  if (!color) return { ok: false, reason: "invalid-color" };

  const config = loadConfig();
  if (config.guilds.some((g) => g.key === key))
    return { ok: false, reason: "duplicate-key" };
  if (
    config.guilds.some((g) => String(g.tag).toLowerCase() === tag.toLowerCase())
  ) {
    return { ok: false, reason: "duplicate-tag" };
  }
  // Two mineflayer bots cannot hold a Hypixel session on one account.
  if (config.guilds.some((g) => g.account === account)) {
    return { ok: false, reason: "duplicate-account" };
  }

  const guild = {
    key,
    name,
    tag,
    account,
    color,
    logChannelId: null,
    auditChannelId: null,
    bridgeChannelId: null,
    enabled: true,
    crossBridge: false,
    mcName: null,
    mcUuid: null,
    addedBy: input.addedBy ?? null,
    addedAt: Date.now(),
  };

  config.guilds.push(guild);
  if (!config.defaultKey) config.defaultKey = key;
  saveConfig(config);

  return { ok: true, guild: copy(guild) };
}

const PATCHABLE = new Set([
  "name",
  "tag",
  "color",
  "logChannelId",
  "auditChannelId",
  "enabled",
  "crossBridge",
  "mcName",
  "mcUuid",
]);

const BOOLEAN_FIELDS = new Set(["enabled", "crossBridge"]);

/**
 * Updates a guild in place. `key` and `account` are immutable — changing either
 * means removing the guild and adding it again.
 *
 * @param {string} key
 * @param {object} patch
 * @returns {{ok: true, guild: object} | {ok: false, reason: string}}
 */
function update(key, patch) {
  const config = loadConfig();
  const guild = config.guilds.find(
    (g) => g.key === String(key ?? "").toLowerCase(),
  );
  if (!guild) return { ok: false, reason: "unknown-key" };

  const changes = {};

  for (const [field, raw] of Object.entries(patch ?? {})) {
    if (!PATCHABLE.has(field) || raw === undefined) continue;

    if (field === "name") {
      const name = String(raw).trim();
      if (!name || name.length > 64)
        return { ok: false, reason: "invalid-name" };
      changes.name = name;
    } else if (field === "tag") {
      const tag = String(raw).trim();
      if (!TAG_PATTERN.test(tag)) return { ok: false, reason: "invalid-tag" };
      if (isReservedTag(tag)) return { ok: false, reason: "reserved-tag" };
      const taken = config.guilds.some(
        (g) =>
          g.key !== guild.key &&
          String(g.tag).toLowerCase() === tag.toLowerCase(),
      );
      if (taken) return { ok: false, reason: "duplicate-tag" };
      changes.tag = tag;
    } else if (field === "color") {
      const color = normalizeColor(raw);
      if (!color) return { ok: false, reason: "invalid-color" };
      changes.color = color;
    } else if (BOOLEAN_FIELDS.has(field)) {
      changes[field] = Boolean(raw);
    } else {
      changes[field] = raw === null ? null : String(raw);
    }
  }

  if (Object.keys(changes).length === 0)
    return { ok: false, reason: "no-changes" };

  Object.assign(guild, changes);
  saveConfig(config);

  return { ok: true, guild: copy(guild) };
}

/**
 * @param {string} key
 * @returns {{ok: true, guild: object} | {ok: false, reason: string}}
 */
function remove(key) {
  const config = loadConfig();
  const wanted = String(key ?? "").toLowerCase();
  const index = config.guilds.findIndex((g) => g.key === wanted);
  if (index === -1) return { ok: false, reason: "unknown-key" };

  const [removed] = config.guilds.splice(index, 1);

  // Never leave `defaultKey` pointing at a guild that is gone.
  if (config.defaultKey === removed.key) {
    config.defaultKey =
      config.guilds.find((g) => g.enabled !== false)?.key ??
      config.guilds[0]?.key ??
      null;
  }

  saveConfig(config);
  return { ok: true, guild: copy(removed) };
}

/**
 * @param {string} key
 * @returns {{ok: true, guild: object} | {ok: false, reason: string}}
 */
function setDefault(key) {
  const config = loadConfig();
  const guild = config.guilds.find(
    (g) => g.key === String(key ?? "").toLowerCase(),
  );
  if (!guild) return { ok: false, reason: "unknown-key" };

  config.defaultKey = guild.key;
  saveConfig(config);
  return { ok: true, guild: copy(guild) };
}

/**
 * @param {boolean} enabled
 */
function setBroadcastByDefault(enabled) {
  const config = loadConfig();
  config.broadcastByDefault = Boolean(enabled);
  saveConfig(config);
}

/**
 * Seeds a single guild from `MINECRAFT_USERNAME` on an install that predates
 * the registry, so an existing deployment keeps working with no config edits.
 *
 * Only ever runs when the registry file is absent — an existing file is
 * authoritative and is never rewritten from the environment.
 *
 * @returns {{seeded: boolean, guild?: object, reason?: string}}
 */
function ensureSeeded() {
  if (configExists()) return { seeded: false, reason: "already-configured" };

  const account = String(process.env.MINECRAFT_USERNAME ?? "").trim();
  if (!account) return { seeded: false, reason: "no-account" };

  const result = add({
    key: "main",
    name: "Guild",
    tag: "MAIN",
    account,
    color: DEFAULT_COLOR,
    addedBy: null,
  });

  if (!result.ok) return { seeded: false, reason: result.reason };
  return { seeded: true, guild: result.guild };
}

module.exports = {
  getAll,
  getEnabled,
  getCrossBridged,
  get,
  getDefault,
  getByTag,
  resolveKey,
  count,
  isConfigured,
  broadcastByDefault,
  shouldShowTags,
  add,
  update,
  remove,
  setDefault,
  setBroadcastByDefault,
  ensureSeeded,
  configExists,
  colorOf,
  normalizeColor,
  CONFIG_PATH,
  KEY_PATTERN,
  TAG_PATTERN,
  DEFAULT_COLOR,
};
