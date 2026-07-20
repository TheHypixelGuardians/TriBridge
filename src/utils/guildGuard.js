const bridge = require('../bridge');

/**
 * Whether an interaction came from the guild this bot instance serves.
 *
 * TriBridge is single-guild by construction: one bridge channel, one Minecraft
 * account, one flat admin role list. Commands register globally though, so
 * without this check anyone who can add the bot to a server they own holds
 * `Administrator` there, can `/adminrole add` a role they control, and thereby
 * inherits bot-admin — including `/send`, which runs arbitrary commands as the
 * Minecraft account — over the real guild.
 *
 * Fails closed. An unresolved `bridge.guildId` refuses everything rather than
 * falling back to the old permissive behaviour, and DM interactions (where
 * `guildId` is null) are refused too, which also spares `isAdmin` the null
 * `interaction.member` it would otherwise throw on.
 *
 * @param {import('discord.js').Interaction} interaction
 * @returns {boolean}
 */
function isAllowedGuild(interaction) {
    if (!bridge.guildId) return false;
    return interaction.guildId === bridge.guildId;
}

module.exports = {isAllowedGuild};
