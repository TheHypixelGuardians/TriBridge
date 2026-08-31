# Configuration

TriBridge is configured in two places, and the split matters:

| Where              | Holds                                         | Changed by                               |
|--------------------|-----------------------------------------------|------------------------------------------|
| **`.env`**         | Credentials and the two channels it must know | Editing the file and restarting          |
| **`*Config.json`** | Everything else                               | Slash commands, while the bot is running |

If you find yourself editing a `*Config.json` by hand, there is almost certainly a command for it. See
[Config files](Config-Files).

## The `.env` file

Create it in the project root. It is gitignored; never commit it, and never paste its contents anywhere.

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_bridge_channel_id
LOG_CHANNEL=your_log_channel_id
MINECRAFT_USERNAME=you@example.com
```

| Variable             | Required  | Description                                                                                            |
|----------------------|-----------|--------------------------------------------------------------------------------------------------------|
| `DISCORD_TOKEN`      | Yes       | Bot token from the Discord Developer Portal. The bot refuses to start without it                       |
| `DISCORD_CHANNEL_ID` | Yes       | The **bridge channel** — the one channel wired to guild chat                                           |
| `LOG_CHANNEL`        | Yes       | Where connection notices and warnings go. A Hypixel guild can override it with its own channel         |
| `MINECRAFT_USERNAME` | First run | The Microsoft account email for the first Hypixel guild. **Ignored once `guildsConfig.json` exists**   |
| `DISCORD_GUILD_ID`   | No        | The only Discord server the bot accepts commands from. Defaults to the server the bridge channel is in |

To get a channel id: enable **Developer Mode** in Discord's Advanced settings, then right-click the channel →
**Copy Channel ID**.

### About `MINECRAFT_USERNAME`

It only seeds the **first** Hypixel guild on a fresh install. Once `guildsConfig.json` exists the registry is
authoritative and the variable is ignored — if it names an account that is not in the registry, the bot says
so on startup and carries on. Add and change accounts with [`/guilds`](Hypixel-Guilds), not by editing this.

### About `DISCORD_GUILD_ID`

Slash commands are registered **globally**, but TriBridge serves exactly one Discord server: one bridge
channel, one flat admin role list. Every command dispatch refuses an interaction that came from anywhere else.

Normally the server is resolved at startup from `DISCORD_CHANNEL_ID`, so you can leave this out. Set it
explicitly if the bridge channel is somewhere the bot cannot resolve at startup.

> **This check is load-bearing.** Without it, an administrator of *any other* server the bot was added to
> could `/adminrole add` a role they control and inherit bot-admin over your server — including `/send`, which
> runs arbitrary commands as a Minecraft account. It fails closed: if the server cannot be resolved, every
> command is refused.

## Everything else

| What                              | Command                           | Page                                               |
|-----------------------------------|-----------------------------------|----------------------------------------------------|
| Which Hypixel guilds are bridged  | `/guilds`                         | [Hypixel guilds](Hypixel-Guilds)                   |
| Guild-to-guild chat sharing       | `/guilds edit … crossbridge:True` | [Guild-to-guild bridging](Guild-to-Guild-Bridging) |
| Who counts as a bot admin         | `/adminrole`                      | [Admin roles](Admin-Roles)                         |
| The role given to linked users    | `/linkrole`                       | [Link role](Link-Role)                             |
| Where audit entries go            | `/auditchannel`                   | [Auditing](Auditing)                               |
| Where feature requests are posted | `/requestchannel`                 | [Feature requests](Feature-Requests)               |
| Per-guild log and audit channels  | `/guilds edit`                    | [Hypixel guilds](Hypixel-Guilds)                   |

## Restarting

Only `.env` changes need a restart. Everything set through a command takes effect immediately.

## Next

- [Config files](Config-Files)
- [Permissions](Permissions)
- [Hypixel guilds](Hypixel-Guilds)
