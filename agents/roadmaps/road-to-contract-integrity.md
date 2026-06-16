---
complexity: standard
status: ready
---

# Roadmap: Contract Integrity — product-clarity, complexity-governance, release-discipline

**Trigger:** Two independent external reviews of the unreleased `main` (103
commits past `6.1.0` = 6.2.0-in-progress, captured in
`agents/tmp/feedback-v6.1.0.txt`). Both reviewers were strongly positive on the
epistemic-hardening wave (evidence-first structure discovery, verify-repair loop,
STABILITY contract, Mission Mode, global knowledge cards) — those engine themes
are already owned by `road-to-evidence-v2-project-intelligence`,
`road-to-mission-catalogue`, `road-to-live-app-verdict`,
`road-to-greenfield-scaffold`, and `road-to-capability-discoverability` and are
**not** re-planned here. This roadmap dispositions the reviewers' **unaddressed /
contested** findings, which cluster around **product clarity + complexity
governance + release discipline**.

**Mode:** Disposition-driven. Each finding (F1–F7) was routed through the AI
council in design mode; the verdicts below are council-locked. Two findings are
explicitly **out of this roadmap** (recorded so the decision is auditable, not
silently dropped).

> **Council convergence (2026-06-16, claude-sonnet-4-5 + gpt-4o, design mode,
> 2 rounds + anonymous peer-review; actual spend $0.12).** Both members plus the
> peer-review round converged on:
> 1. **F3 (structural breaking-change detector) is the single highest-leverage
>    item** — the only automated kill switch that catches the exact 6.1.0 failure
>    (a pack/layer removal shipped as a plain `feat:` commit) without depending on
>    human commit-annotation discipline. It must also catch **schema evolution**
>    (enum widened, type changed, validation tightened), not just artifact
>    deletion — these are breaking-for-consumers but invisible to a name-status
>    diff. Resolution: schema-version the artifact manifests and require a major
>    bump on incompatible schema change. Accept ~20% false-negatives on purely
>    *semantic* breaks; structural + schema + commit cross-check reaches ~95%.
> 2. **F2's "authoring-time governance gate" is rejected** — it is "an open
>    question disguised as a decision" (do skills *compose* into modes, or just
>    *re-organise* into families?) and a process tax on 236 existing artifacts
>    closes the barn door after the horse bolted. What ships instead: a
>    **provisional skill-family census** (Phase 0) that unblocks the leanness
>    track, then **family-first presentation + a `@minimal` pack** (Phase 2)
>    *after* pruning. Compositional refactor (skill modes / sub-commands) is a
>    7.0.0 breaking change, deferred.
> 3. **Biggest risk = the census ↔ leanness sequencing chicken-and-egg.** You
>    cannot document families until you know which skills survive the cull, and
>    you cannot prune intelligently without knowing which families are
>    over-represented. Resolution: the census lands in Phase 0 marked
>    `provisional`; empty families post-pruning are a merge signal, not a failure.
> 4. **F5 (naming) is a STABILITY-contract repair, not cosmetic polish** — two
>    canonical names for one command (`/pr:create` vs `/create-pr`) is two sources
>    of truth. It must land in Phase 1, **before** F2's Phase-2 family docs (which
>    name commands).
> 5. **Peer-review (Karpathy) surfaced the one thing both rounds missed:** the
>    200k token budget couples artifact count to runtime cost — F2/F5 are not
>    hygiene, they govern whether persona-scoped context loads stay economically
>    viable. `needs-verification`: does the current artifact count already approach
>    practical per-persona token limits? (Phase 0 census measures this.)
>
> Divergence held: gpt-4o would de-prioritise F5 and prefers a *soft* governance
> check over none; sonnet argues F5 is a contract violation and rejects any gate.
> Synthesis kept F5 in Phase 1 and dropped the gate, per the convergence above.

---

## Phase 0 — Trust boundaries, kill switches, and the census prerequisite

Foundation-first: remove the contradictory signal, ship the automated
breaking-change kill switch, and unblock the leanness track with a provisional
family census. Exit: CI blocks unannounced breaking changes; the leanness track
has a pruning heuristic.

