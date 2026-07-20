const WEBHOOK_NAME = 'TriBridge Relay';

// Keyed by channel id. Cleared via clearRelayWebhook so a webhook deleted out
// from under us gets recreated instead of serving a dead entry forever.
const cache = new Map();

/**
 * Fetches (or creates) the webhook used to repost linked users' messages.
 *
 * @param {import('discord.js').TextChannel} channel
 * @returns {Promise<import('discord.js').Webhook>}
 * @throws {Error} If the bot lacks Manage Webhooks.
 */
async function getRelayWebhook(channel) {
    const cached = cache.get(channel.id);
    if (cached) return cached;

    const webhooks = await channel.fetchWebhooks();
    const botId = channel.client.user.id;

    // Only webhooks we own carry a token, and without a token we can't send.
    let webhook = webhooks.find(
        (wh) => wh.name === WEBHOOK_NAME && wh.owner?.id === botId && wh.token,
    );

    if (!webhook) {
        webhook = await channel.createWebhook({
            name: WEBHOOK_NAME,
            reason: 'Used to repost linked users\' messages under their Minecraft identity.',
        });
    }

    cache.set(channel.id, webhook);
    return webhook;
}

/**
 * Drops the cached webhook for a channel so the next call refetches it.
 *
 * @param {string} channelId
 */
function clearRelayWebhook(channelId) {
    cache.delete(channelId);
}

module.exports = { getRelayWebhook, clearRelayWebhook, WEBHOOK_NAME };
