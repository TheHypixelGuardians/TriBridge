// Hypixel's spam filter mutes an account that talks too fast. mineflayer does
// no throttling of its own, and multi-guild multiplies the outbound rate by the
// number of guilds a broadcast reaches, so this is the difference between a
// busy bridge channel working and every account getting muted.
const MIN_INTERVAL_MS = 600;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a chat line on one bot, spacing packets out per account.
 *
 * Serialised on the record's own chat chain, so ordering is preserved and the
 * spacing holds across concurrent callers.
 *
 * @param {import('./mcBots').BotRecord} record
 * @param {string} text Already built and sanitised — this does not touch it.
 * @param {{maxAgeMs?: number}} [options] `maxAgeMs` drops the line instead of
 *   sending it if it is still queued that long after being handed over. For
 *   relayed chat, arriving a minute late is worse than not arriving: the
 *   conversation has moved on and the backlog only grows. Omit it for anything a
 *   person is waiting on the result of.
 * @returns {Promise<boolean>} Whether the line was handed to mineflayer.
 */
function sendChat(record, text, options = {}) {
    if (!record || !text) return Promise.resolve(false);

    const maxAgeMs = Number(options.maxAgeMs) > 0 ? Number(options.maxAgeMs) : 0;
    const queuedAt = Date.now();

    const task = async () => {
        const wait = record.chatQueue.last + MIN_INTERVAL_MS - Date.now();
        if (wait > 0) await sleep(wait);

        if (maxAgeMs && Date.now() - queuedAt > maxAgeMs) return false;

        // Re-read after the wait: the bot may have gone away while queued, and
        // caching it across an await is exactly how a retired bot gets used.
        const bot = record.bot;
        if (!bot || !record.connected || bot.tribridgeRetired) return false;

        try {
            bot.chat(text);
            record.chatQueue.last = Date.now();
            return true;
        } catch (error) {
            console.error(`[${record.key}] failed to send chat:`, error?.message ?? error);
            return false;
        }
    };

    const result = record.chatQueue.chain.then(task, task);
    record.chatQueue.chain = result.catch(() => {});
    return result;
}

module.exports = {sendChat, MIN_INTERVAL_MS};
