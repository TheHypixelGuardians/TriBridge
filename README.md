# TriBridge — Discord ↔ Hypixel Guild Chat Bridge

A Node.js bot that relays messages between a Discord channel and Hypixel guild chat in real time. Guild chat
appears in Discord as embeds, Discord messages are spoken in guild chat, and slash commands let admins run
guild management commands in-game.

One bot can bridge **several Hypixel guilds at once** — one Minecraft account per guild — through the same
Discord channel. Each guild gets its own colour and chat tag, and a `!tag` prefix targets a single guild.
Guilds can also be bridged **to each other**, so their members talk in-game without going through Discord at
all.

> **Two things are called a "guild" here.** A *Hypixel guild* is one of the Minecraft guilds the bot bridges;
> there can be several. A *Discord server* is the single community the bot serves; there is exactly one.

## Features

- **The bridge** — one Discord channel and Hypixel guild chat, relayed both ways, joins and leaves included.
- **Multiple Hypixel guilds** — one Minecraft account each, all through the same channel, colour-coded and
  tagged on the way back.
- **Guild tags** — `!sb hey` reaches one guild; anything else reaches all of them. An unrecognised tag is
  delivered anyway and flagged, never dropped.
- **Guild-to-guild bridging** — chat shared directly between the bridged guilds, in-game, opt-in per guild.
- **Officer chat** — a two-way Discord channel for Hypixel officer chat, shared between guilds with `!tag`
  routing or one per guild, and optionally shared between the guilds in-game as well. Off until a channel is
  named, and everyone who can post there speaks as an officer in-game.
- **Account linking** — `/link` reposts your Discord messages with your Minecraft head and name, and attributes
  the guild-chat copy to your Minecraft name.
- **Link role** — an optional Discord role handed out automatically to everyone who links, backfilled at every
  startup.
- **SkyBlock networth** — `!nw <username>` from either side of the bridge, or `/networth`, on a player's
  richest profile.
- **Hypixel guild registry** — `/guilds` registers, edits and signs guilds in entirely from Discord; the
  Microsoft device code arrives in a private reply, never the console.
- **Auto-reconnect** — dropped accounts come back on their own, one guild per ten-second tick so a Hypixel
  restart can't throttle them all at once.
- **Admin roles** — a flat list of Discord roles that hold bot-admin, separate from Discord's own permissions.
- **Admin panel** — `/adminpanel`, a button per admin function, with the running state on the embed.
- **Global profile change** — everybody's messages reposted wearing one member's name and face, for a set
  duration, with a switch per bridge direction and a test mode.
- **Auditing** — every disguised message recorded with a jump link, so the real author is never lost.
- **Feature requests** — `/request` opens a form; admins move each request through a status and the embed
  updates in place.
- **Guild management** — `/invite`, `/kick`, `/promote`, `/demote`, `/send` and `/login`, each targeting one
  guild or the default.
- **Information** — `/online`, `/ping`, `/help` and `/networth`.

