# TriBridge documentation site (Mintlify)

This folder is the **Mintlify** source for TriBridge's public documentation. It mirrors the content in
[`wiki/`](../wiki) and will replace the [GitHub wiki](https://github.com/TheHypixelGuardians/TriBridge/wiki)
once the Mintlify dashboard is connected and the cutover is complete. Until then, both stay in sync manually
when wiki pages change.

## Preview locally

Install the [Mintlify CLI](https://www.mintlify.com/docs/cli/install) (Node.js 20+), then from this directory:

```bash
cd site
mint dev
```

Or without a global install:

```bash
cd site
npx mint dev
```

The preview opens at [http://localhost:3000](http://localhost:3000). Validate configuration with `mint validate`.

## Production deploy

Publishing to a Mintlify-hosted URL still requires connecting this repository in the
[Mintlify dashboard](https://dashboard.mintlify.com):

1. Install the **Mintlify GitHub App** on `TheHypixelGuardians/TriBridge`.
2. Create or link a docs project and set the **content root** to `site/` (where `docs.json` lives).
3. Deploy from `master` (or your release branch). Preview deployments run on pull requests automatically once
   connected.

The existing [wiki sync workflow](../.github/workflows/wiki.yml) is unchanged — this PR adds the Mintlify site
alongside it, not instead of it.

## Regenerating from the wiki

If you bulk-update `wiki/` and need to refresh MDX files, run from the repository root:

```bash
node scripts/migrate-wiki-to-mintlify.js
```

Review the diff — the script handles wiki-style links and common MDX escapes, but manual edits in `site/`
should be merged back or re-applied as needed.
