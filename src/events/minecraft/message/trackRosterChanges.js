const guilds = require("../../../utils/guilds");
const mcBots = require("../../../utils/mcBots");
const guildRoster = require("../../../utils/guildRoster");
const { parseRosterChange } = require("../../../utils/privateChat");
const chatQueue = require("../../../utils/chatQueue");
const { isValidMinecraftName } = require("../../../utils/minecraftName");

/**
 * Keeps the cached rosters honest and the bots' friend lists short.
 *
 * Any join, leave or kick forgets that guild's roster, so the next membership
 * check asks Hypixel again. A leave or kick also removes the player from the
 * friend list of every bot that answers private commands: any of them may have
 * accepted the request, and Hypixel caps how many friends an account can have.
 *
 * No roster check before removing — a player is in at most one Hypixel guild,
 * so the one they just left was the bridged guild that made them a member.
 * Somebody moving between two bridged guilds is unfriended on the way and
 * simply sends a new request.
 */
module.exports = async (client, jsonMsg) => {
  // `client` is the emitting mineflayer bot, not the Discord client.
  if (client.tribridgeRetired) return;

  const guild = mcBots.guildForBot(client);
  if (!guild) return;

  const change = parseRosterChange(jsonMsg.toString());
  if (!change) return;

  guildRoster.invalidate(guild.key);

  if (change.action === "joined") return;
  const { username } = change;
  if (!isValidMinecraftName(username) || mcBots.isOwnAccountName(username)) {
    return;
  }

  try {
    await Promise.all(
      guilds
        .getPrivateCommandGuilds()
        .map((target) =>
          chatQueue.sendChat(
            mcBots.getRecord(target.key),
            `/friend remove ${username}`,
          ),
        ),
    );
  } catch (error) {
    console.error(`[${guild.key}] unfriending ${username}:`, error);
  }
};
