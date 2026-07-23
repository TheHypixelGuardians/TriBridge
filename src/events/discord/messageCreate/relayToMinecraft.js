const bridge = require('../../../bridge');
const {
    resolveIdentity,
    repostAs,
    shouldSkip,
    canRepostIn,
    auditDisguise,
} = require('../../../utils/disguise');
const {buildGuildChatCommand} = require('../../../utils/sanitizeForChat');

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

module.exports = async (client, message) => {
    // Ignore bot messages and wrong channel. Webhook reposts are authored by a
    // bot, so this guard is also what stops the repost loop.
    if (message.author.bot || message.channel.id !== bridge.discordChannelId) return;

    // A global profile change outranks an account link, which outranks the
    // plain author — see utils/disguise.js.
    const identity = resolveIdentity(message);

    let reposted = false;
    if (identity.repost && !shouldSkip(message) && canRepostIn(message.channel)) {
        const result = await repostAs(message, identity);
        reposted = result.ok;

        if (reposted && identity.disguised) {
            await auditDisguise(message, identity, result.url);
        }
    }

    // A failed or skipped repost leaves the original standing under the author's
    // own name, so guild chat has to be told the same story.
    const displayName = reposted ? identity.chatName : message.author.username;

    relayToGuildChat(displayName, message.content, message.attachments.size > 0);
};
