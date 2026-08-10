const {EmbedBuilder, MessageFlags, PermissionFlagsBits} = require('discord.js');
const {logAudit} = require('./auditChannel');
const {logGlobal} = require('./guildLog');
const {formatDuration} = require('./duration');
const {appliesTo, getTarget, disguisesToMinecraft} = require('./globalProfile');
const {getLink} = require('./linkedAccounts');
const {getRelayWebhook, clearRelayWebhook, resolveWebhookTarget} = require('./relayWebhook');

// Discord caps a webhook username at 80 characters and rejects any containing
// "discord" or "clyde".
const MAX_WEBHOOK_NAME = 80;
const MAX_CONTENT = 2000;

// U+200B. Written as an escape because an invisible character in the source is
// a trap for the next person to edit this file.
const ZERO_WIDTH_SPACE = '\u200b';

// Latched so a missing permission reports once instead of on every message.
let warnedAboutRepost = false;

// Reposts within a channel are chained: a burst that ran concurrently would
// arrive out of order, which is glaringly obvious in a busy channel.
const channelQueues = new Map();

function headURL(id) {
    return `https://mc-heads.net/avatar/${encodeURIComponent(id)}`;
}

async function warnAboutRepostOnce() {
    if (warnedAboutRepost) return;
    warnedAboutRepost = true;

    await logGlobal(
        '⚠️ Could not repost a message under another identity. Check that I have the ' +
        '**Manage Webhooks** and **Manage Messages** permissions in that channel. ' +
        'Falling back to normal relaying until this is fixed.',
    );
}

/**
 * Makes a name Discord will actually accept as a webhook username.
 *
 * The forbidden substrings are broken with a zero-width space rather than
 * stripped, so a member called "Discordian" still reads as themselves instead
 * of turning into "ian".
 *
 * @param {string} name
 * @returns {string}
 */
function sanitizeWebhookName(name) {
    const cleaned = String(name ?? '')
        .replace(/(d)(iscord)/gi, `$1${ZERO_WIDTH_SPACE}$2`)
        .replace(/(c)(lyde)/gi, `$1${ZERO_WIDTH_SPACE}$2`)
        .trim()
        .slice(0, MAX_WEBHOOK_NAME)
        .trim();

    return cleaned || 'Member';
}

/**
 * Whether a message has to be left alone because a webhook repost could not
 * reproduce it faithfully. Reposting these anyway silently drops the part that
 * mattered, so not touching them is the honest outcome.
 *
 * @param {import('discord.js').Message} message
 * @returns {boolean}
 */
function shouldSkip(message) {
    // Nothing a webhook can carry: the send would 400 and the message would be
    // left behind anyway, so don't spend the attempt.
    if (!message.content && message.attachments.size === 0) return true;

    return Boolean(
        message.system
        || message.stickers?.size
        || message.poll
        || message.messageSnapshots?.size
        || message.flags?.has(MessageFlags.IsVoiceMessage),
    );
}

/**
 * Whether the bot can do the delete-and-repost dance in a channel at all.
 *
 * Checked up front so a channel we have no business touching costs a cached
 * permission lookup rather than a failed API round trip on every message.
 *
 * @param {import('discord.js').GuildTextBasedChannel} channel
 * @returns {boolean}
 */
function canRepostIn(channel) {
    const target = resolveWebhookTarget(channel);
    if (!target) return false;

    const me = channel.guild?.members?.me;
    if (!me) return false;

    return Boolean(
        target.channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageWebhooks)
        && channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages),
    );
}

/**
 * Works out the name and avatar a message should be shown under.
 *
 * Precedence: an active global profile change outranks an account link, which
 * outranks the plain Discord author.
 *
 * `name`/`avatarURL` are what Discord shows; `chatName` is what guild chat is
 * told. They differ for a disguise, where Discord should show the target's
 * Discord identity but Hypixel is better served by a real Minecraft name.
 *
 * @param {import('discord.js').Message} message
 * @returns {{name: string, avatarURL: string|null, chatName: string, repost: boolean, disguised: boolean}}
 */
