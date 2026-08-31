# Commands

Every command TriBridge answers to. Slash commands are registered **globally** but only accepted in the one
Discord server the bot serves — see [Admin roles](Admin-Roles) for why. `/help` browses the same list in
Discord, one page per category.

⛔ marks a command that needs the Discord **Administrator** permission. 🔒 marks one gated on a
[bot-admin role](Admin-Roles).

## Chat commands

Not slash commands. Type these in the bridge channel **or** in guild chat.

```
!nw <username>       — that player's SkyBlock networth
!networth <username> — the same command
```

Double the `!` to send one literally: `!!nw x` arrives as the text `!nw x`. See [Networth](Networth).

Also typed rather than slashed: **[guild tags](Guild-Tags)**. `!sb hey` sends to one guild only.

## Information

| Command                | Does                                                                          |
|------------------------|-------------------------------------------------------------------------------|
| `/help`                | Browse every command by category, with ◀ / ▶ buttons                          |
| `/ping`                | Discord latency, roundtrip, and each guild's Minecraft connection status       |
| `/online [guild]`      | Who is online in every guild, or one                                          |
| `/networth [username]` | A player's SkyBlock networth. No username uses your [link](Account-Linking)   |

`/ping` has no `guild` option on purpose: it is a status readout, so it always covers everything the bot is
responsible for. `/help`'s buttons stop working after five minutes — run it again.

## Linking

| Command                           | Does                                                                  |
|-----------------------------------|-----------------------------------------------------------------------|
| `/link <username>`                | Bind your Minecraft account to your Discord account                    |
| `/unlink [user]`                  | Remove a link — your own, or 🔒 anyone's                               |
| `/links`                          | 🔒 List every linked Minecraft account                                  |
| `/whois <user\|username>`         | 🔒 Look up a link by Discord user or Minecraft username                |
| `/linkrole set <role>`            | 🔒 Set the role given to users with a linked account                   |
| `/linkrole show`                  | 🔒 Show the configured role                                            |
| `/linkrole clear`                 | 🔒 Stop giving out a role on link. Does not take it off anyone         |

See [Account linking](Account-Linking) and [Link role](Link-Role).

## Management

Every command in this section is 🔒 bot-admin only. The six that act on a Hypixel guild take an optional
`guild` with autocomplete; leave it out and the [default guild](Hypixel-Guilds) is used.

| Command                             | Does                                                                     |
|-------------------------------------|--------------------------------------------------------------------------|
| `/invite <username> [guild]`        | Invite a player to a Hypixel guild                                       |
| `/kick <username> [reason] [guild]` | Kick a member from a Hypixel guild                                       |
| `/promote <username> [guild]`       | Promote a member                                                         |
| `/demote <username> [guild]`        | Demote a member                                                          |
| `/send <message> [guild]`           | Run any command or message as that guild's account, and show the reply    |
| `/login [guild]`                    | Connect the bot. With no guild, every *disconnected* guild                |
| `/adminpanel`                       | Open the [admin panel](Admin-Panel)                                       |
| `/adminrole add\|remove <role>`     | ⛔ Configure the bot-admin roles                                           |
| `/auditchannel set <channel> [guild]` | Set where [audit](Auditing) entries go                                  |
| `/auditchannel show`                | Show the default audit channel and every per-guild override               |
| `/auditchannel clear [guild]`       | Stop recording, or drop one guild's override                              |

`/send` never fans out — it always targets exactly one guild, because it runs arbitrary commands as a
Minecraft account. `/login` with no guild reconnects everything, since after an outage that is almost always
what was meant.

### `/guilds`

🔒 The whole [Hypixel guild registry](Hypixel-Guilds), in one command.

| Subcommand                                                    | Does                                                    |
|---------------------------------------------------------------|---------------------------------------------------------|
| `/guilds list`                                                | Every registered guild and its connection status         |
| `/guilds add <key> <name> <tag> <account> [color]`            | Register a guild and sign its Minecraft account in       |
| `/guilds edit <guild> [name] [tag] [color] [logchannel] [auditchannel] [enabled] [crossbridge] [clear]` | Change a guild |
| `/guilds default <guild>`                                     | Choose the guild commands act on when none is given      |
| `/guilds remove <guild> [confirm]`                            | Unregister a guild and disconnect its bot                |
| `/guilds auth <guild>`                                        | Sign a guild's Minecraft account in again                |

`key` and `account` are **immutable** — `/guilds edit` will not change them. `confirm:True` is required to
remove the default guild.

## Requests

| Command                              | Does                                                              |
|--------------------------------------|-------------------------------------------------------------------|
| `/request`                           | Submit a feature request through a short form                     |
| `/requestchannel set <channel>`      | 🔒 Set the channel requests are posted to                          |
| `/requestchannel show`               | 🔒 Show where requests are posted                                  |
| `/requeststatus <id> <status>`       | 🔒 Mark a request accepted, denied, planned or duplicate           |

See [Feature requests](Feature-Requests).

## Notes

- **Global commands take up to an hour to propagate.** A command added or changed in a release may not appear
  in Discord's autocomplete immediately after a restart.
- **A `guild` option is autocompleted from the registry**, so it only ever offers guilds that exist.
- **Commands from any other Discord server are refused**, even from someone who is an administrator there.
  See [Admin roles](Admin-Roles).

## Next

- [Using the bridge](Using-the-Bridge)
- [Admin roles](Admin-Roles)
- [Adding a command](Adding-a-Command)
