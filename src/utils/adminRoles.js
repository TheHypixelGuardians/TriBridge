const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'adminRolesConfig.json');

let cachedConfig = null;

function loadConfig() {
    if (cachedConfig) return cachedConfig;
    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
        cachedConfig = JSON.parse(data);
    } catch {
        cachedConfig = {roleIds: []};
    }
    return cachedConfig;
}

function saveConfig(config) {
    cachedConfig = config;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function addRole(roleId) {
    const config = loadConfig();
    if (config.roleIds.includes(roleId)) {
        return false;
    }
    config.roleIds.push(roleId);
    saveConfig(config);
    return true;
}

function removeRole(roleId) {
    const config = loadConfig();
    const index = config.roleIds.indexOf(roleId);
    if (index === -1) {
        return false;
    }
    config.roleIds.splice(index, 1);
    saveConfig(config);
    return true;
}

function getRoles() {
    return loadConfig().roleIds;
}

function isAdmin(member) {
    const roleIds = getRoles();
    return member.roles.cache.some((role) => roleIds.includes(role.id));
}

module.exports = {addRole, removeRole, getRoles, isAdmin};
