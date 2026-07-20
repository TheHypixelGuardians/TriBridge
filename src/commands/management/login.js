const bridge = require('../../bridge');
const createMcBot = require('../../utils/createMcBot');
const { isAdmin } = require('../../utils/adminRoles');

module.exports = {
    name: 'login',
    description: 'Connect the bot to Hypixel.',

    callback: async (client, interaction) => {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        if (bridge.mcBotConnected) {
            await interaction.editReply('✅ The bot is already connected to Hypixel.');
            return;
        }

        if (bridge.reconnecting) {
            await interaction.editReply('🔄 A reconnection attempt is already in progress.');
            return;
        }

        bridge.reconnecting = true;
        try {
            await interaction.editReply('🔄 Connecting to Hypixel...');
            await createMcBot();
            await interaction.editReply('✅ Successfully initiated connection to Hypixel.');
        } catch (error) {
            console.error('Login command error:', error);
            await interaction.editReply('❌ Failed to connect to Hypixel. Check the console for details.');
        } finally {
            bridge.reconnecting = false;
        }
    },
};
