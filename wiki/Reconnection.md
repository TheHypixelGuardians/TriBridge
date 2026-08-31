# Reconnection

Minecraft connections drop — Hypixel restarts, a network blip, a token expires. TriBridge brings them back on
its own, and the way it does so is worth understanding before you go looking for a problem.

## How it works

**Nothing in startup creates a Minecraft bot.** A poller runs every ten seconds and starts **at most one**
connect per tick, walking the enabled guilds in order.

That stagger is deliberate. A Hypixel restart would otherwise bring every account back in the same
millisecond and get them all throttled together. Recovery is spread out by ten seconds per guild, which nobody
notices — but it does mean that with five guilds, a full recovery takes about a minute.

Because the poller is the only code path that connects a guild, `/login` and a spontaneous reconnect behave
identically. There is no second, subtly different path.

## Discord comes up regardless

Even with no Hypixel guild able to connect — a broken registry, every token expired, Hypixel down — the
Discord client still logs in and commands still work. `/guilds` is the only way to repair a broken registry,
so it has to be reachable when the registry is broken.

You will see a warning on the console when no guilds are configured at all.

## Failure notices

A failed connection is reported to the guild's own log channel, if it has one, otherwise to `LOG_CHANNEL`.

It is reported on the **first** attempt and again on the **sixth**, and then not at all until it succeeds. A
permanently broken account would otherwise post a failure notice every ten seconds for as long as the bot
runs. The sixth notice says so explicitly, and it is the one that means "go and look at this account".

Attempts back off between tries, so a guild that keeps failing is retried less often than one that just
dropped.

## Waiting on a sign-in

A guild whose token has expired needs a human: somebody has to open the Microsoft link and enter the device
code. While that is outstanding, **the poller skips that guild entirely**. Without it, a guild needing a
sign-in would start a second flow ten seconds later, and a third after that, each with a different code.

The code goes to the admin who ran `/guilds add` or `/guilds auth`, or as a DM to whoever registered the
guild, or to the console. Never to a shared channel — see [Hypixel guilds](Hypixel-Guilds).

## Reconnecting by hand

```
/login
```

With no `guild`, this reconnects **every** disconnected guild, because after an outage that is almost always
what was meant. Pass `guild:` to bring back exactly one.

`/login` does not do anything the poller would not do ten seconds later. It is for when you would rather not
wait.

## Taking a guild offline on purpose

```
/guilds edit guild:sb enabled:False
```

Disconnects it and stops the poller trying, without losing its settings or its cached token. This is the right
way to park a guild — much better than letting it fail repeatedly.

## Checking the state

```
/ping
```

Every guild's connection status, with the Minecraft account's own ping when it is online. `/guilds list` shows
the same status alongside each guild's settings.

## Next

- [Hypixel guilds](Hypixel-Guilds)
- [Troubleshooting](Troubleshooting)
