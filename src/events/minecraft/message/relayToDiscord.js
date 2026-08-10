const {EmbedBuilder} = require('discord.js');
const bridge = require('../../../bridge');
const guilds = require('../../../utils/guilds');
const mcBots = require('../../../utils/mcBots');
const {appliesToGuildChat, getTarget} = require('../../../utils/globalProfile');
const {auditGuildChatDisguise} = require('../../../utils/disguise');
const {parseGuildChat, parseGuildPresence} = require('../../../utils/guildChat');
const {createRelayDedupe} = require('../../../utils/relayDedupe');

// Two accounts sitting in the same Hypixel guild — a misconfiguration — would
// each relay the other's chat, doubling every line. This module is
// require-cached and therefore shared across every bot, which is what lets one
// bot see what another just relayed.
const isDuplicate = createRelayDedupe();

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

    // The guild-chat formats themselves live in utils/guildChat.js, shared with
    // the guild-to-guild relay.
    const chatMatch = parseGuildChat(cleanMsg);
    if (chatMatch) {
        const {username, content} = chatMatch;

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

    // Join/leave. Deliberately never disguised: these announce a real player
    // arriving or leaving, and relabelling them would just be a lie about who is
    // online.
    const joinLeaveMatch = parseGuildPresence(cleanMsg);
    if (joinLeaveMatch) {
        const {username, action} = joinLeaveMatch;

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
