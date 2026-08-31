# Releasing

TriBridge keeps **two** changelogs, written for different people, and both are updated in the same commit as
the change itself.

| File                    | Reader                                 | Voice                                                      |
|-------------------------|----------------------------------------|------------------------------------------------------------|
| `CHANGELOG.md`          | Whoever runs the bot, and future you   | Third person, complete, sub-bullets for the details        |
| `DISCORD_CHANGELOG.md`  | Guild members reading an announcement  | Second person, one line per change, nothing they can't see |

The full format lives in
[docs/RELEASING.md](https://github.com/Trilleo/TriBridge/blob/master/docs/RELEASING.md). The summary:

## CHANGELOG.md

SkyHanni-style — a `##` release section, a `###` category, a `####` feature area, then `+` bullets with
indented `+` sub-bullets.

```markdown
## Unreleased

### New Features

#### Bridge

+ Added **guild-to-guild bridging**: chat in one Hypixel guild can now be shared straight into the others.
  + Off by default and turned on per guild with `/guilds edit guild:sb crossbridge:True`.
```

Categories: `New Features`, `Improvements`, `Fixes`, `Technical Details`, `Removed Features` — only the ones
with entries. Feature areas: `Bridge`, `Account Linking`, `Management`, `Information`, `Requests`,
`Admin Panel`, `Core`, `Misc`.

Write for the people running and using the bot. Refactors and dependency bumps go under `Technical Details`.
Always say what the default is, and what an existing install sees if it does nothing.

## DISCORD_CHANGELOG.md

A change earns a line only if a guild member would notice it. One line, second person, no sub-bullets. Only
markdown Discord renders — no tables, no `+` bullets, no titled links. **Each `##` section must stay under 2000
characters** so it pastes as one message.

## Cutting a release

1. Bump `version` in `package.json` — patch for fixes, minor for features, major for a config format existing
   `*Config.json` files can't be read as.
2. Rename `## Unreleased` to `## Version X.Y.Z` in **both** changelogs, and add a fresh empty `## Unreleased`
   above it in each.
3. Check [Installation](Installation) and the README if the Node version or the dependencies changed.
4. Commit as `Update: X.Y.Z release`.
5. Post the new `##` section of `DISCORD_CHANGELOG.md` to the announcement channel.

Never tag or push tags unless explicitly asked.

## Deploying

```bash
git pull
npm install
```

Then restart. Config files live outside the repository and survive the pull — see [Updating](Updating) for
what to check afterwards, including the up-to-an-hour delay before new slash commands appear.

## The wiki

These pages publish themselves. A push to `master` touching `wiki/` runs
[`.github/workflows/wiki.yml`](https://github.com/Trilleo/TriBridge/blob/master/.github/workflows/wiki.yml),
which copies the folder into the wiki's own repository — so there is no publish step at release time, and a
page merged with the code is live with it. See
[docs/WIKI.md](https://github.com/Trilleo/TriBridge/blob/master/docs/WIKI.md).

## Next

- [Updating](Updating)
- [Contributing](Contributing)