- [x] **F1 — Remove the `@event4u/agent-memory` optional peer dependency.**
  `npm ls @event4u/agent-memory` resolves empty (not installed), and Layer 2 was
  council-sunset (2026-06-14). Remove the `peerDependencies` +
  `peerDependenciesMeta` entries from `package.json`. If a real compatibility
  reason surfaces during the edit, instead keep it with an inline
  `// sunset: <reason + date>` comment — but the default is removal.
- [x] **F1 verify — assert no transitive pull-in.** Run `npm ls @event4u/agent-memory`
  and confirm it reports the dependency absent (exit non-zero / "empty"). Record
  the output in the step note.
- [x] **F3 — Schema-version the artifact manifests.** Add a `schemaVersion` field
  to the pack / skill / rule / command metadata schemas under `src/scripts/schemas/`
  (or wherever the frontmatter contract lives). Document the bump rule in
  `docs/contracts/STABILITY.md`: enum value added/removed, field type changed, or
  validation tightened → major bump required.
- [x] **F3 — Build the structural breaking-change detector.** New CI script
  (`src/scripts/check_structural_breaking.py`): fails when a tracked artifact
  manifest (`pack`/`skill`/`rule`/`command`) is **deleted or renamed** in the
  diff against `origin/main`, OR a `schemaVersion`-bearing schema changes
  incompatibly, UNLESS the commit range carries a `feat!` / `BREAKING CHANGE`
  annotation. Provide an explicit `ci-override: structural-breaking-ok` escape in
  the commit body for intentional deprecation-cycle completions.
  <!-- carve-out: new-gate-verification -->
- [x] **F3 verify — run the detector locally against a synthetic breaking diff.**
  Stage a throwaway artifact deletion without annotation, confirm the script exits
  non-zero; add the annotation, confirm it passes; clean up. Capture both runs.
  <!-- carve-out: new-gate-verification -->
