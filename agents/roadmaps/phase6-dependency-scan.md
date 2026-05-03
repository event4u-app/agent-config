---
title: "Phase 6.0 — chat-history-* dependency surface scan"
roadmap: agents/roadmaps/road-to-structural-optimization.md
phase: 6.0
stability: beta
locked_at: 2026-05-03
status: closed
---

# Phase 6.0 — Dependency surface scan

Catches the "ghost reference" risk (R1, Round 2) before any
restructure decision. Enumerates every artefact that names
`chat-history-cadence`, `chat-history-ownership`, or
`chat-history-visibility` by file path or symbol, so
6.3 (consumer migration) starts from a complete list — even if 6.1
takes the < 30% branch and 6.2/6.3/6.4 are skipped.

**Method.** `grep -rl --include="*.md" "<rule-id>"` across
`.agent-src.uncompressed/`, `docs/`, `agents/`, with the rule's own
file excluded. Reproduce via:

```bash
for r in chat-history-cadence chat-history-ownership chat-history-visibility; do
  echo "=== $r ==="
  grep -rl --include="*.md" "$r" \
    .agent-src.uncompressed/ docs/ agents/ 2>/dev/null \
    | grep -v "rules/$r.md"
done
```

## Consumers — by classification

### Live rule references (would migrate on Path A)

| Consumer | Cites | Class |
|---|---|---|
| `.agent-src.uncompressed/rules/chat-history-cadence.md` | ownership, visibility | **sibling cross-ref** |
| `.agent-src.uncompressed/rules/chat-history-ownership.md` | cadence, visibility | **sibling cross-ref** |
| `.agent-src.uncompressed/rules/chat-history-visibility.md` | ownership, cadence | **sibling cross-ref** |
| `.agent-src.uncompressed/rules/direct-answers.md` | visibility (`📒` whitelist) | **rule-to-rule cite** |

### Live command references

| Consumer | Cites | Class |
|---|---|---|
| `.agent-src.uncompressed/commands/agent-handoff.md` | ownership | **command-to-rule cite** |
| `.agent-src.uncompressed/commands/chat-history-checkpoint.md` | ownership | **command-to-rule cite** |
| `.agent-src.uncompressed/commands/chat-history-clear.md` | ownership | **command-to-rule cite** |
| `.agent-src.uncompressed/commands/chat-history-resume.md` | ownership | **command-to-rule cite** |
| `.agent-src.uncompressed/commands/chat-history-show.md` | ownership | **command-to-rule cite** |

### Documentation references (contracts, catalog, getting-started)

| Consumer | Cites | Class |
|---|---|---|
| `docs/contracts/adr-chat-history-split.md` | all three | **ADR — split decision** |
| `docs/migrations/commands-1.15.0.md` | all three | **migration note** |
| `docs/catalog.md` | all three | **inventory** |
| `docs/getting-started.md` | ownership | **user docs** |

### Repo-internal artefacts (roadmaps, contexts, sessions)

| Consumer | Cites | Class |
|---|---|---|
| `agents/contexts/chat-history-handshake.md` | ownership | **context — gate-1 prompts** |
| `agents/contexts/structural/file-ownership-matrix.md` | all three | **Phase 0.1 matrix** |
| `agents/index.md` | all three | **index** |
| `agents/roadmaps/road-to-structural-optimization.md` | all three | **this roadmap** |
| `agents/roadmaps/phase6-2b-coupling.md` | all three | **Phase 0.3 proof** |
| `agents/roadmaps/archive/road-to-post-pr29-optimize.md` | cadence, visibility | **archived — read-only** |
| `agents/roadmaps/archive/road-to-governance-cleanup.md` | cadence, ownership, visibility | **archived — read-only** |
| `agents/roadmaps/examples/2A4-direct-answers/direct-answers-mechanics.md` | visibility | **Phase 0.4 worked example** |
| `agents/council-sessions/2026-05-03T06-52-20Z/{raw-text,response}.md` | ownership | **historical council** |
| `agents/council-sessions/2026-05-03T07-15-02Z/{raw-text,response}.md` | cadence, ownership | **historical council** |

## Migration target list — empty

Phase 6.1 took the **< 30% branch** (see
[`phase6-trigger-matrix.md`](phase6-trigger-matrix.md) and
[`phase6-non-overlap-evidence.md`](phase6-non-overlap-evidence.md)).
**No consumer above is a 6.3 migration target** — the three rules
keep their current file names and trigger surface; every cross-ref
above remains valid as-is.

The scan still ships because:

1. It is the audit evidence that **no consumer references were
   missed** (R1 ghost-reference risk closed).
2. It is the snapshot that the next person re-running the scan can
   diff against to detect new consumers.
3. The Phase-0.1 file-ownership matrix and the Phase-0.3 coupling
   proof both rely on the same enumeration; this file is the source
   they are kept in sync against.

## Reproducibility

The grep command at the top of this file is the canonical
reproduction. Re-run it before any future Phase-6 re-scope. If the
output diverges from the tables above, this file is stale — update
it before acting on the diff.
