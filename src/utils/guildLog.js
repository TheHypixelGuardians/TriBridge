const bridge = require("../bridge");
const guilds = require("./guilds");

/**
 * Posts to a log channel, swallowing every failure.
 *
 * Log lines always accompany work that has already happened, so a missing or
 * broken log channel must never take that work down with it.
 *
 * @param {string|null} channelId
 * @param {string|import('discord.js').MessageCreateOptions} payload
 * @returns {Promise<boolean>} Whether the line landed.
 */
async function send(channelId, payload) {
  if (!channelId || !bridge.discordClient) return false;

  const options = typeof payload === "string" ? { content: payload } : payload;

  try {
    const channel = await bridge.discordClient.channels.fetch(channelId);
    await channel.send(options);
    return true;
  } catch (error) {
    console.error("Failed to send log channel notification:", error);
    return false;
  }
}

/**
 * Posts to the global log channel (`LOG_CHANNEL`).
 *
 * For anything that is not about one particular Hypixel guild — account links,
 * link-role sync, disguise warnings.
 *
 * @param {string|import('discord.js').MessageCreateOptions} payload
 * @returns {Promise<boolean>}
 */
async function logGlobal(payload) {
  return send(bridge.logChannelId, payload);
}

/**
 * Posts to a Hypixel guild's own log channel, falling back to the global one.
 *
 * String payloads are prefixed with the guild name, but only once there is more
 * than one guild — a single-guild install reads exactly as it did before.
 *
 * @param {string} guildKey
 * @param {string|import('discord.js').MessageCreateOptions} payload
 * @returns {Promise<boolean>}
 */
async function logForGuild(guildKey, payload) {
  const guild = guilds.get(guildKey);
  const channelId = guild?.logChannelId ?? bridge.logChannelId;

  if (typeof payload === "string" && guild && guilds.shouldShowTags()) {
    return send(channelId, `**${guild.name}** — ${payload}`);
  }

  return send(channelId, payload);
}

module.exports = { logGlobal, logForGuild };
