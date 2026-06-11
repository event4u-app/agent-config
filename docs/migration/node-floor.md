# Node Floor Audit

> Phase 1 Step 12 of `agents/roadmaps/road-to-typescript-only-scripts.md`.
> Decision: which Node.js floor the TS-only script suite supports, where it is
> enforced, and what CI tests.

## Facts (as audited 2026-06-11, branch feat/py2ts-phase1-infra)

| Surface | Value | Source |
|---|---|---|
| `engines.node` | `>=20.11.0` | `package.json:53-55` |
| tsconfig target | `ES2022` (`module: ESNext`, `moduleResolution: Bundler`) | `tsconfig.json:3-5` |
| tsconfig lib | `ES2022` (+ `DOM` in `tsconfig.ui.json:4`, `tsconfig.test.json:6`) | tsconfig files |
| CI — tests.yml | Node `20` | `.github/workflows/tests.yml:241` |
| CI — release-drift.yml | Node `20` | `.github/workflows/release-drift.yml:44` |
| CI — publish-npm.yml | Node `20` | `.github/workflows/publish-npm.yml:48` |
| CI — smoke-public-install.yml | matrix `node: ['20', '22']` × 3 OS | `smoke-public-install.yml:78-80` |
| CI — deploy-mcp-worker.yml | Node `22` | `deploy-mcp-worker.yml:68` |
| `engine-strict` | not set (no `.npmrc`) — `engines` is advisory only | repo root |
| Installer Node check | none today (Python installer never inspects `process.version`) | grep of `src/scripts/install*`, `setup.sh` |

Feature scan of `src/` TypeScript (sampled, not exhaustive):

- `node:` protocol imports — 34 files (Node ≥ 16; trivially within floor).
- Global `fetch` in Node-side code — `src/server/token.ts` (stable without flag
  since Node 18, marked stable in 21; fine on ≥ 20.11).
- No hits for `structuredClone`, top-of-module top-level `await`,
  `Array.prototype.at(-…)`, `Object.hasOwn`, `findLast` in `src/` TS.
- Browser-only `fetch` usage (`src/ui/api.ts`) is covered by the `DOM` lib, not
  the Node floor.

Conclusion of the scan: nothing in the current TS code requires more than
Node 18; the ES2022 compile target is the binding constraint and is fully
served by every Node ≥ 18.12. The floor question is therefore a **support
lifecycle** decision, not a syntax one.

## Recommendation

**Raise the floor to Node `>=22.0.0` as part of the TS-only migration; test
22 (minimum) and 24 (current LTS) in CI.** Keep `>=20.11.0` only until the
first major/breaking release of the migration lands, then flip — the bump is a
semver-major signal per the package's versioning policy.

## Rationale

- **Node 20 is end-of-life.** Its maintenance window ended April 2026. A
  migration that will ship through 2026/27 should not anchor its floor on a
  line that no longer receives security fixes; keeping it implies supporting
  consumers on an unpatched runtime.
- **Node 22 (maintenance LTS) and 24 (active LTS) are the 2026 reality.** CI
  already runs 22 in two workflows; the smoke matrix already proves installs
  on 22. Raising the floor to 22 costs no code changes (the feature scan shows
  no >ES2022 usage to add or remove) and removes a dead line from the matrix.
- **Consumer compatibility risk is low and visible.** The package is a dev-time
  tool invoked via `npx`/global install, not a production runtime dependency.
  Consumers still on Node 20 get a clear, immediate failure at install time
  (see Enforcement) rather than a latent one.
- **Why not 24 as the floor:** 24 only entered LTS in late 2025; many CI images
  and corporate baselines still pin 22. Floor = oldest non-EOL LTS (22),
  matrix-test up to current LTS (24).

## Enforcement points

1. **`package.json` `engines`** — flip to `">=22.0.0"` at the breaking release.
   Advisory only without `engine-strict`; npm prints a warning, pnpm/yarn fail
   harder. Do **not** set `engine-strict` repo-wide (it would also bind
   maintainers); rely on point 2 for the hard gate.
2. **TS installer runtime check (the hard gate).** Phase 3 Step 2 already
   requires "Node-version check with a clear error": the TS installer must
   compare `process.versions.node` against the floor on startup and fail with
   an actionable message before writing anything. This is the enforcement the
   Python installer never had — it must land with the TS installer.
3. **CI matrix** — pin the floor and the current LTS:
   - `smoke-public-install.yml`: `node: ['22', '24']` (replacing `['20', '22']`).
   - `tests.yml` / `release-drift.yml` / `publish-npm.yml`: bump single-version
     jobs `20` → `22`; add a `24` leg to `tests.yml` if budget allows.
4. **Docs** — README Quickstart and `docs/getting-started.md` state the floor
   explicitly ("requires Node 22+"); CHANGELOG `### Breaking` entry +
   `BREAKING_CHANGES.md` index the bump per the versioning policy.

## Decision status

Recommended here; the `engines` flip itself is release-gated (semver-major)
and should ride the first breaking release of the TS migration, not this
infra PR. Until then `>=20.11.0` stays in `package.json`, and CI keeps one
Node 20 leg solely to honor the published floor.
