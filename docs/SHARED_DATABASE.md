# The shared database

TriBridge and the [THG community bot](https://github.com/TheHypixelGuardians/thg-community) are two processes
serving one Discord server. The community bot owns the community half — member profiles, account links,
bot-admin roles, the admin panel, feature requests — and TriBridge owns the bridge. Some of what the community
bot owns is *needed* by the bridge, so the two share one PostgreSQL database rather than each keeping its own
copy.

**The community bot owns the schema.** It runs the migrations, and every table below is defined in its
`prisma/schema.prisma`. TriBridge reads those tables with plain SQL through `src/utils/db.js` and holds no
schema of its own.

Set `DATABASE_URL` here to the same connection string the community bot uses.

## What TriBridge reads

| Table                 | Used for                                                                            | Module                    |
|-----------------------|-------------------------------------------------------------------------------------|---------------------------|
| `MinecraftLink`, `User` | Attributing guild chat to a member's Minecraft name, and the webhook repost's head | `utils/linkedAccounts.js` |
| `AdminRole`           | `isAdmin()` — the gate on `/send`, `/guilds`, `/invite`, `/kick`, `/promote`, `/demote`, `/login` | `utils/adminRoles.js`     |
| `GlobalProfileEffect` | Whether a global profile change is running, who it targets, and which bridge legs it covers | `utils/globalProfile.js`  |
| `Setup.auditChannelId` | Where a disguised guild-chat line is recorded                                       | `utils/auditChannel.js`   |

`MinecraftLink` relates to `User.id` rather than to the Discord id — the community bot's schema convention —
so both link lookups join through `"User"`.

## What TriBridge writes

Exactly one table: **`BridgeChannel`**, published by
[`events/discord/clientReady/005publishBridgeChannels.js`](../src/events/discord/clientReady/005publishBridgeChannels.js)
on every startup. It lists the bridge channel and every Hypixel guild's officer channel.

The community bot runs the global profile change in ordinary channels, and has to skip those two kinds:

- **The bridge channel**, because `relayToMinecraft.js` reposts there itself. Two bots deleting the same
  message race, and the loser deletes a message the winner already replaced.
- **Officer channels**, because a webhook repost is authored by a bot and `relayOfficerToMinecraft.js` drops
  anything a bot authored. The officer's line would vanish from Discord and never reach Hypixel, with no error
  anywhere.

Publishing them beats configuring the same ids twice: an officer channel changes with `/guilds edit`, and a
second copy in the community bot's configuration would go stale the moment it did. Rows are durable, so the
community bot keeps skipping those channels even while TriBridge is down.

## Failure behaviour

Every read has a defined answer for "the database is unreachable", and none of them throws — these run on the
message path, where an exception would take the relay down with it.

| Read              | On failure                                                                                        |
|-------------------|---------------------------------------------------------------------------------------------------|
| Account link      | Behaves as **not linked** — the message relays under the Discord name rather than not relaying     |
| Admin roles       | **Fails closed.** `isAdmin` refuses. `/send` runs arbitrary commands as the Minecraft account, so handing it out during an outage is worse than the outage |
| Global profile    | Behaves as **not running**, and the last good state is served while it is merely stale. A database blip must not start relabelling guild members |
| Audit channel     | The last known channel, else nothing recorded. Audit entries never block the work they describe    |

Without `DATABASE_URL` the pool is never created, one line is logged, and everything above takes its failure
branch permanently.

## Staleness

TriBridge is a reader and cannot see the community bot's writes, so each cache expires on a timer rather than
being invalidated:

| Cache                 | TTL | Why that number                                                                     |
|-----------------------|-----|--------------------------------------------------------------------------------------|
| Account links         | 15s | A member who has just run `/link` expects their next message attributed correctly     |
| Admin roles           | 15s | A revoked admin role should stop working in seconds, not at the next restart          |
| Global profile effect | 10s | Worst-case lag between an admin starting an effect and this side honouring it         |
| Audit channel         | 30s | Changes rarely, and a stale value only misroutes one entry                            |

Those numbers are the deliberate trade for not querying Postgres once per relayed message. Shortening them
costs a query per message on a busy bridge; lengthening them makes `/link` look broken.
