const bridge = require("../../../bridge");

module.exports = async (client) => {
  try {
    const channel = await bridge.discordClient.channels.fetch(
      bridge.discordChannelId,
    );
    channel.send("Guild Bot is now online...");
  } catch (error) {
    console.error(error);
  }
};
