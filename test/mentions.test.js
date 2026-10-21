const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const bridge = require("../src/bridge");
const linkedAccounts = require("../src/utils/linkedAccounts");
const {
  resolveMentions,
  mentionPayload,
  pickMember,
  clearCache,
  MAX_MENTIONS,
} = require("../src/utils/mentions");

const member = (
  id,
  username,
  { globalName = null, nickname = null, bot = false } = {},
) => ({
  id,
  nickname,
  user: { username, globalName, bot },
});

const MEMBERS = [
  member("1", "alice", { globalName: "Alice W", nickname: "Ali" }),
  member("2", "bob_builder", { globalName: "Bob" }),
  member("3", "carol", { nickname: "Sam" }),
  member("4", "dave", { nickname: "Sam" }),
  member("5", "helperbot", { bot: true }),
];

let searches;
beforeEach(() => {
  mock.restoreAll();
  clearCache();
  searches = [];
  mock.method(linkedAccounts, "getLinkByName", async (name) =>
    name.toLowerCase() === "notch" ? { discordId: "99", name: "Notch" } : null,
  );
  bridge.discordServerId = "SERVER";
  bridge.discordClient = {
    guilds: {
      fetch: async () => ({
        members: {
          search: async ({ query }) => {
            searches.push(query);
            const q = query.toLowerCase();
            return new Map(
              MEMBERS.filter((m) =>
                [m.user.username, m.nickname].some((n) =>
                  n?.toLowerCase().startsWith(q),
                ),
              ).map((m) => [m.id, m]),
            );
          },
        },
      }),
    },
  };
});

test("a username mention is replaced and pinged", async () => {
  const result = await resolveMentions("hey @alice look");
  assert.equal(result.text, "hey <@1> look");
  assert.deepEqual(result.userIds, ["1"]);
});

test("a linked Minecraft name pings the linked Discord user without a search", async () => {
  const result = await resolveMentions("@Notch gg");
  assert.equal(result.text, "<@99> gg");
  assert.deepEqual(result.userIds, ["99"]);
  assert.deepEqual(searches, []);
});

test("unknown names and email-like text are left alone", async () => {
  const result = await resolveMentions("mail me@alice.com or @nobody");
  assert.equal(result.text, "mail me@alice.com or @nobody");
  assert.deepEqual(result.userIds, []);
});

test("a trailing full stop is not part of the name", async () => {
  const result = await resolveMentions("thanks @alice.");
  assert.equal(result.text, "thanks <@1>.");
});

test("a shared nickname pings nobody, a unique one pings its owner", async () => {
  assert.equal(pickMember(MEMBERS, "Sam"), null);
  assert.equal(pickMember(MEMBERS, "ali"), "1");
  assert.equal(pickMember(MEMBERS, "bob"), "2");
});

test("bots are never resolved", async () => {
  assert.equal(pickMember(MEMBERS, "helperbot"), null);
});

test("the same name twice pings once", async () => {
  const result = await resolveMentions("@alice @alice @ALICE");
  assert.equal(result.text, "<@1> <@1> <@1>");
  assert.deepEqual(result.userIds, ["1"]);
});

test("lookups are cached", async () => {
  await resolveMentions("@alice");
  await resolveMentions("@alice");
  assert.equal(searches.length, 1);
});

test("no more than MAX_MENTIONS people are pinged by one line", async () => {
  const names = [
    "alice",
    "bob_builder",
    "carol",
    "dave",
    "Notch",
    "Ali",
    "x1",
    "x2",
  ];
  const result = await resolveMentions(names.map((n) => `@${n}`).join(" "));
  assert.ok(result.userIds.length <= MAX_MENTIONS);
});

test("a failed search drops the ping, not the message", async () => {
  mock.method(console, "error", () => {});
  bridge.discordClient.guilds.fetch = async () => {
    throw new Error("Discord is down");
  };
  const result = await resolveMentions("hi @alice");
  assert.equal(result.text, "hi @alice");
  assert.deepEqual(result.userIds, []);
});

test("the payload allows exactly the resolved users and never @everyone", () => {
  assert.deepEqual(mentionPayload(["1", "2"]), {
    content: "<@1> <@2>",
    allowedMentions: { parse: [], users: ["1", "2"] },
  });
  assert.deepEqual(mentionPayload([]), {
    allowedMentions: { parse: [], users: [] },
  });
});
