# TriBridge - Change Log

## Unreleased

### New Features

#### Bridge

+ Added **guild-to-guild bridging**: chat in one Hypixel guild can now be shared straight into the other
  bridged guilds, so members of different guilds can talk to each other in-game without anyone having to
  watch Discord.
  + Off by default and turned on per guild with `/guilds edit guild:sb crossbridge:True`. It takes at
    least two guilds with it on before anything is shared.
  + The switch covers both directions: a guild that is not sharing its own chat does not receive anyone
    else's either.
  + Forwarded messages arrive tagged with the guild they came from — `[SB] Notch: hello` — so it is
    always clear who is talking and where from.
  + Only player chat is shared. Join and leave announcements stay in their own guild.
+ The bot can now bridge **several Hypixel guilds at once**, each with its own Minecraft account, through
  the same Discord channel.
  + Start a message with `!tag` to send it to one guild only — `!sb hey` reaches just the guild tagged
    `SB`. A message with no tag goes to every guild, as it always did.
  + A tag nobody recognises is never swallowed: the message is still delivered everywhere, exactly as
    typed, and gets a ❓ reaction so a typo is visible. This needs the **Add Reactions** permission in
    the bridge channel.
  + `!!` sends a literal `!` — `!!sb hi` reaches guild chat as `!sb hi`.
  + Guild chat coming back into Discord is colour-coded per guild and carries the guild's tag next to the
    player's name, so it is obvious which guild said what.
+ With only one guild configured, nothing changes: no tags on incoming messages, the original green, and
  every message goes to the one guild whatever you type.

#### Management

+ Added `/guilds` to manage the bridged Hypixel guilds, admin-only and private.
  + `/guilds add` registers a guild and signs its Minecraft account in **from Discord** — the Microsoft
    code arrives in your own private reply, so nobody needs console access to add an account. `/guilds auth`
    repeats the sign-in when a token expires.
  + `/guilds list`, `edit`, `remove` and `default` cover the rest. Account addresses are masked in every
    reply.
  + Each guild can have its own name, chat tag, colour, log channel and audit channel, and can be
    switched off without being removed.
+ `/invite`, `/kick`, `/promote`, `/demote`, `/send` and `/login` take an optional `guild` to choose which
  guild they act on, with autocomplete. Leave it out and they use the default guild.
  + `/send` never fans out — it always targets exactly one guild, because it runs arbitrary commands as
    the Minecraft account.
  + `/login` on its own reconnects **every** disconnected guild, since after an outage that is almost
    always what was meant.
+ `/auditchannel set` and `/auditchannel clear` take an optional `guild`, so one guild's admin actions can
  be recorded somewhere different. `/auditchannel show` lists the default and every override.
+ `/guilds edit` takes a `crossbridge` option to switch guild-to-guild bridging on or off for one guild,
  and warns when it is the only guild sharing so far. `/guilds list` marks the sharing guilds with 🔁.

#### Information

+ `/online` now covers every guild at once, one section per guild in its own colour. Name a `guild` to see
  just that one.
+ `/ping` reports each guild's Minecraft connection on its own line, including whether it is connecting or
  waiting for a sign-in.

### Improvements

#### Bridge

+ Connection notices now say which guild they are about, and can be routed to a per-guild log channel.
+ A guild whose bot is offline is skipped quietly instead of holding anything up; the other guilds still
  get the message.
+ Reconnections are staggered — one guild at a time — so a Hypixel restart cannot bring every account back
  at once and get them all throttled.

#### Account Linking

+ `/link` now accepts a member of **any** bridged guild. It still refuses only when every roster was read
  successfully and the name was in none of them.

### Fixes

#### Bridge

+ A guild tag is no longer left in the message Discord shows. Sending `!sb hello` as a linked user reposted
  it as "!sb hello" while guild chat correctly received "hello", so the two sides disagreed about what was
  said and the tag looked like it had been ignored. `!!sb hi` now shows as `!sb hi` in Discord too.
+ The ❓ marking an unrecognised guild tag no longer disappears for linked users. It was added to the
  original message a moment before the repost deleted it, so the one hint that a tag was mistyped was lost
  for exactly the people most likely to see it.
+ A tagged message aimed at a guild whose bot is offline is now marked 📡 instead of vanishing without a
  word. Untagged messages stay quiet, as before — the other guilds still got those.
+ Two guild commands running at the same time no longer swallow each other's answers. Each account handles
  one query at a time now, so `/online` and `/invite` fired together both report correctly.
