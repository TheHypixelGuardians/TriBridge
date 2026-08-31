# Installation

TriBridge runs as a normal Node.js process. It needs a Discord bot application, one Microsoft account per
Hypixel guild, and somewhere to keep running — a VPS, a home server, anything that stays on. There is no build
step.

## Requirements

| Requirement           | Details                                                                                                                                              |
|-----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Node.js**           | **v22** or newer                                                                                                                                     |
| **npm**               | Included with Node.js                                                                                                                                |
| **Discord bot**       | An application at the [Discord Developer Portal](https://discord.com/developers/applications) with the **Message Content** privileged intent enabled |
| **Minecraft account** | One Microsoft account **per Hypixel guild**, each owning Minecraft: Java Edition and able to join `mc.hypixel.net`                                   |

Dependencies are `discord.js`, `mineflayer`, `prismarine-auth` and `dotenv`; `npm install` handles them.

> **The bot account is a real account.** It sits in the guild, it can be muted by Hypixel's spam filter, and
> it is subject to the [server rules](https://hypixel.net/rules) like any other. Use an account you are
> willing to have doing this.

## Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/Trilleo/TriBridge.git
   cd TriBridge
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create the `.env` file** in the project root. See [Configuration](Configuration) for every variable and
   what it does; the minimum is:

   ```env
   DISCORD_TOKEN=your_discord_bot_token
   DISCORD_CHANNEL_ID=your_bridge_channel_id
   LOG_CHANNEL=your_log_channel_id
   MINECRAFT_USERNAME=you@example.com
   ```

4. **Invite the bot to your Discord server** with the permissions listed in [Permissions](Permissions).

5. **Start it**

   ```bash
   node src/index.js
   ```

6. **Complete the Microsoft sign-in.** On a fresh install the account in `MINECRAFT_USERNAME` is registered as
   the first Hypixel guild and a device-code flow opens in the console: a link and a code. Open the link, enter
   the code, and sign in as that account. Tokens are cached in `.minecraft-auth/`, one entry per account, so
   this happens once per account.

7. **Set the admin roles.**

   ```
   /adminrole add role:@Staff
   ```

   Until a role is added, only someone with the Discord **Administrator** permission can run `/adminrole`
   itself, and nothing else admin-gated will work. See [Admin roles](Admin-Roles).

## Checking it worked

```
/ping
```

The reply gives Discord latency, the interaction roundtrip, and each Hypixel guild's connection state with the
Minecraft account's own ping. A guild showing offline means the account has not connected — check
[Troubleshooting](Troubleshooting).

Then say something in the bridge channel and check it arrives in guild chat, and say something in guild chat
and check it arrives in Discord. Both directions are separate code paths; one working does not prove the
other.

## Adding more Hypixel guilds

Everything after the first guild is done from Discord, not from the `.env`:

```
/guilds add key:sb name:SkyBlock Guild tag:SB account:you@example.com
```

The device code arrives in your own private reply — no console access needed. See
[Hypixel guilds](Hypixel-Guilds).

## Where TriBridge keeps its files

Everything is written next to the repository, in the project root, and every one of those files is gitignored.
See [Config files](Config-Files) for what each holds. They survive a `git pull`, which is what makes
[updating](Updating) a two-command job.

## Running it as a service

TriBridge is a foreground process with no built-in supervision. Use whatever your host provides — `systemd`,
`pm2`, a Docker restart policy — and point it at:

```bash
node src/index.js
```

The bot reconnects to Hypixel on its own ([Reconnection](Reconnection)); it does not restart *itself* if the
Node process dies, which is what the supervisor is for.

## Next

- [Configuration](Configuration)
- [Permissions](Permissions)
- [Hypixel guilds](Hypixel-Guilds)
