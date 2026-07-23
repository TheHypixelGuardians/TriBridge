const {EmbedBuilder} = require('discord.js');
const bridge = require('../../../bridge');
const {appliesToGuildChat, getTarget} = require('../../../utils/globalProfile');
const {auditGuildChatDisguise} = require('../../../utils/disguise');

/**
 * Works out the name and icon a guild chat message should appear under in
 * Discord. While a global profile change is running the bridge channel is kept
 * uniform: Minecraft players wear the same face as everybody else.
 *
 * @param {string} username The Minecraft name that spoke.
 * @returns {{author: {name: string, iconURL: string|undefined}, disguised: boolean}}
 */
function resolveAuthor(username) {
    if (appliesToGuildChat(username, bridge.discordChannelId)) {
        const target = getTarget();
        return {
            author: {name: target.name, iconURL: target.avatarURL ?? undefined},
            disguised: true,
        };
    }

    return {
        author: {
            name: username,
            iconURL: `https://mc-heads.net/avatar/${encodeURIComponent(username)}`,
        },
        disguised: false,
    };
}

module.exports = async (client, jsonMsg) => {
    const msg = jsonMsg.toString();
    // Clean up Minecraft formatting codes (§c, §6, etc.)
    const cleanMsg = msg.replace(/§./g, '');

    // Match guild chat: Guild > [Rank] Username [GuildRank]: message
    // Ranks (e.g. [VIP+], [MVP++]) and guild ranks (e.g. [Member], [Officer]) are optional
    const chatMatch = cleanMsg.match(/Guild > (?:\[.+?\] )?(\w{1,16})(?: \[.+?\])?: (.+)/);
    if (chatMatch) {
        const username = chatMatch[1];
        const content = chatMatch[2];

        // Ignore messages sent by the bot itself to prevent relay loops
        if (username === bridge.mcBot?.username) return;

        const {author, disguised} = resolveAuthor(username);

        try {
            const channel = await bridge.discordClient.channels.fetch(bridge.discordChannelId);
            const embed = new EmbedBuilder()
                .setAuthor(author)
                .setDescription(content)
                .setColor(0x2ECC71)
                .setTimestamp();

            await channel.send({embeds: [embed]});

            // The embed is the only copy of this message in Discord, so a
            // relabelled one needs the same audit trail as a Discord repost.
            if (disguised) await auditGuildChatDisguise(username, author.name);
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
        const color = action === 'joined' ? 0x2ECC71 : 0xE74C3C;
        const emoji = action === 'joined' ? '🟢' : '🔴';

        try {
            const channel = await bridge.discordClient.channels.fetch(bridge.discordChannelId);
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: username,
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
