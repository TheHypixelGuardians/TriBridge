const { ApplicationCommandOptionType } = require("discord.js");
const { lookupProfile } = require("../../utils/mojang");
const { setLink, getLink } = require("../../utils/linkedAccounts");
const { applyLinkRole, describeFailure } = require("../../utils/linkRole");
const { logGlobal } = require("../../utils/guildLog");
const mcBots = require("../../utils/mcBots");
const queryGuild = require("../../utils/queryGuild");

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
 * @param {string} targetName Canonical Minecraft name to look for.
 * @returns {'found'|'absent'|'inconclusive'} 'inconclusive' when the output
 *   never looked like a roster at all (bot lagging, command rejected, format
 *   changed) — the caller fails open on that, but not on 'absent'.
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
      const cleanSegment = segment.trim();
      if (!cleanSegment) continue;

      const nameMatch = cleanSegment.match(/(\w{1,16})\s*$/);
      if (nameMatch && nameMatch[1].toLowerCase() === target) {
        found = true;
      }
    }
  }

  if (found) return "found";
  return sawRosterStructure ? "absent" : "inconclusive";
}

/**
 * Checks every connected guild's roster for a player.
 *
 * A member of *any* registered guild may link. The fail-open rule from the
 * single-guild version is preserved exactly: 'absent' only when every roster
 * that was queried parsed cleanly and none of them held the name. One flaky
 * roster makes the whole check inconclusive rather than rejecting someone who
 * is in fact a member — the check gets weaker as guilds are added, and that is
 * the deliberate trade.
 *
 * @param {string} name Canonical Minecraft name.
 * @returns {Promise<'found'|'absent'|'inconclusive'>}
 */
async function checkRosters(name) {
  const records = mcBots.getConnectedRecords();
  if (records.length === 0) return "inconclusive";

  const verdicts = await Promise.all(
    records.map(async (record) => {
      const query = await queryGuild(record, "/guild list", { format: "motd" });
      if (!query.ok) return "inconclusive";
      return findInRoster(query.lines, name);
    }),
  );

  if (verdicts.includes("found")) return "found";
  if (verdicts.every((verdict) => verdict === "absent")) return "absent";
  return "inconclusive";
}

module.exports = {
  name: "link",
  description: "Bind your Minecraft account to your Discord account.",
  options: [
    {
      name: "username",
      description: "Your Minecraft username.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  callback: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const requested = interaction.options.getString("username");

    // Resolve the canonical name and UUID first; the UUID is what keeps the
    // avatar working after a Minecraft name change.
    let profile;
    try {
      profile = await lookupProfile(requested);
    } catch (error) {
      console.error("Mojang lookup failed:", error);
      return interaction.editReply(
        "❌ Could not reach Mojang to verify that username. Please try again shortly.",
      );
    }

    if (!profile) {
      return interaction.editReply(
        `❌ No Minecraft account named \`${requested}\` exists.`,
      );
    }

    // Check membership against every connected guild's live roster.
    const verdict = await checkRosters(profile.name);

    if (verdict === "absent") {
      return interaction.editReply(
        `❌ **${profile.name}** is not a member of any guild this bot bridges.\n` +
          "> Join one first, then run this command again.",
      );
    }

    const previous = getLink(interaction.user.id);
    const result = setLink(interaction.user.id, profile);

    if (!result.ok) {
      return interaction.editReply(
        `⚠️ **${profile.name}** is already linked to <@${result.discordId}>.\n` +
          "> If that is wrong, ask an admin to run `/unlink` on that user.",
      );
    }

    await logGlobal(
      `🔗 <@${interaction.user.id}> linked to **${profile.name}**` +
        (previous ? ` (was **${previous.name}**).` : "."),
    );

    // The link stands either way — a role that cannot be granted is worth
    // telling an admin about, but not worth undoing the link over.
    const roleResult = await applyLinkRole(interaction.member, "add");
    if (!roleResult.ok) {
      const failure = describeFailure(roleResult);
      if (failure) {
        await logGlobal(
          `⚠️ Could not give the link role to <@${interaction.user.id}> — ${failure}.`,
        );
      }
    }

    const relinked = previous
      ? `\n> Replaced your previous link to **${previous.name}**.`
      : "";

    if (verdict === "inconclusive") {
      return interaction.editReply(
        `⚠️ Linked you to **${profile.name}**, but guild membership could not be ` +
          "verified right now.\n" +
          "> An admin can undo this with `/unlink` if it was a mistake." +
          relinked,
      );
    }

    return interaction.editReply(
      `✅ Linked you to **${profile.name}**.\n` +
        "> Your messages in the bridge channel will now show your Minecraft head and name." +
        relinked,
    );
  },
};
