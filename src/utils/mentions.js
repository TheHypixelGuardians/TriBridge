const bridge = require("../bridge");
const linkedAccounts = require("./linkedAccounts");

/**
 * `@name` in Minecraft chat. The name is a Discord username (letters, digits,
 * `_` and `.`, 2–32 characters) or a Minecraft name, which is a subset of that.
 * It must start the line or follow a character that cannot be part of a name,
 * so an address like `me@example` is not read as a mention.
 */
const MENTION_PATTERN = /(^|[^A-Za-z0-9_.@<])@([A-Za-z0-9_.]{2,32})/g;

/**
 * At most this many people are pinged by one line. Guild chat is open to every
 * guild member, so without a cap one line naming the whole staff list would
 * notify all of them.
 */
const MAX_MENTIONS = 5;

const HIT_TTL_MS = 5 * 60 * 1000;
const MISS_TTL_MS = 60 * 1000;

/** @type {Map<string, {id: string|null, expires: number}>} */
const cache = new Map();

/**
 * The single member of `members` whose username, global display name or
 * server nickname is `name`, case-insensitively. A username match wins, since
 * usernames are unique; a display name or nickname only counts when exactly
 * one member has it, so a shared nickname never pings the wrong person.
 *
 * @param {Iterable<import('discord.js').GuildMember>} members
 * @param {string} name
 * @returns {string|null} The member's user id.
 */
function pickMember(members, name) {
  const target = name.toLowerCase();
  const humans = [...members].filter((member) => !member.user.bot);

  const byUsername = humans.find(
    (member) => member.user.username.toLowerCase() === target,
  );
  if (byUsername) return byUsername.id;

  const byDisplayName = humans.filter((member) =>
    [member.user.globalName, member.nickname].some(
      (shown) => shown?.toLowerCase() === target,
    ),
  );
  return byDisplayName.length === 1 ? byDisplayName[0].id : null;
}

/**
 * Searches the Discord server for `name`. Member search is a REST call and,
 * unlike listing every member, needs no GuildMembers intent.
 *
 * @param {string} name
 * @returns {Promise<string|null>}
 */
async function searchServer(name) {
  if (!bridge.discordClient || !bridge.discordServerId) return null;

  const server = await bridge.discordClient.guilds.fetch(
    bridge.discordServerId,
  );
  const members = await server.members.search({ query: name, limit: 10 });
  return pickMember(members.values(), name);
}

/**
 * Resolves a name typed after `@` to a Discord user id: a bridge account link
 * for that Minecraft name first (guild chat naturally uses Minecraft names),
 * then a member of the Discord server by username, display name or nickname.
 *
 * Results are cached, misses for a shorter time, so a busy chat does not
 * search the server for the same name on every line. A failed search resolves
 * nothing rather than throwing: a missing ping must never drop the message.
 *
 * @param {string} name
 * @returns {Promise<string|null>}
 */
async function resolveName(name) {
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.id;

  let id = null;
  try {
    const link = await linkedAccounts.getLinkByName(name);
    id = link ? link.discordId : await searchServer(name);
  } catch (error) {
    console.error(`[mentions] could not resolve @${name}:`, error);
    return null;
  }

  cache.set(key, {
    id,
    expires: Date.now() + (id ? HIT_TTL_MS : MISS_TTL_MS),
  });
  return id;
}

/**
 * Turns `@name` in a relayed Minecraft line into Discord mentions.
 *
 * Returns the text with each resolved `@name` replaced by `<@id>`, for the
 * embed, and the ids to ping. A mention inside an embed renders but never
 * notifies anyone, so the relay also has to put the ids in the message content
 * and allow exactly those users — see {@link mentionPayload}.
 *
 * A name ending in `.` is retried without it, so "thanks @Alice." still works.
 *
 * @param {string} text
 * @returns {Promise<{text: string, userIds: string[]}>}
 */
async function resolveMentions(text) {
  const names = [];
  for (const match of text.matchAll(MENTION_PATTERN)) {
    if (!names.includes(match[2])) names.push(match[2]);
  }
  if (names.length === 0) return { text, userIds: [] };

  /** @type {Map<string, {id: string, used: string}>} */
  const resolved = new Map();
  for (const name of names) {
    if (resolved.size >= MAX_MENTIONS) break;
    const trimmed = name.replace(/\.+$/, "");
    let id = await resolveName(name);
    let used = name;
    if (!id && trimmed !== name && trimmed.length >= 2) {
      id = await resolveName(trimmed);
      used = trimmed;
    }
    if (id) resolved.set(name, { id, used });
  }

  const userIds = [...new Set([...resolved.values()].map((r) => r.id))];
  const replaced = text.replace(MENTION_PATTERN, (whole, before, name) => {
    const hit = resolved.get(name);
    if (!hit) return whole;
    return `${before}<@${hit.id}>${name.slice(hit.used.length)}`;
  });

  return { text: replaced, userIds };
}

/**
 * The `content` and `allowedMentions` that make the mentions in a relayed
 * embed actually ping.
 *
 * `allowedMentions` lists the resolved users and parses nothing, so a player
 * typing `@everyone`, `@here`, a role mention or a raw `<@id>` into guild chat
 * pings nobody: only names the bot itself resolved can notify.
 *
 * @param {string[]} userIds
 * @returns {{content?: string, allowedMentions: {parse: [], users: string[]}}}
 */
function mentionPayload(userIds) {
  return {
    ...(userIds.length > 0
      ? { content: userIds.map((id) => `<@${id}>`).join(" ") }
      : {}),
    allowedMentions: { parse: [], users: userIds },
  };
}

/** Test hook: forget every cached lookup. */
function clearCache() {
  cache.clear();
}

module.exports = {
  resolveMentions,
  mentionPayload,
  pickMember,
  clearCache,
  MAX_MENTIONS,
};
