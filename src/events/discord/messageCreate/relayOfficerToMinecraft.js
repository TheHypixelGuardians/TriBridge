const bridge = require("../../../bridge");
const guilds = require("../../../utils/guilds");
const mcBots = require("../../../utils/mcBots");
const { sendChat } = require("../../../utils/chatQueue");
const { buildOfficerChatCommand } = require("../../../utils/sanitizeForChat");
const { routeMessage } = require("../../../utils/chatRouting");
const { getLink } = require("../../../utils/linkedAccounts");

/**
 * Speaks a message in the officer chat of every guild it is addressed to.
 *
 * The command is built once, not per guild, for the same reason the bridge
 * channel does it: same display name and same body means identical truncation
 * everywhere, so the 100-character budget stays deterministic and one guild
 * never sees a differently-cut message.
 *
 * @param {object[]} targets Registry records to relay to.
 * @param {string} displayName Name to attribute the message to in officer chat.
 * @param {string} content Message body, with any routing prefix removed.
 * @param {boolean} hasAttachments
 * @returns {number} How many guilds it actually reached.
 */
function relayToOfficerChat(targets, displayName, content, hasAttachments) {
  // Attachment-only messages have empty content; don't send a dangling colon.
  const body = content || (hasAttachments ? "[attachment]" : "");
  const command = buildOfficerChatCommand(displayName, body);
  if (!command) return 0;

  let delivered = 0;

  for (const guild of targets) {
    const record = mcBots.getRecord(guild.key);
    if (!record?.connected || !record.bot) continue;

    void sendChat(record, command);
    delivered += 1;
  }

  return delivered;
}

/**
 * The reply leg of the officer bridge: a message typed in an officer channel is
 * spoken in Hypixel officer chat.
 *
 * Guilds may share one officer channel, so the channel names the *candidates*
 * and a `!tag` picks between them, exactly as in the bridge channel. A tag
 * belonging to a guild that does not use this channel is an unknown tag here —
 * an officer channel must never be a way to speak into a guild it was not
 * wired to.
 *
 * There is still no fan-out beyond those targets, even when
 * `crossBridgeOfficer` is on: cross-bridging is a Minecraft → Minecraft path,
 * and the copy this bot is about to speak is dropped by the `isOwnAccountName`
 * guard in relayOfficerToGuilds.js before it can be forwarded anywhere.
 *
 * Access is governed entirely by the channel's own Discord permissions, exactly
 * as the main bridge channel is. There is deliberately no `isAdmin()` check
 * here: a second gate on top of an already-restricted channel would only add a
 * way for a message to be swallowed with nothing said about it.
 */
module.exports = async (client, message) => {
  // Webhook reposts are authored by a bot, so this is also what stops a repost
  // from being relayed a second time.
  if (message.author.bot) return;

  // DMs have no server, and the bot serves exactly one.
  if (!message.guildId || message.guildId !== bridge.discordServerId) return;

  // The off switch, and what keeps this handler inert in every other channel.
  // Disabled guilds are dropped here rather than in the registry lookup, so a
  // disabled guild's tag reads as unknown instead of silently reaching nobody.
  const candidates = guilds
    .getAllByOfficerChannel(message.channel.id)
    .filter((g) => g.enabled !== false);
  if (candidates.length === 0) return;

  const { targets, body, unknownTag } = routeMessage(message.content, {
    candidates,
  });

  // The account link, and nothing else. Deliberately not resolveIdentity():
  // that applies the global profile change, and a disguise that can rename
  // whoever is speaking in officer chat is precisely what a privileged channel
  // must not have. No webhook repost either, so this channel needs neither
  // Manage Webhooks nor Manage Messages.
  const displayName =
    getLink(message.author.id)?.name ?? message.author.username;

  const delivered = relayToOfficerChat(
    targets,
    displayName,
    body,
    message.attachments.size > 0,
  );

  const markers = [];

  // A mistyped tag still gets delivered everywhere — this just makes the
  // mistake visible.
  if (unknownTag) markers.push("❓");

  // Stricter than the bridge channel, which only says so for a targeted
  // message: officer chat is where a message quietly reaching nobody matters
  // most, so any total failure is reported.
  if (delivered === 0) markers.push("📡");

  for (const marker of markers) {
    // Needs Add Reactions; a missing permission is not worth reporting per
    // message, and there is nothing else to be done about it here.
    await message.react(marker).catch(() => {});
  }
};
