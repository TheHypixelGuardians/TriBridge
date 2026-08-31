const guilds = require("./guilds");

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
 * `body` is what should be sent *and* what should be shown: a reposted message
 * has to display the same text guild chat was given, or Discord and the guild
 * disagree about what was said.
 *
 * `targeted` says a recognised tag picked the guilds out, which is the
 * difference between "one guild was busy" and "the sender aimed at one guild
 * and hit nothing" — only the latter is worth telling them about.
 *
 * `candidates` narrows every rule above to a subset of the registry, for a
 * channel that serves only some guilds — an officer channel two guilds share.
 * A tag outside the subset is an unknown tag there, not a way to reach a guild
 * the channel was never wired to.
 *
 * @param {string} content Raw Discord message content.
 * @param {{candidates?: object[]}} [options]
 * @returns {{targets: object[], body: string, unknownTag: string|null, targeted: boolean}}
 */
function routeMessage(content, options = {}) {
  const text = String(content ?? "");
  const scope = options.candidates ?? guilds.getEnabled();

  const fallback = () => {
    if (guilds.broadcastByDefault()) return scope;
    const preferred = guilds.getDefault();
    const named = preferred && scope.find((g) => g.key === preferred.key);
    // The default guild may not serve this channel; fall back to something in
    // scope rather than to nothing, so a message is never silently dropped.
    return named ? [named] : scope.slice(0, 1);
  };

  const byTag = (tag) => {
    const wanted = String(tag).toLowerCase();
    return scope.find((g) => String(g.tag).toLowerCase() === wanted) ?? null;
  };

  if (text.startsWith("!!")) {
    return {
      targets: fallback(),
      body: text.slice(1),
      unknownTag: null,
      targeted: false,
    };
  }

  const match = text.match(TAG_PREFIX);
  if (match) {
    const guild = byTag(match[1]);
    if (guild && guild.enabled !== false) {
      return {
        targets: [guild],
        body: match[2],
        unknownTag: null,
        targeted: true,
      };
    }
    return {
      targets: fallback(),
      body: text,
      unknownTag: match[1],
      targeted: false,
    };
  }

  return { targets: fallback(), body: text, unknownTag: null, targeted: false };
}

module.exports = { routeMessage, TAG_PREFIX };
