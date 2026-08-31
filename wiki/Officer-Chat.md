# Officer chat

Hypixel's officer chat can have a Discord channel. Officer chat arrives there, and anything typed there is
spoken back into officer chat in-game.

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
/guilds edit guild:sb officerchannel:#officer-chat
```

The bot checks it can post there before saving. Switch it off again with:

```
/guilds edit guild:sb clear:Officer channel
```

Unlike the log and audit channels, there is no global fallback. A guild with no officer channel has the
feature off, rather than quietly sending its officer chat somewhere it was never pointed at.

### One channel for every guild

Point several guilds at the same channel and they share it, exactly as they share the bridge channel:

```
/guilds edit guild:sb officerchannel:#officer-chat
/guilds edit guild:main officerchannel:#officer-chat
```

Each guild's officer chat arrives there tagged and in that guild's colour, and replies are routed by
[guild tag](Guild-Tags). One channel is usually what you want — officers tend to be officers in both guilds,
and two channels means two places to watch.

Separate channels still work. A guild pointed at a channel nobody else uses behaves exactly as it did when
that was the only option: everything typed there reaches that one guild.

## The bot needs an officer rank

Its Minecraft account must hold a guild rank that can both **read** and **send** officer chat.

Hypixel reports neither failure. Without the rank the channel simply stays empty, or accepts replies and
silently drops them — there is no error message anywhere to go looking for. If the bridge looks dead, check
the bot's guild rank first.

## What it looks like

Officer chat arriving in Discord is an embed in the guild's colour, marked as officer chat and carrying the
guild's name, with the speaker's Minecraft head and tag on the author line. The tag is always shown, even
with one guild registered — on a shared channel "which guild is this?" is a live question.

Going the other way, a message typed in the channel reaches officer chat as:

```
Officer > [MVP+] TriBridgeBot: Notch: hello
```

The name in front of the message is **your Minecraft name if your account is
[linked](Account-Linking)**, and your Discord name if not. Linking is worth doing here — officer chat is a
place where who said something usually matters.

## Replying to one guild

[Guild tags](Guild-Tags) work here just as they do in the bridge channel:

```
!sb we should demote him
```

reaches only the guild tagged `SB`. A message with no tag reaches **every** guild sharing the channel, which
is what you usually want when the same officers run both.

One difference from the bridge channel: the tag has to belong to a guild that actually uses this channel. A
tag for some other guild counts as unrecognised — the message is still delivered to the guilds here, exactly
as typed, and picks up a ❓. An officer channel is never a way to speak into a guild it was not pointed at.

To start a message with a literal `!`, type it twice: `!!sb` comes out as `!sb`.

## The rules

- **Off by default**, including for guilds registered before this existed.
- **No fan-out beyond the tag.** A reply reaches the guilds it was addressed to and no further, even when
  officer sharing is on below. That matches the main bridge, where a Discord message also only reaches the
  guilds it was addressed to.
- **[Chat commands](Networth) are not answered.** `!nw Notch` typed here, or in officer chat in-game, is just
  something an officer said. It does look like a tag, so it collects a ❓ — `!!nw Notch` avoids that.
- **Real names.** A running [global profile change](Global-Profile-Change) does not apply in the officer
  channel, in either direction. A channel that exists to record what officers said is the last place to
  relabel who said it.
- **Nothing is deleted or reposted.** Unlike the bridge channel, your message stays exactly as you sent it,
  so the bot needs no **Manage Webhooks** or **Manage Messages** here.
- **📡 means it did not arrive.** If every guild it was aimed at is offline or disabled, your message gets a
  📡 reaction instead of reaching anybody. Stricter than the bridge channel, which only says so for a tagged
  message: officer chat is where a message vanishing quietly matters most.

## Sharing officer chat between guilds

Everything above is about Discord. Officer chat can *also* cross between the guilds in-game, into each
other's officer chat, the same way [guild chat can](Guild-to-Guild-Bridging):

```
/guilds edit guild:sb crossbridgeofficer:True
/guilds edit guild:main crossbridgeofficer:True
```

Forwarded lines arrive tagged with the guild they came from, `[SB] Notch: hello`, and every rule from
[guild-to-guild bridging](Guild-to-Guild-Bridging) applies — symmetric, off by default, takes two guilds,
lines older than ten seconds are dropped rather than queued.

It is an **independent switch**: `crossbridge` does not have to be on. The two answer different questions,
and a guild may well want its officers in touch with another guild's without pooling everybody's ordinary
chat.

`/guilds list` marks guilds sharing officer chat with 🛡️.

### Sharing a channel is not the same thing

Two guilds sharing one officer channel read each other **in Discord**. Nothing crosses in-game unless
`crossbridgeofficer` is on as well. The two are worth keeping apart:

- **Shared channel only** — officers watch one Discord channel; an officer in-game sees only their own
  guild's officer chat.
- **`crossbridgeofficer` only** — officers see each other in-game; Discord keeps a channel per guild.
- **Both** — the usual choice when the same people run both guilds.

### It adds to what the account says

Every forwarded line costs a chat packet in each receiving guild, on the same per-account budget that
ordinary forwarded chat uses. A guild with both kinds of sharing on has its account talking about twice as
much, and that rate is the thing keeping it out of Hypixel's spam filter.

Switch it on where the officer channels are actually busy, not everywhere by default.

## Next

- [Guild-to-guild bridging](Guild-to-Guild-Bridging)
- [Hypixel guilds](Hypixel-Guilds)
- [Permissions](Permissions)
