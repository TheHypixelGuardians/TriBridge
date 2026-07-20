const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ApplicationCommandOptionType,
    PermissionFlagsBits,
} = require('discord.js');
const path = require('path');
const getAllFiles = require('../../utils/getAllFiles');

/**
 * Converts a camelCase folder name into a readable title.
 * e.g. "chatScore" → "Chat Score", "admin" → "Admin"
 */
function parseCategoryName(folderName) {
    return folderName
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
}

/**
 * Checks if a command requires admin permissions.
 */
function requiresAdminPermission(command) {
    if (!command.permissionsRequired) return false;

    const adminPerms = [
        PermissionFlagsBits.Administrator,
    ];

    return command.permissionsRequired.some(perm => adminPerms.includes(perm));
}

/**
 * Builds an array of page objects, one per command category.
 * Each page has { category: string, lines: string[] }.
 * Result is cached so the filesystem is only scanned once per process.
 */
let cachedPages = null;

function buildHelpPages() {
    if (cachedPages) return cachedPages;

    const commandsDir = path.join(__dirname, '..', '..', 'commands');
    const categories = getAllFiles(commandsDir, true).sort();
    const pages = [];

    for (const categoryPath of categories) {
        const categoryName = path.basename(categoryPath);
        const readableName = parseCategoryName(categoryName);
        const commandFiles = getAllFiles(categoryPath).sort();
        const lines = [];

        for (const commandFile of commandFiles) {
            const command = require(commandFile);
            if (command.deleted) continue;

            const adminEmoji = requiresAdminPermission(command) ? ' ⛔' : '';
            const subcommands = (command.options || []).filter(
                (opt) => opt.type === ApplicationCommandOptionType.Subcommand || opt.type === 1,
            );

            if (subcommands.length > 0) {
                for (const sub of subcommands) {
                    lines.push(`\`/${command.name} ${sub.name}\` —${adminEmoji} ${sub.description}`);
                }
            } else {
                lines.push(`\`/${command.name}\` —${adminEmoji} ${command.description}`);
            }
        }

        if (lines.length > 0) {
            pages.push({category: readableName, lines});
        }
    }

    cachedPages = pages;
    return cachedPages;
}

/**
 * Constructs the embed for the given page index.
 */
function buildEmbed(pages, pageIndex) {
    const page = pages[pageIndex];

    let description = page.lines.join('\n');
    if (description.length > 4096) {
        description = description.substring(0, 4093) + '...';
    }

    return new EmbedBuilder()
        .setTitle(`📖 Help — ${page.category}`)
        .setDescription(description)
        .setColor('#BD93F9')
        .setFooter({text: `Category ${pageIndex + 1} of ${pages.length}`})
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
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
        new ButtonBuilder()
            .setCustomId(`help_next_${userId}_${pageIndex}`)
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === totalPages - 1),
    );
}

module.exports = {
    name: 'help',
    description: 'Browse all available commands by category.',

    callback: async (client, interaction) => {
        const pages = buildHelpPages();

        if (pages.length === 0) {
            return interaction.reply({content: 'No commands found.', ephemeral: true});
        }

        const pageIndex = 0;
        const embed = buildEmbed(pages, pageIndex);
        const row = buildButtons(pageIndex, pages.length, interaction.user.id);

        const message = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true,
        });

        const timer = setTimeout(async () => {
            try {
                await message.edit({components: []});
            } catch {
                // Message may have been deleted; ignore.
            }
        }, 5 * 60 * 1000);

        if (timer.unref) timer.unref();
    },

    buildHelpPages,
    buildEmbed,
    buildButtons,
};
