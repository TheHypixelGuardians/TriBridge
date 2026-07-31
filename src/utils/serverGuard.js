const bridge = require('../bridge');

/**
 * Whether an interaction came from the Discord server this bot instance serves.
 *
 * TriBridge is single-*server* by construction: one bridge channel, one flat
 * admin role list. (Hypixel guilds are a separate, plural concept — see
 * utils/guilds.js — and must never be confused with this one.) Commands
 * register globally though, so without this check anyone who can add the bot to
 * a server they own holds `Administrator` there, can `/adminrole add` a role
 * they control, and thereby inherits bot-admin — including `/send`, which runs
 * arbitrary commands as a Minecraft account — over the real server.
 *
 * Fails closed. An unresolved `bridge.discordServerId` refuses everything rather
 * than falling back to the old permissive behaviour, and DM interactions (where
 * `guildId` is null) are refused too, which also spares `isAdmin` the null
 * `interaction.member` it would otherwise throw on.
 *
 * Note `interaction.guildId` is discord.js's own name for the *server* id; it
 * is the library's terminology, not ours.
 *
 * @param {import('discord.js').Interaction} interaction
 * @returns {boolean}
 */
function isAllowedServer(interaction) {
    if (!bridge.discordServerId) return false;
    return interaction.guildId === bridge.discordServerId;
}

module.exports = {isAllowedServer};
