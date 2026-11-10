const guilds = require("../../utils/guilds");
const { version } = require("../../../package.json");

/**
 * @param {number} seconds
 * @returns {string} e.g. "3d 4h", "2h 5m", "12m".
 */
function formatUptime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

module.exports = {
  name: "about",
  aliases: ["version", "uptime"],
  description: "Shows the bridge version and how long it has been running.",
  usage: "!about",
  cooldownMs: 5_000,

  run: async (ctx) => {
    const count = guilds.getEnabled().length;
    return ctx.reply(
      `TriBridge ${version}, up ${formatUptime(process.uptime())}, ` +
        `bridging ${count} guild${count === 1 ? "" : "s"}.`,
    );
  },
  formatUptime,
};
