const path = require("path");
const db = require("./db");
const store = require("./configStore");

/**
 * The bridge's own Minecraft account links, set with `/link` here.
 *
 * Kept apart from the THG community bot's links on purpose: the two bots share
 * the database and the blacklist and nothing else, so each has its own `/link`
 * and its own list. This one decides whose bridge messages are reposted with a
 * Minecraft head and name, and who counts as a tester in global profile test
 * mode.
 *
 * Stored in `tribridge.config` like the other settings, so every read is from
 * memory and the message path costs no query. A link made here is honoured on
 * the very next message, with no cache to wait out.
 */

const CONFIG_NAME = "linkedAccounts";

// The import source and the local snapshot of the database row — see
// configStore.js. Its format is the one the file had before linking moved,
// so an install that still has the file imports it on its first start.
const CONFIG_PATH = path.join(
  __dirname,
  "..",
  "..",
  "linkedAccountsConfig.json",
);

let cachedConfig = { links: {} };

function normalise(raw) {
  const links = {};
  for (const [discordId, link] of Object.entries(raw?.links ?? {})) {
    if (link?.uuid && link?.name) {
      links[discordId] = { uuid: String(link.uuid), name: String(link.name) };
    }
  }
  return { links };
}

/**
 * Reads the community bot's links once, to start the bridge's own list from.
 *
 * @returns {Promise<object|null>} A config document, or null when the community
 *   tables could not be read (absent, renamed or unreachable).
 */
async function readCommunityLinks() {
  const rows = await db.query(
    `SELECT u."discordId", l."uuid", l."name"
       FROM "MinecraftLink" l
       JOIN "User" u ON u."id" = l."userId"`,
  );
  if (rows === null) return null;

  const links = {};
  for (const row of rows) {
    links[row.discordId] = { uuid: row.uuid, name: row.name };
  }
  return normalise({ links });
}

/**
 * Loads the links from the database (or, with `{ fromSnapshot: true }`, from
 * the local snapshot). Must finish before anything reads them.
 *
 * On the very first start, with no stored list and no legacy file, the list is
 * copied once from the community bot's links so nobody has to link again on
 * the day the bridge got its own. It is saved even when that copy is empty, so
 * the copy never runs a second time: after it the two lists are independent.
 */
async function load(options) {
  const { data, stored } = await store.load(
    CONFIG_NAME,
    CONFIG_PATH,
    normalise,
    options,
  );
  cachedConfig = data;
  if (stored || options?.fromSnapshot) return;

  const seed = await readCommunityLinks();
  if (seed === null) return;

  await store.save(CONFIG_NAME, seed);
  cachedConfig = seed;
  console.log(
    `Started the bridge's own link list from the community bot's links ` +
      `(${Object.keys(seed.links).length}). From now on the two are independent.`,
  );
}

/**
 * @param {string} discordId
 * @returns {Promise<{uuid: string, name: string, discordId: string}|null>}
 *   Async for its callers' sake only: the lookup is a memory read.
 */
async function getLink(discordId) {
  const link = cachedConfig.links[discordId];
  return link ? { discordId, ...link } : null;
}

function findByName(mcName) {
  const target = String(mcName ?? "")
    .trim()
    .toLowerCase();
  if (!target) return null;

  for (const [discordId, link] of Object.entries(cachedConfig.links)) {
    if (link.name.toLowerCase() === target) return { discordId, ...link };
  }
  return null;
}

/**
 * Reverse lookup by Minecraft name, case-insensitively — Hypixel spells a name
 * however the player typed it.
 *
 * @param {string} mcName
 * @returns {Promise<{discordId: string, uuid: string, name: string}|null>}
 */
async function getLinkByName(mcName) {
  return findByName(mcName);
}

/**
 * Binds a Minecraft account to a Discord user, replacing any link that user
 * already had.
 *
 * One Minecraft account maps to at most one Discord user, so this refuses when
 * the account is already claimed by somebody else. Matched on the UUID as well
 * as the name: a renamed account is still the same account.
 *
 * @param {string} discordId
 * @param {{uuid: string, name: string}} profile
 * @returns {Promise<{ok: true, previous: {uuid: string, name: string}|null}|{ok: false, reason: 'taken', discordId: string}>}
 *   Rejects when the link could not be saved.
 */
async function setLink(discordId, profile) {
  return store.commit(
    CONFIG_NAME,
    () => cachedConfig,
    (draft) => {
      const uuid = profile.uuid.replace(/-/g, "").toLowerCase();
      const name = profile.name.toLowerCase();
      for (const [otherId, link] of Object.entries(draft.links)) {
        if (otherId === discordId) continue;
        const otherUuid = link.uuid.replace(/-/g, "").toLowerCase();
        if (otherUuid === uuid || link.name.toLowerCase() === name) {
          return { ok: false, reason: "taken", discordId: otherId };
        }
      }

      const previous = draft.links[discordId] ?? null;
      draft.links[discordId] = { uuid: profile.uuid, name: profile.name };
      return { ok: true, previous };
    },
    (saved) => {
      cachedConfig = saved;
    },
  );
}

/**
 * @param {string} discordId
 * @returns {Promise<{uuid: string, name: string}|null>} The removed link, or
 *   null if the user had none. Rejects when the change could not be saved.
 */
async function removeLink(discordId) {
  return store.commit(
    CONFIG_NAME,
    () => cachedConfig,
    (draft) => {
      const existing = draft.links[discordId] ?? null;
      delete draft.links[discordId];
      return existing;
    },
    (saved) => {
      cachedConfig = saved;
    },
  );
}

/**
 * @returns {Array<{discordId: string, uuid: string, name: string}>}
 */
function getAllLinks() {
  return Object.entries(cachedConfig.links).map(([discordId, link]) => ({
    discordId,
    ...link,
  }));
}

module.exports = {
  load,
  normalise,
  getLink,
  getLinkByName,
  setLink,
  removeLink,
  getAllLinks,
};
