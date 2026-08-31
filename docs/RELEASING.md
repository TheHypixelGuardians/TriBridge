# Writing the changelog & releasing

TriBridge keeps **two** changelogs, and they are written for different people.

| File                                            | Reader                                | Voice                                                      |
|-------------------------------------------------|---------------------------------------|------------------------------------------------------------|
| [CHANGELOG.md](../CHANGELOG.md)                 | Whoever runs the bot, and future you  | Third person, complete, sub-bullets for the details        |
| [DISCORD_CHANGELOG.md](../DISCORD_CHANGELOG.md) | Guild members reading an announcement | Second person, one line per change, nothing they can't see |

Both are updated **in the same commit as the change itself**, so the changelog never lags behind the code.

## CHANGELOG.md

The format is SkyHanni-style: a `##` release section, a `###` category, a `####` feature area, then `+`
bullets with indented `+` sub-bullets for the details.

```markdown
## Unreleased

### New Features

#### Bridge

+ Added **guild-to-guild bridging**: chat in one Hypixel guild can now be shared straight into the other
  bridged guilds.
    + Off by default and turned on per guild with `/guilds edit guild:sb crossbridge:True`.
    + The switch covers both directions: a guild that is not sharing its own chat does not receive anyone
      else's either.
```

### Categories

Only these five, and only the ones that actually have entries — an empty category is left out entirely.

| Category                | Holds                                               |
|-------------------------|-----------------------------------------------------|
| `### New Features`      | Something the bot could not do before               |
| `### Improvements`      | Something it already did, done better               |
| `### Fixes`             | Something that was broken                           |
| `### Technical Details` | Refactors, dependency bumps, tooling, documentation |
| `### Removed Features`  | Something taken away                                |

### Feature areas

The `####` heading under a category names the part of the bot that changed. These are free-form, but the
established set is `Bridge`, `Account Linking`, `Management`, `Information`, `Requests`, `Admin Panel`,
`Documentation`, `Core` and `Misc` — `Misc` being the catch-all. Reuse an existing one rather than inventing a
synonym.

### Writing the entries

- **Write for the people running and using the bot, not for developers.** "Added `/whois` to look up a link",
  not "Refactored linkedAccounts".
- **One change per bullet.** Details, caveats and defaults go in indented sub-bullets underneath.
- **Say what the default is** whenever a feature ships switched off, and say what an existing install sees.
  Half of what a changelog is for is answering "does this change anything for me if I do nothing?"
- Refactors, dependency bumps and tooling go under `### Technical Details`, in the bot's own vocabulary.
- **Skip the changelog only** for changes with no effect on the running bot or its workflow — a typo in a
  doc, a comment reflow.

## DISCORD_CHANGELOG.md

The short version, copy-pasted into the announcement channel as a single message. A change earns a line here
only if a guild member would actually notice it: a new command, changed behaviour, a user-visible fix.
Everything under `### Technical Details` never appears.

Constraints, all of them load-bearing:

- **Second person, for guild members**, not for server staff. "Type `!nw <username>` and the bot tells you
  that player's networth."
- **One line per change.** No sub-bullets.
- **Only markdown Discord renders**: `#`/`##`/`###` headings, `**bold**`, `` `code` ``, `-` bullets, `> `
  quotes. No tables, no `+` bullets, no titled links.
- **Each `##` section must stay under 2000 characters** so it pastes as one message. If a release is bigger
  than that, the section has too much detail in it, not too many changes.

During development entries go under the same `## Unreleased` heading the main changelog uses.

## Releasing

1. **Bump `version` in [package.json](../package.json).** Semver:
    - **patch** for fixes,
    - **minor** for features,
    - **major** for a breaking change — a config format an existing `*Config.json` file cannot be read as.
2. **Rename `## Unreleased` to `## Version X.Y.Z`** in **both** [CHANGELOG.md](../CHANGELOG.md) and
   [DISCORD_CHANGELOG.md](../DISCORD_CHANGELOG.md), and add a fresh empty `## Unreleased` above it in each.
3. **Check the version-bearing docs** — [README.md](../README.md) and
   [wiki/Installation.md](../wiki/Installation.md) name the supported Node version and the dependencies; if
   the release changed either, they change with it.
4. **Commit** as `Update: X.Y.Z release`.
5. **Post the new `##` section of `DISCORD_CHANGELOG.md`** to the announcement channel.

Never tag or push tags unless explicitly asked.

## Deploying

There is no build step. On the machine running the bot:

```bash
git pull
npm install
```

Then restart it. Config files are outside the repository and survive the pull — see
[wiki/Config-Files.md](../wiki/Config-Files.md) for what they are.

Slash commands are registered **globally** on startup, and global command propagation can take up to an hour
on Discord's side. A release that adds or changes a command is not fully visible to users the moment the
process comes back up; say so in the announcement if the change is a command.
