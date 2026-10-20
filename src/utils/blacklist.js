const { MessageFlags } = require("discord.js");
const db = require("./db");

/**
 * The blacklist shared with the THG community bot: members barred from every
 * command of both bots, and from having their Discord messages relayed into
 * Minecraft.
 *
 * This is the **one table this bot writes** in the community bot's schema.
 * `/blacklist` lives here, so the writes do too; the community bot only reads.
 * The table is defined by the community bot's Prisma schema and migrations, with
 * database-side defaults for `id` and `updatedAt`, which is what lets a plain
 * INSERT here work at all.
 *
 * Cached per Discord server for 15 seconds, the same window as the link and
 * admin-role caches. Writes from this process clear the cache, so a change made
 * here applies immediately; the community bot catches up within the TTL.
 */
const TTL_MS = 15_000;

let cache = null;

/**
 * @param {string} serverId Discord server id.
 * @returns {Promise<object[]|null>} The entries, oldest first, or null when the
 *   database could not be read.
 */
async function getEntries(serverId) {
  if (
    cache &&
    cache.serverId === serverId &&
    Date.now() - cache.readAt < TTL_MS
  ) {
    return cache.entries;
  }

  const rows = await db.query(
    `SELECT "discordId", "reason", "addedById", "createdAt"
       FROM "Blacklist" WHERE "guildId" = $1 ORDER BY "createdAt"`,
    [serverId],
  );
  if (rows === null) return null;

  cache = { serverId, entries: rows, readAt: Date.now() };
  return rows;
}

/**
 * Whether a member is blacklisted.
 *
 * **Fails open.** An unreadable database is "not blacklisted": failing closed
 * would refuse every command and drop every relayed message for the whole
 * server during an outage. `isAdmin` still fails closed, so nothing privileged
 * opens up.
 *
 * @param {string|null|undefined} serverId Discord server id.
 * @param {string} discordId
 * @returns {Promise<boolean>}
 */
async function isBlacklisted(serverId, discordId) {
  if (!serverId || !discordId) return false;
  const entries = await getEntries(serverId);
  if (!entries) return false;
  return entries.some((entry) => entry.discordId === discordId);
}

/**
 * @returns {Promise<"added"|"exists"|"error">}
 */
async function add(serverId, discordId, { reason, addedById }) {
  const rows = await db.query(
    `INSERT INTO "Blacklist" ("guildId", "discordId", "reason", "addedById")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("guildId", "discordId") DO NOTHING
     RETURNING "discordId"`,
    [serverId, discordId, reason || null, addedById],
  );
  if (rows === null) return "error";
  cache = null;
  return rows.length > 0 ? "added" : "exists";
}

/**
 * @returns {Promise<"removed"|"missing"|"error">}
 */
async function remove(serverId, discordId) {
  const rows = await db.query(
    `DELETE FROM "Blacklist" WHERE "guildId" = $1 AND "discordId" = $2
     RETURNING "discordId"`,
    [serverId, discordId],
  );
  if (rows === null) return "error";
  cache = null;
  return rows.length > 0 ? "removed" : "missing";
}

const REFUSAL = "❌ You are blacklisted from using this bot's commands.";

/**
 * Refuses an interaction from a blacklisted member. Every interaction handler
 * calls this after its server guard, because the event handler runs each file
 * independently and none of them can stop the others.
 *
 * @param {import('discord.js').Interaction} interaction
 * @returns {Promise<boolean>} True when the interaction was refused and the
 *   caller must stop.
 */
async function refuseIfBlacklisted(interaction) {
  if (!(await isBlacklisted(interaction.guildId, interaction.user?.id))) {
    return false;
  }

  if (interaction.isAutocomplete()) {
    await interaction.respond([]).catch(() => {});
  } else if (interaction.isRepliable() && !interaction.replied) {
    const reply = interaction.deferred
      ? interaction.editReply(REFUSAL)
      : interaction.reply({ content: REFUSAL, flags: MessageFlags.Ephemeral });
    await reply.catch(() => {});
  }
  return true;
}

module.exports = {
  getEntries,
  isBlacklisted,
  add,
  remove,
  refuseIfBlacklisted,
  REFUSAL,
  TTL_MS,
};
