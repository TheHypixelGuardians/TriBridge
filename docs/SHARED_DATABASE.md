# The shared database

TriBridge and the [THG community bot](https://github.com/TheHypixelGuardians/thg-community) are two processes
serving one Discord server. The community bot owns the community half — member profiles, account links,
bot-admin roles, feature requests — and TriBridge owns the bridge. Two of the things the community bot owns
are *needed* by the bridge, so the two share one PostgreSQL database rather than each keeping its own copy.

**The community bot owns the `public` schema.** It runs the migrations, and both tables below are defined in its
`prisma/schema.prisma`. TriBridge reads them with plain SQL through `src/utils/db.js` and **never writes them**.
TriBridge's own settings live in a separate `tribridge` schema — see [What TriBridge stores](#what-tribridge-stores).

Set `DATABASE_URL` here to the same connection string the community bot uses.

## What TriBridge reads

| Table                   | Used for                                                                                          | Module                    |
|-------------------------|---------------------------------------------------------------------------------------------------|---------------------------|
| `MinecraftLink`, `User` | Attributing guild chat to a member's Minecraft name, and the webhook repost's head                 | `utils/linkedAccounts.js` |
| `AdminRole`             | `isAdmin()` — the gate on `/send`, `/guilds`, `/invite`, `/kick`, `/promote`, `/demote`, `/login`, `/adminpanel` and `/auditchannel` | `utils/adminRoles.js`     |

`MinecraftLink` relates to `User.id` rather than to the Discord id — the community bot's schema convention —
so both link lookups join through `"User"`.

## What TriBridge stores

TriBridge owns one table, `tribridge.config`, which `src/utils/configStore.js` creates on the first start that
finds it missing (checked with `to_regclass`, then `CREATE SCHEMA`/`CREATE TABLE IF NOT EXISTS`). It holds one JSONB document per setting, all managed from Discord by this
bot's own commands:

| `name`          | Holds                          | Module                   | Imported once from          |
|-----------------|--------------------------------|--------------------------|-----------------------------|
| `guilds`        | The Hypixel guild registry     | `utils/guilds.js`        | `guildsConfig.json`         |
| `globalProfile` | The global profile change      | `utils/globalProfile.js` | `globalProfileConfig.json`  |
| `auditChannel`  | The default audit channel      | `utils/auditChannel.js`  | `auditChannelConfig.json`   |

The table is in its own schema rather than `public` on purpose: the community bot runs `prisma db push`, which
treats any `public` table its schema does not define as one to drop. The database role needs the `CREATE`
privilege on the database for that first start only — the role the community bot runs `prisma db push` with
normally has it. Later starts only read and write the table, so the privilege can be revoked afterwards, or the
schema and table created by hand beforehand by an owner instead.

Each module reads its document once at startup and serves every read from memory, so none of this adds a query
to the message path. Writes replace the whole document. When a document is missing and the matching JSON file
exists in the project root, that file is imported on startup and logged. A file that is not valid JSON, with no row
to fall back on, stops startup: running on defaults would let the first saved change create the row and strand the
file.

From then on each file is a **snapshot** of its row: rewritten (temp file, then rename) after every successful save
and on every start. If the database cannot be reached at startup, after the retries, the bot starts from the
snapshots instead and warns in the log channel. Every write still goes to the database first, so while it is down
settings changes fail cleanly and nothing exists only in memory or only on disk. `npm run config:import` imports
files by hand (see [config files](https://thehypixelguardians.mintlify.site/tribridge/config-files)).

## Failure behaviour

Both reads have a defined answer for "the database is unreachable", and neither throws — they run on the
message path, where an exception would take the relay down with it.

| Read         | On failure                                                                                          |
|--------------|-----------------------------------------------------------------------------------------------------|
| Account link | Behaves as **not linked** — the message relays under the Discord name rather than not relaying       |
| Admin roles  | **Fails closed.** `isAdmin` refuses. `/send` runs arbitrary commands as the Minecraft account and `/adminpanel` can impersonate everybody in the server, so handing either out during an outage is worse than the outage |

Without `DATABASE_URL` the pool is never created and one line is logged. TriBridge's own settings cannot be loaded
then, so **the bot does not start**: it retries for about 40 seconds and exits with a non-zero code. The same
goes for a database that cannot be reached at startup: running on
empty settings instead would let the next admin action save over the real ones.

## Staleness

TriBridge is a reader and cannot see the community bot's writes, so each cache expires on a timer rather than
being invalidated:

| Cache         | TTL | Why that number                                                                   |
|---------------|-----|------------------------------------------------------------------------------------|
| Account links | 15s | A member who has just run `/link` expects their next message attributed correctly   |
| Admin roles   | 15s | A revoked admin role should stop working in seconds, not at the next restart        |

Those numbers are the deliberate trade for not querying Postgres once per relayed message. Shortening them
costs a query per message on a busy bridge; lengthening them makes `/link` look broken.

## The global profile change and the account link

The disguise itself is entirely local, but its **test mode** reads a link: guild chat carries no Discord
author, so a tester is recognised by matching the Minecraft name back to a link. A tester who has not run
`/link` on the community bot will not see their guild chat rewritten, and if the database is unreachable no
tester will. That is the safe direction — without the rule, testing would silently relabel guild members who
never agreed to take part.
