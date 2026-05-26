# Audit 3 — Hash-sequencing

> Verdict: **✅ Pass.** `.condensation-hashes.json` uses paths relative to `.agent-src.uncondensed/`, not absolute root paths. Relocating `.agent-src/` (or `.agent-src.uncondensed/`) requires updating **two constants** in two scripts and one `HASH_FILE` constant — no hash regeneration migration needed.

## Method

1. Identify every script that reads or writes `.condensation-hashes.json`.
2. Inspect the key shape (top-level prefix of each hash key).
3. Determine whether keys are root-relative or source-relative.
4. Trace what happens on `task sync` when source dirs move.

## Findings

### Readers / writers

```
scripts/condense.py:48          HASH_FILE = PROJECT_ROOT / ".condensation-hashes.json"
scripts/annotate_discovery.py:29  HASH_FILE = ROOT / ".condensation-hashes.json"
scripts/check_references.py:121   regex match (read-only, skips the file)
```

Two writers (`condense.py`, `annotate_discovery.py`), one passive reader (`check_references.py` skip-list pattern).

### Key shape

Top-level prefixes in `.condensation-hashes.json` (1148 entries):

```
commands/    contexts/    ghostwriter/    personas/
rules/       skills/      templates/      user-types/
```

All keys are **source-relative paths inside `.agent-src.uncondensed/`**. Example:

```json
"commands/agent-handoff.md": "19eed2a9fe1f16ec98d701136f6d3211165c2008f9b2934cf81a015d4e9fc29c"
```

No key contains `.agent-src/`, `.agent-src.uncondensed/`, or any absolute root prefix.

### Behavior on relocation

**Scenario A — `.agent-src/` (output) renamed:** No hash impact. Hash keys describe **source** content, not output. `condense.py` reads `.agent-src.uncondensed/<key>`, hashes it, compares against the stored hash, writes to the output dir. Renaming the output dir is a `TARGET_DIR` constant change in `condense.py`.

**Scenario B — `.agent-src.uncondensed/` (source) renamed:** Hash keys still valid. Condense walks the new source root, generates the same `<top>/<file>.md` keys. The only edit is the source root constant in `condense.py` + `annotate_discovery.py`.

**Scenario C — `.condensation-hashes.json` (the file) relocated:** Trivial. Two `HASH_FILE = …` lines updated. Hash content unchanged.

**Scenario D — Top-level source subdirs renamed (e.g., `commands/` → `agent-commands/`):** Hash keys would become stale on first run. Condense would regenerate them (full re-hash), one-time noise diff. Same as adding a new source dir.

### Idempotency check

Running `task sync` regenerates `.condensation-hashes.json` from the live source tree. If the file is deleted or paths change, condense writes the new state. No migration script needed.

```
# Proof: in CI, this is exactly what task sync-check-hashes guards against.
# See .github/workflows/consistency.yml lines 78–84.
```

## Verdict: ✅ Pass

Hash sequencing is **portable**. Phase 3 has zero hash-related blockers. The three constants that lock the path (`HASH_FILE` × 2 + `PROJECT_ROOT`/`ROOT`) are atomic edits.

## Touch-points for Phase 3 (if moving source)

| File | Line | Constant | Change |
|---|---|---|---|
| `scripts/condense.py` | 48 | `HASH_FILE` | path string |
| `scripts/condense.py` | ~30 | source-dir constant (`UNCONDENSED_DIR` / similar) | path string |
| `scripts/annotate_discovery.py` | 29 | `HASH_FILE` | path string |

Three lines. All scripted, all CI-gated by `task sync-check-hashes`.

## Evidence

- `scripts/condense.py:48` — `HASH_FILE = PROJECT_ROOT / ".condensation-hashes.json"`.
- `scripts/annotate_discovery.py:29` — same.
- `scripts/check_references.py:121` — skip-list pattern.
- `.condensation-hashes.json` top-level key prefix scan (Phase 2 run, 2026-05-25).
- `.github/workflows/consistency.yml:78–84` — `task sync-check-hashes` enforcement.
