const { EmbedBuilder } = require("discord.js");
const bridge = require("../../../bridge");

module.exports = async (client, jsonMsg) => {
  try {
    const msg = jsonMsg.toString();
    // Clean up Minecraft formatting codes (§c, §6, etc.)
    const cleanMsg = msg.replace(/§./g, "");

    //console.log(cleanMsg);
  } catch (error) {
    //n
  }
};
