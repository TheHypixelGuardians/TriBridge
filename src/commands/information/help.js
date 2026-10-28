const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} = require("discord.js");
const path = require("path");
const getAllFiles = require("../../utils/getAllFiles");
const { isAdmin } = require("../../utils/adminRoles");

/** The privacy policy for both THG bots, linked from every help page. */
const PRIVACY_URL = "https://thehypixelguardians.mintlify.site/privacy";

/** Shown on every page, since /help leaves out what the member can't run. */
const MISSING_COMMAND_HINT =
  "-# Missing a command? You only see the ones your permissions in this server allow.";

/**
 * Converts a camelCase folder name into a readable title.
 * e.g. "chatScore" → "Chat Score", "admin" → "Admin"
 */
function parseCategoryName(folderName) {
  return folderName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Checks if a command requires admin permissions.
 */
function requiresAdminPermission(command) {
  if (!command.permissionsRequired) return false;

  const adminPerms = [PermissionFlagsBits.Administrator];

  return command.permissionsRequired.some((perm) => adminPerms.includes(perm));
}

/**
 * Whether a viewer may see a command in /help: bot-admin-only commands need a
 * bot-admin role, and `permissionsRequired` must all be held (Administrator
 * passes; outside a server, `permissions` is null and only commands without
 * any show). Mirrors the checks the commands themselves run.
 *
 * @param {{ adminOnly?: boolean, permissionsRequired?: bigint[] }} command
 * @param {{ botAdmin: boolean, permissions: { has(p: bigint): boolean } | null }} viewer
 */
function canSeeCommand(command, viewer) {
  if (command.adminOnly && !viewer.botAdmin) return false;
  if (!command.permissionsRequired?.length) return true;
  if (!viewer.permissions) return false;
  if (viewer.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return command.permissionsRequired.every((perm) =>
    viewer.permissions.has(perm),
  );
}

/** What decides which commands a member sees in /help. */
async function viewerOf(interaction) {
  return {
    botAdmin: await isAdmin(interaction.member),
    permissions: interaction.memberPermissions ?? null,
  };
}

/**
 * Builds an array of page objects, one per command category.
 * Each page has { category: string, entries: { line, adminOnly, permissionsRequired }[] }.
 * Result is cached so the filesystem is only scanned once per process.
 */
let cachedPages = null;

function buildHelpPages() {
  if (cachedPages) return cachedPages;

  const commandsDir = path.join(__dirname, "..", "..", "commands");
  const categories = getAllFiles(commandsDir, true).sort();
  const pages = [];

  for (const categoryPath of categories) {
    const categoryName = path.basename(categoryPath);
    const readableName = parseCategoryName(categoryName);
    const commandFiles = getAllFiles(categoryPath).sort();
    const entries = [];

    for (const commandFile of commandFiles) {
      const command = require(commandFile);
      if (command.deleted) continue;

      const adminEmoji = requiresAdminPermission(command) ? " ⛔" : "";
      const access = {
        adminOnly: Boolean(command.adminOnly),
        permissionsRequired: command.permissionsRequired,
      };
      const subcommands = (command.options || []).filter(
        (opt) =>
          opt.type === ApplicationCommandOptionType.Subcommand ||
          opt.type === 1,
      );

      if (subcommands.length > 0) {
        for (const sub of subcommands) {
          entries.push({
            ...access,
            line: `\`/${command.name} ${sub.name}\` —${adminEmoji} ${sub.description}`,
          });
        }
      } else {
        entries.push({
          ...access,
          line: `\`/${command.name}\` —${adminEmoji} ${command.description}`,
        });
      }
    }

    if (entries.length > 0) {
      pages.push({ category: readableName, entries });
    }
  }

  cachedPages = pages;
  return cachedPages;
}

/**
 * The pages one viewer gets: { category, lines }, without the commands they
 * can't see and without categories left empty.
 */
function helpPagesFor(viewer, pages = buildHelpPages()) {
  return pages
    .map((page) => ({
      category: page.category,
      lines: page.entries
        .filter((entry) => canSeeCommand(entry, viewer))
        .map((entry) => entry.line),
    }))
    .filter((page) => page.lines.length > 0);
}

/**
 * Constructs the embed for the given page index.
 */
function buildEmbed(pages, pageIndex) {
  const page = pages[pageIndex];

  const hint = `\n\n${MISSING_COMMAND_HINT}`;
  let description = page.lines.join("\n");
  if (description.length + hint.length > 4096) {
    description = description.substring(0, 4093 - hint.length) + "...";
  }
  description += hint;

  return new EmbedBuilder()
    .setTitle(`📖 Help — ${page.category}`)
    .setDescription(description)
    .setColor("#BD93F9")
    .setFooter({
      text:
        `Category ${pageIndex + 1} of ${pages.length}` +
        " · Problems or data requests: open a Support ticket",
    })
    .setTimestamp();
}

/**
 * Constructs the navigation button row.
 * Custom ID format: help_prev_{userId}_{currentPage} / help_next_{userId}_{currentPage}
 */
function buildButtons(pageIndex, totalPages, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`help_prev_${userId}_${pageIndex}`)
      .setLabel("◀ Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId(`help_next_${userId}_${pageIndex}`)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === totalPages - 1),
    new ButtonBuilder()
      .setLabel("Privacy policy")
      .setStyle(ButtonStyle.Link)
      .setURL(PRIVACY_URL),
  );
}

module.exports = {
  name: "help",
  description: "Browse all available commands by category.",

  callback: async (client, interaction) => {
    const pages = helpPagesFor(await viewerOf(interaction));

    if (pages.length === 0) {
      return interaction.reply({
        content: "No commands found.",
        ephemeral: true,
      });
    }

    const pageIndex = 0;
    const embed = buildEmbed(pages, pageIndex);
    const row = buildButtons(pageIndex, pages.length, interaction.user.id);

    const message = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    const timer = setTimeout(
      async () => {
        try {
          await message.edit({ components: [] });
        } catch {
          // Message may have been deleted; ignore.
        }
      },
      5 * 60 * 1000,
    );

    if (timer.unref) timer.unref();
  },

  buildHelpPages,
  helpPagesFor,
  viewerOf,
  canSeeCommand,
  buildEmbed,
  buildButtons,
  PRIVACY_URL,
};
