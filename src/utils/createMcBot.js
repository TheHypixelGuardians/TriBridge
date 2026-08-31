const path = require("path");
const mineflayer = require("mineflayer");
const { Authflow, Titles } = require("prismarine-auth");
const eventHandler = require("../handlers/eventHandler");
const guilds = require("./guilds");
const mcBots = require("./mcBots");
const { logForGuild } = require("./guildLog");

const PROFILES_FOLDER = path.join(__dirname, "..", "..", ".minecraft-auth");
const MINECRAFT_EVENTS = path.join(__dirname, "..", "events", "minecraft");

// prismarine-auth names its token cache after sha1(account), so one shared
// folder already multiplexes every account. Passing an options object *requires*
// `flow`; these three values reproduce exactly what prismarine-auth defaults to
// and what minecraft-protocol's own `validateOptions` sets, so the pre-flight
// token fetch and the bot's internal authflow share one cache — and caches
// written before multi-guild support stay valid.
const AUTH_OPTIONS = {
  flow: "live",
  authTitle: Titles.MinecraftNintendoSwitch,
  deviceType: "Nintendo",
};

// A connect that never spawns must not pin `connecting` forever, or the
// reconnect poller will skip this guild for the rest of the process's life.
const CONNECT_TIMEOUT_MS = 60_000;

/**
 * Tears down a bot so it can be replaced.
 *
 * Never call `removeAllListeners()` with no argument. That also strips
 * mineflayer's own internal plugin listeners *and* the `error` listener — and an
 * EventEmitter with no `error` listener turns a late socket error on a dead bot
 * into an uncaught exception that takes the whole process down. Removals first,
 * then re-attach a sink, so there is never a window with no `error` listener.
 *
 * @param {import('./mcBots').BotRecord} record
 */
function retireBot(record) {
  const bot = record.bot;
  record.bot = null;
  record.connected = false;
  if (!bot) return;

  bot.tribridgeRetired = true;

  if (record.dispose) {
    try {
      record.dispose();
    } catch (error) {
      console.error(`[${record.key}] failed to detach event handlers:`, error);
    }
    record.dispose = null;
  }

  for (const eventName of [
    "spawn",
    "end",
    "kicked",
    "message",
    "login",
    "error",
  ]) {
    bot.removeAllListeners(eventName);
  }

  bot.on("error", (error) => {
    console.error(
      `[${record.key}] error from a retired bot:`,
      error?.message ?? error,
    );
  });
  bot.on("end", () => {});

  try {
    bot.quit();
  } catch {
    /* already disconnected */
  }
}

/**
 * Schedules the next reconnect attempt with exponential backoff.
 *
 * Without this a permanently broken account retries every ten seconds forever
 * and floods its log channel — once per guild, so N times over.
 *
 * @param {import('./mcBots').BotRecord} record
 */
function scheduleRetry(record) {
  record.attempts += 1;
  const delay = Math.min(10_000 * 2 ** (record.attempts - 1), 300_000);
  record.nextAttemptAt = Date.now() + delay + Math.floor(Math.random() * 5_000);
}

/**
 * Connects (or reconnects) the Minecraft account for one Hypixel guild.
 *
 * Resolves once the bot object exists — *not* once it has spawned. Authentication
 * can block for up to fifteen minutes when a Microsoft sign-in is needed, so no
 * caller should await this expecting a connected bot; watch `record.connected`
 * instead.
 *
 * @param {string} guildKey
 * @param {{onMsaCode?: (info: object, guild: object) => void}} [options]
 * @returns {Promise<import('./mcBots').BotRecord>}
 */
