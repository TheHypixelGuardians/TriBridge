const bridge = require("../bridge");
const db = require("./db");
const { getLinkByName } = require("./linkedAccounts");

/**
 * The running global profile change, read from the THG community bot's database.
 *
 * The community bot owns the effect: `/adminpanel` starts and stops it, holds
 * the tester and channel lists, and reposts in ordinary channels. This bot reads
 * the same row to disguise the two legs it owns — the name guild chat is told,
 * and the name on incoming guild chat embeds — plus the bridge channel repost,
 * which stays here because `relayToMinecraft.js` has to repost anyway to
 * attribute a linked member's Minecraft name.
 *
 * There is no write path. `mode`, the target and the two direction switches all
 * change through the community bot's panel.
 *
 * Cached for a few seconds because the gate runs on every message. That is also
 * the worst-case lag between an admin starting an effect and this side honouring
 * it, which is the deliberate trade for not querying Postgres per message.
 */
const TTL_MS = 10_000;

const OFF = {
  mode: "off",
  target: null,
  expiresAt: null,
  startedBy: null,
  startedAt: null,
  testerIds: [],
  testChannelIds: [],
  excludedChannelIds: [],
  disguiseToMinecraft: true,
  disguiseToDiscord: true,
};

let cache = null;

function toState(row) {
  if (!row) return { ...OFF };

  return {
    mode: row.mode ?? "off",
    target: row.targetUserId
      ? {
          userId: row.targetUserId,
          name: row.targetName ?? "Unknown",
          avatarURL: row.targetAvatarUrl ?? null,
          mcName: row.targetMcName ?? null,
          mcUuid: row.targetMcUuid ?? null,
        }
      : null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).getTime() : null,
    startedBy: row.startedById ?? null,
    startedAt: row.startedAt ? new Date(row.startedAt).getTime() : null,
    testerIds: row.testerIds ?? [],
    testChannelIds: row.testChannelIds ?? [],
    excludedChannelIds: row.excludedChannelIds ?? [],
    disguiseToMinecraft: row.disguiseToMinecraft !== false,
    disguiseToDiscord: row.disguiseToDiscord !== false,
  };
}

/**
 * @returns {Promise<object>} The stored state, or the "off" defaults when there
 *   is no row, no database, or the read failed. Defaulting to off is the safe
 *   direction: a database blip must not start relabelling guild members.
 */
async function getState() {
  if (cache && Date.now() - cache.readAt < TTL_MS) return cache.state;

  const guildId = bridge.discordServerId;
  if (!guildId) return { ...OFF };

  const rows = await db.query(
    `SELECT "mode", "targetUserId", "targetName", "targetAvatarUrl", "targetMcName",
            "targetMcUuid", "startedById", "startedAt", "expiresAt", "testerIds",
            "testChannelIds", "excludedChannelIds", "disguiseToMinecraft",
            "disguiseToDiscord"
       FROM "GlobalProfileEffect"
      WHERE "guildId" = $1
      LIMIT 1`,
    [guildId],
  );

  if (rows === null) return cache?.state ?? { ...OFF };

  const state = toState(rows[0]);
  cache = { state, readAt: Date.now() };
  return state;
}

/**
 * Whether a global profile change is running right now.
 *
 * A lapsed effect reads as "not running" here without being cleared — the
 * community bot owns the row and clears it on its own next read. This side must
 * never write, so it checks the expiry itself rather than trusting `mode` alone.
 *
 * @returns {Promise<boolean>}
 */
async function isActive() {
  const state = await getState();
  if (state.mode === "off" || !state.target) return false;

  return state.expiresAt === null || Date.now() < state.expiresAt;
}

/**
 * @returns {Promise<object|null>} The identity everybody is currently being
 *   shown as.
 */
async function getTarget() {
  const state = await getState();
  return state.target ? { ...state.target } : null;
}

/**
 * The gate for a Discord message in the bridge channel.
 *
 * @param {string} userId Author of the message.
 * @param {string} channelId Channel the message was sent in.
 * @returns {Promise<boolean>}
 */
async function appliesTo(userId, channelId) {
  if (!(await isActive())) return false;

  const state = await getState();

  // They already wear that face; reposting would cost a send and a delete to
  // produce exactly the same message.
  if (userId === state.target.userId) return false;

  if (state.mode === "test") {
    return (
      state.testerIds.includes(userId) &&
      state.testChannelIds.includes(channelId)
    );
  }

  return !state.excludedChannelIds.includes(channelId);
}

/**
 * Whether the Discord → guild chat leg of the disguise is switched on.
 *
 * This governs the name guild chat is told, and nothing else. The Discord repost
 * still wears the target's face either way, so switching it off stops the
 * disguise at the bridge rather than turning it off outright.
 *
 * @returns {Promise<boolean>}
 */
async function disguisesToMinecraft() {
  return (await getState()).disguiseToMinecraft;
}

/**
 * The gate for guild chat → Discord.
 *
 * Test mode has no Discord author to check, so it leans on the account link:
 * only a tester's *own* Minecraft messages are rewritten. Without that, testing
 * would silently relabel guild members who never agreed to take part.
 *
 * @param {string} mcName The Minecraft name that spoke in guild chat.
 * @param {string} channelId The bridge channel the message is headed for.
 * @returns {Promise<boolean>}
 */
async function appliesToGuildChat(mcName, channelId) {
  if (!(await isActive())) return false;

  const state = await getState();
  if (!state.disguiseToDiscord) return false;

  const name = String(mcName ?? "").toLowerCase();

  if (state.target.mcName && state.target.mcName.toLowerCase() === name) {
    return false;
  }

  if (state.mode === "test") {
    if (!state.testChannelIds.includes(channelId)) return false;
    const link = await getLinkByName(mcName);
    return Boolean(link) && state.testerIds.includes(link.discordId);
  }

  return !state.excludedChannelIds.includes(channelId);
}

module.exports = {
  getState,
  getTarget,
  isActive,
  appliesTo,
  appliesToGuildChat,
  disguisesToMinecraft,
};
