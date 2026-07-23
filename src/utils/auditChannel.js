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
 * @returns {string|null} The channel admin actions are recorded in, or null
 *   when none is configured.
 */
function getAuditChannelId() {
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
 * @returns {Promise<boolean>} Whether the line landed.
 */
async function logAudit(payload) {
    const channelId = getAuditChannelId();
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
