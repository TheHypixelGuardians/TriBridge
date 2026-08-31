const guilds = require("./guilds");
const mcBots = require("./mcBots");
const { sendChat } = require("./chatQueue");
const { buildGuildChatCommand } = require("./sanitizeForChat");

// A forwarded line that has sat in a bot's outbound queue this long is dropped.
// Guild chat is a conversation: a reply landing a minute after the thing it
// answers is confusing rather than late, and without a ceiling one guild being
// spammed would push every other guild's bridge further and further behind.
const MAX_RELAY_AGE_MS = 10_000;

/**
 * The guilds a line spoken in `sourceKey` should be forwarded to.
 *
 * Reads the registry rather than taking it as an argument, like
 * `chatRouting.routeMessage` — drive it in a test by writing `guildsConfig.json`.
 *
 * @param {string} sourceKey The Hypixel guild the line came from.
 * @returns {object[]} Registry records, never including the source itself.
 */
function crossBridgeTargets(sourceKey) {
  const key = String(sourceKey ?? "").toLowerCase();
  if (!key) return [];

  const participating = guilds.getCrossBridged();
  // The source has to be taking part too. Otherwise a guild with the flag off
  // would still have its chat pushed into every guild that has it on, which is
  // the opposite of what switching it off looks like it does.
  if (!participating.some((g) => g.key === key)) return [];

  return participating.filter((g) => g.key !== key);
}

/**
 * Forwards one guild-chat line to every other cross-bridged guild.
 *
 * The `[TAG]` says which guild is talking, so a member of two bridged guilds can
 * tell a forwarded line from a local one. It goes in the name position rather
 * than in front of the message body because that is where Hypixel already puts
 * rank brackets, so it reads as part of the speaker rather than as something
 * they said.
 *
 * The command is built once for every target, exactly as the Discord relay does
 * it: identical name plus identical body means identical truncation, so no guild
 * ends up with a differently-cut copy of the same sentence. Hypixel's
 * duplicate-message filter is per account, so sending the same text from several
 * accounts is fine.
 *
 * Callers must have already dropped lines spoken by one of the bot's own
 * accounts — that check is what stops A → B → A ping-pong, since the forwarded
 * copy is spoken in the target guild by the target guild's own bot.
 *
 * @param {object} source Registry record of the guild the line came from.
 * @param {string} username The Minecraft name that spoke.
 * @param {string} content What they said.
 * @returns {number} How many guilds it was handed to.
 */
function relayAcrossGuilds(source, username, content) {
  if (!source) return 0;

  const targets = crossBridgeTargets(source.key);
  if (targets.length === 0) return 0;

  const command = buildGuildChatCommand(`[${source.tag}] ${username}`, content);
  if (!command) return 0;

  let sent = 0;

  for (const guild of targets) {
    const record = mcBots.getRecord(guild.key);
    // Offline guilds are skipped without comment, like the Discord relay:
    // their own log channel already says they are down, and there is nobody
    // to tell in-game anyway.
    if (!record?.connected || !record.bot) continue;

    void sendChat(record, command, { maxAgeMs: MAX_RELAY_AGE_MS });
    sent += 1;
  }

  return sent;
}

module.exports = { crossBridgeTargets, relayAcrossGuilds, MAX_RELAY_AGE_MS };
