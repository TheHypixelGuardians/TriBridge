const bridge = require("../../../bridge");
const { getLinkRoleId } = require("../../../utils/linkRole");
const syncLinkRoles = require("../../../utils/syncLinkRoles");
const { logGlobal } = require("../../../utils/guildLog");

/**
 * Brings the link role back in sync with the stored links on every startup.
 *
 * Catches up links made while the bot was down, members who rejoined the server
 * and lost their roles, and links that predate the feature entirely. Runs after
 * 000resolveServer because it needs `bridge.discordServerId` to find the members.
 */
module.exports = async () => {
  if (!getLinkRoleId()) return;

  if (!bridge.discordServerId) {
    console.error("Cannot sync link roles: the Discord server is unresolved.");
    return;
  }

  const summary = await syncLinkRoles();

  console.log(
    `Link role sync: ${summary.granted} granted, ${summary.alreadyHad} already had it, ` +
      `${summary.missing} no longer in the server, ${summary.failed} failed.`,
  );

  if (summary.granted > 0) {
    await logGlobal(
      `🔗 Gave the link role to **${summary.granted}** already-linked member(s) on startup.`,
    );
  }

  if (summary.failure) {
    await logGlobal(
      `⚠️ Link role sync could not update **${summary.failed}** member(s) — ${summary.failure}.`,
    );
  }
};
