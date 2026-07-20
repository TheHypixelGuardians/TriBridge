const fs = require('fs');
const path = require('path');
const {EmbedBuilder} = require('discord.js');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'featureRequestsConfig.json');

const STATUS_COLORS = {
    pending: 0x5865F2,
    planned: 0xF1C40F,
    accepted: 0x2ECC71,
    denied: 0xE74C3C,
    duplicate: 0x95A5A6,
};

const STATUS_LABELS = {
    pending: '⏳ Pending',
    planned: '📌 Planned',
    accepted: '✅ Accepted',
    denied: '❌ Denied',
    duplicate: '🔁 Duplicate',
};

let cachedConfig = null;

function loadConfig() {
    if (cachedConfig) return cachedConfig;
    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
        cachedConfig = JSON.parse(data);
        if (!cachedConfig.requests) cachedConfig.requests = {};
        if (!cachedConfig.nextId) cachedConfig.nextId = 1;
        if (cachedConfig.channelId === undefined) cachedConfig.channelId = null;
    } catch {
        cachedConfig = {channelId: null, nextId: 1, requests: {}};
    }
    return cachedConfig;
}

function saveConfig(config) {
    cachedConfig = config;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * @returns {string|null} The channel feature requests are posted to.
 */
function getRequestChannelId() {
    return loadConfig().channelId;
}

/**
 * @param {string} channelId
 */
function setRequestChannelId(channelId) {
    const config = loadConfig();
    config.channelId = channelId;
    saveConfig(config);
}

/**
 * Reserves the next request ID and persists the record before it is posted.
 *
 * Persisting first is deliberate: the caller awaits a channel send afterwards,
 * and two concurrent submits reading `nextId` across that await would collide.
 * A failed send only burns an ID, which is harmless.
 *
 * @param {{userId: string, userTag: string, title: string, description: string}} submission
 * @returns {object} The stored record.
 */
function createRequest({userId, userTag, title, description}) {
    const config = loadConfig();
    const id = config.nextId;
    config.nextId = id + 1;

    const now = Date.now();
    config.requests[String(id)] = {
        id,
        userId,
        userTag,
        title,
        description,
        channelId: null,
        messageId: null,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        handledBy: null,
    };

    saveConfig(config);
    return config.requests[String(id)];
}

/**
 * Records where a request ended up once it has been posted.
 *
 * @param {number} id
 * @param {string} channelId
 * @param {string} messageId
 */
function attachMessage(id, channelId, messageId) {
    const config = loadConfig();
    const record = config.requests[String(id)];
    if (!record) return;

    record.channelId = channelId;
    record.messageId = messageId;
    saveConfig(config);
}

/**
 * @param {number} id
 * @returns {object|null}
 */
function getRequest(id) {
    return loadConfig().requests[String(id)] ?? null;
}

/**
 * @param {number} id
 * @param {string} status One of the keys of STATUS_LABELS.
 * @param {string} handledBy Discord ID of the admin who set the status.
 * @returns {object|null} The updated record, or null if no such request.
 */
function setStatus(id, status, handledBy) {
    const config = loadConfig();
    const record = config.requests[String(id)];
    if (!record) return null;

    record.status = status;
    record.handledBy = handledBy;
    record.updatedAt = Date.now();
    saveConfig(config);
    return record;
}

/**
 * Renders a request record as its channel embed. Both the initial post and
 * every status edit go through this, so the stored record stays the single
 * source of truth for what the message shows.
 *
 * @param {object} record
 * @returns {EmbedBuilder}
 */
function buildRequestEmbed(record) {
    const quoted = record.description.split('\n').join('\n> ');

    return new EmbedBuilder()
        .setTitle(`💡 Request #${record.id} — ${record.title}`)
        .setDescription(`> ${quoted}`)
        .addFields(
            {name: 'Submitted by', value: `<@${record.userId}>`, inline: true},
            {name: 'Status', value: STATUS_LABELS[record.status], inline: true},
        )
        .setColor(STATUS_COLORS[record.status])
        .setFooter({text: `Request #${record.id}`})
        .setTimestamp(record.createdAt);
}

module.exports = {
    STATUS_COLORS,
    STATUS_LABELS,
    getRequestChannelId,
    setRequestChannelId,
    createRequest,
    attachMessage,
    getRequest,
    setStatus,
    buildRequestEmbed,
};
