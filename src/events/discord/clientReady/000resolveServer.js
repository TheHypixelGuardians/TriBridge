const bridge = require('../../../bridge');

/**
 * Resolves the single Discord server this bot instance serves into
 * `bridge.discordServerId`.
 *
 * Derived from the bridge channel rather than required as its own setting, so
 * existing deployments keep working without a new `.env` entry. `DISCORD_GUILD_ID`
 * overrides it for setups where the bridge channel is not in the server whose
 * members should be trusted. (The env var keeps its old name for compatibility —
 * it is Discord's own word for a server.)
 *
 * Runs first (000) because `isAllowedServer` denies every command until this
 * lands — see utils/serverGuard.js for why that failure mode is deliberate.
 */
module.exports = async (client) => {
    const configured = process.env.DISCORD_GUILD_ID;
    if (configured) {
        bridge.discordServerId = configured;
        console.log(`Serving Discord server ${configured} (from DISCORD_GUILD_ID).`);
        return;
    }

    try {
        const channel = await client.channels.fetch(bridge.discordChannelId);
        bridge.discordServerId = channel?.guildId ?? null;

        if (bridge.discordServerId) {
            console.log(`Serving Discord server ${bridge.discordServerId} (from DISCORD_CHANNEL_ID).`);
        } else {
            console.error(
                'DISCORD_CHANNEL_ID does not resolve to a server channel. All commands ' +
                'will be refused until this is fixed or DISCORD_GUILD_ID is set.',
            );
        }
    } catch (error) {
        console.error(
            'Could not resolve the bridge channel\'s Discord server. All commands will be ' +
            'refused until this is fixed or DISCORD_GUILD_ID is set.',
            error,
        );
    }
};
