// Hypixel guild chat, as it looks once the §-codes have been stripped:
//
//   Guild > [MVP++] Notch [Officer]: hello       ← someone talking
//   Guild > Notch joined.                        ← presence
//   Guild > Notch left.
//
// Officer chat is the same shape behind a different prefix — observed in-game
// as:
//
//   Officer > [MVP++] zVapor: test
//
// Both the Hypixel rank (`[MVP++]`) and the guild rank (`[Officer]`) are
// optional, which is why each bracketed group is.
//
// This is regex against Hypixel's English chat output and is inherently
// brittle. It lives here rather than in a handler because two relays read the
// same lines — Minecraft → Discord and Minecraft → other guilds — and two
// copies of a fragile pattern is two things to remember to fix when Hypixel
// changes the format.
const CHAT_PATTERN = /Guild > (?:\[.+?\] )?(\w{1,16})(?: \[.+?\])?: (.+)/;
const PRESENCE_PATTERN = /Guild > (\w{1,16}) (joined|left)\./;

// Kept as its own pattern rather than widening CHAT_PATTERN to `(?:Guild|
// Officer) > `. Officer chat is privileged, and everything that reads
// CHAT_PATTERN — the bridge channel, the guild-to-guild relay, the chat-command
// dispatcher — would immediately start carrying it. The duplication is what
// makes moving officer chat somewhere new an explicit decision.
const OFFICER_PATTERN = /Officer > (?:\[.+?\] )?(\w{1,16})(?: \[.+?\])?: (.+)/;

/**
 * Parses a guild-chat line spoken by a player.
 *
 * @param {string} cleanMsg A chat line with `§` formatting codes already removed.
 * @returns {{username: string, content: string}|null}
 */
function parseGuildChat(cleanMsg) {
  const match = String(cleanMsg ?? "").match(CHAT_PATTERN);
  if (!match) return null;
  return { username: match[1], content: match[2] };
}

/**
 * Parses a guild join/leave announcement.
 *
 * @param {string} cleanMsg A chat line with `§` formatting codes already removed.
 * @returns {{username: string, action: 'joined'|'left'}|null}
 */
function parseGuildPresence(cleanMsg) {
  const match = String(cleanMsg ?? "").match(PRESENCE_PATTERN);
  if (!match) return null;
  return { username: match[1], action: match[2] };
}

/**
 * Parses an officer-chat line spoken by a player.
 *
 * @param {string} cleanMsg A chat line with `§` formatting codes already removed.
 * @returns {{username: string, content: string}|null}
 */
function parseOfficerChat(cleanMsg) {
  const match = String(cleanMsg ?? "").match(OFFICER_PATTERN);
  if (!match) return null;
  return { username: match[1], content: match[2] };
}

module.exports = {
  parseGuildChat,
  parseGuildPresence,
  parseOfficerChat,
  CHAT_PATTERN,
  PRESENCE_PATTERN,
  OFFICER_PATTERN,
};
