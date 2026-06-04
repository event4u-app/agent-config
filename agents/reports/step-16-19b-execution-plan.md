# Step 16–19b execution plan — the root→`src/` move (human-attended)

> Companion to `agents/roadmaps/road-to-6.0.0-d-structural-restructure.md`
> Phase 5–7. Lives under `agents/reports/` (transient) so it never skews the
> roadmap dashboard. Authored 2026-06-04 after Steps 12–15 landed (PR #362) and
> Step 16 was confirmed a **human-attended kill-switch**. This file makes the
> attended run mechanical.

## Why this is human-attended (not autonomous)

Three hard blockers, established 2026-06-04:

1. **Hard Floor.** The Step-16 commit moves directories + edits
   `.github/workflows` (infra) → `non-destructive-by-default` requires explicit
   this-turn human confirmation that no autonomy directive lifts.
2. **No safe symlink shim.** A root `scripts -> src/…` symlink breaks the
   `smoke-public-install` CI job on `windows-latest` (it consumes the packaged
   tree; git/npm symlink handling on Windows is unreliable in tarballs).
3. **Council degraded.** The Anthropic council member is out of API credits
   (`credit balance too low`, 2026-06-04). **Top up Anthropic credits before the
   attended run** so the dual-member council is available again.

## Recommended approach — path-root reconfig, NOT a symlink shim

The Windows-safe alternative to a symlink: **relocate the tree and reconfigure
the import/lookup root**, so the ~217 `scripts.*` Python imports and ~100 test
imports stay byte-unchanged. Only the *invocation* surfaces change.

- Move `scripts/` → **`src/scripts/`** (dedicated home — clearest; NOT `src/app`
  which is the TS runtime, NOT `src/internal` which is bench/evals/docker).
- Add `src/` to the Python path root so `import scripts.*` still resolves to
  `src/scripts/` — via `pyproject.toml [tool.pytest.ini_options] pythonpath`
  (pytest) and a one-line `sys.path` insert in the few entrypoints that run
  outside pytest. This avoids rewriting 411 modules + 100 test imports.
- Only these *do* change (the tractable surface):
  - ~28 shell invocations `python3 scripts/X.py` in `.github/workflows/*` +
    `taskfiles/*.yml` → `python3 src/scripts/X.py` (or `python3 -m scripts.X`).
  - ~22 TS refs in `src/cli/**` (`resolveScript`, `paths.ts` constants) → new path.
  - 6 source-root resolvers hardcoding `ROOT / "scripts"` (`scripts/_lib/*.py`,
    `condense.py`) → new path.
  - `package.json` `files[]`: `"scripts/"` → `"src/scripts/"` (+ `bin` already
    `dist/cli/...`, unaffected).

## Blast-radius inventory (measured 2026-06-04)

| Surface | Count | Strategy |
|---|--:|---|
| `scripts.*` Python import sites | ~217 | **unchanged** (path-root reconfig) |
| test files importing `scripts.*` | ~100 | **unchanged** (pytest pythonpath) |
| `.github/workflows` + taskfiles `scripts/` | 28 | rewrite to new path |
| source-root resolvers `ROOT/"scripts"` | 6 | rewrite |
| TS refs to `scripts/` | 22 | rewrite |
| `package.json files[]` | 1 | rewrite |
| markdown cross-refs to `docs/`/`config/`/… | ~386 | see § docs move (defer) |

## Phased checklist (each phase = one atomic commit, full gate suite green)

### Phase 16a — `scripts/` → `src/scripts/` (the kill-switch core)
- [ ] `git mv scripts src/scripts`
- [ ] `pyproject.toml`: add `pythonpath = ["src"]` (or `["src", "."]`) under
      `[tool.pytest.ini_options]` so `import scripts.*` resolves to `src/scripts`.
- [ ] Add `src` to `sys.path` in non-pytest entrypoints (the bin shim, any
      `python3 src/scripts/X.py` direct runs) — audit `scripts/_lib/*` self-path inserts.
- [ ] Rewrite the 28 workflow/taskfile invocations + 6 resolvers + 22 TS refs +
      `package.json files[]`.
- [ ] Gates: `task ci-fast`, full pytest (`importlib`), `npm run build` + vitest,
      `validate_discovery_manifest`, `lint_marketplace`, condensation hashes,
      **and `smoke-public-install` locally on a packed tarball** (the Windows
      hazard surface — verify the tarball has no symlink + resolves).
- [ ] **HUMAN VERIFY:** `rg "(\.\./)*scripts/" .github taskfiles src docs` returns
      only intended hits; `python3 -c "import scripts.condense"` works; a packed
      `npm pack` tarball lists `src/scripts/` not `scripts/`.

### Phase 16b — config / schemas / templates → `src/`
- [ ] Move each, update `package.json files[]`, the discovery vocab loader
      (`build_discovery_manifest.py` `VOCAB_DIR`), schema `$ref`/`$id` paths,
      `scripts/schemas/` consumers.
- [ ] Gates as above + `lint_discovery_vocabulary`, `validate_pack_yaml`.

### Phase 16c — docs / internal / hooks / maintainer `agents/` (HIGH-RISK — 386 cross-refs)
- [ ] **Defer-candidate.** Moving `docs/` rewrites ~386 markdown cross-refs AND
      the source-root resolvers AND the reference-checker's real-path resolution.
      Recommend a SEPARATE attended sub-PR; do NOT bundle with 16a/16b.
- [ ] If attempted: scripted relative-link rewrite + `check_references.py` green
      + `check_no_roadmap_refs.py` + every doc-citing rule/skill re-verified.

### Phase 16d — `taskfiles/` thin root
- [ ] Already folded (taskfiles/ folder + thin root `Taskfile.yml`). Confirm only.

### Step 17 — install contract (after 16a–16c land)
- [ ] `package.json` `files`/`bin`/prepack → `src/` paths.
- [ ] `scripts/install.py` (now `src/scripts/install.py`) target/source paths.
- [ ] discovery + MCP manifest paths (`dist/discovery`, `dist/mcp`).
- [ ] Gate: `smoke-public-install` (all three OSes) on a packed tarball.

### Step 18 — `migrate` command (after the structure is final)
- [ ] `agent-config migrate` with `--dry-run`, `--from 4|5`, `--check`.
- [ ] Detect a 4.x/5.x install, rewrite to the 6.0 layout (incl. the `replaces:`
      alias map from ADR-044 A5/A8 — old colon/command invocations → new slugs).
- [ ] `MIGRATION.md` (4→6, 5→6), linked from README; README hero drops artefact
      counts → "choose your workflow, add packs, focused commands".

### Step 19 — CI-path audit (after the move)
- [ ] Every workflow + taskfile + script path resolves to the new tree.
- [ ] `task ci` green end-to-end on the restructured repo.
- [ ] **Re-tune `scripts/smoke/schema.sh`**: once `skill_linter` scans the moved
      tree (or commands are added to its scope), restore the floor; this PR
      lowered it to 325 for the Step-10 command move (see commit `8fe531d2`).

### Step 19b — consumer model-tier auto-switch (independent-ish; release gate)
- [ ] Diagnose: `agent-config install` against a test consumer with
      `model.auto_switch: auto` — confirm the install/generate stage applies the
      tier→`model:` mapping (reads the consumer's `auto_switch`), not raw copy.
- [ ] Fix if real: route consumer Claude-tree generation through the condense
      tier→model mapping (`condense.py _TIER_TO_CLAUDE_MODEL`).
- [ ] Verify: `grep -rl '^model_tier:' ~/.claude/skills/ | wc -l` → 0;
      `grep -L '^model:' ~/.claude/skills/*/SKILL.md` → only `inherit`-tier.
- [ ] **Release gate:** 6.0.0 does not ship until this passes.

## Sequencing verdict (council round 1 + locked decision)
One isolated PR, atomic commits, this order: **16a → 16b → (16c deferred sub-PR)
→ 17 → 18 → 19 → 19b**. Each commit verified green before the next. Shim removal
(if any path needs it) is human-verified, never blind. 16c (docs move) is the
single highest-risk sub-step — strongly consider its own attended sub-PR.

## Prerequisites before the attended run
1. Top up Anthropic API credits (council currently gpt-4o-only).
2. Confirm PR #362 (Steps 12–15) is merged or rebased in, so the command-naming
   surface is settled before the tree move (avoids `scripts/` edit conflicts).
3. Operator present for the Hard-Floor confirmations + the HUMAN-VERIFY gates above.
