---
stability: stable
---


# Context-Spine Contract

> **Status:** active · **Stability:** stable · **Owner:** unified-senior-roles Block K1
> · **Lint gate:** `task lint-skills` (frontmatter shape only — slot semantics are author-side)

Senior skills repeatedly need three slabs of context that the user
already supplied earlier in the project: **what the product is**,
**who the team is**, **what the repo looks like**. The context-spine
mechanic captures those slabs once per project and lets every senior
skill cite the slot it needs — without re-asking the user, without
re-reading the manifest tree on every entry.

## § 1 — Purpose

Three failure modes the spine prevents:

1. **Repeat-the-context tax** — every senior skill restates "what is
   this project / what does the team do / where does the code live"
   to the user. The spine factors that into shared slots.
2. **Implicit-read drift** — a skill silently reads `composer.json` /
   `README.md` / `package.json` to infer context, gets stale
   information, and bakes it into the artifact. Spine reads are
   **opt-in via frontmatter**, never implicit.
3. **Cross-role bikeshed** — Wave-2 personas (Block N) and Wing-3 / 4
   senior skills argue over whose context-doc is canonical. The spine
   names three slots and freezes the count.

## § 2 — Slot definitions

The spine has **three cross-wing slots** plus **per-wing extension
slots** authorized via ADR. Council Q1 verdict (2026-05-05, KEEP-3)
locks the cross-wing slot count at 3. Per-wing extensions follow § 5.

### Cross-wing slots (locked at 3)

| Slot | Path under `agents/context-spine/` | Owner | Typical content |
|---|---|---|---|
| `product` | `product.md` | Product / discovery wing | What the product **is**, who it serves, the problem it solves, the JTBD framing, the bounded scope. Read by Block-L senior PO / discovery skills. |
| `team` | `team.md` | RevOps / maintainer wing | Who **maintains** this codebase, how decisions are made, review-routing conventions, cadence (release rhythm, planning ritual). Read by review-routing, finishing-a-development-branch, persona overrides. |
| `repo` | `repo.md` | Engineering wing | What the codebase **is** at the file-tree level: stack one-liner, primary languages, top-level module map, deploy target. Read by analysis skills, blast-radius-analyzer, project-analysis-* skills. |

### Wing-3 slots (GTM and Growth — added 2026-05-13 per [`adr-gtm-context-spine.md`](adr-gtm-context-spine.md))

| Slot | Path under `agents/context-spine/` | Owner | Typical content |
|---|---|---|---|
| `channel-stage` | `channel-stage.md` | GTM / Marketing wing | Which channels the GTM motion uses (awareness · consideration · decision · retention · expansion), per-channel maturity, channel-cost band. Read by `positioning-strategy`, `messaging-architecture`, `gtm-launch`, `editorial-calendar`. |
| `funnel-stage` | `funnel-stage.md` | Growth / RevOps wing | Funnel topology (top / mid / bottom / activation / retention), per-stage definition, exit-criteria for each. Read by `pipeline-strategy`, `funnel-analysis`, `activation-design`, `onboarding-design`. |
| `customer-segment` | `customer-segment.md` | Sales / CS wing | ICP, persona-by-segment, ARR-band-by-segment. Read by `ICP`, `pipeline-strategy`, `MEDDIC`, `retention-loops`. |

### Wing-4 slots (Money / Strategy / Ops — added 2026-05-13 per [`adr-wing4-context-spine.md`](adr-wing4-context-spine.md))

| Slot | Path under `agents/context-spine/` | Owner | Typical content |
|---|---|---|---|
| `fiscal-period` | `fiscal-period.md` | Finance wing | Reporting cadence (monthly · quarterly · annual · multi-year-plan), fiscal-year start, close-window timing. Read by `unit-economics`, `forecasting`, `runway-cognition`, `scenario-modeling`. |
| `org-stage` | `org-stage.md` | Strategy / People wing | Stage label (seed · series-A · series-B · growth · public), funding posture, headcount band, governance posture. Read by `build-buy-partner`, `vision-articulation`, `org-design`, `comp-banding`, `hiring-loop-design`. |
| `regulatory-regime` | `regulatory-regime.md` | Strategy wing (legal-absorbed) | Active regimes (none · GDPR · HIPAA · SOC2 · PCI · CCPA), data-residency posture, breach-notification timer. Read by `contracts-cognition`, `privacy-review`, `data-handling-judgment`. |

Slots are markdown files. Each is **≤ 200 lines**; longer means the
slot is doing two jobs and the author should split or trim. Empty /
missing slot is allowed — the citing skill MUST handle absence
gracefully and fall back to its existing read paths.