function resolveIdentity(message) {
    if (appliesTo(message.author.id, message.channel.id)) {
        const target = getTarget();
        const link = getLink(message.author.id);

        return {
            name: target.name,
            avatarURL: target.avatarURL,
            // The Discord → Minecraft leg can be switched off on its own: the
            // repost still wears the target's face in Discord, but guild chat
            // is told who really spoke.
            chatName: disguisesToMinecraft()
                ? target.mcName || target.name
                : link?.name || message.author.username,
            repost: true,
            disguised: true,
        };
    }

    const link = getLink(message.author.id);
    if (link) {
        return {
            name: link.name,
            avatarURL: headURL(link.uuid),
            chatName: link.name,
            repost: true,
            disguised: false,
        };
    }

    return {
        name: message.author.username,
        avatarURL: null,
        chatName: message.author.username,
        repost: false,
        disguised: false,
    };
}

/**
 * Builds the reposted message body.
 *
 * Deleting the original destroys Discord's native reply header, so a jump link
 * is the only surviving trace of what was being replied to.
 *
 * @param {import('discord.js').Message} message
 * @param {string} [contentOverride] Text to show instead of what was typed. The
 *   bridge channel passes the *routed* body here: a message beginning `!sb ` is
 *   sent to guild chat with the tag stripped, so a repost showing the tag would
 *   put different words in Discord than the ones the guild was given.
 * @returns {string|undefined}
 */
function buildContent(message, contentOverride) {
    const body = (contentOverride ?? message.content) || '';
    const referenced = message.reference?.messageId;

    if (!referenced) return body || undefined;

    const url = `https://discord.com/channels/${message.guildId}/${message.channelId}/${referenced}`;
    const combined = `-# ↩ [replying to a message](${url})\n${body}`.trim();

    return combined.length > MAX_CONTENT
        ? `${combined.slice(0, MAX_CONTENT - 1)}…`
        : combined;
}

/**
 * Serialises work per channel so reposts keep their original order.
 *
 * @param {string} channelId
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 * @template T
 */
function enqueue(channelId, task) {
    const previous = channelQueues.get(channelId) ?? Promise.resolve();

    // `.then(task, task)` so one failed repost does not stall the channel.
    const run = previous.then(task, task);
    const chained = run.catch(() => {});

    channelQueues.set(channelId, chained);
    chained.then(() => {
        // Drop the entry once nothing queued behind us, so idle channels do not
        // accumulate settled promises forever.
        if (channelQueues.get(channelId) === chained) channelQueues.delete(channelId);
    });

    return run;
}

async function sendRepost(message, identity, options) {
    const target = resolveWebhookTarget(message.channel);
    if (!target) return {ok: false, url: null, message: null};

    let sent;
    try {
        const webhook = await getRelayWebhook(target.channel);

        // Repost before deleting: if the webhook send throws, the user's
        // original message survives rather than vanishing.
        sent = await webhook.send({
            content: buildContent(message, options?.content),
            username: sanitizeWebhookName(identity.name),
            avatarURL: identity.avatarURL ?? undefined,
            files: [...message.attachments.values()].map((attachment) => attachment.url),
            threadId: target.threadId,
            // A webhook post is not subject to the author's own permissions, so
            // an unrestricted repost would let anyone ping @everyone.
            allowedMentions: {parse: ['users']},
        });
    } catch (error) {
        // The webhook may have been deleted out from under us; drop the cache
        // so the next message recreates it.
        clearRelayWebhook(target.channel.id);
        console.error('Failed to repost a message:', error);
        await warnAboutRepostOnce();
        return {ok: false, url: null, message: null};
    }

    try {
        await message.delete();
    } catch {
        // Already deleted, or missing Manage Messages; the repost still landed.
    }

    return {
        ok: true,
        url: sent?.id
            ? `https://discord.com/channels/${message.guildId}/${message.channelId}/${sent.id}`
            : null,
        message: sent ?? null,
    };
}

/**
 * Reposts a message through the relay webhook wearing the given identity, then
 * deletes the original.
 *
 * @param {import('discord.js').Message} message
 * @param {ReturnType<typeof resolveIdentity>} identity
 * @param {{content?: string}} [options] `content` replaces the body shown, for
 *   callers that rewrite the text before relaying it — see {@link buildContent}.
 * @returns {Promise<{ok: boolean, url: string|null, message: object|null}>} On
 *   failure the original message is left exactly where it was. `message` is the
 *   repost, so callers can mark up the copy that survived rather than the one
 *   that was just deleted.
 */
