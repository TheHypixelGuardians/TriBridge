# Account linking

Linking your Minecraft account makes the bridge show the same person on both sides: your Discord messages are
reposted wearing your Minecraft head and name, and the copy that reaches guild chat is attributed to your
Minecraft name instead of your Discord one.

## Linking

Run **`/link <username>`** on the **THG community bot** — the sibling bot in this server. TriBridge does not
have the command; it reads the link the community bot stores.

`/unlink` removes your link, `/whois` looks one up and `/links` lists them all, all on the community bot too.

- **One link per Discord user, and one Discord user per Minecraft account.** If the account you typed is
  already linked to somebody else, the community bot says so and refuses.
- **Your link is not tied to one Hypixel guild.** One link, whatever guild you are in.
- **A rename does not break it.** The link stores your account's UUID as well as its name, and avatars use the
  UUID.

## What changes on the bridge

| | Unlinked | Linked |
|---|---|---|
| **Your message in Discord** | Left exactly as you sent it | Reposted by a webhook wearing your Minecraft head and name |
| **The copy in guild chat** | `YourDiscordName: hello` | `YourMinecraftName: hello` |
| **Officer chat** | Speaks under your Discord name | Speaks under your Minecraft name |

Because the repost is a new message, the original is deleted: you cannot edit or delete it afterwards, and a
reply keeps a jump link instead of Discord's own reply header. Messages carrying stickers, polls, forwards or
voice notes are deliberately left alone rather than reposted without them.

## If it does not seem to work

- **Give it fifteen seconds.** TriBridge caches link lookups briefly, so the very first message after `/link`
  may still show your Discord name.
- **The bot may be missing permissions.** The repost needs **Manage Webhooks** and **Manage Messages** in the
  bridge channel. Without them your message still reaches guild chat, just under your Discord name, and a
  warning goes to the log channel once.
- **The community bot may be down.** TriBridge reads links from its database; when that is unreachable
  everybody relays as if unlinked. Nothing is lost.

## See also

- [Using the bridge](Using-the-Bridge)
- [Officer chat](Officer-Chat)
- [Global profile change](Global-Profile-Change) — which outranks your link while it runs
- The community bot: https://github.com/TheHypixelGuardians/thg-community
