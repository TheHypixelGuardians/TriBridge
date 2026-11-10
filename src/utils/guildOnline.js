const queryGuild = require("./queryGuild");

/**
 * Parses collected Hypixel guild list messages to extract online members by rank.
 *
 * Hypixel guild list format (with Minecraft color codes):
 * - Rank headers: "-- RankName --" (after stripping §x codes)
 * - Player entries are separated by ● dots (activity indicators)
 * - Online players are colored with §a (green)
 * - Offline players are colored with §7 (gray) or §c (red)
 *
 * @param {string[]} rawMessages - Array of raw message strings with Minecraft color codes
 * @returns {{ ranks: Map<string, string[]>, totalOnline: number,
 *   totalMembers: number|null }}
 */
function parseGuildList(rawMessages) {
  const ranks = new Map();
  let currentRank = null;
  let totalOnline = 0;
  let totalMembers = null;

  for (const raw of rawMessages) {
    const clean = raw.replace(/§./g, "");

    // Detect rank header: "-- RankName --"
    // Use anchored regex to avoid matching the guild banner (--------- Guild Name ---------)
    const trimmed = clean.trim();
    const rankMatch = trimmed.match(/^--\s+(.+?)\s+--$/);
    if (rankMatch) {
      currentRank = rankMatch[1].trim();
      if (!ranks.has(currentRank)) {
        ranks.set(currentRank, []);
      }
      continue;
    }

    const totalMatch = trimmed.match(/^Total Members:\s*(\d+)/);
    if (totalMatch) totalMembers = Number(totalMatch[1]);

    // Skip summary lines and separators that appear after rank sections
    if (
      /^-+$/.test(trimmed) ||
      /^(Total|Online|Offline) Members:/.test(trimmed) ||
      /^Guild Name:/.test(trimmed)
    ) {
      continue;
    }

    // Parse online players within a rank section
    if (currentRank) {
      // Split by ● (activity dots) to isolate individual player entries
      const segments = raw.split(/●+/);

      for (const segment of segments) {
        const cleanSegment = segment.replace(/§./g, "").trim();
        if (!cleanSegment) continue;

        // Only process online players (indicated by §a = green color)
        if (!segment.includes("§a")) continue;

        // Extract username: last alphanumeric word (1-16 chars) in the clean segment
        const nameMatch = cleanSegment.match(/(\w{1,16})\s*$/);
        if (nameMatch) {
          ranks.get(currentRank).push(nameMatch[1]);
          totalOnline++;
        }
      }
    }
  }

  return { ranks, totalOnline, totalMembers };
}

/**
 * Asks one guild's bot who is online, and parses the answer.
 *
 * Shared by `/online` and the in-game `!online`, so both read Hypixel's output
 * the same way.
 *
 * @param {import('./mcBots').BotRecord} record
 * @returns {Promise<
 *   | {ok: true, ranks: Map<string, string[]>, totalOnline: number, totalMembers: number|null}
 *   | {ok: false, reason: 'busy'|'offline'|'unreadable'}
 * >}
 */
async function fetchOnline(record) {
  const query = await queryGuild(record, "/guild online", {
    format: "motd",
    idleMs: 1000,
  });

  if (!query.ok) {
    return { ok: false, reason: query.reason === "busy" ? "busy" : "offline" };
  }

  const parsed = parseGuildList(query.lines);
  if (parsed.ranks.size === 0) return { ok: false, reason: "unreadable" };
  return { ok: true, ...parsed };
}

module.exports = { parseGuildList, fetchOnline };
