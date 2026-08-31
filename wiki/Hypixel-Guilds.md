# Hypixel guilds

One TriBridge instance can bridge several Hypixel guilds at once — one Minecraft account each — through the
same Discord channel. The set of them is the **registry**, kept in `guildsConfig.json` and managed entirely
from Discord with **`/guilds`**.

You should not need to edit that file by hand. `/guilds` is the supported way in, and it is the only way to
repair a broken registry — which is why Discord comes up even when no Minecraft account can connect.

## What a guild has

| Field                | Meaning                                                                                                         |
|----------------------|-----------------------------------------------------------------------------------------------------------------|
| `key`                | Short internal id, e.g. `sb`. Lowercase letters, digits, `-` and `_`, up to 16 characters. **Immutable**        |
| `name`               | Display name used in replies and logs                                                                           |
| `tag`                | 2–8 letters or digits. Typed as `!tag message`, and shown beside names on incoming chat                         |
| `account`            | Microsoft account email for this guild's Minecraft bot. **Immutable**, and no two guilds may share one          |
| `color`              | Hex colour for this guild's relayed messages, e.g. `#2ECC71`                                                    |
| `logChannelId`       | Optional per-guild log channel. Falls back to `LOG_CHANNEL`                                                     |
| `auditChannelId`     | Optional per-guild audit channel. Falls back to the channel set by `/auditchannel`                              |
| `officerChannelId`   | Optional two-way [officer chat](Officer-Chat) channel, shareable between guilds. No fallback — unset is off     |
| `enabled`            | `false` disconnects the guild without removing it                                                               |
| `crossBridge`        | `true` shares chat with the other cross-bridged guilds — see [Guild-to-guild bridging](Guild-to-Guild-Bridging) |
| `crossBridgeOfficer` | `true` shares [officer chat](Officer-Chat) in-game with the other guilds that have it on                        |

> **`key` and `account` cannot be changed.** `account` is the key prismarine-auth hashes for its token cache,
> so editing it later silently starts a fresh device-code flow against a different cache file. Renaming means
> removing the guild and adding it again — `/guilds edit` does not offer either field.

## Adding one

```
/guilds add key:sb name:SkyBlock Guild tag:SB account:you@example.com
```

The guild is registered, then a Microsoft sign-in starts and the device code arrives in **your own private
reply**: a link, a code, and the account to sign in as. No console access needed.

> **Never share a device code.** For the life of the flow it is the whole credential — anyone holding it can
> complete the sign-in with *their own* Microsoft account and bind the wrong account to your guild. The bot
> only ever sends it to the admin who asked, or as a DM to whoever registered the guild, or to the console.
> The log channel gets a notice with the code removed.

Once signed in, the account connects on its own within about ten seconds. `/ping` confirms it.

## The default guild

Management commands (`/invite`, `/kick`, `/promote`, `/demote`, `/send`, `/login`) take an optional `guild`.
Leave it out and they act on the **default** guild:

```
/guilds default guild:sb
```

`/login` is the exception: with no `guild` it reconnects **every** disconnected guild, because after an outage
that is almost always what was meant. `/send` is the other: it never fans out, and always targets exactly one
guild, because it runs arbitrary commands as a Minecraft account.

## Editing one

```
/guilds edit guild:sb name:SkyBlock tag:SB color:#2ECC71
/guilds edit guild:sb logchannel:#sb-log auditchannel:#sb-audit
/guilds edit guild:sb officerchannel:#officer-chat
/guilds edit guild:sb enabled:False
/guilds edit guild:sb clear:Log and audit channels
```

`clear` drops a per-guild channel — **Log channel**, **Audit channel** or **Log and audit channels** falls
back to the global one again, and **Officer channel** switches [officer chat](Officer-Chat) off, since that
one has no global fallback.

> ⚠️ An officer channel is **two-way**: everyone who can post in it is speaking in officer chat in-game.
> Restrict it with Discord's channel permissions before setting it — see [Officer chat](Officer-Chat).

Several guilds may be pointed at the same officer channel, and usually should be: their officer chat then
arrives in one place, tagged, and a reply picks a guild with `!tag`. Separate channels still work.

`enabled:False` disconnects the guild and stops the reconnect poller trying it, without losing its settings or
its cached token. It is the right way to take a guild offline for a while.

## Removing one

```
/guilds remove guild:sb
```

Unregisters the guild and disconnects its bot. Removing the **default** guild needs `confirm:True`, since
every command with no `guild` option would otherwise start failing.

The cached Microsoft token in `.minecraft-auth/` is left alone, so re-adding the same account later does not
need a fresh sign-in.

## Signing in again

```
/guilds auth guild:sb
```

Repeats the device-code flow for a guild whose token has expired or been revoked. Same privacy rules as
`/guilds add`.

## Listing them

```
/guilds list
```

Every registered guild with its connection status, its tag and colour, its channels, a 🔁 on the guilds taking
part in [guild-to-guild bridging](Guild-to-Guild-Bridging) and a 🛡️ on those sharing
[officer chat](Officer-Chat). Account addresses are masked.

## With only one guild

Nothing about a single-guild install changes when multi-guild support is present. There are no tags on
incoming messages, everything you type goes to the one guild whatever prefix you use, and `/ping` and
`/online` read exactly as they did.

## Two accounts in one Hypixel guild

This is a misconfiguration, and the bot survives it rather than fixing it. Each account hears everything the
other says, so without a guard every line would be relayed twice. Two guards handle it: a line spoken by *any*
registered account is never relayed, and the same player saying the same thing in two guilds within two
seconds is treated as a duplicate. You get one embed. Still, put one account per guild.

## Next

- [Guild-to-guild bridging](Guild-to-Guild-Bridging)
- [Officer chat](Officer-Chat)
- [Reconnection](Reconnection)
- [Guild tags](Guild-Tags)
