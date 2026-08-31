# Networth

The bot looks up a player's SkyBlock networth from either side of the bridge.

```
!nw Notch
```

Type that in **guild chat** or in the **bridge channel** — it works the same in both. `!networth Notch` is the
same command.

There is also a slash command:

```
/networth [username]
```

With no username it uses your [linked account](Account-Linking).

## What the number means

- It is the player's **richest profile**, named in the reply — not necessarily the one they are playing.
- The total counts **everything**, cosmetics and soulbound items included. The **unsoulbound** figure is shown
  next to it, which is the part that could actually be sold.
- In Discord the embed breaks it down by inventory, purse and bank.
- **`(API off)`** means that player has their inventory API switched off. Their number is an undercount, not a
  low score — the bot flags it rather than quietly reporting something wrong.

## Where the answer goes

- **Asked in guild chat**, the answer goes back into that guild *and* appears in the bridge channel as an
  embed.
- **Asked in the bridge channel**, it stays there.
- **The question is never relayed.** Asking in guild chat does not push `!nw Notch` into Discord or into the
  other bridged guilds. The answer carries the question with it, so nothing is lost — and forwarding it would
  spend every other guild's chat budget on a line none of them asked for.

## Limits

- **One lookup per person every twenty seconds.** Even an answer the bot already has costs a chat packet, and
  Hypixel mutes accounts that talk too fast.
- **Answers are cached for ten minutes.** Asking again inside that window gives you the same figures. A name
  that does not resolve is remembered for five minutes too, so a typo repeated twenty times costs one lookup.

## When it cannot answer

Figures come from [SkyCrypt](https://sky.shiiyu.moe), which serves them from its own cache. **A player SkyCrypt
has never loaded cannot be looked up** until their page there has been opened once — the bot says so and gives
you the link, rather than reporting a wrong number. Open the link, wait for it to finish loading, then ask
again.

Other answers you might get: an unknown username, a player with no SkyBlock profiles, or SkyCrypt being busy
or slow. All of them are temporary except the first.

## Typing it literally

`!!nw x` reaches guild chat as the text `!nw x` and looks nothing up — the same escape
[guild tags](Guild-Tags) use.

Because of this command, **`nw` and `networth` cannot be used as guild tags**. `/guilds add` and `/guilds edit`
refuse them, since `!nw hi` would otherwise be ambiguous. A guild that already had one of those tags before
this command existed keeps it, and keeps its routing.

## Next

- [Using the bridge](Using-the-Bridge)
- [Account linking](Account-Linking)
