# Features

Everything TriBridge does, and how to use it. This is the reference the README's feature list points at — see
the [change log](../CHANGELOG.md) for what changed in each release, and the
[wiki](https://github.com/Trilleo/TriBridge/wiki) for the same material split by audience.

Two words are used precisely throughout, because they mean different things:

- A **Hypixel guild** is one of the Minecraft guilds the bot bridges. There can be several. Each has a
  `guildKey`, a chat tag, and its own Minecraft account.
- A **Discord server** is the single Discord community the bot serves. There is exactly one, however many
  Hypixel guilds are registered.

## The bridge

The bot relays messages in both directions between one Discord channel — the **bridge channel**, set with
`DISCORD_CHANNEL_ID` — and Hypixel guild chat.

**Discord → Minecraft.** Anything said in the bridge channel is sent to guild chat as `/gc <name>: <message>`.
The author's Discord display name is used unless they have [linked a Minecraft account](#account-linking), in
which case their Minecraft name is. A message with attachments and no text is sent as `[attachment]` rather
than as a dangling colon.

**Minecraft → Discord.** Guild chat comes back as a rich embed, coloured with the guild's own colour, with the
speaker's Minecraft head as the author icon. Member joins and leaves are relayed too. With more than one guild
registered, the guild's tag is appended to the author name — `Notch [SB]` — so it is obvious which guild said
what; with a single guild there is nothing to disambiguate, so the tag is omitted entirely.

Minecraft 1.8 caps a chat packet at 100 characters, so a long Discord message is truncated on the way in. The
command is built **once** for a message and reused for every guild it reaches, so a broadcast is cut at
exactly the same point everywhere rather than differently per guild.

Outbound chat is rate limited per Minecraft account, one line every 600ms. This is not politeness: Hypixel
mutes an account that talks too fast, and a busy bridge channel fanned out across several guilds multiplies
the outbound rate by the number of guilds.

### Bots never relay each other

A line spoken by *any* registered Minecraft account is dropped before it can be relayed anywhere — not just
the account that heard it. Two accounts that ended up in the same Hypixel guild would otherwise relay each
other forever, and a guild-to-guild forward would ping-pong between two guilds until Hypixel muted both. If
two accounts do end up in one guild, a second guard notices the same player saying the same thing in two
guilds within two seconds and drops the duplicate, so you get one embed rather than two.

## Guild tags

With more than one Hypixel guild registered, a message can be aimed at one of them by starting it with that
guild's tag:

```
!sb hey
```

- **`!tag message`** goes to that guild only. The prefix is stripped from both the guild-chat copy *and* from
  what Discord shows, so the two sides read the same words.
- **Anything else** goes to every enabled guild.
- **`!!` sends a literal `!`.** `!!sb hi` reaches guild chat as the text `!sb hi` and routes nowhere special.
- **An unrecognised tag is never swallowed.** `!nope hi` is delivered everywhere, exactly as typed, and picks
  up a ❓ reaction so the mistake is visible. Silently dropping is the worst possible failure for a chat
  bridge — the sender believes it was delivered — and `!` is far too common in ordinary chat to reserve.
- **A guild whose bot is offline is skipped silently on a broadcast**; its own log channel already says it is
  down, and a warning per message in a busy channel would be unusable. But a message aimed at *one* guild with
  `!tag` that reaches nothing gets a 📡 reaction — nobody else got that one either.

Both markers need the **Add Reactions** permission in the bridge channel. Without it the message is still
delivered; only the marker is lost.

A tag is 2–8 letters or digits. The two-character minimum is deliberate: `!a` as a routing prefix would
swallow far too much ordinary chat. `nw` and `networth` are reserved for the
[networth chat command](#chat-commands).

## Hypixel guilds

The bridged guilds live in `guildsConfig.json` in the project root — gitignored, created on demand — and are
managed entirely from Discord with **`/guilds`**. You should not need to edit the file by hand.

| Field            | Meaning                                                                                                  |
|------------------|----------------------------------------------------------------------------------------------------------|
| `key`            | Short internal id, e.g. `sb`. Lowercase letters, digits, `-` and `_`, up to 16 characters. **Immutable.** |
| `name`           | Display name used in replies and logs                                                                    |
| `tag`            | 2–8 characters. Typed as `!tag message`, and shown next to names on incoming chat                        |
| `account`        | Microsoft account email for this guild's Minecraft bot. **Immutable**, and no two guilds may share one    |
| `color`          | Hex colour for this guild's relayed messages, e.g. `#2ECC71`                                             |
| `logChannelId`   | Optional per-guild log channel. Falls back to `LOG_CHANNEL`                                               |
| `auditChannelId` | Optional per-guild audit channel. Falls back to the channel set by `/auditchannel`                        |
| `enabled`        | `false` disconnects a guild without removing it                                                           |
| `crossBridge`    | `true` shares guild chat with the other cross-bridged guilds — see [below](#guild-to-guild-bridging)      |

**`key` and `account` cannot be changed.** `account` is the key prismarine-auth hashes for its token cache, so
editing it later silently starts a fresh device-code flow against a different cache file. Renaming means
removing the guild and adding it again.

### Adding a guild

```
/guilds add key:sb name:SkyBlock Guild tag:SB account:you@example.com
```

The bot registers the guild, then starts a Microsoft sign-in and sends the device code in a **private reply**.
Open the link, enter the code, and sign in as that account. `/guilds auth` repeats the flow when a token
expires.

The code only ever goes somewhere private — the ephemeral reply of the admin who asked, a DM to the admin who
registered the guild, or the console. The log channel gets a notice with no code in it. Anyone holding the
code can complete the sign-in with **their own** Microsoft account and bind the wrong account to the guild.

### The rest of `/guilds`

`/guilds list` shows every guild with its connection status, marking cross-bridged guilds with 🔁. `/guilds
edit` changes the name, tag, colour, per-guild channels, `enabled` and `crossbridge`, and its `clear` option
drops a per-guild channel override so it falls back to the global one. `/guilds default` picks the guild that
commands act on when none is given. `/guilds remove` unregisters a guild and disconnects its bot; removing the
default guild requires `confirm:True`. Account addresses are masked in every reply.

On a fresh install with no `guildsConfig.json`, the account in `MINECRAFT_USERNAME` is registered as the first
guild automatically. Once the file exists the registry is authoritative and the environment variable is
ignored.

## Guild-to-guild bridging

Registered guilds share a Discord channel but not their guild chat, unless it is switched on per guild:

```
/guilds edit guild:sb crossbridge:True
/guilds edit guild:main crossbridge:True
```

From then on a message in either guild is repeated into the other as `[SB] Notch: hello` — the source guild's
tag in front of the speaker's name, where Hypixel already puts rank brackets, so it reads as part of the
speaker rather than as something they said.

- **Off by default**, including for guilds registered before this existed, so upgrading never starts
  forwarding chat between guilds that were only meant to share a Discord channel.
- **It takes two.** One guild with the flag on shares with nobody; `/guilds edit` says so when that is the
  case.
- **The flag is symmetric.** A guild that does not send its chat elsewhere does not receive anyone else's
  either, so a guild can always be taken out of the arrangement from its own row. If it were one-directional,
  switching it off would not stop that guild's chat being pushed everywhere.
- **Player chat only.** Join and leave announcements stay in the guild they happened in — they are noise
  elsewhere, and they would spend the per-account chat budget that real messages need.
- **Real names.** A running [global profile change](#global-profile-change) does not rename forwarded chat;
  its two switches govern the two Discord legs of the bridge only.
- **Late messages are dropped, not queued.** A forwarded line still waiting ten seconds after it was handed
  over is discarded. Guild chat is a conversation: a reply landing a minute after the thing it answers is
  confusing rather than late, and without a ceiling one guild being spammed would push every other guild's
  bridge further and further behind.

## Chat commands

Some things are asked for from either side of the bridge rather than through a slash command. Type them in
guild chat or in the bridge channel:

```
!nw Notch
```

- **`!nw <username>`** — that player's SkyBlock networth. `!networth` is the same command.
- **A command is answered, not relayed.** Asking in guild chat does not put the question into Discord or into
  the cross-bridged guilds — the answer carries the question with it, and forwarding it would spend every
  other guild's per-account chat budget on a line none of them asked for. Asked in guild chat, the answer goes
  back into that guild *and* appears in Discord as an embed; asked in Discord, it stays there.
- **Double the `!` to send it literally.** `!!nw x` reaches guild chat as the text `!nw x` and runs nothing —
  the same escape guild tags use, honoured in both directions.
- **`nw` and `networth` are reserved guild tags.** `/guilds add` and `/guilds edit` refuse them, because
  `!nw hi` would otherwise mean both "look up hi's networth" and "send hi to the guild tagged NW". A guild
  registered with one of them before this existed keeps it, and keeps its routing.

The command name is matched against a closed list, not against any `!word`. Both Minecraft relays suppress
exactly what this dispatches, so the two must agree perfectly: if an unregistered name matched, an ordinary
line that happens to start with `!` would be swallowed and never answered.

## SkyBlock networth

`!nw <username>` in chat, or `/networth [username]` as a slash command, reports a player's SkyBlock networth.
With no username, `/networth` uses your [linked account](#account-linking).

- It reports the player's **richest profile**, named in the reply.
- The total counts **everything** — cosmetics and soulbound items included — and the unsoulbound figure is
  shown next to it. The Discord embed breaks it down by inventory, purse and bank.
- A player whose **inventory API is off** is flagged `(API off)`, because their number is an undercount rather
  than a low score.
- **Answers are cached for ten minutes**, and a miss is cached for five — a mistyped name repeated twenty
  times must cost one request, not twenty. A transient failure is cached for thirty seconds so a blip does not
  stick around.
- **One lookup per person every twenty seconds.** The cooldown is checked *before* the cache, not after: even
  a cache hit costs a guild-chat packet, and Hypixel mutes accounts that talk too fast.

Figures come from [SkyCrypt](https://sky.shiiyu.moe)'s public API, which serves from its own cache. A player
SkyCrypt has never loaded cannot be looked up until their page there has been opened once — the bot says so
and links it rather than reporting a wrong number. The bot needs outbound access to `sky.shiiyu.moe` and
`api.mojang.com`.

Only one module in the bot knows SkyCrypt exists; everything above it talks to a provider interface, so moving
to the Hypixel API later is a sibling file and one changed `require`.

## Account linking

`/link <username>` binds a Discord user to a Minecraft account.

Linked users get a visibly better bridge. Their Discord message is **reposted through a webhook** wearing
their Minecraft head and name, the original is deleted, and the guild-chat copy is attributed to their
Minecraft name rather than their Discord one — so a guild member reading either side sees the same person.

- **One link per Discord user, and one Discord user per Minecraft account.** Both directions are enforced.
- **Links are not scoped to a Hypixel guild.** One link, whatever guild you are in.
- **The UUID is stored alongside the name**, and avatar URLs use it, so a link survives a Minecraft name
  change.
- `/unlink` removes your own link; an admin can pass `user:` to remove anyone's. `/links` lists every link and
  `/whois` looks one up by Discord user or by Minecraft username — both admin-only.

`/link` verifies the name exists via Mojang, then checks the live `/guild list` roster of **every connected
guild** and accepts membership of any one of them. It **fails open only when the result is inconclusive** — no
bot connected, a timeout, output that never looked like a roster — and never when a roster parsed cleanly and
the name was absent. Across guilds that means: found if any roster has them, absent only if every roster
parsed cleanly and none did, inconclusive otherwise. Note the check necessarily weakens as guilds are added,
since one flaky roster makes the whole thing inconclusive.

The repost path needs **Manage Webhooks** and **Manage Messages** in the bridge channel. Without them the bot
falls back to the ordinary relay and reports the problem once to the log channel — latched, so it does not
spam. The repost is also sent with mentions restricted to users, because a webhook post is not subject to the
author's own permissions and an unrestricted one would let any linked user ping `@everyone`.

## Link role

`/linkrole set <role>` names a Discord role that everyone with a link should have. `/link` grants it, `/unlink`
takes it back, setting the role backfills it onto everyone already linked, and every startup re-checks the
stored links so a link made while the bot was offline still gets it. The links are the source of truth; the
roles are derived from them.

- **The role never gates the link.** A missing role, or a lost **Manage Roles**, is a configuration problem —
  it is reported and the link goes ahead regardless.
- **The sync only ever adds.** The role may be handed out for unrelated reasons, so it is never stripped from
  someone merely because they have no link. Changing or clearing the configured role likewise leaves the old
  one in place.

The bot needs **Manage Roles**, and its own highest role must rank above the link role.

## Admin roles

TriBridge has two separate permission systems.

**Discord permissions** are enforced generically before a command runs. Only `/adminrole` uses one: it requires
the Discord **Administrator** permission, because it is the command that decides who else is an admin.

**Bot-admin** is a flat list of Discord role ids in `adminRolesConfig.json`, managed with `/adminrole
add|remove <role>`, and checked inside each admin command. Everything under Management, plus `/whois`,
`/unlink user:`, `/linkrole`, `/auditchannel`, `/requestchannel` and `/requeststatus`, is gated this way.

### One Discord server

Commands are registered **globally**, but the bot serves exactly one Discord server. Every command dispatch
refuses an interaction that did not come from it — the server resolved at startup from the bridge channel, or
named explicitly with `DISCORD_GUILD_ID`.

This is not tidiness. Without the check, an administrator of *any other* server the bot happens to be in could
`/adminrole add` a role they control and inherit bot-admin over the real server, including `/send`, which runs
arbitrary commands as a Minecraft account. The check fails closed: if the server cannot be resolved, every
command is refused.

## Management commands

Six commands act on a Hypixel guild through its Minecraft account. Each takes an optional `guild` with
autocomplete; leave it out and the default guild is used.

| Command                              | Does                                                                    |
|--------------------------------------|-------------------------------------------------------------------------|
| `/invite <username> [guild]`         | `/g invite` in that guild                                               |
| `/kick <username> [reason] [guild]`  | `/g kick` in that guild                                                 |
| `/promote <username> [guild]`        | `/g promote` in that guild                                              |
| `/demote <username> [guild]`         | `/g demote` in that guild                                               |
| `/send <message> [guild]`            | Runs any command or message as that account and shows the server's reply |
| `/login [guild]`                     | Connects the bot; with no guild, every *disconnected* guild             |

`/send` **never fans out** — it always targets exactly one guild, because it runs arbitrary commands as a
Minecraft account. `/login` with no guild reconnects everything, since after an outage that is almost always
what was meant.

Hypixel gives no way to correlate a reply with the command that caused it, so the bot listens for a while and
stops when the output goes quiet. Every query for an account is serialised with a settle window afterwards,
which is the only thing stopping two concurrent commands from eating each other's output.

## Information commands

- **`/online [guild]`** — the currently online members of every guild, or one. Read off the live `/g online`
  roster, using the colour codes Hypixel puts on online names.
- **`/ping`** — Discord API latency, the interaction roundtrip, and each guild's connection status with the
  Minecraft account's own ping. It has no `guild` option: it is a status readout, so it always covers
  everything the bot is responsible for.
- **`/help`** — every command, one page per category, with ◀ / ▶ buttons. The categories are the folder names
  under `src/commands/`, so adding a folder adds a page. Commands needing a Discord permission are marked ⛔.
  The buttons stop working after five minutes.
- **`/networth [username]`** — see [SkyBlock networth](#skyblock-networth).

## Admin panel

`/adminpanel` opens an ephemeral panel with a button per admin function. Today there is one: **Global profile
change**. The panel also carries a **Stop effect** button and a **Refresh**, and shows the running state —
who, since when, how much longer, and which bridge legs are switched on.

A half-filled form lives in memory between clicks rather than in the button ids, so restarting the bot mid-set-up
costs the admin one re-pick.

## Global profile change

Pick a member and a duration, and for that long everybody's messages are reposted wearing that member's name
and avatar — in Discord, in the guild-chat copy, and on guild chat coming back the other way.

- **Each bridge direction has its own switch.** *Discord → Minecraft* governs the name guild chat is told;
  *Minecraft → Discord* governs the name on incoming guild chat embeds. Switching the first off stops the
  disguise at the bridge rather than turning it off outright — the Discord repost still wears the target's
  face.
- **Durations** run from five minutes to a day, or until stopped, or a custom value: `90m`, `2h30m`, `1d12h`,
  or a bare number read as minutes. `0`, `none`, `never`, `forever`, `permanent` and `indefinite` all mean
  "until somebody stops it".
- **Test mode** applies the disguise only to listed testers, and only in listed channels, so it can be tried
  before it goes server-wide. On the guild-chat side a tester is recognised by their
  [account link](#account-linking) — without that, testing would silently relabel guild members who never
  agreed to take part.
- **Channels can be excluded** from a live effect.
- **The target is never disguised as themselves**, and a lapsed effect is cleared the next time anything asks
  whether it is running, so a timer lost to a restart or a clock jump can never leave the disguise stuck on.

It works by reposting through a webhook and deleting the original, so it needs **Manage Webhooks** and
**Manage Messages** in *every* channel it applies to. Channels missing either are skipped and left alone, with
one warning to the log channel.

Because a repost is a new message:

- a disguised message cannot afterwards be edited or deleted by the person who wrote it;
- replies keep a jump link instead of Discord's reply header;
- messages carrying stickers, polls, forwards or voice notes are deliberately left undisguised rather than
  reposted without them.

Reposts within a channel are chained, so a burst arrives in the order it was sent.

## Auditing

Reposting deletes the original, so the real author is no longer visible on the message. Every disguised message
is therefore recorded in the channel set with `/auditchannel set`, with a jump link to the repost, plus an
entry whenever a global profile change starts or ends.

A Hypixel guild can be given its own audit channel with `/auditchannel set channel:#x guild:sb`; per-guild
overrides live in `guildsConfig.json` rather than in the audit config, so removing a guild cannot leave an
orphaned channel setting behind. `/auditchannel show` lists the default and every override, and `/auditchannel
clear` drops one.

The bot needs **View Channel**, **Send Messages** and **Embed Links** in every channel used.

## Feature requests

`/request` opens a short form — a name and a description. The submission is posted as an embed with an
incrementing id to the channel set by `/requestchannel set`, and the id is assigned and persisted *before* the
send, so two concurrent submissions cannot share one.

Admins move a request through its lifecycle with `/requeststatus <id> <status>` — **accepted**, **denied**,
**planned** or **duplicate** — which recolours and updates the original embed in place. A new request starts
as ⏳ Pending.

The request body is arbitrary member-supplied text posted by the bot, so mentions in it are suppressed; an
`@everyone` in a request does not ping. If the post fails the request is still saved, and the reply says so.

The bot needs **View Channel**, **Send Messages** and **Embed Links** in the request channel.

## Reconnection

Nothing in startup creates a Minecraft bot. A poller runs every ten seconds and starts **at most one** connect
per tick, walking the enabled guilds. That stagger is deliberate: a Hypixel restart would otherwise bring every
account back in the same millisecond and get them all throttled together. Recovery is staggered by ten seconds
per guild, which nobody notices.

- **Discord comes up even when no guild can connect.** `/guilds` is the only way to repair a broken registry,
  so it has to be reachable when the registry is broken.
- **Failures back off**, and they are reported to the guild's own log channel on the first attempt and again
  on the sixth, then not at all until it succeeds. A permanently broken account otherwise posts a failure
  notice every ten seconds for as long as the bot runs.
- **A guild waiting on a Microsoft sign-in suppresses the poller** for that guild. Without it, a guild needing
  a sign-in would start a second flow ten seconds later, and a third after that.

Connection notices go to the guild's own log channel if it has one, otherwise to `LOG_CHANNEL`.

## Logging

Two channels, for two different things.

- **`LOG_CHANNEL`** takes connection notices, failures, and anything else about running the bot. A Hypixel
  guild with its own `logChannelId` overrides it for its own messages. Anything not about one particular guild
  — account links, link-role sync, disguise permission warnings — always goes to the global one.
- **The audit channel** takes the [audit trail](#auditing), which is a record for members rather than an
  operational log.

A log line always accompanies work that has already happened, so a missing or broken log channel never takes
that work down with it — the failure is printed to the console and swallowed.

## Adding a feature to this file

Every user-visible feature is described here, and this file is the canonical version — the wiki restates it
for a different reader, and the changelog says when it changed.

A new feature gets its own `##` section: what it does, how it is switched on and configured, and any
limitation worth knowing before someone hits it. A change to an existing feature edits that section rather
than appending a note to the end of it.

Write for whoever runs or uses the bot. Implementation notes belong in the changelog's `### Technical Details`
and in [wiki/Architecture.md](../wiki/Architecture.md), not here — with one exception worth keeping: when a
rule exists because the obvious alternative was actively harmful (a silent drop, a mute, a permission
escalation), say so. That sentence is what stops the rule being "simplified" away later.
