const guilds = require("../../utils/guilds");
const mcBots = require("../../utils/mcBots");
const { fetchOnline } = require("../../utils/guildOnline");

module.exports = {
  name: "members",
  aliases: ["count"],
  description: "How many members each guild has, and how many are online.",
  usage: "!members",
  cooldownMs: 10_000,

  run: async (ctx) => {
    const enabled = guilds.getEnabled();
    if (enabled.length === 0) return ctx.reply("No guilds are bridged yet.");

    // One query per guild, in parallel: each bot has its own queue.
    const lines = await Promise.all(
      enabled.map(async (guild) => {
        const record = mcBots.getRecord(guild.key);
        if (!mcBots.isConnected(guild.key)) return `[${guild.tag}] offline`;
        const online = await fetchOnline(record);
        if (!online.ok) return `[${guild.tag}] no answer right now`;
        const total = online.totalMembers ?? "?";
        return `[${guild.tag}] ${online.totalOnline}/${total} online`;
      }),
    );

    return ctx.reply(lines);
  },
};
