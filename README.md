# TriBridge — Discord ↔ Hypixel Guild Chat Bridge

A Node.js bot that relays messages between a Discord channel and Hypixel guild chat in real time. Guild chat messages
appear as embeds in Discord, and Discord messages are forwarded to the in-game guild chat. Join/leave notifications are
relayed as well.

One bot can bridge **several Hypixel guilds at once** — one Minecraft account per guild — through the same Discord
channel. Each guild gets its own colour and chat tag, and a `!tag` prefix targets a single guild.

## Prerequisites

| Requirement           | Details                                                                                                                                                         |
|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Node.js**           | v22 or newer                                                                                                                                                    |
| **npm**               | Included with Node.js                                                                                                                                           |
| **Discord Bot**       | A bot application created at the [Discord Developer Portal](https://discord.com/developers/applications) with the **Message Content** privileged intent enabled |
| **Minecraft Account** | One Microsoft account **per Hypixel guild**, each owning Minecraft: Java Edition and able to join `mc.hypixel.net`                                              |

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
   | `LOG_CHANNEL` | ID of the Discord channel where admin log notifications (e.g. disconnections, reconnections) will be sent. A Hypixel guild can override this with its own channel. |
   | `MINECRAFT_USERNAME` | The email address of the Microsoft account used for Minecraft. Only used on a fresh install, to register the first Hypixel guild; once `guildsConfig.json` exists it is ignored and accounts are managed with `/guilds`. |
   | `DISCORD_GUILD_ID` | *Optional.* The only Discord server the bot accepts commands from. Defaults to the server `DISCORD_CHANNEL_ID` belongs to, so most setups can leave it out. |

   > **Note:** TriBridge serves a single **Discord server**, however many Hypixel guilds it bridges.
   > Commands are registered globally, so it refuses any command sent from a server other than the
   > one above — otherwise an administrator of any other server the bot was added to could add
   > themselves to the bot's admin roles.

## Usage

**Start the bot:**

```bash
node src/index.js
```

On a fresh install the account in `MINECRAFT_USERNAME` is registered as the first Hypixel guild and the bot opens a
Microsoft authentication flow for it in the console. Authentication tokens are cached in the `.minecraft-auth/`
directory for subsequent runs, one entry per account.

### Hypixel guilds

The bridged guilds live in `guildsConfig.json` in the project root (gitignored, created on demand) and are managed
entirely from Discord with `/guilds` — you should not need to edit the file by hand.

| Field | Meaning |
|---|---|
| `key` | Short internal id, e.g. `sb`. Lowercase letters, digits, `-` and `_`. **Cannot be changed** — rename means remove and re-add. |
| `name` | Display name used in replies and logs |
| `tag` | 2–8 characters. Typed as `!tag message` to target this guild, and shown next to names on incoming chat |
| `account` | Microsoft account email for this guild's Minecraft bot. **Cannot be changed**, and no two guilds may share one |
| `color` | Hex colour for this guild's relayed messages, e.g. `#2ECC71` |
| `logChannelId` | Optional per-guild log channel. Falls back to `LOG_CHANNEL` |
| `auditChannelId` | Optional per-guild audit channel. Falls back to `/auditchannel` |
| `enabled` | Set to `false` to disconnect a guild without removing it |

**Adding a guild:**

```bash
/guilds add key:sb name:SkyBlock Guild tag:SB account:you@example.com
```

The bot registers the guild, then starts a Microsoft sign-in and sends you the device code in a private reply — no
console access needed. Open the link, enter the code, and sign in as that account. If a token later expires, `/guilds
auth` repeats the flow. The code is only ever sent to you privately or by DM, never to a public channel: anyone holding
it could complete the sign-in with a different account.

> **The account address is the key to its cached token.** Changing it after the fact silently starts a fresh sign-in
> against a new cache, so `/guilds` does not allow it — remove the guild and add it again instead.

### Discord Commands

| Command                              | Category    | Description                                                                             |
|--------------------------------------|-------------|-----------------------------------------------------------------------------------------|
| `/invite <username> [guild]`         | Management  | Invite a player to a Hypixel guild (admin only)                                         |
| `/kick <username> [reason] [guild]`  | Management  | Kick a member from a Hypixel guild (admin only)                                         |
| `/promote <username> [guild]`        | Management  | Promote a member in a Hypixel guild (admin only)                                        |
| `/demote <username> [guild]`         | Management  | Demote a member in a Hypixel guild (admin only)                                         |
| `/send <message> [guild]`            | Management  | Send a command or message to the Minecraft server and display the response (admin only) |
| `/login [guild]`                     | Management  | Connect Minecraft bots to Hypixel; all disconnected guilds by default (admin only)      |
| `/guilds add/remove/list/edit/default/auth` | Management | Manage the bridged Hypixel guilds and sign their accounts in (admin only)          |
| `/adminrole add/remove <role>`       | Management  | Configure the global admin roles for the bot (server admin only)                        |
| `/adminpanel`                        | Management  | Open the admin panel to run and configure admin functions (admin only)                  |
| `/auditchannel set/show/clear [guild]` | Management | Choose the channel admin panel actions are recorded in (admin only)                     |
| `/link <username>`                   | Linking     | Bind your Minecraft account to your Discord account                                     |
| `/unlink [user]`                     | Linking     | Remove a Minecraft account link — your own, or anyone's (admin only)                    |
| `/links`                             | Linking     | List every linked Minecraft account                                                     |
| `/whois <user\|username>`            | Linking     | Look up an account link by Discord user or Minecraft username (admin only)              |
| `/linkrole set/show/clear <role>`    | Linking     | Choose the role given to users with a linked Minecraft account (admin only)             |
| `/online [guild]`                    | Information | Show the currently online members of every guild, or just one                           |
| `/ping`                              | Information | Display Discord API latency and each guild's Minecraft connection status                |
| `/help`                              | Information | Browse all available commands by category                                               |
| `/request`                           | Requests    | Submit a feature request through a short form                                           |
| `/requestchannel set/show <channel>` | Requests    | Choose the channel feature requests are posted to (admin only)                          |
| `/requeststatus <id> <status>`       | Requests    | Mark a feature request as accepted, denied, planned or duplicate (admin only)           |

### How It Works

- **Discord → Minecraft** — Messages sent in the configured Discord channel are forwarded to Hypixel guild chat (`/gc`).
  A message beginning `!tag ` goes only to the guild with that tag; anything else goes to every guild. An unrecognised
  tag is *not* dropped — the message is delivered everywhere exactly as typed and picks up a ❓ reaction so the mistake
  is visible. To start a message with a literal `!`, double it: `!!sb hi` arrives as `!sb hi`. Guilds whose bot is
  offline are skipped silently.
- **Minecraft → Discord** — Guild chat messages, as well as member join/leave events, are relayed back to the Discord
  channel as rich embeds, coloured per guild with the guild's tag beside the player's name. With only one guild
  configured the tag is omitted entirely.
- **Auto-reconnect** — The bot automatically reconnects to Hypixel when a connection drops, one guild per ten-second
  tick so a Hypixel restart cannot bring every account back at once, and backing off after repeated failures. Connection
  notices go to the guild's own log channel if it has one, otherwise `LOG_CHANNEL`.
- **Account linking** — Users who run `/link` have their Discord messages reposted with their Minecraft head and name,
  and the guild chat copy is attributed to their Minecraft name. Membership is checked against every connected guild's
  live roster, and being in any one of them is enough. This requires the **Manage Webhooks** and **Manage Messages**
  permissions; without them the bot falls back to the standard relay.
- **Link role** — If a role is set with `/linkrole set`, `/link` grants it and `/unlink` takes it back. Setting the role
  backfills it onto everyone already linked, and the roles are re-checked on every startup so links made while the bot
  was offline still get it. This needs the **Manage Roles** permission and the bot's own role ranked above the link
  role; a role that cannot be granted is reported to the log channel and never blocks the link itself.
- **Feature requests** — `/request` opens a form; the submission is posted as an embed with an incrementing ID to the
  channel set by `/requestchannel set`. Admins move a request through its lifecycle with `/requeststatus`, which
  recolours and updates the original embed in place. The bot needs **View Channel**, **Send Messages** and **Embed Links
  ** in that channel.
- **Admin panel** — `/adminpanel` opens an ephemeral embed with a button per admin function. The first is **Global
  Profile Change**: pick a member and a duration, and for that long everybody's messages are reposted wearing that
  member's name and avatar — in Discord, in the guild chat copy, and on guild chat coming back the other way. Each
  bridge direction has its own switch on the panel, so the disguise can be kept out of guild chat, off the guild chat
  coming back, or both. It ships with a test system, so listed testers in listed channels can try it before it is
  turned on server-wide, and it can be stopped from the panel at any time.
- **Auditing** — Reposting deletes the original, so the real author is no longer visible on the message. Every disguised
  message is recorded in the channel set by `/auditchannel set`, along with a jump link to the repost, plus an entry
  whenever a global profile change starts or ends. A guild can be given its own audit channel with
  `/auditchannel set channel:#x guild:sb`. The bot needs **View Channel**, **Send Messages** and **Embed Links** in
  every channel used.

### Permissions

In the bridge channel the bot needs **Add Reactions**, so a message with an unrecognised guild tag can be flagged with
a ❓. Without it the message is still delivered; only the marker is lost.

Beyond the bridge channel, the global profile change needs **Manage Webhooks** and **Manage Messages** in *every*
channel it is meant to apply to — it works by reposting through a webhook and deleting the original. Channels where the
bot is missing either permission are skipped and left alone, with one warning sent to the log channel.

Because a repost is a new message, a disguised message cannot afterwards be edited or deleted by the person who wrote
it, replies keep only a jump link instead of Discord's reply header, and messages carrying stickers, polls, forwards or
voice notes are deliberately left undisguised rather than reposted without them.

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
