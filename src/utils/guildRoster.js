const guilds = require("./guilds");
const mcBots = require("./mcBots");
const queryGuild = require("./queryGuild");

// `/guild list` output, with colour codes stripped:
//
//   Guild Name: Example
//   -- Guild Master --
//   [MVP++] Boss ●
//   -- Member --
//   [VIP] Notch ●  Steve ●  [MVP+] jeb_ ●
//   Total Members: 4
//
// Rank headers are `-- Name --`, anchored so the `--------- Guild ---------`
// banner is not taken for one. Members sit between rank headers, separated by
// ● dots, both online and offline.
const RANK_HEADER = /^--\s+(.+?)\s+--$/;
const SUMMARY_LINE = /^(Total|Online|Offline) Members:/;

/** How long a roster is trusted before it is asked for again. */
const TTL_MS = 5 * 60_000;

/** @type {Map<string, {members: Set<string>, at: number}>} */
const cache = new Map();
/** @type {Map<string, Promise<Set<string>|null>>} */
const pending = new Map();

/**
 * Pulls every member name out of `/guild list` output.
 *
 * @param {string[]} rawLines Collected lines, with or without colour codes.
 * @returns {Set<string>|null} Lowercased names, or null when the output never
 *   looked like a roster (bot lagging, command refused, format changed) — an
 *   empty guild and an unreadable answer must not look the same.
 */
function parseRosterMembers(rawLines) {
  const members = new Set();
  let inRank = false;
  let sawStructure = false;

  for (const raw of rawLines ?? []) {
    const trimmed = String(raw).replace(/§./g, "").trim();

    if (RANK_HEADER.test(trimmed)) {
      inRank = true;
      sawStructure = true;
      continue;
    }
    if (SUMMARY_LINE.test(trimmed)) {
      sawStructure = true;
      inRank = false;
      continue;
    }
    if (!inRank || /^-+$/.test(trimmed)) continue;

    for (const segment of trimmed.split(/●+/)) {
      const match = segment.trim().match(/(\w{1,16})$/);
      if (match) members.add(match[1].toLowerCase());
    }
  }

  return sawStructure ? members : null;
}

/**
 * One guild's members, from cache when fresh enough.
 *
 * Concurrent callers share one `/guild list`. A cached roster is still served
 * while the bot is offline, until it expires.
 *
 * @param {string} guildKey
 * @param {{maxAgeMs?: number}} [options]
 * @returns {Promise<Set<string>|null>} null when the roster is unknown.
 */
async function getMembers(guildKey, { maxAgeMs = TTL_MS } = {}) {
  const cached = cache.get(guildKey);
  if (cached && Date.now() - cached.at < maxAgeMs) return cached.members;

  if (pending.has(guildKey)) return pending.get(guildKey);

  const stillValid = () =>
    cached && Date.now() - cached.at < TTL_MS ? cached.members : null;

  const refresh = (async () => {
    const record = mcBots.getRecord(guildKey);
    if (!record?.connected) return stillValid();

    const query = await queryGuild(record, "/guild list", { format: "motd" });
    const members = query.ok ? parseRosterMembers(query.lines) : null;
    if (members) {
      cache.set(guildKey, { members, at: Date.now() });
      return members;
    }
    return stillValid();
  })();

  pending.set(guildKey, refresh);
  try {
    return await refresh;
  } finally {
    pending.delete(guildKey);
  }
}

/**
 * Forgets a guild's roster, so the next check asks Hypixel again. Called when a
 * player joins, leaves or is kicked.
 *
 * @param {string} guildKey
 */
function invalidate(guildKey) {
  cache.delete(guildKey);
}

/**
 * Which bridged guilds a player is a member of.
 *
 * `inconclusive` is set when no roster held the name but at least one could not
 * be read, so "not a member" cannot be claimed. Callers deciding to accept a
 * friend or run a command treat that as a refusal (fail closed); callers
 * deciding to *remove* something must treat it as "do nothing".
 *
 * A roster that misses the name is asked again if it is more than a minute old,
 * so somebody who joined a moment ago is not refused for five minutes.
 *
 * @param {string} name Minecraft name.
 * @returns {Promise<{guilds: object[], inconclusive: boolean}>}
 */
async function findMembership(name) {
  const wanted = String(name ?? "").toLowerCase();
  const enabled = guilds.getEnabled();
  if (!wanted || enabled.length === 0) {
    return { guilds: [], inconclusive: enabled.length === 0 };
  }

  const check = (options) =>
    Promise.all(
      enabled.map(async (guild) => ({
        guild,
        members: await getMembers(guild.key, options),
      })),
    );

  let results = await check();
  if (!results.some(({ members }) => members?.has(wanted))) {
    results = await check({ maxAgeMs: 60_000 });
  }

  const found = results
    .filter(({ members }) => members?.has(wanted))
    .map(({ guild }) => guild);

  return {
    guilds: found,
    inconclusive:
      found.length === 0 && results.some(({ members }) => members === null),
  };
}

/** Test hook: forgets every roster. */
function clearCache() {
  cache.clear();
  pending.clear();
}

module.exports = {
  parseRosterMembers,
  getMembers,
  invalidate,
  findMembership,
  clearCache,
  RANK_HEADER,
  SUMMARY_LINE,
  TTL_MS,
};
