const WEBHOOK_NAME = 'TriBridge Relay';

// Keyed by channel id. Cleared via clearRelayWebhook so a webhook deleted out
// from under us gets recreated instead of serving a dead entry forever.
const cache = new Map();

/**
 * Works out which channel a message's webhook actually lives on.
 *
 * Webhooks only exist on real channels, never on threads, so a message in a
 * thread has to go through the parent's webhook with `threadId` set. The cache
 * therefore keys off the parent, and every thread under it shares one webhook.
 *
 * @param {import('discord.js').GuildTextBasedChannel} channel
 * @returns {{channel: import('discord.js').GuildTextBasedChannel, threadId: string|undefined}|null}
 *   null when there is no webhook-capable home — a thread whose parent we
 *   cannot see, for instance.
 */
function resolveWebhookTarget(channel) {
    if (!channel?.isThread?.()) {
        return channel ? {channel, threadId: undefined} : null;
    }

    if (!channel.parent) return null;
    return {channel: channel.parent, threadId: channel.id};
}

/**
 * Fetches (or creates) the webhook used to repost messages under another
 * identity.
 *
 * @param {import('discord.js').TextChannel} channel Must be a real channel, not
 *   a thread — pass {@link resolveWebhookTarget}'s `channel`.
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

module.exports = {getRelayWebhook, clearRelayWebhook, resolveWebhookTarget, WEBHOOK_NAME};
