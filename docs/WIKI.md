# The GitHub wiki

The wiki pages live in [`wiki/`](../wiki) in this repository and are **published by pushing them to the
wiki's own Git repository** (`https://github.com/Trilleo/TriBridge.wiki.git`). Keeping the source here means
wiki edits go through the same review as code, and a feature commit can update the wiki alongside it.

## Two readers, one wiki

TriBridge has two audiences and they want opposite things, so the pages are split into two runs and the
sidebar keeps them apart:

| Section              | Reader                                          | Assumes                                       |
|----------------------|-------------------------------------------------|-----------------------------------------------|
| **Using the bridge** | A guild member in the Discord server            | No access to the host, the `.env` or the console |
| **Running the bot**  | Whoever hosts the bot and holds a bot-admin role | A terminal, the repository, and `/guilds`     |

A page belongs to whichever reader can act on it. `/link` is a member page even though it touches a config
file; `/linkrole` is a staff page even though members feel the result. When a feature genuinely has both
halves — the global profile change, the audit trail — the member-facing consequence is one paragraph on the
member page and the configuration lives on the staff page.

## The pages

| File                                                                                         | Page                                                       |
|----------------------------------------------------------------------------------------------|------------------------------------------------------------|
| `Home.md`                                                                                    | Landing page — the two entry points and a feature table    |
| `_Sidebar.md`                                                                                | Navigation shown beside every page                         |
| `_Footer.md`                                                                                 | Footer shown under every page                              |
| `Using-the-Bridge.md`, `Guild-Tags.md`, `Account-Linking.md`, `Networth.md`, `Feature-Requests.md` | Using the bridge                                     |
| `Commands.md`                                                                                | Every slash command, both audiences, in one table          |
| `Installation.md`, `Configuration.md`, `Config-Files.md`, `Permissions.md`, `Updating.md`     | Running the bot — setup                                    |
| `Hypixel-Guilds.md`, `Guild-to-Guild-Bridging.md`, `Reconnection.md`                          | Running the bot — the guild registry                       |
| `Admin-Roles.md`, `Admin-Panel.md`, `Global-Profile-Change.md`, `Auditing.md`, `Link-Role.md` | Running the bot — administration                           |
| `FAQ.md`, `Troubleshooting.md`                                                                | Help                                                       |
| `Architecture.md`, `Adding-a-Command.md`, `Contributing.md`, `Releasing.md`                   | Development                                                |

## Conventions

- **A file name is a page title.** `Config-Files.md` is the page *Config files*; hyphens render as spaces in
  the wiki's page list. Renaming a file breaks every link to it and any external bookmark, so treat names as
  stable.
- **Links between pages are plain relative Markdown**: `[Guild tags](Guild-Tags)`, without the `.md`. This
  form works both in the published wiki and when browsing `wiki/` on GitHub.
- **Links into the repository are absolute URLs**
  (`https://github.com/Trilleo/TriBridge/blob/master/CHANGELOG.md`), because the wiki is a different
  repository and relative paths would not resolve.
- `_Sidebar.md` and `_Footer.md` are special names GitHub renders around every page. A new page needs a line
  in `_Sidebar.md`, under the right section, and a user-visible feature also needs a row in the `Home.md`
  table.
- **Never paste a real token, channel id, role id or account address into a page.** Examples use
  `you@example.com`, `#log-channel` and obviously-fake ids. The wiki is public even when the repository is
  not.
- **Say which audience a warning is for.** "Ask an administrator to run `/requestchannel set`" on a member
  page; "run `/requestchannel set`" on a staff one.

## Publishing

The wiki repo has no branch protection and no CI; a push is a publish.

```bash
git clone https://github.com/Trilleo/TriBridge.wiki.git /tmp/tribridge-wiki
cp wiki/*.md /tmp/tribridge-wiki/
cd /tmp/tribridge-wiki && git add -A && git commit -m "Internal: Sync wiki from main repository" && git push
```

The wiki must be **enabled and initialised** in the repository settings before that clone URL exists — create
the first page through the web UI once, then push over it.

## Keeping it in sync

Keeping the wiki current is **step 4 of the after-every-change checklist in [CLAUDE.md](../CLAUDE.md)**, not
an afterthought: the wiki is what somebody finds from a search engine, and a page that lags behind the bot is
worse than no page at all.

The wiki restates what [FEATURES.md](FEATURES.md) documents, aimed at somebody arriving from a search engine
rather than a reader going through the repo. When a feature changes, both move together:

1. `docs/FEATURES.md` — the canonical description.
2. `wiki/<Page>.md` — the same change, in the wiki's voice, on whichever side of the split it belongs to.
3. `wiki/Home.md` and `wiki/_Sidebar.md` — only when a page is added or renamed.

Three pages are **exhaustive lists**, so a missing entry is a visible gap rather than a thin page:

- [wiki/Commands.md](../wiki/Commands.md) — every slash command and chat command.
- [wiki/Config-Files.md](../wiki/Config-Files.md) — every file the bot writes next to the repository.
- [wiki/Permissions.md](../wiki/Permissions.md) — every Discord permission and intent, and what breaks
  without it.

Version-specific facts appear in `Installation.md` and `Updating.md` (Node version, dependencies, `.env`
variables); check them whenever `package.json` or the `.env` contract changes.
