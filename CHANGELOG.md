# TriBridge - Change Log

## Unreleased

### New Features

#### Requests

+ Added `/request`, which opens a form asking for a feature name and a description and posts the submission
  as an embed in a dedicated channel. Anyone can use it.
+ Every request gets its own incrementing number and is stored on disk, so it can be referred to and acted on
  later.
+ Added `/requestchannel set <channel>` and `/requestchannel show` for server administrators to choose where
  requests are posted. The bot checks it can actually post there before accepting the channel.
+ Added `/requeststatus <id> <status>` for admins to mark a request as accepted, denied, planned or
  duplicate. The original embed is updated in place with the new status and colour.

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
