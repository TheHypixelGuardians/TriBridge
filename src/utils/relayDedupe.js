const RECENT_TTL_MS = 2000;
const RECENT_LIMIT = 200;

/**
 * Builds a "has another guild's bot already handled this exact line?" check.
 *
 * Two accounts sitting in the same Hypixel guild — a misconfiguration — each see
 * every line in it, so without this every relay would fire twice: two embeds in
 * Discord, two copies forwarded to every other guild.
 *
 * A genuine false positive needs the same player name saying the same thing in
 * two *different* guilds within two seconds, which already implies either that
 * misconfiguration or a dual member — and in both cases the second copy is
 * noise.
 *
 * Each caller gets its own instance so one relay consuming a line never hides it
 * from the other; the map inside an instance is shared across every bot, which
 * is what lets one bot see what another just handled.
 *
 * @returns {(guildKey: string, username: string, content: string) => boolean}
 */
function createRelayDedupe() {
    const recentlyRelayed = new Map();

    return function isDuplicate(guildKey, username, content) {
        const now = Date.now();

        if (recentlyRelayed.size > RECENT_LIMIT) {
            for (const [key, entry] of recentlyRelayed) {
                if (now - entry.at > RECENT_TTL_MS) recentlyRelayed.delete(key);
            }
        }

        const signature = `${String(username).toLowerCase()}|${content}`;
        const previous = recentlyRelayed.get(signature);

        if (previous && previous.key !== guildKey && now - previous.at < RECENT_TTL_MS) {
            return true;
        }

        recentlyRelayed.set(signature, {key: guildKey, at: now});
        return false;
    };
}

module.exports = {createRelayDedupe, RECENT_TTL_MS, RECENT_LIMIT};
