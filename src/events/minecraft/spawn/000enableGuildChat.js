const mcBots = require("../../../utils/mcBots");

module.exports = (client) => {
  const guild = mcBots.guildForBot(client);
  console.log(
    `✓ Minecraft bot spawned on Hypixel${guild ? ` for ${guild.name}` : ""}!`,
  );
  client.chat("/gchat on");
};
