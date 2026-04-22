# Road to Memory Merge Safety

**Problem.** Memory artefacts (learnings, signals, promoted entries) are
written by agents and humans across parallel branches. If two branches
touch the same file, `git merge` produces conflicts that either get
resolved wrong or block the merge entirely. This roadmap defines the
**no-conflict contract** every memory write path MUST follow so that
working with or without the `@event4u/agent-memory` companion package
never costs a developer five minutes of conflict archaeology.

## Scope

Applies to every memory surface owned or produced by this package:

- Repo-shared curated files from [`road-to-project-memory.md`](road-to-project-memory.md#repo-shared-curated-files)
- Agent-written intake files (local or committed)
- Promoted entries flowing through [`agent-memory/road-to-promotion-flow.md`](agent-memory/road-to-promotion-flow.md)
- Session learnings produced by skills like `learning-to-rule-or-skill`

## The rule

```
MEMORY WRITES MUST NEVER PRODUCE A SEMANTIC MERGE CONFLICT.
```

If two branches can write to the same file at the same byte range,
the format is wrong for that file.

## Curated vs. agent-written

Two trust classes, two mechanics.

| Class | Writer | Example files | Merge strategy |
|---|---|---|---|
| **Curated** | Human via PR | `ownership-map.yml`, `domain-invariants.yml`, `architecture-decisions.yml` | Normal `git merge`. PR review is the conflict surface; conflicts are expected and a reviewer resolves them. |
| **Agent-written** | Skill/command, possibly in CI | raw learnings, signals, quarantine entries, session-scoped observations | **MUST** use one of the no-conflict formats below. Never hand-merged. |

Curated files are few, change slowly, and see expert eyes — the conflict
cost is acceptable there. Agent-written files can gain dozens of entries
per week across branches and must merge without human attention.

## Agent-written without the package

Baseline: the package must be useful when nobody installs
`@event4u/agent-memory`. Storage is the filesystem, checked in. Format
is **append-only JSONL** with a union merge driver.

### Path convention

```
agents/memory/intake/
  learnings.jsonl
  signals.jsonl
  quarantine.jsonl
```

### Format

One JSON object per line. Keys are stable. `id` is a ULID or content
hash. `ts` is ISO-8601. New entries append; existing lines are
**immutable**.

```jsonl
{"id":"01H...","ts":"2026-04-21T10:30Z","type":"learning","source":"skill:judge","path":"app/Http","body":"…"}
```

### `.gitattributes`

```
agents/memory/intake/*.jsonl merge=union
```

With `merge=union`, git concats both sides on conflict instead of
failing. Duplicate IDs are deduplicated by the **reader**
(`scripts/memory_lookup.py`), never by an in-place edit.

### Correction semantics

Agents never edit a previously written entry. A correction is a **new
entry** with `type: "supersede"` and a `supersedes: "<id>"` field. The
reader applies the chain.

## Agent-written with the package

When `@event4u/agent-memory` is present, the operational store lives
**out of tree** (package cache / DB). Git sees nothing. Merge conflicts
are impossible by construction.

The package is responsible for:

- Not mirroring its operational store inside the consumer repo
- Exporting stable IDs so promoted entries can be traced back
- Providing an MCP/CLI API the intake layer talks to

Agent-written repo files (the fallback above) remain the canonical path
when the package is missing or `memory_status.py` reports `absent` or
`misconfigured`.

## Promotion: content-addressed curated files

When a quarantine entry is promoted to a curated file, two routes are
possible.

### Route A — append to an existing curated file

Use only when the curated file is itself **JSONL** (not the current YAML
default for `ownership-map` etc.). Same `merge=union` rules apply.
Today this is **not** used for the six curated types because they are
hand-reviewed YAML.

### Route B — content-addressed drop-in

Each promoted entry becomes a **new file** under:

```
agents/memory/<type>/<hash>.yml
```

Filename = first 12 chars of sha256 of normalized content. Two parallel
promotions of the same payload produce the same filename and git sees
one file, not a conflict. Two different payloads produce different
filenames — no overlap possible. The curated reader globs the directory
and merges in memory. Human review happens on the PR that introduces
the file, same as any code change.

## File layout

```
agents/memory/
  intake/                       ← agent-written, merge=union JSONL
    learnings.jsonl
    signals.jsonl
    quarantine.jsonl
  ownership/                    ← curated, one file per entry
    <hash>.yml
  historical-patterns/<hash>.yml
  domain-invariants/<hash>.yml
  architecture-decisions/<hash>.yml
  incident-learnings/<hash>.yml
  product-rules/<hash>.yml
  schemas/<type>.schema.yml
.gitattributes                  ← declares merge=union for intake/
```

## `.gitattributes` recipe

Consumer projects install this block as part of `road-to-project-memory.md`
Phase 1. Shipped in the template `templates/agents/.gitattributes.fragment`.

```
# Agent memory — append-only JSONL, union-merged.
agents/memory/intake/*.jsonl merge=union eol=lf

# Curated memory — content-addressed drop-ins. One file per entry.
# Normal merge is fine; filename collisions are content-identity.
agents/memory/ownership/*.yml           text eol=lf
agents/memory/historical-patterns/*.yml text eol=lf
agents/memory/domain-invariants/*.yml   text eol=lf
agents/memory/architecture-decisions/*.yml text eol=lf
agents/memory/incident-learnings/*.yml  text eol=lf
agents/memory/product-rules/*.yml       text eol=lf
```

## Phases

### Phase 0 — contract + fixtures

- [x] This doc accepted as the canonical merge-safety reference *(2026-04-22: Phase 0 shipped — `.gitattributes.fragment`, append-only CI check, regression tests — this file is the contract)*
- [x] `templates/agents/.gitattributes.fragment` shipped *(2026-04-22)*
- [x] `scripts/check_memory.py` rejects in-place edits of existing JSONL
      lines (enforces append-only via git diff inspection) *(2026-04-22: [`scripts/check_memory.py --append-only`](../../scripts/check_memory.py) — parses unified-0 diff hunks vs `GITHUB_BASE_REF`/`origin/main`; any hunk removing/modifying existing bytes in `agents/memory/intake/*.jsonl` fails; 4 regression tests in `tests/test_check_memory.py`; template copy shipped in [`templates/scripts/check_memory.py`](../../.agent-src.uncompressed/templates/scripts/check_memory.py))*
- [x] Two-branch merge fixture under `tests/fixtures/memory-merge/` proves
      parallel intake writes merge clean *(2026-04-22: [`tests/fixtures/memory-merge/`](../../tests/fixtures/memory-merge/README.md) + [`tests/test_memory_merge_fixture.py`](../../tests/test_memory_merge_fixture.py) — real git repo, real `merge=union` driver, asserts no conflict markers and all append-set survival)*

### Phase 1 — intake path

- [x] `scripts/memory_lookup.py` reads intake JSONL with supersede-chain
      resolution and dedupe by `id` *(2026-04-22: [`scripts/memory_lookup.py`](../../scripts/memory_lookup.py) walks `agents/memory/intake/*.jsonl`, collects `supersede` records first, then excludes any id in the supersede set and deduplicates by most-recent `created` timestamp; [`tests/test_memory_lookup.py`](../../tests/test_memory_lookup.py) covers the chain + dedupe paths)*
- [x] `/propose-memory` appends; never rewrites *(2026-04-22: [`/propose-memory`](../../.agent-src.uncompressed/commands/propose-memory.md) shells out to `scripts/memory_signal.py` which opens the monthly file in `"a"` mode; no read-modify-write path exists; the `--append-only` CI gate catches any regression)*
- [x] CI check: fails if a PR modifies any line in
      `agents/memory/intake/*.jsonl` other than appending at EOF *(2026-04-22: [`scripts/check_memory.py --append-only`](../../scripts/check_memory.py) is already wired into Phase 0 above — same tool, same test coverage; consumer projects install the gate via [`memory-hygiene.yml`](../../.agent-src.uncompressed/templates/github-workflows/memory-hygiene.yml) workflow template)*

### Phase 2 — content-addressed promotion

- [x] `/memory-promote` writes `agents/memory/<type>/<hash>.yml` *(2026-04-22: [`/memory-promote` step 4](../../.agent-src.uncompressed/commands/memory-promote.md#4-write-the-curated-entry-content-addressed) — computes hash via `scripts/memory_hash.py`, writes one-entry-per-file, refuses if legacy single-file `agents/memory/<type>.yml` still exists)*
- [x] Hash = sha256 of canonical-JSON-serialized entry, first 12 hex chars *(2026-04-22: [`scripts/memory_hash.py`](../../scripts/memory_hash.py) — `canonical_json()` sorts keys, no whitespace; `hash_entry()` returns `sha256[:12]`; 6 tests in [`tests/test_memory_hash.py`](../../tests/test_memory_hash.py) prove key-order invariance and list-order sensitivity)*
- [x] Duplicate hash = exact duplicate → no-op (git sees unchanged file) *(2026-04-22: [`test_content_addressed_same_entry_converges`](../../tests/test_memory_merge_fixture.py) merges two branches writing identical content to the same hash-filename — merge succeeds, file is unchanged, filesystem has one file, no conflict markers)*
- [x] Schema validation before write (`scripts/check_memory.py`) *(2026-04-22: `/memory-promote` step 4 — mandatory `check_memory.py --path <hash>.yml` call; failure path deletes the file and aborts the promotion rather than committing an invalid entry)*
- [x] Two-branch merge fixture: same promotion on both branches results
      in one file, not two *(2026-04-22: [`tests/test_memory_merge_fixture.py`](../../tests/test_memory_merge_fixture.py) — two new test cases: identical entry → one file; different entries → two separate files; both verify zero conflict markers)*

### Phase 3 — package integration

- [x] `memory_status.py` wires backend selection *(2026-04-22: [`scripts/memory_status.py`](../../scripts/memory_status.py) already in place from `road-to-agent-memory-integration.md` Phase 0 — probes `agent-memory` CLI on PATH, caches `status() == present | absent`, returns `backend=file` fallback)*
- [x] When `present`, intake JSONL is still written (debug trail) unless
      `memory.intake.skip_when_present: true` is set *(2026-04-22: [`scripts/memory_signal.py`](../../scripts/memory_signal.py) now reads `.agent-settings.yml` → `memory.intake.skip_when_present` and only bypasses the JSONL write when both the backend is `present` AND the consumer opted out; default remains debug-trail-on; 4 new tests in [`tests/test_memory_signal.py`](../../tests/test_memory_signal.py) cover skip-true, skip-false, absent-backend, and missing-settings paths)*
- [x] Promoted files remain repo-side regardless of backend — the curated
      layer is always git *(2026-04-22: [`/memory-promote`](../../.agent-src.uncompressed/commands/memory-promote.md) always writes `agents/memory/<type>/<hash>.yml` with no backend branch — the operational package (when present) syncs FROM the git tree, not INTO it; `memory_report.py` and `memory_lookup.py` both hit the repo files as source of truth)*

## Acceptance criteria

- **Phase 0** ships when: template fragment installed by `install.sh`, CI
  fails a deliberately-broken fixture that rewrites a JSONL line,
  green on the parallel-append fixture.
- **Phase 1** ships when: two agents on two branches can each drop ten
  learnings, the branches merge into `main` with zero conflicts, and the
  reader returns all twenty entries deduplicated.
- **Phase 2** ships when: the same quarantine entry promoted on two
  branches converges to one file on merge; two different entries on two
  branches converge to two files; schema violation blocks the write.
- **Phase 3** ships when: toggling `@event4u/agent-memory` install state
  produces no conflicts in `agents/memory/` on subsequent merges.

## Open questions

- **Intake rotation.** When `learnings.jsonl` hits 10k lines, rotate to
  `learnings.<YYYYWW>.jsonl`? Who triggers it — the writer, a CI job, or
  the hygiene script? Defer to Phase 1; rotation is a reader concern, not
  a merge-safety concern.
- **Hash length.** 12 hex chars = 48 bits. Collision probability for
  <10k entries/type is negligible, but do we want 16 for future-proofing?
  Decide in Phase 2.
- **Curated YAML today.** The six curated types currently live as single
  YAML files (per `road-to-project-memory.md`). Do we migrate to
  content-addressed drop-ins, or keep them as human-merged curated files?
  Leaning **content-addressed**; the single-file layout is the primary
  merge-conflict source in practice. Decide in Phase 2 with migration
  plan.

## See also

- [`road-to-project-memory.md`](road-to-project-memory.md) — defines the
  curated file types and the settings layer this contract sits under
- [`road-to-agent-memory-integration.md`](road-to-agent-memory-integration.md) —
  detection + fallback path that switches between the backends covered here
- [`agent-memory/road-to-promotion-flow.md`](agent-memory/road-to-promotion-flow.md) —
  the promotion pipeline that lands entries into the content-addressed layout
- [`road-to-engineering-memory.md`](road-to-engineering-memory.md) — the
  six content types that flow through the mechanics above
