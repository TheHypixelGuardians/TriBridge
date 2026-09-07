const { Pool } = require("pg");

/**
 * Read-only access to the THG community bot's Postgres database.
 *
 * The community bot owns account links and the bot-admin role list; this bot
 * reads both so the two agree about who is who and who is staff, and never
 * writes either. Everything else the bridge needs is still local — the global
 * profile change and the audit channel live in this repository's own config
 * files.
 *
 * `DATABASE_URL` is the same connection string the community bot uses. Without
 * it every read here fails, and each caller decides what that means: link
 * lookups behave as "not linked", and `isAdmin` refuses.
 */

let pool = null;
let warnedUnconfigured = false;

/**
 * @returns {boolean} Whether a database is configured at all.
 */
function isConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (pool) return pool;
  if (!isConfigured()) return null;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // A bridge that cannot reach Postgres must degrade, not hang: every caller
    // here has a defined answer for a failed read, and a stalled query would
    // instead stall the message it was asked about.
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    max: 4,
  });

  pool.on("error", (error) => {
    console.error("Postgres pool error:", error);
  });

  return pool;
}

/**
 * Runs a query and returns its rows.
 *
 * @param {string} text
 * @param {unknown[]} [params]
 * @returns {Promise<object[]|null>} null when there is no database configured,
 *   or the query failed. Never throws — callers are on message hot paths where
 *   an exception would take the relay down with it.
 */
async function query(text, params = []) {
  const client = getPool();

  if (!client) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.error(
        "DATABASE_URL is not set. Account links, bot-admin roles and the global " +
          "profile change all live in the community bot's database, so those " +
          "features are inert until it is.",
      );
    }
    return null;
  }

  try {
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    console.error("Database query failed:", error);
    return null;
  }
}

module.exports = { isConfigured, query };
