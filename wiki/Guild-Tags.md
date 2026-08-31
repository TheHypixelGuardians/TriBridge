# Guild tags

When this server bridges more than one Hypixel guild, everything you type in the bridge channel goes to **all
of them** by default. A tag on the front aims it at one.

```
!sb hey
```

Each Hypixel guild has a tag of 2–8 letters or digits, set by an admin with
[`/guilds`](Hypixel-Guilds). `/guilds list` shows them, and incoming guild chat carries the tag next to the
speaker's name, so you can read one off a message you are replying to.

With only **one** guild bridged, tags do nothing and are not shown anywhere — everything you type goes to the
one guild whatever you put in front of it.

## The rules

| You type      | What happens                                                                                  |
|---------------|-----------------------------------------------------------------------------------------------|
| `hey`         | Goes to every bridged guild                                                                   |
| `!sb hey`     | Goes to the guild tagged `SB` only. The tag is stripped from both sides                        |
| `!!sb hey`    | Goes everywhere as the literal text `!sb hey`                                                  |
| `!nope hey`   | Goes everywhere as the literal text `!nope hey`, and gets a ❓                                  |
| `!sb` alone   | No tag — a tag needs a space and something after it, so this is just the word `!sb`            |

**The tag is stripped from what Discord shows, too.** After `!sb hello`, your message in the channel reads
`hello` — the same words the guild got. The two sides never disagree about what was said.

## The two reactions

- **❓ — unrecognised tag.** You wrote `!something` and no guild has that tag. Your message was **still
  delivered**, to every guild, exactly as you typed it, `!something` and all. Nothing was dropped; the marker
  is there so you can see the typo and send it again.
- **📡 — aimed at nobody.** You used a real tag, but that guild's Minecraft account is offline right now.
  Nothing was delivered. Try again when [`/ping`](Commands) shows it back up.

A broadcast that misses an offline guild gets **no** marker. The other guilds received it, and staff already
have a notice about the one that is down.

## Why `!` is not reserved

`!` is far too common in ordinary chat to treat as a command character. That is why an unrecognised tag is
delivered rather than dropped: a chat bridge that silently swallows a message while the sender believes it
was delivered is worse than one that occasionally shows an extra `!nope` in guild chat.

The same reasoning is why a tag has to be **at least two characters**. `!a` as a prefix would swallow a great
deal of real conversation.

## The escape hatch

Double the `!` to send one literally. `!!nw x` arrives as the text `!nw x` and looks up nothing;
`!!sb hi` arrives as `!sb hi` and routes nowhere special. This works the same way in both directions and for
both [guild tags](Guild-Tags) and [chat commands](Networth).

## Next

- [Using the bridge](Using-the-Bridge)
- [Guild-to-guild bridging](Guild-to-Guild-Bridging) — how the guilds talk to each other directly
