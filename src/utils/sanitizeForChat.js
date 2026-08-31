// Minecraft 1.8 caps client-sent chat packets at 100 characters.
const MAX_CHAT_LENGTH = 100;

/**
 * Flattens arbitrary Discord text into something safe to put inside a single
 * Minecraft chat packet.
 *
 * Collapsing newlines is load-bearing, not cosmetic: mineflayer's `bot.chat`
 * splits its argument on newlines and sends each line as a separate packet, so
 * a two-line Discord message would send the second line at command position —
 * letting anyone in the bridge channel run commands as the bot.
 *
 * @param {string} text Raw Discord message content.
 * @returns {string} Single-line text with formatting codes removed.
 */
function sanitizeForChat(text) {
  return String(text ?? "")
    .replace(/§./g, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds a `/gc <displayName>: <text>` command that fits in one chat packet,
 * truncating the message body (never the name) if it would overflow.
 *
 * @param {string} displayName Name to attribute the message to in guild chat.
 * @param {string} text Raw Discord message content.
 * @returns {string|null} The command to pass to `bot.chat`, or null if there is
 *   nothing left to send after sanitizing.
 */
function buildGuildChatCommand(displayName, text) {
  return buildChatCommand("/gc", displayName, text);
}

/**
 * Builds an `/oc <displayName>: <text>` command for officer chat.
 *
 * Separate entry point rather than a parameter on the guild-chat builder, so
 * that no caller can be switched between ordinary and officer chat by passing a
 * different value through.
 *
 * @param {string} displayName Name to attribute the message to in officer chat.
 * @param {string} text Raw Discord message content.
 * @returns {string|null} The command to pass to `bot.chat`, or null if there is
 *   nothing left to send after sanitizing.
 */
function buildOfficerChatCommand(displayName, text) {
  return buildChatCommand("/oc", displayName, text);
}

/**
 * @param {string} command The Hypixel chat command, without a trailing space.
 * @param {string} displayName
 * @param {string} text
 * @returns {string|null}
 */
function buildChatCommand(command, displayName, text) {
  const body = sanitizeForChat(text);
  if (!body) return null;

  const prefix = `${command} ${displayName}: `;
  const budget = MAX_CHAT_LENGTH - prefix.length;
  if (budget <= 0) return null;

  const truncated =
    body.length > budget ? `${body.substring(0, budget - 3)}...` : body;

  return `${prefix}${truncated}`;
}

module.exports = {
  sanitizeForChat,
  buildGuildChatCommand,
  buildOfficerChatCommand,
  MAX_CHAT_LENGTH,
};
