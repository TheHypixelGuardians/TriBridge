const {ApplicationCommandOptionType} = require('discord.js');
const bridge = require('../../bridge');
const {isAdmin} = require('../../utils/adminRoles');

module.exports = {
    name: 'send',
    description: 'Send a command or message to the Minecraft server.',
    options: [
        {
            name: 'message',
            description: 'The command or message to send (e.g. /lobby, /guild list).',
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

        const message = interaction.options.getString('message');

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

        try {
            mcBot.chat(message);
        } catch (error) {
            clearTimeout(maxTimeout);
            if (idleTimeout) clearTimeout(idleTimeout);
            mcBot.removeListener('message', messageListener);
            return interaction.editReply('❌ Failed to send the message to the server.');
        }

        try {
            await collectorPromise;
        } finally {
            clearTimeout(maxTimeout);
            if (idleTimeout) clearTimeout(idleTimeout);
            mcBot.removeListener('message', messageListener);
        }

        const combined = collectedMessages.join('\n').trim();
        const safeMessage = message.replace(/\\/g, '\\\\').replace(/`/g, '\\`');

        if (combined) {
            const truncated = combined.length > 1900
                ? combined.substring(0, 1900) + '…'
                : combined;
            await interaction.editReply(
                `✅ Sent \`${safeMessage}\` to the server.\n` +
                `**Server response:**\n\`\`\`\n${truncated}\n\`\`\``
            );
        } else {
            await interaction.editReply(`✅ Sent \`${safeMessage}\` to the server. No response was received.`);
        }
    },
};
