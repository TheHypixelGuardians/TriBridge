const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const db = require("../src/utils/db");
const linkedAccounts = require("../src/utils/linkedAccounts");
const adminRoles = require("../src/utils/adminRoles");

const REPO_ROOT = path.join(__dirname, "..");

/**
 * `db.query` over an in-memory `tribridge.config` table plus, optionally, the
 * community bot's link rows. `communityLinks: null` makes that read fail, as it
 * does when the table is missing or the database is away.
 */
function fakeDatabase({ rows = {}, communityLinks = [] } = {}) {
  const statements = [];
  const query = async (text, params = []) => {
    statements.push(text);
    const [name, json] = params;
    if (text.includes("to_regclass")) return [{ present: true }];
    if (text.includes('"MinecraftLink"')) {
      return communityLinks === null ? null : structuredClone(communityLinks);
    }
    if (text.startsWith("SELECT data FROM tribridge.config")) {
      return name in rows ? [{ data: structuredClone(rows[name]) }] : [];
    }
    if (text.includes("DO UPDATE") || text.includes("DO NOTHING")) {
      rows[name] = JSON.parse(json);
      return [{ name }];
    }
    throw new Error(`Unexpected statement: ${text}`);
  };
  const reads = (needle) => statements.filter((s) => s.includes(needle));
  return { rows, query, reads };
}

beforeEach(() => {
  // Never read or write the real *Config.json files: they hold real ids.
  const realRead = fs.readFileSync;
  const isRepoConfig = (p) =>
    typeof p === "string" &&
    path.dirname(p) === REPO_ROOT &&
    /Config\.json(\.tmp)?$/.test(p);
  mock.method(fs, "readFileSync", (p, ...rest) => {
    if (isRepoConfig(p)) {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    }
    return realRead(p, ...rest);
  });
  mock.method(fs, "writeFileSync", () => {});
  mock.method(fs, "renameSync", () => {});
  mock.method(console, "log", () => {});
  mock.method(console, "error", () => {});
});

afterEach(() => mock.restoreAll());

const NOTCH = { uuid: "069a79f444e94726a5befca90e38aaf5", name: "Notch" };

test("first start copies the community links once, then never again", async () => {
  const database = fakeDatabase({
    communityLinks: [{ discordId: "1", uuid: NOTCH.uuid, name: "Notch" }],
  });
  mock.method(db, "query", database.query);

  await linkedAccounts.load();
  assert.deepEqual(await linkedAccounts.getLink("1"), {
    discordId: "1",
    ...NOTCH,
  });
  assert.deepEqual(database.rows.linkedAccounts, {
    links: { 1: NOTCH },
  });

  // The stored row now wins; the community table is not read again.
  database.rows.linkedAccounts = { links: {} };
  await linkedAccounts.load();
  assert.equal(database.reads('"MinecraftLink"').length, 1);
  assert.equal(await linkedAccounts.getLink("1"), null);
});

test("an empty copy is still stored, so the copy cannot run twice", async () => {
  const database = fakeDatabase({ communityLinks: [] });
  mock.method(db, "query", database.query);

  await linkedAccounts.load();
  assert.deepEqual(database.rows.linkedAccounts, { links: {} });
});

test("an unreadable community table starts empty and tries again next start", async () => {
  const database = fakeDatabase({ communityLinks: null });
  mock.method(db, "query", database.query);

  await linkedAccounts.load();
  assert.equal("linkedAccounts" in database.rows, false);
  assert.deepEqual(linkedAccounts.getAllLinks(), []);
});

test("setLink refuses an account another member holds, by name or by UUID", async () => {
  const database = fakeDatabase({
    rows: { linkedAccounts: { links: { 1: NOTCH } } },
  });
  mock.method(db, "query", database.query);
  await linkedAccounts.load();

  assert.deepEqual(await linkedAccounts.setLink("2", NOTCH), {
    ok: false,
    reason: "taken",
    discordId: "1",
  });
  // Renamed since, same account.
  assert.equal(
    (await linkedAccounts.setLink("2", { ...NOTCH, name: "Renamed" })).ok,
    false,
  );
  assert.deepEqual(database.rows.linkedAccounts.links, { 1: NOTCH });
});

test("setLink replaces a member's own link and reports the old one", async () => {
  const database = fakeDatabase({
    rows: { linkedAccounts: { links: { 1: NOTCH } } },
  });
  mock.method(db, "query", database.query);
  await linkedAccounts.load();

  const jeb = { uuid: "853c80ef3c3749fdaa49938b674adae6", name: "jeb_" };
  assert.deepEqual(await linkedAccounts.setLink("1", jeb), {
    ok: true,
    previous: NOTCH,
  });
  assert.deepEqual(await linkedAccounts.getLinkByName("JEB_"), {
    discordId: "1",
    ...jeb,
  });
  assert.deepEqual(database.rows.linkedAccounts.links, { 1: jeb });
});

test("removeLink returns the removed link, and null when there was none", async () => {
  const database = fakeDatabase({
    rows: { linkedAccounts: { links: { 1: NOTCH } } },
  });
  mock.method(db, "query", database.query);
  await linkedAccounts.load();

  assert.deepEqual(await linkedAccounts.removeLink("1"), NOTCH);
  assert.equal(await linkedAccounts.removeLink("1"), null);
  assert.deepEqual(database.rows.linkedAccounts.links, {});
});

function member(roleIds, serverId = "1") {
  return {
    guild: { id: serverId },
    roles: { cache: { some: (fn) => roleIds.some((id) => fn({ id })) } },
  };
}

test("isAdmin reads the community bot's shared AdminRole list and fails closed", async () => {
  let rows = [{ roleId: "10" }];
  mock.method(db, "query", async (text) => {
    assert.match(text, /"AdminRole"/);
    return rows;
  });

  assert.equal(await adminRoles.isAdmin(member(["10"])), true);
  assert.equal(await adminRoles.isAdmin(member(["11"])), false);
  assert.equal(await adminRoles.isAdmin(null), false);

  // A database that cannot be read is nobody's admin rights, even with a
  // matching role: /send runs arbitrary commands as the Minecraft account.
  rows = null;
  assert.equal(await adminRoles.isAdmin(member(["10"], "2")), false);
});
