# TriBridge - Discord Change Log

Short, copy-pasteable version of [CHANGELOG.md](CHANGELOG.md) for the announcement channel. One `##` section
per release — copy the section, paste it as a message. Keep each section under 2000 characters (Discord's
message limit) and use only markdown Discord renders: `#`/`##`/`###` headings, `**bold**`, `` `code` ``, `-`
bullets, `> ` quotes. Tables, `+` bullets and links with titles do not render.

## Unreleased

### Guild-to-guild chat

- Guild chat can now be shared between the bridged Hypixel guilds, so you can talk to the other guilds from
  in-game without watching Discord.
- Messages from another guild arrive with its tag on the name, like `[SB] Notch: hello`, so you always know
  who you are talking to.
- Joins and leaves are not shared — just the other guilds' actual conversation.
- Admins turn this on per guild with `/guilds edit`, and it stays off until they do.

### Tag fixes

- Guild tags no longer stay stuck on your message here. `!sb hello` now shows as `hello`, matching what the
  guild actually received.
- The ❓ and 📡 markers stick around properly now, so a mistyped tag or an offline guild is always visible —
  including for linked users, who used to lose them.

### Multiple guilds

- This channel can now bridge more than one Hypixel guild at the same time.
- Start a message with a guild's tag to reach just that guild — `!sb hey` only goes to the SkyBlock guild.
  No tag still goes to every guild, exactly like before.
- Need to start a message with a literal `!`? Type it twice — `!!sb hi` comes out as `!sb hi`.
- Guild chat coming back here is colour-coded and tagged, so you can tell at a glance which guild said what.
- `/online` and `/ping` now cover every guild at once, and `/online` takes a `guild` if you only want one.
- `/link` works if you are in any of the bridged guilds, not just one of them.
- Nothing changes if only one guild is set up — no tags, same colours, same everything.

### SkyBlock networth

- Type `!nw <username>` in guild chat or here and the bot tells you that player's networth.
- It picks their richest profile and counts everything — cosmetics and soulbound included.
- Someone with their inventory API off gets an `(API off)` note, because the number will be too low.
- `/networth` does the same here, and with no username it uses your linked account.

## Version 1.2.1

### Global profile change

- Admins can now switch the disguise off for one side of the bridge on its own, so guild chat can keep real names
  while Discord shows the disguise — or the other way around.

## Version 1.2.0

### Global profile change

- Admins can now turn everyone in the server into the same person for a while — your messages get reposted with
  someone else's name and avatar until the timer runs out.
- It carries over the bridge too: guild chat sees the disguise, and guild chat coming back here does as well.
- Heads up on what this costs: a disguised message is a repost, so you can't edit or delete it afterwards, replies
  show a link instead of the usual reply header, and messages with stickers, polls, forwards or voice notes are
  left alone.
- Every disguised message is logged with the real sender, so staff can always tell who actually said what.
- Admins: it all lives behind `/adminpanel`, there is a test mode for trying it in one channel first, and
  `/auditchannel` picks where the log goes.

## Version 1.1.0

### Account linking

- Linking your Minecraft account with `/link` now gives you a role, and `/unlink` takes it away again.
- Already linked? You get the role automatically — no need to re-link.
- Admins pick the role with `/linkrole set`.

### Feature requests

- `/request` opens a short form — give your idea a name and a description, and it gets posted to the requests
  channel with its own number.
- Admins mark each request as accepted, denied, planned or duplicate, and the post updates itself so you can
  see where your idea stands.

### Permissions

- `/whois` and `/login` are now admin-only.
- The bot now only responds in this server.

## Version 1.0.0

**TriBridge is live** — the Discord ↔ guild chat bridge is up and running.

### Bridging

- Guild chat shows up here as embeds, and anything you send in the bridge channel goes straight to guild chat.
- Member joins and leaves are relayed too.
- If the bot drops from Hypixel it reconnects on its own.

### Link your account

- `/link <username>` ties your Minecraft account to your Discord account. Your messages then show up with your
  Minecraft skin and name on both sides.
- `/unlink` removes it, `/links` lists everyone who's linked, `/whois` looks someone up.

### Commands

- **Everyone** — `/online` for who's on, `/ping` for bot status, `/help` for the full list.
- **Admins** — `/invite`, `/kick`, `/promote`, `/demote`, `/send`, `/login`, `/adminrole`.
