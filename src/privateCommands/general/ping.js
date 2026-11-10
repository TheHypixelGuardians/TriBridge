module.exports = {
  name: "ping",
  description: "Checks that the bot is listening, and its ping to Hypixel.",
  usage: "!ping",
  cooldownMs: 5_000,

  run: async (ctx) => {
    // Read fresh: the bot may have been replaced since the message arrived.
    const ping = ctx.record.bot?.player?.ping;
    return ctx.reply(
      Number.isFinite(ping) ? `Pong! ${ping}ms to Hypixel.` : "Pong!",
    );
  },
};
