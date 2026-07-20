// Minecraft names are ASCII word characters only, at most 16 long. The lower
// bound is 1 rather than 3 because some legacy accounts predate the 3-char
// minimum.
const NAME_PATTERN = /^\w{1,16}$/;

/**
 * Whether a string is shaped like a Minecraft username.
 *
 * This is a security check, not a convenience one. Commands that interpolate a
 * username into `mcBot.chat()` bypass `buildGuildChatCommand`, and mineflayer
 * splits its argument on newlines and sends each line as its own packet — so an
 * unvalidated username containing a newline would put its second line at
 * *command* position, running arbitrary commands as the bot.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isValidMinecraftName(name) {
    return NAME_PATTERN.test(String(name ?? ''));
}

module.exports = { isValidMinecraftName, NAME_PATTERN };
