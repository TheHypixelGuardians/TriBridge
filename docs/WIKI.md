# Legacy GitHub wiki (retired)

TriBridge public documentation now lives on the **Mintlify** site:

**https://thehypixelguardians.mintlify.site/tribridge**

Edit [`site/tribridge/`](../site/tribridge/) and [`site/docs.json`](../site/docs.json). Preview locally with `cd site && npx mint dev` — see [site/README.md](../site/README.md).

## What happened to the wiki

Before Mintlify, user-facing docs were maintained in [`wiki/`](../wiki/) and copied into the repository's GitHub wiki by [`.github/workflows/wiki.yml`](../.github/workflows/wiki.yml) on every push to `master`. That workflow was **removed** when Mintlify became canonical; the GitHub wiki is no longer updated from this repository.

The [`wiki/`](../wiki/) folder remains as a frozen archive. See [wiki/README.md](../wiki/README.md).

## Maintainer checklist (current)

When a user-visible feature changes, update in the same task as the code:

1. [docs/FEATURES.md](FEATURES.md) — canonical in-repo description.
2. The matching page under `site/tribridge/` (and `site/docs.json` when adding a page).
3. [CHANGELOG.md](../CHANGELOG.md) and, if guild members would notice, [DISCORD_CHANGELOG.md](../DISCORD_CHANGELOG.md).
4. [README.md](../README.md) when commands, install steps, or `.env` variables change.

Three Mintlify pages are **exhaustive lists** — a missing entry is a visible gap:

- [site/tribridge/commands.mdx](../site/tribridge/commands.mdx) — every slash command and chat command.
- [site/tribridge/config-files.mdx](../site/tribridge/config-files.mdx) — every config file the bot writes.
- [site/tribridge/permissions.mdx](../site/tribridge/permissions.mdx) — every Discord permission and intent.

The audience split from the old wiki still applies in Mintlify navigation: *Using the bridge* is for guild members; *Running the bot* is for whoever hosts the bot and holds a bot-admin role.

Full after-every-change guidance is in [CLAUDE.md](../CLAUDE.md).
