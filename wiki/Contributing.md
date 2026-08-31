# Contributing

## Getting set up

```bash
git clone https://github.com/Trilleo/TriBridge.git
npm install
```

Node v22 or newer. There is no build step, no test suite and no linter, so there is no `npm test` — the script
does not exist.

Two ways to run it:

| Command       | Does                                                                             |
|---------------|----------------------------------------------------------------------------------|
| `npm start`   | Runs the bot once, the same as `node src/index.js`                               |
| `npm run dev` | Runs it under `nodemon`, restarting on any change to a source file or the `.env` |

Running the bot connects to **live** Discord and Hypixel, with real accounts in real guilds. Don't start it to
verify a change unless you have a bot and a guild of your own to point it at. A good deal is testable offline
against fakes — see [Architecture](Architecture).

`npm run dev` restarts on every save, so it reconnects the Minecraft accounts every time — leaving it running
while editing will sign them in repeatedly and can get them throttled by Hypixel. Stop it while you work, and
start it when you want to try something.

## Commit messages

`<tag>: <message>`, one granular commit per logical change.

| Tag             | Usage                                           | Example                                      |
|:----------------|:------------------------------------------------|:---------------------------------------------|
| **Feature**     | Brand-new functionality                         | `Feature: Add cross guilds message sync`     |
| **Fix**         | Bugs, crashes, logic errors                     | `Fix: Keep tag markers on reposted messages` |
| **Improvement** | Existing behaviour, done better                 | `Improvement: Change bot refresh time`       |
| **Internal**    | Documentation, comments, repository maintenance | `Internal: Reformat README.md`               |
| **Backend**     | Dependency or configuration updates             | `Backend: Update discord.js to 14.25.1`      |
| **Update**      | Version bumps                                   | `Update: 1.2.1 release`                      |

Present tense, specific, no trailing period. The full convention is in
[docs/COMMIT_STRUCTURE.md](https://github.com/Trilleo/TriBridge/blob/master/docs/COMMIT_STRUCTURE.md).

## What a good change looks like

- **It carries its own documentation.** The changelog entry, the README row and the wiki page ship in the same
  commit as the code. See the checklist in [Adding a command](Adding-a-Command).
- **It explains the non-obvious in a comment.** Much of this codebase's value is in comments saying why the
  obvious alternative was worse — a silent drop, a mute, a permission escalation. When you write a rule like
  that, write the reason next to it. That sentence is what stops the rule being simplified away later.
- **It does not weaken a load-bearing guard.** The relay loop checks, the single-server check, the chat-queue
  spacing and the sanitisers in front of `bot.chat` all exist because the alternative broke something real.
  Changing one is a deliberate act, not a cleanup.
- **It keeps the two meanings of "guild" apart.** A *Hypixel guild* has a `guildKey`. A *Discord server* is
  `bridge.discordServerId`. Never introduce a bare `guildId` in new code.

## Style

CommonJS, and [Prettier](https://prettier.io) with its default settings — 2-space indent, double quotes,
semicolons, trailing commas, 80 columns. The settings are in `.prettierrc`, so an editor that formats on save
agrees with the repository instead of fighting it. Reformat with:

```bash
npx prettier --write "src/**/*.js"
```

JSDoc on non-trivial helper functions. Prettier does not reflow comments, and much of this codebase's value is
in them — see below.

## Reporting things

- **Bugs and ideas from outside the server:**
  [Issues](https://github.com/Trilleo/TriBridge/issues).
- **From inside the server:** `/request` — see [Feature requests](Feature-Requests).

## Next

- [Architecture](Architecture)
- [Adding a command](Adding-a-Command)
- [Releasing](Releasing)
