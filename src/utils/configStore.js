const fs = require("fs");
const path = require("path");
const db = require("./db");

/**
 * TriBridge's own settings, stored in the shared Postgres database as one JSONB
 * document per config: the guild registry, the global profile change and the
 * audit channel.
 *
 * The table lives in its own `tribridge` schema rather than `public`. The
 * community bot runs `prisma db push` against `public`, and that treats any
 * table its schema does not define as one to drop.
 *
 * Each config used to be a JSON file at the repository root. The first start
 * after upgrading finds no row and imports the file; from then on the row is
 * authoritative.
 *
 * The file stays, as a **snapshot**: every successful save, and every load
 * from the database, rewrites it (atomically, via a temp file and a rename).
 * It is only read in two cases: to import it when the database has no row, and
 * at startup when the database cannot be reached at all. The second case is
 * what keeps a Postgres outage from becoming a bridge outage. The relay and
 * every guild connection only need the registry in memory, and the snapshot is
 * the last copy the database confirmed. While running from it, every settings
 * change still goes to the database first and fails cleanly, so nothing that
 * was never saved can end up in memory or on disk.
 */

const SCHEMA_STATEMENTS = [
  "CREATE SCHEMA IF NOT EXISTS tribridge",
  `CREATE TABLE IF NOT EXISTS tribridge.config (
    name text PRIMARY KEY,
    data jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
];

/**
 * Thrown when Postgres cannot be queried at all, as opposed to a config that
 * cannot be parsed. Only this one lets startup fall back to the snapshots: a
 * corrupt legacy file with no row must still stop the bot.
 */
class DatabaseUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

// Which file each config snapshots to, recorded by load() so save() needs no
// path from its callers.
const snapshotPaths = new Map();

let degraded = false;

/**
 * @returns {boolean} Whether the settings came from the local snapshots
 *   because the database could not be reached at startup.
 */
function isDegraded() {
  return degraded;
}

/**
 * Writes a config's snapshot file. Never throws: the database is the source of
 * truth and has already accepted the change, so a full disk must not turn a
 * saved change into a reported failure.
 *
 * Temp file and rename, so a crash mid-write leaves the previous snapshot
 * intact instead of a truncated file. A plain writeFileSync could leave invalid
 * JSON behind, which would be the only copy during the next outage.
 *
 * @param {string} name
 * @param {object} data
 */
function writeSnapshot(name, data) {
  const filePath = snapshotPaths.get(name);
  if (!filePath) return;

  const tmp = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
    fs.renameSync(tmp, filePath);
  } catch (error) {
    console.error(
      `Could not write the ${path.basename(filePath)} snapshot: ${error.message}`,
    );
  }
}

/**
 * Creates the table on the first start only. Creating a schema needs the
 * CREATE privilege on the whole database even when it already exists, which a
 * role tightened after setup may no longer have.
 */
async function ensureSchema() {
  const found = await db.query(
    "SELECT to_regclass('tribridge.config') IS NOT NULL AS present",
  );
  if (found === null) {
    throw new DatabaseUnavailableError(
      "Could not check for the tribridge.config table.",
    );
  }
  if (found[0].present) return;

  for (const statement of SCHEMA_STATEMENTS) {
    if ((await db.query(statement)) === null) {
      throw new Error("Could not create the tribridge.config table.");
    }
  }
}

/**
 * Reads a legacy config file for import.
 *
 * @param {string} filePath
 * @returns {object|null} null when there is no file.
 * @throws When the file exists but is not a JSON object. Starting anyway would
 *   strand it: the first change saved from Discord creates the row, and from
 *   then on the file is never looked at again.
 */
function readLegacyFile(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Thrown below.
  }

  throw new Error(
    `${path.basename(filePath)} is not a JSON object, and the database has no ` +
      "copy of it yet. Fix the file, or move it out of the project root to " +
      "start without it.",
  );
}

/**
 * Names what an import carried without printing it: the values are channel,
 * role and account ids.
 */
function describe(data) {
  return Object.entries(data)
    .map(([key, value]) =>
      Array.isArray(value) ? `${key} (${value.length})` : key,
    )
    .join(", ");
}

/**
 * Loads one config, importing its legacy JSON file if the database has none.
 *
 * The import is a single `INSERT ... ON CONFLICT DO NOTHING`, so it is atomic
 * and never overwrites a row that already exists.
 *
 * @param {string} name
 * @param {string} filePath The JSON file this config used to live in.
 * @param {(raw: object|undefined) => object} normalise The module's loader
 *   rules, applied to whatever comes back from either source.
 * @param {{fromSnapshot?: boolean}} [options] `fromSnapshot` skips the
 *   database and reads the snapshot file. Startup uses it only after the
 *   database has been unreachable for every retry.
 * @returns {Promise<{data: object, stored: boolean}>} `stored` is false when
 *   neither the database nor the file had anything and `data` is defaults.
 * @throws When the database cannot be read (a `DatabaseUnavailableError`), or
 *   there is no row and the legacy file cannot be parsed. Running on defaults
 *   instead would let the next write overwrite the real config.
 */
async function load(name, filePath, normalise, { fromSnapshot = false } = {}) {
  snapshotPaths.set(name, filePath);

  if (fromSnapshot) {
    const snapshot = readLegacyFile(filePath);
    if (!snapshot) {
      throw new Error(
        `The database is unreachable and there is no ${path.basename(filePath)} ` +
          "snapshot to start from.",
      );
    }
    degraded = true;
    return { data: normalise(snapshot), stored: true };
  }

  await ensureSchema();

  const rows = await db.query(
    "SELECT data FROM tribridge.config WHERE name = $1",
    [name],
  );
  if (rows === null) {
    throw new DatabaseUnavailableError(
      `Could not read the ${name} config from the database.`,
    );
  }
  if (rows.length > 0) {
    const data = normalise(rows[0].data);
    // Refreshed on every start, so the snapshot matches the database even when
    // the file was edited, deleted or restored from an older copy meanwhile.
    writeSnapshot(name, data);
    return { data, stored: true };
  }

  const legacy = readLegacyFile(filePath);
  if (!legacy) return { data: normalise(undefined), stored: false };

  const data = normalise(legacy);
  const inserted = await db.query(
    "INSERT INTO tribridge.config (name, data) VALUES ($1, $2) " +
      "ON CONFLICT (name) DO NOTHING RETURNING name",
    [name, JSON.stringify(data)],
  );
  if (inserted === null) {
    throw new DatabaseUnavailableError(
      `Could not import ${path.basename(filePath)}.`,
    );
  }
  // Somebody else stored it first; theirs wins.
  if (inserted.length === 0) return load(name, filePath, normalise);

  console.log(
    `Imported ${path.basename(filePath)} into the database: ${describe(data)}. ` +
      "From now on the file is a snapshot of the database, rewritten on every " +
      "save and only read if the database is unreachable at startup.",
  );
  writeSnapshot(name, data);
  return { data, stored: true };
}

async function save(name, data) {
  const rows = await db.query(
    "INSERT INTO tribridge.config (name, data) VALUES ($1, $2) " +
      "ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, updated_at = now() " +
      "RETURNING name",
    [name, JSON.stringify(data)],
  );
  if (rows === null) {
    throw new Error(`Could not save the ${name} config to the database.`);
  }
  writeSnapshot(name, data);
}

// One chain per config, so each change starts from the document the previous
// one saved: none is lost, and an older snapshot never lands after a newer one
// on another pooled connection.
const queues = new Map();

/**
 * Changes a config: saved first, applied in memory only once it is.
 *
 * `edit` gets a copy of the current document to change. If the copy differs
 * afterwards it is saved and then handed to `apply`; if the save fails the
 * cache is untouched, so memory never holds a setting the database does not —
 * a change that only lived in memory would vanish on restart, or be saved
 * later by an unrelated change.
 *
 * @template T
 * @param {string} name
 * @param {() => object} current Reads the module's cached document.
 * @param {(draft: object) => T} edit Changes the draft; its return value is
 *   the result. Leaving the draft unchanged (a refused validation) saves
 *   nothing.
 * @param {(saved: object) => void} apply Replaces the module's cache.
 * @returns {Promise<T>} Rejects when the save failed.
 */
function commit(name, current, edit, apply) {
  const run = async () => {
    const before = current();
    const draft = structuredClone(before);
    const result = edit(draft);
    if (JSON.stringify(draft) !== JSON.stringify(before)) {
      await save(name, draft);
      apply(draft);
    }
    return result;
  };

  const next = (queues.get(name) ?? Promise.resolve()).then(run, run);
  queues.set(name, next);
  return next;
}

module.exports = {
  load,
  commit,
  isDegraded,
  DatabaseUnavailableError,
  // For scripts/import-config.js.
  ensureSchema,
  readLegacyFile,
  describe,
  save,
};
