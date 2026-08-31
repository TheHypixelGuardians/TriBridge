const mcBots = require("../../../utils/mcBots");
const { parseOfficerChat } = require("../../../utils/guildChat");
const { createRelayDedupe } = require("../../../utils/relayDedupe");
const { relayOfficerAcrossGuilds } = require("../../../utils/crossBridge");

// Module-cached and its own instance — see relayOfficerToDiscord.js.
const isDuplicate = createRelayDedupe();

module.exports = async (client, jsonMsg) => {
  // `client` is the emitting mineflayer bot, not the Discord client.
  if (client.tribridgeRetired) return;

  const guild = mcBots.guildForBot(client);
  if (!guild) return;

  const cleanMsg = jsonMsg.toString().replace(/§./g, "");

  const parsed = parseOfficerChat(cleanMsg);
  if (!parsed) return;

  // The load-bearing loop guard, exactly as in relayToGuilds.js. A line
  // forwarded into this guild was spoken here by this guild's own bot account,
  // so without this the two guilds would echo one message at each other until
  // Hypixel muted both accounts. It also catches the copy this guild's own bot
  // just spoke on behalf of the Discord officer channel.
  if (mcBots.isOwnAccountName(parsed.username)) return;

  if (isDuplicate(guild.key, parsed.username, parsed.content)) return;

  // Chat commands are not filtered here the way they are for guild chat:
  // 000chatCommands.js parses guild chat only, so `!nw` typed in officer chat
  // is never answered and is just something an officer said.
  //
  // Deliberately the real Minecraft name, even mid global profile change — its
  // switches govern the two Discord legs of the main bridge and nothing else.
  relayOfficerAcrossGuilds(guild, parsed.username, parsed.content);
};
