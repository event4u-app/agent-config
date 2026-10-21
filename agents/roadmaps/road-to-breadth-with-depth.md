---
complexity: structural
status: ready
release_gate: next
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-v carries an owner product directive (2026-10-21) that no active roadmap owns: breadth AND depth are both goals, and the limit is what a task loads and what a gate cannot keep true, never what the package contains. Verified at 5200f6bdf: the orientation contract states the opposite (docs/contracts/package-self-orientation.md:16), and the limiters tabulated under Context cap content rather than per-task cost. No archive or park candidate covers this subject; road-to-an-installed-layer-that-is-thinned owns resident size, not what may exist. The owner asked for it to land before the next release, so parking is not available."
estate_growth_exempt: "+3 open_blockers, added in this change: adr-211-c-register-gap-anchor, rich-ratio-and-persona-cap, subsystem-stages-under-adr-133-and-124. The charter reopens council-routable records; the decision-revisit gate requires each reopen to be routed rather than taken, and the AI council (2026-10-21, two seats) asked for one verdict per record instead of a bundled vote. Every other phase runs."
relates:
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: disjoint
    note: "Owns thinning the installed rule layer and its owner-gated default. They interact through measurement only: Phase 3 here changes which surface the payload gate charges, so a thinned layer reads cheaper once 3.2 lands. No step here touches that roadmap's default or its steps."
  - slug: road-to-a-setup-that-decides-itself
    relation: disjoint
    note: "Carries the owner directive of 2026-10-12: no new lean/projection settings. No step here adds a settings key; the release hold (0.6) is roadmap frontmatter read by release preflight."
  - slug: road-to-a-release-that-says-whether-it-needs-you
    relation: disjoint
    note: "Also edits src/scripts/release.ts. Step 0.6 adds one preflight check and lands after, or rebased onto, that roadmap's open release.ts change; it does not re-plan its release decision output."
  - slug: road-to-a-step-that-costs-what-it-changes
    relation: disjoint
    note: "Owns per-step ceremony depth. The supplied plan's workflow-contract and checkpoint items are routed there or declined (D6)."
  - slug: road-to-agent-throughput-recovery
    relation: disjoint
    note: "Owns throughput and CI wait. The supplied plan's P0 throughput items are owned there (D6)."
---
# Road to breadth with depth

