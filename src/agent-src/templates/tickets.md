# Ticket Template

Authoring template for ticket files stored in `agents/tickets/{roadmap-slug}/T-NNN-{slug}.md`.
One ticket = one Markdown build contract, consumed by `emit-tickets`, `lint_ticket_buildable.py`,
and `/implement-ticket`. Schema locked by ADR-101; full doctrine in
[`docs/contracts/ticket-bundle-format.md`](../../docs/contracts/ticket-bundle-format.md).

---

## Rules

1. **Required frontmatter fields:** `id`, `roadmap`, `phase`, `title`, `status`, `model_tier`,
   `acceptance`, `boundaries`. All others optional (see §3 of the format contract).
2. **Status:** `ready | draft | done` only. `done` after work lands + verification passes.
3. **`model_tier`** declares who may build (`lite | medium | high` per ADR-035). Choose
   conservatively — a failing `lite` auto-escalates to `medium`.
4. **`acceptance` must be runnable AND isolation-testable** — no prose-only criteria.
   Hard gate for `lite` tickets (enforced by `lint_ticket_buildable.py`).
5. **`boundaries` must be non-empty for `lite`.** At least one `must_touch` or `must_not_touch`.
6. **SHA-pin both ref lists.** `adr_refs` drift = HARD block; `source_refs` drift = WARN only.
   Pin with `git rev-parse HEAD:path/to/file`.
7. **`lite` size floor: ≤ 5 files AND ≤ 200 lines** — else split or escalate to `medium`.
8. **Body section order is fixed** (§4): Why → Context spine → Do → Do NOT touch →
   Acceptance → Quality gates → Assets. Never reorder or invent sections.
9. **Self-containedness:** any file the builder must read must appear in `source_refs` or
   `## Context spine`. Missing = incomplete ticket.
10. **Assets:** declared in frontmatter; `assets: none` when absent.
11. **Language:** English only.

---

## Template

Copy the structure below into a new file named `T-NNN-{slug}.md`:

~~~markdown
---
id: T-001
roadmap: road-to-xyz           # back-link slug (no .md extension)
phase: 1                       # roadmap phase number
title: "Short imperative title"
status: ready                  # ready | draft | done
model_tier: lite               # lite | medium | high (ADR-035)
estimate: 2                    # story points (optional)
priority: 2                    # 0–4, Linear-compatible (optional)
labels: [backend]              # optional
parent: null                   # T-000 or null at phase root
blocked_by: []                 # dependency edges, must be acyclic
adr_refs:
  - { path: docs/decisions/ADR-101-ticket-bundle-emission.md, sha: <git-blob-sha> }
source_refs:
  - { path: lint_ticket_buildable.py, sha: <git-blob-sha> }
assets: none                   # or: [T-001.assets/wireframe.png]
acceptance:
  - "python3 lint_ticket_buildable.py agents/tickets/x/ exits 0"
boundaries:
  must_touch:     [lint_ticket_buildable.py]
  may_touch:      [Taskfile.yml]
  must_not_touch: ["src/scripts/work_engine/**", ".github/**"]
---

## Why

{1–3 lines. State the outcome, not the backstory.}

## Context spine

{Exact paths the builder needs — no searching required. Include:}

- `lint_ticket_buildable.py:42` — the export entry point; extend `run()` here
- `agents/tickets/{slug}/manifest.yml` — the manifest this ticket reads
- `src/scripts/schemas/ticket-manifest.schema.json` — the schema to validate against

{Link the ADR if the builder must understand a constraint: [ADR-101](../../docs/decisions/ADR-101-ticket-bundle-emission.md)}

## Do

1. {First concrete, ordered step. Reference the exact file and line/function.}
2. {Next step.}
3. {Continue — mechanical steps only, no prose rationale.}

## Do NOT touch

- `src/scripts/work_engine/**` — boundary enforced by the work_engine guard
- `.github/**` — CI config is out of scope for this ticket
- {Any other file from `must_not_touch` in frontmatter — mirror it here verbatim}

## Acceptance

All criteria are in the frontmatter `acceptance` list. Reproduce them here for
inline reference:

- `python3 lint_ticket_buildable.py agents/tickets/x/ exits 0`
- {additional runnable check}

## Quality gates

```bash
python3 src/scripts/lint_ticket_buildable.py agents/tickets/road-to-xyz/
# Check project Taskfile.yml / Makefile for additional narrow checks
```

## Assets

{List assets declared in frontmatter, or write "No assets." if `assets: none`.}

- `T-001.assets/wireframe.png` — UI layout reference
~~~

---

## Tips

- **`## Context spine` is the most important section for `lite` tickets** — any path the
  builder must discover on their own is a missing entry.
- **Acceptance must be a shell command or test invocation**, not "verify manually".
- **Pin SHA values immediately** — stale `adr_refs` hard-block; stale `source_refs` warn only.
- **Split early.** A `lite` ticket that touches 6+ files is the wrong shape.
- **Mirror `boundaries` into `## Do NOT touch`** so constraints are visible inline.
- **`draft` hides the ticket from the tracker export** — flip to `ready` before exporting.
