---
name: adr-create
description: "Use when capturing an architectural decision — naming the file, picking the next ADR number, filling Status / Context / Decision / Consequences, and regenerating the index — even without saying 'ADR'."
source: package
domain: process
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

- An ADR directory exists. Two layouts coexist (see
  [`docs/contracts/adr-layout.md`](../../../docs/contracts/adr-layout.md)):
  - **Flat** — `docs/decisions/` (or `docs/adr/` alias): cross-cutting
    governance ADRs, 3-digit numbering (`ADR-NNN-<slug>.md`).
  - **Per-area** — `docs/adrs/<area>/`: sub-area ADRs, 4-digit
    numbering (`NNNN-<slug>.md`); `<area>` must match the canonical
    inventory in [`scripts/audit_adr_coverage.py`](../../../scripts/audit_adr_coverage.py).
- The decision is **already made** — ADRs record outcomes, they do
  not run the decision process. For unresolved trade-offs, run the
  council or consult `adversarial-review` first.

## Procedure

### 1. Inspect and pick the surface

Ask one question only if both are plausible:

1. **Flat surface** — chosen when the decision constrains the
   package's contract with consumers (kernel composition, rule
   taxonomy, package-wide architecture). Directory: `docs/decisions/`
   (fallback `docs/adr/`). Filename: `ADR-NNN-<slug>.md`.
2. **Per-area surface** — chosen when the decision constrains code
   inside one area folder (one runtime module, one contract group,
   one CLI surface). Directory: `docs/adrs/<area>/`. Filename:
   `NNNN-<slug>.md` (4-digit, no `ADR-` prefix).
3. **Unknown area** — `<area>` not in the inventory: refuse with a
   hint to add the area to `AREAS` in
   `scripts/audit_adr_coverage.py` in the same PR. Do not invent.
4. **In doubt** → per-area (cheaper to surface, easier to relocate).

### 2. Pick the next ADR number

- **Flat surface** — scan `docs/decisions/` (or `docs/adr/`) for
  `ADR-*.md`, parse the leading 3-digit number, take `max + 1`
  (zero-padded to 3). For an empty directory, start at `001`.
- **Per-area surface** — scan `docs/adrs/<area>/` for
  `[0-9][0-9][0-9][0-9]-*.md`, parse the leading 4-digit number,
  take `max + 1` (zero-padded to 4). For an empty area, start at
  `0001`. `README.md` is **not** an ADR — skip it.

Reject re-use of an existing number — index regeneration treats
duplicates as a hard failure on both surfaces.

### 3. Pick a slug

Short, hyphen-lowercase, scope-revealing. Match peer ADRs in the
directory. Examples: `kernel-swap-deferred`, `flat-cluster-subs`,
`http-bridge-deferred-with-trigger`,
`per-tier-smoke-scripts`. Reject slugs longer than 60 chars.

### 4. Author the ADR

Use the surface-specific template. All sections are required; "—"
is acceptable for genuinely empty Alternatives or References blocks
but never for Status, Context, Decision, or Consequences.

**Flat-surface template** (`docs/decisions/ADR-NNN-<slug>.md`):

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

## Context / Decision / Consequences / Alternatives / References
```

**Per-area template** (`docs/adrs/<area>/NNNN-<slug>.md`):

```markdown
# ADR NNNN — <Decision Title>

> Area: `<area>` · Status: accepted · Date: YYYY-MM-DD · Type: retrospective | new
> Roadmap: `agents/roadmaps/<file>.md` <phase-id>
> Supersedes: —

## Context / Decision / Considered alternatives / Consequences / References
```

Per-area ADRs use a quote-style header (no YAML frontmatter) so
`audit_adr_coverage.py`'s permissive parser can index them. Cite
the area's contract from the README in
[`docs/adrs/<area>/README.md`](../../../docs/adrs/).

### 5. Regenerate the index

- **Flat surface** — `python3 scripts/adr/regenerate_index.py
  --dir docs/decisions/` writes `INDEX.md` from `ADR-*.md`.
- **Per-area surface** — `python3 scripts/audit_adr_coverage.py
  --regen-area-readme <area>` rewrites `docs/adrs/<area>/README.md`.
  Coverage gate: run `python3 scripts/audit_adr_coverage.py` (no
  args) — exit 0 only when every canonical area has ≥ 1 ADR.

### 6. Validate

- Flat: `python3 scripts/adr/regenerate_index.py --check` exits 0.
- Per-area: `python3 scripts/audit_adr_coverage.py --check` exits 0.
- The project's CI / quality pipeline passes locally.

## Output format

1. Path of the new ADR file.
2. Path of the regenerated index / README.
3. One-line summary of the decision.
4. Linked roadmap or phase, if any.

## Gotchas

- **Flat default path** is `docs/decisions/` in this package; some
  projects use `docs/adr/`. Pass `--dir` when running outside the
  default.
- **Per-area numbering is 4-digit** (`NNNN-<slug>.md`); the flat
  surface stays 3-digit (`ADR-NNN-<slug>.md`). Do not mix.
- **Area inventory is closed** — `<area>` must already exist in
  `AREAS` in `scripts/audit_adr_coverage.py`. Adding a new area is
  a separate PR with explicit reviewer sign-off.
- Frontmatter `adr:` (flat) is the canonical number; the filename
  prefix must match. The flat regenerator fails on mismatch.
- ADRs are append-only history. To revise a decision, write a new
  ADR with `supersedes: ADR-MMM` (flat) or a `Supersedes:` line in
  the header quote-block (per-area) and flip the old one's status
  to `superseded`.
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
  or otherwise reachable from the repo (per `no-roadmap-references`,
  council clause).
