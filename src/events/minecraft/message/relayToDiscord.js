const {EmbedBuilder} = require('discord.js');
const bridge = require('../../../bridge');
const guilds = require('../../../utils/guilds');
const mcBots = require('../../../utils/mcBots');
const {appliesToGuildChat, getTarget} = require('../../../utils/globalProfile');
const {auditGuildChatDisguise} = require('../../../utils/disguise');

// Two accounts sitting in the same Hypixel guild — a misconfiguration — would
// each relay the other's chat, doubling every line. This module is require-cached
// and therefore shared across every bot, which is what lets one bot see what
// another just relayed.
const RECENT_TTL_MS = 2000;
const RECENT_LIMIT = 200;
const recentlyRelayed = new Map();

/**
 * Whether this exact line was already relayed by a *different* guild's bot.
 *
 * A genuine false positive needs the same player name saying the same thing in
 * two guilds within two seconds, which already implies either the
 * misconfiguration above or a dual member — and in both cases the second copy
 * is noise.
 *
 * @param {string} guildKey
 * @param {string} username
 * @param {string} content
 * @returns {boolean}
 */
function isDuplicate(guildKey, username, content) {
    const now = Date.now();

    if (recentlyRelayed.size > RECENT_LIMIT) {
        for (const [key, entry] of recentlyRelayed) {
            if (now - entry.at > RECENT_TTL_MS) recentlyRelayed.delete(key);
        }
    }

    const signature = `${username.toLowerCase()}|${content}`;
    const previous = recentlyRelayed.get(signature);

    if (previous && previous.key !== guildKey && now - previous.at < RECENT_TTL_MS) {
        return true;
    }

    recentlyRelayed.set(signature, {key: guildKey, at: now});
    return false;
}

/**
 * The author line for a relayed message.
 *
 * The guild tag identifies the *source guild*, not the speaker, so it is
 * appended after the disguise resolves. It is omitted entirely while only one
 * guild is registered — there is nothing to disambiguate, and a tag nobody needs
 * is just noise.
 *
 * @param {string} username The Minecraft name that spoke.
 * @param {object} guild The Hypixel guild registry record.
 * @returns {{author: {name: string, iconURL: string|undefined}, disguised: boolean}}
 */
function resolveAuthor(username, guild) {
    const suffix = guilds.shouldShowTags() ? ` [${guild.tag}]` : '';

    if (appliesToGuildChat(username, bridge.discordChannelId)) {
        const target = getTarget();
        return {
            author: {name: `${target.name}${suffix}`, iconURL: target.avatarURL ?? undefined},
            disguised: true,
        };
    }

    return {
        author: {
            name: `${username}${suffix}`,
            iconURL: `https://mc-heads.net/avatar/${encodeURIComponent(username)}`,
        },
        disguised: false,
    };
}

module.exports = async (client, jsonMsg) => {
    // `client` is the emitting mineflayer bot, not the Discord client.
    if (client.tribridgeRetired) return;

    const guild = mcBots.guildForBot(client);
    if (!guild) return;

    const msg = jsonMsg.toString();
    // Clean up Minecraft formatting codes (§c, §6, etc.)
    const cleanMsg = msg.replace(/§./g, '');

    // Match guild chat: Guild > [Rank] Username [GuildRank]: message
    // Ranks (e.g. [VIP+], [MVP++]) and guild ranks (e.g. [Member], [Officer]) are optional
    const chatMatch = cleanMsg.match(/Guild > (?:\[.+?\] )?(\w{1,16})(?: \[.+?\])?: (.+)/);
    if (chatMatch) {
        const username = chatMatch[1];
        const content = chatMatch[2];

        // Ignore messages sent by any of the bot's own accounts, not just this
        // one: with a bot per guild, checking only the emitting account would
        // let two bots sharing a guild relay each other into a loop.
        if (mcBots.isOwnAccountName(username)) return;

        if (isDuplicate(guild.key, username, content)) return;

        const {author, disguised} = resolveAuthor(username, guild);

        try {
            const channel = await bridge.discordClient.channels.fetch(bridge.discordChannelId);
            const embed = new EmbedBuilder()
                .setAuthor(author)
                .setDescription(content)
                .setColor(guilds.colorOf(guild))
                .setTimestamp();

            await channel.send({embeds: [embed]});

            // The embed is the only copy of this message in Discord, so a
            // relabelled one needs the same audit trail as a Discord repost.
            if (disguised) await auditGuildChatDisguise(username, author.name, guild.key);
        } catch (error) {
            console.error(error);
        }
        return;
    }

    // Match guild join/leave messages: Guild > Username joined. / Guild > Username left.
    // Deliberately never disguised: these announce a real player arriving or
    // leaving, and relabelling them would just be a lie about who is online.
    const joinLeaveMatch = cleanMsg.match(/Guild > (\w{1,16}) (joined|left)\./);
    if (joinLeaveMatch) {
        const username = joinLeaveMatch[1];
        const action = joinLeaveMatch[2];

        if (isDuplicate(guild.key, username, action)) return;

        // Green/red stays semantic here rather than taking the guild's colour:
        // "joined" and "left" carry meaning that outranks branding. The tag on
        // the author line is what says which guild it was.
        const color = action === 'joined' ? 0x2ECC71 : 0xE74C3C;
        const emoji = action === 'joined' ? '🟢' : '🔴';
        const suffix = guilds.shouldShowTags() ? ` [${guild.tag}]` : '';

        try {
            const channel = await bridge.discordClient.channels.fetch(bridge.discordChannelId);
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: `${username}${suffix}`,
                    iconURL: `https://mc-heads.net/avatar/${encodeURIComponent(username)}`,
                })
                .setDescription(`${emoji} **${username}** ${action}.`)
                .setColor(color)
                .setTimestamp();

            await channel.send({embeds: [embed]});
        } catch (error) {
            console.error(error);
        }
    }
};
