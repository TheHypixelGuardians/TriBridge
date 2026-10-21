#!/usr/bin/env node
/**
 * Imports TriBridge's JSON config files into the shared database by hand.
 *
 * The bot already imports each file on its first start when the database has
 * no row for it, so this is only needed to import from somewhere else (a copy
 * taken off the server), to check files before a migration, or to overwrite a
 * row on purpose.
 *
 *   node scripts/import-config.js --dry-run [--dir <folder>]
 *   node scripts/import-config.js [--dir <folder>] [--force]
 *
 * `--dir` is where the *Config.json files are (default: the repository root).
 * `--dry-run` parses and normalises them and reports what they hold, without
 * connecting. Without `--force`, a config the database already has is skipped.
 *
 * Only key names and list lengths are printed. The values are channel, role
 * and account ids, and must not end up in a terminal log someone pastes.
 */
require("dotenv").config();

const path = require("path");
const store = require("../src/utils/configStore");
const guilds = require("../src/utils/guilds");
const globalProfile = require("../src/utils/globalProfile");
const auditChannel = require("../src/utils/auditChannel");
const linkedAccounts = require("../src/utils/linkedAccounts");
const db = require("../src/utils/db");

const CONFIGS = [
  { name: "guilds", file: "guildsConfig.json", normalise: guilds.normalise },
  {
    name: "globalProfile",
    file: "globalProfileConfig.json",
    normalise: globalProfile.normalise,
  },
  {
    name: "auditChannel",
    file: "auditChannelConfig.json",
    normalise: auditChannel.normalise,
  },
  {
    name: "linkedAccounts",
    file: "linkedAccountsConfig.json",
    normalise: linkedAccounts.normalise,
  },
];

function parseArgs(argv) {
  const args = { dryRun: false, force: false, dir: path.join(__dirname, "..") };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--dir") args.dir = path.resolve(argv[++i] ?? "");
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let failed = false;

  if (!args.dryRun) await store.ensureSchema();

  for (const config of CONFIGS) {
    const filePath = path.join(args.dir, config.file);
    let raw;
    try {
      raw = store.readLegacyFile(filePath);
    } catch (error) {
      console.error(`✗ ${config.file}: ${error.message}`);
      failed = true;
      continue;
    }
    if (!raw) {
      console.log(`- ${config.file}: not found, skipped`);
      continue;
    }

    const data = config.normalise(raw);
    const summary = store.describe(data);

    if (args.dryRun) {
      console.log(`✓ ${config.file}: valid (${summary})`);
      continue;
    }

    const rows = await db.query(
      "SELECT 1 FROM tribridge.config WHERE name = $1",
      [config.name],
    );
    if (rows === null)
      throw new store.DatabaseUnavailableError("Lost the database.");
    if (rows.length > 0 && !args.force) {
      console.log(
        `- ${config.file}: the database already has "${config.name}", skipped ` +
          "(--force overwrites it)",
      );
      continue;
    }

    await store.save(config.name, data);
    console.log(`✓ ${config.file}: imported (${summary})`);
  }

  if (!args.dryRun) {
    console.log(
      "Restart the bot to load the imported settings. Its next start rewrites " +
        "the local snapshot files from the database.",
    );
  }
  return failed ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
