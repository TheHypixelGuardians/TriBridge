const {ApplicationCommandOptionType} = require('discord.js');
const {isAdmin} = require('../../utils/adminRoles');
const {isValidMinecraftName} = require('../../utils/minecraftName');
const {sanitizeForChat} = require('../../utils/sanitizeForChat');
const queryGuild = require('../../utils/queryGuild');
const {
    GUILD_OPTION,
    guildOptionAutocomplete,
    resolveTarget,
    guildPhrase,
    describeQueryFailure,
} = require('../../utils/commandGuild');

module.exports = {
    name: 'kick',
    description: 'Kick a member from a Hypixel guild.',
    options: [
        {
            name: 'username',
            description: 'The Minecraft username to kick.',
            type: ApplicationCommandOptionType.String,
            required: true,
        },
        {
            name: 'reason',
            description: 'The reason for kicking the member.',
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        GUILD_OPTION,
    ],

    autocomplete: guildOptionAutocomplete(),

    callback: async (client, interaction) => {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        const target = resolveTarget(interaction);
        if (!target.ok) return interaction.editReply(target.message);

        const username = interaction.options.getString('username');

        // Both go straight into bot.chat() below without passing through
        // buildGuildChatCommand, so both are checked here: the name against its
        // own shape, the free-text reason flattened to a single line.
        if (!isValidMinecraftName(username)) {
            return interaction.editReply(
                '❌ That is not a valid Minecraft username.\n' +
                '> Names are at most 16 letters, digits or underscores.',
            );
        }

        const reason = sanitizeForChat(interaction.options.getString('reason'));
        const command = reason ? `/guild kick ${username} ${reason}` : `/guild kick ${username}`;

        const query = await queryGuild(target.record, command);
        if (!query.ok) return interaction.editReply(describeQueryFailure(query));

        const result = parseKickResponse(query.lines.join('\n'), username, target.guild);
        await interaction.editReply(result);
    },
};

/**
 * Parses the collected Hypixel chat messages after a /guild kick command
 * to determine the outcome and return a user-friendly message.
 *
 * @param {string} combined - All collected messages joined by newlines
 * @param {string} username - The Minecraft username that was kicked
 * @param {object} guild - The Hypixel guild registry record
 * @returns {string} A Discord-friendly result message
 */
function parseKickResponse(combined, username, guild) {
    const lower = combined.toLowerCase();
    const where = guildPhrase(guild);

    // Successful kick
    if (lower.includes('was kicked') || lower.includes('has been kicked')) {
        return `✅ **${username}** has been kicked from ${where}.`;
    }

    // Player not in guild
    if (lower.includes('is not in your guild') || lower.includes('not a member of your guild')) {
        return `❌ **${username}** is not a member of ${where}.`;
    }

    // Player not found
    if (lower.includes("can't find a player by the name") || lower.includes('player not found')) {
        return `❌ Could not find a player named **${username}**.`;
    }

    // Cannot kick yourself
    if (lower.includes('cannot kick yourself') || lower.includes("can't kick yourself")) {
        return `❌ The bot cannot kick itself from ${where}.`;
    }

    // No permission
    if (lower.includes("you don't have permission") || lower.includes('you do not have permission') || lower.includes('you must be')) {
        return `❌ The bot does not have permission to kick players from ${where}.`;
    }

    // Cannot kick higher rank
    if (lower.includes('same or higher rank') || lower.includes('higher guild rank')) {
        return `❌ Cannot kick **${username}** — they have the same or a higher guild rank than the bot.`;
    }

    // Fallback
    const trimmed = combined.trim();
    if (trimmed) {
        return `⚠️ Kick command sent for **${username}**. Server response:\n> ${trimmed.split('\n').join('\n> ')}`;
    }

    return `⚠️ Kick command sent for **${username}**, but no response was received from the server.`;
}
