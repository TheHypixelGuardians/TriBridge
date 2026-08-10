const mcBots = require('../../../utils/mcBots');
const {parseGuildChat} = require('../../../utils/guildChat');
const {createRelayDedupe} = require('../../../utils/relayDedupe');
const {relayAcrossGuilds} = require('../../../utils/crossBridge');

// Module-cached, so it is shared across every bot — see utils/relayDedupe.js.
// Separate from the Discord relay's instance on purpose: neither should be able
// to swallow a line the other has not seen yet.
const isDuplicate = createRelayDedupe();

module.exports = async (client, jsonMsg) => {
    // `client` is the emitting mineflayer bot, not the Discord client.
    if (client.tribridgeRetired) return;

    const guild = mcBots.guildForBot(client);
    if (!guild) return;

    const cleanMsg = jsonMsg.toString().replace(/§./g, '');

    const parsed = parseGuildChat(cleanMsg);
    if (!parsed) return;

    // The load-bearing loop guard. A line forwarded into this guild was spoken
    // here by this guild's own bot account, so without this it would be picked
    // up and forwarded straight back out, and the two guilds would echo one
    // message at each other until Hypixel muted both accounts. Checking every
    // registered account rather than just the emitting one also covers two bots
    // that ended up in the same Hypixel guild.
    if (mcBots.isOwnAccountName(parsed.username)) return;

    if (isDuplicate(guild.key, parsed.username, parsed.content)) return;

    // Deliberately only player chat. Join/leave lines are noise in someone
    // else's guild and would spend the shared per-account rate budget that real
    // messages need.
    //
    // Also deliberately the real Minecraft name, even while a global profile
    // change is running: its two switches govern the two Discord legs of the
    // bridge, and quietly inventing a third rule for guild → guild would hide
    // who is talking from people who never saw the announcement.
    relayAcrossGuilds(guild, parsed.username, parsed.content);
};
