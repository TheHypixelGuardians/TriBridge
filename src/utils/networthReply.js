const { EmbedBuilder } = require("discord.js");
const bridge = require("../bridge");
const guilds = require("./guilds");
const mcBots = require("./mcBots");
const { sendChat } = require("./chatQueue");
const { sanitizeForChat, MAX_CHAT_LENGTH } = require("./sanitizeForChat");
const { logForGuild } = require("./guildLog");
const { lookup, formatCoins, formatExact } = require("./networth");

// The bot answers as itself, so the line is not built with
// buildGuildChatCommand: that prepends `<name>: `, which costs 14 characters and
// makes the bot read as though it were quoting a player. Hypixel already renders
// the account's rank and name in front of the line.
const GC_PREFIX = "/gc ";
const CHAT_BUDGET = MAX_CHAT_LENGTH - GC_PREFIX.length;

// A gold that reads as SkyBlock, for answers with no Hypixel guild behind them.
const NEUTRAL_COLOR = 0xffaa00;

// Enough to show where the value is without turning the embed into a spreadsheet.
const MAX_BREAKDOWN_FIELDS = 6;
const MAX_OTHER_PROFILES = 6;

// Discord's own limit on a field value.
const MAX_FIELD_LENGTH = 1024;

const GAME_MODES = { ironman: "Ironman", island: "Stranded", bingo: "Bingo" };

/**
 * Trims and flattens an echoed-back user string before it goes anywhere.
 *
 * @param {unknown} value
 * @param {number} max
 * @returns {string}
 */
