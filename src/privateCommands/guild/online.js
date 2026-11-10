const guilds = require("../../utils/guilds");
const mcBots = require("../../utils/mcBots");
const { fetchOnline } = require("../../utils/guildOnline");
const { MAX_PACKETS } = require("../../utils/privateReply");

/** Packets of names per page of a single guild's list; one more is the header. */
const NAME_PACKETS_PER_PAGE = MAX_PACKETS - 1;

/**
 * Every online name, highest rank first, as Hypixel lists them.
 *
 * @param {Map<string, string[]>} ranks
 * @returns {string[]}
 */
function flatten(ranks) {
  return [...ranks.values()].flat();
}

/**
 * Packs names into lines no longer than `budget`.
 *
 * @param {string[]} names
 * @param {number} budget
 * @returns {string[]}
 */
function packNames(names, budget) {
  const lines = [];
  let current = "";
  for (const name of names) {
    const next = current ? `${current}, ${name}` : name;
    if (next.length > budget && current) {
      lines.push(current);
      current = name;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * One guild on one line: `[SB] 12: Notch, jeb_, ... +4`.
 *
 * @param {object} guild
 * @param {string[]} names
 * @param {number} budget
 * @returns {string}
 */
function summaryLine(guild, names, budget) {
  const head = `[${guild.tag}] ${names.length}`;
  if (names.length === 0) return `${head}: nobody`;

  let shown = names.length;
  for (;;) {
    const rest = names.length - shown;
    const line =
      `${head}: ${names.slice(0, shown).join(", ")}` +
      (rest ? ` +${rest}` : "");
    if (line.length <= budget || shown === 1) return line;
    shown--;
  }
}

/**
 * @param {object} guild
 * @returns {Promise<{ok: true, names: string[]}|{ok: false, text: string}>}
 */
async function namesFor(guild) {
  if (!mcBots.isConnected(guild.key)) {
    return { ok: false, text: `[${guild.tag}] bot offline` };
  }
  const online = await fetchOnline(mcBots.getRecord(guild.key));
  if (!online.ok) {
    return {
      ok: false,
      text:
        online.reason === "busy"
          ? `[${guild.tag}] busy, try again shortly`
          : `[${guild.tag}] no answer right now`,
    };
  }
  return { ok: true, names: flatten(online.ranks) };
}

module.exports = {
  name: "online",
  aliases: ["o", "on"],
  description: "Who is online in every guild, or the full list for one guild.",
  usage: "!online [tag] [page]",
  cooldownMs: 10_000,

  run: async (ctx) => {
    const enabled = guilds.getEnabled();
    if (enabled.length === 0) return ctx.reply("No guilds are bridged yet.");

    const [first, second] = ctx.args;
    let target = null;
    let page = 1;

    if (first && /^\d+$/.test(first)) {
      page = Number(first);
    } else if (first) {
      // Matched against the enabled guilds only, by tag, key or name.
      const wanted = first.toLowerCase();
      target =
        enabled.find((g) => g.tag.toLowerCase() === wanted) ??
        enabled.find((g) => g.key === wanted) ??
        enabled.find((g) => g.name.toLowerCase() === wanted) ??
        null;
      if (!target) {
        return ctx.reply(
          `No bridged guild called ${first}. Tags: ${enabled.map((g) => g.tag).join(", ")}.`,
        );
      }
      page = Number(second) || 1;
    }

    // A single guild has nothing to summarise: show its list straight away.
    if (!target && enabled.length === 1) target = enabled[0];

    if (target) {
      const result = await namesFor(target);
      if (!result.ok) return ctx.reply(result.text);

      const lines = packNames(result.names, ctx.lineBudget);
      const pages = Math.max(
        1,
        Math.ceil(lines.length / NAME_PACKETS_PER_PAGE),
      );
      const current = Math.min(Math.max(page, 1), pages);
      const slice = lines.slice(
        (current - 1) * NAME_PACKETS_PER_PAGE,
        current * NAME_PACKETS_PER_PAGE,
      );
      const more =
        current < pages
          ? ` - ${ctx.prefix}online ${target.tag.toLowerCase()} ${current + 1} for more`
          : "";

      return ctx.reply([
        `[${target.tag}] ${result.names.length} online` +
          (pages > 1 ? ` (page ${current}/${pages})` : "") +
          more,
        ...(slice.length ? slice : ["Nobody is online."]),
      ]);
    }

    const results = await Promise.all(enabled.map(namesFor));
    const total = results.reduce(
      (sum, result) => sum + (result.ok ? result.names.length : 0),
      0,
    );

    return ctx.reply([
      `${total} online - ${ctx.prefix}online <tag> for a full list`,
      ...results.map((result, i) =>
        result.ok
          ? summaryLine(enabled[i], result.names, ctx.lineBudget)
          : result.text,
      ),
    ]);
  },
  packNames,
  summaryLine,
};
