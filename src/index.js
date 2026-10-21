require("dotenv").config();
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");
const eventHandler = require("./handlers/eventHandler");
const bridge = require("./bridge");
const guilds = require("./utils/guilds");
const globalProfile = require("./utils/globalProfile");
const auditChannel = require("./utils/auditChannel");
const linkedAccounts = require("./utils/linkedAccounts");
const configStore = require("./utils/configStore");
const db = require("./utils/db");

async function start() {
  const discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("Missing DISCORD_TOKEN");

  await loadSettings();

  // Before login, so 000resolveServer and 001registerCommands both see a
  // populated registry. Only fires on an install with no registry at all.
  const seeded = await guilds.ensureSeeded();
  if (seeded.seeded) {
    console.log(
      `Seeded Hypixel guild "${seeded.guild.key}" from MINECRAFT_USERNAME. ` +
        "Rename it with /guilds edit, and add more with /guilds add.",
    );
  } else if (process.env.MINECRAFT_USERNAME && guilds.isConfigured()) {
    const known = guilds
      .getAll()
      .some(
        (g) =>
          g.account === process.env.MINECRAFT_USERNAME.trim().toLowerCase(),
      );
    if (!known) {
      console.log(
        "MINECRAFT_USERNAME is set but is not one of the accounts in the guild registry. " +
          "The registry is authoritative; the environment variable is ignored.",
      );
    }
  }

  if (!guilds.isConfigured()) {
    console.warn(
      "No Hypixel guilds are configured. Discord will come up anyway — an admin can " +
        "add one with /guilds add.",
    );
  }

  bridge.discordClient = discordClient;
  bridge.discordChannelId = process.env.DISCORD_CHANNEL_ID;
  bridge.logChannelId = process.env.LOG_CHANNEL;

  eventHandler(discordClient, path.join(__dirname, "events", "discord"));

  // Discord comes up unconditionally, and must: /guilds is the only way to
  // repair a broken registry. Minecraft connections are opened by the
  // reconnect poller in events/discord/clientReady/002autoReconnect.js, which
  // is the single code path for connecting a guild.
  await discordClient.login(token);
}

const LOAD_ATTEMPTS = 5;
const LOAD_RETRY_MS = 10_000;

/**
 * Loads every setting from the database. Every config read after this is
 * synchronous, from memory.
 *
 * One at a time: creating the table races if run in parallel. Retried for a
 * while because the panel restarts the bot unattended, and a database that is
 * briefly away (or waking from scale-to-zero) should not stop the bridge.
 *
 * If the database stays unreachable through every retry, the bot starts from
 * the local snapshots instead: the last copy of each config the database
 * confirmed. Settings changes then fail until the database is back, because
 * every change is saved there first. Anything else (a corrupt legacy file with
 * no row, a missing snapshot) still stops startup: running on defaults would
 * let the next admin action save over the real settings.
 */
async function loadSettings() {
  // A missing DATABASE_URL is a configuration mistake, not an outage, so it
  // never falls back to the snapshots: the bot would come up unable to save
  // any setting, and nothing would ever fix it on its own.
  if (!db.isConfigured()) {
    throw new Error(
      "DATABASE_URL is not set; TriBridge's settings live there.",
    );
  }

  for (let attempt = 1; ; attempt++) {
    try {
      await guilds.load();
      await globalProfile.load();
      await auditChannel.load();
      await linkedAccounts.load();
      return;
    } catch (error) {
      if (attempt === LOAD_ATTEMPTS) {
        if (!(error instanceof configStore.DatabaseUnavailableError)) {
          throw error;
        }
        await loadSnapshots();
        return;
      }
      console.error(
        `Could not load settings (attempt ${attempt} of ${LOAD_ATTEMPTS}), ` +
          `retrying in ${LOAD_RETRY_MS / 1000}s: ${error.message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, LOAD_RETRY_MS));
    }
  }
}

async function loadSnapshots() {
  const options = { fromSnapshot: true };
  await guilds.load(options);
  await globalProfile.load(options);
  await auditChannel.load(options);
  await linkedAccounts.load(options);
  console.error(
    "The database is unreachable, so the bot started from its local settings " +
      "snapshots. The bridge runs normally; settings changes will fail until " +
      "the database is back.",
  );
}

start().catch((error) => {
  console.error("Startup error:", error);
  // Non-zero so a supervisor's restart-on-failure sees it. Exit outright: an
  // idle database pool would otherwise keep the process alive for a while.
  process.exit(1);
});
