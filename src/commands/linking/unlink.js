const { ApplicationCommandOptionType } = require("discord.js");
const { isAdmin } = require("../../utils/adminRoles");
const { removeLink } = require("../../utils/linkedAccounts");

module.exports = {
  name: "unlink",
  description: "Remove a bridge Minecraft account link.",
  options: [
    {
      name: "user",
      description: "The user to unlink (admin only). Defaults to yourself.",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
  ],

  callback: async (client, interaction) => {
    const target = interaction.options.getUser("user") ?? interaction.user;
    const isSelf = target.id === interaction.user.id;

    // Saving the change is a database write, which can outlast Discord's
    // three-second window.
    await interaction.deferReply({ ephemeral: isSelf });

    if (!isSelf && !(await isAdmin(interaction.member))) {
      return interaction.editReply(
        "❌ You do not have permission to unlink other users.",
      );
    }

    const removed = await removeLink(target.id);

    if (!removed) {
      return interaction.editReply(
        isSelf
          ? "⚠️ You do not have a linked Minecraft account on the bridge."
          : `⚠️ <@${target.id}> does not have a linked Minecraft account on the bridge.`,
      );
    }

    return interaction.editReply(
      isSelf
        ? `✅ Unlinked you from **${removed.name}**.\n` +
            "> Your messages will relay under your Discord name again."
        : `✅ Unlinked <@${target.id}> from **${removed.name}**.`,
    );
  },
};
