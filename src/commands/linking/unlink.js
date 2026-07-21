const {ApplicationCommandOptionType} = require('discord.js');
const {isAdmin} = require('../../utils/adminRoles');
const {removeLink} = require('../../utils/linkedAccounts');
const {applyLinkRole, applyLinkRoleById, describeFailure} = require('../../utils/linkRole');

module.exports = {
    name: 'unlink',
    description: 'Remove a Minecraft account link.',
    options: [
        {
            name: 'user',
            description: 'The user to unlink (admin only). Defaults to yourself.',
            type: ApplicationCommandOptionType.User,
            required: false,
        },
    ],

    callback: async (client, interaction) => {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const isSelf = target.id === interaction.user.id;

        if (!isSelf && !isAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ You do not have permission to unlink other users.',
                ephemeral: true,
            });
        }

        const removed = removeLink(target.id);

        if (!removed) {
            return interaction.reply({
                content: isSelf
                    ? '⚠️ You do not have a linked Minecraft account.'
                    : `⚠️ <@${target.id}> does not have a linked Minecraft account.`,
                ephemeral: true,
            });
        }

        // Taking the role back is a REST round trip, so defer rather than risk
        // the interaction expiring.
        await interaction.deferReply({ephemeral: isSelf});

        const member = isSelf ? interaction.member : interaction.options.getMember('user');
        const roleResult = member
            ? await applyLinkRole(member, 'remove')
            : await applyLinkRoleById(target.id, 'remove');

        const failure = roleResult.ok ? null : describeFailure(roleResult);
        const note = failure ? `\n> ⚠️ Could not take the link role back — ${failure}.` : '';

        return interaction.editReply(
            (isSelf
                ? `✅ Unlinked you from **${removed.name}**.\n` +
                '> Your messages will relay under your Discord name again.'
                : `✅ Unlinked <@${target.id}> from **${removed.name}**.`) + note,
        );
    },
};
