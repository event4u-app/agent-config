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

- [ ] This doc accepted as the canonical merge-safety reference
- [ ] `templates/agents/.gitattributes.fragment` shipped
- [ ] `scripts/check_memory.py` rejects in-place edits of existing JSONL
      lines (enforces append-only via git diff inspection)
- [ ] Two-branch merge fixture under `tests/fixtures/memory-merge/` proves
      parallel intake writes merge clean

### Phase 1 — intake path

- [ ] `scripts/memory_lookup.py` reads intake JSONL with supersede-chain
      resolution and dedupe by `id`
- [ ] `/propose-memory` appends; never rewrites
- [ ] CI check: fails if a PR modifies any line in
      `agents/memory/intake/*.jsonl` other than appending at EOF

### Phase 2 — content-addressed promotion

- [ ] `/memory-promote` writes `agents/memory/<type>/<hash>.yml`
- [ ] Hash = sha256 of canonical-JSON-serialized entry, first 12 hex chars
- [ ] Duplicate hash = exact duplicate → no-op (git sees unchanged file)
- [ ] Schema validation before write (`scripts/check_memory.py`)
- [ ] Two-branch merge fixture: same promotion on both branches results
      in one file, not two

### Phase 3 — package integration

- [ ] `memory_status.py` wires backend selection
- [ ] When `present`, intake JSONL is still written (debug trail) unless
      `memory.intake.skip_when_present: true` is set
- [ ] Promoted files remain repo-side regardless of backend — the curated
      layer is always git

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
