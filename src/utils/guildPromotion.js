const { PermissionFlagsBits } = require("discord.js");
const guilds = require("./guilds");
const mcBots = require("./mcBots");
const queryGuild = require("./queryGuild");
const { getLink } = require("./linkedAccounts");
const { isValidMinecraftName } = require("./minecraftName");

/**
 * The ranks `/promote` hands out with its `rank` option, highest first.
 *
 * - `name` is the Discord-side rank: the `[Name]` nickname prefix, and the
 *   Discord role's name when `roleEnv` is not set.
 * - `gameRank` is the Hypixel guild rank `/g setrank` is given. The three
 *   officer tiers share one: Hypixel has a single Officer rank, and the tier
 *   lives only in the Discord role.
 * - `roleEnv` names the `.env` variable holding the Discord role's id.
 */
const PROMOTION_RANKS = [
  {
    value: "senior_officer",
    name: "Senior Officer",
    gameRank: "Officer",
    roleEnv: "RANK_ROLE_SENIOR_OFFICER",
  },
  {
    value: "officer",
    name: "Officer",
    gameRank: "Officer",
    roleEnv: "RANK_ROLE_OFFICER",
  },
  {
    value: "trial_officer",
    name: "Trial Officer",
    gameRank: "Officer",
    roleEnv: "RANK_ROLE_TRIAL_OFFICER",
  },
  {
    value: "veteran",
    name: "Veteran",
    gameRank: "Veteran",
    roleEnv: "RANK_ROLE_VETERAN",
  },
  {
    value: "elite",
    name: "Elite",
    gameRank: "Elite",
    roleEnv: "RANK_ROLE_ELITE",
  },
  {
    value: "titan",
    name: "Titan",
    gameRank: "Titan",
    roleEnv: "RANK_ROLE_TITAN",
  },
];

/**
 * @param {string} value
 * @returns {{value: string, name: string}|null}
 */
function getRank(value) {
  return PROMOTION_RANKS.find((rank) => rank.value === value) ?? null;
}

/**
 * Searches collected `/guild list` output for a member.
 *
 * Hypixel guild list format (with Minecraft color codes):
 * - Rank headers: "-- RankName --" (after stripping §x codes)
 * - Player entries within a rank are separated by ● dots
 * - Both online and offline members are listed, so colour is ignored here
 * - A "Total Members: N" summary line closes the roster
 *
 * @param {string[]} rawMessages Raw message strings with colour codes.
 * @param {string} targetName Minecraft name to look for.
 * @returns {'found'|'absent'|'inconclusive'} 'inconclusive' when the output
 *   never looked like a roster at all (bot lagging, command rejected, format
 *   changed).
 */
function findInRoster(rawMessages, targetName) {
  const target = targetName.toLowerCase();
  let sawRosterStructure = false;
  let found = false;

  for (const raw of rawMessages) {
    const clean = raw.replace(/§./g, "");
    const trimmed = clean.trim();

    if (
      /^--\s+(.+?)\s+--$/.test(trimmed) ||
      /^(Total|Online|Offline) Members:/.test(trimmed)
    ) {
      sawRosterStructure = true;
    }

    for (const segment of clean.split(/●+/)) {
      const nameMatch = segment.trim().match(/(\w{1,16})\s*$/);
      if (nameMatch && nameMatch[1].toLowerCase() === target) found = true;
    }
  }

  if (found) return "found";
  return sawRosterStructure ? "absent" : "inconclusive";
}

/**
 * Finds the connected Hypixel guild a player is in, by reading every roster.
 *
 * @param {string} name
 * @returns {Promise<{record: object}|{record: null, inconclusive: boolean}>}
 *   `inconclusive` when no roster said "found" but at least one gave no clear
 *   answer, so "not in any guild" cannot be claimed.
 */
async function findMemberGuild(name) {
  let inconclusive = false;

  // One at a time, not in parallel: each query holds its bot's chat queue, and
  // the first roster that has the player ends the search.
  for (const record of mcBots.getConnectedRecords()) {
    const query = await queryGuild(record, "/guild list", { format: "motd" });
    const verdict = query.ok ? findInRoster(query.lines, name) : "inconclusive";
    if (verdict === "found") return { record };
    if (verdict === "inconclusive") inconclusive = true;
  }

  return { record: null, inconclusive };
}

