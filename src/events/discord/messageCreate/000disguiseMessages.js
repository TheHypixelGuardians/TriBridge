const bridge = require('../../../bridge');
const {appliesTo} = require('../../../utils/globalProfile');
const {
    resolveIdentity,
    repostAs,
    shouldSkip,
    canRepostIn,
    auditDisguise,
} = require('../../../utils/disguise');

module.exports = async (client, message) => {
    // Webhook reposts are authored by a bot, so this guard is also what stops
    // the repost loop.
    if (message.author.bot) return;

    // DMs have no guild, and the bot serves exactly one server.
    if (!message.guildId || message.guildId !== bridge.guildId) return;

    // The bridge channel belongs to relayToMinecraft.js, which does its own
    // repost. Two handlers deleting the same message would race, and the numeric
    // prefix only guarantees ordering — it does not make them cooperate.
    if (message.channel.id === bridge.discordChannelId) return;

    if (!appliesTo(message.author.id, message.channel.id)) return;
    if (shouldSkip(message)) return;
    if (!canRepostIn(message.channel)) return;

    const identity = resolveIdentity(message);
    const result = await repostAs(message, identity);
    if (!result.ok) return;

    await auditDisguise(message, identity, result.url);
};
