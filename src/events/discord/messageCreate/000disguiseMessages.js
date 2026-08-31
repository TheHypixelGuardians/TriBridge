const bridge = require("../../../bridge");
const guilds = require("../../../utils/guilds");
const { appliesTo } = require("../../../utils/globalProfile");
const {
  resolveIdentity,
  repostAs,
  shouldSkip,
  canRepostIn,
  auditDisguise,
} = require("../../../utils/disguise");

module.exports = async (client, message) => {
  // Webhook reposts are authored by a bot, so this guard is also what stops
  // the repost loop.
  if (message.author.bot) return;

  // DMs have no guild, and the bot serves exactly one server.
  if (!message.guildId || message.guildId !== bridge.discordServerId) return;

  // The bridge channel belongs to relayToMinecraft.js, which does its own
  // repost. Two handlers deleting the same message would race, and the numeric
  // prefix only guarantees ordering — it does not make them cooperate.
  if (message.channel.id === bridge.discordChannelId) return;

  // An officer channel is left alone for a different reason: reposting here
  // would author the message as a webhook, and relayOfficerToMinecraft.js drops
  // anything authored by a bot — so the officer's line would vanish from
  // Discord and never reach Hypixel, with no error anywhere. It is also the
  // consistent answer, since the disguise governs the two legs of the main
  // bridge and has no business relabelling anyone in officer chat.
  if (guilds.getByOfficerChannel(message.channel.id)) return;

  if (!appliesTo(message.author.id, message.channel.id)) return;
  if (shouldSkip(message)) return;
  if (!canRepostIn(message.channel)) return;

  const identity = resolveIdentity(message);
  const result = await repostAs(message, identity);
  if (!result.ok) return;

  await auditDisguise(message, identity, result.url);
};