/**
 * Reads Hypixel's answer to `/guild setrank`.
 *
 * Hypixel reports a rank change the way it reports `/g promote`:
 * "<name> was promoted from <old> to <new>" (or "demoted" when going down).
 * Anything unrecognised is passed back verbatim rather than guessed at.
 *
 * @param {string} combined Collected lines, joined by newlines.
 * @param {string} name
 * @param {string} rankName
 * @returns {{ok: boolean, message: string}}
 */
function parseSetRankResponse(combined, name, rankName) {
  const lower = combined.toLowerCase();

  if (lower.includes("was promoted") || lower.includes("was demoted")) {
    return { ok: true, message: `set to **${rankName}** in-game` };
  }
  if (lower.includes("already")) {
    return { ok: true, message: `already **${rankName}** in-game` };
  }
  if (
    lower.includes("is not in your guild") ||
    lower.includes("not a member of your guild")
  ) {
    return { ok: false, message: `**${name}** is not in that guild` };
  }
  if (
    lower.includes("can't find a rank") ||
    lower.includes("rank not found") ||
    lower.includes("invalid rank")
  ) {
    return {
      ok: false,
      message: `the guild has no rank called **${rankName}**`,
    };
  }
  if (
    lower.includes("you don't have permission") ||
    lower.includes("you do not have permission") ||
    lower.includes("you must be")
  ) {
    return {
      ok: false,
      message: "the bot is not allowed to change ranks in that guild",
    };
  }

  const trimmed = combined.trim().slice(0, 300);
  return {
    ok: false,
    message: trimmed
      ? `unclear answer from Hypixel: \`${trimmed.replace(/`/g, "'")}\``
      : "no answer from Hypixel",
  };
}

/**
 * A display name without the `[Rank] ` prefix this feature (or the community
 * bot's `[Knight] `) put in front of it.
 */
function stripRankPrefix(name) {
  return String(name ?? "")
    .replace(/^\[[^\]]{1,16}\]\s*/, "")
    .trim();
}

/**
 * @param {string} rankName
 * @param {string} baseName The Minecraft name, or the member's own name when
 *   they have no link.
 * @returns {string} `[Rank] name`, cut to Discord's 32-character limit.
 */
function rankNickname(rankName, baseName) {
  return `[${rankName}] ${stripRankPrefix(baseName)}`.slice(0, 32);
}

/**
 * The role id set for a rank in `.env`, read on every call so a changed `.env`
 * needs only a restart.
 *
 * @param {{roleEnv: string}} rank
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string|null} Null when unset or not shaped like a Discord id.
 */
function rankRoleId(rank, env = process.env) {
  const id = env[rank.roleEnv]?.trim();
  return id && /^\d{17,20}$/.test(id) ? id : null;
}

/**
 * The Discord role for a rank: by the id in `.env` when one is set, otherwise
 * by name, case-insensitively. A set id that matches no role is not replaced
 * by a name match, so a deleted role is reported rather than silently swapped
 * for another one that happens to share its name.
 *
 * @param {import('discord.js').Guild} server
 * @param {{name: string, roleEnv: string}} rank
 * @returns {import('discord.js').Role|undefined}
 */
function findRankRole(server, rank) {
  const id = rankRoleId(rank);
  if (id) return server.roles.cache.get(id);
  return server.roles.cache.find(
    (role) => role.name.toLowerCase() === rank.name.toLowerCase(),
  );
}

/**
 * Gives the member the chosen rank's role and takes the other promotion ranks'
 * roles away. The community bot's link role (Knight) is not one of them and is
 * left alone.
 *
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function applyRankRoles(member, rank) {
  const me = member.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { ok: false, message: "I need **Manage Roles** to change roles" };
  }

  const wanted = findRankRole(member.guild, rank);
  if (!wanted) {
    return {
      ok: false,
      message: rankRoleId(rank)
        ? `the role set in \`${rank.roleEnv}\` does not exist`
        : `there is no role called **${rank.name}**`,
    };
  }

  const others = PROMOTION_RANKS.filter((other) => other !== rank)
    .map((other) => findRankRole(member.guild, other))
    .filter((role) => role && member.roles.cache.has(role.id));

  const tooHigh = [wanted, ...others].find(
    (role) => role.managed || role.comparePositionTo(me.roles.highest) >= 0,
  );
  if (tooHigh) {
    return {
      ok: false,
      message: `**${tooHigh.name}** is ranked above my own role, so I cannot assign it`,
    };
  }

  try {
    if (!member.roles.cache.has(wanted.id)) {
      await member.roles.add(wanted, `Promoted to ${rank.name}.`);
    }
    if (others.length > 0) {
      await member.roles.remove(others, `Promoted to ${rank.name}.`);
    }
    return { ok: true, message: `gave the **${wanted.name}** role` };
  } catch (error) {
    return { ok: false, message: `role change failed: ${error.message}` };
  }
}

/**
 * @returns {Promise<{ok: boolean, message: string}>}
 */
