# Link role

An optional Discord role handed out automatically to everyone with a
[linked Minecraft account](Account-Linking).

```
/linkrole set role:@Verified
/linkrole show
/linkrole clear
```

## How it behaves

- **`/link` grants it**, `/unlink` takes it back.
- **Setting the role backfills it** onto everyone already linked.
- **Every startup re-checks the stored links**, so a link made while the bot was offline still gets the role.

The links are the source of truth; the roles are derived from them. If the two ever disagree, restarting
reconciles them — in one direction only.

## Two rules worth knowing

**The role never gates the link.** A missing role, a deleted role, a lost **Manage Roles** — all of them are
reported and the `/link` goes ahead anyway. A configuration problem on your side is not a reason to refuse
somebody's link.

**The sync only ever adds.** The role is never stripped from someone merely because they have no link: it may
have been handed out for unrelated reasons, and taking it off would be destroying something the bot did not
create. For the same reason, **changing or clearing the configured role leaves the old one on everyone who
has it** — `/linkrole clear` stops giving it out, it does not take it away. Remove it in Discord if that is
what you want.

## Requirements

The bot needs **Manage Roles**, and its own highest role must rank **above** the link role in the server's role
list. Discord will not let a bot grant a role at or above its own position, and that is the usual cause of a
link role that silently does not appear.

Members are fetched one id at a time rather than in bulk, which is what lets the bot avoid the privileged
**Server Members** intent. See [Permissions](Permissions).

## Next

- [Account linking](Account-Linking)
- [Permissions](Permissions)
