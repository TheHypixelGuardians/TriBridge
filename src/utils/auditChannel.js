const bridge = require("../bridge");
const db = require("./db");

/**
 * The channel disguised messages are recorded in.
 *
 * The default is configured on the THG community bot with `/auditchannel` and
 * read from its database, so both bots record into one place — the community
 * side records its own reposts, this side records the guild-chat legs. A Hypixel
 * guild may still override the destination for its own entries; those overrides
 * live in `guildsConfig.json` rather than in the shared database, so removing a
 * guild cannot leave an orphaned channel setting behind.
 */
const TTL_MS = 30_000;

let cache = null;

/**
 * @returns {Promise<string|null>} The server-wide audit channel, or null when
 *   none is configured or the database cannot be reached.
 */
async function getDefaultAuditChannelId() {
  if (cache && Date.now() - cache.readAt < TTL_MS) return cache.channelId;

  const guildId = bridge.discordServerId;
  if (!guildId) return null;

  const rows = await db.query(
    `SELECT "auditChannelId" FROM "Setup" WHERE "guildId" = $1 LIMIT 1`,
    [guildId],
  );

  if (rows === null) return cache?.channelId ?? null;

  const channelId = rows[0]?.auditChannelId || null;
  cache = { channelId, readAt: Date.now() };
  return channelId;
}

/**
 * @param {string} [guildKey] Scope the lookup to one Hypixel guild.
 * @returns {Promise<string|null>} Null when nothing is configured at either
 *   level.
 */
async function getAuditChannelId(guildKey) {
  if (guildKey) {
    // Required lazily: guilds.js is loaded by modules that this one is loaded
    // by, and a top-level require would close the cycle.
    const guilds = require("./guilds");
    const scoped = guilds.get(guildKey)?.auditChannelId;
    if (scoped) return scoped;
  }

  return getDefaultAuditChannelId();
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
 *   channel when it has its own; otherwise the shared one.
 * @returns {Promise<boolean>} Whether the line landed.
 */
async function logAudit(payload, { guildKey } = {}) {
  const channelId = await getAuditChannelId(guildKey);
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

module.exports = { getAuditChannelId, logAudit };
