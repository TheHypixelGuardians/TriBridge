# The shared database

TriBridge and the [THG community bot](https://github.com/TheHypixelGuardians/thg-community) are two processes
serving one Discord server. The community bot owns the community half — member profiles, account links,
bot-admin roles, feature requests — and TriBridge owns the bridge. Two of the things the community bot owns
are *needed* by the bridge, so the two share one PostgreSQL database rather than each keeping its own copy.

**The community bot owns the schema.** It runs the migrations, and both tables below are defined in its
`prisma/schema.prisma`. TriBridge reads them with plain SQL through `src/utils/db.js`, holds no schema of its
own, and **never writes**.

Set `DATABASE_URL` here to the same connection string the community bot uses.

## What TriBridge reads

| Table                   | Used for                                                                                          | Module                    |
|-------------------------|---------------------------------------------------------------------------------------------------|---------------------------|
| `MinecraftLink`, `User` | Attributing guild chat to a member's Minecraft name, and the webhook repost's head                 | `utils/linkedAccounts.js` |
| `AdminRole`             | `isAdmin()` — the gate on `/send`, `/guilds`, `/invite`, `/kick`, `/promote`, `/demote`, `/login`, `/adminpanel` and `/auditchannel` | `utils/adminRoles.js`     |

`MinecraftLink` relates to `User.id` rather than to the Discord id — the community bot's schema convention —
so both link lookups join through `"User"`.

Everything else the bridge needs stays local. The global profile change lives in `globalProfileConfig.json`,
the audit channel in `auditChannelConfig.json`, and the Hypixel guild registry in `guildsConfig.json`, all
managed from Discord by this bot's own commands.

## Failure behaviour

Both reads have a defined answer for "the database is unreachable", and neither throws — they run on the
message path, where an exception would take the relay down with it.

| Read         | On failure                                                                                          |
|--------------|-----------------------------------------------------------------------------------------------------|
| Account link | Behaves as **not linked** — the message relays under the Discord name rather than not relaying       |
| Admin roles  | **Fails closed.** `isAdmin` refuses. `/send` runs arbitrary commands as the Minecraft account and `/adminpanel` can impersonate everybody in the server, so handing either out during an outage is worse than the outage |

Without `DATABASE_URL` the pool is never created, one line is logged, and both take their failure branch
permanently — which means **no admin command works at all** until it is set.

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