async function applyRankNickname(member, nickname) {
  if (member.nickname === nickname) {
    return { ok: true, message: `nickname already \`${nickname}\`` };
  }
  // Discord never lets a bot rename the server owner.
  if (member.id === member.guild.ownerId) {
    return { ok: false, message: "Discord does not let me rename the owner" };
  }

  const me = member.guild.members.me;
  if (
    !me?.permissions.has(PermissionFlagsBits.ManageNicknames) ||
    member.roles.highest.comparePositionTo(me.roles.highest) >= 0
  ) {
    return {
      ok: false,
      message: "I need **Manage Nicknames** and a role above theirs",
    };
  }

  try {
    await member.setNickname(nickname, "Promoted.");
    return { ok: true, message: `nickname set to \`${nickname}\`` };
  } catch (error) {
    return { ok: false, message: `nickname change failed: ${error.message}` };
  }
}

/**
 * Promotes a member to one of {@link PROMOTION_RANKS}, in-game and on Discord.
 *
 * In-game only when the member has a bridge link: without one there is no
 * Minecraft name to promote, and guessing one from a Discord nickname could
 * promote a stranger. The Discord half (role and nickname) happens either way.
 * Each step is reported on its own; one failing does not stop the others.
 *
 * @param {import('discord.js').GuildMember} member
 * @param {{value: string, name: string, gameRank: string, roleEnv: string}} rank
 * @param {{record?: object|null}} [options] `record` limits the in-game step
 *   to that guild instead of searching every connected guild's roster.
 * @returns {Promise<{minecraft: {ok: boolean, message: string}|null, role: {ok: boolean, message: string}, nickname: {ok: boolean, message: string}, mcName: string|null, guildName: string|null}>}
 */
async function promoteMember(member, rank, { record = null } = {}) {
  const link = await getLink(member.id);
  const mcName = link?.name ?? null;
  let minecraft = null;
  let guildName = null;

  if (mcName) {
    // Interpolated into bot.chat() below, so it is validated like every
    // hand-built command.
    if (!isValidMinecraftName(mcName)) {
      minecraft = { ok: false, message: "the linked name is not valid" };
    } else {
      const found = record ? { record } : await findMemberGuild(mcName);
      if (!found.record) {
        minecraft = {
          ok: false,
          message: found.inconclusive
            ? "could not read the guild rosters right now"
            : `**${mcName}** is not in any bridged guild`,
        };
      } else {
        guildName = guilds.get(found.record.key)?.name ?? found.record.key;
        const query = await queryGuild(
          found.record,
          `/guild setrank ${mcName} ${rank.gameRank}`,
        );
        minecraft = query.ok
          ? parseSetRankResponse(query.lines.join("\n"), mcName, rank.gameRank)
          : { ok: false, message: "the in-game command did not go through" };
      }
    }
  }

  const role = await applyRankRoles(member, rank);
  const nickname = await applyRankNickname(
    member,
    rankNickname(rank.name, mcName ?? member.displayName),
  );

  return { minecraft, role, nickname, mcName, guildName };
}

/**
 * One line of a promotion report.
 *
 * @param {string} label
 * @param {{ok: boolean, message: string}|null} step Null for a skipped
 *   in-game step.
 * @returns {string}
 */
function describeStep(label, step) {
  if (!step) {
    return `⏭️ **${label}:** skipped, no bridge link so no Minecraft name`;
  }
  return `${step.ok ? "✅" : "⚠️"} **${label}:** ${step.message}`;
}

module.exports = {
  PROMOTION_RANKS,
  getRank,
  rankRoleId,
  findInRoster,
  parseSetRankResponse,
  stripRankPrefix,
  rankNickname,
  promoteMember,
  describeStep,
};
