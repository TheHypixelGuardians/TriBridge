const {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} = require("discord.js");
const { addRole, removeRole, getRoles } = require("../../utils/adminRoles");

module.exports = {
  name: "adminrole",
  description: "Configure which roles are bridge bot admins.",
  permissionsRequired: [PermissionFlagsBits.Administrator],
  options: [
    {
      name: "add",
      description: "Add a role to the admin role list.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "role",
          description: "The role to add.",
          type: ApplicationCommandOptionType.Role,
          required: true,
        },
      ],
    },
    {
      name: "remove",
      description: "Remove a role from the admin role list.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "role",
          description: "The role to remove.",
          type: ApplicationCommandOptionType.Role,
          required: true,
        },
      ],
    },
    {
      name: "list",
      description: "Show the admin role list.",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],

  callback: async (client, interaction) => {
    const subcommand = interaction.options.getSubcommand();
    const role = interaction.options.getRole("role");

    // Saving is a database write, which can outlast Discord's three seconds.
    await interaction.deferReply();

    if (subcommand === "list") {
      const roleIds = getRoles();
      return interaction.editReply({
        content:
          roleIds.length === 0
            ? "⚠️ No admin roles are set, so every admin command refuses.\n" +
              "> Add one with `/adminrole add`."
            : "**Bridge admin roles**\n" +
              roleIds.map((id) => `> <@&${id}>`).join("\n"),
        allowedMentions: { parse: [] },
      });
    }

    if (subcommand === "add") {
      const added = await addRole(role.id);
      if (added) {
        await interaction.editReply(
          `✅ Added **${role.name}** to the admin role list.`,
        );
      } else {
        await interaction.editReply(
          `⚠️ **${role.name}** is already in the admin role list.`,
        );
      }
    } else if (subcommand === "remove") {
      const removed = await removeRole(role.id);
      if (removed) {
        await interaction.editReply(
          `✅ Removed **${role.name}** from the admin role list.`,
        );
      } else {
        await interaction.editReply(
          `⚠️ **${role.name}** is not in the admin role list.`,
        );
      }
    }
  },
};
