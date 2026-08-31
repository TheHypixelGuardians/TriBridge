const mcBots = require("../../../utils/mcBots");
const { parseGuildChat } = require("../../../utils/guildChat");
const { createRelayDedupe } = require("../../../utils/relayDedupe");
const { parseChatCommand } = require("../../../utils/chatCommands");
const { answerChatCommand } = require("../../../utils/networthReply");

// Numbered so it runs before the two relays. They suppress exactly what this
// dispatches — utils/chatCommands.js is the single definition both sides read —
// so a command is answered rather than echoed into Discord and into every
// cross-bridged guild.
//
// Its own dedupe instance, like each relay has: two accounts sitting in the same
// Hypixel guild would otherwise both answer the same question.
const isDuplicate = createRelayDedupe();

module.exports = async (client, jsonMsg) => {
  // `client` is the emitting mineflayer bot, not the Discord client.
  if (client.tribridgeRetired) return;

  const guild = mcBots.guildForBot(client);
  if (!guild) return;

  const cleanMsg = jsonMsg.toString().replace(/§./g, "");

  const parsed = parseGuildChat(cleanMsg);
  if (!parsed) return;

  // Before parsing the command, not after: a `!!nw x` sent from Discord is
  // spoken here by this guild's own bot, and answering it would let anyone in
  // the bridge channel drive the lookup through the escape hatch that exists
  // precisely to say "show these characters, do not run this".
  if (mcBots.isOwnAccountName(parsed.username)) return;

  const command = parseChatCommand(parsed.content);
  if (!command) return;

  if (isDuplicate(guild.key, parsed.username, parsed.content)) return;

  // Not awaited: a lookup can take fifteen seconds, and nothing else in the
  // message pipeline should wait on it. answerChatCommand owns its own errors.
  void answerChatCommand(command, {
    requesterKey: `mc:${parsed.username.toLowerCase()}`,
    asker: parsed.username,
    guild,
  });
};
