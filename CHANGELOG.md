# TriBridge - Change Log

## Unreleased

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
