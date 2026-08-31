# FAQ

## Do I need to install anything?

No. TriBridge runs on somebody's server. If you are in the Discord server, you already have everything you
need — see [Using the bridge](Using-the-Bridge).

## Why did my message get cut off in-game?

Minecraft 1.8 caps a chat line at 100 characters. Discord keeps the whole message; the guild only gets the
first hundred characters or so. Send long thoughts as two messages.

## Why does my message show up under my Discord name and not my Minecraft name?

You have not [linked your account](Account-Linking) yet. Run `/link <your Minecraft username>`.

## Why did my message disappear and come back looking different?

You are linked. Your message is deleted and reposted with your Minecraft head and name, so both sides of the
bridge show the same person. That repost is a new message, which is why you cannot edit it afterwards.

## What do the ❓ and 📡 reactions mean?

❓ — you used a [guild tag](Guild-Tags) nobody recognises. Your message went to every guild anyway, `!nope`
and all. 📡 — you aimed at one guild and that guild's Minecraft account is offline, so nothing was delivered.

## Why did nothing happen when I typed `!nw someone`?

Either you are on cooldown — one lookup per person every twenty seconds — or SkyCrypt has never loaded that
player. The bot says which. See [Networth](Networth).

## Can I start a message with an exclamation mark?

Yes, type it twice. `!!hello` arrives as `!hello`.

## Does the bot read every channel?

It relays only the bridge channel. It sees messages elsewhere in the server — that is what the
[global profile change](Global-Profile-Change) works on — but it does not relay them anywhere, and it does not
store them.

## Can two people link the same Minecraft account?

No. One Minecraft account maps to at most one Discord user, and one Discord user to at most one Minecraft
account.

## I changed my Minecraft name. Do I need to relink?

No. The link stores your UUID as well as your name, and avatars come from the UUID.

## Can it bridge more than one Hypixel guild?

Yes — one Minecraft account per guild, all through the same Discord channel. Guilds can also talk directly to
each other; see [Guild-to-guild bridging](Guild-to-Guild-Bridging).

## Can it serve more than one Discord server?

No, and that is enforced. One instance, one Discord server. Commands from anywhere else are refused — see
[Admin roles](Admin-Roles) for why that is a security property rather than a limitation.

## Is this allowed on Hypixel?

TriBridge relays chat and runs guild commands an officer could type themselves; it does not automate gameplay.
But the bridging account is a real account subject to the [server rules](https://hypixel.net/rules), and no
third-party tool is officially endorsed by Hypixel. Running it is at your own risk.

## Does it store my messages?

Relayed messages are not stored. Disguised messages **are** recorded in the [audit channel](Auditing), because
reposting removes the author from the message and there has to be a record of who wrote what.

## Why do new commands take so long to show up?

Slash commands are registered globally, and Discord propagates them on its own schedule — up to an hour. The
bot has already registered them.

## Where do I report a bug or ask for a feature?

`/request` opens a form — see [Feature requests](Feature-Requests). Bugs in the bot itself go to
[Issues](https://github.com/Trilleo/TriBridge/issues).

## Next

- [Troubleshooting](Troubleshooting)
- [Using the bridge](Using-the-Bridge)
