const { ApplicationCommandOptionType } = require('discord.js');
const bridge = require('../../bridge');
const { isAdmin } = require('../../utils/adminRoles');
const { isValidMinecraftName } = require('../../utils/minecraftName');

module.exports = {
    name: 'promote',
    description: 'Promote a member in the Hypixel guild.',
    options: [
        {
            name: 'username',
            description: 'The Minecraft username to promote.',
            type: ApplicationCommandOptionType.String,
            required: true,
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

        // Validated because it goes straight into mcBot.chat() below without
        // passing through buildGuildChatCommand.
        if (!isValidMinecraftName(username)) {
            return interaction.editReply(
                '❌ That is not a valid Minecraft username.\n' +
                '> Names are at most 16 letters, digits or underscores.',
            );
        }

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
        mcBot.chat(`/guild promote ${username}`);

        try {
            await collectorPromise;
        } finally {
            clearTimeout(maxTimeout);
            if (idleTimeout) clearTimeout(idleTimeout);
            mcBot.removeListener('message', messageListener);
        }

        const combined = collectedMessages.join('\n');
        const result = parsePromoteResponse(combined, username);

        await interaction.editReply(result);
    },
};

/**
 * Parses the collected Hypixel chat messages after a /guild promote command
 * to determine the outcome and return a user-friendly message.
 *
 * @param {string} combined - All collected messages joined by newlines
 * @param {string} username - The Minecraft username that was promoted
 * @returns {string} A Discord-friendly result message
 */
function parsePromoteResponse(combined, username) {
    const lower = combined.toLowerCase();

    // Successful promotion
    if (lower.includes('was promoted')) {
        return `✅ **${username}** has been promoted!`;
    }

    // Already at highest rank
    if (lower.includes('already the highest rank') || lower.includes('is already the highest')) {
        return `⚠️ **${username}** is already at the highest guild rank.`;
    }

    // Player not in guild
    if (lower.includes('is not in your guild') || lower.includes('not a member of your guild')) {
        return `❌ **${username}** is not a member of the guild.`;
    }

    // Player not found
    if (lower.includes("can't find a player by the name") || lower.includes('player not found')) {
        return `❌ Could not find a player named **${username}**.`;
    }

    // No permission
    if (lower.includes("you don't have permission") || lower.includes('you do not have permission') || lower.includes('you must be')) {
        return `❌ The bot does not have permission to promote players in the guild.`;
    }

    // Fallback
    const trimmed = combined.trim();
    if (trimmed) {
        return `⚠️ Promote command sent for **${username}**. Server response:\n> ${trimmed.split('\n').join('\n> ')}`;
    }

    return `⚠️ Promote command sent for **${username}**, but no response was received from the server.`;
}
