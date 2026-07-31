const {EmbedBuilder} = require('discord.js');
const bridge = require('../bridge');
const {logForGuild} = require('./guildLog');

/**
 * Delivers Microsoft device-sign-in codes into Discord.
 *
 * The code is the whole credential for the duration of the flow: anyone holding
 * it can complete the sign-in with *their own* Microsoft account and bind the
 * wrong account to the guild. So it only ever goes somewhere private — the
 * ephemeral reply of the admin who asked, a DM to the admin who registered the
 * guild, or the console. The log channel gets a notice with no code in it.
 */

// guildKey → sink registered by a live `/guilds add|auth` interaction.
const sinks = new Map();

/**
 * Routes the next sign-in prompt for a guild to a live interaction.
 *
 * @param {string} guildKey
 * @param {(embed: EmbedBuilder) => Promise<unknown>} deliver
 * @returns {() => void} Unregisters the sink.
 */
function registerSink(guildKey, deliver) {
    sinks.set(guildKey, deliver);
    return () => {
        if (sinks.get(guildKey) === deliver) sinks.delete(guildKey);
    };
}

/**
 * @param {{user_code: string, verification_uri: string, expires_in?: number}} info
 * @param {object} guild
 * @returns {EmbedBuilder}
 */
function buildCodeEmbed(info, guild) {
    const embed = new EmbedBuilder()
        .setTitle('🔐 Microsoft sign-in required')
        .setColor(0xE67E22)
        .setDescription(
            `**${guild.name}** needs its Minecraft account signed in.\n\n` +
            `1. Open ${info.verification_uri}\n` +
            `2. Enter the code \`${info.user_code}\`\n` +
            `3. Sign in as \`${guild.account}\`\n\n` +
            '> This signs the bot into that Microsoft account. Do not share this code — ' +
            'anyone who has it can complete the sign-in with a different account.',
        );

    if (info.expires_in) {
        const expiresAt = Math.floor((Date.now() + info.expires_in * 1000) / 1000);
        embed.addFields({name: 'Expires', value: `<t:${expiresAt}:R>`});
    }

    return embed;
}

/**
 * Gets a device code in front of somebody who can act on it.
 *
 * Tries the live interaction that triggered the connect, then a DM to whoever
 * registered the guild, and always leaves it in the console for an operator with
 * shell access. Never throws — it runs off a synchronous prismarine-auth
 * callback whose rejections nobody is watching.
 *
 * @param {object} info The prismarine-auth device-code response.
 * @param {object} guild The registry record.
 * @returns {Promise<void>}
 */
async function requestSignIn(info, guild) {
    const embed = buildCodeEmbed(info, guild);
    let delivered = false;

    const sink = sinks.get(guild.key);
    if (sink) {
        try {
            await sink(embed);
            delivered = true;
        } catch (error) {
            console.error(`[${guild.key}] could not show the sign-in code in Discord:`, error);
        }
    }

    if (!delivered && guild.addedBy && bridge.discordClient) {
        try {
            const user = await bridge.discordClient.users.fetch(guild.addedBy);
            await user.send({embeds: [embed]});
            delivered = true;
        } catch (error) {
            console.error(`[${guild.key}] could not DM the sign-in code:`, error?.message ?? error);
        }
    }

    // Code-free on purpose: the log channel is not private.
    await logForGuild(
        guild.key,
        delivered
            ? '🔐 A Microsoft sign-in is in progress for this guild.'
            : `🔐 This guild needs a Microsoft sign-in — an admin can run \`/guilds auth ${guild.key}\` to get the code.`,
    );
}

module.exports = {registerSink, buildCodeEmbed, requestSignIn};
