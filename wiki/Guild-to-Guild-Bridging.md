# Guild-to-guild bridging

Registered guilds share a Discord channel. They do **not** share their guild chat unless you switch it on —
and then a message in one is repeated into the others, so members of different guilds can talk to each other
in-game without anybody watching Discord.

## Turning it on

It is a per-guild flag, and it takes at least two:

```
/guilds edit guild:sb crossbridge:True
/guilds edit guild:main crossbridge:True
```

`/guilds edit` tells you when a guild is the only one sharing so far. `/guilds list` marks the participating
guilds with 🔁.

## What it looks like in-game

```
Guild > [MVP+] TriBridgeBot: [SB] Notch: hello
```

The source guild's tag goes in front of the **speaker's name**, where Hypixel already puts rank brackets, so
it reads as part of who is talking rather than as something they said. A member of two bridged guilds can tell
a forwarded line from a local one at a glance.

## The rules

- **Off by default**, including for guilds registered before this existed. Upgrading never starts forwarding
  chat between guilds that were only meant to share a Discord channel.
- **It takes two.** One guild with the flag on shares with nobody.
- **The flag is symmetric — both directions at once.** A guild that does not send its chat elsewhere does not
  receive anyone else's either. That is deliberate: if it were one-directional, switching it off on your own
  row would not stop your guild's chat being pushed everywhere, and a guild could be kept in the arrangement
  against its will.
- **Player chat only.** Join and leave announcements stay in the guild they happened in. They are noise
  elsewhere, and they would spend the per-account chat budget that real messages need.
- **[Chat commands](Networth) are not forwarded either.** The answer carries the question with it, so nothing
  is lost.
- **Real names.** A running [global profile change](Global-Profile-Change) does not rename forwarded chat. Its
  two switches govern the two *Discord* legs of the bridge only.

## Late messages are dropped

A forwarded line still waiting in a bot's outbound queue ten seconds after it was handed over is discarded
rather than sent.

Guild chat is a conversation: a reply landing a minute after the thing it answers is confusing rather than
late. And without a ceiling, one guild being spammed would push every other guild's bridge further and further
behind, since each account can only speak about once every 600ms.

If you see forwarded chat going missing during a busy period, that is what happened. The fix is fewer
messages, not a bigger queue.

## Rate and cost

Every forwarded line costs one chat packet in **each** receiving guild. Three cross-bridged guilds turn one
message into two forwards; four turn it into three. Hypixel mutes accounts that talk too fast, which is why
the queue spaces packets out per account and why late lines are dropped instead of accumulating.

## Turning it off

```
/guilds edit guild:sb crossbridge:False
```

Immediate, and both directions — that guild stops sending and stops receiving. The other guilds carry on with
each other if two or more of them still have it on.

## Next

- [Hypixel guilds](Hypixel-Guilds)
- [Guild tags](Guild-Tags)
