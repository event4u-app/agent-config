# Frontend / design-stack cut (council 2026-07-31)

Durable conclusions from the design-stack sweep. Cite **this** file, never the
council session path (per `no-roadmap-references`).

**Inputs.** An external analysis produced 19 findings against the UI track. All 19
were re-verified in-tree by four adversarial subagents; four more (E1–E4) plus a
Filament gap (C2b) were found during verification. Council: anthropic
(claude-sonnet-4-5) + openai (gpt-4o), 2 rounds, debate mode, $0.21.

## What the verification changed about the diagnosis

The original analysis framed the problem as **"the Claude-Design port path is
missing"** and proposed a 6-phase, port-first roadmap. Verification moved the
centre of gravity:

- The port case bites only when an artifact is provided. **Routing, lane, and
  validation defects degrade every frontend the package touches**, artifact or
  not — and two of them are outright bugs, not tensions.
- The anti-slop collision is **weaker than claimed**: `lint_design_slop` defaults
  to exit 0 (`lint_design_slop.ts:35-36`). It is agent-behavioural pressure via
  `design-review`, not a CI block.
- The proposed port fix (HTML extractor + Playwright ground-truth diff)
  **reopens a prior council lock** (2026-06-28), recorded verbatim in
  `src/skills/design-system-capture/reference/design-system-json.md:3-7,64-65`:
  *"We own the contract, not the crawler … the package never ships the crawler,
  the Playwright runtime, or a font-bundler."*

## Council convergence (both members, both rounds)

1. **Port-first sequencing is wrong.** Ship the lane/routing/validation cluster
   first; it breaks the 95 % case. The port serves one narrow case.
2. **The E1 lock holds.** No crawler, no Playwright runtime, no font-bundler.
   The package may *accept and honour* an externally produced
   `design-system.json`; it may not produce one. Round 2 sharpened the reading:
   the lock forbids **shipping binary dependencies**, not accepting a contract
   an external tool emitted.
3. **`--fidelity-source` linter flag is over-engineering.** Given the linter is
   advisory, a precedence sentence plus one regression fixture is sufficient.
   Revisit only if a measured run shows the polish loop still edits away from a
   provided artifact.
4. **C1 → delete the indirection (option b).** `apply.ts` dispatches to
   `ui-apply-<stack>` names that have **no skill file at all** — two are rescued
   only by a doc table, `vue` self-loops, and `plain` (the universal fallback)
   points at `blade-ui`, a laravel-pack skill a non-Laravel consumer never
   installed. Removal beats creating four delegation-only skills; the package has
   renamed a skill zero times, so the indirection is unpaid-for abstraction.
5. **Capability-based dispatch is the better model but not now.** The four-stack
   enum is likely the real defect, but rewriting detection without a single
   fixture covering any non-modelled stack is a cathedral on an unmeasured
   foundation. Short term: add the missing detection arm + a dispatch fixture.
6. **Measurement gates behaviour change.** Round 2's load-bearing objection: every
   C1 option is a guess until a baseline says which stacks currently produce
   usable output. Fixtures + a documented baseline run come first, and an
   honest-null is publishable.

## Where the members diverged, and the cut taken

- **Roadmap count.** sonnet: one roadmap plus an *explicit out-of-scope section*
  for the port (do not roadmap it). gpt-4o R1: one unified roadmap; R2: reversed
  to separate boundaries so a niche concern cannot dilute the urgent one.
  **Cut: three roadmaps**, split by blast radius and by the files they touch —
  the state machine, the artifact contract, and the corpus data. The port keeps a
  roadmap rather than a bare exclusion note because a verified defect with an
  in-lock fix is work, not a feature request; its scope is however cut down to
  what fits inside the lock.
- **Tier flip (C3).** sonnet R1 called it a zero-risk one-line change; R2
  rebutted its own position — builders run first and longer, so flipping them to
  opus may multiply per-run cost. **Cut: the flip is benchmark-gated, not
  shipped on argument.**

## Amendment — the C1 verdict was revised on new evidence (council 2026-07-31, 2nd session)

