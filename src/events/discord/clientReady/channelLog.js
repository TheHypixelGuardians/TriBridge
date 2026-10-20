const bridge = require("../../../bridge");
const { isDegraded } = require("../../../utils/configStore");

module.exports = async (client) => {
  try {
    const channel = await bridge.discordClient.channels.fetch(
      bridge.discordChannelId,
    );
    // Awaited: a rejected send outside the try (Missing Permissions in the
    // bridge channel) used to be an unhandled rejection that exited the process
    // right after login.
    await channel.send("Guild Bot is now online...");
  } catch (error) {
    console.error(error);
  }

  if (!isDegraded() || !bridge.logChannelId) return;
  try {
    const logChannel = await bridge.discordClient.channels.fetch(
      bridge.logChannelId,
    );
    await logChannel.send(
      "⚠️ The database was unreachable at startup, so the bot is running on its " +
        "local settings snapshot.\n> The bridge works as normal. Settings " +
        "changes (`/guilds`, `/auditchannel`, the admin panel) will fail until " +
        "the database is back.",
    );
  } catch (error) {
    console.error(error);
  }
};
