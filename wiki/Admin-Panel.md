# Admin panel

```
/adminpanel
```

An ephemeral panel — only you can see it — with a button per admin function. It is where anything that needs
more than one decision lives, rather than as a slash command with eight options.

Bot-admin only. See [Admin roles](Admin-Roles).

## The main view

| Button             | Does                                                                |
|--------------------|---------------------------------------------------------------------|
| **Global Profile** | Set up a [global profile change](Global-Profile-Change)             |
| **Stop effect**    | End a running effect immediately. Only enabled while one is running |
| **Refresh**        | Redraw the panel with the current state                             |

The embed above the buttons shows what is running: who everybody is currently appearing as, who started it,
when, how much longer it has, and which bridge directions are switched on.

**Refresh exists because the panel is a snapshot.** It was rendered when you ran the command; an effect that
started or expired since then will not show until you press it.

## Drafts

Setting up an effect takes several clicks — a member, a duration, sometimes testers and channels. That
half-filled form is held in memory between clicks for fifteen minutes, not carried in the button ids.

Two consequences: a draft you abandon expires on its own, and **restarting the bot mid-setup costs you the
picks you had made**. Nothing that was already running is affected — that lives in a file.

## Adding a function

The panel is built to grow: each function is a button on the main view and a view of its own. See
[Adding a command](Adding-a-Command) for how a new one is wired in, and keep the audit trail in mind —
anything that acts on other people's messages should leave a record the way the global profile change does.

## Next

- [Global profile change](Global-Profile-Change)
- [Auditing](Auditing)
- [Admin roles](Admin-Roles)
