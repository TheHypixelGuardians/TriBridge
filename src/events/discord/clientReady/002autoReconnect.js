const guilds = require("../../../utils/guilds");
const mcBots = require("../../../utils/mcBots");
const createMcBot = require("../../../utils/createMcBot");
const { logForGuild } = require("../../../utils/guildLog");
const { requestSignIn } = require("../../../utils/deviceCode");

const POLL_INTERVAL_MS = 10_000;

// Report the first failure, then stay quiet until the sixth, then stop. A
// permanently broken account otherwise posts a failure notice every ten seconds
// for as long as the bot runs.
const NOISY_ATTEMPTS = new Set([1, 6]);

/**
 * Starts a connect attempt for one Hypixel guild, reporting failure to that
 * guild's log channel.
 *
 * Never awaited by the poller: a Microsoft sign-in blocks for up to fifteen
 * minutes, and one guild's slow auth must not hold every other guild offline.
 *
 * @param {string} guildKey
 */
async function attemptConnect(guildKey) {
  try {
    await createMcBot(guildKey, {
      onMsaCode: (info, guild) => requestSignIn(info, guild),
    });
  } catch (error) {
    const record = mcBots.getRecord(guildKey);
    console.error(
      `[${guildKey}] connection attempt failed:`,
      error?.message ?? error,
    );

    if (NOISY_ATTEMPTS.has(record?.attempts)) {
      const suffix =
        record.attempts >= 6
          ? " Giving up on notifications until it succeeds — check the account."
          : "";
      await logForGuild(
        guildKey,
        `❌ Could not connect to Hypixel: ${error.message}.${suffix}`,
      );
    }
  }
}

/**
 * Keeps every registered Hypixel guild connected.
 *
 * Starts at most one new connection per tick, deliberately: a Hypixel restart
 * would otherwise bring every account back in the same millisecond and get them
 * all throttled together. Recovery is staggered by ten seconds per guild, which
 * nobody notices.
 *
 * `connecting` is cleared by the spawn/end/watchdog handlers in createMcBot, not
 * here — clearing it as soon as `createMcBot()` returned is what used to let the
 * next tick tear down a bot that was still mid-handshake.
 */
function poll() {
  for (const guild of guilds.getEnabled()) {
    const record = mcBots.ensureRecord(guild.key);

    if (record.connected || record.connecting || record.awaitingDeviceCode)
      continue;
    if (Date.now() < record.nextAttemptAt) continue;

    void attemptConnect(guild.key);
    return;
  }
}

// `clientReady` fires again if the Discord client fully reconnects, and a second
// interval would double the connection attempts.
let started = false;

module.exports = () => {
  if (started) return;
  started = true;

  // Once immediately, so boot is not delayed by a full poll interval. This is
  // the only place that opens the initial connections — index.js deliberately
  // does not, so there is exactly one code path for "connect a guild".
  poll();

  setInterval(poll, POLL_INTERVAL_MS);
};
