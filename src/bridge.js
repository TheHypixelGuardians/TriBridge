// Shared state for cross-client access between Discord and Minecraft event handlers
const bridge = {
  discordClient: null,
  discordChannelId: null,

  // Global fallback log channel. A Hypixel guild with its own `logChannelId`
  // overrides it — see utils/guildLog.js.
  logChannelId: null,

  // The single *Discord server* this bot serves. Not a Hypixel guild; see the
  // naming note in CLAUDE.md.
  discordServerId: null,

  // guildKey → BotRecord, one per registered Hypixel guild. Created lazily by
  // utils/mcBots.js `ensureRecord`. There is deliberately no `mcBot` scalar:
  // a "current bot" would silently act on the wrong guild the moment a call
  // site forgot to say which one it meant.
  mcBots: new Map(),
};

module.exports = bridge;
