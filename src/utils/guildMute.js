/**
 * Parsing for `/mute` and `/unmute`, kept out of the command files so it can be
 * tested offline.
 *
 * Hypixel's guild mute takes one number and one unit, `m`, `h` or `d`, for at
 * most 30 days (`/g mute <player> 1h`). That shape is from memory, not checked
 * against Hypixel's own help: if Hypixel rejects it, its reply is shown to the
 * admin, so a wrong guess fails visibly instead of silently.
 */

const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 };
const MAX_MS = 30 * UNIT_MS.d;

/**
 * Validates a mute duration and normalises it to Hypixel's form.
 *
 * @param {string} text e.g. `30m`, `12h`, `7d`, `2 D`.
 * @returns {{ok: true, value: string, ms: number}|{ok: false, reason: string}}
 */
function parseMuteDuration(text) {
  const match = /^(\d{1,5})\s*([mhd])$/i.exec(String(text ?? "").trim());
  if (!match) {
    return {
      ok: false,
      reason: "Use a number and one unit: `30m`, `12h` or `7d`.",
    };
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const ms = amount * UNIT_MS[unit];

  if (amount < 1) {
    return { ok: false, reason: "The duration has to be at least `1m`." };
  }
  if (ms > MAX_MS) {
    return { ok: false, reason: "Hypixel mutes last at most `30d`." };
  }

  return { ok: true, value: `${amount}${unit}`, ms };
}

/**
 * Reads the outcome of a `/g mute` or `/g unmute` out of Hypixel's reply.
 *
 * Every failure is checked **before** success. The success test is a loose
 * phrase match, and `/invite` once reported "✅ invited" for "has already been
 * invited" because its success test ran first; a failure line that happens to
 * contain the success phrase must never read as success.
 *
 * @param {string} combined Hypixel's reply lines, joined by newlines.
 * @param {{action: "mute"|"unmute", username: string, where: string,
 *   duration?: string}} context
 * @returns {{ok: boolean, message: string}}
 */
function parseMuteResponse(combined, { action, username, where, duration }) {
  const lower = combined.toLowerCase();
  const who = `**${username}**`;

  if (
    lower.includes("is not in your guild") ||
    lower.includes("not a member of your guild")
  ) {
    return { ok: false, message: `❌ ${who} is not a member of ${where}.` };
  }

  if (
    lower.includes("can't find a player") ||
    lower.includes("couldn't find a player") ||
    lower.includes("player not found")
  ) {
    return {
      ok: false,
      message: `❌ Could not find a player named ${who}.`,
    };
  }

  if (
    lower.includes("you don't have permission") ||
    lower.includes("you do not have permission") ||
    lower.includes("you must be")
  ) {
    return {
      ok: false,
      message: `❌ The bot's account does not have permission to ${action} members of ${where}.`,
    };
  }

  if (lower.includes("higher") && lower.includes("rank")) {
    return {
      ok: false,
      message: `❌ Cannot ${action} ${who}: they have the same or a higher guild rank than the bot.`,
    };
  }

  if (action === "unmute" && lower.includes("is not muted")) {
    return { ok: false, message: `⚠️ ${who} is not muted in ${where}.` };
  }

  if (
    lower.includes("invalid") &&
    (lower.includes("time") || lower.includes("duration"))
  ) {
    return {
      ok: false,
      message: `❌ Hypixel did not accept the duration \`${duration}\`.`,
    };
  }

  if (action === "mute" && lower.includes("has muted")) {
    return {
      ok: true,
      message: `✅ ${who} has been muted in ${where} for \`${duration}\`.`,
    };
  }

  if (action === "unmute" && lower.includes("has unmuted")) {
    return { ok: true, message: `✅ ${who} has been unmuted in ${where}.` };
  }

  const trimmed = combined.trim();
  if (trimmed) {
    return {
      ok: false,
      message:
        `⚠️ ${action === "mute" ? "Mute" : "Unmute"} command sent for ${who}. Server response:\n` +
        `> ${trimmed.split("\n").join("\n> ")}`,
    };
  }

  return {
    ok: false,
    message: `⚠️ ${action === "mute" ? "Mute" : "Unmute"} command sent for ${who}, but no response was received from the server.`,
  };
}

module.exports = { parseMuteDuration, parseMuteResponse, MAX_MS };
