# Admin roles

**Bot-admin** is a flat list of Discord roles. Holding one of them is what lets you run TriBridge's
admin-gated commands — it is separate from Discord's own permissions, so you can hand out bridge
administration without handing out Discord administration.

## Configuring the list

The list lives on the **THG community bot** and is shared by both bots:

```
/adminrole add role:@Staff
/adminrole remove role:@Staff
/adminrole show
```

`/adminrole` there requires the Discord **Administrator** permission, because it is the command that decides
who else is an admin. One list serves both bots, so a role that opens the community bot's admin panel also
runs `/send` on the bridge.

## What it gates on TriBridge

Everything under Management: `/invite`, `/kick`, `/promote`, `/demote`, `/send`, `/login` and `/guilds`.

## It fails closed

A member with no matching role is not an admin — and neither is anybody at all when the shared database cannot
be reached, or when `DATABASE_URL` is not set. `/send` runs arbitrary commands as the Minecraft account, so
handing that out during a database outage would be worse than the outage itself.

**Until the list has at least one role, nothing admin-gated works.** That is the first thing to set up after
installing.

## One Discord server

Commands are registered globally, but TriBridge serves exactly one Discord server and refuses any command sent
from another one. Without that, an administrator of any other server the bot happened to be in could reach
commands scoped to the real server. It fails closed: if the server cannot be resolved, every command is
refused.

## See also

- [Permissions](Permissions)
- [Configuration](Configuration)
- [Commands](Commands)
