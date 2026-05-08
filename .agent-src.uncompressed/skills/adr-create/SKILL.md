---
name: adr-create
description: "Use when capturing an architectural decision — naming the file, picking the next ADR number, filling Status / Context / Decision / Consequences, and regenerating the index — even without saying 'ADR'."
source: package
execution:
  type: assisted
  handler: shell
  timeout_seconds: 30
  allowed_tools: []
  command:
    - python3
    - scripts/adr/regenerate_index.py
---

# adr-create

## When to use

Use this skill when:

- A non-trivial architectural choice needs a written record (kernel
  membership, cap raises, contract changes, library swap, deprecation).
- A decision overrides a previous one and needs `supersedes:` linkage.
- A roadmap phase closes and the chosen variant must be cited.
- The user says "write an ADR for X", "decision log this", "we need
  a record of why we picked Y".

Do NOT use when:

- The change is reversible without governance impact (typo, lint
  fix, refactor that stays inside one module).
- The decision is already covered by an existing ADR — extend or
  supersede it instead of duplicating.
- A skill, rule, or guideline is the better home (use those skills).

## Goal

- Sequential `ADR-NNN-<slug>.md` numbering with no gaps.
- Standard template: Status, Context, Decision, Consequences,
  Alternatives, References.
- Regenerated index so readers find the ADR by topic, not by ls.
- Zero MCP-tool dependency — pure filesystem + Python.

## Preconditions

- An ADR directory exists (default `docs/adr/`; `docs/decisions/` is
  the recognised alias used in this package and many older projects).
- The decision is **already made** — ADRs record outcomes, they do
  not run the decision process. For unresolved trade-offs, run the
  council or consult `adversarial-review` first.

## Procedure

### 1. Inspect and resolve the ADR directory

Identify the canonical directory in this order:

1. `docs/adr/` — default per spec.
2. `docs/decisions/` — accepted alias if `docs/adr/` is missing.
3. Anything else — fail, ask the user to pick one of the two
   canonical paths. Do not invent a third location.

### 2. Pick the next ADR number

Scan the directory for `ADR-*.md`, parse the leading 3-digit number,
take `max + 1` (zero-padded). For an empty directory, start at `001`.
Reject re-use of an existing number — the index regenerator treats
duplicates as a hard failure.

### 3. Pick a slug

Short, hyphen-lowercase, scope-revealing. Match peer ADRs in the
directory. Examples: `kernel-swap-deferred`, `flat-cluster-subs`,
`http-bridge-deferred-with-trigger`. Reject slugs longer than 60 chars.

### 4. Author the ADR

Use the standard template (frontmatter + body). All sections are
required; "n/a" is acceptable for genuinely empty Alternatives or
References blocks but never for Status, Context, Decision, or
Consequences.

```markdown
---
adr: NNN
status: proposed | accepted | superseded | deprecated
date: YYYY-MM-DD
decision: <slug>
supersedes: — | ADR-MMM
superseded_by: — | ADR-MMM
phase: <roadmap> · <phase-id>
---

# ADR-NNN — <Decision Title>

## Status

**<Proposed | Accepted | …>** · YYYY-MM-DD.

## Context

What problem forced this decision? What constraints applied? What
alternatives were on the table at decision time?

## Decision

The chosen variant, in one paragraph. Concrete enough that a reader
six months later knows what was actually picked.

## Consequences

### Accepted

- Hard guarantees we now make.

### Trade-offs

- What we gave up. Mitigations, if any.

## Alternatives considered

- **Variant X — <name>.** Rejected because <reason>.
- **Variant Y — <name>.** Rejected because <reason>.

## References

- Linked roadmap, contract, prior ADR, council session id.
```

### 5. Regenerate the index

Run the dispatcher:

```bash
python3 scripts/runtime_dispatcher.py run --skill adr-create
# or directly:
python3 scripts/adr/regenerate_index.py --dir docs/adr/
```

The script scans `ADR-*.md`, reads frontmatter (`adr`, `status`,
`date`, `decision`, `supersedes`), and writes `INDEX.md` with one
table row per ADR plus broken-supersede warnings on stderr.

### 6. Validate

- `python3 scripts/adr/regenerate_index.py --check` exits 0
  (index is up to date, no number gaps, no broken supersedes).
- The project's CI / quality pipeline passes locally.

## Output format

1. Path of the new `ADR-NNN-<slug>.md` file.
2. Path of the regenerated `INDEX.md`.
3. One-line summary of the decision.
4. Linked roadmap or phase, if any.

## Gotchas

- `docs/adr/` is the default path; some projects use
  `docs/decisions/` (this package included). Pass `--dir` to the
  index regenerator when running outside the default.
- Frontmatter `adr:` is the canonical number; the filename prefix
  must match. The index regenerator fails on mismatch.
- ADRs are append-only history. To revise a decision, write a new
  ADR with `supersedes: ADR-MMM` and flip the old one's status to
  `superseded`.
- Never delete an ADR file — supersede it. Deletion breaks
  historical links and round-trips through git history checks.

## Frugality Standards

Apply the [Frugality Charter](../../contexts/contracts/frugality-charter.md)
to every ADR you author.

**Examples in this artifact:**
- Per the charter's default-terse rule, `## Context` states the
  forcing function in 2–3 sentences; no historical narrative.
- Per the cite-don't-restate principle, `## Decision` links the
  rules / contracts it overrides; no rule body is quoted in full.
- Per the cheap-question check, `## Alternatives considered` lists
  genuine design alternatives, not strawmen.

**Pre-save self-check:**
1. Does `## Context` carry more than 5 sentences of setup?
2. Does `## Decision` restate rule text instead of citing the rule?
3. Are alternatives evaluated with a real consequence each, or with
   stylistic preference?
4. Does the ADR forecast consequences with hedge phrases ("might",
   "could potentially") instead of decidable claims?

## Do NOT

- Skip Context — a decision without context is folklore.
- Reuse an existing ADR number — the index regenerator hard-fails.
- Author ADRs for reversible refactors or minor cleanups.
- Cite a council session id without ensuring the file is committed
  or otherwise reachable from the repo (per `no-council-references`).
