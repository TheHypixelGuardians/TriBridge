const { EmbedBuilder } = require("discord.js");
const bridge = require("../../../bridge");
const guilds = require("../../../utils/guilds");
const mcBots = require("../../../utils/mcBots");
const { parseOfficerChat } = require("../../../utils/guildChat");
const { createRelayDedupe } = require("../../../utils/relayDedupe");

// Module-cached, so it is shared across every bot — see utils/relayDedupe.js.
// Its own instance, separate from the two guild-chat relays: an officer line
// and an ordinary line are different messages even when a player says the same
// words in both, and one relay must never swallow a line the others have not
// seen.
const isDuplicate = createRelayDedupe();

module.exports = async (client, jsonMsg) => {
  // `client` is the emitting mineflayer bot, not the Discord client.
  if (client.tribridgeRetired) return;

  const guild = mcBots.guildForBot(client);
  if (!guild) return;

  // The off switch. Officer chat is privileged, so the relay does nothing at
  // all until somebody has named a channel to put it in.
  if (!guild.officerChannelId) return;

  const cleanMsg = jsonMsg.toString().replace(/§./g, "");

  const parsed = parseOfficerChat(cleanMsg);
  if (!parsed) return;

  const { username, content } = parsed;

  // Every account, not just the emitting one — same reasoning as the guild-chat
  // relay. This is also what keeps a line forwarded in from another guild, or
  // sent from the Discord officer channel, from being echoed straight back.
  if (mcBots.isOwnAccountName(username)) return;

  if (isDuplicate(guild.key, username, content)) return;

  // Deliberately no disguise. The global profile change governs the two legs of
  // the main bridge; relabelling who said what inside a channel that exists to
  // record what officers said would defeat the point of having it.
  try {
    const channel = await bridge.discordClient.channels.fetch(
      guild.officerChannelId,
    );

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${username} [${guild.tag}]`,
        iconURL: `https://mc-heads.net/avatar/${encodeURIComponent(username)}`,
      })
      .setDescription(content)
      .setColor(guilds.colorOf(guild))
      // The tag is shown whatever `shouldShowTags()` says, unlike the bridge
      // channel. Officer chat can arrive here from another guild via the
      // cross-bridge, so "which guild is this?" is always a live question.
      .setFooter({ text: `🛡️ Officer chat · ${guild.name}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(error);
  }
};
