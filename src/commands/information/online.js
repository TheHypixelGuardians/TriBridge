const { EmbedBuilder } = require("discord.js");
const guilds = require("../../utils/guilds");
const mcBots = require("../../utils/mcBots");
const { fetchOnline } = require("../../utils/guildOnline");
const {
  GUILD_OPTION,
  guildOptionAutocomplete,
  resolveTarget,
} = require("../../utils/commandGuild");

// Discord accepts at most 10 embeds in one message.
const MAX_EMBEDS = 10;

module.exports = {
  name: "online",
  description: "Show currently online guild members in Minecraft.",
  options: [
    {
      ...GUILD_OPTION,
      description: "Which Hypixel guild to look at. Defaults to all of them.",
    },
  ],

  autocomplete: guildOptionAutocomplete(),

  callback: async (client, interaction) => {
    await interaction.deferReply();

    // With an explicit guild this behaves exactly as it always did. Without
    // one it reports every guild, because "who is online" has no single
    // sensible default answer once there is more than one roster.
    if (interaction.options.getString("guild")) {
      const target = resolveTarget(interaction);
      if (!target.ok) return interaction.editReply(target.message);

      const embed = await buildGuildEmbed(target.record, target.guild);
      return interaction.editReply({ embeds: [embed] });
    }

    if (!guilds.isConfigured()) {
      return interaction.editReply(
        "⚠️ No Hypixel guilds are configured yet.\n> An admin can add one with `/guilds add`.",
      );
    }

    const enabled = guilds.getEnabled();
    const connected = enabled.filter((guild) => mcBots.isConnected(guild.key));

    if (connected.length === 0) {
      return interaction.editReply("❌ No Minecraft bot is connected.");
    }

    // One embed per guild rather than sections in one, so each keeps its own
    // colour and none of them has to share the 4096-character description.
    // The per-bot queues make these genuinely parallel.
    const shown = connected.slice(0, MAX_EMBEDS);
    const embeds = await Promise.all(
      shown.map((guild) => buildGuildEmbed(mcBots.getRecord(guild.key), guild)),
    );

    const overflow = connected.length - shown.length;
    return interaction.editReply({
      content:
        overflow > 0
          ? `> Showing ${shown.length} of ${connected.length} guilds — name one with the \`guild\` option to see the rest.`
          : undefined,
      embeds,
    });
  },
};

/**
 * Queries one guild's roster and renders it.
 *
 * Never throws: with several guilds in flight one bad roster must not take the
 * whole reply down.
 *
 * @param {import('../../utils/mcBots').BotRecord} record
 * @param {object} guild
 * @returns {Promise<EmbedBuilder>}
 */
async function buildGuildEmbed(record, guild) {
  const title = guilds.shouldShowTags()
    ? `🟢 Online — ${guild.name} [${guild.tag}]`
    : "🟢 Online Guild Members";

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(guilds.colorOf(guild))
    .setTimestamp();

  const online = await fetchOnline(record);

  if (!online.ok) {
    return embed.setDescription(
      online.reason === "busy"
        ? "⚠️ The bot is busy answering another command. Try again in a moment."
        : online.reason === "offline"
          ? "❌ The Minecraft bot is not connected."
          : "❌ Could not retrieve the guild list. Please try again.",
    );
  }

  const { ranks, totalOnline } = online;

  let description = "";
  for (const [rank, players] of ranks) {
    if (players.length === 0) continue;
    description += `**${rank} [${players.length}]**\n`;
    description += players.join(", ") + "\n\n";
  }

  if (!description) {
    description = "No online members found.";
  }

  if (description.length > 4096) {
    description = description.substring(0, 4093) + "...";
  }

  return embed
    .setDescription(description.trim())
    .setFooter({ text: `Total Online: ${totalOnline}` });
}
