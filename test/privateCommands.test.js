const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const bridge = require("../src/bridge");
const guilds = require("../src/utils/guilds");
const mcBots = require("../src/utils/mcBots");
const chatQueue = require("../src/utils/chatQueue");
const guildRoster = require("../src/utils/guildRoster");
const guildOnline = require("../src/utils/guildOnline");
const linkedAccounts = require("../src/utils/linkedAccounts");
const blacklist = require("../src/utils/blacklist");
const privateCommands = require("../src/utils/privateCommands");
const dmHandler = require("../src/events/minecraft/message/privateCommands");
const friendHandler = require("../src/events/minecraft/message/acceptFriendRequests");
const rosterHandler = require("../src/events/minecraft/message/trackRosterChanges");

const ALPHA = {
  key: "alpha",
  tag: "AL",
  name: "Alpha",
  enabled: true,
  privateCommands: true,
};
const BETA = { key: "beta", tag: "BE", name: "Beta", enabled: true };

const line = (text) => ({ toString: () => text });
const bot = { tribridgeRetired: false };
const record = { key: "alpha" };

let sent;
let members;
let guild;
beforeEach(() => {
  mock.restoreAll();
  privateCommands.reset();
  sent = [];
  members = { notch: [ALPHA], steve: [BETA] };
  guild = { ...ALPHA };
  bridge.discordServerId = "SERVER";
  mock.method(mcBots, "guildForBot", () => guild);
  mock.method(mcBots, "getRecord", (key) => ({ key }));
  mock.method(mcBots, "isConnected", () => true);
  mock.method(mcBots, "isOwnAccountName", (name) => name === "BridgeBot");
  mock.method(guilds, "getEnabled", () => [ALPHA, BETA]);
  mock.method(guilds, "getPrivateCommandGuilds", () => [ALPHA]);
  mock.method(chatQueue, "sendChat", async (rec, text) => {
    sent.push(`${rec.key}: ${text}`);
    return true;
  });
  mock.method(guildRoster, "findMembership", async (name) => ({
    guilds: members[name.toLowerCase()] ?? [],
    inconclusive: false,
  }));
  mock.method(linkedAccounts, "getLinkByName", async () => null);
  mock.method(blacklist, "isBlacklisted", async () => false);
  mock.method(guildOnline, "fetchOnline", async (rec) => ({
    ok: true,
    ranks: new Map([
      ["Member", rec.key === "alpha" ? ["Notch", "jeb_"] : ["Steve"]],
    ]),
    totalOnline: rec.key === "alpha" ? 2 : 1,
    totalMembers: 10,
  }));
});

test("every bundled command loads, with no name or alias claimed twice", () => {
  const names = privateCommands.list().map((c) => c.name);
  for (const name of [
    "help",
    "ping",
    "about",
    "online",
    "guilds",
    "members",
    "me",
  ]) {
    assert.ok(names.includes(name), name);
  }
  assert.equal(privateCommands.resolve("!o").name, "online");
});

test("the loader refuses a duplicate alias and an unknown permission", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pc-"));
  const write = (rel, body) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), `module.exports = ${body};`);
  };
  write("a/one.js", `{ name: "one", aliases: ["x"], run: async () => {} }`);
  write("b/two.js", `{ name: "two", aliases: ["x"], run: async () => {} }`);
  assert.throws(() => privateCommands.loadCommands(root), /both claim "x"/);

  fs.rmSync(path.join(root, "b"), { recursive: true });
  // A new file name, because require() caches by path.
  write(
    "b/three.js",
    `{ name: "three", permission: "admin", run: async () => {} }`,
  );
  assert.throws(() => privateCommands.loadCommands(root), /unknown permission/);
  fs.rmSync(root, { recursive: true });
});

test("parses the command and its arguments", () => {
  assert.deepEqual(privateCommands.parseCommand("!Online sb  2"), {
    name: "online",
    args: ["sb", "2"],
  });
  assert.equal(privateCommands.parseCommand("online"), null);
  assert.equal(privateCommands.parseCommand("!"), null);
});

