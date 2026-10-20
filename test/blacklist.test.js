const { test, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../src/utils/db");
const blacklist = require("../src/utils/blacklist");

/**
 * A stand-in for `db.query` over an in-memory `Blacklist` table, answering
 * exactly the three statements blacklist.js issues.
 */
function fakeBlacklist(rows = []) {
  const reads = [];
  const query = async (text, params) => {
    const [guildId, discordId] = params;
    if (text.startsWith("SELECT")) {
      reads.push(guildId);
      return rows.filter((row) => row.guildId === guildId);
    }
    const index = rows.findIndex(
      (row) => row.guildId === guildId && row.discordId === discordId,
    );
    if (text.startsWith("INSERT")) {
      if (index !== -1) return [];
      rows.push({ guildId, discordId, createdAt: new Date() });
      return [{ discordId }];
    }
    if (text.startsWith("DELETE")) {
      if (index === -1) return [];
      rows.splice(index, 1);
      return [{ discordId }];
    }
    throw new Error(`Unexpected statement: ${text}`);
  };
  return { query, reads };
}

afterEach(() => mock.restoreAll());

test("blacklist: a write here applies at once, reads are cached", async () => {
  const table = fakeBlacklist();
  mock.method(db, "query", table.query);

  assert.equal(await blacklist.isBlacklisted("s1", "u1"), false);
  assert.equal(await blacklist.isBlacklisted("s1", "u1"), false);
  assert.equal(table.reads.length, 1);

  assert.equal(await blacklist.add("s1", "u1", { addedById: "a" }), "added");
  assert.equal(await blacklist.add("s1", "u1", { addedById: "a" }), "exists");
  assert.equal(await blacklist.isBlacklisted("s1", "u1"), true);
  // Scoped to the Discord server it was added in.
  assert.equal(await blacklist.isBlacklisted("s2", "u1"), false);

  assert.equal(await blacklist.remove("s1", "u1"), "removed");
  assert.equal(await blacklist.remove("s1", "u1"), "missing");
  assert.equal(await blacklist.isBlacklisted("s1", "u1"), false);
});

test("blacklist: an unreachable database lets members through", async () => {
  // db.query returns null for a failed query rather than rejecting.
  mock.method(db, "query", async () => null);

  assert.equal(await blacklist.isBlacklisted("s3", "u1"), false);
  assert.equal(await blacklist.getEntries("s3"), null);
  assert.equal(await blacklist.add("s3", "u1", { addedById: "a" }), "error");
  assert.equal(await blacklist.remove("s3", "u1"), "error");
});

test("blacklist: refusal answers each interaction type once", async () => {
  mock.method(
    db,
    "query",
    fakeBlacklist([{ guildId: "s4", discordId: "u1", createdAt: new Date() }])
      .query,
  );

  const calls = [];
  const interaction = (overrides) => ({
    guildId: "s4",
    user: { id: "u1" },
    replied: false,
    deferred: false,
    isAutocomplete: () => false,
    isRepliable: () => true,
    respond: async (choices) => calls.push(["respond", choices]),
    reply: async (options) => calls.push(["reply", options.content]),
    editReply: async (content) => calls.push(["editReply", content]),
    ...overrides,
  });

  assert.equal(
    await blacklist.refuseIfBlacklisted(
      interaction({ isAutocomplete: () => true }),
    ),
    true,
  );
  assert.equal(
    await blacklist.refuseIfBlacklisted(interaction({ deferred: true })),
    true,
  );
  assert.equal(await blacklist.refuseIfBlacklisted(interaction()), true);
  assert.equal(
    await blacklist.refuseIfBlacklisted(interaction({ user: { id: "u2" } })),
    false,
  );

  assert.deepEqual(calls, [
    ["respond", []],
    ["editReply", blacklist.REFUSAL],
    ["reply", blacklist.REFUSAL],
  ]);
});
