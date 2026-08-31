# Admin roles

TriBridge has **two** permission systems, and they are separate on purpose.

| System                 | Checked                          | Used by                                                    |
|------------------------|----------------------------------|------------------------------------------------------------|
| **Discord permission** | Before the command runs          | `/adminrole` only — it needs **Administrator**              |
| **Bot-admin role**     | Inside the command               | Everything else that is admin-gated                        |

Bot-admin is a **flat list of Discord role ids**. Anyone holding any of those roles is an admin as far as the
bot is concerned.

## Setting it up

```
/adminrole add role:@Staff
/adminrole remove role:@Staff
```

`/adminrole` itself requires the Discord **Administrator** permission, because it is the command that decides
who else is an admin. Everything else defers to the list.

Until at least one role is added, nothing admin-gated works for anyone except a Discord administrator running
`/adminrole`. That is the intended starting state, not a bug — do this during
[installation](Installation).

The list lives in `adminRolesConfig.json`. See [Config files](Config-Files).

## What bot-admin unlocks

Everything under Management — `/invite`, `/kick`, `/promote`, `/demote`, `/send`, `/login`, `/guilds`,
`/adminpanel`, `/auditchannel` — plus `/whois`, `/unlink user:`, `/linkrole`, `/requestchannel` and
`/requeststatus`. [Commands](Commands) marks them all with 🔒.

`/send` deserves singling out: it runs **arbitrary commands** as a Minecraft account. Anyone with a bot-admin
role can make the account do anything a player could, including leaving the guild. Treat the list the way you
would treat guild officer.

## One Discord server

Slash commands are registered **globally**, but TriBridge serves exactly one Discord server: one bridge
channel, one flat admin role list. **Every command dispatch refuses an interaction that did not come from
it.**

This is the single most important guard in the bot. Without it:

1. Anyone can add the bot to a server they own — a bot in a public server can be invited elsewhere.
2. They hold **Administrator** there, because it is their server.
3. So they can run `/adminrole add` on a role they control.
4. The admin list has no server dimension — it is role ids and nothing else.
5. They now hold bot-admin over **your** server, including `/send`.

The server is resolved at startup from the bridge channel, or named explicitly with `DISCORD_GUILD_ID`. It
**fails closed**: if it cannot be resolved, every command is refused rather than falling back to permissive
behaviour. Interactions in DMs are refused for the same reason.

If every command suddenly returns a refusal after a restart, this is the first thing to check — see
[Troubleshooting](Troubleshooting).

## Next

- [Configuration](Configuration)
- [Permissions](Permissions)
- [Admin panel](Admin-Panel)
