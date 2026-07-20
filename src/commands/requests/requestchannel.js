const {
    ApplicationCommandOptionType,
    PermissionFlagsBits,
    ChannelType,
} = require('discord.js');
const { getRequestChannelId, setRequestChannelId } = require('../../utils/featureRequests');

// The bot has to be able to see the channel, post in it and embed links, or
// every submission would be accepted and then silently fail to appear.
// `botPermissions` cannot cover this: handleCommands.js checks it against the
// bot's guild-wide permissions and has no notion of a target channel.
const REQUIRED_PERMISSIONS = [
    { flag: PermissionFlagsBits.ViewChannel, name: 'View Channel' },
    { flag: PermissionFlagsBits.SendMessages, name: 'Send Messages' },
    { flag: PermissionFlagsBits.EmbedLinks, name: 'Embed Links' },
];

module.exports = {
    name: 'requestchannel',
    description: 'Configure the channel feature requests are posted to.',
    permissionsRequired: [PermissionFlagsBits.Administrator],
    // Note: areCommandsDifferent.js does not recurse into a subcommand's own
    // options, so changing the `channel` option below will not on its own
    // trigger a re-registration — edit the subcommand description too.
    options: [
        {
            name: 'set',
            description: 'Set the channel feature requests are posted to.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel',
                    description: 'The channel to post feature requests in.',
                    type: ApplicationCommandOptionType.Channel,
                    channel_types: [ChannelType.GuildText],
                    required: true,
                },
            ],
        },
        {
            name: 'show',
            description: 'Show the channel feature requests are posted to.',
            type: ApplicationCommandOptionType.Subcommand,
        },
    ],

    callback: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'show') {
            const channelId = getRequestChannelId();
            if (!channelId) {
                return interaction.reply('⚠️ No feature request channel is configured yet.');
            }
            return interaction.reply(`> Feature requests are posted to <#${channelId}>.`);
        }

        const channel = interaction.options.getChannel('channel');
        const permissions = channel.permissionsFor(interaction.guild.members.me);

        const missing = REQUIRED_PERMISSIONS
            .filter((permission) => !permissions?.has(permission.flag))
            .map((permission) => permission.name);

        if (missing.length > 0) {
            return interaction.reply(
                `❌ I cannot post in <#${channel.id}> — missing **${missing.join('**, **')}**.`,
            );
        }

        setRequestChannelId(channel.id);
        return interaction.reply(`✅ Feature requests will now be posted to <#${channel.id}>.`);
    },
};
