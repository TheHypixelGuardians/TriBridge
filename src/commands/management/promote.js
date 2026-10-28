const { ApplicationCommandOptionType } = require("discord.js");
const { isAdmin } = require("../../utils/adminRoles");
const { logAudit } = require("../../utils/auditChannel");
const { resolveMember } = require("../../utils/serverMember");
const {
  PROMOTION_RANKS,
  getRank,
  promoteMember,
  describeStep,
} = require("../../utils/guildPromotion");
const {
  GUILD_OPTION,
  guildOptionAutocomplete,
  resolveTarget,
} = require("../../utils/commandGuild");

module.exports = {
  name: "promote",
  description: "Give a member a rank, in-game and on Discord.",
  // Bot-admin roles only (checked in the callback); /help lists it only for them.
  adminOnly: true,
  options: [
    {
      name: "user",
      description: "The member to give the rank.",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "rank",
      description: "The rank to give.",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: PROMOTION_RANKS.map((rank) => ({
        name: rank.name,
        value: rank.value,
      })),
    },
    GUILD_OPTION,
  ],

  autocomplete: guildOptionAutocomplete(),

  callback: async (client, interaction) => {
    if (!(await isAdmin(interaction.member))) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    return giveRank(
      interaction,
      interaction.options.getUser("user"),
      interaction.options.getString("rank"),
    );
  },
};

/**
 * Sets one of {@link PROMOTION_RANKS} in-game (when the
 * member has a bridge link) and on Discord.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').User} user
 * @param {string} rankValue
 */
async function giveRank(interaction, user, rankValue) {
  // Choices are a hint: Discord accepts any string here from a crafted
  // request, so the rank is always looked up, never used as given.
  const rank = getRank(rankValue);
  if (!rank) {
    return interaction.reply({
      content: "❌ That is not one of the ranks.",
      ephemeral: true,
    });
  }

  // The roster reads and the rank change are Hypixel round trips, far past
  // Discord's three seconds.
  await interaction.deferReply();

  const member = await resolveMember(user.id);
  if (!member) {
    return interaction.editReply("❌ That user is not in this server.");
  }

  // With `guild` given, only that guild is promoted in; without it, every
  // connected guild's roster is searched for the member.
  let record = null;
  if (interaction.options.getString("guild")) {
    const target = resolveTarget(interaction);
    if (!target.ok) return interaction.editReply(target.message);
    record = target.record;
  }

  const result = await promoteMember(member, rank, { record });
  const where = result.guildName ? ` (${result.guildName})` : "";
  const steps = [
    describeStep(`In-game${where}`, result.minecraft),
    describeStep("Role", result.role),
    describeStep("Nickname", result.nickname),
  ].join("\n");

  await interaction.editReply({
    content: `<@${member.id}> → **${rank.name}**\n${steps}`,
    allowedMentions: { parse: [] },
  });

  await logAudit(
    `⬆️ <@${interaction.user.id}> gave <@${member.id}>` +
      (result.mcName ? ` (**${result.mcName}**)` : "") +
      ` the rank **${rank.name}**.\n${steps}`,
  );
}
