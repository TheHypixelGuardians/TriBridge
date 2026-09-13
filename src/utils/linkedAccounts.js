const db = require("./db");

/**
 * Minecraft account links, read from the THG community bot's database.
 *
 * The community bot owns `/link`, `/unlink` and `/whois`; this bot only reads
 * the result, because guild chat has to be attributed to the same Minecraft name
 * the community side shows. There is deliberately no write path here — two bots
 * writing one link table is how the two would start disagreeing about who is
 * who.
 *
 * The rows relate to `User.id` rather than to the Discord id (the community
 * bot's schema convention), so every lookup joins through `"User"`.
 *
 * Lookups sit on the message path, so they are cached — but briefly. A member
 * who has just run `/link` expects their very next message to be attributed
 * correctly, and a long cache would spend that first minute still showing their
 * Discord name.
 */
const TTL_MS = 15_000;

const byDiscordId = new Map();
const byName = new Map();

function readCache(cache, key) {
  const entry = cache.get(key);
  if (!entry) return undefined;

  if (Date.now() - entry.readAt >= TTL_MS) {
    cache.delete(key);
    return undefined;
  }

  return entry.value;
}

function writeCache(cache, key, value) {
  cache.set(key, { value, readAt: Date.now() });
  return value;
}

/**
 * @param {string} discordId
 * @returns {Promise<{uuid: string, name: string, discordId: string}|null>} null
 *   when the user has no link, and also when the database cannot be reached —
 *   an unreachable database must relay under the Discord name rather than take
 *   the bridge down.
 */
async function getLink(discordId) {
  const cached = readCache(byDiscordId, discordId);
  if (cached !== undefined) return cached;

  const rows = await db.query(
    `SELECT l."uuid", l."name"
       FROM "MinecraftLink" l
       JOIN "User" u ON u."id" = l."userId"
      WHERE u."discordId" = $1
      LIMIT 1`,
    [discordId],
  );

  if (rows === null) return null;

  const link = rows[0] ? { discordId, uuid: rows[0].uuid, name: rows[0].name } : null;
  return writeCache(byDiscordId, discordId, link);
}

/**
 * Reverse lookup by Minecraft name, case-insensitively — Hypixel spells a name
 * however the player typed it.
 *
 * @param {string} mcName
 * @returns {Promise<{discordId: string, uuid: string, name: string}|null>}
 */
async function getLinkByName(mcName) {
  const target = String(mcName ?? "").trim();
  if (!target) return null;

  const key = target.toLowerCase();
  const cached = readCache(byName, key);
  if (cached !== undefined) return cached;

  const rows = await db.query(
    `SELECT l."uuid", l."name", u."discordId"
       FROM "MinecraftLink" l
       JOIN "User" u ON u."id" = l."userId"
      WHERE lower(l."name") = $1
      LIMIT 1`,
    [key],
  );

  if (rows === null) return null;

  const link = rows[0]
    ? { discordId: rows[0].discordId, uuid: rows[0].uuid, name: rows[0].name }
    : null;
  return writeCache(byName, key, link);
}

module.exports = { getLink, getLinkByName };
