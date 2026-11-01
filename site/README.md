# agent-config docs + proof site (Starlight)

Isolated Astro/Starlight workspace. Its dependencies never touch the package
(`npm install` here writes only `site/node_modules`).

```sh
cd site
npm install
npm run dev      # local preview
npm run build    # static build into site/dist (the CI gate)
```

Pages listed in `docs-manifest.json` are **generated** from the canonical
`docs/*.md` by `sync-docs.mjs` (runs on `prebuild`/`predev`) into the gitignored
`src/content/docs/generated/` subtree, so the site can never drift from the
source of truth. Each entry is `{ "src": "<path under docs/>", "route": "<url path>" }`;
adding a page is one manifest line. Edit the source in `../docs/`, never the
synced copy. A relative `.md` link the sync cannot map fails the build.

`npm run build` also draws the hosted demo map (`code-graph map --demo`, sample
data) into `public/demo-map/` via `build-demo-map.mjs`, under a size budget. It
needs the root package's dependencies — run `npm ci` at the repository root
first, or set `SITE_SKIP_DEMO_MAP=1` to skip it locally.

Deployed to GitHub Pages by `.github/workflows/deploy-site.yml`.
