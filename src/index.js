require('dotenv').config();
const path = require('path');
const {Client, GatewayIntentBits} = require('discord.js');
const eventHandler = require('./handlers/eventHandler');
const bridge = require('./bridge');
const guilds = require('./utils/guilds');

async function start() {
    const discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages]
    });

    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error('Missing DISCORD_TOKEN');

    // Before login, so 000resolveServer and 001registerCommands both see a
    // populated registry. Only fires on an install that predates guildsConfig.json.
    const seeded = guilds.ensureSeeded();
    if (seeded.seeded) {
        console.log(
            `Seeded Hypixel guild "${seeded.guild.key}" from MINECRAFT_USERNAME. ` +
            'Rename it with /guilds edit, and add more with /guilds add.',
        );
    } else if (process.env.MINECRAFT_USERNAME && guilds.isConfigured()) {
        const known = guilds.getAll().some(
            (g) => g.account === process.env.MINECRAFT_USERNAME.trim().toLowerCase(),
        );
        if (!known) {
            console.log(
                'MINECRAFT_USERNAME is set but is not one of the accounts in guildsConfig.json. ' +
                'The registry is authoritative; the environment variable is ignored.',
            );
        }
    }

    if (!guilds.isConfigured()) {
        console.warn(
            'No Hypixel guilds are configured. Discord will come up anyway — an admin can ' +
            'add one with /guilds add.',
        );
    }

    bridge.discordClient = discordClient;
    bridge.discordChannelId = process.env.DISCORD_CHANNEL_ID;
    bridge.logChannelId = process.env.LOG_CHANNEL;

    eventHandler(discordClient, path.join(__dirname, 'events', 'discord'));

    // Discord comes up unconditionally, and must: /guilds is the only way to
    // repair a broken registry. Minecraft connections are opened by the
    // reconnect poller in events/discord/clientReady/002autoReconnect.js, which
    // is the single code path for connecting a guild.
    await discordClient.login(token);
}

start().catch((error) => {
    console.error('Startup error:', error);
});
