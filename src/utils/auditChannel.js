const fs = require('fs');
const path = require('path');
const bridge = require('../bridge');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'auditChannelConfig.json');

let cachedConfig = null;

function loadConfig() {
    if (cachedConfig) return cachedConfig;
    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
        cachedConfig = JSON.parse(data);
    } catch {
        cachedConfig = {channelId: null};
    }
    return cachedConfig;
}

function saveConfig(config) {
    cachedConfig = config;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * The channel admin actions are recorded in.
 *
 * A Hypixel guild may override the destination for its own entries. Those
 * overrides live in `guildsConfig.json` rather than here, so removing a guild
 * cannot leave an orphaned channel setting behind.
 *
 * @param {string} [guildKey] Scope the lookup to one Hypixel guild.
 * @returns {string|null} Null when nothing is configured at either level.
 */
function getAuditChannelId(guildKey) {
    if (guildKey) {
        // Required lazily: guilds.js is loaded by modules that this one is
        // loaded by, and a top-level require would close the cycle.
        const guilds = require('./guilds');
        const scoped = guilds.get(guildKey)?.auditChannelId;
        if (scoped) return scoped;
    }
    return loadConfig().channelId ?? null;
}

/**
 * @param {string|null} channelId Pass null to stop recording.
 */
function setAuditChannelId(channelId) {
    saveConfig({channelId: channelId ?? null});
}

/**
 * Writes a line to the audit channel.
 *
 * Deliberately never throws and never reports failure to the caller: audit
 * entries accompany work that has already happened, and a misconfigured audit
 * channel must not take that work down with it.
 *
 * @param {string|import('discord.js').MessageCreateOptions} payload
 * @param {{guildKey?: string}} [options] Route to one Hypixel guild's audit
 *   channel when it has its own; otherwise the global one, as before.
 * @returns {Promise<boolean>} Whether the line landed.
 */
async function logAudit(payload, {guildKey} = {}) {
    const channelId = getAuditChannelId(guildKey);
    if (!channelId || !bridge.discordClient) return false;

    const options = typeof payload === 'string' ? {content: payload} : payload;

    try {
        const channel = await bridge.discordClient.channels.fetch(channelId);
        // Audit lines quote member-supplied names, so nothing in them may ping.
        await channel.send({allowedMentions: {parse: []}, ...options});
        return true;
    } catch (error) {
        console.error('Failed to write to the audit channel:', error);
        return false;
    }
}

module.exports = {getAuditChannelId, setAuditChannelId, logAudit};
