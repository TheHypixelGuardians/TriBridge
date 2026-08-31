const { ApplicationCommandOptionType } = require("discord.js");
const { getLink } = require("../../utils/linkedAccounts");
const { lookup } = require("../../utils/networth");
const { buildNetworthEmbed } = require("../../utils/networthReply");

module.exports = {
  name: "networth",
  description: "Show a player's SkyBlock networth on their richest profile.",
  options: [
    {
      name: "username",
      description:
        "The Minecraft username to look up. Defaults to your linked account.",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],

  callback: async (client, interaction) => {
    const requested = interaction.options.getString("username");

    // No Minecraft bot is involved, so no resolveTarget and no guild option:
    // networth is a property of a player, not of a guild.
    const link = requested ? null : getLink(interaction.user.id);
    const username = requested ?? link?.name ?? null;

    if (!username) {
      return interaction.reply({
        content:
          "⚠️ Give a username, or link your account first.\n" +
          "> `/networth username:Notch` — or `/link <your username>` to make it default to you.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const result = await lookup({
      username,
      requesterKey: `d:${interaction.user.id}`,
    });

    // Unlike the chat trigger, a cooldown is reported here: a slash-command
    // reply cannot be used to spam a channel, so silence would just look
    // broken.
    return interaction.editReply({ embeds: [buildNetworthEmbed(result)] });
  },
};
