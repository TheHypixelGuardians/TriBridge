const getLocalCommands = require('../../../utils/getLocalCommands');
const {isAllowedGuild} = require('../../../utils/guildGuard');

module.exports = async (client, interaction) => {
    if (!interaction.isCommand()) return;

    const localCommands = getLocalCommands();

    try {
        const commandObject = localCommands.find(
            (cmd) => cmd.name === interaction.commandName
        );

        if (!commandObject) return;

        // Checked before anything else: commands are registered globally, so
        // this is what keeps a foreign server's administrators from reaching
        // the bot's admin config and the Minecraft account behind it.
        if (!isAllowedGuild(interaction)) {
            await interaction.reply({
                content: '❌ This bot only serves its configured guild.',
                ephemeral: true,
            });
            return;
        }

        if (commandObject.permissionsRequired?.length) {
            for (const permission of commandObject.permissionsRequired) {
                if (!interaction.member.permissions.has(permission)) {
                    interaction.reply({
                        content: "You don't have permission to use this command!",
                        ephemeral: true,
                    });
                    return;
                }
            }
        }

        if (commandObject.botPermissions?.length) {
            for (const permission of commandObject.botPermissions) {
                const bot = interaction.guild.members.me;
                if (!bot.permissions.has(permission)) {
                    interaction.reply({
                        content: "I do not have permission to use this command!",
                        ephemeral: true,
                    });
                    return;
                }
            }
        }

        await commandObject.callback(client, interaction);
    } catch (error) {
        console.error(error);
    }
};
