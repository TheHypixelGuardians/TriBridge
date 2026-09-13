# The Hypixel Guardians documentation (Mintlify)

This folder is the **Mintlify** source for the org-wide docs site at
[thehypixelguardians.mintlify.site](https://thehypixelguardians.mintlify.site). One deployment, two
**Products** in the sidebar switcher:

| Path | Product | Source repo |
|------|---------|-------------|
| `site/index.mdx` | Org landing — links to both products | This repo |
| `site/tribridge/` | TriBridge (Discord ↔ Hypixel guild chat bridge) | [TriBridge](https://github.com/TheHypixelGuardians/TriBridge) — mirrors [`wiki/`](../wiki) until cutover |
| `site/community/` | THG Community bot (profiles, linking, requests) | [thg-community](https://github.com/TheHypixelGuardians/thg-community) — converted from that repo's public markdown |

Navigation is defined in [`docs.json`](docs.json) via `navigation.products`. The org landing at `/` sits in a
top-level group; use the **product switcher** to jump between TriBridge and THG Community sidebars.

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

The preview opens at [http://localhost:3000](http://localhost:3000). Validate with `mint validate`.

## Production deploy

The live site is connected in the [Mintlify dashboard](https://dashboard.mintlify.com):

1. **Mintlify GitHub App** on `TheHypixelGuardians/TriBridge`.
2. **Content root** `site/` (where `docs.json` lives).
3. Deploy from `master`. PR preview deployments run automatically once connected.

The [wiki sync workflow](../.github/workflows/wiki.yml) is unchanged — TriBridge wiki pages still publish to
GitHub until cutover.

## Regenerating TriBridge pages from the wiki

If you bulk-update `wiki/` and need to refresh TriBridge MDX:

```bash
node scripts/migrate-wiki-to-mintlify.js
```

Output lands in `site/tribridge/`. Review the diff — manual edits in `site/tribridge/` may need re-applying.

## Community docs

THG Community pages under `site/community/` are maintained here for the shared Mintlify deployment. A later
option is Mintlify [multi-repo sources](https://www.mintlify.com/docs/deploy/multi-repo) pointing at
`thg-community` — until then, update both when the community bot's public markdown changes.
