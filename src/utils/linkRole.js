const fs = require('fs');
const path = require('path');
const {PermissionFlagsBits} = require('discord.js');
const bridge = require('../bridge');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'linkRoleConfig.json');

let cachedConfig = null;

function loadConfig() {
    if (cachedConfig) return cachedConfig;
    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
        cachedConfig = JSON.parse(data);
    } catch {
        cachedConfig = {roleId: null};
    }
    return cachedConfig;
}

function saveConfig(config) {
    cachedConfig = config;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * @returns {string|null} The role granted to users with a linked Minecraft
 *   account, or null when the feature is not configured.
 */
function getLinkRoleId() {
    return loadConfig().roleId ?? null;
}

/**
 * @param {string|null} roleId Pass null to turn the feature off. Changing the
 *   role deliberately leaves the previous one on members — see CHANGELOG.
 */
function setLinkRoleId(roleId) {
    saveConfig({roleId: roleId ?? null});
}

/**
 * Resolves a Discord user id to a member of the guild this bot serves.
 *
 * Fetches by id rather than sweeping the roster: `guild.members.fetch()` with
 * no argument goes over the gateway and needs the privileged GuildMembers
 * intent, which this bot does not request. A single-id fetch is a plain REST
 * call and works without it.
 *
 * @param {string} userId
 * @returns {Promise<import('discord.js').GuildMember|null>} null when the user
 *   is not in the guild (left, or never joined).
 */
async function resolveMember(userId) {
    if (!bridge.discordClient || !bridge.guildId) return null;

    try {
        const guild = await bridge.discordClient.guilds.fetch(bridge.guildId);
        return await guild.members.fetch(userId);
    } catch {
        return null;
    }
}

/**
 * Adds or removes the configured link role on a member.
 *
 * Never throws: role changes fail for mundane reasons (role deleted, bot
 * demoted below it, Manage Roles revoked) and none of those should abort the
 * link itself, which is the part the user actually asked for.
 *
 * @param {import('discord.js').GuildMember} member
 * @param {'add'|'remove'} action
 * @returns {Promise<{ok: true, changed: boolean}|{ok: false, reason: 'unconfigured'|'missing-role'|'forbidden'|'error', error?: Error}>}
 *   `changed` is false when the member already had (or already lacked) the role.
 */
async function applyLinkRole(member, action) {
    const roleId = getLinkRoleId();
    if (!roleId) return {ok: false, reason: 'unconfigured'};

    const role = member.guild.roles.cache.get(roleId)
        ?? await member.guild.roles.fetch(roleId).catch(() => null);
    if (!role) return {ok: false, reason: 'missing-role'};

    const has = member.roles.cache.has(roleId);
    if (action === 'add' ? has : !has) return {ok: true, changed: false};

    const me = member.guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)
        || role.comparePositionTo(me.roles.highest) >= 0
        || role.managed) {
        return {ok: false, reason: 'forbidden'};
    }

    try {
        if (action === 'add') {
            await member.roles.add(role, 'Linked a Minecraft account.');
        } else {
            await member.roles.remove(role, 'Unlinked their Minecraft account.');
        }
        return {ok: true, changed: true};
    } catch (error) {
        return {ok: false, reason: 'error', error};
    }
}

/**
 * @param {string} userId
 * @returns {Promise<ReturnType<typeof applyLinkRole>|{ok: false, reason: 'no-member'}>}
 */
async function applyLinkRoleById(userId, action) {
    if (!getLinkRoleId()) return {ok: false, reason: 'unconfigured'};

    const member = await resolveMember(userId);
    if (!member) return {ok: false, reason: 'no-member'};

    return applyLinkRole(member, action);
}

/**
 * Turns a failed {@link applyLinkRole} result into something worth putting in
 * the log channel, or null when the failure is not worth reporting.
 *
 * @param {{reason: string, error?: Error}} result
 * @returns {string|null}
 */
function describeFailure(result) {
    switch (result.reason) {
        case 'unconfigured':
        case 'no-member':
            return null;
        case 'missing-role':
            return 'the configured link role no longer exists — set a new one with `/linkrole set`';
        case 'forbidden':
            return 'I need **Manage Roles** and a role ranked above the link role';
        default:
            return `an unexpected error occurred: ${result.error?.message ?? 'unknown'}`;
    }
}

module.exports = {
    getLinkRoleId,
    setLinkRoleId,
    resolveMember,
    applyLinkRole,
    applyLinkRoleById,
    describeFailure,
};
