const { ApplicationCommandOptionType } = require("discord.js");
const { isAdmin } = require("../../utils/adminRoles");
const { isValidMinecraftName } = require("../../utils/minecraftName");
const { parseMuteResponse } = require("../../utils/guildMute");
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
  name: "unmute",
  description: "Unmute a member in a Hypixel guild's chat.",
  options: [
    {
      name: "username",
      description: "The Minecraft username to unmute.",
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

    // Validated because it goes straight into bot.chat() below without
    // passing through buildGuildChatCommand.
    if (!isValidMinecraftName(username)) {
      return interaction.editReply(
        "❌ That is not a valid Minecraft username.\n" +
          "> Names are at most 16 letters, digits or underscores.",
      );
    }

    const query = await queryGuild(target.record, `/guild unmute ${username}`);
    if (!query.ok) return interaction.editReply(describeQueryFailure(query));

    const result = parseMuteResponse(query.lines.join("\n"), {
      action: "unmute",
      username,
      where: guildPhrase(target.guild),
    });

    if (result.ok) {
      await logAudit(
        `🔊 <@${interaction.user.id}> unmuted \`${username}\` in ${guildPhrase(target.guild)}`,
        { guildKey: target.guild.key },
      );
    }
    await interaction.editReply(result.message);
  },
};
