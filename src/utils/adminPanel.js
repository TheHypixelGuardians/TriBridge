const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    EmbedBuilder,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
} = require('discord.js');
const {getAuditChannelId} = require('./auditChannel');
const {formatDuration} = require('./duration');
const {getState, isActive} = require('./globalProfile');

// Custom ID format: panel:{view}:{action}:{invokerId}. Four fixed parts keeps
// parsing trivial and leaves plenty of room under Discord's 100-char limit.
const PREFIX = 'panel';

const MAX_FIELD_LENGTH = 1024;

// Discord allows at most 25 preselected values on a select menu.
const MAX_DEFAULTS = 25;

// A half-filled form cannot ride along in the next custom ID, so it lives here
// between clicks. Losing it to a restart costs the admin one re-pick.
const DRAFT_TTL = 15 * 60 * 1000;
const drafts = new Map();

const DURATION_CHOICES = [
    {label: '5 minutes', value: '5m', ms: 5 * 60_000},
    {label: '15 minutes', value: '15m', ms: 15 * 60_000},
    {label: '30 minutes', value: '30m', ms: 30 * 60_000},
    {label: '1 hour', value: '1h', ms: 60 * 60_000},
    {label: '3 hours', value: '3h', ms: 3 * 60 * 60_000},
    {label: '6 hours', value: '6h', ms: 6 * 60 * 60_000},
    {label: '12 hours', value: '12h', ms: 12 * 60 * 60_000},
    {label: '24 hours', value: '24h', ms: 24 * 60 * 60_000},
    {label: 'Until stopped', value: 'indefinite', ms: null},
    {label: 'Custom…', value: 'custom', ms: undefined},
];

const SCOPE_CHANNEL_TYPES = [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.GuildVoice,
];

/**
 * @param {string} view
 * @param {string} action
 * @param {string} invokerId
 * @returns {string}
 */
function customId(view, action, invokerId) {
    return `${PREFIX}:${view}:${action}:${invokerId}`;
}

/**
 * @param {string} raw
 * @returns {{view: string, action: string, invokerId: string}|null}
 */
function parseCustomId(raw) {
    const parts = String(raw ?? '').split(':');
    if (parts.length !== 4 || parts[0] !== PREFIX) return null;

    return {view: parts[1], action: parts[2], invokerId: parts[3]};
}

function pruneDrafts() {
    const now = Date.now();
    for (const [userId, draft] of drafts) {
        if (now - draft.touched >= DRAFT_TTL) drafts.delete(userId);
    }
}

/**
 * @param {string} userId
 * @returns {{targetId: string|null, duration: {value: string, ms: number|null}|undefined, touched: number}}
 *   `duration` is undefined until one is picked; `duration.ms` of null means
 *   "run until stopped".
 */
function getDraft(userId) {
    pruneDrafts();

    let draft = drafts.get(userId);
    if (!draft) {
        draft = {targetId: null, duration: undefined, touched: Date.now()};
        drafts.set(userId, draft);
    }

    draft.touched = Date.now();
    return draft;
}

function clearDraft(userId) {
    drafts.delete(userId);
}

/**
 * Renders a list of IDs as mentions, trimmed to fit an embed field.
 */
function formatIdList(ids, render, empty) {
    if (ids.length === 0) return empty;

    const pieces = [];
    let length = 0;

    for (const [index, id] of ids.entries()) {
        const piece = render(id);
        if (length + piece.length + 2 > MAX_FIELD_LENGTH - 20) {
            pieces.push(`… +${ids.length - index} more`);
            break;
        }
        pieces.push(piece);
        length += piece.length + 2;
    }

    return pieces.join(', ');
}

function describeMode(mode) {
    if (mode === 'test') return '🧪 Test';
    if (mode === 'live') return '🌍 Live';
    return 'Off';
}

function describeEnd(expiresAt) {
    return expiresAt === null ? 'When stopped' : `<t:${Math.floor(expiresAt / 1000)}:R>`;
}

/**
 * The panel's front page: what is running, and how the feature is scoped.
 */
