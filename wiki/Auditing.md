# Auditing

A disguised message is a *new* message posted by a webhook, and the original is deleted — so the real author is
no longer visible anywhere on it. The audit channel is the record of who actually said what.

## What is recorded

- Every disguised message, with the real author, the name it was shown under, the channel, and a jump link to
  the repost.
- Every guild-chat line that reached Discord under somebody else's name.
- The start and the end of a [global profile change](Global-Profile-Change), including which bridge legs were
  switched off.

The community bot records its own reposts; TriBridge records the bridge channel and the guild-chat legs. Both
write to the same channel.

## Configuring it

Set the channel with **`/auditchannel set`** on the **THG community bot**; `/auditchannel show` and
`/auditchannel clear` are there too. Both bots read that one setting.

A Hypixel guild can be given its own audit channel here instead:

```
/guilds edit guild:sb auditchannel:#sb-audit
```

Per-guild overrides live in `guildsConfig.json` rather than in the shared database, so removing a guild cannot
leave an orphaned channel setting behind.

## Permissions

The bot needs **View Channel**, **Send Messages** and **Embed Links** in every channel used. A failed audit
write is logged and otherwise ignored — the entry accompanies work that has already happened, and a
misconfigured channel must not take that work down with it.

**Without an audit channel the disguise still runs**, and nothing records who really sent each message. Set one
before running a global profile change.

## See also

- [Global profile change](Global-Profile-Change)
- [Permissions](Permissions)
