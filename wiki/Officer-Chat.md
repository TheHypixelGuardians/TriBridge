# Officer chat

Hypixel's officer chat can have a Discord channel of its own. Officer chat arrives there, and anything typed
there is spoken back into officer chat in-game.

It is separate from the main bridge in every way that matters: officer chat never appears in the bridge
channel, and the bridge channel never reaches officer chat.

> ⚠️ **The channel is two-way. Everyone who can post in it is talking in officer chat in-game.**
>
> That is the entire security model. The bot does not check anything beyond Discord's own channel
> permissions, so lock the channel down exactly as tightly as you would want officer chat itself locked down.
> If a member can see and post in it, they are an officer as far as Hypixel is concerned.

## Turning it on

Point a guild at a channel:

```
/guilds edit guild:sb officerchannel:#sb-officer-chat
```

The bot checks it can post there before saving, and refuses a channel another guild already uses — a reply
typed in a channel has to reach exactly one guild's officer chat, so two guilds cannot share one.

Switch it off again with:

```
/guilds edit guild:sb clear:Officer channel
```

Unlike the log and audit channels, there is no global fallback. A guild with no officer channel has the
feature off, rather than quietly sending its officer chat somewhere shared with another guild.

## The bot needs an officer rank

Its Minecraft account must hold a guild rank that can both **read** and **send** officer chat.

Hypixel reports neither failure. Without the rank the channel simply stays empty, or accepts replies and
silently drops them — there is no error message anywhere to go looking for. If the bridge looks dead, check
the bot's guild rank first.

## What it looks like

Officer chat arriving in Discord is an embed in the guild's colour, marked as officer chat and carrying the
guild's name, with the speaker's Minecraft head and tag on the author line.

Going the other way, a message typed in the channel reaches officer chat as:

```
Officer > [MVP+] TriBridgeBot: Notch: hello
```

The name in front of the message is **your Minecraft name if your account is
[linked](Account-Linking)**, and your Discord name if not. Linking is worth doing here — officer chat is a
place where who said something usually matters.

## The rules

- **Off by default**, including for guilds registered before this existed.
- **No tags and no routing.** [Guild tags](Guild-Tags) mean nothing in this channel. The channel you are
  typing in *is* the guild.
- **No fan-out from Discord.** A reply reaches that guild's officer chat only, even when officer sharing is
  on below. That matches the main bridge, where a Discord message also only reaches the guilds it was
  addressed to.
- **[Chat commands](Networth) are not answered.** `!nw Notch` typed here, or in officer chat in-game, is just
  something an officer said.
- **Real names.** A running [global profile change](Global-Profile-Change) does not apply in the officer
  channel, in either direction. A channel that exists to record what officers said is the last place to
  relabel who said it.
- **Nothing is deleted or reposted.** Unlike the bridge channel, your message stays exactly as you sent it,
  so the bot needs no **Manage Webhooks** or **Manage Messages** here.
- **📡 means it did not arrive.** If the guild's bot is offline or disabled, your message gets a 📡 reaction
  instead of reaching anybody. Unlike a broadcast in the bridge channel there is no second guild that might
  have received it, so it is always worth saying.

## Sharing officer chat between guilds

Officer chat can also cross between guilds, into each other's officer chat, the same way
[guild chat can](Guild-to-Guild-Bridging):

```
/guilds edit guild:sb crossbridgeofficer:True
/guilds edit guild:main crossbridgeofficer:True
```

Forwarded lines arrive tagged with the guild they came from, `[SB] Notch: hello`, and every rule from
[guild-to-guild bridging](Guild-to-Guild-Bridging) applies — symmetric, off by default, takes two guilds,
lines older than ten seconds are dropped rather than queued.

One extra condition: **`crossbridge` has to be on for the same guild.** Officer chat never starts crossing
between guilds that are not already sharing their ordinary chat, so the more sensitive setting cannot be
reached without the less sensitive one being on first. `/guilds edit` accepts the flag on its own, but tells
you it is doing nothing yet.

`/guilds list` marks guilds sharing officer chat with 🛡️.

### It roughly doubles what the account says

Every forwarded line costs a chat packet in each receiving guild, on the same per-account budget that
ordinary forwarded chat uses. A guild with both kinds of sharing on has its account talking about twice as
much, and that rate is the thing keeping it out of Hypixel's spam filter.

Switch it on where the officer channels are actually busy, not everywhere by default.

## Next

- [Guild-to-guild bridging](Guild-to-Guild-Bridging)
- [Hypixel guilds](Hypixel-Guilds)
- [Permissions](Permissions)
