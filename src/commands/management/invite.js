const { ApplicationCommandOptionType } = require('discord.js');
const bridge = require('../../bridge');
const { isAdmin } = require('../../utils/adminRoles');
const { isValidMinecraftName } = require('../../utils/minecraftName');

module.exports = {
    name: 'invite',
    description: 'Invite a player to the Hypixel guild.',
    options: [
        {
            name: 'username',
            description: 'The Minecraft username to invite.',
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

        // Collect messages from the MC bot after sending /guild invite
        const collectedMessages = [];
        let resolveCollector;
        let idleTimeout;

        const collectorPromise = new Promise((resolve) => {
            resolveCollector = resolve;
        });

        const messageListener = (jsonMsg) => {
            const text = jsonMsg.toString();
            collectedMessages.push(text);

            // Reset idle timer: resolve once no message arrives for 1.5 seconds
            if (idleTimeout) clearTimeout(idleTimeout);
            idleTimeout = setTimeout(() => resolveCollector(), 1500);
        };

        // Hard timeout of 5 seconds
        const maxTimeout = setTimeout(() => resolveCollector(), 5000);

        mcBot.on('message', messageListener);
        mcBot.chat(`/guild invite ${username}`);

        try {
            await collectorPromise;
        } finally {
            clearTimeout(maxTimeout);
            if (idleTimeout) clearTimeout(idleTimeout);
            mcBot.removeListener('message', messageListener);
        }

        // Analyze collected messages to determine the result
        const combined = collectedMessages.join('\n');
        const result = parseInviteResponse(combined, username);

        await interaction.editReply(result);
    },
};

/**
 * Parses the collected Hypixel chat messages after a /guild invite command
 * to determine the outcome and return a user-friendly message.
 *
 * @param {string} combined - All collected messages joined by newlines
 * @param {string} username - The Minecraft username that was invited
 * @returns {string} A Discord-friendly result message
 */
function parseInviteResponse(combined, username) {
    const lower = combined.toLowerCase();

    // Successful invite
    if (
        lower.includes('invited') ||
        lower.includes('sent a guild invite') ||
        lower.includes('has been invited')
    ) {
        return `✅ **${username}** has been invited to the guild!`;
    }

    // Already in the guild
    if (lower.includes('already a member of this guild') || lower.includes('is already in your guild')) {
        return `⚠️ **${username}** is already a member of the guild.`;
    }

    // Player not found
    if (lower.includes("can't find a player by the name") || lower.includes('player not found')) {
        return `❌ Could not find a player named **${username}**.`;
    }

    // Already invited / pending invite
    if (lower.includes('already been invited') || lower.includes('pending invite')) {
        return `⚠️ **${username}** already has a pending guild invite.`;
    }

    // Guild is full
    if (lower.includes('guild is full') || lower.includes('your guild is full')) {
        return `❌ The guild is full. Cannot invite **${username}**.`;
    }

    // No permission
    if (lower.includes("you don't have permission") || lower.includes('you do not have permission') || lower.includes('you must be')) {
        return `❌ The bot does not have permission to invite players to the guild.`;
    }

    // Fallback: return raw messages for debugging
    const trimmed = combined.trim();
    if (trimmed) {
        return `⚠️ Invite sent for **${username}**. Server response:\n> ${trimmed.split('\n').join('\n> ')}`;
    }

    return `⚠️ Invite command sent for **${username}**, but no response was received from the server.`;
}
