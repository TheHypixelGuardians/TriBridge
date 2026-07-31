const bridge = require('../../../bridge');
const {
    resolveIdentity,
    repostAs,
    shouldSkip,
    canRepostIn,
    auditDisguise,
} = require('../../../utils/disguise');
const {buildGuildChatCommand} = require('../../../utils/sanitizeForChat');
const {routeMessage} = require('../../../utils/chatRouting');
const mcBots = require('../../../utils/mcBots');
const {sendChat} = require('../../../utils/chatQueue');

/**
 * Relays a message to every Hypixel guild it is addressed to.
 *
 * The command is built once, not per guild: same display name and same body
 * means identical truncation everywhere, so the 100-character budget stays
 * deterministic and one guild never sees a differently-cut message. Hypixel's
 * duplicate-message filter is per account, so sending identical text from
 * several different accounts is fine — do not "fix" it by varying the text.
 *
 * The guild tag is deliberately *not* injected here. It is a Discord-side label
 * for telling incoming guilds apart, and prepending it would eat into the
 * already-tight chat budget for no benefit to the people reading it in-game.
 *
 * @param {object[]} targets Registry records to relay to.
 * @param {string} displayName Name to attribute the message to in guild chat.
 * @param {string} content Message body, with any routing prefix removed.
 * @param {boolean} hasAttachments
 */
function relayToGuildChat(targets, displayName, content, hasAttachments) {
    // Attachment-only messages have empty content; don't send a dangling colon.
    const body = content || (hasAttachments ? '[attachment]' : '');
    const command = buildGuildChatCommand(displayName, body);
    if (!command) return;

    for (const guild of targets) {
        const record = mcBots.getRecord(guild.key);
        // Offline guilds are skipped without comment: their own log channel
        // already says they are down, and a warning per message in a busy
        // channel would be unusable.
        if (!record?.connected || !record.bot) continue;

        void sendChat(record, command);
    }
}

module.exports = async (client, message) => {
    // Ignore bot messages and wrong channel. Webhook reposts are authored by a
    // bot, so this guard is also what stops the repost loop.
    if (message.author.bot || message.channel.id !== bridge.discordChannelId) return;

    const {targets, body, unknownTag} = routeMessage(message.content);

    // A mistyped tag still gets delivered — this just makes the mistake visible.
    // Needs Add Reactions; failure is not worth reporting.
    if (unknownTag) void message.react('❓').catch(() => {});

    // A global profile change outranks an account link, which outranks the
    // plain author — see utils/disguise.js.
    const identity = resolveIdentity(message);

    // There is one Discord message however many guilds it reaches, so the
    // repost and its audit entry happen exactly once, outside the fan-out.
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

    relayToGuildChat(targets, displayName, body, message.attachments.size > 0);
};
