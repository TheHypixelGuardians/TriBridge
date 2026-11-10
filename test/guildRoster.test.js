const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const guilds = require("../src/utils/guilds");
const mcBots = require("../src/utils/mcBots");
const roster = require("../src/utils/guildRoster");

const ROSTER = [
  "§b--------- §6Guild§b ---------",
  "Guild Name: Example",
  "§2-- Guild Master --",
  "§b[MVP§c++§b] Boss §a●",
  "§2-- Member --",
  "§a[VIP] Notch §a●  §7Steve §c●  §b[MVP§c+§b] jeb_ §c●",
  "Total Members: 4",
];

/** A connected bot answering `/guild list` with the given lines. */
function fakeRecord(key, lines) {
  const bot = new EventEmitter();
  bot.tribridgeRetired = false;
  bot.sent = [];
  bot.chat = (text) => {
    bot.sent.push(text);
    setImmediate(() => {
      for (const text of lines)
        bot.emit("message", { toString: () => text, toMotd: () => text });
    });
  };
  return { key, bot, connected: true, queue: Promise.resolve() };
}

let records;
beforeEach(() => {
  mock.restoreAll();
  roster.clearCache();
  records = {};
  mock.method(mcBots, "getRecord", (key) => records[key] ?? null);
  mock.method(guilds, "getEnabled", () =>
    Object.keys(records).map((key) => ({ key, name: key })),
  );
});

test("reads every member, online or not, and nothing else", () => {
  const members = roster.parseRosterMembers(ROSTER);
  assert.deepEqual([...members].sort(), ["boss", "jeb_", "notch", "steve"]);
});

test("output that is not a roster is unknown, not empty", () => {
  assert.equal(roster.parseRosterMembers(["You are not in a guild."]), null);
  assert.deepEqual([...roster.parseRosterMembers(["Total Members: 0"])], []);
});

test("membership is found in any guild, and rosters are cached", async () => {
  records.alpha = fakeRecord("alpha", [
    "-- Member --",
    "Alice ●",
    "Total Members: 1",
  ]);
  records.beta = fakeRecord("beta", ROSTER);

  const result = await roster.findMembership("NOTCH");
  assert.deepEqual(
    result.guilds.map((g) => g.key),
    ["beta"],
  );
  assert.equal(result.inconclusive, false);

  await roster.findMembership("Steve");
  assert.equal(records.beta.bot.sent.length, 1);
});

test("a stranger is a clean miss only when every roster read", async () => {
  records.alpha = fakeRecord("alpha", ROSTER);
  assert.deepEqual(await roster.findMembership("Mallory"), {
    guilds: [],
    inconclusive: false,
  });

  records.beta = fakeRecord("beta", ROSTER);
  records.beta.connected = false;
  assert.equal((await roster.findMembership("Mallory")).inconclusive, true);
});

test("invalidate makes the next check ask again", async () => {
  records.alpha = fakeRecord("alpha", ROSTER);
  await roster.getMembers("alpha");
  roster.invalidate("alpha");
  await roster.getMembers("alpha");
  assert.equal(records.alpha.bot.sent.length, 2);
});
