// Hypixel guild chat, as it looks once the §-codes have been stripped:
//
//   Guild > [MVP++] Notch [Officer]: hello       ← someone talking
//   Guild > Notch joined.                        ← presence
//   Guild > Notch left.
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

/**
 * Parses a guild-chat line spoken by a player.
 *
 * @param {string} cleanMsg A chat line with `§` formatting codes already removed.
 * @returns {{username: string, content: string}|null}
 */
function parseGuildChat(cleanMsg) {
    const match = String(cleanMsg ?? '').match(CHAT_PATTERN);
    if (!match) return null;
    return {username: match[1], content: match[2]};
}

/**
 * Parses a guild join/leave announcement.
 *
 * @param {string} cleanMsg A chat line with `§` formatting codes already removed.
 * @returns {{username: string, action: 'joined'|'left'}|null}
 */
function parseGuildPresence(cleanMsg) {
    const match = String(cleanMsg ?? '').match(PRESENCE_PATTERN);
    if (!match) return null;
    return {username: match[1], action: match[2]};
}

module.exports = {parseGuildChat, parseGuildPresence, CHAT_PATTERN, PRESENCE_PATTERN};
