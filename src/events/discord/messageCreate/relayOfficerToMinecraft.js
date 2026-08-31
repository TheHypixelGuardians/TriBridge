const bridge = require("../../../bridge");
const guilds = require("../../../utils/guilds");
const mcBots = require("../../../utils/mcBots");
const { sendChat } = require("../../../utils/chatQueue");
const { buildOfficerChatCommand } = require("../../../utils/sanitizeForChat");
const { getLink } = require("../../../utils/linkedAccounts");

/**
 * The reply leg of the officer bridge: a message typed in a guild's officer
 * channel is spoken in that guild's Hypixel officer chat.
 *
 * There is no `!tag` routing and no fan-out. The channel a message was typed in
 * *is* the guild, and a reply reaches that guild's officer chat only — even
 * when `crossBridgeOfficer` is on. That matches the main bridge: cross-bridging
 * is a Minecraft → Minecraft path, and the copy this bot is about to speak is
 * dropped by the `isOwnAccountName` guard in relayOfficerToGuilds.js before it
 * can be forwarded anywhere.
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
  const guild = guilds.getByOfficerChannel(message.channel.id);
  if (!guild) return;

  // Attachment-only messages have empty content; don't send a dangling colon.
  const body =
    message.content || (message.attachments.size > 0 ? "[attachment]" : "");

  // The account link, and nothing else. Deliberately not resolveIdentity():
  // that applies the global profile change, and a disguise that can rename
  // whoever is speaking in officer chat is precisely what a privileged channel
  // must not have. No webhook repost either, so this channel needs neither
  // Manage Webhooks nor Manage Messages.
  const displayName =
    getLink(message.author.id)?.name ?? message.author.username;

  const command = buildOfficerChatCommand(displayName, body);
  if (!command) return;

  const record = mcBots.getRecord(guild.key);

  // Unlike the bridge channel there is no second guild that might have received
  // this, so staying silent would read as the bridge ignoring them.
  if (!record?.connected || !record.bot) {
    // Needs Add Reactions; a missing permission is not worth reporting per
    // message, and there is nothing else to be done about it here.
    await message.react("📡").catch(() => {});
    return;
  }

  void sendChat(record, command);
};
