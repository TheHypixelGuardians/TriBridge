const bridge = require("../bridge");

/**
 * Resolves a Discord user id to a member of the Discord server this bot serves.
 *
 * Fetches by id rather than sweeping the roster: `guild.members.fetch()` with
 * no argument goes over the gateway and needs the privileged GuildMembers
 * intent, which this bot does not request. A single-id fetch is a plain REST
 * call and works without it.
 *
 * @param {string} userId
 * @returns {Promise<import('discord.js').GuildMember|null>} null when the user
 *   is not in the server (left, or never joined).
 */
async function resolveMember(userId) {
  if (!bridge.discordClient || !bridge.discordServerId) return null;

  try {
    const guild = await bridge.discordClient.guilds.fetch(
      bridge.discordServerId,
    );
    return await guild.members.fetch(userId);
  } catch {
    return null;
  }
}

module.exports = { resolveMember };
