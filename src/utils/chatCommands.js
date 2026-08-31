const guilds = require("./guilds");

// Commands anyone can type into guild chat or the bridge channel. Both spellings
// of the same thing, because `!networth` is what people try first.
const COMMANDS = new Map([
  ["nw", "networth"],
  ["networth", "networth"],
]);

// Guild tags that would collide with a command name. `/guilds add` and
// `/guilds edit` refuse these — utils/guilds.js reads this set — because
// otherwise `!nw hi` means both "look up hi's networth" and "send hi to the
// guild tagged NW".
const RESERVED_TAGS = new Set(COMMANDS.keys());

const COMMAND_PREFIX = /^!([A-Za-z]{1,12})(?:\s+([\s\S]*))?$/;

/**
 * Parses a bot command out of a chat line.
 *
 * Deliberately closed over `COMMANDS` rather than matching any `!word`. Both
 * Minecraft relays suppress exactly what this dispatches, so the two must agree
 * perfectly: if this matched an unregistered name, an ordinary line that happens
 * to start with `!` would be swallowed and never answered.
 *
 * `!!` means "show these characters, do not run this" — the same escape
 * utils/chatRouting.js uses for guild tags, honoured in both directions.
 *
 * @param {string} text A chat line, already stripped of `§` codes.
 * @returns {{name: string, args: string}|null} The canonical command name and
 *   everything after it, or null if this is ordinary chat.
 */
function parseChatCommand(text) {
  const raw = String(text ?? "").trim();
  if (raw.startsWith("!!")) return null;

  const match = raw.match(COMMAND_PREFIX);
  if (!match) return null;

  const name = COMMANDS.get(match[1].toLowerCase());
  if (!name) return null;

  // A guild that is already tagged `nw` keeps its routing. Reserving the tag
  // stops new ones being created, but an install that predates this must not
  // silently lose a working prefix.
  const clash = guilds.getByTag(match[1]);
  if (clash && clash.enabled !== false) return null;

  return { name, args: (match[2] ?? "").trim() };
}

/**
 * Whether a chat line is a bot command rather than something a player said.
 *
 * Used by the two Minecraft relays to keep commands out of Discord and out of
 * the cross-bridged guilds. The answer carries the question with it, so nothing
 * a person wrote is lost — and relaying a command would spend every
 * cross-bridged guild's shared chat budget on it.
 *
 * @param {string} text
 * @returns {boolean}
 */
function isChatCommand(text) {
  return parseChatCommand(text) !== null;
}

module.exports = { parseChatCommand, isChatCommand, RESERVED_TAGS };
