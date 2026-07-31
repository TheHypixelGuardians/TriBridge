const getLocalCommands = require('../../../utils/getLocalCommands');
const {isAllowedServer} = require('../../../utils/serverGuard');

/**
 * Dispatches autocomplete interactions to a command's optional `autocomplete`
 * export.
 *
 * Discord requires a response within three seconds and accepts exactly one per
 * interaction, so every path here ends in a `respond()` — an empty list when
 * there is nothing to offer. The `.catch()` on each is for the case where the
 * user has already dismissed the box and the interaction is gone.
 */
module.exports = async (client, interaction) => {
    if (!interaction.isAutocomplete()) return;

    // Same guard as handleCommands.js: commands are registered globally, and the
    // suggestions name the Hypixel guilds this deployment manages.
    if (!isAllowedServer(interaction)) {
        return interaction.respond([]).catch(() => {});
    }

    const commandObject = getLocalCommands().find(
        (cmd) => cmd.name === interaction.commandName,
    );

    if (typeof commandObject?.autocomplete !== 'function') {
        return interaction.respond([]).catch(() => {});
    }

    try {
        await commandObject.autocomplete(client, interaction);
    } catch (error) {
        console.error('Autocomplete handler failed:', error);
        await interaction.respond([]).catch(() => {});
    }
};
