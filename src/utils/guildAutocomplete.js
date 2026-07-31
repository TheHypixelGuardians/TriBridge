const guilds = require('./guilds');
const mcBots = require('./mcBots');

const MAX_CHOICES = 25;

/**
 * Answers a `guild` option's autocomplete with the registered Hypixel guilds.
 *
 * The suggestions are only a hint: Discord lets a user submit arbitrary text
 * into an autocompleted option, so every command must still run the submitted
 * value through `guilds.resolveKey()` rather than trusting it as a key.
 *
 * @param {import('discord.js').AutocompleteInteraction} interaction
 * @param {{onlyConnected?: boolean}} [options]
 * @returns {Promise<void>}
 */
async function respondWithGuilds(interaction, {onlyConnected = false} = {}) {
    const focused = String(interaction.options.getFocused() ?? '').toLowerCase();

    const matches = guilds.getAll()
        .filter((guild) => {
            if (onlyConnected && !mcBots.isConnected(guild.key)) return false;
            if (!focused) return true;
            return guild.key.includes(focused)
                || String(guild.tag).toLowerCase().includes(focused)
                || String(guild.name).toLowerCase().includes(focused);
        })
        .slice(0, MAX_CHOICES)
        .map((guild) => {
            const status = mcBots.describeStatus(guild.key);
            const suffix = status === 'online' ? '' : ` (${status.replace('-', ' ')})`;
            return {
                name: `${guild.name} [${guild.tag}]${suffix}`.slice(0, 100),
                value: guild.key,
            };
        });

    await interaction.respond(matches);
}

module.exports = {respondWithGuilds};
