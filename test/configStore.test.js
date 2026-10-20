const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const db = require("../src/utils/db");
const store = require("../src/utils/configStore");
const guilds = require("../src/utils/guilds");
const globalProfile = require("../src/utils/globalProfile");

/**
 * A stand-in for `db.query` over an in-memory `tribridge.config` table. It
 * understands exactly the statements configStore issues, and nothing else, so
 * a new statement fails the test rather than passing silently.
 */
function fakeTable(rows = {}, { tableExists = true } = {}) {
  const statements = [];
  const query = async (text, params = []) => {
    statements.push(text);
    const [name, json] = params;
    if (text.includes("to_regclass")) return [{ present: tableExists }];
    if (text.startsWith("CREATE TABLE")) tableExists = true;
    if (text.startsWith("CREATE")) return [];
    if (text.startsWith("SELECT")) {
      return name in rows ? [{ data: structuredClone(rows[name]) }] : [];
    }
    if (text.includes("DO NOTHING")) {
      if (name in rows) return [];
      rows[name] = JSON.parse(json);
      return [{ name }];
    }
    if (text.includes("DO UPDATE")) {
      rows[name] = JSON.parse(json);
      return [{ name }];
    }
    throw new Error(`Unexpected statement: ${text}`);
  };
  const inserts = () => statements.filter((s) => s.startsWith("INSERT"));
  const creates = () => statements.filter((s) => s.startsWith("CREATE"));
  return { rows, query, inserts, creates };
}

/**
 * Serves `content` for one path and leaves every other file alone, so a test
 * can pose as a module's legacy config without touching the real one.
 */
function fakeLegacyFile(filePath, content) {
  const realRead = fs.readFileSync;
  const realExists = fs.existsSync;
  mock.method(fs, "readFileSync", (p, ...rest) => {
    if (p !== filePath) return realRead(p, ...rest);
    if (content === null) {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    }
    return content;
  });
  mock.method(fs, "existsSync", (p) =>
    p === filePath ? content !== null : realExists(p),
  );
}

let tmpDir;
let repoWrites;
const identity = (raw) => ({ ...raw });
const REPO_ROOT = path.join(__dirname, "..");

beforeEach(() => {
  // The real *Config.json files may hold ids and account addresses: a test
  // that forgets to fake one sees no file rather than reading it.
  const realRead = fs.readFileSync;
  mock.method(fs, "readFileSync", (p, ...rest) => {
    if (
      typeof p === "string" &&
      path.dirname(p) === REPO_ROOT &&
      p.endsWith("Config.json")
    ) {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    }
    return realRead(p, ...rest);
  });
  // ...and their snapshots are never written either. Recorded instead, so a
  // test can check what would have landed there.
  repoWrites = new Map();
  const isRepoConfig = (p) =>
    typeof p === "string" &&
    path.dirname(p) === REPO_ROOT &&
    /Config\.json(\.tmp)?$/.test(p);
  const realWrite = fs.writeFileSync;
  const realRename = fs.renameSync;
  mock.method(fs, "writeFileSync", (p, data, ...rest) => {
    if (!isRepoConfig(p)) return realWrite(p, data, ...rest);
    repoWrites.set(p, String(data));
  });
  mock.method(fs, "renameSync", (from, to) => {
    if (!isRepoConfig(from)) return realRename(from, to);
    repoWrites.set(to, repoWrites.get(from));
    repoWrites.delete(from);
  });
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tribridge-config-"));
  mock.method(console, "log", () => {});
  mock.method(console, "error", () => {});
});

afterEach(() => {
  mock.restoreAll();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeLegacy(name, value) {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(
    file,
    typeof value === "string" ? value : JSON.stringify(value),
  );
  return file;
}

test("empty database and a legacy file: the file is imported once", async () => {
  const table = fakeTable();
  mock.method(db, "query", table.query);
  const file = writeLegacy("auditChannelConfig.json", { channelId: "123" });

  const first = await store.load("auditChannel", file, identity);
  assert.deepEqual(first, { data: { channelId: "123" }, stored: true });
  assert.deepEqual(table.rows.auditChannel, { channelId: "123" });
  assert.match(
    console.log.mock.calls[0].arguments[0],
    /Imported auditChannelConfig\.json/,
  );

  // A second start reads the row and never imports again.
  fs.writeFileSync(file, JSON.stringify({ channelId: "999" }));
  const second = await store.load("auditChannel", file, identity);
  assert.deepEqual(second.data, { channelId: "123" });
  assert.equal(table.inserts().length, 1);

  // The file stays, now as a snapshot of the row rather than its own copy.
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf-8")), {
    channelId: "123",
  });
});

