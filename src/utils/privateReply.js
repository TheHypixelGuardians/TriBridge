const chatQueue = require("./chatQueue");
const { sanitizeForChat, MAX_CHAT_LENGTH } = require("./sanitizeForChat");
const { isValidMinecraftName } = require("./minecraftName");

/**
 * At most this many `/msg` packets per reply. Every packet spends the account's
 * shared rate budget, the one guild chat relaying needs too, so a long answer
 * pages (`!online sb 2`) rather than flooding.
 */
const MAX_PACKETS = 5;

/**
 * A reply still queued this long after the command arrived is dropped. A busy
 * bridge should lose a stale answer, not keep relayed chat waiting behind it.
 */
const MAX_AGE_MS = 30_000;

/**
 * The room for text in one `/msg <name> ` packet.
 *
 * @param {string} name
 * @returns {number}
 */
function lineBudget(name) {
  return MAX_CHAT_LENGTH - `/msg ${name} `.length;
}

/**
 * Cuts one line into pieces of at most `budget` characters, breaking after a
 * comma or at a space when it can.
 *
 * @param {string} text
 * @param {number} budget
 * @returns {string[]}
 */
function splitLine(text, budget) {
  const pieces = [];
  let rest = text;

  while (rest.length > budget) {
    const window = rest.slice(0, budget + 1);
    let cut = Math.max(window.lastIndexOf(", ") + 1, window.lastIndexOf(" "));
    if (cut <= 0) cut = budget;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) pieces.push(rest);
  return pieces;
}

/**
 * Builds the `/msg` commands that carry a reply to one player.
 *
 * Every line goes through `sanitizeForChat()`, so nothing a command echoes —
 * a guild name, a rank, a player's own argument — can carry a newline into
 * command position or a `§` that gets the bot disconnected.
 *
 * @param {string} name The player to reply to.
 * @param {string|string[]} lines
 * @param {{maxPackets?: number}} [options]
 * @returns {string[]} Commands for `sendChat`, or none if `name` is not a valid
 *   Minecraft name.
 */
function buildPrivateReplies(name, lines, { maxPackets = MAX_PACKETS } = {}) {
  if (!isValidMinecraftName(name)) return [];

  const budget = lineBudget(name);
  const pieces = (Array.isArray(lines) ? lines : [lines])
    .map(sanitizeForChat)
    .filter(Boolean)
    .flatMap((line) => splitLine(line, budget));

  if (pieces.length > maxPackets) {
    pieces.length = maxPackets;
    const last = pieces[maxPackets - 1];
    pieces[maxPackets - 1] =
      last.length > budget - 4
        ? `${last.slice(0, budget - 4)} ...`
        : `${last} ...`;
  }

  return pieces.map((piece) => `/msg ${name} ${piece}`);
}

/**
 * Sends a reply to a player through the bot's rate-limited chat queue.
 *
 * @param {import('./mcBots').BotRecord} record
 * @param {string} name
 * @param {string|string[]} lines
 * @returns {Promise<boolean>} Whether every packet was handed to mineflayer.
 */
async function sendPrivateReply(record, name, lines) {
  const commands = buildPrivateReplies(name, lines);
  const sent = await Promise.all(
    commands.map((command) =>
      chatQueue.sendChat(record, command, { maxAgeMs: MAX_AGE_MS }),
    ),
  );
  return sent.length > 0 && sent.every(Boolean);
}

module.exports = {
  buildPrivateReplies,
  sendPrivateReply,
  lineBudget,
  MAX_PACKETS,
};
