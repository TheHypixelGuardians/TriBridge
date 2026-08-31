const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const { isAdmin } = require("../../utils/adminRoles");
const { getLink, getLinkByName } = require("../../utils/linkedAccounts");

module.exports = {
  name: "whois",
  description: "Look up an account link by Discord user or Minecraft username.",
  options: [
    {
      name: "user",
      description: "The Discord user to look up.",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
    {
      name: "username",
      description: "The Minecraft username to look up.",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],

  callback: async (client, interaction) => {
    // Same data `/links` exposes in bulk, so it takes the same gate.
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("user");
    const username = interaction.options.getString("username");

    if ((user && username) || (!user && !username)) {
      return interaction.reply({
        content: "❌ Provide exactly one of `user` or `username`.",
        ephemeral: true,
      });
    }

    const link = user ? getLink(user.id) : getLinkByName(username);

    if (!link) {
      return interaction.reply({
        content: user
          ? `⚠️ <@${user.id}> has no linked Minecraft account.`
          : `⚠️ **${username}** is not linked to any Discord user.`,
        ephemeral: true,
      });
    }

    const discordId = user ? user.id : link.discordId;

    const embed = new EmbedBuilder()
      .setAuthor({
        name: link.name,
        iconURL: `https://mc-heads.net/avatar/${encodeURIComponent(link.uuid)}`,
      })
      .setDescription(
        `> **Discord:** <@${discordId}>\n` +
          `> **Minecraft:** ${link.name}\n` +
          `> **UUID:** \`${link.uuid}\``,
      )
      .setColor(0x5865f2)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