test("a member's !online lists every guild by /msg", async () => {
  await dmHandler(bot, line("From [VIP] Notch: !online"));
  assert.deepEqual(sent, [
    "alpha: /msg Notch 3 online - !online <tag> for a full list",
    "alpha: /msg Notch [AL] 2: Notch, jeb_",
    "alpha: /msg Notch [BE] 1: Steve",
  ]);
});

test("!online <tag> lists one guild", async () => {
  await dmHandler(bot, line("From Steve: !online be"));
  assert.deepEqual(sent, [
    "alpha: /msg Steve [BE] 1 online",
    "alpha: /msg Steve Steve",
  ]);
});

test("nothing is answered while the guild has private commands off", async () => {
  guild = { ...ALPHA, privateCommands: false };
  await dmHandler(bot, line("From Notch: !online"));
  assert.deepEqual(sent, []);
});

test("another bridge bot's DM is never answered", async () => {
  members.bridgebot = [ALPHA];
  await dmHandler(bot, line("From BridgeBot: !help"));
  assert.deepEqual(sent, []);
});

test("a quoted DM in guild chat is not a command", async () => {
  await dmHandler(bot, line("Guild > Mallory: From Notch: !online"));
  assert.deepEqual(sent, []);
});

test("a non-member is refused and unfriended", async () => {
  await dmHandler(bot, line("From Mallory: !online"));
  assert.equal(sent.length, 2);
  assert.match(sent[0], /for members of the guilds/);
  assert.equal(sent[1], "alpha: /friend remove Mallory");
});

test("an unreadable roster refuses without unfriending", async () => {
  guildRoster.findMembership.mock.mockImplementation(async () => ({
    guilds: [],
    inconclusive: true,
  }));
  await dmHandler(bot, line("From Notch: !online"));
  assert.equal(sent.length, 1);
  assert.match(sent[0], /couldn't check/);
});

test("a blacklisted member is refused", async () => {
  linkedAccounts.getLinkByName.mock.mockImplementation(async () => ({
    discordId: "42",
    name: "Notch",
  }));
  blacklist.isBlacklisted.mock.mockImplementation(
    async (server, id) => server === "SERVER" && id === "42",
  );
  await dmHandler(bot, line("From Notch: !ping"));
  assert.deepEqual(sent, [
    "alpha: /msg Notch You are blacklisted from the bridge.",
  ]);
});

test("cooldowns: a silent gap per player, then per command", async () => {
  const run = (text, now) =>
    privateCommands.handleDirectMessage(record, ALPHA, "Notch", text, { now });
  assert.equal(await run("!online", 0), "ran");
  assert.equal(await run("!online", 1_000), "ignored");
  assert.equal(await run("!online", 4_000), "cooldown");
  assert.equal(await run("!ping", 8_000), "ran");
  assert.equal(await run("!online", 12_000), "ran");
});

test("unknown commands and plain chat get a pointer to !help, rarely", async () => {
  const run = (text, now) =>
    privateCommands.handleDirectMessage(record, ALPHA, "Notch", text, { now });
  assert.equal(await run("!nope", 0), "unknown");
  assert.equal(await run("hello", 1), "hint");
  assert.equal(await run("hello again", 2), "ignored");
  assert.match(sent[0], /Unknown command !nope/);
});

test("a member's friend request is accepted, a stranger's is not", async () => {
  await friendHandler(bot, line("Friend request from [VIP] Steve"));
  assert.deepEqual(sent, ["alpha: /friend accept Steve"]);

  sent.length = 0;
  await friendHandler(bot, line("Friend request from Mallory"));
  assert.deepEqual(sent, []);
});

test("a leaver is unfriended by every bot that answers private commands", async () => {
  await rosterHandler(bot, line("[VIP] Steve left the guild!"));
  assert.deepEqual(sent, ["alpha: /friend remove Steve"]);

  sent.length = 0;
  await rosterHandler(bot, line("[VIP] Steve joined the guild!"));
  assert.deepEqual(sent, []);
});