async function createMcBot(guildKey, options = {}) {
  const guild = guilds.get(guildKey);
  if (!guild) throw new Error(`Unknown Hypixel guild "${guildKey}".`);
  if (guild.enabled === false)
    throw new Error(`Hypixel guild "${guildKey}" is disabled.`);

  const record = mcBots.ensureRecord(guildKey);
  if (record.connecting) return record;

  record.connecting = true;
  record.config = guild;
  record.lastError = null;
  record.hypixelGuildName = null;

  retireBot(record);

  // Invoked synchronously by prismarine-auth, and its return value is
  // discarded — so it must never throw and must swallow its own rejections.
  const codeCallback = (info) => {
    record.awaitingDeviceCode = true;
    try {
      const result = options.onMsaCode?.(info, guild);
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch (error) {
      console.error(`[${guildKey}] device-code handler failed:`, error);
    }
    console.log(
      `[${guildKey}] Microsoft sign-in required: open ${info.verification_uri} ` +
        `and enter ${info.user_code}`,
    );
  };

  let bot;
  try {
    const flow = new Authflow(
      guild.account,
      PROFILES_FOLDER,
      AUTH_OPTIONS,
      codeCallback,
    );
    const token = await flow.getMinecraftJavaToken({ fetchProfile: true });
    record.awaitingDeviceCode = false;

    if (token?.profile?.name) {
      guilds.update(guildKey, {
        mcName: token.profile.name,
        mcUuid: token.profile.id ?? null,
      });
    }

    bot = mineflayer.createBot({
      host: "mc.hypixel.net",
      username: guild.account,
      auth: "microsoft",
      version: "1.8.9",
      profilesFolder: PROFILES_FOLDER,
      onMsaCode: codeCallback,
    });
  } catch (error) {
    record.awaitingDeviceCode = false;
    record.connecting = false;
    record.lastError = error;
    scheduleRetry(record);
    throw error;
  }

  // Set before anything can emit: every Minecraft event handler reads this to
  // work out which Hypixel guild it is dealing with.
  bot.tribridgeGuildKey = guildKey;
  bot.tribridgeRetired = false;

  // Attached first so there is never a moment with no `error` listener.
  bot.on("error", (error) => {
    record.lastError = error;
    console.error(
      `[${guildKey}] Minecraft bot error:`,
      error?.message ?? error,
    );
  });

  bot.on("spawn", () => {
    const wasDown = !record.connected;
    record.connected = true;
    record.connecting = false;
    record.awaitingDeviceCode = false;
    record.attempts = 0;
    record.nextAttemptAt = 0;
    record.lastSpawnAt = Date.now();

    // Only on the first spawn of a session — Hypixel re-fires this on every
    // lobby change, and a notice per lobby would be unreadable.
    if (wasDown) {
      void logForGuild(
        guildKey,
        `✅ Connected to Hypixel as \`${bot.username}\`.`,
      );
    }
  });

  bot.on("end", (reason) => {
    if (bot.tribridgeRetired) return;
    const wasUp = record.connected;
    record.connected = false;
    record.connecting = false;
    record.lastEndAt = Date.now();
    scheduleRetry(record);

    if (wasUp) {
      void logForGuild(
        guildKey,
        `⚠️ Disconnected from Hypixel${reason ? ` (${reason})` : ""}. Reconnecting…`,
      );
    }
  });

  bot.on("kicked", (reason) => {
    // Hypixel's login throttle and bans surface here and nowhere else.
    console.error(`[${guildKey}] kicked from Hypixel:`, reason);
    void logForGuild(
      guildKey,
      "⚠️ Kicked from Hypixel. Check the console for the reason.",
    );
  });

  record.bot = bot;
  record.connected = false;
  record.dispose = eventHandler(bot, MINECRAFT_EVENTS);

  const watchdog = setTimeout(() => {
    if (record.bot !== bot || record.connected || record.awaitingDeviceCode)
      return;
    console.error(`[${guildKey}] connection timed out before spawning.`);
    retireBot(record);
    record.connecting = false;
    scheduleRetry(record);
  }, CONNECT_TIMEOUT_MS);
  watchdog.unref?.();

  bot.once("spawn", () => clearTimeout(watchdog));
  bot.once("end", () => clearTimeout(watchdog));

  return record;
}

module.exports = createMcBot;
module.exports.retireBot = retireBot;
module.exports.scheduleRetry = scheduleRetry;
module.exports.PROFILES_FOLDER = PROFILES_FOLDER;
