# Auditing

A [global profile change](Global-Profile-Change) deletes the original message and reposts it under somebody
else's name, so **the real author is no longer visible on it**. The audit channel is where that information
goes instead.

```
/auditchannel set channel:#audit-log
```

## What is recorded

- **Every disguised message** — who actually wrote it, what it said, and a jump link to the repost.
- **Every effect starting and ending** — who started it, who everybody is appearing as, and for how long.

That makes the audit channel the answer to "who actually said that?", which is the question a disguise
creates.

## Where it goes

```
/auditchannel set channel:#audit-log              — the default, for everything
/auditchannel set channel:#sb-audit guild:sb      — one Hypixel guild's entries, elsewhere
/auditchannel show                                — the default and every override
/auditchannel clear                               — stop recording
/auditchannel clear guild:sb                      — drop one guild's override
```

Per-guild overrides live in `guildsConfig.json` rather than in the audit config, so removing a Hypixel guild
cannot leave an orphaned channel setting behind. `/guilds edit guild:sb auditchannel:#x` sets the same thing
from the other direction, and `/guilds edit guild:sb clear:Audit` drops it.

The bot needs **View Channel**, **Send Messages** and **Embed Links** in every channel used.

## Pick the channel carefully

The audit channel undoes the disguise. Anyone who can read it can see who wrote every reposted message, which
is the whole point — and is also why it should not be a channel the members being disguised can read, if you
want the joke to land.

## Not an operational log

The audit channel is a record for people. Connection notices, failures and permission warnings go to
`LOG_CHANNEL` instead — see [Configuration](Configuration). Keep them separate: an audit channel full of
reconnect notices is one nobody reads.

## Next

- [Global profile change](Global-Profile-Change)
- [Admin panel](Admin-Panel)
