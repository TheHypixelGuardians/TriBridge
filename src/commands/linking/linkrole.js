const {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} = require("discord.js");
const { isAdmin } = require("../../utils/adminRoles");
const { getLinkRoleId, setLinkRoleId } = require("../../utils/linkRole");
const syncLinkRoles = require("../../utils/syncLinkRoles");

module.exports = {
  name: "linkrole",
  description:
    "Configure the role given to users who link a Minecraft account.",
  // Note: areCommandsDifferent.js does not recurse into a subcommand's own
  // options, so changing the `role` option below will not on its own trigger
  // a re-registration — edit the subcommand description too.
  options: [
    {
      name: "set",
      description:
        "Set the role given to users with a linked Minecraft account.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "role",
          description: "The role to give linked users.",
          type: ApplicationCommandOptionType.Role,
          required: true,
        },
      ],
    },
    {
      name: "show",
      description:
        "Show the role given to users with a linked Minecraft account.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "clear",
      description:
        "Stop giving out a role on link. Does not take the role off anyone.",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],

  callback: async (client, interaction) => {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "show") {
      const roleId = getLinkRoleId();
      if (!roleId) {
        return interaction.reply("⚠️ No link role is configured yet.");
      }
      return interaction.reply(`> Linked users are given <@&${roleId}>.`);
    }

    if (subcommand === "clear") {
      const previous = getLinkRoleId();
      if (!previous) {
        return interaction.reply("⚠️ No link role is configured.");
      }

      setLinkRoleId(null);
      return interaction.reply(
        `✅ Cleared the link role.\n` +
          `> <@&${previous}> is no longer given out or taken away, and members who ` +
          "already have it keep it.",
      );
    }

    const role = interaction.options.getRole("role");
    const me = interaction.guild.members.me;

    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply(
        "❌ I need the **Manage Roles** permission to hand out roles.",
      );
    }

    if (role.managed) {
      return interaction.reply(
        `❌ **${role.name}** is managed by an integration, so it cannot be assigned.`,
      );
    }

    if (role.comparePositionTo(me.roles.highest) >= 0) {
      return interaction.reply(
        `❌ **${role.name}** is ranked above my own highest role, so I cannot assign ` +
          "it.\n> Move my role above it in **Server Settings → Roles** and try again.",
      );
    }

    const previous = getLinkRoleId();
    setLinkRoleId(role.id);

    // The stored links are the source of truth, so adopting a role means
    // backfilling it onto everybody who is already linked.
    await interaction.deferReply();
    const summary = await syncLinkRoles();

    const notes = [];
    if (previous && previous !== role.id) {
      notes.push(
        `Members still have the old <@&${previous}> — remove it yourself if unwanted.`,
      );
    }
    if (summary.granted > 0) {
      notes.push(
        `Granted it to **${summary.granted}** already-linked member(s).`,
      );
    }
    if (summary.missing > 0) {
      notes.push(
        `**${summary.missing}** linked user(s) are no longer in the server.`,
      );
    }
    if (summary.failure) {
      notes.push(
        `⚠️ Could not update **${summary.failed}** member(s) — ${summary.failure}.`,
      );
    }

    return interaction.editReply(
      `✅ Linked users will now be given <@&${role.id}>.` +
        notes.map((note) => `\n> ${note}`).join(""),
    );
  },
};
