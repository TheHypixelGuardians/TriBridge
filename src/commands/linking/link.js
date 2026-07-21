const {ApplicationCommandOptionType} = require('discord.js');
const bridge = require('../../bridge');
const {lookupProfile} = require('../../utils/mojang');
const {setLink, getLink} = require('../../utils/linkedAccounts');
const {applyLinkRole, describeFailure} = require('../../utils/linkRole');

async function sendLogMessage(message) {
    if (!bridge.logChannelId || !bridge.discordClient) return;
    try {
        const channel = await bridge.discordClient.channels.fetch(bridge.logChannelId);
        await channel.send(message);
    } catch (error) {
        console.error('Failed to send log channel notification:', error);
    }
}

/**
 * Searches collected `/guild list` output for a member.
 *
 * Hypixel guild list format (with Minecraft color codes):
 * - Rank headers: "-- RankName --" (after stripping §x codes)
 * - Player entries within a rank are separated by ● dots
 * - Both online and offline members are listed, so colour is ignored here
 * - A "Total Members: N" summary line closes the roster
 *
 * @param {string[]} rawMessages Raw message strings with colour codes.
 * @param {string} targetName Canonical Minecraft name to look for.
 * @returns {'found'|'absent'|'inconclusive'} 'inconclusive' when the output
 *   never looked like a roster at all (bot lagging, command rejected, format
 *   changed) — the caller fails open on that, but not on 'absent'.
 */
function findInRoster(rawMessages, targetName) {
    const target = targetName.toLowerCase();
    let sawRosterStructure = false;
    let found = false;

    for (const raw of rawMessages) {
        const clean = raw.replace(/§./g, '');
        const trimmed = clean.trim();

        if (/^--\s+(.+?)\s+--$/.test(trimmed) || /^(Total|Online|Offline) Members:/.test(trimmed)) {
            sawRosterStructure = true;
        }

        for (const segment of clean.split(/●+/)) {
            const cleanSegment = segment.trim();
            if (!cleanSegment) continue;

            const nameMatch = cleanSegment.match(/(\w{1,16})\s*$/);
            if (nameMatch && nameMatch[1].toLowerCase() === target) {
                found = true;
            }
        }
    }

    if (found) return 'found';
    return sawRosterStructure ? 'absent' : 'inconclusive';
}

module.exports = {
    name: 'link',
    description: 'Bind your Minecraft account to your Discord account.',
    options: [
        {
            name: 'username',
            description: 'Your Minecraft username.',
            type: ApplicationCommandOptionType.String,
            required: true,
        },
    ],

    callback: async (client, interaction) => {
        await interaction.deferReply({ephemeral: true});

        const requested = interaction.options.getString('username');

        // Resolve the canonical name and UUID first; the UUID is what keeps the
        // avatar working after a Minecraft name change.
        let profile;
        try {
            profile = await lookupProfile(requested);
        } catch (error) {
            console.error('Mojang lookup failed:', error);
            return interaction.editReply(
                '❌ Could not reach Mojang to verify that username. Please try again shortly.',
            );
        }

        if (!profile) {
            return interaction.editReply(
                `❌ No Minecraft account named \`${requested}\` exists.`,
            );
        }

        // Check guild membership against the live roster.
        let verdict = 'inconclusive';
        const mcBot = bridge.mcBot;

        if (mcBot && bridge.mcBotConnected) {
            const collectedMessages = [];
            let resolveCollector;
            let idleTimeout;

            const collectorPromise = new Promise((resolve) => {
                resolveCollector = resolve;
            });

            const messageListener = (jsonMsg) => {
                collectedMessages.push(jsonMsg.toMotd());
                if (idleTimeout) clearTimeout(idleTimeout);
                idleTimeout = setTimeout(() => resolveCollector(), 1500);
            };

            const maxTimeout = setTimeout(() => resolveCollector(), 5000);

            try {
                mcBot.on('message', messageListener);
                mcBot.chat('/guild list');
                await collectorPromise;
                verdict = findInRoster(collectedMessages, profile.name);
            } finally {
                clearTimeout(maxTimeout);
                if (idleTimeout) clearTimeout(idleTimeout);
                mcBot.removeListener('message', messageListener);
            }
        }

        if (verdict === 'absent') {
            return interaction.editReply(
                `❌ **${profile.name}** is not a member of the guild.\n` +
                '> Join the guild first, then run this command again.',
            );
        }

        const previous = getLink(interaction.user.id);
        const result = setLink(interaction.user.id, profile);

        if (!result.ok) {
            return interaction.editReply(
                `⚠️ **${profile.name}** is already linked to <@${result.discordId}>.\n` +
                '> If that is wrong, ask an admin to run `/unlink` on that user.',
            );
        }

        await sendLogMessage(
            `🔗 <@${interaction.user.id}> linked to **${profile.name}**` +
            (previous ? ` (was **${previous.name}**).` : '.'),
        );

        // The link stands either way — a role that cannot be granted is worth
        // telling an admin about, but not worth undoing the link over.
        const roleResult = await applyLinkRole(interaction.member, 'add');
        if (!roleResult.ok) {
            const failure = describeFailure(roleResult);
            if (failure) {
                await sendLogMessage(
                    `⚠️ Could not give the link role to <@${interaction.user.id}> — ${failure}.`,
                );
            }
        }

        const relinked = previous ? `\n> Replaced your previous link to **${previous.name}**.` : '';

        if (verdict === 'inconclusive') {
            return interaction.editReply(
                `⚠️ Linked you to **${profile.name}**, but guild membership could not be ` +
                'verified right now.\n' +
                '> An admin can undo this with `/unlink` if it was a mistake.' +
                relinked,
            );
        }

        return interaction.editReply(
            `✅ Linked you to **${profile.name}**.\n` +
            '> Your messages in the bridge channel will now show your Minecraft head and name.' +
            relinked,
        );
    },
};