function buildMainEmbed() {
    const state = getState();
    const running = isActive();
    const auditChannelId = getAuditChannelId();
    const fields = [];

    if (running) {
        fields.push(
            {name: 'Mode', value: describeMode(state.mode), inline: true},
            {name: 'Everyone appears as', value: `<@${state.target.userId}>`, inline: true},
            {name: 'Ends', value: describeEnd(state.expiresAt), inline: true},
            {name: 'Started by', value: `<@${state.startedBy}>`, inline: true},
        );
    }

    fields.push(
        {
            name: 'Testers',
            value: formatIdList(state.testerIds, (id) => `<@${id}>`, '*nobody*'),
        },
        {
            name: 'Test channels',
            value: formatIdList(state.testChannelIds, (id) => `<#${id}>`, '*none*'),
        },
        {
            name: 'Excluded channels (live mode)',
            value: formatIdList(state.excludedChannelIds, (id) => `<#${id}>`, '*none*'),
        },
        {
            name: 'Audit channel',
            value: auditChannelId
                ? `<#${auditChannelId}>`
                : '⚠️ none — set one with `/auditchannel set`',
        },
    );

    return new EmbedBuilder()
        .setTitle('🛠️ Admin Panel')
        .setDescription(
            running
                ? '🎭 **Global Profile Change is running.**'
                : 'No admin function is running right now.',
        )
        .addFields(fields)
        .setColor(running ? 0xE67E22 : 0xBD93F9)
        .setTimestamp();
}

function buildMainRows(invokerId) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(customId('main', 'profile', invokerId))
                .setLabel('Global Profile')
                .setEmoji('🎭')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(customId('main', 'stop', invokerId))
                .setLabel('Stop effect')
                .setEmoji('⏹️')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(!isActive()),
            new ButtonBuilder()
                .setCustomId(customId('main', 'refresh', invokerId))
                .setLabel('Refresh')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary),
        ),
    ];
}

function describeDuration(duration) {
    if (!duration) return '*not chosen*';
    if (duration.ms === null) return 'Until stopped';
    return formatDuration(duration.ms);
}

/**
 * The Global Profile Change configuration view.
 */
function buildProfileEmbed(draft) {
    const state = getState();

    return new EmbedBuilder()
        .setTitle('🎭 Global Profile Change')
        .setDescription(
            'While this runs, everybody\'s messages are reposted wearing the target\'s name ' +
            'and avatar, in Discord and across the Minecraft bridge.\n' +
            '> The original message is deleted and reposted, so it cannot be edited or ' +
            'deleted by its author afterwards. Every repost is recorded in the audit channel.',
        )
        .addFields(
            {
                name: 'Target',
                value: draft.targetId ? `<@${draft.targetId}>` : '*not chosen*',
                inline: true,
            },
            {name: 'Duration', value: describeDuration(draft.duration), inline: true},
            {
                name: '🧪 Test mode affects',
                value: `${state.testerIds.length} tester(s) in ${state.testChannelIds.length} channel(s)`,
            },
            {
                name: '🌍 Live mode affects',
                value: `Everybody, everywhere except ${state.excludedChannelIds.length} excluded channel(s)`,
            },
        )
        .setColor(0xBD93F9);
}

function buildProfileRows(invokerId, draft) {
    const targetSelect = new UserSelectMenuBuilder()
        .setCustomId(customId('profile', 'target', invokerId))
        .setPlaceholder('Who should everybody look like?')
        .setMinValues(1)
        .setMaxValues(1);

    if (draft.targetId) targetSelect.setDefaultUsers(draft.targetId);

    const durationSelect = new StringSelectMenuBuilder()
        .setCustomId(customId('profile', 'duration', invokerId))
        .setPlaceholder('How long should it last?')
        .addOptions(
            DURATION_CHOICES.map((choice) => ({
                label: choice.label,
                value: choice.value,
                default: draft.duration?.value === choice.value,
            })),
        );

    return [
        new ActionRowBuilder().addComponents(targetSelect),
        new ActionRowBuilder().addComponents(durationSelect),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(customId('profile', 'startTest', invokerId))
                .setLabel('Start in test mode')
                .setEmoji('🧪')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(customId('profile', 'startLive', invokerId))
                .setLabel('Start live')
                .setEmoji('🌍')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(customId('profile', 'scope', invokerId))
                .setLabel('Testers & channels')
                .setEmoji('⚙️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(customId('profile', 'back', invokerId))
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary),
        ),
    ];
}