## § 3 — Frontmatter opt-in

A senior skill declares which slots it reads via the `context_spine`
frontmatter array:

```yaml
---
name: customer-research
tier: senior
context_spine: [product, team]
...
---
```

Rules:

- The key is **optional**. Senior skills MAY ship without it; the
  default (`[]`) means the skill does not read the spine.
- Values are restricted to the slot names in § 2: cross-wing
  (`product`, `team`, `repo`) plus wing-scoped extensions
  (`channel-stage`, `funnel-stage`, `customer-segment`). Unknown
  values fail `task lint-skills` with `unknown_context_spine_slot`.
- Reads MUST be opt-in and explicit. A skill body that says *"reads
  `agents/context-spine/product.md` if present"* without declaring
  the slot in frontmatter is **incorrect** — it bypasses the lint
  gate and the user's expectation that the spine read is visible.
- The frontmatter value is the **contract**. The skill body cites
  `agents/context-spine/<slot>.md` once near the top and lets the
  reader follow the link if they care.

## § 4 — No implicit reads

The spine is a **discipline**, not a runtime. There is no Python
loader that injects spine content into a skill's prompt. The agent
loading a senior skill reads the skill body, sees the
`context_spine: [...]` declaration, and — if the slot files exist
— quotes them inline before executing the skill's procedure. The
skill body MUST NOT state a behavior that depends on the spine being
read; absence is recoverable, presence is a bonus.

This keeps the spine cheap (no orchestration plumbing), explicit
(every read is in frontmatter), and reversible (deleting the slot
file does not break the skill).

## § 5 — Slot-add policy

Two tracks: **cross-wing** (locked at 3, citations-first) and
**wing-scoped** (per-wing ADR, citations prospective).

### Cross-wing track — citations-first

Adding a fourth **cross-wing** slot (one every wing might read) is
**structurally allowed but procedurally expensive**. Two preconditions:

1. **Citation evidence.** ≥ 2 shipped senior skills declare the new
   slot in their frontmatter and cite it in the body, with PRs
   merged to `main`. Drafts and roadmap items do not count.
2. **ADR.** A new ADR under `docs/contracts/` named
   `adr-context-spine-slot-<name>.md` documents the cognition gap
   the existing three slots cannot fill, the slot's owner wing, and
   the migration plan for the existing senior catalog (do they
   declare the new slot, do they ignore it, do they get retrofitted).

### Wing-scoped track — per-wing ADR, prospective citations

A wing may add **its own slots** for cognition specific to that wing
(e.g. Wing-3 `channel-stage`, `funnel-stage`, `customer-segment`).
Preconditions:

1. **Per-wing ADR.** One ADR under `docs/contracts/` named
   `adr-<wing>-context-spine.md` names the slots, the cognition gap,
   the citing-skill chain in the same iteration, and the off-wing
   migration plan (off-wing skills do **not** retrofit).
2. **Prospective citations.** The ADR-naming iteration must ship
   ≥ 2 skills citing each new slot before the iteration closes.
   Drafts and roadmap items inside the same iteration **do** count
   for prospective gating; cross-iteration citations do not.

Existing wing-3 reference: [`adr-gtm-context-spine.md`](adr-gtm-context-spine.md).

### Schema and changelog rules — both tracks

The ADR ships with the schema bump (`scripts/schemas/skill.schema.json`
extends the `context_spine` enum) and a CHANGELOG entry under
`### Breaking` if the new enum value tightens an existing skill's
declaration.

This policy mitigates the slot-sprawl failure mode: "cross-wing
locked at 3 + wing-scoped via per-wing ADR" is the brake. ADRs are
the single growth lever; no consumer-side override exists.

## § 6 — Author checklist

Before shipping a senior skill that opts into the spine:

- [ ] Frontmatter declares `context_spine:` with values from the
      cross-wing slots (`product`, `team`, `repo`) and/or wing-scoped
      slots authorized via per-wing ADR (e.g. Wing-3:
      `channel-stage`, `funnel-stage`, `customer-segment`).
- [ ] Skill body cites `agents/context-spine/<slot>.md` near the top
      (one link per declared slot).
- [ ] Procedure handles missing-slot gracefully — falls back to the
      skill's existing read path, never errors out.
- [ ] `task lint-skills` passes with no `unknown_context_spine_slot`.

## See also

- `.agent-src.uncompressed/rules/skill-quality.md` § Senior-Tier
  Required Structure — the four blocks every `tier: senior` skill
  ships independently of spine opt-in.
- `docs/contracts/cross-wing-handoff.md` — typed handoffs between
  senior skills; orthogonal to the spine (composition vs context).
