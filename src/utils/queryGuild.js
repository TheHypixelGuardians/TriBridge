const { chain } = require("./serialQueue");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULTS = {
  // Resolve once the server has been quiet for this long...
  idleMs: 1500,
  // ...but never wait longer than this in total.
  maxMs: 5000,
  // 'string' for plain text, 'motd' when the colour codes carry meaning (e.g.
  // §a marks online players in /guild online).
  format: "string",
  // Held after the listener comes off, still inside the lock, so trailing
  // lines from this command land while nobody is listening. Without it the
  // mutex alone does not stop one query contaminating the next.
  settleMs: 250,
  // Give up rather than leave a user on a spinner behind a queue of queries.
  waitMs: 10_000,
};

/**
 * Runs a chat command on one guild's bot and collects the server's reply.
 *
 * Hypixel offers no way to correlate a reply with the command that caused it —
 * all we can do is listen for a while and stop when the noise dies down. That
 * makes concurrency the real hazard: two collectors on one account would each
 * swallow half the other's output. Every query for a bot therefore goes through
 * that bot's own queue, one at a time, with a settle window between them.
 *
 * @param {import('./mcBots').BotRecord} record
 * @param {string} chatCommand The full chat line, e.g. `/guild invite Someone`.
 * @param {Partial<typeof DEFAULTS>} [options]
 * @returns {Promise<{ok: true, lines: string[]}
 *   | {ok: false, reason: 'offline'|'send-failed'|'busy', error?: Error}>}
 */
async function queryGuild(record, chatCommand, options = {}) {
  const { idleMs, maxMs, format, settleMs, waitMs } = {
    ...DEFAULTS,
    ...options,
  };

  if (!record) return { ok: false, reason: "offline" };

  let timedOut = false;
  const waitTimer = setTimeout(() => {
    timedOut = true;
  }, waitMs);
  waitTimer.unref?.();

  try {
    return await chain(record, async () => {
      if (timedOut) return { ok: false, reason: "busy" };

      // Read fresh inside the lock: the bot may have been replaced while
      // this call sat in the queue.
      const bot = record.bot;
      if (!bot || !record.connected || bot.tribridgeRetired) {
        return { ok: false, reason: "offline" };
      }

      const lines = [];
      let resolveCollector;
      let idleTimer;

      // Created before the listener so `resolveCollector` is always set by
      // the time anything can fire.
      const collected = new Promise((resolve) => {
        resolveCollector = resolve;
      });

      const listener = (jsonMsg) => {
        lines.push(format === "motd" ? jsonMsg.toMotd() : jsonMsg.toString());
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => resolveCollector(), idleMs);
      };

      const maxTimer = setTimeout(() => resolveCollector(), maxMs);

      try {
        bot.on("message", listener);

        try {
          bot.chat(chatCommand);
        } catch (error) {
          return { ok: false, reason: "send-failed", error };
        }

        await collected;
        return { ok: true, lines };
      } finally {
        clearTimeout(maxTimer);
        if (idleTimer) clearTimeout(idleTimer);
        bot.removeListener("message", listener);

        // Still inside the lock — see settleMs above.
        if (settleMs > 0) await sleep(settleMs);
      }
    });
  } finally {
    clearTimeout(waitTimer);
  }
}

module.exports = queryGuild;
module.exports.DEFAULTS = DEFAULTS;
