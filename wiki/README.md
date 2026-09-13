# Legacy wiki (frozen)

**Canonical public documentation** for TriBridge is on the Mintlify site:

**https://thehypixelguardians.mintlify.site/tribridge**

Source lives in [`site/tribridge/`](../site/tribridge/). Edit those MDX pages (and [`site/docs.json`](../site/docs.json) navigation when adding a page) — not this folder.

## Why this folder still exists

These Markdown files were the source for the GitHub wiki before the Mintlify cutover. They are kept in the repository for history and as a reference for the one-off migration script [`scripts/migrate-wiki-to-mintlify.js`](../scripts/migrate-wiki-to-mintlify.js). **They are no longer published anywhere** — the wiki sync workflow was removed when Mintlify went live.

Do not update `wiki/` for new features or doc fixes. If you need to bulk-refresh Mintlify pages from an old snapshot, run the migration script and review the diff carefully; routine edits belong in `site/tribridge/` only.