/**
 * The tester and channel allowlists — the test system's whole configuration.
 */
function buildScopeEmbed() {
    const state = getState();

    return new EmbedBuilder()
        .setTitle('⚙️ Testers & channels')
        .setDescription(
            '**Test mode** only rewrites a listed tester posting in a listed channel — and, ' +
            'over the bridge, only guild chat from a tester\'s own linked Minecraft account.\n' +
            '**Live mode** ignores both lists and rewrites everybody, except in the excluded ' +
            'channels.',
        )
        .addFields(
            {
                name: 'Testers',
                value: formatIdList(state.testerIds, (id) => `<@${id}>`, '*nobody*'),
            },
            {
                name: 'Test channels',
                value: formatIdList(state.testChannelIds, (id) => `<#${id}>`, '*none*'),
            },
            {
                name: 'Excluded channels (live mode)',
                value: formatIdList(state.excludedChannelIds, (id) => `<#${id}>`, '*none*'),
            },
        )
        .setColor(0xBD93F9);
}

function buildScopeRows(invokerId) {
    const state = getState();

    const testerSelect = new UserSelectMenuBuilder()
        .setCustomId(customId('scope', 'testers', invokerId))
        .setPlaceholder('Testers')
        .setMinValues(0)
        .setMaxValues(MAX_DEFAULTS);

    const testChannelSelect = new ChannelSelectMenuBuilder()
        .setCustomId(customId('scope', 'testChannels', invokerId))
        .setPlaceholder('Test channels')
        .setChannelTypes(SCOPE_CHANNEL_TYPES)
        .setMinValues(0)
        .setMaxValues(MAX_DEFAULTS);

    const excludedSelect = new ChannelSelectMenuBuilder()
        .setCustomId(customId('scope', 'excludedChannels', invokerId))
        .setPlaceholder('Channels to exclude in live mode')
        .setChannelTypes(SCOPE_CHANNEL_TYPES)
        .setMinValues(0)
        .setMaxValues(MAX_DEFAULTS);

    // Preselecting more than Discord allows is rejected outright, so anything
    // past the cap is simply not shown as selected — the stored list is intact.
    if (state.testerIds.length > 0) {
        testerSelect.setDefaultUsers(state.testerIds.slice(0, MAX_DEFAULTS));
    }
    if (state.testChannelIds.length > 0) {
        testChannelSelect.setDefaultChannels(state.testChannelIds.slice(0, MAX_DEFAULTS));
    }
    if (state.excludedChannelIds.length > 0) {
        excludedSelect.setDefaultChannels(state.excludedChannelIds.slice(0, MAX_DEFAULTS));
    }

    return [
        new ActionRowBuilder().addComponents(testerSelect),
        new ActionRowBuilder().addComponents(testChannelSelect),
        new ActionRowBuilder().addComponents(excludedSelect),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(customId('scope', 'back', invokerId))
                .setLabel('Back')
                .setStyle(ButtonStyle.Secondary),
        ),
    ];
}

/**
 * @param {string} invokerId
 * @returns {{embeds: EmbedBuilder[], components: ActionRowBuilder[]}}
 */
function mainView(invokerId) {
    return {embeds: [buildMainEmbed()], components: buildMainRows(invokerId)};
}

function profileView(invokerId) {
    const draft = getDraft(invokerId);
    return {embeds: [buildProfileEmbed(draft)], components: buildProfileRows(invokerId, draft)};
}

function scopeView(invokerId) {
    return {embeds: [buildScopeEmbed()], components: buildScopeRows(invokerId)};
}

module.exports = {
    DURATION_CHOICES,
    customId,
    parseCustomId,
    getDraft,
    clearDraft,
    mainView,
    profileView,
    scopeView,
};
