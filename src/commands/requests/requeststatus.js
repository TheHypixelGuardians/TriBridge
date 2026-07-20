const { ApplicationCommandOptionType } = require('discord.js');
const { isAdmin } = require('../../utils/adminRoles');
const { setStatus, buildRequestEmbed, STATUS_LABELS } = require('../../utils/featureRequests');

module.exports = {
    name: 'requeststatus',
    description: 'Set the status of a feature request.',
    // Flat options on purpose: areCommandsDifferent.js compares top-level
    // choices but never recurses into a subcommand's options, so choices
    // nested under a subcommand would never re-register when changed.
    options: [
        {
            name: 'id',
            description: 'The number of the request.',
            type: ApplicationCommandOptionType.Integer,
            min_value: 1,
            required: true,
        },
        {
            name: 'status',
            description: 'The status to set.',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: 'Accepted', value: 'accepted' },
                { name: 'Denied', value: 'denied' },
                { name: 'Planned', value: 'planned' },
                { name: 'Duplicate', value: 'duplicate' },
            ],
        },
    ],

    callback: async (client, interaction) => {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        const id = interaction.options.getInteger('id');
        const status = interaction.options.getString('status');

        // Persist before touching Discord, so the status is never lost when
        // the message edit fails.
        const record = setStatus(id, status, interaction.user.id);

        if (!record) {
            return interaction.reply({
                content: `❌ There is no request with ID **#${id}**.`,
                ephemeral: true,
            });
        }

        const label = STATUS_LABELS[status];

        if (!record.messageId) {
            return interaction.reply(
                `⚠️ Set request **#${id}** to ${label}, but it was never posted to a channel.`,
            );
        }

        try {
            // Fetched by the record's own channel, not the currently configured
            // one, so requests posted before a /requestchannel set still edit.
            const channel = await client.channels.fetch(record.channelId);
            const message = await channel.messages.fetch(record.messageId);
            await message.edit({ embeds: [buildRequestEmbed(record)] });

            return interaction.reply(`✅ Request **#${id}** is now ${label}.`);
        } catch (error) {
            console.error(error);
            return interaction.reply(
                `⚠️ Request **#${id}** is now ${label}, but I could not update the original message — it may have been deleted, or I may have lost access to <#${record.channelId}>.`,
            );
        }
    },
};
