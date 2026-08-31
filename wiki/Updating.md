# Updating

TriBridge does not update itself. There is no build step, so an update is a pull, an install and a restart.

```bash
git pull
npm install
```

Then restart the process:

```bash
npm start
```

## What survives

Everything. Every file the bot writes is [gitignored](Config-Files) and lives next to the repository rather
than inside it — the guild registry, the account links, the admin roles, the cached Microsoft tokens. A pull
cannot touch them.

The one thing to read before restarting is the release's entry in the
[changelog](https://github.com/Trilleo/TriBridge/blob/master/CHANGELOG.md). A **major** version bump means a
config format that existing `*Config.json` files cannot be read as; anything else is safe to pull and
restart.

While the bot is on its `0.1.0-beta.N` line there are no major bumps, so read the changelog entry itself for
anything that changes a config file rather than relying on the number.

## After restarting

- **`/ping`** — check every Hypixel guild reconnects. Accounts come back one per ten seconds, so give it a
  moment with several guilds registered.
- **New or changed commands take up to an hour to appear.** Slash commands are registered globally on startup
  and Discord propagates them on its own schedule. The bot has already registered them; Discord has not
  finished showing them.
- **Post the release's section of
  [DISCORD_CHANGELOG.md](https://github.com/Trilleo/TriBridge/blob/master/DISCORD_CHANGELOG.md)** to your
  announcement channel. It is written for guild members and sized to paste as one message.

## Downgrading

`git checkout` an earlier commit and reinstall. Config files written by a newer version are read by an older
one on a best-effort basis: unknown fields are ignored, and a file that cannot be parsed degrades to defaults
rather than crashing — which for `guildsConfig.json` means an empty registry. Back that file up before going
backwards.

## Next

- [Installation](Installation)
- [Config files](Config-Files)
- [Releasing](Releasing) — for whoever cuts the release
