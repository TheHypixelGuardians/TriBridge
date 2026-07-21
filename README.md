# TriBridge — Discord ↔ Hypixel Guild Chat Bridge

A Node.js bot that relays messages between a Discord channel and a Hypixel guild chat in real time. Guild chat messages
appear as embeds in Discord, and Discord messages are forwarded to the in-game guild chat. Join/leave notifications are
relayed as well.

## Prerequisites

| Requirement           | Details                                                                                                                                                         |
|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Node.js**           | v22 or newer                                                                                                                                                    |
| **npm**               | Included with Node.js                                                                                                                                           |
| **Discord Bot**       | A bot application created at the [Discord Developer Portal](https://discord.com/developers/applications) with the **Message Content** privileged intent enabled |
| **Minecraft Account** | A Microsoft account that owns Minecraft: Java Edition and can join `mc.hypixel.net`                                                                             |

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Trilleo/TriBridge.git
   cd TriBridge
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create a `.env` file** in the project root with the following variables:

   ```env
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_CHANNEL_ID=your_discord_channel_id
   LOG_CHANNEL=your_log_channel_id
   MINECRAFT_USERNAME=your_minecraft_email
   ```

   | Variable | Description |
      |---|---|
   | `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
   | `DISCORD_CHANNEL_ID` | ID of the Discord channel where messages will be relayed |
   | `LOG_CHANNEL` | ID of the Discord channel where admin log notifications (e.g. disconnections, reconnections) will be sent |
   | `MINECRAFT_USERNAME` | The email address of the Microsoft account used for Minecraft |
   | `DISCORD_GUILD_ID` | *Optional.* The only server the bot accepts commands from. Defaults to the server `DISCORD_CHANNEL_ID` belongs to, so most setups can leave it out. |

   > **Note:** TriBridge serves a single Discord server. Commands are registered globally, so it
   > refuses any command sent from a server other than the one above — otherwise an administrator
   > of any other server the bot was added to could add themselves to the bot's admin roles.

## Usage

**Start the bot:**

```bash
node src/index.js
```

On the first launch the bot will open a Microsoft authentication flow for the Minecraft account. Follow the instructions
in the console to complete sign-in. Authentication tokens are cached in the `.minecraft-auth/` directory for subsequent
runs.

### Discord Commands

| Command                              | Category    | Description                                                                             |
|--------------------------------------|-------------|-----------------------------------------------------------------------------------------|
| `/invite <username>`                 | Management  | Invite a player to the Hypixel guild (admin only)                                       |
| `/kick <username> [reason]`          | Management  | Kick a member from the Hypixel guild (admin only)                                       |
| `/promote <username>`                | Management  | Promote a member in the Hypixel guild (admin only)                                      |
| `/demote <username>`                 | Management  | Demote a member in the Hypixel guild (admin only)                                       |
| `/send <message>`                    | Management  | Send a command or message to the Minecraft server and display the response (admin only) |
| `/login`                             | Management  | Connect the Minecraft bot to Hypixel (admin only)                                       |
| `/adminrole add/remove <role>`       | Management  | Configure the global admin roles for the bot (server admin only)                        |
| `/link <username>`                   | Linking     | Bind your Minecraft account to your Discord account                                     |
| `/unlink [user]`                     | Linking     | Remove a Minecraft account link — your own, or anyone's (admin only)                    |
| `/links`                             | Linking     | List every linked Minecraft account                                                     |
| `/whois <user\|username>`            | Linking     | Look up an account link by Discord user or Minecraft username (admin only)              |
| `/linkrole set/show/clear <role>`    | Linking     | Choose the role given to users with a linked Minecraft account (admin only)             |
| `/online`                            | Information | Show the currently online guild members                                                 |
| `/ping`                              | Information | Display Discord API latency and Minecraft connection status                             |
| `/help`                              | Information | Browse all available commands by category                                               |
| `/request`                           | Requests    | Submit a feature request through a short form                                           |
| `/requestchannel set/show <channel>` | Requests    | Choose the channel feature requests are posted to (admin only)                          |
| `/requeststatus <id> <status>`       | Requests    | Mark a feature request as accepted, denied, planned or duplicate (admin only)           |

### How It Works

- **Discord → Minecraft** — Messages sent in the configured Discord channel are forwarded to the Hypixel guild chat (
  `/gc`).
- **Minecraft → Discord** — Guild chat messages, as well as member join/leave events, are relayed back to the Discord
  channel as rich embeds.
- **Auto-reconnect** — The bot automatically attempts to reconnect to Hypixel if the Minecraft connection drops.
- **Account linking** — Users who run `/link` have their Discord messages reposted with their Minecraft head and name,
  and the guild chat copy is attributed to their Minecraft name. This requires the **Manage Webhooks** and **Manage
  Messages** permissions; without them the bot falls back to the standard relay.
- **Link role** — If a role is set with `/linkrole set`, `/link` grants it and `/unlink` takes it back. Setting the role
  backfills it onto everyone already linked, and the roles are re-checked on every startup so links made while the bot
  was offline still get it. This needs the **Manage Roles** permission and the bot's own role ranked above the link
  role; a role that cannot be granted is reported to the log channel and never blocks the link itself.
- **Feature requests** — `/request` opens a form; the submission is posted as an embed with an incrementing ID to the
  channel set by `/requestchannel set`. Admins move a request through its lifecycle with `/requeststatus`, which
  recolours and updates the original embed in place. The bot needs **View Channel**, **Send Messages** and **Embed Links
  ** in that channel.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the release history. [DISCORD_CHANGELOG.md](DISCORD_CHANGELOG.md) holds a shorter
version of the same history, formatted to be pasted into a Discord announcement channel.

## Updating

When new commits are pushed to the repository, pull the latest changes and reinstall dependencies:

```bash
git pull
npm install
```

Then restart the bot:

```bash
node src/index.js
```