test("a stored config wins: the legacy file is ignored", async () => {
  const table = fakeTable({ auditChannel: { channelId: "from-db" } });
  mock.method(db, "query", table.query);
  const file = writeLegacy("auditChannelConfig.json", {
    channelId: "from-file",
  });

  const result = await store.load("auditChannel", file, identity);
  assert.deepEqual(result, { data: { channelId: "from-db" }, stored: true });
  assert.equal(table.inserts().length, 0);
});

test("no row and no file: defaults, nothing stored", async () => {
  const table = fakeTable();
  mock.method(db, "query", table.query);

  const result = await store.load(
    "auditChannel",
    path.join(tmpDir, "missing.json"),
    (raw) => raw ?? { channelId: null },
  );
  assert.deepEqual(result, { data: { channelId: null }, stored: false });
  assert.equal(table.inserts().length, 0);
});

test("a corrupt legacy file with no row stops the load", async () => {
  const table = fakeTable();
  mock.method(db, "query", table.query);
  for (const content of ["{ not json", "[1, 2]", "null"]) {
    const file = writeLegacy("broken.json", content);
    await assert.rejects(
      store.load("broken", file, (raw) => raw ?? {}),
      /broken\.json is not a JSON object/,
    );
    assert.ok(fs.existsSync(file));
  }
  assert.equal(table.inserts().length, 0);
});

test("a corrupt legacy file is ignored once a row exists", async () => {
  const table = fakeTable({ broken: { value: 1 } });
  mock.method(db, "query", table.query);
  const file = writeLegacy("broken.json", "{ not json");
  const result = await store.load("broken", file, identity);
  assert.deepEqual(result, { data: { value: 1 }, stored: true });
});

test("an unreadable database stops the load instead of using defaults", async () => {
  mock.method(db, "query", async () => null);
  await assert.rejects(
    store.load("guilds", path.join(tmpDir, "none.json"), identity),
    /Could not check/,
  );
});

test("the table is created on the first start only", async () => {
  const table = fakeTable({}, { tableExists: false });
  mock.method(db, "query", table.query);
  const none = path.join(tmpDir, "none.json");

  await store.load("guilds", none, identity);
  assert.equal(table.creates().length, 2);

  // Later starts need no CREATE privilege at all.
  await store.load("guilds", none, identity);
  await store.load("globalProfile", none, identity);
  assert.equal(table.creates().length, 2);
});

/** Like `table.query`, except that every save fails. */
function failingSaves(table) {
  return async (text, params) =>
    text.includes("DO UPDATE") ? null : table.query(text, params);
}

