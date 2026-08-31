const { ApplicationCommandOptionType } = require("discord.js");
const { isAdmin } = require("../../utils/adminRoles");
const { isValidMinecraftName } = require("../../utils/minecraftName");
const queryGuild = require("../../utils/queryGuild");
const {
  GUILD_OPTION,
  guildOptionAutocomplete,
  resolveTarget,
  guildPhrase,
  describeQueryFailure,
} = require("../../utils/commandGuild");

module.exports = {
  name: "invite",
  description: "Invite a player to a Hypixel guild.",
  options: [
    {
      name: "username",
      description: "The Minecraft username to invite.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    GUILD_OPTION,
  ],

  autocomplete: guildOptionAutocomplete(),

  callback: async (client, interaction) => {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const target = resolveTarget(interaction);
    if (!target.ok) return interaction.editReply(target.message);

    const username = interaction.options.getString("username");

    // Validated because it goes straight into bot.chat() below without
    // passing through buildGuildChatCommand.
    if (!isValidMinecraftName(username)) {
      return interaction.editReply(
        "❌ That is not a valid Minecraft username.\n" +
          "> Names are at most 16 letters, digits or underscores.",
      );
    }

    const query = await queryGuild(target.record, `/guild invite ${username}`);
    if (!query.ok) return interaction.editReply(describeQueryFailure(query));

    const result = parseInviteResponse(
      query.lines.join("\n"),
      username,
      target.guild,
    );
    await interaction.editReply(result);
  },
};

/**
 * Parses the collected Hypixel chat messages after a /guild invite command
 * to determine the outcome and return a user-friendly message.
 *
 * @param {string} combined - All collected messages joined by newlines
 * @param {string} username - The Minecraft username that was invited
 * @param {object} guild - The Hypixel guild registry record
 * @returns {string} A Discord-friendly result message
 */
function parseInviteResponse(combined, username, guild) {
  const lower = combined.toLowerCase();
  const where = guildPhrase(guild);
  const Where = guildPhrase(guild, true);

  // Successful invite
  if (
    lower.includes("invited") ||
    lower.includes("sent a guild invite") ||
    lower.includes("has been invited")
  ) {
    return `✅ **${username}** has been invited to ${where}!`;
  }

  // Already in the guild
  if (
    lower.includes("already a member of this guild") ||
    lower.includes("is already in your guild")
  ) {
    return `⚠️ **${username}** is already a member of ${where}.`;
  }

  // Player not found
  if (
    lower.includes("can't find a player by the name") ||
    lower.includes("player not found")
  ) {
    return `❌ Could not find a player named **${username}**.`;
  }

  // Already invited / pending invite
  if (
    lower.includes("already been invited") ||
    lower.includes("pending invite")
  ) {
    return `⚠️ **${username}** already has a pending guild invite.`;
  }

  // Guild is full
  if (lower.includes("guild is full") || lower.includes("your guild is full")) {
    return `❌ ${Where} is full. Cannot invite **${username}**.`;
  }

  // No permission
  if (
    lower.includes("you don't have permission") ||
    lower.includes("you do not have permission") ||
    lower.includes("you must be")
  ) {
    return `❌ The bot does not have permission to invite players to ${where}.`;
  }

  // Fallback: return raw messages for debugging
  const trimmed = combined.trim();
  if (trimmed) {
    return `⚠️ Invite sent for **${username}**. Server response:\n> ${trimmed.split("\n").join("\n> ")}`;
  }

  return `⚠️ Invite command sent for **${username}**, but no response was received from the server.`;
}
