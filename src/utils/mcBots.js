const bridge = require("../bridge");
const guilds = require("./guilds");

/**
 * @typedef {object} BotRecord
 * @property {string} key Hypixel guild key this bot serves.
 * @property {object|null} config Registry record snapshot taken at creation.
 * @property {import('mineflayer').Bot|null} bot
 * @property {boolean} connected True between `spawn` and `end`.
 * @property {boolean} connecting True from the start of a connect attempt until
 *   it spawns, ends or times out. Never cleared merely because `createMcBot`
 *   returned — the bot is still mid-handshake at that point.
 * @property {boolean} awaitingDeviceCode True while a human has to complete a
 *   Microsoft sign-in. Suppresses the reconnect poller, which would otherwise
 *   start a second flow ten seconds later, and a third after that.
 * @property {number} attempts Consecutive failed attempts, for backoff.
 * @property {number} nextAttemptAt Epoch ms before which not to retry.
 * @property {number|null} lastSpawnAt
 * @property {number|null} lastEndAt
 * @property {Error|null} lastError
 * @property {string|null} hypixelGuildName Probed once per connection, used to
 *   detect two accounts sitting in the same Hypixel guild.
 * @property {Promise} queue Per-bot serialisation for chat queries.
 * @property {{last: number, chain: Promise}} chatQueue Outbound rate limiter state.
 * @property {(() => void)|null} dispose Removes the event handlers bound to `bot`.
 */

/**
 * Returns the record for a guild key, creating an empty one on first touch.
 *
 * @param {string} key
 * @returns {BotRecord}
 */
function ensureRecord(key) {
  let record = bridge.mcBots.get(key);
  if (record) return record;

  record = {
    key,
    config: null,
    bot: null,
    connected: false,
    connecting: false,
    awaitingDeviceCode: false,
    attempts: 0,
    nextAttemptAt: 0,
    lastSpawnAt: null,
    lastEndAt: null,
    lastError: null,
    hypixelGuildName: null,
    queue: Promise.resolve(),
    chatQueue: { last: 0, chain: Promise.resolve() },
    dispose: null,
  };

  bridge.mcBots.set(key, record);
  return record;
}

/**
 * @param {string} key
 * @returns {BotRecord|null}
 */
function getRecord(key) {
  return key ? (bridge.mcBots.get(key) ?? null) : null;
}

/** @returns {BotRecord[]} */
function getAllRecords() {
  return [...bridge.mcBots.values()];
}

/** @returns {BotRecord[]} Records with a live, spawned bot. */
function getConnectedRecords() {
  return getAllRecords().filter((record) => record.connected && record.bot);
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function isConnected(key) {
  const record = getRecord(key);
  return Boolean(record?.connected && record.bot);
}

/**
 * The Hypixel guild a mineflayer bot belongs to.
 *
 * Reads the key off the bot rather than scanning the registry: this runs on
 * every chat line from every bot, and — more importantly — a scan would return
 * null for a *retired* bot whose messages are still arriving, silently changing
 * behaviour. The property outlives retirement, so late lines stay attributable.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {object|null} The registry record, or null if the bot is unknown.
 */
function guildForBot(bot) {
  const key = bot?.tribridgeGuildKey;
  return key ? guilds.get(key) : null;
}

/**
 * Whether a Minecraft name belongs to *any* of the bot's own accounts.
 *
 * The relay loop guard: with one bot per Hypixel guild, checking only the
 * emitting bot's own name would let two accounts that share a guild relay each
 * other's `/gc` output as if a player had typed it.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isOwnAccountName(name) {
  if (!name) return false;
  const wanted = String(name).toLowerCase();

  return getAllRecords().some((record) => {
    const username = record.bot?.username;
    return Boolean(username) && username.toLowerCase() === wanted;
  });
}

/**
 * @param {string} key
 * @returns {'online'|'connecting'|'awaiting-signin'|'offline'|'disabled'|'unregistered'}
 */
function describeStatus(key) {
  const guild = guilds.get(key);
  if (!guild) return "unregistered";
  if (guild.enabled === false) return "disabled";

  const record = getRecord(key);
  if (!record) return "offline";
  if (record.connected && record.bot) return "online";
  if (record.awaitingDeviceCode) return "awaiting-signin";
  if (record.connecting) return "connecting";
  return "offline";
}

const STATUS_LABELS = {
  online: "🟢 Online",
  connecting: "🔄 Connecting…",
  "awaiting-signin": "🔐 Awaiting sign-in",
  offline: "🔴 Offline",
  disabled: "⏸️ Disabled",
  unregistered: "❔ Unknown",
};

/**
 * @param {string} key
 * @returns {string} A human-readable status for embeds and replies.
 */
function describeStatusLabel(key) {
  return STATUS_LABELS[describeStatus(key)] ?? STATUS_LABELS.unregistered;
}

module.exports = {
  ensureRecord,
  getRecord,
  getAllRecords,
  getConnectedRecords,
  isConnected,
  guildForBot,
  isOwnAccountName,
  describeStatus,
  describeStatusLabel,
  STATUS_LABELS,
};