> **Source:** round `inbox-2026-10-v` (kept in the owner's inbox by instruction) —
> one owner chat of seven turns on 2026-10-21 and two externally drafted plans
> from that chat, both reading this package at `main@3d3a3576f` and an external
> agent-first media-production tree. Re-verified at `main@5200f6bdf` on
> 2026-10-21 in three loops: four independent tree reads (limiter census,
> payload mechanics, domain inventory, claim check), one independent
> adversarial review of draft 1, and a two-seat AI council round on draft 2.
> The owner scoped this run to the breadth-and-depth clarification and its
> consequences; the rest of the supplied plans is dispositioned under Decisions.

## The owner directive (2026-10-21), recorded as stated

Turn 2:

> AC should be able to do as much as possible, so that nobody needs a thousand
> packages. AC offers everything and optimises through ideal linkage. Another
> package can always be installed and AC should then use it — but AC itself is
> set up as broad as possible. Future analyses must know this and stop
> concluding "AC doesn't need that" — packages are analysed precisely because AC
> can use them. Examples: video editing (AC can replace a social-media team or a
> cutter), programming, product management.

Turn 4, correcting the "perhaps not at professional level" of turn 2:

> We do not want to bloat it. But how should AC be the best tool for video
> editing, programming or frontend if we leave important things out so that it
> does not get too big? That is a cut that makes AC a Swiss army knife that can
> do everything and nothing properly.

Turn 7 (this run's invocation): the omissions are why AC does not reach the peer
packages — a broad host-collection suite, a swarm-orchestration platform, a
code-knowledge-graph tool — nor frontend; AC cut itself to become good, stayed
small instead, and can do nothing properly. That has to change, and the
correction of the old decisions has to be part of AC before the next release.

## The principle this roadmap writes into the tree

**Breadth and depth are not traded against each other. The target in every
domain is professional level, delivered in stages; a stage is never a ceiling.
What is limited is what a single task loads and what no gate keeps true —
never what AC contains.**

| "Too big" means | Real cost? | Answered by |
|---|---|---|
| Size on disk / in the package | No — the tarball cap stays a regression alarm | nothing; not a reason to omit |
| Tokens a task carries | Yes | on-demand delivery: pack scoping, MCP `read_skill`, thin rules + inject |
| Maintenance — a capability silently rotting | Yes | gates, tests, generated counts, the domain register |

None of the three is answered by leaving a capability out.

**Professional level, made checkable.** Each register row names a professional
task set with an acceptance fixture — for video editing, "turn a 20-minute talk
into five captioned 9:16 shorts with normalised loudness and platform export
profiles"; for code intelligence, "answer the existing call-graph benchmark at
or above grep's recall". A stage is reached when its fixture passes, not when
its skills exist.

## Context — what in the tree works against the directive, at `5200f6bdf`

| # | Finding | Evidence |
|---|---|---|
| F1 | The orientation file every agent is sent to says the opposite, and is stale three more ways. | `AGENTS.md:20` → `docs/contracts/package-self-orientation.md:16` "Depth over breadth"; its wing table `:64-67` fixes Wings 2-4 as channel- and stage-agnostic; `:22-23`, `:111` cite `scripts/install.sh`/`install.py` (neither exists); `:71`, `:112` Python-era tooling; `:3` `keep-beta-until: 2026-08-12` lapsed; `AGENTS.md:3,35` "No app runtime" against accepted ADR-249. `AGENTS.md` is 2,982 of 3,000 chars and `CLAUDE.md` is a symlink to it, so it sits in the gated payload bucket. |
| F2 | The analysis family only asks for reasons to cut, in prose and in code. | `analyze/reference/command.md:305-308` an ADOPT without a home-defect anchor is reclassified UNCLEAR "no exceptions" — ADR-211 Amendment C (finding precedes borrow), kept valid by ADR-216 D1 (`ADR-216…md:199-203`), with no anchor type for a capability the owner wants; `:302` REJECT = "Conflicts with our principles", none named; the lens questions in `src/scripts/analysis_prompts.ts:20-23` (`LENSES` at `analysis_ledger.ts:13`) ask "already present … what does it cost" and "smallest rung … duplicates to fold", never "what would a professional expect that AC lacks?". `roadmap-repos/command.md:84`, `and-optimize/command.md:176-178,225` inherit it. |
| F3 | The domain gate carries an adoption arm and discounts a single ask. | `src/rules/domain-adoption-policy.md:39-41`; `docs/guidelines/agent-infra/domain-adoption-gates.md:9-15` demand = "≥ 2 consumer projects" OR a named user direction with target — the first arm is an adoption anchor ADR-216 D5 forbids; `:88-90` "the user asking once" is only a watch trigger. Of nine domain-watch notes two record a hard no (`cloud-native.md`, `llm-app-engineering.md` "category error"), seven are deferred. |
| F4 | Growth is defined as the defect in CI ratchets. | `src/config/estate-count-budget.json` `skill_count` / `skill_description_tokens` "0 — no allowance, deliberately"; `check_skill_body_budget.ts` "may not grow without a recorded reason"; `check_depth_budget.ts:69` `DEPTH_CEILING_CHARS = 16_000` on the on-demand reference layer; `lint_persona_governance.ts:60` `PER_DOMAIN_CAP = 2` on personas measured at zero standing cost; `lint_token_budget_discipline` `RICH_RATIO_CAP = 0.15` (ADR-217). |
| F5 | The binding payload gate charges content no host loads. | `check_preamble_payload_budget.ts` charges every skill's catalogue line (`preamble_byte_census.ts:290-310`, no pack or visibility filter) and every full rule body; ceiling `max(design 107,646, base-ref + grants)` (`preamble-payload-budget.json:80-82`) → zero net growth per PR, no banking across PRs; `committed_reduction_mechanism: "NONE"` (`:119`). A default scoped install ships 243 of 301 skills (`docs/CLAIMS.md:609`). ADR-270 keeps the host reading informational (`reopen_policy: directional`, `protected_dimensions: governance`). |
| F6 | Authoring guidance refuses depth the model "already knows" and caps it. | `src/skills/skill-writing/SKILL.md:57-58,93-97`; `skill-writing/references/procedure.md:22-27` "The skill count keeps climbing"; `artifact-drafting-protocol-mechanics.md:200-205,217` and `agents/settings/contexts/surface-consolidation-restraint.md:5-6` (growth paid by removal); `size-enforcement` "≤ 5 real, sourced entries" per pitfall section; `harvest-policy.md:32-35,109-111` five-unit plate cap, dormancy "intended"; `agents/settings/contexts/multi-stack-inventory.md:55` "No new skills expected". |
| F7 | Records that bind the deeper stages. | ADR-133 freeze on new large subsystems, condition (d) an external usage session — an adoption anchor ADR-216 D5 forbids, its ADR-134 escape expired 2026-09-15; ADR-124 Classes B/C (resident services, network/LLM build path) default-forbidden, partly lifted by ADR-249; ADR-061 embeddings only on measured recall failure; `framework-neutrality-in-generic-skills` + `lint_framework_leakage.ts:97-111` carve-outs know no vue, svelte, angular, go, rust, java, dotnet, django, fastapi, ffmpeg. All `reopen_policy` unclassified (council), except ADR-270 (directional, governance-protected). |
| F8 | Whole domains are unreachable or capped at prose. | 184 of 208 commands `internal`, incl. all of `/video`, `/image`, `/brand`, `/design-system`, `/research`; `ai-video`/`ai-image` optional only under `small-business` (`workspaces.yml:58`); no design, content or media workspace (closed vocabulary: `discovery-manifest.schema.json:78`); `skill_linter.ts:302-330` warns marketing and finance skills off channel and vendor specifics; `domain-pack-architecture.md:30-31` "Deferred by default". |
| F9 | Prior cuts decided the three weakest peer domains and two parked areas. | Swarm topologies "CUT — solves a 100-agent problem we measurably do not have" (`archive/road-to-always-on-orchestration.md:224`); code graph measured below grep (recall 0.365 vs 0.797) and defaulted off (`docs/comparison.yaml:103-110`); stacks beyond PHP held to one general skill per job (`later/road-to-stacks-beyond-php.md:100-103`); host breadth "conceded deliberately" (`later/road-to-credible-install.md:136-137`); crypto, blockchain and binary-analysis skills "CUT — No demand signal" (`later/road-to-skill-ecosystem-security-and-conformance.md:77-78`); frontend new-skill cuts (`later/road-to-a-canvas-the-code-owns.md:527-534`). |
| F10 | ADR-011 records its trigger in prose only, and its design gate's input does not exist. | `adr_cite_check ADR-011` → "LIVE, NO REOPEN CONDITION"; § (ii) needs `docs/contracts/domain-pack-overlap-inventory.md` before a second heavy domain — absent. |
| F11 | Using an installed neighbour is already decided; only the per-domain mechanics are missing. | ADR-280 § Decision 1 (owner, 2026-10-06): AC "may route a task to a capability the consumer installed". |

Domain stages at the pin (0 none · 1 basic · 2 practitioner · 3 professional):
backend 3 for PHP/Laravel, 0-1 for every other stack · frontend 2 · testing 2 ·
code intelligence 1 · orchestration 2 · video editing 0 (generation 1-2) ·
product 2 · marketing 1 · design/brand 2 · ops 2 · research 1-2 ·
finance/legal/strategy 1. One domain is at the target.

## Goal

The next release ships with the directive in the tree; with no rule, gate or
analysis lens left that rejects a capability for existing or for being large,
each limiter in the tree classified; with the existing domains reachable; and
with a ready stage-1 roadmap for every domain the owner named. Delivering the
stage-1 capabilities themselves is the work of those roadmaps, after the
release — the owner asked for the corrected decisions before the release, not
for every capability (turn 7: "not all of it"). The standing payload a task
carries does not grow.

## Payload sequencing — read before any step that edits a rule or adds a skill

The ceiling is re-measured at the base ref on every PR, so a reduction cannot be
banked: growth must be offset **in the same PR** or carry a grant in
`src/config/preamble-payload-exceptions.json`. Pairings: 0.3 carries the
`domain-adoption-policy` rewrite (net negative) and the orientation edits in one
PR; 2.2 and 2.3 each prove net ≤ 0 in their PR description with
`./scripts-run src/scripts/check_preamble_payload_budget`; no stage-1 skill
lands before the payload-surface decision (D8) is applied, except paired with an
equal cut. **If growth is detected:** an open PR reduces or offsets it before
merge; growth found after merge is repaid by the next PR of this roadmap before
any other step lands. New lints (0.4, 0.5, 1.4) each need a
`src/config/gate-coverage.yml` row with `scanned` and a self-test, and a
governance ratification artefact.

## Phase 0 — The directive is in the tree, and the release waits for it

- [ ] **0.1 Owner ADR.** `adr-create`: "Breadth and depth are both goals;
  limits apply to per-task load and maintenance, never to content."
  `provenance: {kind: human, decision_makers: [owner], human_directed: true}`,
  `authority_basis: owner_intent`, `evidence.strength: E0`,
  `protected_dimensions: [purpose]`, `reopen_policy: owner`. It records D8 and
  lists every lock this roadmap reopens, each with its route and its blocker; it
  supersedes no other ADR itself, so a lock the council keeps stays in force and
  is listed as kept, with its admissible reason.
  verify: `./scripts-run src/scripts/adr_cite_check <new ADR>` prints LIVE and `check_adr_frontmatter` passes.
- [ ] **0.2 Charter on a projected surface.**
  `src/agent-src/contexts/contracts/capability-breadth-charter.md` (sibling of
  `frugality-charter.md`), with a one-line pointer from `docs/contracts/`: both
  directive quotes, the principle, the three-cost table and the professional-level
  definition; numbered principles (P1 breadth by default · P2 professional target
  per domain · P3 a stage is never a ceiling · P4 load on demand · P5 every
  capability gated · P6 use what is installed and say so, per ADR-280 · P7 reuse
  AC infrastructure before adding a parallel one); the admissible decline
  reasons — a safety floor, a licence, a measured cost, currency of an external
  authority (ADR-238), or a named principle — and the inadmissible ones: "not
  needed", "outside AC's domain", "too big". **Precedence:** safety floor >
  licence > measured cost > P1-P7; a conflict between principles goes to the
  council, a conflict with the purpose to the owner.
  verify: `test -f dist/agent-src/contexts/contracts/capability-breadth-charter.md` after `task sync`.
- [ ] **0.3 Orientation and the domain gate, one PR.** Replace
  `package-self-orientation.md:16` and the wing table's agnostic clauses
  (`:64-67`) with a pointer to the charter; fix `:3`, `:22-23`, `:71`,
  `:111-112`, and `AGENTS.md:3,26,35`, char-neutral under the 3,000 ceiling. In
  the same PR `domain-adoption-policy` becomes a domain entry record in the
  register — an owner directive or a named task with a deliverable is demand,
  the maintainer is a valid owner, the CI decision is a label (reference-only vs
  validated) — and the "≥ 2 consumer projects" arm and the "asking once" clause
  are deleted (ADR-216 D5). The rule body shrinks and funds the PR.
  verify: `! grep -rn "Depth over breadth\|install\.py\|No app runtime\|no app runtime" AGENTS.md docs/contracts/package-self-orientation.md` and `! grep -n "consumer projects\|asking once" src/rules/domain-adoption-policy.md docs/guidelines/agent-infra/domain-adoption-gates.md`
- [ ] **0.4 Domain register.** `src/agent-src/contexts/contracts/domain-register.md`,
  in three levels — domain → capability family → toolchain — plus a
  *platform capabilities* section for what cuts across domains (testing, code
  intelligence, orchestration, research). Domains: software engineering (stacks
  PHP, Symfony, Node/TS, Python, Go, Rust, Java/Kotlin, .NET), frontend, mobile,
  security, data/ML, video editing, video/image generation, audio/music,
  design/brand, product, marketing/social, sales, ops/infra, people-ops,
  docs/writing, finance, legal, strategy. Each row: professional task set with
  its fixture, current stage with evidence path, gaps, and per gap a state of
  `owned` (roadmap named), `candidate` (owner and review trigger named) or
  `unowned` — only `unowned` blocks that capability's progression, never an
  unrelated register edit. A lint enforces the shape.
  verify: the register lint's self-test passes and the lint reads the committed register green.
- [ ] **0.5 Limiter inventory.** A machine-readable section of the register
  lists every admission, count, size, domain, pack, framework and payload gate
  and rule in Context (and any 1.x-3.x finds), each classified `load`,
  `maintenance`, `safety`, `legality` or `content`; every `content` entry is
  either changed by a step here or kept with an admissible reason. A lint fails
  on an unclassified entry.
  verify: the inventory lint's self-test passes; zero `content` entries without a step or a reason.
- [ ] **0.6 Release hold.** Release preflight (`src/scripts/release.ts`) lists
  open steps of Phases 0, 1, 2, 4 and 5 of any roadmap with `release_gate: next`
  and refuses to cut. `--allow-held <class> "<reason>"` cuts anyway only for
  class `security`, `regression-fix` or `owner`, the last requiring the owner's
  confirmation in the same run; all three write class, reason and the held step
  list to the release ledger. Phase 3 is outside the hold because it waits on
  measurement across hosts.
  verify: a fixture roadmap with an open Phase 0 step makes the preflight test red; each override class is green and ledgered; an unknown class stays red.

## Phase 1 — Analyses stop cutting

- [ ] **1.1** `analyze/reference`: a domain-register gap is an anchor type
  (`capability_gap`) for the § 1b table, so a capability the owner wants is the
  finding that precedes its borrow; REJECT must cite a charter principle id or a
  measured cost. Blocked by `adr-211-c-register-gap-anchor`.
  verify: a fixture comparison with a register-gap anchor classifies ADOPT, and one with a bare "conflicts with our principles" REJECT is flagged.
- [ ] **1.2** The lens questions in code (`analysis_prompts.ts`, `analysis_ledger.ts`)
  and in `src/agent-src/contexts/execution/analysis-loop.md` become symmetric:
  adversary adds "which capability would a user otherwise install another
  package for?" and "what would a professional in this domain expect that AC
  lacks?"; overbuild-sequencing keeps folding duplicates and orders stages, never
  drops a capability.
  verify: `tests/scripts/analysis_prompts.test.ts` pins both new questions.
- [ ] **1.3** `reference`, `roadmap-repos`, `and-optimize` and `inbox` link the
  charter as a source of truth; a capability row may be `declined` only with an
  admissible reason; gaps found are appended to the register, not dropped.
  verify: a test resolves each of the four projected command bodies' charter link against the projected charter file.
- [ ] **1.4** A report-only lint flags decline rows whose only reason is
  inadmissible, over committed analysis artefacts. It becomes blocking when a
  hand-labelled sample of ≥ 30 rows shows ≤ 10 % false positives, recorded under
  `agents/evidence/`; until then the council reads its report at each run of 1.5.
  verify: the lint's self-test passes; the labelled sample and its rate are committed.
- [ ] **1.5 Outcome check.** Re-run `/analyze:reference` on a fixture describing
  three capabilities of the peer classes in turn 7 (a broad hook/agent
  collection, swarm orchestration, a code knowledge graph). Every row lands as
  ADOPT/ADAPT through a register gap, or as a decline with an admissible reason;
  none as UNCLEAR for lack of a home defect.
  verify: the fixture run's ledger is committed and shows zero UNCLEAR-for-anchor rows.
- [ ] **1.6** Authoring guidance becomes a cost question — "what does this load
  per task, and which gate keeps it true?" — in `artifact-drafting-protocol-mechanics.md`,
  `surface-consolidation-restraint.md`, `harvest-policy.md` (plate cap and
  dormancy clauses), `multi-stack-inventory.md:55`, and `skill-writing`
  (`SKILL.md` and `references/procedure.md` § 0b): no restatement of what the
  model knows, but professional depth — decision rules, checklists, pitfalls,
  worked examples — is admissible, and the pitfall cap becomes "sourced", not
  "≤ 5".
  verify: `! grep -rn "paid for by removal\|No new skills expected\|keeps climbing" src/skills/skill-writing agents/settings/contexts docs/guidelines/agent-infra`

## Phase 2 — Rules that cap content become cost controls

- [ ] **2.1** Re-disposition the nine domain-watch notes and the parked cuts in
  F9 against the charter: each becomes a register row with a target and a first
  stage, or a decline carrying an admissible reason. Measured nulls (the code
  graph below grep) stay facts and become depth targets.
  verify: every file under `agents/settings/contexts/domain-watch/` and each F9 roadmap names its register row.
- [ ] **2.2** Personas: `PER_DOMAIN_CAP` becomes a quality gate — distinct lens,
  ≥ 1 cited skill, no duplicated review questions; `persona-schema.md § 8`
  follows. Blocked by `rich-ratio-and-persona-cap`.
  verify: `lint_persona_governance` self-test covers a third distinct persona (green) and a duplicate lens (red).
- [ ] **2.3** Rich class: the 15 % ratio goes; the "Why this skill is rich"
  section stays; the per-skill ceiling stays and is raisable by the 2.4 path.
  Blocked by `rich-ratio-and-persona-cap`.
  verify: `lint_token_budget_discipline` self-test passes with no ratio check.
- [ ] **2.4** Raise path for body, depth and rich ratchets: a raise is accepted
  when the diff names the register gap it closes **and** that gap carries a
  deliverable with its fixture, an `owned` state, the per-task payload delta, and
  a review trigger. A gap missing any of the four is not a reason.
  verify: each gate's self-test accepts a complete reason and rejects each of the four omissions.
- [ ] **2.5** `skill_linter.ts:302-330` drops the channel- and vendor-agnostic
  warnings for Wings 2-4; `domain-pack-architecture.md` "Deferred by default" →
  "Staged by default"; the capability-packs six-month new-pack tripwire becomes a
  register review run by the council at each register-lint red.
  verify: `skill_linter` self-test no longer warns on a channel-specific marketing fixture.
- [ ] **2.6** Framework-neutrality carve-outs are read from the register's
  toolchain column instead of a source list, so a newly registered stack or tool
  becomes admissible without a lint edit.
  verify: `lint_framework_leakage` self-test registers a fixture toolchain and accepts its skill name without a source change.
- [ ] **2.7** ADR-011 gains a frontmatter `review_trigger` from its § (ii) and an
  amendment: extraction may move a capability into an installable pack, never
  out of the AC distribution; `docs/contracts/domain-pack-overlap-inventory.md`
  is written so its design gate can run.
  verify: `adr_cite_check ADR-011` no longer prints NO REOPEN CONDITION.
- [ ] **2.8 Governance rollback.** Each change in 0.3, 2.2-2.6 records an
  observation window (the next 10 admissions it governs), its audit signal
  (register lint, skill-quality lint, persona lint), and a suspension trigger
  (two admissions reverted for quality); suspension freezes new admissions under
  that change only and leaves admitted artefacts in place for review.
  verify: the window, signal and trigger are present for each listed change in the register's limiter inventory.

## Phase 3 — Breadth that costs a task nothing

- [ ] **3.1** Delivered-payload readings. A protected material-host registry
  (changes need owner approval; a registered host with a missing, stale or
  failed reading blocks the cutover — never "non-material" as a fallback), and
  for each host a deterministic, writer-derived reading of what a default install
  delivers per session, bound to a versioned projection contract (writer,
  tokenizer, serialisation, host mode). An end-to-end equivalence test builds the
  real install artefact, enumerates what the host receives, tokenises it, and
  must match the writer-derived reading — golden snapshots alone do not count.
  Claude Code first; runs independently of Phases 1-2.
  verify: the equivalence test passes for every registered host on two clean builds with identical readings.
- [ ] **3.2** Apply D8 (option 1). The transition PR keeps the source gate
  blocking, adds a separate approved ceiling per host (no shared maximum),
  recalculates every active grant against the hosts it affects, and adds a
  reviewed configuration switch that restores source blocking. Per-host checks
  are informational until every host meets the cutover criteria (3.1 green,
  approved budget, grants migrated, a representative fixture change moves the
  expected hosts' readings); then per-host blocks and source is reported only.
  The switch is thrown back when an artefact disagrees with its reading, a
  registered host cannot be measured, a host exceeds its ceiling with CI green,
  or a tokenizer/serialisation change moves a reading without explanation.
  verify: `check_preamble_payload_budget` test suite green, covering cutover, each rollback trigger, and absolute-delta reporting.
- [ ] **3.2b Maintainability stays gated after cutover.** Source growth is
  governed by its own blocking controls instead of a token cap: every skill and
  rule carries an owner and a register row, orphan content (shipped to no host)
  must be classified, and an addition above 5,000 source tokens in one PR needs a
  recorded reviewer sign-off. Raised by the council seat that preferred option 2.
  verify: each control's self-test reds on a fixture that lacks its field or sign-off.
- [ ] **3.3** Skill estate: `skill_count` and `skill_description_tokens` ratchet
  the default-active resident set; a skill in a non-default pack with an `owned`
  register gap needs no exemption.
  verify: `check_estate_count` test accepts a non-default-pack skill with an owned gap and rejects a default-pack one without a claim.
- [ ] **3.4** Commands: measure whether each material host lists command
  descriptions (174 of 208 lack `disable-model-invocation`, ~7.9k tokens). Where
  one does, they are charged to the gated surface; reach is never reduced to make
  the number smaller.
  verify: the measurement is committed under `agents/evidence/` with its method.

## Phase 4 — What exists becomes reachable

- [ ] **4.1** Probe a consumer install in `gtm`, `founder` and `product` and
  record what each lists today. Then `design` and `content` join the closed
  workspace vocabulary (`discovery-manifest.schema.json:78`, ADR-013/015
  amended), and the media, design and brand packs become optional in `gtm`,
  `founder` and `product`. Stop condition: a probe that shows a previously
  listed command missing reverts the change for that workspace.
  verify: a consumer install in `gtm` with `ai-video` enabled lists `/video`, and the before-probe list is a subset of the after-probe list.
- [ ] **4.2** Cluster heads of `/video`, `/image`, `/brand`, `/design-system`,
  `/research` become `advanced` within the visible-command budget.
  verify: `audit_command_surface --check-new` green.

## Phase 5 — Stage-1 roadmaps for the named domains

Each step writes one `ready` roadmap: stage 1 as executable steps whose last step
is the domain's professional fixture from the register, stages 2-4 as entry
conditions, and the measured null or infeasibility of a stage recorded as a
register fact with a pivot rather than a silent stop. Order follows the owner's
naming and the peer gaps; subsystem-class stages wait on
`subsystem-stages-under-adr-133-and-124`.

- [ ] **5.1 Frontend.** Visual regression baselines, axe in CI, performance budgets
  and bundle analysis, Vue/Svelte/Angular executors, design-to-component, i18n,
  SSR.
  verify: the roadmap exists, passes the roadmap gates, and its last stage-1 step is the register fixture.
- [ ] **5.2 Backend stacks.** Per stack test runner, ORM/migrations, package
  manager and framework skills — Django/FastAPI, NestJS, Spring, ASP.NET, Go,
  Rust — reopening `road-to-stacks-beyond-php` D3; the dangling `skills:` names
  in `meta/package/{test,reset}` become its npm/Python/Go/Cargo gaps.
  verify: as 5.1.
- [ ] **5.3 Video editing.** Stage 1: cut list, silence cut, scene detect,
  captions SRT/VTT and burn-in, reframe 9:16/1:1/16:9, loudness EBU R128,
  ducking, platform export profiles, each operator refusing unreadable input.
  Stage 2: transcript-driven edit, B-roll, EDL/FCPXML/OTIO exchange, colour/LUT,
  QC and review loop. Stage 3: generation and provider selection. Stage 4: brand
  kits, localisation, batch repurposing. Routing to a user-installed media tool
  follows ADR-280, invokes it as a separate program, is announced, and waits on
  a recorded licence check for any copyleft tool.
  verify: as 5.1.
- [ ] **5.4 Code intelligence.** Exit criterion: the existing benchmark at or
  above grep's recall. Arrow-function exports, `--root`, a SCIP reader, more
  grammars, impact and ownership queries.
  verify: as 5.1.
- [ ] **5.5 Orchestration.** Durable queue with leases and idempotency, live
  status board, per-agent cost booking, parallel-worktree merge handling.
  verify: as 5.1.
- [ ] **5.6 Product and marketing.** Experiment statistics, Linear, PRD-to-backlog;
  channel execution, SEO, lifecycle email.
  verify: as 5.1.
- [ ] **5.7 Carried defects.** The supplied plan's governance defects go to
  `agents/roadmaps/stubs/road-to-command-runtime-requirements.md` (dead
  `skills:` pointers) and one new stub owned by the maintainer for the rest —
  stale counts, undated prices, unread instruction paths, handoff closure, and
  the `projection.mode` enum missing `tiered` (`src/server/schemas/settings.ts:32`)
  — each with its `file:line` and a review trigger.
  verify: both stubs name each defect with its `file:line`.

## Blockers

### blocker: adr-211-c-register-gap-anchor
- **Status:** open
- **Owner:** council
- **Blocks:** step 1.1, 1.5; AC-2
- **Question:** ADR-211 Amendment C requires a finding at home before a borrow. Does a domain-register gap with an owned state, a deliverable and a fixture count as that finding?
- **Recommendation:** (a). It is a finding in the amendment's sense — recorded, checkable, at home — and it lets an owner-wanted capability be planned without inventing a defect.
- **If you do nothing:** analyses keep reclassifying owner-wanted capabilities as UNCLEAR.
- **What to do:** pick exactly one — (a) amend ADR-211 C so an owned register gap is an anchor; or (b) accept a register gap only for domains the owner directive names; or (c) keep C unchanged and record the admissible reason.
- **Resolved when:** a two-seat council verdict is recorded here with its reasoning and Status reads resolved; a split escalates to the owner.

### blocker: rich-ratio-and-persona-cap
- **Status:** open
- **Owner:** council
- **Blocks:** steps 2.2, 2.3; AC-4
- **Question:** ADR-217's 15 % rich count cap and the 2026-05-17 persona cap of two per domain limit how many deep skills and specialist lenses may exist. Both surfaces are on-demand. Should each be replaced by its quality gate (2.2, 2.3) with the 2.4 raise path?
- **Recommendation:** (a). Neither count protects per-task load; the quality gates keep the maintenance protection.
- **If you do nothing:** depth stays capped by count in two places.
- **What to do:** pick exactly one — (a) replace both, each with its own amendment record; or (b) replace the persona cap only and raise the rich ratio to a recorded value; or (c) keep both and record the admissible reason for each.
- **Resolved when:** a two-seat council verdict per record is recorded here and Status reads resolved; a split escalates to the owner.

### blocker: subsystem-stages-under-adr-133-and-124
- **Status:** open
- **Owner:** council
- **Blocks:** the subsystem-class stages inside the roadmaps of 5.3-5.5 (durable queue, status board, SCIP reader, networked generation); not the roadmaps themselves
- **Question:** ADR-133 condition (d) is an external-usage anchor that ADR-216 D5 forbids, and ADR-124 Classes B/C default-forbid resident services and networked build paths. Should each subsystem stage be decided on its concrete design under ADR-249's governance instead of a standing refusal?
- **Recommendation:** (a). The AI council (2026-10-21) advised deciding these alongside concrete stage designs, not pre-authorising them abstractly.
- **If you do nothing:** the stage-1 roadmaps land; their subsystem stages stay frozen.
- **What to do:** pick exactly one — (a) strike ADR-133 (d) under ADR-216 D5 and decide each subsystem stage on its design through ADR-249; or (b) strike (d) only and keep ADR-124 refusals until a stage design is presented; or (c) keep both and record the admissible reason.
- **Resolved when:** a two-seat council verdict is recorded here with its reasoning and Status reads resolved; a split escalates to the owner.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | Breadth and depth are both goals; per-task load and maintenance are the only limits. | Chat turns 2, 4, 7 of round `inbox-2026-10-v`. | The owner changes the purpose. |
| D2 | reversible-technical | evidence | Kept as cost controls: the standing-payload ratchet and its exception ledger, the visible-command budget, ADR-048, the tarball cap, the ADR-215 family cap, the skill admissions ledger, the skill-domain taxonomy ADR. ADR-238 becomes an admissible decline reason (currency of an external authority). | Each limits load, maintenance or correctness, not content. | One of them is shown rejecting a capability on size alone. |
| D3 | reversible-technical | evidence | No new settings key. | Owner directive 2026-10-12 (`road-to-a-setup-that-decides-itself`). | — |
| D4 | reversible-technical | evidence | Prior cuts and measured nulls are re-dispositioned in the register (2.1), not reversed here. | A measured null stays a fact and becomes a depth target. | — |
| D5 | reversible-technical | evidence | Peer packages are named in no tracked file. | `source-confidentiality`. | — |
| D6 | reversible-technical | evidence | The supplied plan's workflow contracts, checkpoints, resume and mission board are not planned here. | Owner scoped the run; owned by `road-to-a-step-that-costs-what-it-changes`, `road-to-agent-throughput-recovery`, `road-to-a-cold-start-paid-once`; the board joins 5.5. | — |
| D7 | reversible-technical | evidence | Its "video skills in core: reject" and "media pack: later" rows are overturned. | D1. | — |
| D8 | product-owned | owner | Once 3.1's readings exist, the blocking check charges what a default install delivers per host, with a separate ceiling per host; the source reading stays measured and reported, and maintainability is gated by 3.2b. Rejected alternatives: a dual gate keeping a source token cap (option 2), the source gate unchanged (option 3). | Owner, 2026-10-21, after a two-seat AI council round on the same day split 1 (openai) vs 2 (anthropic); both seats' guards are adopted in 3.1-3.2b. ADR-270 is governance-protected, so the choice is owner-reserved. | A registered host cannot be measured deterministically, or a rollback trigger of 3.2 fires twice. |
| D9 | reversible-technical | evidence | The release hold covers Phases 0-2, 4 and 5 (authoring); stage-1 capability delivery follows after the release. | Owner turn 7 asks for the corrected decisions before the release and "not all of it"; the council found the earlier hold contradicted the Goal. | The owner asks for a stage-1 capability before the release. |
| D10 | reversible-technical | evidence | A consumer-demand validation step is not added. | The owner directive is the demand; ADR-216 D5 forbids adoption anchors. | — |
| D11 | reversible-technical | evidence | `estate_growth_exempt` stays beside `estate_offset_exempt`. | The two halves of `check_estate_count` take different claims; a council seat read the growth claim as a copy error. | — |
| D12 | deterministic | evidence | No step merges anything: "merge" in the sequencing rules, 5.5 and AC-6 names the owner's ordinary PR merge or a capability to build. 0.5's "changed or kept" and 1.1's block are each settled by their blocker or by the inventory's admissible-reason column. | `closure_scan` 2026-10-21 candidates C2-C7; merges stay owner-only (`non-destructive-by-default`). | A step is added that performs a merge. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Breadth lands resident and the task gets heavier | product | New skills and rules add standing tokens. | AC-6; the sequencing rules with their growth-detected path; Phase 3 charges delivered payload; zero net growth kept. | Payload sequencing — read before any step that edits a rule or adds a skill |
| 2 | The register becomes an exemption generator | product | Any task names a gap and uses it to grow. | 2.4 requires deliverable, fixture, owned state, payload delta and review trigger; 2.8 suspends a change on reverted admissions. | Phase 2 — Rules that cap content become cost controls |
| 3 | The release hold stalls a needed release | implementation | 0.6 refuses a cut while held phases are open. | Phase 3 outside the hold; three override classes, ledgered. | Phase 0 — The directive is in the tree, and the release waits for it |
| 4 | The decline lint misfires on legitimate rejections | implementation | Pattern gates miss and over-match. | Report-only until ≥ 30 labelled rows show ≤ 10 % false positives (1.4). | Phase 1 — Analyses stop cutting |
| 5 | The council keeps a lock the owner wants gone | product | A blocker resolves to option (c). | Each verdict must cite an admissible reason; a split escalates to the owner; 0.1 lists kept locks visibly. | Blockers |
| 6 | Stage-1 roadmaps are written but never run | product | Phase 5 delivers plans, not capability. | Each stage-1 ends in its professional fixture; the register shows the stage until it passes. | Phase 5 — Stage-1 roadmaps for the named domains |

## Acceptance Criteria

- [ ] AC-1 — No surface reachable from `AGENTS.md` says "depth over breadth" or "no app runtime"; the charter and the owner ADR exist (0.1-0.3).
- [ ] AC-2 — The lens questions are symmetric in code, the four analysis commands resolve the charter, and the 1.5 fixture run shows zero UNCLEAR-for-anchor rows (1.1-1.6).
- [ ] AC-3 — Opening a domain depends only on an owner directive or a named task, never on a count of outside projects (0.3, blockers).
- [ ] AC-4 — The persona cap and the rich ratio are replaced by quality gates, or kept with a recorded admissible reason; ratchet raises require the four-part reason (2.2-2.4).
- [ ] AC-5 — Every register row has a professional task set with its fixture and a state per gap; every limiter in the inventory is classified and every `content` entry is changed or kept with a reason (0.4, 0.5, 2.1, 2.8).
- [ ] AC-6 — `./scripts-run src/scripts/check_preamble_payload_budget` shows no net growth against `origin/main` at each merge of this roadmap's PRs.
- [ ] AC-7 — The next release is cut only after Phases 0-2, 4 and 5 are merged, or with a ledgered override of an allowed class (0.6).
- [ ] AC-8 — A consumer in `gtm` reaches `/video`, `/image`, `/brand` and `/design-system`, and loses nothing it listed before (4.1-4.2).
- [ ] AC-9 — Each domain of 5.1-5.6 has a ready stage-1 roadmap ending in its fixture, the carried defects have their stubs, and the payload surface follows D8 (2.5-2.7, 3.1-3.4, 5.1-5.7).
