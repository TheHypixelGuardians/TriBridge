const {ApplicationCommandOptionType} = require('discord.js');
const {isAdmin} = require('../../utils/adminRoles');
const guilds = require('../../utils/guilds');
const queryGuild = require('../../utils/queryGuild');
const {
    GUILD_OPTION,
    guildOptionAutocomplete,
    resolveTarget,
    describeQueryFailure,
} = require('../../utils/commandGuild');

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
        {
            // Deliberately never broadcasts, unlike bridge chat: this runs an
            // arbitrary command as a Minecraft account, and fanning that out
            // across every guild at once is an incident waiting to happen.
            ...GUILD_OPTION,
            description: 'Which Hypixel guild\'s bot to send from. Defaults to the default guild; never all.',
        },
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

        const message = interaction.options.getString('message');

        const query = await queryGuild(target.record, message);
        if (!query.ok) return interaction.editReply(describeQueryFailure(query));

        const combined = query.lines.join('\n').trim();
        const safeMessage = message.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
        const from = guilds.shouldShowTags() ? ` from **${target.guild.name}**` : '';

        if (combined) {
            const truncated = combined.length > 1900
                ? combined.substring(0, 1900) + '…'
                : combined;
            await interaction.editReply(
                `✅ Sent \`${safeMessage}\` to the server${from}.\n` +
                `**Server response:**\n\`\`\`\n${truncated}\n\`\`\``
            );
        } else {
            await interaction.editReply(
                `✅ Sent \`${safeMessage}\` to the server${from}. No response was received.`,
            );
        }
    },
};
