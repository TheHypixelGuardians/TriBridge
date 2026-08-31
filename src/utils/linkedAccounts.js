const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(
  __dirname,
  "..",
  "..",
  "linkedAccountsConfig.json",
);

let cachedConfig = null;

function loadConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const data = fs.readFileSync(CONFIG_PATH, "utf-8");
    cachedConfig = JSON.parse(data);
    if (!cachedConfig.links) cachedConfig.links = {};
  } catch {
    cachedConfig = { links: {} };
  }
  return cachedConfig;
}

function saveConfig(config) {
  cachedConfig = config;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * @param {string} discordId
 * @returns {{uuid: string, name: string}|null}
 */
function getLink(discordId) {
  return loadConfig().links[discordId] ?? null;
}

/**
 * Reverse lookup by Minecraft name, case-insensitive.
 *
 * @param {string} mcName
 * @returns {{discordId: string, uuid: string, name: string}|null}
 */
function getLinkByName(mcName) {
  const target = String(mcName ?? "").toLowerCase();
  const links = loadConfig().links;

  for (const [discordId, link] of Object.entries(links)) {
    if (link.name.toLowerCase() === target) {
      return { discordId, ...link };
    }
  }
  return null;
}

/**
 * Binds a Minecraft account to a Discord user.
 *
 * One Minecraft account maps to at most one Discord user, so this refuses when
 * the account is already claimed by somebody else.
 *
 * @param {string} discordId
 * @param {{uuid: string, name: string}} profile
 * @returns {{ok: true}|{ok: false, reason: 'taken', discordId: string}}
 */
function setLink(discordId, profile) {
  const existing = getLinkByName(profile.name);
  if (existing && existing.discordId !== discordId) {
    return { ok: false, reason: "taken", discordId: existing.discordId };
  }

  const config = loadConfig();
  config.links[discordId] = { uuid: profile.uuid, name: profile.name };
  saveConfig(config);
  return { ok: true };
}

/**
 * @param {string} discordId
 * @returns {{uuid: string, name: string}|null} The removed link, or null if
 *   the user had none.
 */
function removeLink(discordId) {
  const config = loadConfig();
  const existing = config.links[discordId];
  if (!existing) return null;

  delete config.links[discordId];
  saveConfig(config);
  return existing;
}

/**
 * @returns {Array<{discordId: string, uuid: string, name: string}>}
 */
function getAllLinks() {
  return Object.entries(loadConfig().links).map(([discordId, link]) => ({
    discordId,
    ...link,
  }));
}

module.exports = { getLink, getLinkByName, setLink, removeLink, getAllLinks };
