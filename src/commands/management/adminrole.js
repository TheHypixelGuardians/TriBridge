const {ApplicationCommandOptionType, PermissionFlagsBits} = require('discord.js');
const {addRole, removeRole, getRoles} = require('../../utils/adminRoles');

module.exports = {
    name: 'adminrole',
    description: 'Configure the global admin roles for the bot.',
    permissionsRequired: [PermissionFlagsBits.Administrator],
    options: [
        {
            name: 'add',
            description: 'Add a role to the admin role list.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'role',
                    description: 'The role to add.',
                    type: ApplicationCommandOptionType.Role,
                    required: true,
                },
            ],
        },
        {
            name: 'remove',
            description: 'Remove a role from the admin role list.',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'role',
                    description: 'The role to remove.',
                    type: ApplicationCommandOptionType.Role,
                    required: true,
                },
            ],
        },
    ],

    callback: async (client, interaction) => {
        const subcommand = interaction.options.getSubcommand();
        const role = interaction.options.getRole('role');

        if (subcommand === 'add') {
            const added = addRole(role.id);
            if (added) {
                await interaction.reply(`✅ Added **${role.name}** to the admin role list.`);
            } else {
                await interaction.reply(`⚠️ **${role.name}** is already in the admin role list.`);
            }
        } else if (subcommand === 'remove') {
            const removed = removeRole(role.id);
            if (removed) {
                await interaction.reply(`✅ Removed **${role.name}** from the admin role list.`);
            } else {
                await interaction.reply(`⚠️ **${role.name}** is not in the admin role list.`);
            }
        }
    },
};
