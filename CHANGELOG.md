# TriBridge - Change Log

## Unreleased

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