function clip(value, max) {
  const text = sanitizeForChat(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * @param {string|null} gameMode
 * @returns {string} ` [Ironman]`, or empty for a normal profile.
 */
function modeSuffix(gameMode) {
  if (!gameMode) return "";
  const label = GAME_MODES[gameMode] ?? clip(gameMode, 10);
  return label ? ` [${label}]` : "";
}

// Every failure the lookup can produce, phrased once for each output. `chat`
// must fit the 96-character budget; `embed` is free to explain properly.
//
// A `cooldown` has no entry on purpose — it is answered with silence in a
// channel, because a rate limiter that talks is one you can spam through. Only
// the slash command, which cannot spam a channel, reports it.
const FAILURES = {
  usage: {
    chat: () => "Usage: !nw <username>",
    embed: () => ({
      emoji: "⚠️",
      title: "How to use it",
      lines: ["`!nw <username>` — or `/networth <username>` here."],
    }),
  },
  "invalid-name": {
    chat: (d) => `"${clip(d, 20)}" is not a Minecraft username.`,
    embed: (d) => ({
      emoji: "❌",
      title: "Not a username",
      lines: [`\`${clip(d, 40)}\` is not a valid Minecraft username.`],
    }),
  },
  "unknown-player": {
    chat: (d) => `No Minecraft account called ${clip(d, 20)}.`,
    embed: (d) => ({
      emoji: "❌",
      title: "No such account",
      lines: [`Mojang has no account called \`${clip(d, 40)}\`.`],
    }),
  },
  "no-profiles": {
    chat: (d) => `${clip(d, 20)} has no SkyBlock data on SkyCrypt yet.`,
    embed: (d) => ({
      emoji: "⚠️",
      title: "No SkyBlock data",
      lines: [
        `SkyCrypt has never loaded \`${clip(d, 40)}\`.`,
        `Open https://sky.shiiyu.moe/stats/${encodeURIComponent(clip(d, 20))} once, then try again.`,
      ],
      footer:
        "TriBridge reads SkyCrypt's cache and cannot load a profile itself.",
    }),
  },
  "upstream-busy": {
    chat: () => "SkyCrypt is busy — try again in a minute.",
    embed: () => ({
      emoji: "⚠️",
      title: "SkyCrypt is busy",
      lines: ["It is rate limiting us. Try again in a minute."],
    }),
  },
  "upstream-error": {
    chat: (d) => `SkyCrypt is not answering (HTTP ${clip(d, 4)}).`,
    embed: (d) => ({
      emoji: "❌",
      title: "SkyCrypt is not answering",
      lines:
        clip(d, 4) === "403"
          ? [
              `It returned HTTP ${clip(d, 4)}.`,
              "It may be blocking automated requests right now.",
            ]
          : [`It returned HTTP ${clip(d, 4)}.`],
    }),
  },
  timeout: {
    chat: () => "SkyCrypt took too long — try again.",
    embed: () => ({
      emoji: "⚠️",
      title: "Timed out",
      lines: ["SkyCrypt did not answer within 15 seconds."],
    }),
  },
  network: {
    chat: () => "Could not reach SkyCrypt.",
    embed: () => ({
      emoji: "❌",
      title: "Could not reach SkyCrypt",
      lines: ["The request failed before it got a reply."],
    }),
  },
  malformed: {
    chat: () => "Got an unreadable answer from SkyCrypt.",
    embed: () => ({
      emoji: "❌",
      title: "Unreadable answer",
      lines: ["SkyCrypt replied with something TriBridge could not read."],
    }),
  },
  "no-networth": {
    chat: (d) => `${clip(d, 20)}: SkyCrypt has no networth for that account.`,
    embed: (d) => ({
      emoji: "⚠️",
      title: "No networth",
      lines: [
        `SkyCrypt has profiles for \`${clip(d, 40)}\` but no networth on any of them.`,
      ],
    }),
  },
  busy: {
    chat: () => "Busy right now — try that again in a moment.",
    embed: () => ({
      emoji: "⚠️",
      title: "Busy",
      lines: ["Too many networth lookups are queued. Try again shortly."],
    }),
  },
  cooldown: {
    chat: () => null,
    embed: (d) => ({
      emoji: "⚠️",
      title: "Slow down",
      lines: [`You just looked one up. Try again in ${clip(d, 3)}s.`],
    }),
  },
  error: {
    chat: () => "Something went wrong looking that up.",
    embed: () => ({
      emoji: "❌",
      title: "Something went wrong",
      lines: ["The lookup failed unexpectedly."],
    }),
  },
};

const FALLBACK = FAILURES.error;

/**
 * The one-line answer, without the `/gc ` prefix.
 *
 * Worst case is 90 characters — a 16-character name, two six-character figures,
 * the longest profile name, a game mode and the API marker — against a budget of
 * 96. Designed to fit rather than to be truncated, because the thing truncation
 * would eat is the `(API off)` marker on the end, which is exactly the part that
 * must not go missing.
 *
 * @param {object} result A result from utils/networth.js `lookup`.
 * @returns {string|null} Null when the outcome is answered with silence.
 */
function buildAnswerBody(result) {
  if (!result.ok) {
    const failure = FAILURES[result.code] ?? FALLBACK;
    return failure.chat(result.detail);
  }

  const { player, best } = result;
  const apiOff = best.noInventory ? " (API off)" : "";

  return (
    `${player.name}: ${formatCoins(best.networth)} networth ` +
    `(${formatCoins(best.unsoulbound)} unsoulbound) on ` +
    `${best.cuteName}${modeSuffix(best.gameMode)}${apiOff}`
  );
}

/**
 * Builds the chat command for the guild-chat answer.
 *
 * sanitizeForChat is not optional here even though the body is machine-built:
 * profile names come from an upstream API, and mineflayer splits `bot.chat` on
 * newlines, so a newline in one would send its tail at *command* position.
 *
 * @param {object} result
 * @returns {string|null}
 */
function buildChatAnswer(result) {
  const body = buildAnswerBody(result);
  if (!body) return null;

  const safe = sanitizeForChat(body);
  if (!safe) return null;

  // A safety net, never the plan — see buildAnswerBody.
  return (
    GC_PREFIX + (safe.length > CHAT_BUDGET ? safe.slice(0, CHAT_BUDGET) : safe)
  );
}

/**
 * `personal_vault` → `Personal Vault`.
 *
 * @param {string} key
 * @returns {string}
 */
function labelForType(key) {
  return key
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * @param {object} result
 * @param {{guild?: object|null, asker?: string|null}} context
 * @returns {number}
 */
function colorFor(context) {
  return context.guild ? guilds.colorOf(context.guild) : NEUTRAL_COLOR;
}

/**
 * Renders the answer as a Discord embed.
 *
 * @param {object} result A result from utils/networth.js `lookup`.
 * @param {{guild?: object|null, asker?: string|null}} [context]
 * @returns {EmbedBuilder}
 */
function buildNetworthEmbed(result, context = {}) {
  const embed = new EmbedBuilder().setColor(colorFor(context)).setTimestamp();

  if (!result.ok) {
    const failure = FAILURES[result.code] ?? FALLBACK;
    const { emoji, title, lines, footer } = failure.embed(result.detail);

    embed
      .setTitle(`${emoji} ${title}`)
      .setDescription(lines.map((line) => `> ${line}`).join("\n"));

    if (footer) embed.setFooter({ text: footer });
    return embed;
  }

  const { player, best, profiles, attribution } = result;

  embed.setAuthor({
    name: player.name,
    iconURL: `https://mc-heads.net/avatar/${encodeURIComponent(player.uuid ?? player.name)}`,
  });

  const description = [
    `> **Networth:** ${formatExact(best.networth)} coins`,
    `> **Unsoulbound:** ${formatExact(best.unsoulbound)} coins`,
    `> **Profile:** ${best.cuteName}${modeSuffix(best.gameMode)}`,
    `> **Purse:** ${formatCoins(best.purse)}  **Bank:** ${formatCoins(best.bank + best.personalBank)}`,
  ];
  embed.setDescription(description.join("\n"));

  const breakdown = Object.entries(best.types)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, MAX_BREAKDOWN_FIELDS);

  if (breakdown.length > 0) {
    embed.addFields(
      breakdown.map(([key, value]) => ({
        name: labelForType(key),
        value: formatCoins(value.total),
        inline: true,
      })),
    );
  }

  if (best.noInventory) {
    embed.addFields({
      name: "⚠️ Inventory API off",
      value:
        `> \`${player.name}\` has their inventory API disabled, so this is an ` +
        "undercount — the value of their items is missing.",
    });
  }

  // Every profile is kept in the cache, not just the winner, so that this line
  // can exist: it is what shows the answer picked the richest one rather than
  // an arbitrary one.
  const others = profiles
    .filter((profile) => profile.profileId !== best.profileId)
    .sort((a, b) => b.networth - a.networth)
    .slice(0, MAX_OTHER_PROFILES)
    .map((profile) => `${profile.cuteName} ${formatCoins(profile.networth)}`)
    .join(" · ");

  if (others) {
    embed.addFields({
      name: "Other profiles",
      value: others.slice(0, MAX_FIELD_LENGTH),
    });
  }

  const footer = [attribution, "cached up to 10 minutes"];
  if (context.asker) {
    const where =
      context.guild && guilds.shouldShowTags()
        ? ` in ${context.guild.name}`
        : "";
    footer.push(`Asked by ${clip(context.asker, 32)}${where}`);
  }
  embed.setFooter({ text: footer.join(" · ") });

  return embed;
}

/**
 * Posts an embed to the bridge channel, swallowing every failure.
 *
 * @param {EmbedBuilder} embed
 * @returns {Promise<void>}
 */
async function postToBridge(embed) {
  try {
    const channel = await bridge.discordClient.channels.fetch(
      bridge.discordChannelId,
    );
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(
      "Failed to post a networth answer to the bridge channel:",
      error,
    );
  }
}

/**
 * Answers a `!nw` typed in guild chat or in the bridge channel.
 *
 * The two legs are independent and the embed never waits on the chat leg: the
 * embed is the durable copy of the answer, so it goes out whether or not the
 * Minecraft bot is still there to speak.
 *
 * Never throws — it is called with `void` from a message handler, where an
 * unhandled rejection is a process-level hazard.
 *
 * @param {{name: string, args: string}} command
 * @param {object} context
 * @param {string} context.requesterKey Cooldown identity — `mc:<name>` or `d:<id>`.
 * @param {string|null} [context.asker] Who to credit in the embed footer.
 * @param {object|null} [context.guild] The Hypixel guild that asked, if any.
 * @returns {Promise<void>}
 */
async function answerChatCommand(command, context) {
  try {
    const result = await lookup({
      username: command.args,
      requesterKey: context.requesterKey,
    });

    // Silence in a channel, deliberately. See the FAILURES table.
    if (!result.ok && result.code === "cooldown") return;

    await postToBridge(buildNetworthEmbed(result, context));

    if (!context.guild) return;

    const record = mcBots.getRecord(context.guild.key);
    // Deregistered between question and answer — nothing to say and nowhere
    // to say it.
    if (!record) return;

    const answer = buildChatAnswer(result);
    if (!answer) return;

    // maxAgeMs is a judgement call: an answer landing a minute late, in a
    // chat that has moved on, is confusing rather than merely slow — and the
    // embed above already carries it.
    const delivered = await sendChat(record, answer, { maxAgeMs: 30_000 });
    if (!delivered) {
      await logForGuild(
        context.guild.key,
        "⚠️ A `!nw` answer could not be delivered to guild chat — the bot was not connected.",
      );
    }
  } catch (error) {
    console.error("Failed to answer a chat command:", error);
  }
}

module.exports = {
  answerChatCommand,
  buildNetworthEmbed,
  buildAnswerBody,
  buildChatAnswer,
  CHAT_BUDGET,
};
