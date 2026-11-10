const mcBots = require("../../../utils/mcBots");
const { parseDirectMessage } = require("../../../utils/privateChat");
const { handleDirectMessage } = require("../../../utils/privateCommands");

/**
 * Private commands: a member `/msg`s a bridge bot `!online` and gets an answer
 * back by `/msg`. The checks and the commands themselves live in
 * utils/privateCommands.js; this only decides whether the line is a DM this bot
 * should answer.
 */
module.exports = async (client, jsonMsg) => {
  // `client` is the emitting mineflayer bot, not the Discord client.
  if (client.tribridgeRetired) return;

  const guild = mcBots.guildForBot(client);
  if (!guild || guild.enabled === false || guild.privateCommands !== true) {
    return;
  }

  const dm = parseDirectMessage(jsonMsg.toString());
  if (!dm) return;

  // The loop guard. Two bridge bots that are friends would otherwise answer
  // each other's replies — every reply is itself a DM — until Hypixel muted
  // them both.
  if (mcBots.isOwnAccountName(dm.username)) return;

  const record = mcBots.getRecord(guild.key);
  if (!record) return;

  await handleDirectMessage(record, guild, dm.username, dm.content);
};
