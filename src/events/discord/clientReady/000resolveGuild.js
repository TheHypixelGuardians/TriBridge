const bridge = require('../../../bridge');

/**
 * Resolves the single guild this bot instance serves into `bridge.guildId`.
 *
 * Derived from the bridge channel rather than required as its own setting, so
 * existing deployments keep working without a new `.env` entry. `DISCORD_GUILD_ID`
 * overrides it for setups where the bridge channel is not in the guild whose
 * members should be trusted.
 *
 * Runs first (000) because `isAllowedGuild` denies every command until this
 * lands — see utils/guildGuard.js for why that failure mode is deliberate.
 */
module.exports = async (client) => {
    const configured = process.env.DISCORD_GUILD_ID;
    if (configured) {
        bridge.guildId = configured;
        console.log(`Serving guild ${configured} (from DISCORD_GUILD_ID).`);
        return;
    }

    try {
        const channel = await client.channels.fetch(bridge.discordChannelId);
        bridge.guildId = channel?.guildId ?? null;

        if (bridge.guildId) {
            console.log(`Serving guild ${bridge.guildId} (from DISCORD_CHANNEL_ID).`);
        } else {
            console.error(
                'DISCORD_CHANNEL_ID does not resolve to a guild channel. All commands ' +
                'will be refused until this is fixed or DISCORD_GUILD_ID is set.',
            );
        }
    } catch (error) {
        console.error(
            'Could not resolve the bridge channel\'s guild. All commands will be ' +
            'refused until this is fixed or DISCORD_GUILD_ID is set.',
            error,
        );
    }
};
