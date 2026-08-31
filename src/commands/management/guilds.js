const {
  ApplicationCommandOptionType,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");
const bridge = require("../../bridge");
const { isAdmin } = require("../../utils/adminRoles");
const guilds = require("../../utils/guilds");
const mcBots = require("../../utils/mcBots");
const createMcBot = require("../../utils/createMcBot");
const { registerSink, requestSignIn } = require("../../utils/deviceCode");
const { respondWithGuilds } = require("../../utils/guildAutocomplete");
const { missingPostPermissions } = require("../../utils/channelPermissions");

const FAILURE_MESSAGES = {
  "invalid-key":
    "The key must be 1–16 characters of lowercase letters, digits, `-` or `_`, starting with a letter or digit.",
  "invalid-name": "The name must be 1–64 characters.",
  "invalid-tag":
    "The tag must be 2–8 letters or digits. One character is too short — `!a` would swallow ordinary chat.",
  "reserved-tag":
    'That tag is reserved for a chat command — `!nw` already means "look up a networth". Pick another one.',
  "invalid-account":
    "The account must be a single word with no spaces, such as a Microsoft email address.",
  "invalid-color": "The colour must be a hex value like `#2ECC71`.",
  "duplicate-key": "A guild with that key already exists.",
  "duplicate-tag": "Another guild already uses that tag.",
  "duplicate-account":
    "Another guild already uses that Minecraft account. Two bots cannot share one account.",
  "unknown-key": "No guild with that key is registered.",
  "no-changes": "Give at least one thing to change.",
};

/**
 * Hides most of an account address. `/guilds` is admin-only and ephemeral, but
 * the reply still ends up in one person's client and the emails are the closest
 * thing the registry has to a credential.
 *
 * @param {string} account
 * @returns {string}
 */
function maskAccount(account) {
  const value = String(account ?? "");
  const at = value.indexOf("@");
  if (at <= 0) return `${value.slice(0, 1)}***`;

  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const domainMask =
    dot > 0
      ? `${domain.slice(0, 1)}***${domain.slice(dot)}`
      : `${domain.slice(0, 1)}***`;

  return `${value.slice(0, 1)}***@${domainMask}`;
}

function fail(reason) {
  return `❌ ${FAILURE_MESSAGES[reason] ?? "That did not work."}`;
}

/**
 * Starts a connect attempt, routing any Microsoft device code back to the admin
 * who asked for it rather than to the log channel.
 *
 * Never awaited by the caller with a live spinner: a sign-in blocks for up to
 * fifteen minutes, which is longer than an interaction lives.
 *
 * @param {string} guildKey
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
function beginSignIn(guildKey, interaction) {
  const unregister = registerSink(guildKey, (embed) =>
    interaction.followUp({ embeds: [embed], ephemeral: true }),
  );

  createMcBot(guildKey, {
    onMsaCode: (info, guild) => requestSignIn(info, guild),
  })
    .then(() =>
      interaction
        .followUp({
          content:
            "✅ Signed in. Connecting to Hypixel — `/guilds list` will show it online shortly.",
          ephemeral: true,
        })
        .catch(() => {}),
    )
    .catch((error) =>
      interaction
        .followUp({
          content: `❌ Sign-in failed: ${error.message}\n> The guild is still registered. Retry with \`/guilds auth ${guildKey}\`.`,
          ephemeral: true,
        })
        .catch(() => {}),
    )
    .finally(unregister);
}

module.exports = {
  name: "guilds",
  description: "Manage the Hypixel guilds this bot bridges.",
  options: [
    {
      name: "list",
      description:
        "List every registered Hypixel guild and its connection status.",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: "add",
      description:
        "Register a Hypixel guild and sign its Minecraft account in.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "key",
          description:
            'Short internal id, e.g. "sb". Lowercase, cannot be changed later.',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "name",
          description: "Display name shown in replies and logs.",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "tag",
          description:
            'Chat tag, 2-8 characters. Used as "!tag message" to target this guild.',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "account",
          description:
            "Microsoft account email for this guild's Minecraft bot.",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "color",
          description: "Hex colour for this guild's messages, e.g. #2ECC71.",
          type: ApplicationCommandOptionType.String,
          required: false,
        },
      ],
    },
    {
      name: "remove",
      description: "Unregister a Hypixel guild and disconnect its bot.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "guild",
          description: "The guild to remove.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: "confirm",
          description: "Required when removing the default guild.",
          type: ApplicationCommandOptionType.Boolean,
          required: false,
        },
      ],
    },
    {
      name: "edit",
      description: "Change a registered guild's name, tag, colour or channels.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "guild",
          description: "The guild to edit.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: "name",
          description: "New display name.",
          type: ApplicationCommandOptionType.String,
          required: false,
        },
        {
          name: "tag",
          description: "New chat tag, 2-8 characters.",
          type: ApplicationCommandOptionType.String,
          required: false,
        },
        {
          name: "color",
          description: "New hex colour, e.g. #2ECC71.",
          type: ApplicationCommandOptionType.String,
          required: false,
        },
        {
          name: "logchannel",
          description: "Channel for this guild's connection notices.",
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: false,
        },
        {
          name: "auditchannel",
          description: "Channel for this guild's audit entries.",
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: false,
        },
        {
          name: "officerchannel",
          description:
            "Two-way officer chat channel. Anyone who can post there speaks as an officer.",
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: false,
        },
        {
          name: "enabled",
          description: "Whether the bot should stay connected to this guild.",
          type: ApplicationCommandOptionType.Boolean,
          required: false,
        },
        {
          name: "crossbridge",
          description:
            "Share guild chat with the other cross-bridged guilds, both ways.",
          type: ApplicationCommandOptionType.Boolean,
          required: false,
        },
        {
          name: "crossbridgeofficer",
          description:
            "Also share officer chat with them, both ways. Needs crossbridge on.",
          type: ApplicationCommandOptionType.Boolean,
          required: false,
        },
        {
          name: "clear",
          description:
            "Clear a per-guild channel so it falls back or switches off.",
          type: ApplicationCommandOptionType.String,
          required: false,
          choices: [
            { name: "Log channel", value: "log" },
            { name: "Audit channel", value: "audit" },
            { name: "Officer channel", value: "officer" },
            { name: "Log and audit channels", value: "both" },
          ],
        },
      ],
    },
    {
      name: "default",
      description: "Choose the guild commands act on when none is given.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "guild",
          description: "The guild to make the default.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: "auth",
      description: "Sign a guild's Minecraft account in again.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "guild",
          description: "The guild to sign in.",
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
  ],

  autocomplete: async (client, interaction) => {
    if (interaction.options.getFocused(true).name !== "guild") {
      return interaction.respond([]);
    }
    return respondWithGuilds(interaction);
  },

  callback: async (client, interaction) => {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    // Ephemeral throughout: the replies carry account addresses and the
    // sign-in codes that follow them.
    if (subcommand === "list") return handleList(interaction);
    if (subcommand === "add") return handleAdd(interaction);
    if (subcommand === "remove") return handleRemove(interaction);
    if (subcommand === "edit") return handleEdit(interaction);
    if (subcommand === "default") return handleDefault(interaction);
    if (subcommand === "auth") return handleAuth(interaction);
  },
};

async function handleList(interaction) {
  const all = guilds.getAll();

  if (all.length === 0) {
    return interaction.reply({
      content:
        "⚠️ No Hypixel guilds are registered yet.\n" +
        '> Add one with `/guilds add key:sb name:"My Guild" tag:SB account:you@example.com`.',
      ephemeral: true,
    });
  }

  const defaultKey = guilds.getDefault()?.key;

  const lines = all.map((guild) => {
    const marker = guild.key === defaultKey ? " ⭐" : "";
    const cross = guild.crossBridge === true ? " 🔁" : "";
    const officerCross =
      guild.crossBridge === true && guild.crossBridgeOfficer === true
        ? " 🛡️"
        : "";
    const ign = guild.mcName ? ` as \`${guild.mcName}\`` : "";
    return (
      `**${guild.name}** \`${guild.key}\` [${guild.tag}]${marker}${cross}${officerCross}\n` +
      `> ${mcBots.describeStatusLabel(guild.key)}${ign} · ${maskAccount(guild.account)} · ${guild.color}\n` +
      `> Log: ${guild.logChannelId ? `<#${guild.logChannelId}>` : "global"} · ` +
      `Audit: ${guild.auditChannelId ? `<#${guild.auditChannelId}>` : "global"} · ` +
      `Officer: ${guild.officerChannelId ? `<#${guild.officerChannelId}>` : "off"}`
    );
  });

  // Only worth explaining once at least one guild carries the marker.
  const crossFooter =
    guilds.getCrossBridged().length > 0
      ? " · 🔁 shares guild chat with the other 🔁 guilds"
      : "";
  const officerCrossFooter =
    guilds.getOfficerCrossBridged().length > 0
      ? " · 🛡️ shares officer chat too"
      : "";

  const embed = new EmbedBuilder()
    .setTitle("🌐 Hypixel guilds")
    .setColor(0xbd93f9)
    .setDescription(lines.join("\n\n").slice(0, 4096))
    .setFooter({
      text:
        (guilds.broadcastByDefault()
          ? "⭐ default · untagged messages go to every guild"
          : "⭐ default · untagged messages go to the default guild") +
        crossFooter +
        officerCrossFooter,
    });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAdd(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const result = guilds.add({
    key: interaction.options.getString("key"),
    name: interaction.options.getString("name"),
    tag: interaction.options.getString("tag"),
    account: interaction.options.getString("account"),
    color: interaction.options.getString("color") ?? undefined,
    addedBy: interaction.user.id,
  });

  if (!result.ok) return interaction.editReply(fail(result.reason));

  const guild = result.guild;
  await interaction.editReply(
    `✅ Registered **${guild.name}** \`${guild.key}\` [${guild.tag}].\n` +
      "> 🔄 Starting the Microsoft sign-in — the code will arrive here in a moment.\n" +
      `> Members can target this guild with \`!${guild.tag.toLowerCase()} message\`.`,
  );

  beginSignIn(guild.key, interaction);
}

async function handleRemove(interaction) {
  const key = guilds.resolveKey(interaction.options.getString("guild"));
  if (!key)
    return interaction.reply({ content: fail("unknown-key"), ephemeral: true });

  const guild = guilds.get(key);
  const isDefault = guilds.getDefault()?.key === key;

  if (
    isDefault &&
    guilds.count() > 1 &&
    !interaction.options.getBoolean("confirm")
  ) {
    return interaction.reply({
      content:
        `⚠️ **${guild.name}** is the default guild.\n` +
        "> Run this again with `confirm: True` to remove it. Another guild will become the default.",
      ephemeral: true,
    });
  }

  const record = mcBots.getRecord(key);
  if (record) {
    createMcBot.retireBot(record);
    bridge.mcBots.delete(key);
  }

  const result = guilds.remove(key);
  if (!result.ok)
    return interaction.reply({ content: fail(result.reason), ephemeral: true });

  const next = guilds.getDefault();
  return interaction.reply({
    content:
      `✅ Removed **${guild.name}** and disconnected its bot.\n` +
      (next
        ? `> **${next.name}** is now the default guild.\n`
        : "> No guilds remain.\n") +
      "> The account's cached Microsoft token is left in `.minecraft-auth/`; delete it by hand if you want it gone.",
    ephemeral: true,
  });
}

async function handleEdit(interaction) {
  const key = guilds.resolveKey(interaction.options.getString("guild"));
  if (!key)
    return interaction.reply({ content: fail("unknown-key"), ephemeral: true });

  const patch = {};

  const name = interaction.options.getString("name");
  if (name !== null) patch.name = name;

  const tag = interaction.options.getString("tag");
  if (tag !== null) patch.tag = tag;

  const color = interaction.options.getString("color");
  if (color !== null) patch.color = color;

  const enabled = interaction.options.getBoolean("enabled");
  if (enabled !== null) patch.enabled = enabled;

  const crossBridge = interaction.options.getBoolean("crossbridge");
  if (crossBridge !== null) patch.crossBridge = crossBridge;

  const crossBridgeOfficer =
    interaction.options.getBoolean("crossbridgeofficer");
  if (crossBridgeOfficer !== null)
    patch.crossBridgeOfficer = crossBridgeOfficer;

  const clear = interaction.options.getString("clear");
  if (clear === "log" || clear === "both") patch.logChannelId = null;
  if (clear === "audit" || clear === "both") patch.auditChannelId = null;
  if (clear === "officer") patch.officerChannelId = null;

  for (const [optionName, field] of [
    ["logchannel", "logChannelId"],
    ["auditchannel", "auditChannelId"],
    ["officerchannel", "officerChannelId"],
  ]) {
    const channel = interaction.options.getChannel(optionName);
    if (!channel) continue;

    const missing = missingPostPermissions(
      channel,
      interaction.guild.members.me,
    );
    if (missing.length > 0) {
      return interaction.reply({
        content: `❌ I cannot post in <#${channel.id}> — missing **${missing.join("**, **")}**.`,
        ephemeral: true,
      });
    }

    // An officer channel maps back to exactly one guild, because that lookup is
    // how a reply typed there knows where to go. Sharing one between two guilds
    // would silently deliver one guild's officers into the other's chat.
    if (field === "officerChannelId") {
      const owner = guilds.getByOfficerChannel(channel.id);
      if (owner && owner.key !== key) {
        return interaction.reply({
          content:
            `❌ <#${channel.id}> is already **${owner.name}**'s officer channel.\n` +
            "> Each guild needs its own, so replies typed there reach the right officer chat.",
          ephemeral: true,
        });
      }
    }

    patch[field] = channel.id;
  }

  const result = guilds.update(key, patch);
  if (!result.ok)
    return interaction.reply({ content: fail(result.reason), ephemeral: true });

  // A guild switched off should stop talking now, not at the next restart.
  if (patch.enabled === false) {
    const record = mcBots.getRecord(key);
    if (record) createMcBot.retireBot(record);
  }

  const guild = result.guild;

  const notes = [];

  // Turning it on for one guild does nothing on its own, and the admin has no
  // way to see that from this reply — say so rather than let them think it is
  // broken.
  const partners = guilds.getCrossBridged().filter((g) => g.key !== guild.key);
  if (patch.crossBridge === true) {
    notes.push(
      partners.length === 0
        ? "⚠️ No other guild has cross-bridging on yet, so nothing is shared until a second one does."
        : `🔁 Now sharing guild chat with **${partners.map((g) => g.name).join("**, **")}**.`,
    );
  }

  if (patch.crossBridgeOfficer === true) {
    const officerPartners = guilds
      .getOfficerCrossBridged()
      .filter((g) => g.key !== guild.key);

    // Stored but inert. Silence here looks exactly like a bug, because the
    // setting was accepted and nothing happens.
    if (guild.crossBridge !== true) {
      notes.push(
        "⚠️ Saved, but inert until `crossbridge` is on too — officer chat never " +
          "crosses between guilds that are not already sharing ordinary chat.",
      );
    } else if (officerPartners.length === 0) {
      notes.push(
        "⚠️ No other guild shares officer chat yet, so nothing is shared until a second one does.",
      );
    } else {
      notes.push(
        `🛡️ Now sharing officer chat with **${officerPartners.map((g) => g.name).join("**, **")}**.`,
      );
    }
  }

  // The one moment an admin is guaranteed to read this. The security of the
  // officer bridge is entirely this channel's Discord permissions.
  if (patch.officerChannelId) {
    notes.push(
      `🛡️ <#${patch.officerChannelId}> is **two-way** — everyone who can post there ` +
        "is speaking in officer chat in-game, so restrict it accordingly.",
      "The bot's account also needs a guild rank that can read and send officer chat, or replies go nowhere.",
    );
  }

  return interaction.reply({
    content:
      `✅ Updated **${guild.name}** \`${guild.key}\` [${guild.tag}].\n` +
      `> ${guild.enabled === false ? "Disabled" : "Enabled"} · ${guild.color} · ` +
      `Cross-bridge: ${guild.crossBridge === true ? "on" : "off"}` +
      `${guild.crossBridgeOfficer === true ? " (+ officer)" : ""} · ` +
      `Log: ${guild.logChannelId ? `<#${guild.logChannelId}>` : "global"} · ` +
      `Audit: ${guild.auditChannelId ? `<#${guild.auditChannelId}>` : "global"} · ` +
      `Officer: ${guild.officerChannelId ? `<#${guild.officerChannelId}>` : "off"}` +
      notes.map((note) => `\n> ${note}`).join(""),
    ephemeral: true,
  });
}

async function handleDefault(interaction) {
  const key = guilds.resolveKey(interaction.options.getString("guild"));
  if (!key)
    return interaction.reply({ content: fail("unknown-key"), ephemeral: true });

  const result = guilds.setDefault(key);
  if (!result.ok)
    return interaction.reply({ content: fail(result.reason), ephemeral: true });

  return interaction.reply({
    content:
      `✅ **${result.guild.name}** is now the default guild.\n` +
      "> Commands with no `guild` option will act on it.",
    ephemeral: true,
  });
}

async function handleAuth(interaction) {
  const key = guilds.resolveKey(interaction.options.getString("guild"));
  if (!key)
    return interaction.reply({ content: fail("unknown-key"), ephemeral: true });

  const guild = guilds.get(key);
  if (guild.enabled === false) {
    return interaction.reply({
      content: `⚠️ **${guild.name}** is disabled. Enable it first with \`/guilds edit\`.`,
      ephemeral: true,
    });
  }

  const record = mcBots.ensureRecord(key);
  if (record.connecting || record.awaitingDeviceCode) {
    return interaction.reply({
      content: `🔄 A sign-in for **${guild.name}** is already in progress.`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });
  await interaction.editReply(
    `🔄 Signing **${guild.name}** in as \`${maskAccount(guild.account)}\`.\n` +
      "> If a code is needed it will arrive here in a moment. If the cached token is still " +
      "good, the bot just reconnects.",
  );

  beginSignIn(key, interaction);
}
