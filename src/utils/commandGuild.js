const {ApplicationCommandOptionType} = require('discord.js');
const guilds = require('./guilds');
const mcBots = require('./mcBots');
const {respondWithGuilds} = require('./guildAutocomplete');

/**
 * The `guild` option every Minecraft-touching command carries.
 *
 * Optional on purpose: with one guild registered nothing changes for anybody,
 * and with several the default guild stays one keystroke away.
 */
const GUILD_OPTION = {
    name: 'guild',
    description: 'Which Hypixel guild to act on. Defaults to the default guild.',
    type: ApplicationCommandOptionType.String,
    required: false,
    autocomplete: true,
};

/**
 * The `autocomplete` export for a command whose only autocompleted option is
 * `guild`.
 *
 * @param {{onlyConnected?: boolean}} [options]
 * @returns {(client: unknown, interaction: import('discord.js').AutocompleteInteraction) => Promise<void>}
 */
function guildOptionAutocomplete(options = {}) {
    return async (client, interaction) => {
        if (interaction.options.getFocused(true).name !== 'guild') {
            return interaction.respond([]);
        }
        return respondWithGuilds(interaction, options);
    };
}

/**
 * Resolves which Hypixel guild a command should act on.
 *
 * The single replacement for the `if (!mcBot || !bridge.mcBotConnected)` guard
 * that used to be copied into every command. Always re-resolves the submitted
 * option through the registry: autocomplete is a hint, and Discord lets a user
 * type anything into that field and submit it.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{optionName?: string, requireConnected?: boolean}} [options]
 * @returns {{ok: true, guild: object, record: import('./mcBots').BotRecord}
 *   | {ok: false, message: string}}
 */
function resolveTarget(interaction, {optionName = 'guild', requireConnected = true} = {}) {
    if (!guilds.isConfigured()) {
        return {
            ok: false,
            message: '⚠️ No Hypixel guilds are configured yet.\n' +
                '> An admin can add one with `/guilds add`.',
        };
    }

    const raw = interaction.options.getString?.(optionName) ?? null;
    let guild;

    if (raw) {
        const key = guilds.resolveKey(raw);
        if (!key) {
            return {
                ok: false,
                message: `❌ There is no Hypixel guild called \`${raw}\`.\n` +
                    '> Run `/guilds list` to see the registered ones.',
            };
        }
        guild = guilds.get(key);
    } else {
        guild = guilds.getDefault();
        if (!guild) {
            return {
                ok: false,
                message: '⚠️ Every registered Hypixel guild is disabled.\n' +
                    '> Enable one with `/guilds edit <guild> enabled:True`.',
            };
        }
    }

    if (guild.enabled === false) {
        return {
            ok: false,
            message: `⚠️ **${guild.name}** is disabled.\n` +
                `> Enable it with \`/guilds edit ${guild.key} enabled:True\`.`,
        };
    }

    const record = mcBots.ensureRecord(guild.key);

    if (requireConnected && !(record.connected && record.bot)) {
        const detail = record.awaitingDeviceCode
            ? ` It is waiting for a Microsoft sign-in — run \`/guilds auth ${guild.key}\`.`
            : '';
        return {
            ok: false,
            message: guilds.shouldShowTags()
                ? `❌ The Minecraft bot for **${guild.name}** is not connected.${detail}`
                : `❌ The Minecraft bot is not connected.${detail}`,
        };
    }

    return {ok: true, guild, record};
}

/**
 * A trailing " in **Guild Name**" for reply text, but only once there is more
 * than one guild — a single-guild install keeps its original wording.
 *
 * @param {object} guild
 * @returns {string}
 */
function inGuild(guild) {
    return guilds.shouldShowTags() ? ` in **${guild.name}**` : '';
}

/**
 * How to refer to a Hypixel guild inside a sentence.
 *
 * "the guild" while only one is registered, so replies read exactly as they did
 * before multi-guild support; the guild's own name once there is more than one
 * and "the guild" would be ambiguous.
 *
 * @param {object} guild
 * @param {boolean} [capital] For the start of a sentence.
 * @returns {string}
 */
function guildPhrase(guild, capital = false) {
    if (guilds.shouldShowTags()) return `**${guild.name}**`;
    return capital ? 'The guild' : 'the guild';
}

/**
 * Turns a failed `queryGuild` into a user-facing reply.
 *
 * @param {{reason: string}} result
 * @returns {string}
 */
function describeQueryFailure(result) {
    if (result.reason === 'send-failed') {
        return '❌ Failed to send the command to the server.';
    }
    if (result.reason === 'busy') {
        return '⚠️ The bot is busy answering another command. Try again in a moment.';
    }
    return '❌ The Minecraft bot is not connected.';
}

module.exports = {
    GUILD_OPTION,
    guildOptionAutocomplete,
    resolveTarget,
    inGuild,
    guildPhrase,
    describeQueryFailure,
};
