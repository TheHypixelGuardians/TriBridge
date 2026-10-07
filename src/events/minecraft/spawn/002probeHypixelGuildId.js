const guilds = require("../../../utils/guilds");
const mcBots = require("../../../utils/mcBots");
const { getGuildByPlayer, getApiKey } = require("../../../utils/hypixel");

/**
 * Learns the Hypixel guild `_id` for this bot's account via the public API and
 * persists it on the registry entry.
 *
 * Stored so membership checks can use the Hypixel guild id without a live
 * `/guild list`. The chat name probe still runs separately for collision
 * warnings when several guilds are configured; this one runs even with a
 * single guild, because the id is useful either way.
 *
 * Skipped when there is no API key or the bot UUID is not known yet — both are
 * temporary; the next spawn retries.
 */
module.exports = async (client) => {
  if (!getApiKey()) return;

  const guild = mcBots.guildForBot(client);
  if (!guild) return;

  const fresh = guilds.get(guild.key);
  if (!fresh) return;

  // Already learned — do not burn a request on every reconnect.
  if (fresh.hypixelGuildId) {
    const record = mcBots.getRecord(guild.key);
    if (record && !record.hypixelGuildName && fresh.name) {
      record.hypixelGuildName = fresh.name;
    }
    return;
  }

  const uuid = fresh.mcUuid;
  if (!uuid) return;

  const result = await getGuildByPlayer(uuid);
  if (!result.ok || !result.guild?._id) return;

  const hypixelGuildId = String(result.guild._id);
  const hypixelName =
    typeof result.guild.name === "string" ? result.guild.name.trim() : null;

  guilds.update(guild.key, { hypixelGuildId });

  const record = mcBots.getRecord(guild.key);
  if (record && hypixelName) {
    record.hypixelGuildName = hypixelName;
  }
};
