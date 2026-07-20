// Shared state for cross-client access between Discord and Minecraft event handlers
const bridge = {
    mcBot: null,
    discordClient: null,
    discordChannelId: null,
    logChannelId: null,
    guildId: null,
    mcBotConnected: false,
    reconnecting: false,
};

module.exports = bridge;
