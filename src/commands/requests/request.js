const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');
const {getRequestChannelId} = require('../../utils/featureRequests');

module.exports = {
    name: 'request',
    description: 'Submit a feature request.',

    callback: async (client, interaction) => {
        // showModal() must be the first response to the interaction — it cannot
        // follow deferReply()/reply(). getRequestChannelId() is a cached
        // synchronous read, so this guard costs no await.
        if (!getRequestChannelId()) {
            return interaction.reply({
                content: '❌ No feature request channel is configured yet. Ask an administrator to run `/requestchannel set`.',
                ephemeral: true,
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('request_modal')
            .setTitle('Submit a feature request');

        // 100 chars leaves room for the "💡 Request #N — " prefix inside the
        // 256-char embed title; 1000 keeps the description far below the
        // 4096-char embed description limit, so nothing needs truncating later.
        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Feature name')
            .setPlaceholder('A short name for the feature')
            .setStyle(TextInputStyle.Short)
            .setMinLength(3)
            .setMaxLength(100)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setPlaceholder('What should it do, and why?')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(10)
            .setMaxLength(1000)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descriptionInput),
        );

        await interaction.showModal(modal);
    },
};
