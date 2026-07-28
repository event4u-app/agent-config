# Reproducible install bundle (`dist/install/install.mjs`)

**Audience.** Maintainers touching `src/scripts/install.ts` or its
dependency graph, or rebuilding `dist/install/install.mjs` by hand.

**Source of truth for the mechanism:** the `build:install-bundle` npm script
(`package.json`) + [`check_bundle_path_leakage.ts`](../../src/scripts/check_bundle_path_leakage.ts)
(the guard) + the `install-aux-tests` job in
[`.github/workflows/tests.yml`](../../.github/workflows/tests.yml) (the gate).

## Why this exists

`dist/install/install.mjs` is the pre-bundled installer bridge — force-tracked
in git (`!/dist/install/` in `.gitignore`) so the raw-source `curl | bash`
path (`setup.sh`) can run it via plain `node`, without requiring a
`tsx`/`node_modules` toolchain on the consumer's machine.

It is an `esbuild --bundle` output, and esbuild's per-module boundary comments
(`// <module-path>`) embed whatever path it resolved each dependency from. That
path is **build-environment-dependent** unless the build runs from a clean,
in-tree, repo-relative checkout. Three commits during the 9.1 cycle each
rebuilt the bundle solely to strip a leaked build-machine path esbuild had
baked in:

| Commit | Leak shape |
|---|---|
| `5933bf1a9` | `../../../node_modules/...` — built before `npm ci` ran in a worktree, so esbuild walked up past the worktree root |
| `f8752443b` | `../agent-config/node_modules/...` — a symlinked `node_modules` resolved through the parent checkout |
| `f30adb5a1` | `../../../../../../../Users/<name>/.../agent-config/node_modules/...` — a `node_modules` symlink pointing at an out-of-tree checkout, baking the full machine-absolute path |

Each was fixed by hand, after the fact, once the drift check below caught it.
[`check_bundle_path_leakage.ts`](../../src/scripts/check_bundle_path_leakage.ts)
(road-to-feedback-9.2.0-followups Phase 4.1) makes the class fail the build
directly, so a future leak cannot merge silently.

## The build sequence

From a **clean checkout** (no worktree, no symlinked `node_modules`):

```bash
git clone <repo> && cd <repo>          # or a plain, non-worktree checkout
npm ci                                  # installs exactly what package-lock.json pins
npm run build:install-bundle            # esbuild → dist/install/install.mjs
./scripts-run src/scripts/check_bundle_path_leakage   # path-leakage guard
git diff --exit-code -- dist/install/   # drift check: rebuild == committed
```

`npm run build` runs `build:install-bundle` alongside the CLI/hooks/MCP/UI
bundles; `npm pack --dry-run` produces the tarball-level manifest — a
`shasum` + `integrity` (sha512) line covering every shipped file, printed as
part of `npm notice`:

```bash
npm pack --dry-run
# npm notice shasum: <sha1 of the tarball>
# npm notice integrity: sha512-<...>
```

That tarball-level hash is the closest thing to a package "manifest" this
project ships today — it is not committed anywhere (it changes every release
by design, since the package version changes), but it is what `npm publish`
and a consumer's `npm install` both verify against the registry.

## What the guard checks

`check_bundle_path_leakage.ts` scans every **tracked** file under
`dist/install/` (and, defensively, `dist/hooks/` / `dist/mcp/` should either
ever become tracked) for seven forbidden shapes: absolute macOS/Linux home
paths (`/Users/…`, `/home/…`), `/private/…` or `/opt/…` roots, absolute
Windows paths, `.claude/worktrees/…` paths, any `../`-escaping path into a
`node_modules/` directory (catches all three historical leak shapes above,
including the ones with no `/Users/` in them), any other absolute path into
`node_modules/`, and an absolute `sourceMappingURL`. Each pattern's rationale
— and why it does not false-positive on the bundle's own legitimate relative
strings (e.g. the emitted `"./node_modules/@event4u/agent-config/plugin/agent-config"`
plugin-manifest path) — is documented in the script's header.

It runs in CI as the **"Install bundle has no build-machine path leakage"**
step of the `install-aux-tests` job (`tests.yml`), immediately after the
existing "Install bundle is fresh" rebuild-and-diff step, on every PR that
touches `src/scripts/**` — on both `ubuntu-latest` and `macos-latest`.

## Verifying reproducibility

Two hash comparisons prove different things; neither substitutes for the
other:

1. **Same-tree determinism** — rebuild twice in the same checkout and
   `shasum` the output. Proves esbuild itself is deterministic given
   unchanged inputs (no timestamps, no `Math.random()`-derived module ids).

   ```bash
   npm run build:install-bundle && shasum -a 256 dist/install/install.mjs
   npm run build:install-bundle && shasum -a 256 dist/install/install.mjs
   # → identical hash
   ```

2. **From-clean-checkout reproducibility** — clone fresh, `npm ci`, build,
   and compare against the committed file. Proves the committed bundle is
   exactly what a clean checkout produces (the actual contract the drift
   check + this guard exist to enforce).

   ```bash
   git clone --branch <branch> --single-branch <repo> /tmp/repro && cd /tmp/repro
   npm ci
   npm run build:install-bundle
   git diff --exit-code -- dist/install/install.mjs   # empty diff = reproducible
   ```

### What is measured, honestly

A from-clean-clone rebuild (step 2 above) was run against this repo's
`feat/road-to-feedback-9.2.0-followups` branch and produced
`sha256:a0483a0a573badbd8c3437e69dda89cfc5d3d50e0d8a74c193cdb51c88929b47` —
byte-identical to the committed `dist/install/install.mjs`, with an empty
`git diff`. That is a **point-in-time measurement on one machine**, not a
standing gate — the standing gate is the CI "Install bundle is fresh" step,
which runs the same rebuild-and-diff on every PR across **both**
`ubuntu-latest` and `macos-latest` (the `install-aux-tests` matrix), so
cross-OS-runner byte-identity to the committed file is continuously proven,
not just measured once.

**Not verified**, and not claimed:

- **Windows reproducibility** — no `windows-latest` leg exists in the
  `install-aux-tests` matrix. A Windows-built bundle's byte-identity to the
  committed one is unverified.
- **Cross-Node-version reproducibility** — CI pins Node 20 (`setup-node@v4`
  `node-version: '20'`), matching esbuild's `--target=node20`; a bundle built
  under a different Node major is not tested against the committed hash.
- **`npm ci` non-determinism from a lockfile drift** — `package-lock.json`
  pins exact dependency versions, so this is a controlled variable, not an
  open question; a stale or hand-edited lockfile is out of this guard's scope
  (`npm ci` itself fails on a lockfile/`package.json` mismatch).

## See also

- [`check_bundle_path_leakage.ts`](../../src/scripts/check_bundle_path_leakage.ts) — the guard.
- [`check_bundle_path_leakage.test.ts`](../../tests/scripts/check_bundle_path_leakage.test.ts) — its tests.
- [`.github/workflows/tests.yml`](../../.github/workflows/tests.yml) — the `install-aux-tests` job (both the freshness check and this guard).
- [`release-runbook.md`](release-runbook.md) — the package-level release pipeline this bundle ships inside.
