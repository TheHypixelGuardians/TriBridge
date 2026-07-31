const guilds = require('./guilds');

// `!<tag> <body>`. The tag bounds match the registry's own TAG_PATTERN, and the
// separator is required whitespace so `!hello` (no space) is never read as a tag.
const TAG_PREFIX = /^!([A-Za-z0-9]{2,8})\s+([\s\S]+)$/;

/**
 * Works out which Hypixel guilds a bridge-channel message should reach.
 *
 * Rules, in order:
 *  - `!!anything` — escape hatch. The leading `!` is dropped and the rest is
 *    sent as ordinary text, so `!!sb hi` reaches guild chat as `!sb hi`.
 *  - `!sb hi` with a registered, enabled tag — that guild only, prefix stripped.
 *  - `!nope hi` — unrecognised tag. Broadcast **with the text untouched**, and
 *    report the tag so the caller can flag it. Silently dropping is the worst
 *    possible failure for a chat bridge: the sender believes it was delivered,
 *    and `!` is far too common in ordinary chat to reserve.
 *  - anything else — broadcast (or the default guild, when an admin has turned
 *    `broadcastByDefault` off in guildsConfig.json).
 *
 * @param {string} content Raw Discord message content.
 * @returns {{targets: object[], body: string, unknownTag: string|null}}
 */
function routeMessage(content) {
    const text = String(content ?? '');

    const fallback = () => {
        if (guilds.broadcastByDefault()) return guilds.getEnabled();
        const preferred = guilds.getDefault();
        return preferred ? [preferred] : [];
    };

    if (text.startsWith('!!')) {
        return {targets: fallback(), body: text.slice(1), unknownTag: null};
    }

    const match = text.match(TAG_PREFIX);
    if (match) {
        const guild = guilds.getByTag(match[1]);
        if (guild && guild.enabled !== false) {
            return {targets: [guild], body: match[2], unknownTag: null};
        }
        return {targets: fallback(), body: text, unknownTag: match[1]};
    }

    return {targets: fallback(), body: text, unknownTag: null};
}

module.exports = {routeMessage, TAG_PREFIX};
