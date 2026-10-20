const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isValidMinecraftName } = require("../src/utils/minecraftName");
const { createRelayDedupe } = require("../src/utils/relayDedupe");
const { parseDuration, formatDuration } = require("../src/utils/duration");
const areCommandsDifferent = require("../src/utils/areCommandsDifferent");

test("Minecraft names: word characters only, at most 16", () => {
  assert.equal(isValidMinecraftName("Notch_1"), true);
  assert.equal(isValidMinecraftName("a".repeat(17)), false);
  assert.equal(isValidMinecraftName("Steve\n/guild disband"), false);
  assert.equal(isValidMinecraftName(""), false);
});

test("relay dedupe drops the same line seen by a second guild's bot", () => {
  const isDuplicate = createRelayDedupe();
  assert.equal(isDuplicate("alpha", "Notch", "hi"), false);
  assert.equal(isDuplicate("beta", "notch", "hi"), true);
  // The same guild saying it twice is a real repeat, not a duplicate.
  assert.equal(isDuplicate("alpha", "Notch", "hi"), false);
});

test("durations parse and format", () => {
  assert.deepEqual(parseDuration("2h30m"), { ok: true, ms: 9_000_000 });
  assert.deepEqual(parseDuration("45"), { ok: true, ms: 2_700_000 });
  assert.deepEqual(parseDuration("forever"), { ok: true, ms: null });
  assert.deepEqual(parseDuration("soon"), { ok: false });
  assert.equal(formatDuration(null), "indefinite");
});

test("command diff ignores Discord's omitted defaults but sees real changes", () => {
  const local = {
    name: "kick",
    description: "Kick",
    options: [
      { name: "username", description: "Who", type: 3, required: false },
    ],
  };
  const registered = {
    name: "kick",
    description: "Kick",
    options: [{ name: "username", description: "Who", type: 3 }],
  };
  assert.equal(areCommandsDifferent(registered, local), false);
  assert.equal(
    areCommandsDifferent(registered, { ...local, description: "Kick someone" }),
    true,
  );
});

test("command diff sees default member permissions come and go", () => {
  const local = { name: "pingdiamond", description: "Ping" };
  // discord.js always gives a registered command an options array.
  const registered = { ...local, options: [], defaultMemberPermissions: null };
  assert.equal(areCommandsDifferent(registered, local), false);

  const gated = { ...local, defaultMemberPermissions: 1n << 28n };
  assert.equal(areCommandsDifferent(registered, gated), true);
  assert.equal(
    areCommandsDifferent(
      { ...registered, defaultMemberPermissions: { bitfield: 1n << 28n } },
      gated,
    ),
    false,
  );
  assert.equal(
    areCommandsDifferent(
      { ...registered, defaultMemberPermissions: { bitfield: 1n << 28n } },
      local,
    ),
    true,
  );
});
