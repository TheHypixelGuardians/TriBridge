const {
    ApplicationCommandOptionType,
    ChannelType,
    PermissionFlagsBits,
} = require('discord.js');
const {isAdmin} = require('../../utils/adminRoles');
const {getAuditChannelId, setAuditChannelId} = require('../../utils/auditChannel');

// The bot has to be able to see the channel, post in it and embed links, or
// every audited action would be accepted and then silently go unrecorded.
// `botPermissions` cannot cover this: handleCommands.js checks it against the
// bot's guild-wide permissions and has no notion of a target channel.
const REQUIRED_PERMISSIONS = [
    {flag: PermissionFlagsBits.ViewChannel, name: 'View Channel'},
    {flag: PermissionFlagsBits.SendMessages, name: 'Send Messages'},
    {flag: PermissionFlagsBits.EmbedLinks, name: 'Embed Links'},
];

module.exports = {
    name: 'auditchannel',
    description: 'Configure the channel admin panel actions are recorded in.',
    // Note: areCommandsDifferent.js does not recurse into a subcommand's own
    // options, so changing the `channel` option below will not on its own
    // trigger a re-registration — edit the subcommand description too.
    options: [
        {
            name: 'set',
            description: 'Set the channel admin panel actions are recorded in.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'channel',
                    description: 'The channel to record admin actions in.',
                    type: ApplicationCommandOptionType.Channel,
                    channel_types: [ChannelType.GuildText],
                    required: true,
                },
            ],
        },
        {
            name: 'show',
            description: 'Show the channel admin panel actions are recorded in.',
            type: ApplicationCommandOptionType.Subcommand,
        },
        {
            name: 'clear',
            description: 'Stop recording admin panel actions anywhere.',
            type: ApplicationCommandOptionType.Subcommand,
        },
    ],

    callback: async (client, interaction) => {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'show') {
            const channelId = getAuditChannelId();
            if (!channelId) {
                return interaction.reply('⚠️ No audit channel is configured yet.');
            }
            return interaction.reply(`> Admin actions are recorded in <#${channelId}>.`);
        }

        if (subcommand === 'clear') {
            const previous = getAuditChannelId();
            if (!previous) {
                return interaction.reply('⚠️ No audit channel is configured.');
            }

            setAuditChannelId(null);
            return interaction.reply(
                '✅ Cleared the audit channel.\n' +
                '> Admin actions are no longer recorded anywhere. A global profile change will ' +
                'still run, but nothing will show who really sent each disguised message.',
            );
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

        setAuditChannelId(channel.id);
        return interaction.reply(`✅ Admin actions will now be recorded in <#${channel.id}>.`);
    },
};