+ `/online` no longer leaves a stray listener behind when the server does not answer in time.
+ A late error arriving from an already-disconnected Minecraft bot no longer crashes the whole bot.
+ Reconnection no longer tears down a bot that is still in the middle of connecting.
+ An account that cannot connect at all no longer retries every ten seconds forever, or fills the log
  channel with the same failure. It backs off, and reports the first failure and then one more.

#### Management

+ Changing an option nested inside a subcommand — like the channel on `/auditchannel set` — now updates the
  command with Discord instead of being silently ignored.

### Technical Details

#### Core

+ `bridge.mcBot` and its connection flags are replaced by a registry of one bot record per Hypixel guild.
  Minecraft event handlers identify their guild from the bot they were called with.
+ The collector idiom that was copied into seven commands is now `utils/queryGuild.js`, serialised per bot
  with a settle window between queries.
+ Outbound guild chat goes through a per-account rate limiter, since a broadcast now multiplies the packet
  rate by the number of guilds. Relayed chat may also be given a maximum queue age, so a burst in one guild
  is dropped rather than delivered minutes late into another.
+ The guild-chat formats are parsed in one place, `utils/guildChat.js`, shared by the Discord relay and the
  guild-to-guild relay, and the cross-guild duplicate guard is `utils/relayDedupe.js`.
+ `bridge.guildId` and `utils/guildGuard.js` are renamed to `discordServerId` and `utils/serverGuard.js`,
  so "guild" unambiguously means a Hypixel guild everywhere else.
+ `areCommandsDifferent.js` compares the `autocomplete` flag and recurses into subcommand options.
+ The four copies of the log-channel helper are collapsed into `utils/guildLog.js`.
+ Existing installations are migrated automatically: on first run without `guildsConfig.json`, the account
  in `MINECRAFT_USERNAME` is registered as the first guild.

## Version 1.2.1

### New Features

#### Admin Panel

+ A global profile change can now be limited to one side of the bridge. Two switches on the panel turn the
  disguise off for **Discord → Minecraft** and **Minecraft → Discord** independently.
  + With Discord → Minecraft off, messages sent in Discord are still reposted under the target, but the copy that
    reaches guild chat is attributed to whoever really sent it — their linked Minecraft name, or their Discord
    name if they have none.
  + With Minecraft → Discord off, guild chat arriving in the bridge channel keeps the real player's name and head.
  + Both switches are remembered between runs and can be flipped while an effect is running, taking effect on the
    next message. An effect started with a side switched off says so in the audit channel.

## Version 1.2.0

### New Features

#### Admin Panel

+ Added `/adminpanel`, a single admin-only panel with a button for each admin function. It replies privately and
  shows what is running, who started it, when it ends and how the feature is scoped.
+ Added the first function, **Global Profile Change**: pick a member and a duration, and for that long every
  message sent in the server is reposted wearing that member's name and avatar.
  + The effect carries across the bridge in both directions — the guild chat copy is attributed to the target
    (their Minecraft name if they have one linked), and guild chat coming back into Discord is shown under the
    target as well. Guild join and leave announcements are deliberately left alone.
  + Durations can be picked from a list (5 minutes up to 24 hours), typed in freehand (`90m`, `2h30m`, `3d`), or
    set to run until somebody stops it.
  + The panel's **Stop effect** button ends it immediately, and everything is back to normal on the next message.
  + An effect that is still running when the bot restarts is picked back up, and one that ran out while the bot
    was offline is cleared and reported.
+ Added a test system so the effect can be rehearsed before it is turned loose on the server.
  + In test mode only listed testers, posting in listed channels, are affected — everybody else is untouched. Over
    the bridge, only guild chat from a tester's own linked Minecraft account is rewritten.
  + In live mode everybody is affected, everywhere except a list of channels you exclude.
  + Testers and both channel lists are set from the panel and are remembered between runs.
+ Added `/auditchannel set <channel>`, `/auditchannel show` and `/auditchannel clear` for admins to choose where
  admin actions are recorded.
  + Reposting deletes the original message, so the audit line is the only record of who really sent it. Every
    disguised message gets one, with a jump link to the repost, alongside an entry each time an effect starts or
    ends.
  + The bot checks it can actually post there before accepting the channel. A missing or broken audit channel never
    stops the effect itself.

### Improvements

#### Account Linking

+ Reposted messages that are replies now carry a link back to the message they were replying to. Reposting loses
  Discord's own reply header, so previously the reply simply looked like an ordinary message.
+ Linked users' messages are now reposted correctly in threads, not just in the bridge channel itself.

### Fixes

#### Account Linking

+ Messages carrying a sticker, a poll, a forwarded message or a voice note are no longer reposted under the linked
  Minecraft identity. A repost cannot carry any of those, so they were being silently dropped; the message is now
  left as it was sent instead.

