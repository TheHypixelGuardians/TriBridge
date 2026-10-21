const path = require("path");
const store = require("./configStore");

/**
 * The bridge's bot-admin roles, set with `/adminrole` here.
 *
 * Kept apart from the THG community bot's admin roles on purpose: the two bots
 * share the database and the blacklist and nothing else, so being staff on one
 * does not make anyone staff on the other.
 *
 * Stored in `tribridge.config` like the other settings and read from memory, so
 * a role added or removed takes effect on the next command.
 */

const CONFIG_NAME = "adminRoles";

// The import source and the local snapshot of the database row — see
// configStore.js. Its format is the one the file had before admin roles moved,
// so an install that still has the file imports it on its first start.
const CONFIG_PATH = path.join(__dirname, "..", "..", "adminRolesConfig.json");

let cachedConfig = { roleIds: [] };

function normalise(raw) {
  const roleIds = Array.isArray(raw?.roleIds) ? raw.roleIds.map(String) : [];
  return { roleIds: [...new Set(roleIds)] };
}

/**
 * Loads the roles from the database (or, with `{ fromSnapshot: true }`, from
 * the local snapshot). Must finish before anything reads them.
 */
async function load(options) {
  ({ data: cachedConfig } = await store.load(
    CONFIG_NAME,
    CONFIG_PATH,
    normalise,
    options,
  ));
}

/**
 * @returns {string[]}
 */
function getRoles() {
  return [...cachedConfig.roleIds];
}

/**
 * @param {string} roleId
 * @returns {Promise<boolean>} False when the role was already listed. Rejects
 *   when the change could not be saved.
 */
async function addRole(roleId) {
  return store.commit(
    CONFIG_NAME,
    () => cachedConfig,
    (draft) => {
      if (draft.roleIds.includes(roleId)) return false;
      draft.roleIds.push(roleId);
      return true;
    },
    (saved) => {
      cachedConfig = saved;
    },
  );
}

/**
 * @param {string} roleId
 * @returns {Promise<boolean>} False when the role was not listed. Rejects when
 *   the change could not be saved.
 */
async function removeRole(roleId) {
  return store.commit(
    CONFIG_NAME,
    () => cachedConfig,
    (draft) => {
      const index = draft.roleIds.indexOf(roleId);
      if (index === -1) return false;
      draft.roleIds.splice(index, 1);
      return true;
    },
    (saved) => {
      cachedConfig = saved;
    },
  );
}

/**
 * Whether a member holds a bot-admin role.
 *
 * **Fails closed.** A member with no roles, or an install with no admin roles
 * set yet, is not an admin. Failing open would hand `/send` — arbitrary
 * commands typed as the Minecraft account — to anybody.
 *
 * @param {import('discord.js').GuildMember} member
 * @returns {Promise<boolean>} Async so callers keep the `await` that guards
 *   against a bare (always truthy) promise, should this ever read the database
 *   again.
 */
async function isAdmin(member) {
  if (!member?.roles?.cache) return false;

  const roleIds = cachedConfig.roleIds;
  if (roleIds.length === 0) return false;

  return member.roles.cache.some((role) => roleIds.includes(role.id));
}

module.exports = {
  load,
  normalise,
  getRoles,
  addRole,
  removeRole,
  isAdmin,
};