The original C1 call ("delete the dispatch indirection, route to real skill
names") rested on the premise that `ui-apply-<stack>` is a skill name. Three
findings during implementation falsified the framing:

- **`ui-stack-extension.md:25-35,87-129` mandates the 12 names as real skill
  files** and gives each an I/O contract — a design never implemented (zero of 12
  exist).
- **`ui-track-flow.md:107-111` documents the same names as a redirect to *other*
  skills**, contradicting it. Two rows are broken: `vue` self-loops, and `plain`
  (the universal fallback) points at `blade-ui`, whose frontmatter is
  `packs: [laravel]` — absent from a non-Laravel install.
- **The CI gate that was supposed to catch this does not exist.**
  `ui-stack-extension.md:168-169` claims `task lint-skills` enforces a
  `tested_against` anchor on `ui-apply-*`; `tested_against` appears in **0**
  scripts and **0** skills.
- **The vocabulary is a tested contract.** `directives_ui_review_dispatch.test.ts`
  and `directives_ui_polish_dispatch.test.ts` pin the literal directive strings,
  the `Object.keys(STACK_DIRECTIVES) == KNOWN_STACKS` invariant, and — explicitly
  — that an *unknown* stack falls back to `plain`. Goldens exist per stack.

**The decisive measurement.** Council round 2 argued for authoring the 12 skills
on the premise that the agent loader resolves a directive verb as
`skills/<verb>/SKILL.md`. That premise is false in this engine: of the 11 literal
directive verbs it emits, only **2** resolve to a real skill (`existing-ui-audit`,
`refine-prompt`); **9 resolve to nothing** (`run-tests`, `create-plan`,
`apply-plan`, `review-changes`, `app-spec`, `ui-design-brief`,
`reclassify-to-ui-improve`, `trivial-apply`, `contract-plan`). Directive verbs are
overwhelmingly **agent-interpreted verbs, not skill paths** — so `ui-apply-*` is
the norm, and authoring 12 skill files would make the UI lanes the engine's only
exception.

**Adopted: Option B.** Directive verbs stay; the verb→bundle mapping moves out of
prose into a machine-readable table in the engine and gets a CI check; the two
broken rows are fixed to the pack-agnostic pair (`ui-component-architect` +
`tailwind-engineer`, both `packs: [engineering-base]`); the contradicting artefact
rows and the false CI claim are deleted from `ui-stack-extension.md`.

**The surviving round-2 objection**, kept as a design constraint: a CI check in
the maintainer repo cannot see a consumer's installed pack combination. So the
check does two things, both decidable in-repo — every bundle member resolves to a
real skill, **and** no lane reachable without the `laravel` pack names a
`laravel`-only skill. That is exactly the `plain → blade-ui` defect, mechanically
prevented.

Both members also converged, independently of the A/B fork, on splitting `plain`
(genuinely stack-free) from `unknown` (detection found markers we do not model) —
that split is what makes a loud failure possible without punishing real plain
projects. It lands with the detection work, not the dispatch work.

## Standing constraints for any work in this area

- Evidence before behaviour change; honest-null is a publishable result.
- Removal over addition (the C1 verdict is an instance).
- No new binary/runtime dependency in the package (E1).
- The three roadmaps plan work, not releases — no version pins, no commit steps.

## Amendment 2 — the harness question, resolved (maintainer, 2026-08-01)

The council's refusal to build a UI-quality harness for one frontmatter question
stands. What changed is that the harness stopped being for one question.

**Decision.** Build the diff machinery as `bench:ui`, maintainer-side, as Phase 4
of `road-to-provided-artifact-honesty`, fed by that roadmap's port fixtures. The
two parked measurements ride on it. Rationale: the port defect is the original
reported fault of this whole analysis series, that roadmap needs the machinery
for its own acceptance criteria, and its non-goal already carried the clause
"if such a harness lands for another reason, this roadmap unblocks for free".

**The 2026-06-28 lock was never engaged, and that is worth recording precisely.**
The maintainer offered to lift it. Checking first showed the lift was
unnecessary: the lock forbids the package *shipping* a crawler / Playwright
runtime / font-bundler, `@playwright/test` is already a devDependency, and
`package.json` `files[]` ships neither `tests/` nor `internal/`. A bench beside
`bench:ab` distributes nothing to a consumer. The **consumer-side** verify stage —
the agent rendering a port inside a consumer's project — does need a browser
there, and stays gated with the honest-degrade pattern unchanged. A lock that
did not need reopening must not be logged as reopened.

**Scoring is judge-free, and that is the load-bearing design choice.** Four
deterministic components with weights pre-registered before the first run:
perceptual screenshot diff per breakpoint (SSIM/pixelmatch with a threshold —
raw pixel equality would measure font antialiasing), DOM-structure comparison,
token-mapping score, Playwright interaction checklist. No model in the scoring
path. An LLM judge would import variance and **circularity** — Opus grading Opus —
into the one measurement that has to decide Opus vs Sonnet. The port case is the
single place a ground truth already exists, so the question is measured rather
than adjudicated.

**Both measurements are fidelity tasks, so one session answers both.**
A: same fixtures, builders `medium` vs `high`, lane fixed — diff-distance delta
against cost delta. B: same fixtures on the two stacks where both lanes exist,
tier fixed, legacy bundle vs forced generic lane — a switch, not a rebuild, since
the composition landed. The two tier outliers run as their own arms.

**Two null paths are pre-registered.** A null: the `high` lift does not clear the
cost delta → tiers unchanged, null published. B null: the generic lane lands
within a pre-fixed tolerance of the framework lane → **a strong positive**, not a
shortfall — the floor carries, and overlays justify themselves only on their
specialist subject. Naming that in advance is what stops it being read as the
generic lane losing.

**The one-question-harness non-goal is discharged, not bypassed.** `bench:ui` has
a third customer after the session: a standing regression watch for every future
change to the UI skills, which becomes diff-measurable instead of arguable. The
non-goal was aimed at a single-purpose benchmark subsystem and still holds
against one.
