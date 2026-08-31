const guilds = require("../../utils/guilds");
const mcBots = require("../../utils/mcBots");

module.exports = {
  name: "ping",
  description: "Display the bot's network status.",

  callback: async (client, interaction) => {
    await interaction.deferReply();

    const discordPing = client.ws.ping;

    const reply = await interaction.fetchReply();
    const roundtrip = reply.createdTimestamp - interaction.createdTimestamp;

    // No `guild` option: this is a status readout, so it always covers
    // everything the bot is responsible for.
    const lines = guilds.getAll().map((guild) => {
      const record = mcBots.getRecord(guild.key);
      const status = mcBots.describeStatus(guild.key);

      // `player` only exists after spawn, so an online bot always has a ping.
      const detail =
        status === "online" && record?.bot?.player
          ? ` (${record.bot.player.ping}ms)`
          : "";

      const label = guilds.shouldShowTags()
        ? `**${guild.name} [${guild.tag}]:**`
        : "**Minecraft:**";

      return `> ${label} ${mcBots.describeStatusLabel(guild.key)}${detail}`;
    });

    if (lines.length === 0) {
      lines.push("> **Minecraft:** ⚠️ No Hypixel guilds configured");
    }

    await interaction.editReply(
      `🏓 **Pong!**\n` +
        `> **Discord API:** ${discordPing}ms\n` +
        `> **Roundtrip:** ${roundtrip}ms\n` +
        lines.join("\n"),
    );
  },
};
