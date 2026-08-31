# Permissions

Every Discord permission and intent TriBridge uses, and what stops working without it. This page is meant to
be exhaustive — if something is behaving oddly, the cause is usually on it.

## Gateway intents

Set these on the bot's page in the [Discord Developer Portal](https://discord.com/developers/applications).

| Intent              | Privileged | Needed for                                                     |
|---------------------|------------|----------------------------------------------------------------|
| **Guilds**          | No         | Knowing about the server at all                                |
| **Guild Messages**  | No         | Seeing that a message was sent in a bridge or officer channel  |
| **Message Content** | **Yes**    | Reading what it said. **The bridge does nothing without this** |
| **Direct Messages** | No         | DMing a device code to whoever registered a guild              |

**Server Members** is deliberately **not** requested. The bot fetches members one id at a time instead, which
does not need it. Do not switch the code to a bulk `guild.members.fetch()` without adding the intent first.

## Permissions in the bridge channel

| Permission          | Without it                                                                        |
|---------------------|-----------------------------------------------------------------------------------|
| **View Channel**    | Nothing works                                                                     |
| **Send Messages**   | Guild chat never reaches Discord                                                  |
| **Embed Links**     | Relayed guild chat has nowhere to go — it is sent as embeds                       |
| **Add Reactions**   | The ❓ and 📡 [tag markers](Guild-Tags) are lost. Messages are still delivered     |
| **Manage Webhooks** | [Linked users](Account-Linking) relay the plain way, without their Minecraft face |
| **Manage Messages** | Same — the original cannot be deleted, so the repost is not attempted             |

The last two are reported **once** to the log channel when they first fail, then not again, so a missing
permission does not spam the channel. The bridge falls back to ordinary relaying and keeps working.

## Permissions in other channels

| Channel                                                                   | Needs                                                   |
|---------------------------------------------------------------------------|---------------------------------------------------------|
| Log channel (`LOG_CHANNEL`, and per-guild)                                | View Channel, Send Messages, Embed Links                |
| [Audit channel](Auditing)                                                 | View Channel, Send Messages, Embed Links                |
| [Request channel](Feature-Requests)                                       | View Channel, Send Messages, Embed Links                |
| [Officer channel](Officer-Chat)                                           | View Channel, Send Messages, Embed Links, Add Reactions |
| Every channel a [global profile change](Global-Profile-Change) applies to | View Channel, Manage Webhooks, Manage Messages          |

An officer channel needs **Add Reactions** only for the routing markers — 📡 when a reply reached no guild,
❓ on an unrecognised [guild tag](Guild-Tags); without it the reply is still attempted. It deliberately needs
**neither Manage Webhooks nor Manage Messages**, because nothing there is ever reposted or deleted.

> ⚠️ An officer channel is **two-way**. Every member who can post in it is speaking in Hypixel officer chat,
> and the channel's own Discord permissions are the only thing controlling that.

A channel where the bot is missing **Manage Webhooks** or **Manage Messages** is **skipped** by the global
profile change and left completely alone, with one warning to the log channel. It is not partially disguised.
Officer channels are skipped by it whatever the permissions are — see [Officer chat](Officer-Chat).

A missing or broken log channel never takes down the work it was reporting on — the failure is printed to the
console and swallowed. A log line always describes something that has already happened.

## Server-wide permissions

| Permission       | Needed for                                                                             |
|------------------|----------------------------------------------------------------------------------------|
| **Manage Roles** | Granting the [link role](Link-Role). The bot's own highest role must rank **above** it |

A link role that cannot be granted is reported and the link goes ahead anyway. The role never gates the link:
a missing role is a configuration problem, not a reason to refuse someone's `/link`.

## Permissions the bot demands of people

Two separate systems, deliberately.

- **Discord permissions**, checked generically before a command runs. Only `/adminrole` uses one — it needs
  **Administrator**, because it is the command that decides who else is an admin.
- **[Bot-admin roles](Admin-Roles)**, checked inside the command. Everything else admin-gated uses this.

And one guard that is neither: **every command is refused unless it came from the one Discord server the bot
serves.** See [Admin roles](Admin-Roles) for why that is not optional.

## Outbound network

| Host             | For                                         |
|------------------|---------------------------------------------|
| `discord.com`    | The Discord gateway and API                 |
| `mc.hypixel.net` | The Minecraft connection                    |
| Microsoft login  | Device-code sign-in and token refresh       |
| `api.mojang.com` | Resolving usernames to UUIDs                |
| `sky.shiiyu.moe` | [Networth](Networth) figures, from SkyCrypt |
| `mc-heads.net`   | Player head images in embeds                |

## Next

- [Configuration](Configuration)
- [Troubleshooting](Troubleshooting)
