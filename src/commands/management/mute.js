const { ApplicationCommandOptionType } = require("discord.js");
const { isAdmin } = require("../../utils/adminRoles");
const { isValidMinecraftName } = require("../../utils/minecraftName");
const {
  parseMuteDuration,
  parseMuteResponse,
} = require("../../utils/guildMute");
const { logAudit } = require("../../utils/auditChannel");
const queryGuild = require("../../utils/queryGuild");
const {
  GUILD_OPTION,
  guildOptionAutocomplete,
  resolveTarget,
  guildPhrase,
  describeQueryFailure,
} = require("../../utils/commandGuild");

module.exports = {
  name: "mute",
  description: "Mute a member in a Hypixel guild's chat.",
  options: [
    {
      name: "username",
      description: "The Minecraft username to mute.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "duration",
      description: "How long, as a number and m, h or d: 30m, 12h, 7d.",
      type: ApplicationCommandOptionType.String,
      required: true,
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

    await interaction.deferReply({ ephemeral: true });

    const target = resolveTarget(interaction);
    if (!target.ok) return interaction.editReply(target.message);

    const username = interaction.options.getString("username");

    // Both go straight into bot.chat() below without passing through
    // buildGuildChatCommand: the name is checked against its own shape, and
    // the duration is rebuilt from what parseMuteDuration matched.
    if (!isValidMinecraftName(username)) {
      return interaction.editReply(
        "❌ That is not a valid Minecraft username.\n" +
          "> Names are at most 16 letters, digits or underscores.",
      );
    }

    const duration = parseMuteDuration(
      interaction.options.getString("duration"),
    );
    if (!duration.ok) {
      return interaction.editReply(`❌ ${duration.reason}`);
    }

    const query = await queryGuild(
      target.record,
      `/guild mute ${username} ${duration.value}`,
    );
    if (!query.ok) return interaction.editReply(describeQueryFailure(query));

    const result = parseMuteResponse(query.lines.join("\n"), {
      action: "mute",
      username,
      where: guildPhrase(target.guild),
      duration: duration.value,
    });

    if (result.ok) {
      await logAudit(
        `🔇 <@${interaction.user.id}> muted \`${username}\` in ` +
          `${guildPhrase(target.guild)} for \`${duration.value}\``,
        { guildKey: target.guild.key },
      );
    }
    await interaction.editReply(result.message);
  },
};
