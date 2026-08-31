const { ApplicationCommandOptionType, ChannelType } = require("discord.js");
const { isAdmin } = require("../../utils/adminRoles");
const {
  getAuditChannelId,
  setAuditChannelId,
} = require("../../utils/auditChannel");
const { missingPostPermissions } = require("../../utils/channelPermissions");
const guilds = require("../../utils/guilds");
const {
  GUILD_OPTION,
  guildOptionAutocomplete,
} = require("../../utils/commandGuild");

const SCOPED_GUILD_OPTION = {
  ...GUILD_OPTION,
  description:
    "Scope this to one Hypixel guild. Omit to change the default for all of them.",
};

module.exports = {
  name: "auditchannel",
  description: "Configure the channel admin panel actions are recorded in.",
  options: [
    {
      name: "set",
      description: "Set the channel admin panel actions are recorded in.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "channel",
          description: "The channel to record admin actions in.",
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true,
        },
        SCOPED_GUILD_OPTION,
      ],
    },
    {
      name: "show",
      description: "Show where admin panel actions are recorded.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "clear",
      description: "Stop recording admin panel actions.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [SCOPED_GUILD_OPTION],
    },
  ],

  autocomplete: guildOptionAutocomplete(),

  callback: async (client, interaction) => {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "show") return handleShow(interaction);

    // Autocomplete is only a hint, so the submitted value is re-resolved.
    const raw = interaction.options.getString("guild");
    let guildKey = null;

    if (raw) {
      guildKey = guilds.resolveKey(raw);
      if (!guildKey) {
        return interaction.reply(
          `❌ There is no Hypixel guild called \`${raw}\`.\n` +
            "> Run `/guilds list` to see the registered ones.",
        );
      }
    }

    if (subcommand === "clear") return handleClear(interaction, guildKey);
    return handleSet(interaction, guildKey);
  },
};

async function handleShow(interaction) {
  const global = getAuditChannelId();
  const overrides = guilds.getAll().filter((guild) => guild.auditChannelId);

  const lines = [
    global
      ? `> **Default:** <#${global}>`
      : "> **Default:** ⚠️ none — set one with `/auditchannel set`",
    ...overrides.map(
      (guild) =>
        `> **${guild.name}** [${guild.tag}]: <#${guild.auditChannelId}>`,
    ),
  ];

  if (!global && overrides.length === 0) {
    return interaction.reply("⚠️ No audit channel is configured yet.");
  }

  return interaction.reply(lines.join("\n"));
}

async function handleClear(interaction, guildKey) {
  if (guildKey) {
    const guild = guilds.get(guildKey);
    if (!guild.auditChannelId) {
      return interaction.reply(
        `⚠️ **${guild.name}** has no audit channel of its own.`,
      );
    }

    guilds.update(guildKey, { auditChannelId: null });
    const global = getAuditChannelId();
    return interaction.reply(
      `✅ Cleared the audit channel for **${guild.name}**.\n` +
        (global
          ? `> Its entries now go to the default channel, <#${global}>.`
          : "> There is no default channel either, so its actions are no longer recorded."),
    );
  }

  const previous = getAuditChannelId();
  if (!previous) {
    return interaction.reply("⚠️ No default audit channel is configured.");
  }

  setAuditChannelId(null);
  return interaction.reply(
    "✅ Cleared the default audit channel.\n" +
      "> Admin actions are no longer recorded, except for guilds with a channel of their own. " +
      "A global profile change will still run, but nothing will show who really sent each " +
      "disguised message.",
  );
}

async function handleSet(interaction, guildKey) {
  const channel = interaction.options.getChannel("channel");

  const missing = missingPostPermissions(channel, interaction.guild.members.me);
  if (missing.length > 0) {
    return interaction.reply(
      `❌ I cannot post in <#${channel.id}> — missing **${missing.join("**, **")}**.`,
    );
  }

  if (guildKey) {
    const result = guilds.update(guildKey, { auditChannelId: channel.id });
    if (!result.ok) return interaction.reply("❌ Could not update that guild.");

    return interaction.reply(
      `✅ Admin actions for **${result.guild.name}** will now be recorded in <#${channel.id}>.`,
    );
  }

  setAuditChannelId(channel.id);
  return interaction.reply(
    `✅ Admin actions will now be recorded in <#${channel.id}>.`,
  );
}
