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
  name: "demote",
  description: "Demote a member in a Hypixel guild.",
  options: [
    {
      name: "username",
      description: "The Minecraft username to demote.",
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

    const query = await queryGuild(target.record, `/guild demote ${username}`);
    if (!query.ok) return interaction.editReply(describeQueryFailure(query));

    const result = parseDemoteResponse(
      query.lines.join("\n"),
      username,
      target.guild,
    );
    await interaction.editReply(result);
  },
};

/**
 * Parses the collected Hypixel chat messages after a /guild demote command
 * to determine the outcome and return a user-friendly message.
 *
 * @param {string} combined - All collected messages joined by newlines
 * @param {string} username - The Minecraft username that was demoted
 * @param {object} guild - The Hypixel guild registry record
 * @returns {string} A Discord-friendly result message
 */
function parseDemoteResponse(combined, username, guild) {
  const lower = combined.toLowerCase();
  const where = guildPhrase(guild);

  // Successful demotion
  if (lower.includes("was demoted")) {
    return `✅ **${username}** has been demoted.`;
  }

  // Already at lowest rank
  if (
    lower.includes("already the lowest rank") ||
    lower.includes("is already the lowest")
  ) {
    return `⚠️ **${username}** is already at the lowest guild rank.`;
  }

  // Player not in guild
  if (
    lower.includes("is not in your guild") ||
    lower.includes("not a member of your guild")
  ) {
    return `❌ **${username}** is not a member of ${where}.`;
  }

  // Player not found
  if (
    lower.includes("can't find a player by the name") ||
    lower.includes("player not found")
  ) {
    return `❌ Could not find a player named **${username}**.`;
  }

  // No permission
  if (
    lower.includes("you don't have permission") ||
    lower.includes("you do not have permission") ||
    lower.includes("you must be")
  ) {
    return `❌ The bot does not have permission to demote players in ${where}.`;
  }

  // Fallback
  const trimmed = combined.trim();
  if (trimmed) {
    return `⚠️ Demote command sent for **${username}**. Server response:\n> ${trimmed.split("\n").join("\n> ")}`;
  }

  return `⚠️ Demote command sent for **${username}**, but no response was received from the server.`;
}
