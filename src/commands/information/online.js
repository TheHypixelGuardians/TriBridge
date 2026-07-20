const {EmbedBuilder} = require('discord.js');
const bridge = require('../../bridge');

module.exports = {
    name: 'online',
    description: 'Show currently online guild members in Minecraft.',

    callback: async (client, interaction) => {
        await interaction.deferReply();

        const mcBot = bridge.mcBot;
        if (!mcBot || !bridge.mcBotConnected) {
            return interaction.editReply('❌ The Minecraft bot is not connected.');
        }

        // Collect messages from the MC bot after sending /guild list
        const collectedMessages = [];
        let resolveCollector;
        let idleTimeout;

        // Create the promise first to ensure resolveCollector is set
        // before any listener or timeout callback can fire
        const collectorPromise = new Promise((resolve) => {
            resolveCollector = resolve;
        });

        const messageListener = (jsonMsg) => {
            collectedMessages.push(jsonMsg.toMotd());
            // Reset idle timer: resolve once no message arrives for 1 second
            if (idleTimeout) clearTimeout(idleTimeout);
            idleTimeout = setTimeout(() => resolveCollector(), 1000);
        };

        // Hard timeout of 5 seconds in case messages keep flowing
        const maxTimeout = setTimeout(() => resolveCollector(), 5000);

        mcBot.on('message', messageListener);
        mcBot.chat('/guild online');

        await collectorPromise;
        clearTimeout(maxTimeout);
        if (idleTimeout) clearTimeout(idleTimeout);
        mcBot.removeListener('message', messageListener);

        // Parse the collected messages
        const {ranks, totalOnline} = parseGuildList(collectedMessages);

        if (ranks.size === 0) {
            return interaction.editReply('❌ Could not retrieve the guild list. Please try again.');
        }

        // Build embed
        const embed = new EmbedBuilder()
            .setTitle('🟢 Online Guild Members')
            .setColor(0x2ECC71)
            .setFooter({text: `Total Online: ${totalOnline}`})
            .setTimestamp();

        let description = '';
        for (const [rank, players] of ranks) {
            if (players.length === 0) continue;
            description += `**${rank} [${players.length}]**\n`;
            description += players.join(', ') + '\n\n';
        }

        if (!description) {
            description = 'No online members found.';
        }

        if (description.length > 4096) {
            description = description.substring(0, 4093) + '...';
        }

        embed.setDescription(description.trim());

        await interaction.editReply({embeds: [embed]});
    },
};

/**
 * Parses collected Hypixel guild list messages to extract online members by rank.
 *
 * Hypixel guild list format (with Minecraft color codes):
 * - Rank headers: "-- RankName --" (after stripping §x codes)
 * - Player entries are separated by ● dots (activity indicators)
 * - Online players are colored with §a (green)
 * - Offline players are colored with §7 (gray) or §c (red)
 *
 * @param {string[]} rawMessages - Array of raw message strings with Minecraft color codes
 * @returns {{ ranks: Map<string, string[]>, totalOnline: number }}
 */
function parseGuildList(rawMessages) {
    const ranks = new Map();
    let currentRank = null;
    let totalOnline = 0;

    for (const raw of rawMessages) {
        const clean = raw.replace(/§./g, '');

        // Detect rank header: "-- RankName --"
        // Use anchored regex to avoid matching the guild banner (--------- Guild Name ---------)
        const trimmed = clean.trim();
        const rankMatch = trimmed.match(/^--\s+(.+?)\s+--$/);
        if (rankMatch) {
            currentRank = rankMatch[1].trim();
            if (!ranks.has(currentRank)) {
                ranks.set(currentRank, []);
            }
            continue;
        }

        // Skip summary lines and separators that appear after rank sections
        if (/^-+$/.test(trimmed) || /^(Total|Online|Offline) Members:/.test(trimmed) || /^Guild Name:/.test(trimmed)) {
            continue;
        }

        // Parse online players within a rank section
        if (currentRank) {
            // Split by ● (activity dots) to isolate individual player entries
            const segments = raw.split(/●+/);

            for (const segment of segments) {
                const cleanSegment = segment.replace(/§./g, '').trim();
                if (!cleanSegment) continue;

                // Only process online players (indicated by §a = green color)
                if (!segment.includes('§a')) continue;

                // Extract username: last alphanumeric word (1-16 chars) in the clean segment
                const nameMatch = cleanSegment.match(/(\w{1,16})\s*$/);
                if (nameMatch) {
                    ranks.get(currentRank).push(nameMatch[1]);
                    totalOnline++;
                }
            }
        }
    }

    return {ranks, totalOnline};
}
