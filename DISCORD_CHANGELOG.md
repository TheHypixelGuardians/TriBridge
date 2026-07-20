# TriBridge - Discord Change Log

Short, copy-pasteable version of [CHANGELOG.md](CHANGELOG.md) for the announcement channel. One `##` section
per release — copy the section, paste it as a message. Keep each section under 2000 characters (Discord's
message limit) and use only markdown Discord renders: `#`/`##`/`###` headings, `**bold**`, `` `code` ``, `-`
bullets, `> ` quotes. Tables, `+` bullets and links with titles do not render.

## Unreleased

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
