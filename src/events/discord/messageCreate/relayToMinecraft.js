const bridge = require('../../../bridge');
const { getLink } = require('../../../utils/linkedAccounts');
const { getRelayWebhook, clearRelayWebhook } = require('../../../utils/relayWebhook');
const { buildGuildChatCommand } = require('../../../utils/sanitizeForChat');

// Latched so a missing permission reports once instead of on every message.
let warnedAboutRepost = false;

async function sendLogMessage(message) {
    if (!bridge.logChannelId || !bridge.discordClient) return;
    try {
        const channel = await bridge.discordClient.channels.fetch(bridge.logChannelId);
        await channel.send(message);
    } catch (error) {
        console.error('Failed to send log channel notification:', error);
    }
}

/**
 * Relays a message to Hypixel guild chat under the given display name.
 */
function relayToGuildChat(displayName, content, hasAttachments) {
    const mcBot = bridge.mcBot;
    if (!mcBot || !bridge.mcBotConnected) return;

    // Attachment-only messages have empty content; don't send a dangling colon.
    const body = content || (hasAttachments ? '[attachment]' : '');
    const command = buildGuildChatCommand(displayName, body);
    if (!command) return;

    mcBot.chat(command);
}

/**
 * Reposts a linked user's message through the relay webhook wearing their
 * Minecraft head and name, then deletes the original.
 *
 * @returns {Promise<boolean>} Whether the repost succeeded.
 */
async function repostAsMinecraftUser(message, link) {
    try {
        const webhook = await getRelayWebhook(message.channel);

        // Repost before deleting: if the webhook send throws, the user's
        // original message survives rather than vanishing.
        await webhook.send({
            content: message.content || undefined,
            username: link.name,
            avatarURL: `https://mc-heads.net/avatar/${encodeURIComponent(link.uuid)}`,
            files: [...message.attachments.values()].map((a) => a.url),
            // A webhook post is not subject to the author's own permissions, so
            // an unrestricted repost would let any linked user ping @everyone.
            allowedMentions: { parse: ['users'] },
        });
    } catch (error) {
        // The webhook may have been deleted out from under us; drop the cache
        // so the next message recreates it.
        clearRelayWebhook(message.channel.id);
        console.error('Failed to repost linked message:', error);

        if (!warnedAboutRepost) {
            warnedAboutRepost = true;
            await sendLogMessage(
                '⚠️ Could not repost a linked user\'s message. Check that I have the ' +
                '**Manage Webhooks** and **Manage Messages** permissions in the bridge ' +
                'channel. Falling back to normal relaying until this is fixed.',
            );
        }
        return false;
    }

    try {
        await message.delete();
    } catch {
        // Already deleted, or missing Manage Messages; the repost still landed.
    }

    return true;
}

module.exports = async (client, message) => {
    // Ignore bot messages and wrong channel. Webhook reposts are authored by a
    // bot, so this guard is also what stops the repost loop.
    if (message.author.bot || message.channel.id !== bridge.discordChannelId) return;

    const link = getLink(message.author.id);

    if (!link) {
        // Unlinked users keep the original behaviour.
        relayToGuildChat(message.author.username, message.content, message.attachments.size > 0);
        return;
    }

    const reposted = await repostAsMinecraftUser(message, link);
    const displayName = reposted ? link.name : message.author.username;

    relayToGuildChat(displayName, message.content, message.attachments.size > 0);
};
