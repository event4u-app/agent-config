# agent-config docs + proof site (Starlight)

Isolated Astro/Starlight workspace. Its dependencies never touch the package
(`npm install` here writes only `site/node_modules`).

```sh
cd site
npm install
npm run dev      # local preview
npm run build    # static build into site/dist (the CI gate)
```

Content under `src/content/docs/proof.md` and `benchmark.md` is **generated**
from the canonical `docs/*.md` by `sync-docs.mjs` (runs on `prebuild`/`predev`),
so the site can never drift from the source of truth. Edit the source in
`../docs/`, never the synced copy.

Deploy target (GitHub Pages workflow) is a maintainer decision — deliberately
not wired yet.
