# The shared database

TriBridge and the [THG community bot](https://github.com/TheHypixelGuardians/thg-community) are two processes
serving one Discord server, and their features are **separate**. Each bot has its own account links; linking on
one does not carry over to the other. They share exactly three things: **the PostgreSQL database**, **the
blacklist** in it, and **the bot-admin roles**, which the community bot's `/adminrole` sets for both.

**The community bot owns the `public` schema.** It runs the migrations, and `Blacklist` is defined in its
`prisma/schema.prisma`. TriBridge touches that schema through `src/utils/db.js` with plain SQL for the blacklist
(see [What TriBridge writes](#what-tribridge-writes)) and the admin roles (see
[What TriBridge reads](#what-tribridge-reads)), plus one read of the community links on its very first start
(see [The one-time link copy](#the-one-time-link-copy)). Everything else TriBridge keeps lives in its
own `tribridge` schema — see [What TriBridge stores](#what-tribridge-stores).

Set `DATABASE_URL` here to the same connection string the community bot uses.

Linking used to be shared too: the community bot owned it and TriBridge read it. That made a feature on one bot
depend on the other's tables and its 15-second cache, so it was split back on 2026-10-21. Admin roles stayed
shared on purpose, so one list decides who is staff on both bots.

## What TriBridge reads

| Table       | Used for                                                                                       | Module                |
|-------------|------------------------------------------------------------------------------------------------|-----------------------|
| `AdminRole` | `isAdmin()`, the gate on every bot-admin command here (`/send`, `/guilds`, `/adminpanel` and the rest) | `utils/adminRoles.js` |

There is no write path for it here: `/adminrole` lives on the community bot.

## What TriBridge writes

| Table       | Used for                                                                              | Module               |
|-------------|---------------------------------------------------------------------------------------|----------------------|
| `Blacklist` | `/blacklist`, and the check every command, button and Discord→Minecraft relay makes   | `utils/blacklist.js` |

`/blacklist` is a TriBridge command, so the writes are here and the community bot only reads. One writer per
table is the rule both bots keep; two writing one table is how they would start to disagree.

The table is still the community bot's: its migration creates it, with database-side defaults for `id` and
`updatedAt`. Those defaults are what lets a plain `INSERT` from here work at all — Prisma fills both in
application code, and this side has no Prisma. Rows are keyed per Discord server (`guildId`) and member
(`discordId`), unique together, which `INSERT … ON CONFLICT DO NOTHING` relies on. **Deploy the community bot's
migration before this side's `/blacklist`**, or every add reports a database error and every check lets
everyone through.

## What TriBridge stores

TriBridge owns one table, `tribridge.config`, which `src/utils/configStore.js` creates on the first start that
finds it missing (checked with `to_regclass`, then `CREATE SCHEMA`/`CREATE TABLE IF NOT EXISTS`). It holds one JSONB document per setting, all managed from Discord by this
bot's own commands:

| `name`           | Holds                          | Module                    | Imported once from           |
|------------------|--------------------------------|---------------------------|------------------------------|
| `guilds`         | The Hypixel guild registry     | `utils/guilds.js`         | `guildsConfig.json`          |
| `globalProfile`  | The global profile change      | `utils/globalProfile.js`  | `globalProfileConfig.json`   |
| `auditChannel`   | The default audit channel      | `utils/auditChannel.js`   | `auditChannelConfig.json`    |
| `linkedAccounts` | The bridge's account links     | `utils/linkedAccounts.js` | `linkedAccountsConfig.json`  |

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

## The one-time link copy

The first start with no `linkedAccounts` row and no `linkedAccountsConfig.json` to import copies the community
bot's links (`MinecraftLink` joined through `User`) into the bridge's own list, so nobody has to link again on the
day the bridge got its own list back. The copy is saved even when it is empty, so it never runs twice; from then
on the two lists are independent and the community tables can change without affecting the bridge. If the
community tables cannot be read at that moment, the bridge starts with no links and tries the copy again on its
next start.

## Failure behaviour

TriBridge's links are read from memory, so the database being down after startup changes nothing for them. The
two community tables it reads behave differently on purpose:

| Read         | On failure                                                                                          |
|--------------|-----------------------------------------------------------------------------------------------------|
| Admin roles  | **Fails closed** — nobody is an admin. `/send` runs arbitrary commands as the Minecraft account and `/adminpanel` can impersonate everybody in the server, so an unreadable or empty list must never mean "everyone" |
| Blacklist    | **Fails open** — nobody counts as blacklisted. Failing closed would refuse every command and stop the whole bridge during an outage; the admin check still fails closed |

Without `DATABASE_URL` the pool is never created and one line is logged. TriBridge's own settings cannot be loaded
then, so **the bot does not start**: it retries for about 40 seconds and exits with a non-zero code. A database
that cannot be reached at startup, through every retry, makes the bot start from its local snapshots instead.

## Staleness

Two things are read here that the other bot writes. The admin roles are cached for 15 seconds, so a role added or
removed with the community bot's `/adminrole` takes effect here within that. The blacklist's cache is also 15
seconds, cleared on every write here, so it only lags on the community bot's side. Links have no such lag: each
bot writes its own.

## The global profile change and the account link

The disguise itself is entirely local, but its **test mode** reads a link: guild chat carries no Discord
author, so a tester is recognised by matching the Minecraft name back to a link. That is the bridge's own link
now: a tester who has not run the bridge's `/link` will not see their guild chat rewritten. That is the safe
direction — without the rule, testing would silently relabel guild members who never agreed to take part.