test("changes run one at a time, each from the last saved document", async () => {
  const table = fakeTable();
  let first = true;
  mock.method(db, "query", async (text, params) => {
    if (first) {
      first = false;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return table.query(text, params);
  });

  let doc = { a: 0, b: 0 };
  const current = () => doc;
  const apply = (saved) => {
    doc = saved;
  };
  await Promise.all([
    store.commit("order", current, (d) => (d.a = 1), apply),
    store.commit("order", current, (d) => (d.b = 2), apply),
  ]);
  assert.deepEqual(doc, { a: 1, b: 2 });
  assert.deepEqual(table.rows.order, { a: 1, b: 2 });
});

test("a failed save rejects and leaves the cache untouched", async () => {
  mock.method(db, "query", async () => null);
  let doc = { value: 1 };
  await assert.rejects(
    store.commit(
      "x",
      () => doc,
      (d) => (d.value = 2),
      (saved) => (doc = saved),
    ),
    /Could not save/,
  );
  assert.deepEqual(doc, { value: 1 });
});

test("a change that leaves the document alone saves nothing", async () => {
  const table = fakeTable();
  mock.method(db, "query", table.query);
  const result = await store.commit(
    "x",
    () => ({ value: 1 }),
    () => ({ ok: false, reason: "invalid" }),
    () => assert.fail("nothing to apply"),
  );
  assert.deepEqual(result, { ok: false, reason: "invalid" });
  assert.equal(table.inserts().length, 0);
});

test("global profile: a start that cannot be saved leaves nothing running", async () => {
  const table = fakeTable({ globalProfile: {} });
  mock.method(db, "query", failingSaves(table));
  await globalProfile.load();

  await assert.rejects(
    globalProfile.start({
      target: { userId: "1", name: "Target" },
      durationMs: null,
      startedBy: "2",
      mode: "live",
    }),
  );
  assert.equal(globalProfile.isActive(), false);
  assert.equal(globalProfile.getState().mode, "off");
});

test("global profile: a stop that cannot be saved leaves it running", async () => {
  const table = fakeTable({
    globalProfile: {
      mode: "live",
      target: { userId: "1", name: "Target" },
      expiresAt: null,
    },
  });
  mock.method(db, "query", failingSaves(table));
  await globalProfile.load();

  await assert.rejects(globalProfile.stop());
  assert.equal(globalProfile.isActive(), true);
  assert.equal(table.rows.globalProfile.mode, "live");
});

test("guilds: a failed edit is not applied, nor saved by a later one", async () => {
  const table = fakeTable({
    guilds: {
      defaultKey: "sb",
      guilds: [{ key: "sb", tag: "SB", name: "Sky", enabled: true }],
    },
  });
  mock.method(db, "query", failingSaves(table));
  await guilds.load();

  await assert.rejects(guilds.update("sb", { tag: "NEW" }));
  assert.equal(guilds.get("sb").tag, "SB");

  mock.method(db, "query", table.query);
  await guilds.update("sb", { name: "Skyblock" });
  assert.equal(table.rows.guilds.guilds[0].tag, "SB");
  assert.equal(table.rows.guilds.guilds[0].name, "Skyblock");
});

test("guilds: a hand-edited legacy file is normalised on import", async () => {
  const table = fakeTable();
  mock.method(db, "query", table.query);
  fakeLegacyFile(
    guilds.CONFIG_PATH,
    JSON.stringify({
      defaultKey: "sb",
      broadcastByDefault: "false",
      guilds: [{ key: "sb", tag: "SB", name: "Sky" }, null, 5],
    }),
  );

  await guilds.load();

  assert.deepEqual(table.rows.guilds, {
    version: 1,
    defaultKey: "sb",
    broadcastByDefault: true,
    guilds: [{ key: "sb", tag: "SB", name: "Sky" }],
  });
  assert.equal(guilds.get("sb").name, "Sky");
  assert.equal(guilds.resolveKey("sb"), "sb");
});

test("guilds: writes go to the database, and the registry survives a reload", async () => {
  const table = fakeTable();
  mock.method(db, "query", table.query);
  fakeLegacyFile(guilds.CONFIG_PATH, null);
  const previousAccount = process.env.MINECRAFT_USERNAME;
  process.env.MINECRAFT_USERNAME = "Seed@example.com";

  try {
    await guilds.load();
    const seeded = await guilds.ensureSeeded();
    assert.equal(seeded.seeded, true);

    const updated = await guilds.update("main", { tag: "THG", crossBridge: 1 });
    assert.equal(updated.ok, true);

    await guilds.load();
    assert.equal(guilds.get("main").tag, "THG");
    assert.equal(guilds.get("main").crossBridge, true);
    assert.equal(guilds.get("main").account, "seed@example.com");

    // A stored registry is never reseeded from the environment.
    assert.deepEqual(await guilds.ensureSeeded(), {
      seeded: false,
      reason: "already-configured",
    });
  } finally {
    if (previousAccount === undefined) delete process.env.MINECRAFT_USERNAME;
    else process.env.MINECRAFT_USERNAME = previousAccount;
  }
});

test("guilds: a corrupt legacy file refuses to load, so nothing is seeded", async () => {
  const table = fakeTable();
  mock.method(db, "query", table.query);
  fakeLegacyFile(guilds.CONFIG_PATH, "{ not json");
  const previousAccount = process.env.MINECRAFT_USERNAME;
  process.env.MINECRAFT_USERNAME = "seed@example.com";

  try {
    await assert.rejects(guilds.load(), /guildsConfig\.json/);
    assert.equal(table.inserts().length, 0);
  } finally {
    if (previousAccount === undefined) delete process.env.MINECRAFT_USERNAME;
    else process.env.MINECRAFT_USERNAME = previousAccount;
  }
});

test("global profile: a stored document is normalised like the old file", async () => {
  const table = fakeTable({
    globalProfile: {
      mode: "off",
      testerIds: "not-a-list",
      disguiseToDiscord: "false",
    },
  });
  mock.method(db, "query", table.query);

  await globalProfile.load();
  const state = globalProfile.getState();
  assert.deepEqual(state.testerIds, []);
  assert.deepEqual(state.testChannelIds, []);
  assert.equal(state.disguiseToDiscord, true);
  assert.equal(state.disguiseToMinecraft, true);
});

test("global profile: a lapsed effect is cleared on read and the end saved", async () => {
  const table = fakeTable({
    globalProfile: {
      mode: "live",
      target: { userId: "1", name: "Target" },
      expiresAt: Date.now() - 1000,
      startedBy: "2",
      startedAt: Date.now() - 5000,
    },
  });
  mock.method(db, "query", table.query);

  await globalProfile.load();
  assert.equal(globalProfile.isActive(), false);

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(globalProfile.getState().mode, "off");
  assert.equal(table.rows.globalProfile.mode, "off");
  assert.equal(table.rows.globalProfile.target, null);
});

test("snapshot: every save rewrites the file, through a temp file", async () => {
  const table = fakeTable({ auditChannel: { channelId: "1" } });
  mock.method(db, "query", table.query);
  const file = writeLegacy("auditChannelConfig.json", { channelId: "1" });
  const renames = [];
  const realRename = fs.renameSync;
  mock.method(fs, "renameSync", (from, to) => {
    renames.push([from, to]);
    return realRename(from, to);
  });

  let cache = (await store.load("auditChannel", file, identity)).data;
  await store.commit(
    "auditChannel",
    () => cache,
    (draft) => {
      draft.channelId = "2";
    },
    (saved) => {
      cache = saved;
    },
  );

  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf-8")), {
    channelId: "2",
  });
  assert.deepEqual(renames.at(-1), [`${file}.tmp`, file]);
  assert.equal(fs.existsSync(`${file}.tmp`), false);
});

