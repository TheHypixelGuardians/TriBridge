const mcBots = require("../../../utils/mcBots");
const guildRoster = require("../../../utils/guildRoster");
const { parseFriendRequest } = require("../../../utils/privateChat");
const chatQueue = require("../../../utils/chatQueue");
const { isValidMinecraftName } = require("../../../utils/minecraftName");
const { logForGuild } = require("../../../utils/guildLog");

// Refused names, so somebody sending request after request is logged once an
// hour rather than every time.
const REFUSAL_LOG_GAP_MS = 60 * 60_000;
const refusalLoggedAt = new Map();

/**
 * Accepts a friend request when the sender is a member of any bridged guild —
 * the first step of using private commands.
 *
 * Fails closed: an inconclusive roster leaves the request pending. A friend,
 * once accepted, stays until removed, whereas an unanswered request costs a
 * real member only a retry.
 */
module.exports = async (client, jsonMsg) => {
  // `client` is the emitting mineflayer bot, not the Discord client.
  if (client.tribridgeRetired) return;

  const guild = mcBots.guildForBot(client);
  if (!guild || guild.enabled === false || guild.privateCommands !== true) {
    return;
  }

  const request = parseFriendRequest(jsonMsg.toString());
  if (!request) return;

  const { username } = request;
  if (!isValidMinecraftName(username) || mcBots.isOwnAccountName(username)) {
    return;
  }

  try {
    const membership = await guildRoster.findMembership(username);

    if (membership.guilds.length > 0) {
      const record = mcBots.getRecord(guild.key);
      if (await chatQueue.sendChat(record, `/friend accept ${username}`)) {
        await logForGuild(
          guild.key,
          `🤝 Accepted a friend request from **${username}** for private commands.`,
        );
      }
      return;
    }

    const now = Date.now();
    const key = username.toLowerCase();
    if (now - (refusalLoggedAt.get(key) ?? -Infinity) < REFUSAL_LOG_GAP_MS) {
      return;
    }
    refusalLoggedAt.set(key, now);

    await logForGuild(
      guild.key,
      membership.inconclusive
        ? `⚠️ Left a friend request from **${username}** pending: guild membership could not be checked.`
        : `🚫 Ignored a friend request from **${username}**: not in any bridged guild.`,
    );
  } catch (error) {
    console.error(`[${guild.key}] friend request from ${username}:`, error);
  }
};
