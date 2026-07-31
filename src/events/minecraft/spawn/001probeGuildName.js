const guilds = require('../../../utils/guilds');
const mcBots = require('../../../utils/mcBots');
const queryGuild = require('../../../utils/queryGuild');
const {logForGuild} = require('../../../utils/guildLog');

// Latched per pair so the warning is posted once, not on every reconnect.
const warned = new Set();

/**
 * Learns which Hypixel guild an account is actually in, and complains if two
 * accounts turn out to be in the same one.
 *
 * That misconfiguration doubles every relayed line. relayToDiscord.js suppresses
 * the duplicate copy so the channel stays readable, but suppression alone leaves
 * an admin with no idea why one guild's bot looks idle — this is the part that
 * tells them.
 *
 * Skipped entirely with a single guild: there is nothing to collide with, and it
 * would cost a `/guild list` on every spawn for nothing.
 */
module.exports = async (client) => {
    if (guilds.count() <= 1) return;

    const guild = mcBots.guildForBot(client);
    if (!guild) return;

    const record = mcBots.getRecord(guild.key);
    if (!record || record.hypixelGuildName) return;

    const query = await queryGuild(record, '/guild list', {format: 'motd', idleMs: 1000});
    if (!query.ok) return;

    const name = findGuildName(query.lines);
    if (!name) return;

    record.hypixelGuildName = name;

    const clash = mcBots.getAllRecords().find((other) =>
        other.key !== record.key
        && other.hypixelGuildName
        && other.hypixelGuildName.toLowerCase() === name.toLowerCase());

    if (!clash) return;

    const pairKey = [record.key, clash.key].sort().join('|');
    if (warned.has(pairKey)) return;
    warned.add(pairKey);

    await logForGuild(
        guild.key,
        `⚠️ \`${record.key}\` and \`${clash.key}\` are both in the Hypixel guild **${name}**.\n` +
        '> Each guild needs its own account, or their messages will collide. ' +
        'Duplicates are being dropped for now.',
    );
};

/**
 * Pulls the guild name out of `/guild list` output.
 *
 * Hypixel prints a `Guild Name: <name>` line, which both existing roster parsers
 * already recognise and skip — this is the one place that wants it.
 *
 * @param {string[]} lines Raw message strings with colour codes.
 * @returns {string|null}
 */
function findGuildName(lines) {
    for (const raw of lines) {
        const match = raw.replace(/§./g, '').trim().match(/^Guild Name:\s*(.+)$/);
        if (match) return match[1].trim();
    }
    return null;
}
