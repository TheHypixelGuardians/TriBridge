const path = require("path");
const bridge = require("../bridge");
const store = require("./configStore");

const CONFIG_NAME = "auditChannel";

// Only read once, to import it into the database — see configStore.js.
const CONFIG_PATH = path.join(__dirname, "..", "..", "auditChannelConfig.json");

let cachedConfig = { channelId: null };

/**
 * Loads the setting from the database. Must finish before anything reads it.
 */
async function load() {
  ({ data: cachedConfig } = await store.load(
    CONFIG_NAME,
    CONFIG_PATH,
    (raw) => raw ?? { channelId: null },
  ));
}

/**
 * The channel admin actions are recorded in.
 *
 * A Hypixel guild may override the destination for its own entries. Those
 * overrides live in the guild registry rather than here, so removing a guild
 * cannot leave an orphaned channel setting behind.
 *
 * @param {string} [guildKey] Scope the lookup to one Hypixel guild.
 * @returns {string|null} Null when nothing is configured at either level.
 */
function getAuditChannelId(guildKey) {
  if (guildKey) {
    // Required lazily: guilds.js is loaded by modules that this one is
    // loaded by, and a top-level require would close the cycle.
    const guilds = require("./guilds");
    const scoped = guilds.get(guildKey)?.auditChannelId;
    if (scoped) return scoped;
  }
  return cachedConfig.channelId ?? null;
}

/**
 * @param {string|null} channelId Pass null to stop recording.
 * @returns {Promise<void>} Rejects when the setting could not be saved.
 */
async function setAuditChannelId(channelId) {
  await store.commit(
    CONFIG_NAME,
    () => cachedConfig,
    (draft) => {
      draft.channelId = channelId ?? null;
    },
    (saved) => {
      cachedConfig = saved;
    },
  );
}

/**
 * Writes a line to the audit channel.
 *
 * Deliberately never throws and never reports failure to the caller: audit
 * entries accompany work that has already happened, and a misconfigured audit
 * channel must not take that work down with it.
 *
 * @param {string|import('discord.js').MessageCreateOptions} payload
 * @param {{guildKey?: string}} [options] Route to one Hypixel guild's audit
 *   channel when it has its own; otherwise the global one, as before.
 * @returns {Promise<boolean>} Whether the line landed.
 */
async function logAudit(payload, { guildKey } = {}) {
  const channelId = getAuditChannelId(guildKey);
  if (!channelId || !bridge.discordClient) return false;

  const options = typeof payload === "string" ? { content: payload } : payload;

  try {
    const channel = await bridge.discordClient.channels.fetch(channelId);
    // Audit lines quote member-supplied names, so nothing in them may ping.
    await channel.send({ allowedMentions: { parse: [] }, ...options });
    return true;
  } catch (error) {
    console.error("Failed to write to the audit channel:", error);
    return false;
  }
}

module.exports = { load, getAuditChannelId, setAuditChannelId, logAudit };
