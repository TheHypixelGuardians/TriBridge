# Troubleshooting

Work down the page — the checks are ordered so the cheap ones come first.

## Nothing relays in either direction

1. **Is the process running?** TriBridge has no supervision of its own; if Node exited, nothing else applies.
2. **`/ping`** — if it does not answer, Discord is the problem. If it answers but every guild is offline,
   Minecraft is.
3. **Is `DISCORD_CHANNEL_ID` the channel you are typing in?** The bot relays exactly one channel.

## Discord → Minecraft does not work, but Minecraft → Discord does

Almost always the **Message Content** intent. It is privileged and must be enabled on the bot's page in the
[Developer Portal](https://discord.com/developers/applications) — without it the bot sees that a message
happened but not what it said.

## Minecraft → Discord does not work, but Discord → Minecraft does

Check the bot's permissions in the bridge channel: relayed guild chat is sent as embeds, so it needs **Send
Messages** *and* **Embed Links**. See [Permissions](Permissions).

## A guild will not connect

`/ping` and `/guilds list` both show connection state.

- **Waiting on a sign-in?** Run `/guilds auth guild:<key>` and complete the device-code flow. Until it is
  done, the reconnect poller deliberately leaves that guild alone.
- **Look at the log channel.** A failure is reported on the first attempt and again on the sixth, then not
  again until it succeeds. The sixth notice is the one that means "go and look at this account".
- **Is the account able to join `mc.hypixel.net` in a normal launcher?** A ban, a missing profile or an
  unmigrated account all look the same from here.
- **Is the guild `enabled`?** `/guilds edit guild:<key> enabled:True`.

Reconnects are staggered one guild per ten seconds, so with several guilds a full recovery takes a minute. See
[Reconnection](Reconnection).

## Every command is refused, for everyone

The single-server guard is failing closed. The bot serves one Discord server, resolved at startup from the
bridge channel — if it could not be resolved, **every** command is refused rather than falling back to
permissive behaviour.

Set `DISCORD_GUILD_ID` in the `.env` to the server's id and restart. See [Admin roles](Admin-Roles).

## Admin commands are refused for one person

They hold no [bot-admin role](Admin-Roles). `/adminrole add role:@Staff`, run by someone with the Discord
**Administrator** permission.

Note `/adminrole` is the only command gated on a real Discord permission; everything else uses the role list.

## New or changed commands do not appear

Global commands take up to an hour to propagate on Discord's side. Nothing on your end is wrong. Restarting
again does not speed it up.

## Linked users relay without their Minecraft head

The bot is missing **Manage Webhooks** or **Manage Messages** in the bridge channel. It falls back to ordinary
relaying and reports once to the log channel — latched, so you get one warning, not one per message. Grant
both and it resumes on the next message.

## The link role is not being handed out

Two usual causes, both about role hierarchy:

- the bot lacks **Manage Roles**, or
- the link role sits **at or above** the bot's own highest role. Discord refuses that regardless of
  permissions.

Move the bot's role above it and restart — the startup sync backfills everyone. See [Link role](Link-Role).

## A global profile change is not applying in some channels

Those channels are missing **Manage Webhooks** or **Manage Messages**, or you excluded them in the scope view.
A channel missing a permission is skipped and left completely alone, with one warning to the log channel — it
is never partially disguised. See [Global profile change](Global-Profile-Change).

## Guild chat is arriving twice

Two of your Minecraft accounts are in the same Hypixel guild. The bot has guards that should collapse the
duplicate, but the real fix is one account per guild. Check `/guilds list`.

## Forwarded chat between guilds goes missing during busy periods

Working as designed. A forwarded line still queued ten seconds after it was handed over is dropped rather than
delivered minutes late. Each account can only speak about once every 600ms, so a spam burst in one guild would
otherwise push every other guild's bridge further and further behind. See
[Guild-to-guild bridging](Guild-to-Guild-Bridging).

## Networth lookups fail for one player

If SkyCrypt has never loaded that player, they cannot be looked up until their page there is opened once. The
bot says so and gives the link. Everything else — an unknown name, no profiles, SkyCrypt busy — is temporary.
See [Networth](Networth).

## A message with a `!` prefix went everywhere with the prefix still on it

That tag is not registered. The message is delivered rather than dropped, deliberately: silently swallowing a
message the sender believes was delivered is the worst failure a chat bridge has. The ❓ marks it. See
[Guild tags](Guild-Tags).

## Reading the logs

- **The console** has everything, including stack traces and the device-code flow.
- **`LOG_CHANNEL`** has connection notices and permission warnings. A Hypixel guild with its own
  `logChannelId` sends its notices there instead.
- **The [audit channel](Auditing)** is a record for people, not an operational log.

A failed log send never takes down the work it was reporting on — it is printed to the console and swallowed.
So an empty log channel is not proof that nothing happened; check the console too.

## Next

- [FAQ](FAQ)
- [Permissions](Permissions)
- [Reconnection](Reconnection)