### Technical Details

#### Core

+ Message reposts are now queued per channel, so a burst of messages cannot arrive out of order.
+ The identity a message is shown under is resolved in one place, with a global profile change outranking an
  account link, which outranks the plain Discord author.

## Version 1.1.0

### New Features

#### Account Linking

+ Linking a Minecraft account with `/link` now gives the member a role, and `/unlink` takes it back again.
+ Added `/linkrole set <role>`, `/linkrole show` and `/linkrole clear` for admins to choose that role.
  + Setting a role immediately gives it to everybody who is already linked, including links made before this
    update, and reports how many members it reached.
  + The bot refuses a role it cannot actually hand out — one above its own highest role, one managed by
    another integration, or any role at all while it is missing **Manage Roles**.
  + Pointing `/linkrole` at a different role leaves the old one on members; remove it yourself if you no
    longer want it. `/linkrole clear` likewise only stops handing the role out.
+ Link roles are re-checked every time the bot starts, so links made while it was offline and members who
  rejoined the server and lost their roles are caught up automatically.
+ A role that cannot be granted never blocks the link itself — the link goes through and the problem is
  reported in the log channel instead.

#### Requests

+ Added `/request`, which opens a form asking for a feature name and a description and posts the submission
  as an embed in a dedicated channel. Anyone can use it.
+ Every request gets its own incrementing number and is stored on disk, so it can be referred to and acted on
  later.
+ Added `/requestchannel set <channel>` and `/requestchannel show` for admins to choose where requests are
  posted. The bot checks it can actually post there before accepting the channel.
+ Added `/requeststatus <id> <status>` for admins to mark a request as accepted, denied, planned or
  duplicate. The original embed is updated in place with the new status and colour.

### Fixes

#### Core

+ The bot now only answers commands sent from the server it is set up for, and ignores them everywhere else.
  + Previously, anyone who added the bot to a server of their own was an administrator there, and could use
    `/adminrole` to make themselves a bot admin over *your* guild — including `/send`, which runs any command
    as the bot's Minecraft account.
  + The server is worked out from the bridge channel, so no configuration change is needed. Set the new
    optional `DISCORD_GUILD_ID` to override it.

#### Management

+ `/login` now requires an admin role. It was the one management command anybody could run, and each use
  reconnects the Minecraft bot.

#### Account Linking

+ `/whois` now requires an admin role. It showed the same Discord ↔ Minecraft links that `/links` has always
  kept to admins.

### Improvements

#### Management

+ `/invite`, `/kick`, `/promote` and `/demote` now reject anything that is not a real Minecraft username
  instead of passing it to the server, and `/kick` reasons are flattened to a single line.

## Version 1.0.0

### New Features

#### Bridge

+ Two-way relay between a Discord channel and a Hypixel guild chat. Guild chat arrives in Discord as rich
  embeds, Discord messages are forwarded to guild chat, and member join/leave events are relayed as well.
+ Auto-reconnect: if the Minecraft connection drops the bot reconnects on its own and reports the
  disconnection and recovery to the log channel.

#### Account Linking

+ Added `/link <username>` to bind your Minecraft account to your Discord account. The username is verified
  against Mojang and checked against the live guild roster, and the binding is stored by UUID so it survives
  Minecraft name changes.
+ Once linked, your Discord messages are reposted through a webhook with your Minecraft head and name, and
  the guild-chat copy is attributed to your Minecraft name instead of your Discord name.
+ Added `/unlink` to remove a link (your own, or anyone's as an admin), `/links` to list every linked
  account, and `/whois` to look up a link by either Discord user or Minecraft username.

#### Management

+ Added guild management commands for admins: `/invite`, `/kick`, `/promote`, `/demote`, and `/send` to run
  an arbitrary command in-game and show the server's response.
+ Added `/login` to connect the Minecraft bot to Hypixel on demand.
+ Added `/adminrole add/remove <role>` for server administrators to choose which Discord roles count as bot
  admins.

#### Information

+ Added `/online` to list the guild members currently online, `/ping` for Discord API latency and Minecraft
  connection status, and `/help` to browse every command by category.

### Technical Details

#### Core

+ Initial release. Node v22+, CommonJS, no build step; `discord.js`, `mineflayer`, `prismarine-auth` and
  `dotenv` are the only dependencies.
+ Both clients share a single `src/bridge.js` state module and a single event handler
  (`src/handlers/eventHandler.js`) that maps `src/events/<client>/<eventName>/*.js` onto client listeners.
+ Slash commands are declared in `src/commands/<category>/` and diffed against Discord's registered
  application commands on startup, so adding a file is enough to register a command.
