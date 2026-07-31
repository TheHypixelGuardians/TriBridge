const {PermissionFlagsBits} = require('discord.js');

// The bot has to be able to see a channel, post in it and embed links, or
// anything routed there would be accepted and then silently go nowhere.
// `botPermissions` cannot cover this: handleCommands.js checks it against the
// bot's server-wide permissions and has no notion of a target channel.
const REQUIRED_POST_PERMISSIONS = [
    {flag: PermissionFlagsBits.ViewChannel, name: 'View Channel'},
    {flag: PermissionFlagsBits.SendMessages, name: 'Send Messages'},
    {flag: PermissionFlagsBits.EmbedLinks, name: 'Embed Links'},
];

/**
 * Which of the posting permissions the bot lacks in a channel.
 *
 * @param {import('discord.js').GuildChannel} channel
 * @param {import('discord.js').GuildMember} me The bot's own member object.
 * @returns {string[]} Human-readable permission names, empty when all are held.
 */
function missingPostPermissions(channel, me) {
    const permissions = channel.permissionsFor(me);
    return REQUIRED_POST_PERMISSIONS
        .filter((permission) => !permissions?.has(permission.flag))
        .map((permission) => permission.name);
}

module.exports = {REQUIRED_POST_PERMISSIONS, missingPostPermissions};
