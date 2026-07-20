const {EmbedBuilder} = require('discord.js');
const {isAdmin} = require('../../utils/adminRoles');
const {getAllLinks} = require('../../utils/linkedAccounts');

module.exports = {
    name: 'links',
    description: 'List every linked Minecraft account.',

    callback: async (client, interaction) => {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true,
            });
        }

        const links = getAllLinks();

        if (links.length === 0) {
            return interaction.reply({
                content: '⚠️ No accounts are linked yet.',
                ephemeral: true,
            });
        }

        links.sort((a, b) => a.name.localeCompare(b.name));

        let description = links
            .map((link) => `> **${link.name}** — <@${link.discordId}>`)
            .join('\n');

        if (description.length > 4096) {
            description = description.substring(0, 4093) + '...';
        }

        const embed = new EmbedBuilder()
            .setTitle('🔗 Linked Accounts')
            .setDescription(description)
            .setColor(0x5865F2)
            .setFooter({text: `Total: ${links.length}`})
            .setTimestamp();

        return interaction.reply({embeds: [embed]});
    },
};