*See [Features](docs/FEATURES.md) for what each one does in full, the [wiki](https://github.com/Trilleo/TriBridge/wiki)
for the same material split by audience, and the [change log](CHANGELOG.md) for what's new in each release.*

## Prerequisites

| Requirement           | Details                                                                                                                                              |
|-----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Node.js**           | v22 or newer                                                                                                                                         |
| **npm**               | Included with Node.js                                                                                                                                |
| **Discord bot**       | An application at the [Discord Developer Portal](https://discord.com/developers/applications) with the **Message Content** privileged intent enabled |
| **Minecraft account** | One Microsoft account **per Hypixel guild**, each owning Minecraft: Java Edition and able to join `mc.hypixel.net`                                   |

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

3. **Create a `.env` file** in the project root. Copy [`.env.example`](.env.example) and fill it in:

   ```bash
   cp .env.example .env
   ```

   ```env
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_CHANNEL_ID=your_bridge_channel_id
   LOG_CHANNEL=your_log_channel_id
   MINECRAFT_USERNAME=you@example.com
   ```

   | Variable             | Description                                                                                          |
      |----------------------|------------------------------------------------------------------------------------------------------|
   | `DISCORD_TOKEN`      | Bot token from the Discord Developer Portal                                                          |
   | `DISCORD_CHANNEL_ID` | The bridge channel — the one channel wired to guild chat                                             |
   | `LOG_CHANNEL`        | Where connection notices and warnings go. A Hypixel guild can override it with its own channel        |
   | `MINECRAFT_USERNAME` | Microsoft account email for the first Hypixel guild. **Ignored once `guildsConfig.json` exists**       |
   | `DISCORD_GUILD_ID`   | *Optional.* The only Discord server the bot accepts commands from. Defaults to the bridge channel's server |

   > **TriBridge serves a single Discord server**, however many Hypixel guilds it bridges. Commands are
   > registered globally, so it refuses any command sent from another server — otherwise an administrator of
   > any other server the bot was added to could add themselves to the bot's admin roles.

4. **Invite the bot** with the permissions listed
   in [Permissions](https://github.com/Trilleo/TriBridge/wiki/Permissions).

5. **Start it**

   ```bash
   npm start
   ```

   On a fresh install the account in `MINECRAFT_USERNAME` is registered as the first Hypixel guild and a
   Microsoft device-code flow opens in the console. Tokens are cached in `.minecraft-auth/`, one entry per
   account.

6. **Set the admin roles** — `/adminrole add role:@Staff`. Until then, nothing admin-gated works.

Full walkthrough: [Installation](https://github.com/Trilleo/TriBridge/wiki/Installation).

## Commands

| Command                                     | Category    | Description                                                               |
|---------------------------------------------|-------------|---------------------------------------------------------------------------|
| `/invite <username> [guild]`                | Management  | Invite a player to a Hypixel guild (admin only)                           |
| `/kick <username> [reason] [guild]`         | Management  | Kick a member from a Hypixel guild (admin only)                           |
| `/promote <username> [guild]`               | Management  | Promote a member in a Hypixel guild (admin only)                          |
| `/demote <username> [guild]`                | Management  | Demote a member in a Hypixel guild (admin only)                           |
| `/send <message> [guild]`                   | Management  | Run a command as the Minecraft account and show the reply (admin only)    |
| `/login [guild]`                            | Management  | Connect the bots; all disconnected guilds by default (admin only)         |
| `/guilds add/remove/list/edit/default/auth` | Management  | Manage the bridged Hypixel guilds and sign their accounts in (admin only) |
| `/adminrole add/remove <role>`              | Management  | Configure the bot-admin roles (server admin only)                         |
| `/adminpanel`                               | Management  | Open the admin panel (admin only)                                         |
| `/auditchannel set/show/clear [guild]`      | Management  | Choose where admin panel actions are recorded (admin only)                |
| `/link <username>`                          | Linking     | Bind your Minecraft account to your Discord account                       |
| `/unlink [user]`                            | Linking     | Remove a link — your own, or anyone's (admin only)                        |
| `/links`                                    | Linking     | List every linked Minecraft account (admin only)                          |
| `/whois <user\|username>`                   | Linking     | Look up a link in either direction (admin only)                           |
| `/linkrole set/show/clear <role>`           | Linking     | Choose the role given to linked users (admin only)                        |
| `/networth [username]`                      | Information | A player's SkyBlock networth on their richest profile                     |
| `/online [guild]`                           | Information | Who is online in every guild, or one                                      |
| `/ping`                                     | Information | Discord latency and each guild's Minecraft connection status              |
| `/help`                                     | Information | Browse all commands by category                                           |
| `/request`                                  | Requests    | Submit a feature request through a short form                             |
| `/requestchannel set/show <channel>`        | Requests    | Choose where feature requests are posted (admin only)                     |
| `/requeststatus <id> <status>`              | Requests    | Mark a request accepted, denied, planned or duplicate (admin only)        |

Plus the chat commands typed in guild chat or the bridge channel: `!nw <username>` for a networth lookup, and
`!tag message` to aim at one guild. Full reference:
[Commands](https://github.com/Trilleo/TriBridge/wiki/Commands).

## Usage

```bash
npm start
```

While working on the bot, `npm run dev` restarts it whenever a source file or the `.env` changes. Both are
wrappers around `node src/index.js`, which still works on its own.

Everything past the first Hypixel guild is configured from Discord rather than from files:

```bash
/guilds add key:sb name:SkyBlock Guild tag:SB account:you@example.com
/guilds edit guild:sb crossbridge:True
/adminrole add role:@Staff
```

Config files are written next to the repository and are all gitignored, so they survive a `git pull` — see
[Config files](https://github.com/Trilleo/TriBridge/wiki/Config-Files).

## Updating

```bash
git pull
npm install
```

Then restart the bot. New or changed slash commands take up to an hour to propagate on Discord's side. See
[Updating](https://github.com/Trilleo/TriBridge/wiki/Updating).

## Documentation

- [Wiki](https://github.com/Trilleo/TriBridge/wiki) — split by audience: using the bridge, and running the bot
- [Features](docs/FEATURES.md) — the canonical description of everything the bot does
- [Change log](CHANGELOG.md), and the [Discord change log](DISCORD_CHANGELOG.md) for the announcement channel
- [Writing the changelog & releasing](docs/RELEASING.md)
- [Commit structure](docs/COMMIT_STRUCTURE.md)
- [Maintaining the wiki](docs/WIKI.md)
- [CLAUDE.md](CLAUDE.md) — the after-every-change checklist and the project's conventions
