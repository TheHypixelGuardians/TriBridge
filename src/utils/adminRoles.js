const bridge = require("../bridge");
const db = require("./db");

/**
 * Bot-admin roles, read from the THG community bot's database.
 *
 * `/adminrole` lives on the community bot now, and both bots read this one list
 * so a role that opens the community admin panel also gates `/send` and
 * `/guilds` here. There is no write path on this side.
 *
 * Cached for a few seconds: it is checked on every admin command, and an admin
 * role granted or revoked should take effect in seconds rather than at the next
 * restart.
 */
const TTL_MS = 15_000;

let cache = null;

/**
 * @param {string} guildId Discord server id.
 * @returns {Promise<string[]|null>} null when the list could not be read at all.
 */
async function getRoles(guildId) {
  if (cache && cache.guildId === guildId && Date.now() - cache.readAt < TTL_MS) {
    return cache.roleIds;
  }

  const rows = await db.query(
    `SELECT "roleId" FROM "AdminRole" WHERE "guildId" = $1`,
    [guildId],
  );

  if (rows === null) return null;

  const roleIds = rows.map((row) => row.roleId);
  cache = { guildId, roleIds, readAt: Date.now() };
  return roleIds;
}

/**
 * Whether a member holds a bot-admin role.
 *
 * **Fails closed.** A member with no roles, an unresolved Discord server or a
 * database that cannot be reached is not an admin. Failing open would hand
 * `/send` — arbitrary commands typed as the Minecraft account — to anybody who
 * ran it while Postgres was down, which is worse than an outage.
 *
 * @param {import('discord.js').GuildMember} member
 * @returns {Promise<boolean>}
 */
async function isAdmin(member) {
  const guildId = member?.guild?.id ?? bridge.discordServerId;
  if (!member?.roles || !guildId) return false;

  const roleIds = await getRoles(guildId);
  if (!roleIds || roleIds.length === 0) return false;

  return member.roles.cache.some((role) => roleIds.includes(role.id));
}

module.exports = { getRoles, isAdmin };
