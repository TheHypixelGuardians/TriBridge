// The Hypixel lines the private-command system reads, as they look once the
// §-codes have been stripped:
//
//   From [MVP+] Notch: !online                          ← a DM to the bot
//   To [MVP+] Notch: Online (3): ...                    ← the bot's own DM, echoed
//   Friend request from [MVP+] Notch                    ← one line of a
//                                                         multi-line message,
//                                                         between separator lines
//   [VIP] Notch joined the guild!                       ← roster changes, also
//   [VIP] Notch left the guild!                           between separator lines
//   [VIP] Notch was kicked from the guild by [MVP++] Boss!
//
// The Hypixel rank in brackets is optional everywhere.
//
// Like utils/guildChat.js this is regex against Hypixel's English output and
// is inherently brittle; it lives in one file so a wording change is one edit.
//
// Every pattern is anchored with `^` and `$`, and the rank group is `[^\]]+`
// rather than `.+?`. Both matter. Unanchored, or with a lazy `.+?` that can run
// across a `]`, a lobby line such as `[VIP] Mallory: [a] Notch left the guild!`
// matched as a real departure, and `Guild > Mallory: From Notch: !online` as a
// DM from Notch. What a player cannot write is the *start* of a line: their own
// chat always begins with their name, `Guild > `, `Party > ` or `From `.
const RANK = String.raw`(?:\[[^\]]+\] )?`;
const NAME = String.raw`(\w{1,16})`;

const DIRECT_MESSAGE_PATTERN = new RegExp(`^From ${RANK}${NAME}: (.*)$`);
const OUTGOING_MESSAGE_PATTERN = new RegExp(`^To ${RANK}${NAME}: (.*)$`);
const FRIEND_REQUEST_PATTERN = new RegExp(
  `^Friend request from ${RANK}${NAME}$`,
);
const JOIN_PATTERN = new RegExp(`^${RANK}${NAME} joined the guild!$`);
const LEAVE_PATTERN = new RegExp(`^${RANK}${NAME} left the guild!$`);
const KICK_PATTERN = new RegExp(
  `^${RANK}${NAME} was kicked from the guild by ${RANK}\\w{1,16}!$`,
);

/**
 * Splits a message into its lines with formatting removed. Friend requests and
 * guild join/leave lines arrive as one message between separator lines.
 *
 * @param {string} text
 * @returns {string[]}
 */
function cleanLines(text) {
  return String(text ?? "")
    .replace(/§./g, "")
    .split("\n")
    .map((line) => line.trim());
}

/**
 * Parses a private message sent *to* the bot.
 *
 * Only a single-line message counts. A DM is always one line, and refusing
 * multi-line messages means a line buried inside some other server output can
 * never pass for one.
 *
 * @param {string} text A chat message, with or without `§` codes.
 * @returns {{username: string, content: string}|null}
 */
function parseDirectMessage(text) {
  const lines = cleanLines(text).filter(Boolean);
  if (lines.length !== 1) return null;
  const match = lines[0].match(DIRECT_MESSAGE_PATTERN);
  return match ? { username: match[1], content: match[2].trim() } : null;
}

/**
 * Parses the echo of a private message the bot sent.
 *
 * @param {string} text
 * @returns {{username: string, content: string}|null}
 */
function parseOutgoingMessage(text) {
  const lines = cleanLines(text).filter(Boolean);
  if (lines.length !== 1) return null;
  const match = lines[0].match(OUTGOING_MESSAGE_PATTERN);
  return match ? { username: match[1], content: match[2].trim() } : null;
}

/**
 * Parses an incoming friend request.
 *
 * @param {string} text
 * @returns {{username: string}|null}
 */
function parseFriendRequest(text) {
  for (const line of cleanLines(text)) {
    const match = line.match(FRIEND_REQUEST_PATTERN);
    if (match) return { username: match[1] };
  }
  return null;
}

/**
 * Parses a guild roster change: a player joining, leaving or being kicked.
 *
 * Not the same as `Guild > Notch joined.`, which only means a member came
 * online — see `parseGuildPresence()` in utils/guildChat.js.
 *
 * @param {string} text
 * @returns {{username: string, action: 'joined'|'left'|'kicked'}|null}
 */
function parseRosterChange(text) {
  for (const line of cleanLines(text)) {
    let match = line.match(JOIN_PATTERN);
    if (match) return { username: match[1], action: "joined" };
    match = line.match(LEAVE_PATTERN);
    if (match) return { username: match[1], action: "left" };
    match = line.match(KICK_PATTERN);
    if (match) return { username: match[1], action: "kicked" };
  }
  return null;
}

module.exports = {
  parseDirectMessage,
  parseOutgoingMessage,
  parseFriendRequest,
  parseRosterChange,
  DIRECT_MESSAGE_PATTERN,
  FRIEND_REQUEST_PATTERN,
};