test("snapshot: a load from the database refreshes a stale file", async () => {
  const table = fakeTable({ auditChannel: { channelId: "from-db" } });
  mock.method(db, "query", table.query);
  const file = writeLegacy("auditChannelConfig.json", { channelId: "old" });

  await store.load("auditChannel", file, identity);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf-8")), {
    channelId: "from-db",
  });
});

test("snapshot: a failed snapshot write does not fail a saved change", async () => {
  const table = fakeTable({ auditChannel: { channelId: "1" } });
  mock.method(db, "query", table.query);
  const file = path.join(tmpDir, "missing-dir", "auditChannelConfig.json");

  let cache = (await store.load("auditChannel", file, identity)).data;
  await store.commit(
    "auditChannel",
    () => cache,
    (draft) => {
      draft.channelId = "2";
    },
    (saved) => {
      cache = saved;
    },
  );

  assert.equal(table.rows.auditChannel.channelId, "2");
  assert.equal(cache.channelId, "2");
  assert.ok(
    console.error.mock.calls.some((call) =>
      /Could not write the auditChannelConfig\.json snapshot/.test(
        call.arguments[0],
      ),
    ),
  );
});

test("an unreachable database is a DatabaseUnavailableError", async () => {
  mock.method(db, "query", async () => null);
  await assert.rejects(
    store.load("guilds", path.join(tmpDir, "none.json"), identity),
    store.DatabaseUnavailableError,
  );
});

test("a corrupt legacy file is not a DatabaseUnavailableError", async () => {
  mock.method(db, "query", fakeTable().query);
  const file = writeLegacy("broken.json", "{ not json");
  await assert.rejects(store.load("broken", file, identity), (error) => {
    assert.ok(!(error instanceof store.DatabaseUnavailableError));
    return true;
  });
});

test("fromSnapshot: starts from the file without touching the database", async () => {
  const query = mock.fn(async () => null);
  mock.method(db, "query", query);
  const file = writeLegacy("auditChannelConfig.json", { channelId: "7" });

  const result = await store.load("auditChannel", file, identity, {
    fromSnapshot: true,
  });
  assert.deepEqual(result, { data: { channelId: "7" }, stored: true });
  assert.equal(query.mock.callCount(), 0);
  assert.equal(store.isDegraded(), true);
});

test("fromSnapshot: with no snapshot the start still fails", async () => {
  mock.method(db, "query", async () => null);
  await assert.rejects(
    store.load("auditChannel", path.join(tmpDir, "none.json"), identity, {
      fromSnapshot: true,
    }),
    /no none\.json snapshot/,
  );
});

test("fromSnapshot: a change while the database is down fails and changes nothing", async () => {
  mock.method(db, "query", async () => null);
  const file = writeLegacy("auditChannelConfig.json", { channelId: "7" });
  let cache = (
    await store.load("auditChannel", file, identity, { fromSnapshot: true })
  ).data;

  await assert.rejects(
    store.commit(
      "auditChannel",
      () => cache,
      (draft) => {
        draft.channelId = "8";
      },
      (saved) => {
        cache = saved;
      },
    ),
    /Could not save/,
  );
  assert.equal(cache.channelId, "7");
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf-8")), {
    channelId: "7",
  });
});

test("guilds: a registry write is snapshotted to guildsConfig.json", async () => {
  const table = fakeTable();
  mock.method(db, "query", table.query);
  const previous = process.env.MINECRAFT_USERNAME;
  process.env.MINECRAFT_USERNAME = "seed-account";
  try {
    await guilds.load();
    const seeded = await guilds.ensureSeeded();
    assert.equal(seeded.seeded, true);
  } finally {
    if (previous === undefined) delete process.env.MINECRAFT_USERNAME;
    else process.env.MINECRAFT_USERNAME = previous;
  }

  const snapshot = repoWrites.get(path.join(REPO_ROOT, "guildsConfig.json"));
  assert.ok(snapshot, "a saved registry is snapshotted");
  assert.deepEqual(JSON.parse(snapshot), table.rows.guilds);
});
