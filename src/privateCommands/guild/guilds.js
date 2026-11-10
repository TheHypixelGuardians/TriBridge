const guilds = require("../../utils/guilds");
const mcBots = require("../../utils/mcBots");

// Plain words: Minecraft 1.8 cannot draw the emoji the Discord labels use.
const STATUS_WORDS = {
  online: "online",
  connecting: "connecting",
  "awaiting-signin": "waiting for sign-in",
  offline: "offline",
};

module.exports = {
  name: "guilds",
  aliases: ["bridge"],
  description:
    "Lists the guilds this bridge serves and whether each bot is on.",
  usage: "!guilds",
  cooldownMs: 5_000,

  run: async (ctx) => {
    const enabled = guilds.getEnabled();
    if (enabled.length === 0) return ctx.reply("No guilds are bridged yet.");

    return ctx.reply(
      enabled.map((guild) => {
        const status =
          STATUS_WORDS[mcBots.describeStatus(guild.key)] ?? "offline";
        return `[${guild.tag}] ${guild.name}: ${status}`;
      }),
    );
  },
};
