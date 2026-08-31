# TriBridge — Commit Structure

To keep the history readable, every commit message follows one standardized format. This is what makes it
possible to see, from `git log` alone, which commits changed the bot for the people using it and which only
moved code around.

## Basic structure

Every commit message must follow this syntax:
`<tag>: <message>`

## Approved tags

| Tag             | Usage                                                | Example                                        |
|:----------------|:-----------------------------------------------------|:-----------------------------------------------|
| **Feature**     | Adding brand-new functionality.                      | `Feature: Add cross guilds message sync`       |
| **Fix**         | Repairing bugs, crashes, or logic errors.            | `Fix: Keep tag markers on reposted messages`   |
| **Improvement** | Refining existing behaviour, wording, or performance. | `Improvement: Change bot refresh time`         |
| **Internal**    | Documentation, comments, or repository maintenance.  | `Internal: Add CHANGELOG.md for recording changes` |
| **Backend**     | Dependency or configuration updates.                 | `Backend: Update discord.js to 14.25.1`        |
| **Update**      | Bot version bumps.                                   | `Update: 1.2.1 release`                        |

## Best practices

* **Use present tense:** write "Add feature", not "Added feature".
* **Be specific:** instead of `Fix: bug`, write `Fix: Stop relay loop between two bots in one guild`.
* **No period at the end.**
* **One logical change per commit.** A feature and the changelog entry that describes it belong in the same
  commit — see the checklist in [CLAUDE.md](../CLAUDE.md) — but a feature and an unrelated refactor do not.

## Mapping to changelog categories

Tags line up with the [CHANGELOG.md](../CHANGELOG.md) categories described in [RELEASING.md](RELEASING.md):

| Tag                        | Changelog category      |
|:---------------------------|:------------------------|
| **Feature**                | `### New Features`      |
| **Improvement**            | `### Improvements`      |
| **Fix**                    | `### Fixes`             |
| **Backend** / **Internal** | `### Technical Details` |
| **Update**                 | Usually no entry        |

A `Feature`, `Improvement` or `Fix` commit almost always earns a line in
[DISCORD_CHANGELOG.md](../DISCORD_CHANGELOG.md) as well. `Backend` and `Internal` never do.
