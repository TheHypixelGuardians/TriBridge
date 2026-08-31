# Account linking

Linking tells the bot which Minecraft account is yours. It takes one command:

```
/link Notch
```

Use your own Minecraft username. You must be a member of one of the bridged Hypixel guilds.

## What changes once you are linked

- **Your messages in the bridge channel are reposted with your Minecraft head and name.** Your original is
  deleted and the repost takes its place, so the channel shows the same person the guild sees.
- **Guild chat is told your Minecraft name**, not your Discord one. Somebody in-game replying to you can type
  your actual name.
- **`/networth` with no username** looks up your own account.
- **You may be given a role**, if the server has one configured — see [Link role](Link-Role).

Your Minecraft **UUID** is stored alongside the name, and your head comes from the UUID, so the link survives
a Minecraft name change.

## The rules

- **One link per Discord account, and one Discord account per Minecraft account.** You cannot link two
  Minecraft accounts, and two people cannot claim the same one.
- **The link is not tied to a particular guild.** One link, whichever of the bridged guilds you are in.
- **Membership is checked against the live roster** of every connected guild when you run `/link`, and being
  in any one of them is enough.

If the bot cannot get a clear answer — no account connected, a timeout, output that did not look like a
roster — it lets the link through rather than refusing you over its own outage. It does **not** let it through
when a roster came back cleanly and your name was not on it.

## Undoing it

```
/unlink
```

Removes your own link, and takes back the link role if there is one. Admins can pass `user:` to unlink
somebody else — for example when a member leaves the guild.

## Looking links up

Both are admin-only:

- **`/links`** lists every linked account.
- **`/whois <user|username>`** looks one up in either direction — Discord user to Minecraft name or back.

## Things worth knowing

- **A reposted message is a new message.** You cannot edit or delete it afterwards, because Discord considers
  it the bot's message rather than yours.
- **Replies keep a jump link** instead of Discord's reply header, for the same reason.
- **Mentions in a repost are limited to users.** A repost is not subject to your own permissions, so
  `@everyone` in a reposted message does not ping.
- **If the bot is missing a permission**, linking still works — your messages just relay the ordinary way,
  without the head and name, until an admin fixes it. See [Permissions](Permissions).

## Next

- [Using the bridge](Using-the-Bridge)
- [Networth](Networth)
- [Link role](Link-Role) — for whoever configures the role
