# Global profile change

For a set duration, everybody's messages are reposted wearing one member's name and avatar — in Discord, in
the copy guild chat is told, and on guild chat coming back the other way.

## Running it

Open **`/adminpanel` on the THG community bot** and use the **Global Profile** button: pick the member, pick a
duration, then start it in test mode or live. The panel also carries **Stop effect** and **Refresh**, and shows
who is being worn, since when, how much longer, and which bridge legs are switched on.

TriBridge has no `/adminpanel`. It reads the running effect and applies it to the three places it owns.

## What TriBridge does with it

| Leg | What it covers |
|---|---|
| **The bridge channel** | The repost there is TriBridge's, because it has to repost anyway to attribute a linked member's Minecraft name |
| **Discord → Minecraft** | The name guild chat is told |
| **Minecraft → Discord** | The name on incoming guild chat embeds |

Each direction has its own switch on the panel. Switching *Discord → Minecraft* off stops the disguise at the
bridge rather than turning it off outright — the Discord repost still wears the target's face, but guild chat
is told who really spoke.

Everywhere else in the server is the community bot's own repost.

## Test mode

Test mode applies the disguise only to listed testers, in listed channels. Over the bridge a tester is
recognised by their [account link](Account-Linking) — without that, testing would silently relabel guild
members who never agreed to take part.

## What is never disguised

- **Officer channels**, always. A channel that exists to record what officers said is the last place to
  relabel who said it, and a webhook repost there would be dropped by the officer relay, losing the message
  outright. TriBridge publishes its officer channels to the shared database so the community bot skips them
  too.
- **Join and leave lines** from guild chat. They announce a real player arriving or leaving.
- **The target themselves.** They already wear that face.
- **A chat command** such as `!nw Notch`, which is answered rather than relayed.

## When it stops

At the chosen time, or when an admin presses **Stop effect**. An effect that has run out reads as "not
running" on the bridge side immediately, so a timer lost to a restart cannot leave the disguise stuck on. An
unreachable database also reads as "not running": a blip must not start relabelling guild members.

Both the start and the end are announced in the [audit channel](Auditing).

## See also

- [Auditing](Auditing)
- [Account linking](Account-Linking)
- [Officer chat](Officer-Chat)
