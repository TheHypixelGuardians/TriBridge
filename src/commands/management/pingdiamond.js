const { PermissionFlagsBits } = require("discord.js");
const { logAudit } = require("../../utils/auditChannel");

/**
 * The one member `/pingdiamond` pings, from `PINGDIAMOND_USER_ID`. Read on
 * every run rather than at import, so a changed `.env` needs only a restart.
 *
 * @returns {string|null} Null when unset or not shaped like a Discord id.
 */
function targetId() {
  const id = process.env.PINGDIAMOND_USER_ID?.trim();
  return id && /^\d{17,20}$/.test(id) ? id : null;
}

module.exports = {
  name: "pingdiamond",
  description: "Ghost-ping Diamond.",
  permissionsRequired: [PermissionFlagsBits.ManageRoles],
  // Hides the command from members without Manage Roles. permissionsRequired
  // above is what actually enforces it: a server admin can override this in
  // Discord's integration settings.
  defaultMemberPermissions: PermissionFlagsBits.ManageRoles,

  callback: async (client, interaction) => {
    const id = targetId();
    if (!id) {
      return interaction.reply({
        content:
          "⚠️ `/pingdiamond` is not set up.\n" +
          "> Set `PINGDIAMOND_USER_ID` in the bot's `.env` and restart it.",
        ephemeral: true,
      });
    }

    await interaction.reply({ content: "👻 Done.", ephemeral: true });

    let ping;
    try {
      ping = await interaction.channel.send({
        content: `<@${id}>`,
        // Only ever the configured member: nothing else in this message may
        // ping, whatever the environment variable is set to.
        allowedMentions: { users: [id] },
      });
    } catch (error) {
      console.error("/pingdiamond could not send:", error);
      return interaction.editReply(
        "❌ Could not ping here.\n" +
          "> The bot needs **View Channel** and **Send Messages** in this channel.",
      );
    }

    // A bot can always delete its own message, so this only fails when the
    // message is already gone or Discord is having a moment.
    await ping.delete().catch((error) => {
      console.error("/pingdiamond could not delete its ping:", error);
      return interaction.editReply(
        "⚠️ Pinged, but the ping could not be deleted. Remove it by hand.",
      );
    });

    await logAudit(
      `👻 <@${interaction.user.id}> ran \`/pingdiamond\` in <#${interaction.channelId}>`,
    );
  },
};
