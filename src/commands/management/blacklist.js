const { ApplicationCommandOptionType } = require("discord.js");
const { isAdmin } = require("../../utils/adminRoles");
const blacklist = require("../../utils/blacklist");
const { logAudit } = require("../../utils/auditChannel");

// Room for a sentence, well inside the 2000-character reply that `list`
// builds from these.
const MAX_REASON = 200;

// Discord's message limit, with room for the header line.
const MAX_LIST = 1900;

const userOption = (description) => ({
  name: "user",
  description,
  type: ApplicationCommandOptionType.User,
  required: true,
});

module.exports = {
  name: "blacklist",
  description:
    "Block a member from both bots' commands and from the chat bridge.",
  // Bot-admin roles only (checked in the callback); /help lists it only for them.
  adminOnly: true,
  options: [
    {
      name: "add",
      description: "Blacklist a member.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        userOption("The member to blacklist."),
        {
          name: "reason",
          description: "Why, for the other admins. Not shown to the member.",
          type: ApplicationCommandOptionType.String,
          required: false,
          maxLength: MAX_REASON,
        },
      ],
    },
    {
      name: "remove",
      description: "Take a member off the blacklist.",
      type: ApplicationCommandOptionType.Subcommand,
      options: [userOption("The member to take off the blacklist.")],
    },
    {
      name: "list",
      description: "Show everyone on the blacklist.",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],

  callback: async (client, interaction) => {
    // Ephemeral, and deferred before the admin check: both checks below
    // are database reads, and the reply names who is blacklisted.
    await interaction.deferReply({ ephemeral: true });

    if (!(await isAdmin(interaction.member))) {
      return interaction.editReply(
        "❌ You do not have permission to use this command.",
      );
    }

    const serverId = interaction.guildId;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "list") {
      return interaction.editReply(await describeList(serverId));
    }

    const user = interaction.options.getUser("user");

    if (subcommand === "add") {
      if (user.bot) {
        return interaction.editReply("❌ Bots cannot be blacklisted.");
      }
      if (user.id === interaction.user.id) {
        return interaction.editReply("❌ You cannot blacklist yourself.");
      }
      // Otherwise one admin could lock another out of both bots, the
      // admin panel included. Taking their admin role away first keeps that
      // a decision for whoever manages the roles.
      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);
      if (member && (await isAdmin(member))) {
        return interaction.editReply(
          `❌ <@${user.id}> is a bot admin. Remove their admin role first.`,
        );
      }

      const reason = interaction.options.getString("reason")?.trim() || null;
      const outcome = await blacklist.add(serverId, user.id, {
        reason,
        addedById: interaction.user.id,
      });

      if (outcome === "error") {
        return interaction.editReply(
          "❌ Could not reach the database. Nothing was changed.",
        );
      }
      if (outcome === "exists") {
        return interaction.editReply(
          `⚠️ <@${user.id}> is already blacklisted.`,
        );
      }

      await logAudit(
        `⛔ <@${interaction.user.id}> blacklisted <@${user.id}> (\`${user.username}\`)` +
          (reason ? `\n> ${reason}` : ""),
      );
      return interaction.editReply(
        `✅ <@${user.id}> is now blacklisted from both bots.\n` +
          "> Their commands are refused and their messages are no longer " +
          "relayed into guild chat. The community bot picks this up within " +
          "15 seconds.",
      );
    }

    const outcome = await blacklist.remove(serverId, user.id);
    if (outcome === "error") {
      return interaction.editReply(
        "❌ Could not reach the database. Nothing was changed.",
      );
    }
    if (outcome === "missing") {
      return interaction.editReply(`⚠️ <@${user.id}> is not blacklisted.`);
    }

    await logAudit(
      `✅ <@${interaction.user.id}> took <@${user.id}> (\`${user.username}\`) off the blacklist`,
    );
    return interaction.editReply(`✅ <@${user.id}> is no longer blacklisted.`);
  },
};

/**
 * @param {string} serverId
 * @returns {Promise<string>}
 */
async function describeList(serverId) {
  const entries = await blacklist.getEntries(serverId);
  if (entries === null) {
    return "❌ Could not reach the database.";
  }
  if (entries.length === 0) {
    return "✅ Nobody is blacklisted.";
  }

  const header = `⛔ **Blacklisted members (${entries.length})**\n`;
  let body = "";
  for (const [index, entry] of entries.entries()) {
    const since = Math.floor(new Date(entry.createdAt).getTime() / 1000);
    const line =
      `- <@${entry.discordId}>, added by <@${entry.addedById}> <t:${since}:R>` +
      (entry.reason ? `\n> ${entry.reason}` : "") +
      "\n";
    if (header.length + body.length + line.length > MAX_LIST) {
      body += `…and ${entries.length - index} more.`;
      break;
    }
    body += line;
  }
  return header + body;
}
