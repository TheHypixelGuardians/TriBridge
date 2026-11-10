const bridge = require("../../bridge");

module.exports = {
  name: "me",
  aliases: ["link"],
  description:
    "Shows your guild and whether your account is linked to Discord.",
  usage: "!me",
  cooldownMs: 5_000,

  run: async (ctx) => {
    const guildNames = ctx.memberOf
      .map((g) => `[${g.tag}] ${g.name}`)
      .join(", ");
    const lines = [`${ctx.sender}, member of ${guildNames}.`];

    if (!ctx.link) {
      lines.push(
        "Not linked. Use /link in the Discord server to link your account.",
      );
      return ctx.reply(lines);
    }

    // Your own link only. Looking up other people's links stays a bot-admin
    // command on Discord (/whois), so there is no in-game version of it.
    let username = null;
    try {
      const user = await bridge.discordClient?.users.fetch(ctx.link.discordId);
      username = user?.username ?? null;
    } catch {
      // Unknown user or Discord unreachable: the link itself is still true.
    }

    lines.push(
      username
        ? `Linked to Discord user ${username}.`
        : "Linked to a Discord account.",
    );
    return ctx.reply(lines);
  },
};
