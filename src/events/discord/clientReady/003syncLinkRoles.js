const bridge = require('../../../bridge');
const {getLinkRoleId} = require('../../../utils/linkRole');
const syncLinkRoles = require('../../../utils/syncLinkRoles');

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
 * Brings the link role back in sync with the stored links on every startup.
 *
 * Catches up links made while the bot was down, members who rejoined the server
 * and lost their roles, and links that predate the feature entirely. Runs after
 * 000resolveGuild because it needs `bridge.guildId` to find the members.
 */
module.exports = async () => {
    if (!getLinkRoleId()) return;

    if (!bridge.guildId) {
        console.error('Cannot sync link roles: the guild is unresolved.');
        return;
    }

    const summary = await syncLinkRoles();

    console.log(
        `Link role sync: ${summary.granted} granted, ${summary.alreadyHad} already had it, ` +
        `${summary.missing} no longer in the server, ${summary.failed} failed.`,
    );

    if (summary.granted > 0) {
        await sendLogMessage(
            `🔗 Gave the link role to **${summary.granted}** already-linked member(s) on startup.`,
        );
    }

    if (summary.failure) {
        await sendLogMessage(
            `⚠️ Link role sync could not update **${summary.failed}** member(s) — ${summary.failure}.`,
        );
    }
};