function repostAs(message, identity, options) {
    return enqueue(message.channel.id, () => sendRepost(message, identity, options));
}

/**
 * Records who really sent a disguised message. The original is gone, so this is
 * the only way back to the actual author.
 *
 * @param {import('discord.js').Message} message
 * @param {ReturnType<typeof resolveIdentity>} identity
 * @param {string|null} url Jump link to the repost.
 */
async function auditDisguise(message, identity, url) {
    const jump = url ? ` — [jump](${url})` : '';
    await logAudit(
        `🎭 <@${message.author.id}> (\`${message.author.username}\`) posted as ` +
        `**${identity.name}** in <#${message.channel.id}>${jump}`,
    );
}

/**
 * Records which Minecraft player really said something that reached Discord
 * under the target's name.
 *
 * @param {string} username The Minecraft name that spoke.
 * @param {string} shownAs The name it was relabelled to.
 * @param {string} [guildKey] Which Hypixel guild it came from, so the entry
 *   lands in that guild's own audit channel when it has one.
 */
async function auditGuildChatDisguise(username, shownAs, guildKey) {
    await logAudit(
        `🎭 Guild chat from \`${username}\` was shown as **${shownAs}** in the bridge channel`,
        {guildKey},
    );
}

/**
 * Names the bridge legs the disguise has been switched off for, so an effect
 * that only covers part of the bridge says so rather than looking broken.
 *
 * @param {object} state
 * @returns {string[]}
 */
function switchedOffLegs(state) {
    const legs = [];
    if (state.disguiseToMinecraft === false) legs.push('Discord → Minecraft');
    if (state.disguiseToDiscord === false) legs.push('Minecraft → Discord');
    return legs;
}

/**
 * @param {object} state The state {@link module:utils/globalProfile.start} returned.
 * @param {string} startedBy Discord ID of the admin who started it.
 */
async function announceStarted(state, startedBy) {
    const ends = state.expiresAt === null
        ? 'when somebody stops it'
        : `<t:${Math.floor(state.expiresAt / 1000)}:R>`;

    const off = switchedOffLegs(state);

    const embed = new EmbedBuilder()
        .setTitle('🎭 Global profile change started')
        .setDescription(
            state.mode === 'test'
                ? 'Running in **test mode** — only listed testers, in listed channels, are affected.'
                : 'Running **live** — everybody in the server is affected.',
        )
        .addFields(
            {name: 'Everyone appears as', value: `<@${state.target.userId}>`, inline: true},
            {name: 'Started by', value: `<@${startedBy}>`, inline: true},
            {name: 'Ends', value: ends, inline: true},
        )
        .setColor(0xE67E22)
        .setTimestamp();

    if (off.length > 0) {
        embed.addFields({
            name: 'Not disguised across',
            value: off.map((leg) => `\`${leg}\``).join(', '),
        });
    }

    await logAudit({embeds: [embed]});
}

/**
 * @param {object} previous What {@link module:utils/globalProfile.stop} returned.
 * @param {string} reason Short phrase describing why it ended.
 */
async function announceEnded(previous, reason) {
    const ran = previous.startedAt ? formatDuration(Date.now() - previous.startedAt) : 'unknown';

    const embed = new EmbedBuilder()
        .setTitle('🎭 Global profile change ended')
        .setDescription(`Everybody is back to their own name and avatar — ${reason}.`)
        .addFields(
            {
                name: 'Was appearing as',
                value: previous.target ? `<@${previous.target.userId}>` : 'unknown',
                inline: true,
            },
            {name: 'Ran for', value: ran, inline: true},
        )
        .setColor(0x2ECC71)
        .setTimestamp();

    await logAudit({embeds: [embed]});
}

module.exports = {
    resolveIdentity,
    repostAs,
    shouldSkip,
    canRepostIn,
    sanitizeWebhookName,
    auditDisguise,
    auditGuildChatDisguise,
    announceStarted,
    announceEnded,
};
