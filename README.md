# TriBridge — Discord ↔ Hypixel Guild Chat Bridge

A Node.js bot that relays messages between a Discord channel and Hypixel guild chat in real time. Guild chat messages
appear as embeds in Discord, and Discord messages are forwarded to the in-game guild chat. Join/leave notifications are
relayed as well.

One bot can bridge **several Hypixel guilds at once** — one Minecraft account per guild — through the same Discord
channel. Each guild gets its own colour and chat tag, and a `!tag` prefix targets a single guild. Guilds can also be
bridged **to each other**, so their members can talk in-game without going through Discord at all.

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
| `tag` | 2–8 characters. Typed as `!tag message` to target this guild, and shown next to names on incoming chat. `nw` and `networth` are reserved for the [networth chat command](#chat-commands) |
| `account` | Microsoft account email for this guild's Minecraft bot. **Cannot be changed**, and no two guilds may share one |
| `color` | Hex colour for this guild's relayed messages, e.g. `#2ECC71` |
| `logChannelId` | Optional per-guild log channel. Falls back to `LOG_CHANNEL` |
| `auditChannelId` | Optional per-guild audit channel. Falls back to `/auditchannel` |
| `enabled` | Set to `false` to disconnect a guild without removing it |
| `crossBridge` | Set to `true` to share guild chat with the other cross-bridged guilds. Off by default; see [Guild-to-guild bridging](#guild-to-guild-bridging) |

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

### Guild-to-guild bridging

Registered guilds share a Discord channel but not their guild chat, unless you switch it on:

```bash
/guilds edit guild:sb crossbridge:True
/guilds edit guild:main crossbridge:True
```

From then on a message in either guild is repeated into the other as `[SB] Notch: hello` — the guild's tag in front of
the speaker's name, where Hypixel already puts rank brackets. `/guilds list` marks the participating guilds with 🔁.

- **Off by default**, including for guilds registered before this existed, so upgrading never starts forwarding chat
  between guilds that were only meant to share a Discord channel.
- **It takes two.** One guild with the flag on shares with nobody; `/guilds edit` says so when that is the case.
- **The flag is both directions at once.** A guild that does not send its chat elsewhere does not receive anyone else's
  either, so a guild can always be taken out of the arrangement from its own row.
- **Player chat only.** Join and leave announcements stay in the guild they happened in — they are noise elsewhere, and
  they would spend the per-account chat budget that real messages need.
- **Real names.** A running global profile change does not rename forwarded chat; its two switches cover the Discord
  legs of the bridge only.
- **Late messages are dropped, not queued.** A forwarded line still waiting after ten seconds is discarded, so one guild
  being spammed cannot push every other guild's chat minutes behind.

### Chat commands

Some things are asked for from either side of the bridge rather than through a slash command. Type them in guild chat
or in the bridge channel:

```bash
!nw Notch
```

- **`!nw <username>`** — that player's SkyBlock networth, on whichever of their profiles is worth the most. The total
  counts everything, cosmetics and soulbound items included; the unsoulbound figure is shown next to it. `!networth`
  is the same command.
- **A command is answered, not relayed.** Asking in guild chat does not put the question into Discord or into the
  cross-bridged guilds — the answer carries the question with it, and forwarding it would spend every other guild's
  per-account chat budget on a line none of them asked for. Asked in guild chat, the answer goes back into that guild
  *and* appears here as an embed; asked here, it stays here.
- **Double the `!` to send it literally.** `!!nw x` reaches guild chat as the text `!nw x` and runs nothing, the same
  escape guild tags use.
- **`nw` and `networth` are reserved guild tags.** `/guilds add` and `/guilds edit` refuse them, because `!nw hi` would
  otherwise be ambiguous. A guild registered with one of them before this existed keeps it, and keeps its routing.
- **Answers are cached for ten minutes** and rate limited to one lookup per person every twenty seconds, so a busy
  guild costs a handful of requests an hour.

Networth figures come from [SkyCrypt](https://sky.shiiyu.moe)'s public API, which serves from its own cache. A player
SkyCrypt has never loaded cannot be looked up until their page there has been opened once — the bot says so and links
it rather than reporting a wrong number. The bot needs outbound access to `sky.shiiyu.moe` and `api.mojang.com`.

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
| `/networth [username]`               | Information | Show a player's SkyBlock networth on their richest profile                               |
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
  is visible. To start a message with a literal `!`, double it: `!!sb hi` arrives as `!sb hi`. The prefix is stripped
  from what Discord shows as well as from what the guild is sent, so both sides read the same words. A guild whose bot
  is offline is skipped silently on a broadcast, but a message aimed at *one* guild with `!tag` that reaches nothing is
  marked 📡 — nobody else got that one either.
- **Minecraft → Discord** — Guild chat messages, as well as member join/leave events, are relayed back to the Discord
  channel as rich embeds, coloured per guild with the guild's tag beside the player's name. With only one guild
  configured the tag is omitted entirely.
- **Minecraft → Minecraft** — When two or more guilds have `crossBridge` on, chat in one is forwarded into the others
  tagged with the guild it came from (`[SB] Notch: hello`). Off by default and configured with `/guilds edit`; see
  [Guild-to-guild bridging](#guild-to-guild-bridging).
- **SkyBlock networth** — `!nw <username>`, typed in guild chat or the bridge channel, answers with that player's
  networth on their highest-value profile; `/networth [username]` does the same here and defaults to your linked
  account. The total includes cosmetics and soulbound items, with the unsoulbound figure alongside, and a player whose
  inventory API is off is flagged `(API off)` because their number is an undercount rather than a low score. See
  [Chat commands](#chat-commands) for how the trigger behaves and where the data comes from.
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
a ❓ and one aimed at an offline guild with a 📡. Without it the message is still delivered; only the marker is lost.

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