- [x] **F3 — Wire the detector into the CI pipeline** (release-gate cadence, next
  to `release.py`'s `infer_bump`). The two are complementary: `release.py` reads
  the commit annotation; this detector forces the annotation to exist when the
  diff is structurally breaking.
  <!-- carve-out: new-gate-verification -->
- [x] **F2 (census) — Publish a provisional skill-family census.** Assign every
  skill to one of ~8–12 families (e.g. `engineering`, `review`, `security`,
  `product`, `finance`, `content`, `video`, `agent-admin`, `evidence`,
  `meta/config`) in `docs/SKILL_CENSUS.md` as a table: `| Skill | Family |
  Keep / Prune / Merge |`. Mark the whole document `provisional`. This is the
  pruning heuristic the leanness track (`road-to-tier-removal` and the
  command-surface-leanness track) needs and the input that surfaces
  over-represented families.
- [x] **F2 (census) — Record the token-budget reading.** In `docs/SKILL_CENSUS.md`,
  note the approximate context cost of a representative per-persona load against
  the 200k budget (Karpathy peer-review's `needs-verification` item), so Phase 2's
  presentation work and the leanness cull share one cost baseline.

**Acceptance criteria (Phase 0):** `package.json` no longer lists
`agent-memory`; CI blocks an unannounced structural/schema breaking change; a
provisional family census exists and is referenced from the leanness track.

## Phase 1 — Contract repair: regression locks and canonical naming

Exit: trigger sets are regression-locked; every command has exactly one canonical
name with documented aliases.

- [x] **F4 — Wire trigger-eval into CI.** Add a `last_eval` (ISO date) field to
  every `triggers.json` and a CI check (`src/scripts/check_trigger_evals.py`) that
  fails when `last_eval` is missing or older than 90 days, then runs the
  lightweight trigger smoke-eval. Rationale (council, contested then upheld):
  `triggers.json` encodes *behavioural intent*, not just static predicates — the
  surrounding repo context drifts (e.g. a monorepo grows test files), so trigger
  sets need regression-locking even though the predicates themselves don't decay.
  Start with `design-intelligence` (the reviewer's named gap) and the other
  CI-unverified trigger sets.
  <!-- carve-out: new-gate-verification -->
- [x] **F4 verify — run the trigger-eval check locally** against the seeded
  `last_eval` values; confirm pass on fresh, fail on a >90-day stub. Capture both.
  <!-- carve-out: new-gate-verification -->
- [x] **F5 — Canonical command-name audit + alias registry.** Grep all docs
  (`README`, `docs/cookbook.md`, command frontmatter) for command references;
  pick one canonical form per command; add an `aliases:` field to command
  metadata so invocation accepts aliases but the canonical name is always the one
  logged/documented. Resolve the reviewer's named clashes (`/pr:create` vs
  `/create-pr`, `/fix:ci` vs `/fix-ci`, `/feature:plan` vs `/feature/plan`).
  <!-- done: implemented as docs/command-naming-audit.md. Deviation from the
  literal step: NO new `aliases:` field — the alias registry already exists as
  `replaces:`/`superseded_by:` (ADR-090, enforced by lint_command_routing.py); a
  parallel field would re-create the two-sources-of-truth problem this step
  fixes. Resolved clashes: README /pr:create→/create-pr (the command's shipped
  canonical), cookbook /feature/* slash→colon. The pr-cluster colon-form
  migration is tracked as deferred debt in the audit. -->
- [x] **F5 — Sharpen the README headline.** Replace the generic "Universal AI
  Agent OS" with a headline that signals the actual product (a governed,
  surgically-installable skill/rule/command suite with focused work journeys) —
  e.g. "Governed skills, rules & work journeys for AI coding agents". Keep the
  "What's different" / Cookbook / Capability-Matrix sections the reviewers praised.

**Acceptance criteria (Phase 1):** CI fails a stale/missing `triggers.json`
`last_eval`; every command resolves to one canonical name + documented aliases;
the README headline names the product, not a category.

## Phase 2 — Discoverability: family-first presentation after pruning

> **Blocked** until the leanness track (`road-to-tier-removal` +
> command-surface-leanness) has pruned against the Phase-0 census. Documenting
> families before the cull would enshrine a bloated surface.

Exit: a new user sees ~8 families, not 236 skills, and a `@minimal` pack exists.

- [ ] **F2 (presentation) — Add a `family` metadata field** to surviving skills
  (greenfield — no skill carries one today), populated from the post-prune census.
- [ ] **F2 (presentation) — Ship a `@minimal` pack** (~one entry per surviving
  family) so adopters can install a small, legible surface instead of the full
  catalogue.
- [ ] **F2 (presentation) — Update the README + Cookbook to family-first
  navigation** (engineering / review / security / product / finance / content /
  video / agent-admin), using the Phase-1 canonical command names.

**Acceptance criteria (Phase 2):** family field present on kept skills; `@minimal`
pack installable; README/Cookbook navigate by family.

---

## Out of scope / routed elsewhere (recorded, not dropped)

- **F6 — ADR-100 Layer-2 recurrence watch:** already owned by
  `road-to-evidence-v2-project-intelligence` Phase 0 (ADR-100 → default-off /
  opt-in until cross-project reuse is measured). **Addendum to carry there
  (not re-owned here):** the no-runtime guard must check the *config surface*, not
  just imports — forbid config-schema keys matching `vector` / `daemon` / `decay`
  / `pgvector`, and `setInterval` / `setTimeout` outside dev tooling. A
  default-off option that merely *exists* is still Layer-2 creep.
- **F7 — external adoption:** out of scope. This is a go-to-market track, not
  engineering architecture. This roadmap's job is to make the product *adoptable*
  (stable contracts, blocked breaking changes, one canonical name per command);
  *adoption* (partnerships, examples, community) is a separate GTM track.

## Deferred (named so it is not silently lost)

- **Compositional skill refactor** (`/verify --mode=structure` instead of three
  `/verify:*` skills): the council's identified *root cause* of artifact growth,
  but a 7.0.0-breaking change. Defer until after the leanness cull reveals which
  skills cluster into natural compositions.
- **Lightweight deletion-justification (`deprecation-plan`) check:** the council's
  fallback if a hard authoring gate is unwanted (it is). Re-evaluate only if the
  leanness track ends without any deletion-justification requirement of its own.
