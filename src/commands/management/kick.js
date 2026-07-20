const {ApplicationCommandOptionType} = require('discord.js');
const bridge = require('../../bridge');
const {isAdmin} = require('../../utils/adminRoles');
const {isValidMinecraftName} = require('../../utils/minecraftName');
const {sanitizeForChat} = require('../../utils/sanitizeForChat');

module.exports = {
    name: 'kick',
    description: 'Kick a member from the Hypixel guild.',
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
    ],

    callback: async (client, interaction) => {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        const mcBot = bridge.mcBot;
        if (!mcBot || !bridge.mcBotConnected) {
            return interaction.editReply('❌ The Minecraft bot is not connected.');
        }

        const username = interaction.options.getString('username');

        // Both go straight into mcBot.chat() below without passing through
        // buildGuildChatCommand, so both are checked here: the name against its
        // own shape, the free-text reason flattened to a single line.
        if (!isValidMinecraftName(username)) {
            return interaction.editReply(
                '❌ That is not a valid Minecraft username.\n' +
                '> Names are at most 16 letters, digits or underscores.',
            );
        }

        const reason = sanitizeForChat(interaction.options.getString('reason'));

        const collectedMessages = [];
        let resolveCollector;
        let idleTimeout;

        const collectorPromise = new Promise((resolve) => {
            resolveCollector = resolve;
        });

        const messageListener = (jsonMsg) => {
            const text = jsonMsg.toString();
            collectedMessages.push(text);

            if (idleTimeout) clearTimeout(idleTimeout);
            idleTimeout = setTimeout(() => resolveCollector(), 1500);
        };

        const maxTimeout = setTimeout(() => resolveCollector(), 5000);

        mcBot.on('message', messageListener);

        if (reason) {
            mcBot.chat(`/guild kick ${username} ${reason}`);
        } else {
            mcBot.chat(`/guild kick ${username}`);
        }

        try {
            await collectorPromise;
        } finally {
            clearTimeout(maxTimeout);
            if (idleTimeout) clearTimeout(idleTimeout);
            mcBot.removeListener('message', messageListener);
        }

        const combined = collectedMessages.join('\n');
        const result = parseKickResponse(combined, username);

        await interaction.editReply(result);
    },
};

/**
 * Parses the collected Hypixel chat messages after a /guild kick command
 * to determine the outcome and return a user-friendly message.
 *
 * @param {string} combined - All collected messages joined by newlines
 * @param {string} username - The Minecraft username that was kicked
 * @returns {string} A Discord-friendly result message
 */
function parseKickResponse(combined, username) {
    const lower = combined.toLowerCase();

    // Successful kick
    if (lower.includes('was kicked') || lower.includes('has been kicked')) {
        return `✅ **${username}** has been kicked from the guild.`;
    }

    // Player not in guild
    if (lower.includes('is not in your guild') || lower.includes('not a member of your guild')) {
        return `❌ **${username}** is not a member of the guild.`;
    }

    // Player not found
    if (lower.includes("can't find a player by the name") || lower.includes('player not found')) {
        return `❌ Could not find a player named **${username}**.`;
    }

    // Cannot kick yourself
    if (lower.includes('cannot kick yourself') || lower.includes("can't kick yourself")) {
        return `❌ The bot cannot kick itself from the guild.`;
    }

    // No permission
    if (lower.includes("you don't have permission") || lower.includes('you do not have permission') || lower.includes('you must be')) {
        return `❌ The bot does not have permission to kick players from the guild.`;
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
