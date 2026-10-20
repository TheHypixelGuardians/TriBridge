const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseMuteDuration,
  parseMuteResponse,
} = require("../src/utils/guildMute");

test("mute durations: one number and one unit, 1m to 30d", () => {
  assert.deepEqual(parseMuteDuration("30m"), {
    ok: true,
    value: "30m",
    ms: 1_800_000,
  });
  assert.equal(parseMuteDuration(" 2 D ").value, "2d");
  assert.equal(parseMuteDuration("30d").ok, true);
  assert.equal(parseMuteDuration("31d").ok, false);
  assert.equal(parseMuteDuration("0m").ok, false);
  assert.equal(parseMuteDuration("1h30m").ok, false);
  assert.equal(parseMuteDuration("forever").ok, false);
  assert.equal(parseMuteDuration(null).ok, false);
  // The value ends up in bot.chat(), so nothing but the match may survive.
  assert.equal(parseMuteDuration("1h\n/guild disband").ok, false);
});

const context = { action: "mute", username: "Notch", where: "the guild" };

test("mute replies: success only when no failure matched", () => {
  assert.equal(
    parseMuteResponse("[MVP+] Boss has muted Notch for 1h", {
      ...context,
      duration: "1h",
    }).ok,
    true,
  );
  assert.equal(
    parseMuteResponse("Notch is not in your guild!", context).ok,
    false,
  );
  assert.equal(
    parseMuteResponse("You must be the Guild Master to use that!", context).ok,
    false,
  );
  assert.equal(
    parseMuteResponse("Can't find a player by the name of 'Notch'", context).ok,
    false,
  );
});

test("unmute replies: not muted is a warning, not a success", () => {
  const unmute = { ...context, action: "unmute" };
  assert.equal(parseMuteResponse("Boss has unmuted Notch", unmute).ok, true);
  const notMuted = parseMuteResponse("Notch is not muted!", unmute);
  assert.equal(notMuted.ok, false);
  assert.match(notMuted.message, /^⚠️/);
});

test("mute replies: unknown output is shown, silence is reported", () => {
  const unknown = parseMuteResponse("Something new", context);
  assert.equal(unknown.ok, false);
  assert.match(unknown.message, /> Something new/);
  assert.match(parseMuteResponse("", context).message, /no response/);
});
