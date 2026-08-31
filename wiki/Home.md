# TriBridge

**TriBridge** is a Node.js bot that bridges a Discord channel and Hypixel guild chat. Messages go both ways in
real time: guild chat arrives in Discord as embeds, Discord messages are spoken in guild chat, and slash
commands let admins run guild management commands in-game without opening Minecraft.

One bot can bridge **several Hypixel guilds at once** — one Minecraft account per guild — through the same
Discord channel. Guilds can also be bridged **to each other**, so their members talk in-game without anyone
watching Discord.

> **Two different things are called a "guild" here.** A **Hypixel guild** is one of the Minecraft guilds the
> bot bridges; there can be several. A **Discord server** is the single community the bot serves; there is
> exactly one. This wiki never uses "guild" for the second.

## Start here

| You are…                                    | Go to                                |
|---------------------------------------------|--------------------------------------|
| **In the Discord server, using the bridge** | [Using the bridge](Using-the-Bridge) |
| **Setting the bot up, or running it**       | [Installation](Installation)         |

## What TriBridge does

| Feature                                            | In one line                                                              |
|----------------------------------------------------|--------------------------------------------------------------------------|
| [The bridge](Using-the-Bridge)                     | One Discord channel and Hypixel guild chat, relayed both ways            |
| [Guild tags](Guild-Tags)                           | `!sb hey` reaches one guild; anything else reaches all of them           |
| [Guild-to-guild bridging](Guild-to-Guild-Bridging) | Chat shared between the bridged guilds, in-game, opt-in per guild        |
| [Officer chat](Officer-Chat)                       | A two-way Discord channel for officer chat, shared or per guild, opt-in  |
| [Account linking](Account-Linking)                 | Your messages wear your Minecraft head and name on both sides            |
| [Networth](Networth)                               | `!nw <username>` in chat, or `/networth`, from either side of the bridge |
| [Hypixel guilds](Hypixel-Guilds)                   | Register, edit and sign in guilds entirely from Discord with `/guilds`   |
| [Reconnection](Reconnection)                       | Dropped accounts come back on their own, one at a time                   |
| [Admin roles](Admin-Roles)                         | A flat list of Discord roles that hold bot-admin                         |
| [Admin panel](Admin-Panel)                         | `/adminpanel` — a button per admin function                              |
| [Global profile change](Global-Profile-Change)     | Everyone wears one member's name and face, for a while                   |
| [Auditing](Auditing)                               | Every disguised message recorded with a jump link                        |
| [Link role](Link-Role)                             | A role handed out automatically to everyone who links                    |
| [Feature requests](Feature-Requests)               | `/request` opens a form; admins move it through a status                 |

## Quick reference

- **[Commands](Commands)** — every slash command and chat command, in one table.
- **[Config files](Config-Files)** — what the bot writes next to the repository, and what is in each file.
- **[Permissions](Permissions)** — every Discord permission and intent, and what breaks without it.
- **[FAQ](FAQ)** and **[Troubleshooting](Troubleshooting)** — when something is not behaving.

## For developers

- **[Architecture](Architecture)** — how the two clients, the event handler and the guild registry fit
  together.
- **[Adding a command](Adding-a-Command)** — the checklist for a change that ships.
- **[Releasing](Releasing)** — the two changelogs and the release workflow.
- **[Contributing](Contributing)** — commit convention and what a good change looks like.

## Hypixel rules

TriBridge relays chat and runs guild commands an officer could type themselves. It does not automate gameplay.
That said, running any bot account on Hypixel is at your own risk: no third-party tool is officially endorsed
by Hypixel, and the account doing the bridging is a real account subject to the
[server rules](https://hypixel.net/rules) like any other.

## Status

See the [changelog](https://github.com/Trilleo/TriBridge/blob/master/CHANGELOG.md) for what changed when, and
[DISCORD_CHANGELOG.md](https://github.com/Trilleo/TriBridge/blob/master/DISCORD_CHANGELOG.md) for the short
version that gets posted in the announcement channel.
