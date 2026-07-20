const path = require('path');
const mineflayer = require('mineflayer');
const {Authflow} = require('prismarine-auth');
const eventHandler = require('../handlers/eventHandler');
const bridge = require('../bridge');

async function createMcBot() {
    // Clean up existing bot if present
    if (bridge.mcBot) {
        bridge.mcBot.removeAllListeners();
        try {
            bridge.mcBot.quit();
        } catch (e) { /* already disconnected */
        }
    }

    const profilesFolder = path.join(__dirname, '..', '..', '.minecraft-auth');

    const flow = new Authflow(process.env.MINECRAFT_USERNAME, profilesFolder);
    await flow.getMinecraftJavaToken({fetchProfile: true});

    const mcBot = mineflayer.createBot({
        host: 'mc.hypixel.net',
        username: process.env.MINECRAFT_USERNAME,
        auth: 'microsoft',
        version: '1.8.9',
        profilesFolder,
    });

    bridge.mcBot = mcBot;
    bridge.mcBotConnected = false;

    mcBot.on('spawn', () => {
        bridge.mcBotConnected = true;
    });

    mcBot.on('end', () => {
        bridge.mcBotConnected = false;
    });

    eventHandler(mcBot, path.join(__dirname, '..', 'events', 'minecraft'));

    return mcBot;
}

module.exports = createMcBot;
