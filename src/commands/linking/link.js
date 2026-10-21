const { ApplicationCommandOptionType } = require("discord.js");
const { lookupProfile } = require("../../utils/mojang");
const { setLink } = require("../../utils/linkedAccounts");
const { logGlobal } = require("../../utils/guildLog");
const mcBots = require("../../utils/mcBots");
const queryGuild = require("../../utils/queryGuild");
const { findInRoster } = require("../../utils/guildPromotion");

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

/**
 * Appended to every reply that creates a link. Linking is how a member opts in
 * to the relay and to the global profile change, so the reply says so.
 */
const CONSENT_NOTE =
  "\n> By linking, you agree that your messages in the bridge channel are relayed to guild chat, " +
  "and that a global profile change run by an admin can show messages under your name and head, " +
  "or yours under another linked member's.";

module.exports = {
  name: "link",
  description:
    "Link your Minecraft account to your Discord account for the bridge.",
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

    const result = await setLink(interaction.user.id, profile);

    if (!result.ok) {
      return interaction.editReply(
        `⚠️ **${profile.name}** is already linked to <@${result.discordId}>.\n` +
          "> If that is wrong, ask an admin to run `/unlink` on that user.",
      );
    }

    const { previous } = result;
    await logGlobal(
      `🔗 <@${interaction.user.id}> linked to **${profile.name}** on the bridge` +
        (previous ? ` (was **${previous.name}**).` : "."),
    );

    const relinked = previous
      ? `\n> Replaced your previous link to **${previous.name}**.`
      : "";

    if (verdict === "inconclusive") {
      return interaction.editReply(
        `⚠️ Linked you to **${profile.name}**, but guild membership could not be ` +
          "verified right now.\n" +
          "> An admin can undo this with `/unlink` if it was a mistake." +
          relinked +
          CONSENT_NOTE,
      );
    }

    return interaction.editReply(
      `✅ Linked you to **${profile.name}**.\n` +
        "> Your messages in the bridge channel will now show your Minecraft head and name." +
        relinked +
        CONSENT_NOTE,
    );
  },
};
