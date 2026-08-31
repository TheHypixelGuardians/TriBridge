const bridge = require("../../../bridge");
const {
  resolveIdentity,
  repostAs,
  shouldSkip,
  canRepostIn,
  auditDisguise,
} = require("../../../utils/disguise");
const { buildGuildChatCommand } = require("../../../utils/sanitizeForChat");
const { routeMessage } = require("../../../utils/chatRouting");
const mcBots = require("../../../utils/mcBots");
const { sendChat } = require("../../../utils/chatQueue");
const { parseChatCommand } = require("../../../utils/chatCommands");
const { answerChatCommand } = require("../../../utils/networthReply");

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
 * @returns {number} How many guilds it actually reached.
 */
function relayToGuildChat(targets, displayName, content, hasAttachments) {
  // Attachment-only messages have empty content; don't send a dangling colon.
  const body = content || (hasAttachments ? "[attachment]" : "");
  const command = buildGuildChatCommand(displayName, body);
  if (!command) return 0;

  let delivered = 0;

  for (const guild of targets) {
    const record = mcBots.getRecord(guild.key);
    // Offline guilds are skipped without comment: their own log channel
    // already says they are down, and a warning per message in a busy
    // channel would be unusable.
    if (!record?.connected || !record.bot) continue;

    void sendChat(record, command);
    delivered += 1;
  }

  return delivered;
}

/**
 * Adds the routing markers to whichever copy of the message still exists.
 *
 * Load-bearing detail: a reposted message has had the original *deleted*, so
 * reacting to `message` would either race the delete or decorate a tombstone.
 * The whole point of these markers is that the sender sees them.
 *
 * @param {import('discord.js').Message} surviving
 * @param {string[]} markers
 */
async function markUp(surviving, markers) {
  if (!surviving || typeof surviving.react !== "function") return;

  for (const marker of markers) {
    // Needs Add Reactions; a missing permission is not worth reporting per
    // message, and the message itself was still delivered.
    await surviving.react(marker).catch(() => {});
  }
}

module.exports = async (client, message) => {
  // Ignore bot messages and wrong channel. Webhook reposts are authored by a
  // bot, so this guard is also what stops the repost loop.
  if (message.author.bot || message.channel.id !== bridge.discordChannelId)
    return;

  // Before routeMessage, which is the whole point of the position: `!nw Notch`
  // matches chatRouting's TAG_PREFIX, so leaving it to the router would
  // broadcast the literal text to every guild and mark it with a ❓.
  //
  // A command deliberately gets none of the treatment below it. It is not
  // reposted or disguised — that would delete the asker's message, spend a
  // webhook call and, mid global-profile-change, write an audit entry claiming
  // somebody was impersonated. It is not reacted to, because ❓ and 📡 are
  // routing markers and this was not routed. And it reaches no guild chat,
  // because nobody in-game asked.
  const command = parseChatCommand(message.content);
  if (command) {
    void answerChatCommand(command, {
      requesterKey: `d:${message.author.id}`,
      asker: message.member?.displayName ?? message.author.username,
      guild: null,
    });
    return;
  }

  const { targets, body, unknownTag, targeted } = routeMessage(message.content);

  // A global profile change outranks an account link, which outranks the
  // plain author — see utils/disguise.js.
  const identity = resolveIdentity(message);

  // There is one Discord message however many guilds it reaches, so the
  // repost and its audit entry happen exactly once, outside the fan-out.
  let reposted = false;
  let surviving = message;

  if (identity.repost && !shouldSkip(message) && canRepostIn(message.channel)) {
    // `body`, not the raw content: the repost is the only copy left in
    // Discord, so it has to show the text guild chat was actually given.
    // Otherwise `!sb hi` reaches the guild as "hi" while Discord still reads
    // "!sb hi", and the routing prefix looks broken to everyone watching.
    const result = await repostAs(message, identity, { content: body });
    reposted = result.ok;
    if (reposted) surviving = result.message;

    if (reposted && identity.disguised) {
      await auditDisguise(message, identity, result.url);
    }
  }

  // A failed or skipped repost leaves the original standing under the author's
  // own name, so guild chat has to be told the same story.
  const displayName = reposted ? identity.chatName : message.author.username;

  const delivered = relayToGuildChat(
    targets,
    displayName,
    body,
    message.attachments.size > 0,
  );

  const markers = [];

  // A mistyped tag still gets delivered everywhere — this just makes the
  // mistake visible.
  if (unknownTag) markers.push("❓");

  // An explicitly tagged message that reached nothing is the one case worth
  // interrupting for: the sender picked a guild on purpose and it is offline,
  // so unlike a broadcast there is no other guild that got it. Staying silent
  // here is what makes `!tag` look like it is being ignored.
  if (targeted && delivered === 0) markers.push("📡");

  await markUp(surviving, markers);
};
