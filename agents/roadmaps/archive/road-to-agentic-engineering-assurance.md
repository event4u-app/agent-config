---
complexity: structural
status: done
estate_growth_exempt: "Same owner-instructed draft -> ready flip, 2026-08-22. Two blockers that were dormant under status: draft now charge open_blockers, and the policy sanctions a new blocker through no allowance other than this claim. Growth is +2 open_blockers. Both are owner-reserved by their own text, so they surface at exactly the moment the roadmap becomes executable, which is the point of the flip. Neither blocker was added, weakened, or resolved here; only their visibility to the ratchet changed."
execution:
  mode: phase-checkpoints
research_pin:
  repository: event4u-app/agent-config
  main: 572e147cc0110f4453dc23ea04891bca4e38d897
  date: 2026-08-22
estate_offset_exempt: "FLIPPED TO READY on the owner's explicit instruction, 2026-08-22 — the estate decision this key deferred to the owner has now been taken, for every draft the previous /analyze:inbox run landed. What the key covers from here is the +1 active_roadmaps the flip itself creates, un-offset on that instruction. The draft-era text that follows is kept as history and no longer describes this file: Ships status: draft, so it charges neither active_roadmaps nor open_blockers until the owner flips it to ready — that flip is the estate decision and it is not an external session's to take. Nothing to offset against: no active roadmap covers assurance-readiness discovery, and archiving an unrelated one to pay for this would be an unreviewed disposition dressed up as bookkeeping. Landed by /analyze:inbox with its claims re-verified at 577bdbf88 (all nine mutation/architecture tool names still return 0 files in src/)."
---
# Road to Agentic Engineering Assurance
> **Source anonymisation (`source-confidentiality`).** External harvest sources
> are referenced as `Source A`…`Source M` rather than by org/repo name: this
> tree must not record which third-party packages seeded an idea. The real
> identifiers, their pinned revisions and their licences remain in the consumed
> inbox copy under `agents/tmp.old/`, which is gitignored and therefore
> maintainer-reachable only. Tool and product names used as *integration
> targets* (Nx, Turborepo, Storybook, shadcn, Base UI) are unaffected — naming a
> tool this package works with is not derivation-attribution.

> **Source:** `agents/tmp.old/inbox-2026-08-f/road-to-agentic-engineering-assurance.md` — landed by `/analyze:inbox` on 2026-08-22.
> Claims re-verified against `577bdbf88` (main after ADR-243); see the run
> summary for the verification and reproduction tables.

> **Purpose:** make Agent Config capable of determining whether a repository has
> enough executable feedback and independent evidence for the amount of agent
> autonomy being attempted, help the user build the missing engineering
> infrastructure, and use that infrastructure in the normal AC execution path.
>
> **Core invariant:** **Autonomy must not outrun assurance.**
>
> This roadmap deliberately does **not** create another TDD skill, another
> reviewer, another traceability vocabulary, or a second mutation-testing
> obligation. Current AC already contains those primitives or active roadmaps
> for them. This roadmap provides the missing system that discovers, composes,
> bootstraps, selects and reports them.

## Executive finding

The external evidence and the current AC tree point in the same direction.

The important unit for agentic engineering is no longer only "can the model
write good code?" It is also "can the repository make wrong work observable to
the model without depending on a human reading every line?"

Three current external signals are especially strong:

1. Anthropic's 2026 autonomous C-compiler experiment reports that most of the
   human effort moved into tests, environment and feedback, and explicitly says
   that the task verifier must be nearly perfect because otherwise the agents
   optimize the wrong target. It also records the failure mode that green tests
   are easy to over-trust.
2. OpenAI's 2026 harness-engineering report describes a repository where the
   human role moved toward specifying intent and designing feedback loops. It
   mechanically enforces architecture, gives agents worktree-local application
   and observability access, and reports that agent-to-agent review replaced
   most mandatory human review only after those repository capabilities existed.
3. Recent spec-driven test-generation research reports better bug detection
   when an agent first extracts preconditions, postconditions and undefined
   behavior before generating tests. This is evidence for a specification layer,
   not evidence that every task needs heavyweight formal methods.

Mutation testing is useful here, but it is not the architecture. The official
Infection documentation itself warns that one global MSI number is not the
interesting part and provides changed-file / changed-line modes specifically
for large and legacy repositories. AC should therefore treat mutation as one
possible **test-sensitivity probe**, selected by risk and stack, rather than a
universal ceremony or vanity score.

## Current AC baseline

The repository already carries important pieces of the target system.

### Existing TDD discipline — reuse, do not replace

`src/skills/test-driven-development/SKILL.md` already defines strict
RED -> GREEN -> REFACTOR behavior, requires an observed failing test, enumerates
happy/boundary/error cases, adds an abuse case on security-sensitive paths, and
has explicit exceptions for spikes, boilerplate and documentation.

`src/domains/engineering-base/tdd/command.md` is already a thin orchestrator over
that skill.

**Consequence:** this roadmap does not add another TDD workflow. It makes TDD
one capability that an assurance policy can select and for which AC can verify
that the project has a usable test runner.

### Existing test-integrity discipline — reuse, do not replace

`src/skills/testing-anti-patterns/SKILL.md` already rejects tautological tests,
testing mocks instead of behavior, gaming green, and negative tests that have
never been seen to fail. It already includes a manual mutation-style sensitivity
probe: remove/invert the claimed control, verify the test becomes red, restore
the control immediately.

**Consequence:** tool-assisted mutation must extend this concept, not create a
parallel "mutation quality" doctrine.

### Existing test-independence / mutation roadmap — dependency, not duplicate

`agents/roadmaps/archive/road-to-test-independence-and-mutation-evidence.md` already
pre-registers an experiment for:

- spec-first test authorship vs same-context blind spots;
- mutation sensitivity evidence;
- a severity-conditioned spec-test-writer stage;
- `test_authorship` evidence;
- an honest-null path if the measured effect is not useful.

It explicitly excludes per-change mutation CI and a new judge.

**Consequence:** this roadmap consumes its resulting capability and evidence.
It does not re-specify its mechanism.

### Existing review-independence roadmap — dependency, not duplicate

`agents/roadmaps/archive/road-to-review-independence.md` already identifies a shipped
fresh-context reviewer dispatcher and plans to route the default review path
through it, while recording author/reviewer context relation.

**Consequence:** the assurance engine asks "is independent review available and
required for this risk?" It does not implement another reviewer.

### Existing requirements-traceability roadmap — dependency, not duplicate

`agents/roadmaps/archive/road-to-requirements-traceability-minimal.md` already
proposes optional requirement / acceptance / evidence references plus a listing
gate and a measured adoption decision.

> **Overtaken, 2026-08-22 (`/analyze:inbox`).** That roadmap COMPLETED and was
> archived between this bundle's pin (`572e147cc`) and today — the path is
> corrected to `archive/`. This section's framing ("dependency, not duplicate")
> therefore reads differently than when it was written: the dependency is on a
> landed capability rather than on a sibling proposal, so the blocker below that
> waits for its "final measured disposition" can be closed by reading the
> archived roadmap instead of waiting for it.

**Consequence:** this roadmap must not make traceability universally mandatory
before that roadmap has measured whether the proposed shape produces signal.
It defines the capability slot now and can tighten only after evidence.

## Problem statement

Today AC has many strong engineering practices, but they are mostly expressed as
skills, commands, rules and individual gates.

That leaves six system-level gaps:

1. **No repository assurance inventory.**
   AC cannot produce one canonical answer to "what executable verification
   capabilities does this project actually have?"
2. **No risk-to-assurance policy.**
   A README edit and an authentication change can still enter largely the same
   generic execution loop unless a specialized skill happens to route them
   differently.
3. **No capability bootstrap contract.**
   AC can recommend testing and quality tools, but there is no one mechanism
   that detects a missing capability, proposes stack-native choices, installs or
   configures the chosen capability, verifies it, and records the result.
4. **No assurance-aware autonomy contract.**
   AC does not currently express a mechanical relationship between weak
   repository feedback and how much autonomous work is safe.
5. **Evidence is fragmented.**
   Test output, review evidence, traceability, static analysis, runtime
   verification and known limitations are not projected into one per-change
   assurance verdict.
6. **Legacy repositories need a ratchet, not a purity gate.**
   A repository with weak historical tests must be improvable without requiring
   the whole codebase to reach a greenfield standard first.

## Design principles

### P1 — capability model, not tool checklist

The canonical vocabulary is capabilities:

- unit-test
- integration-test
- e2e-test
- behavior-spec
- test-red-evidence
- mutation-sensitivity
- property-test
- static-analysis
- type-check
- architecture-constraint
- dependency-audit
- secret-scan
- security-scan
- runtime-probe
- visual-regression
- independent-test-author
- independent-review
- requirement-trace
- evidence-binding

Tools are adapters that can satisfy capabilities.

Examples:

- PHP: Pest/PHPUnit, Infection, PHPStan/Psalm, architecture tests, Composer audit.
- TypeScript: Vitest/Jest, Playwright, Stryker, TypeScript, ESLint,
  dependency-cruiser or project-native structural tests.
- Python: pytest, Hypothesis, mutmut, mypy/pyright, Ruff, Bandit/pip-audit.

AC must prefer an already-shipping project tool over introducing a second tool
for the same capability.

### P2 — readiness is a vector, not a vanity score

Do not ship a single "82/100 agent-ready" number as the source of truth.

A project can have excellent linting and still have no executable behavioral
oracle. A scalar hides that critical absence.

Use:

- a capability matrix;
- critical missing capabilities;
- optional derived levels for ergonomics.

### P3 — levels describe minimum floors

Proposed derived levels:

- **A0 UNKNOWN** — AC has not established a reliable assurance inventory.
- **A1 EXECUTABLE** — build/test entrypoints are discoverable and reproducible.
- **A2 VERIFIED** — relevant tests + static/type/quality checks can be executed.
- **A3 AGENT-READY** — specification/acceptance basis, sensitive-test evidence,
  independent review where required, and bound evidence are available.
- **A4 HIGH-ASSURANCE** — risk-specific adversarial/property/mutation/security/
  runtime verification is available.
- **A5 CRITICAL** — domain invariants and explicit human risk acceptance are
  required; autonomy remains bounded even if all machine gates are green.

A higher level is not "better software". It means AC can support a stronger
autonomy claim for the relevant class of change.

### P4 — changed-surface ratchet for legacy

Never require global mutation, coverage or architectural perfection to begin.

For touched behavior:

- identify the changed behavioral surface;
- require the policy for that surface;
- grandfather untouched legacy debt;
- prevent new debt from worsening the baseline;
- record remediation separately.

This mirrors the changed-line / changed-file support provided by real mutation
tools such as Infection and avoids turning legacy modernization into a blocker.

### P5 — test sensitivity beats raw coverage

Coverage is discovery evidence, not correctness evidence.

Prefer questions such as:

- was the new test observed red before implementation?
- does a relevant mutation/control inversion make it fail?
- do boundary/error/abuse cases exist?
- does an independent/spec-first author catch a different defect class?
- is the test oracle independent of implementation details?

Do not set a universal mutation percentage in this roadmap.

### P6 — independent verification is risk-conditioned

"Different agent for everything" is expensive and can still produce correlated
errors.

Use independent context/model/lens only when the expected information gain
justifies the cost.

The policy must distinguish:

- author relation;
- context relation;
- model-family relation;
- verification mechanism;
- deterministic tool evidence.

### P7 — deterministic mechanisms first

If a compiler, test runner, type checker, linter, structural test or security
scanner can answer a question, do not spend a model call pretending a judge is
more authoritative.

LLM review is for semantic gaps that deterministic tools do not cover.

### P8 — no silent degradation

If a required capability is unavailable:

- label it unavailable;
- run the named degraded path if one exists;
- lower the assurance verdict;
- escalate only when the remaining risk crosses policy.

Never present "same-context review" as "independent review", or "tests passed" as
"behavior verified" when the relevant test sensitivity is unknown.

## Target architecture

```text
Repository
   |
   v
Capability Discovery
   |
   +--> stack / workspace / package graph
   +--> build & test entrypoints
   +--> quality / security / architecture tools
   +--> CI enforcement
   +--> runtime / browser / observability access
   +--> review / evidence / traceability capabilities
   |
   v
Assurance Inventory
   |
   +--> available
   +--> missing
   +--> degraded
   +--> unknown
   +--> confidence + evidence refs
   |
   v
Change Risk Classifier
   |
   v
Assurance Policy Resolver
   |
   +--> required capabilities
   +--> optional capabilities
   +--> forbidden shortcuts
   +--> human decision points
   |
   +----------------------------+
   |                            |
 missing                     sufficient
   |                            |
   v                            v
Bootstrap Planner          Execution Planner
   |                            |
   v                            v
detect -> recommend ->    spec/test/implement/
configure -> verify       verify/review/runtime
   |                            |
   +-------------+--------------+
                 |
                 v
          Evidence Aggregator
                 |
                 v
          Assurance Verdict
                 |
                 +--> residual risk
                 +--> degraded paths
                 +--> human decisions owed
                 +--> autonomy ceiling
```

## Proposed project contract

Do not force users to author a giant configuration file.

AC first derives a default profile and only persists explicit overrides or facts
that cannot be reliably rediscovered.

Illustrative shape:

```yaml
assurance:
  profile: auto

  capabilities:
    testing:
      unit: discovered
      integration: discovered
      e2e: missing
      mutation_sensitivity: missing

    quality:
      static_analysis: discovered
      type_check: discovered
      architecture_constraints: unknown

    review:
      independent: available

  policy:
    risk_model: default
    legacy_mode: changed-surface

  overrides: {}
```

The canonical machine representation should be schema-versioned and generated by
AC. A human-readable report is a projection, not the source of truth.

## Risk model

Start with a small explainable classifier, not an opaque LLM-only severity score.

### R0 — non-behavioral

Examples: prose, comments, generated index refresh.

Typical floor:

- format/reference checks;
- no behavioral mutation/TDD ceremony.

### R1 — low behavioral risk

Examples: isolated presentation change, internal helper with strong callers/tests.

Typical floor:

- targeted test;
- static/type/lint checks;
- existing regression suite.

### R2 — normal product behavior

Examples: ordinary business rule, API handler, state transition.

Typical floor:

- behavior/acceptance statement;
- RED evidence where TDD applies;
- boundary + error cases;
- targeted + adjacent regression tests;
- static/type checks;
- independent review when review policy selects it.

### R3 — high risk

Examples: authentication, authorization, tenant isolation, payments, destructive
migration, public contract, concurrency, sensitive data.

Typical additions:

- abuse/security case;
- test-sensitivity probe (tool-assisted mutation or control inversion);
- independent/spec-first test authorship when the test-independence roadmap
  measures value;
- independent fresh-context review;
- architecture/security checks;
- integration/E2E/runtime evidence appropriate to the surface.

### R4 — critical / irreversible / risk acceptance

Examples: destructive production operation without recovery, cryptographic
boundary changes, compliance-critical policy, infrastructure blast radius beyond
the project's normal rollback envelope.

Typical additions:

- all relevant deterministic verification;
- explicit domain invariants;
- rollback/recovery proof;
- independent verification;
- human risk acceptance / product decision.

**Important:** risk classification is not the same as roadmap `complexity`.
Complexity says how difficult work is to execute; risk says how much evidence is
required before accepting it.

## Bootstrap behavior

The bootstrapper is not a universal installer. Its algorithm is:

1. Detect the stack and existing project conventions.
2. Detect which capability is missing for the requested risk.
3. Search project-local dependencies/configuration first.
4. Prefer extending an existing tool.
5. If a new tool is needed, present one recommended adapter and at most two
   justified alternatives.
6. Explain cost/runtime/maintenance impact.
7. Configure the smallest usable slice.
8. Prove the capability with a deliberately sensitive fixture or known failure.
9. Add CI enforcement only after local proof.
10. Record the capability evidence and re-run the readiness inventory.

### Example — PHP/Laravel

If Pest/PHPUnit and PHPStan already exist but mutation sensitivity is missing:

- do not add a second unit test framework;
- consider Infection for a high-risk changed surface;
- start with `--git-diff-lines` or equivalent;
- record survived mutants as findings rather than merely chasing a global MSI;
- treat timeouts separately because they can inflate mutation scores.

### Example — TypeScript/React

If Vitest + TypeScript + Playwright exist:

- reuse all three;
- add Stryker only when mutation evidence is policy-required and its measured
  signal justifies cost;
- use Playwright for user-visible behavior / visual or E2E evidence, not for
  pure logic that unit tests can answer more cheaply;
- use architecture/dependency tooling only if the repository has boundaries
  worth enforcing.

### Example — Python

If pytest exists:

- retain pytest;
- add Hypothesis for invariant-rich input spaces where example tests are weak;
- add mutmut only for selected changed surfaces if mutation evidence is required;
- use mypy/pyright and Ruff if they fit the project's existing type/lint posture.

## Evidence contract

A change verdict should be a structured projection over evidence, not prose such
as "all tests passed".

Illustrative shape:

```json
{
  "schema": "assurance-evidence/v1",
  "change": {
    "risk": "R3",
    "surface": ["src/Auth/Eligibility.php"]
  },
  "requirements": [
    {"id": "REQ-expired-token", "status": "linked"}
  ],
  "verification": {
    "test_red": {"status": "verified", "refs": ["..."]},
    "unit": {"status": "pass", "refs": ["..."]},
    "integration": {"status": "pass", "refs": ["..."]},
    "mutation_sensitivity": {
      "status": "pass",
      "method": "changed-lines",
      "survivors": 0,
      "timeouts": 0,
      "refs": ["..."]
    },
    "static_analysis": {"status": "pass", "refs": ["..."]},
    "security": {"status": "pass", "refs": ["..."]},
    "independent_review": {
      "status": "pass",
      "context_relation": "fresh",
      "refs": ["..."]
    }
  },
  "degraded": [],
  "residual_risk": [],
  "verdict": "verified"
}
```

Do not make every field mandatory. Required fields come from the resolved policy
for the change.

## Autonomy contract

The assurance engine may recommend or enforce an **autonomy ceiling**.

Example:

| State | Allowed behavior |
|---|---|
| A0 / unknown feedback | analyze, propose, create tests/bootstrap; no strong correctness claim |
| A1 | small changes with explicit degraded evidence |
| A2 | normal implementation with current human review policy |
| A3 | broader agent execution; independent review can satisfy more review load |
| A4 | high-risk autonomous iteration inside explicit boundaries |
| A5 | strong machine verification, but human decisions remain for irreversible/risk-acceptance actions |

This is not a permission system for merge authority. Merge authority remains a
separate user decision and existing AC governance applies.

The relation is:

```text
maximum justified autonomy = f(
  repository capabilities,
  change risk,
  evidence freshness,
  independence,
  reversibility,
  residual uncertainty
)
```

## Closure disposition — architectural-owner closure, 2026-08-23

**AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/gpt-4o),
convergent: option (a) architectural-owner closure + option (e3) vocabulary-only.**
Response: `agents/runtime/council/responses/assur-q3-closure-shape.md`. The
maintainer is unreachable in this autonomous drain run; a reversible internal
re-scope that weakens no safety floor and creates no external commitment is
council-decidable.

**Why this closure is not a scope dodge.** This umbrella and four sibling
roadmaps were landed by one `/analyze:inbox` run on 2026-08-22 from one inbox
drop. One of those siblings —
[`road-to-target-project-assurance-readiness`](road-to-target-project-assurance-readiness.md) —
has since been **executed and archived**, and its three named successors already
sit in `stubs/`. The umbrella was written as if none of that had happened. Live
reading taken 2026-08-23T13:26:33Z, from the tree rather than from this file's
prose:

| What | State | Where |
|---|---|---|
| 10-dimension target readiness grader, 4 knockouts, `L<n> — bound by <dimension>`, no aggregate figure | **shipped** | `src/scripts/grade_target_readiness.ts` |
| Deterministic R0–R3 risk classifier, no model call, self-protecting | **shipped** | `src/scripts/classify_change_risk.ts` |
| Wiring that class into completion claims + `src/config/assurance-policy.json` | **cancelled on a pre-registered null** — needed ≥ 60 human-labelled changes and a named external repo, neither producible by an agent. That config file does not exist. | `archive/road-to-target-project-assurance-readiness.md`, `blocker: b-human-risk-corpus` |
| `detect → recommend → bootstrap → verify → enforce` | **transferred** | `stubs/road-to-target-project-bootstrap-enforce.md` |
| Per-change aggregate evidence record + verdict | **transferred** | `stubs/road-to-target-project-evidence-contract.md` |
| Legacy violations-ratchet | **transferred** | `stubs/road-to-legacy-target-onboarding-ratchet.md` |
| Runtime / canary / rollback verification | **cut with a reason** — "needs a deploy platform AC does not own; stubbed, not planned" | same archived sibling; the grader prints the same reason at `grade_target_readiness.ts:270` |

So this roadmap closes as the thing it says it is in its own opening lines — the
architectural owner — and the disposition of each implementation step is recorded
below against exactly one of five verdicts: `build-now`, `already-shipped`,
`already-cancelled-measured`, `transferred`, `cut`. **No new engine, no new
active roadmap, no new skill, no new reviewer, no second grader.** Ticking 39
steps by writing 39 pieces of prose would be Risk 1 of this roadmap's own risk
register — assurance theatre — and is what the five-verdict ledger exists to
prevent.

### The vocabulary decision — (e3), and why not (e2)

The 19-term vocabulary of § P1 is registered as a **naming contract** in
`src/config/assurance-capability-registry.json`. The 10 shipped grader dimensions
remain the **only measurement instrument**. They are different surfaces with
different consumers: the vocabulary answers *"can this project's property tests be
named and owned?"*, the grader answers *"may an agent work here unsupervised?"*.

Declaring the 10 dimensions canonical (option e2) was rejected by both council
seats on one concrete failure: a later question about property tests would have to
split `test-presence` into `test-presence-unit` / `test-presence-property`, which
forks the grader and violates **AC-2**. The counter-argument was recorded rather
than waved away — a registry of 19 states looks like a grader waiting to be
built — and it is answered structurally: the states are **ownership pointers, not
measurement verdicts**, the registry declares the single grader by path, and
`tests/scripts/assurance_capability_registry.test.ts` fails if any projected
capability names an owner script other than that grader. Sabotage-probed.

**The one move both council seats said they would refuse, recorded so a later run
does not make it: building a second grader or any aggregate score.** It would
violate AC-2, AC-8, Risk 1, and the archived sibling's explicit anti-vanity cut.

### Checkbox convention used below

The five verdicts map onto two glyphs, and the rule is stated because reading it
off the boxes alone would be guesswork:

- **`[x]` — the `verify:` line is discharged.** Either an artefact in this change
  satisfies it, or a shipped surface already did, or it closes against a
  **recorded null** (a measured cancellation is an answer, not an omission).
- **`[-]` — the work left this roadmap.** Transferred to a named stub, or cut with
  a stated reason. Never `[x]`, because a completed roadmap must not read as an
  achieved goal.

`[~]` deliberately appears **nowhere**: nothing here is deferred without a
disposition, which is what lets this file archive without tripping
`roadmap-progress-sync` Iron Law 3.

**Every step below keeps its original `verify:` text and adds
`verify (discharged):` or `verify (cut):` with what was actually observed** —
including, in four places, a defect the step uncovered in its own premise.

## Phase 0 — inventory and overlap contract

**Verdict: `build-now`. Shipped in this change.**

- [x] **0.1 Pin and inventory every assurance primitive already shipped or
      actively roadmapped.** At minimum: TDD, test-case discovery,
      testing-anti-patterns, judge-test-coverage, quality-tools,
      verify-completion-evidence, review independence, test independence /
      mutation evidence, requirements traceability, security and architecture
      gates.
      verify (discharged): `src/config/assurance-capability-registry.json` maps
      all 19 vocabulary terms to exactly one `owner_surface` each, or to the
      literal `"none"` for the declared-missing case.
      `tests/scripts/assurance_capability_registry.test.ts` asserts it: one owner
      as a single string, every non-`none` owner path resolving on disk, and a
      `none` owner forced to `state: unknown` with `projection: null` — so a
      capability nobody owns can never read as available.
      **The ambiguity in this verify line is recorded rather than resolved
      silently.** "Duplicate owners are findings" has two readings and only one is
      a defect: a capability with TWO owners is ambiguous ownership and is
      asserted against; one surface owning MANY capabilities is the anti-sprawl
      outcome this roadmap wants, and `grade_target_readiness.ts` owning nine of
      them is the system working, so that direction is deliberately not asserted.
      The property that matters instead — exactly one grader, never a second — is
      asserted directly.
      Sabotage-probed 6 ways (owner `none` + state `available`; a second grader
      owning a projected capability; a `degraded` entry with no limitations; a
      parked sibling outcome laundered to `available`; a tool name in an
      identifier; a projection naming a dimension the grader does not emit) —
      each red, naming its own assertion, then restored byte-identical.

- [x] **0.2 Define the non-duplication boundary.** This roadmap owns discovery,
      policy resolution, bootstrap orchestration and aggregate assurance
      evidence. Existing skills/roadmaps continue to own their mechanisms.
      verify (discharged): the owner table is § Dependency / coordination table
      below, now carrying a disposition column, plus the machine-readable
      `owner_surface` field per capability in the registry. **No new skill and no
      new reviewer was introduced** — this change adds one JSON config and three
      vitest specs, and `git diff --name-only` over the branch contains no path
      under `src/skills/`.
      **A finding about this step's own claim.** The step asserts the umbrella
      owns "discovery, policy resolution, bootstrap orchestration and aggregate
      assurance evidence". Measured against the tree, it owns none of the four:
      discovery shipped in the sibling, policy resolution was cancelled there on a
      pre-registered null, bootstrap orchestration and aggregate evidence are
      transferred stubs. What it does own, and what it closes as, is the
      **vocabulary, the ownership record and the disposition** — which is what an
      architectural owner is.

- [x] **0.3 Register capability vocabulary v1.** Keep it tool-neutral and small.
      verify (discharged): 19 capabilities, each with `rationale` (its
      definition), `evidence`, a `state` drawn from the closed four-value
      vocabulary `available|missing|degraded|unknown`, a required `axis`, and a
      `revisit_if`. All five are asserted per entry. No capability identifier
      contains any of 20 tool names (pest, phpunit, phpstan, psalm, infection,
      vitest, jest, stryker, playwright, pytest, mutmut, mypy, pyright, ruff,
      bandit, semgrep, eslint, biome, deptrac, hypothesis) — asserted, and
      sabotage-probed by renaming `unit-test` to `pest-unit-test`, which reds.
      Registered states: 5 `available`, 5 `degraded`, 5 `unknown` for target-axis
      capabilities plus the three sibling-owned ones; `missing` is in the
      vocabulary and currently unused, which is recorded rather than pruned —
      "measured absent" and "nobody measured" are different facts.

- [x] **0.4 Separate risk from complexity.**
      verify (discharged): `tests/scripts/classify_change_risk_axes.test.ts`
      carries both fixtures and asserts them in **opposite** directions — a
      one-file auth change classifies **R3** (`R3 — override-list path:
      src/Auth/Eligibility.php (1 file(s))`) while a forty-file generated-doc
      change classifies **R0** (`R0 — every touched path is non-behavioural (40
      file(s))`). A third case pins that neither class moves as size grows.
      **The blind spot this closed was measured, not assumed.** The shipped
      classifier's own seven-case self-test varies risk while holding file count
      at one, so it cannot distinguish "classifies risk" from "classifies size".
      Sabotage probe — make `classifyPaths` return R3 above 10 paths, i.e. let
      complexity drive risk: the new spec goes **2 of 5 red** and the shipped
      self-test stays **7/7 green**. Restored, diff empty.
      **A finding the step uncovered in its own premise.** The auth pattern
      `/(^|\/)auth(\/|$)/i` matches a whole path *segment*, so `app/Auth/Guard.php`
      is R3 but `src/Http/AuthController.php` is **R2** — a safe-side reading of an
      authorization change, not a correct one, since R2 does not request the abuse
      case § Phase 2.3 expects at R3. Pinned by an assertion and **not fixed
      here**: the classifier is owned by an archived sibling, is R3-protected by
      its own override list, and widening the pattern would reclassify paths across
      the whole tree — a change that needs its own evidence.
      *Revisit-if:* an authorization defect lands in a file whose auth-ness is in
      the filename rather than the directory.

## Phase 1 — repository assurance discovery

**Verdict: `already-shipped` — `src/scripts/grade_target_readiness.ts`, by the
archived sibling. One unasserted invariant was closed here (1.3).**

- [x] **1.1 Build stack/workspace discovery adapters.** Reuse current code
      intelligence/project discovery surfaces where possible.
      verify (discharged): `already-shipped`. Ten dimensions probed in one pass
      across five ecosystems, with committed fixtures at
      `tests/fixtures/target-repos/{full,ci-absent,python}` and 17 assertions in
      `tests/scripts/grade_target_readiness.test.ts`.
      **Two gaps in this step's own verify line, measured and recorded.** It asks
      for "at least PHP/Laravel, TypeScript/React and Python, **including one
      monorepo with mixed workspaces**". PHP, TS and Python are covered; there is
      **no monorepo fixture**, so the mixed-workspace half is not discharged and is
      not claimed. It is also not this roadmap's to build: monorepo scope and
      detection is an active sibling
      ([`road-to-monorepo-scope-and-detection`](../road-to-monorepo-scope-and-detection.md)),
      and adding a competing workspace probe here would violate AC-2.
      *Revisit-if:* that sibling lands a workspace model the grader can consume.

- [x] **1.2 Discover executable entrypoints, not package names alone.** A
      dependency in a lockfile is not proof that a capability works.
      verify (discharged): `already-shipped`, and the shipped shape is **stronger
      than a lockfile read but weaker than this verify line asks**, stated rather
      than rounded up. The grader's 1 → 2 distinction is whether CI *blocks* on a
      capability: `_ciBlocks` requires the tool to be mentioned in a workflow and
      the workflow not to mark every job `continue-on-error`, so a config nobody
      runs grades 1 and a config a blocking job runs grades 2. The `ci-absent`
      fixture differs from `full` only by the absence of `.github/workflows/` and
      grades `L0 — bound by CI enforcement`.
      **What is NOT discharged:** the fixture with an *installed-but-broken* test
      runner. The grader never executes the runner, so a broken one grades
      `Present`, not `degraded`. Proving a capability by running it is the
      `prove` step of `stubs/road-to-target-project-bootstrap-enforce.md`, whose
      rule 1 states it in as many words: "a written config is not a capability".
      Recorded as transferred rather than met.
      **Also honest about the heuristic:** per-job `continue-on-error` attribution
      needs a YAML parse; the shipped check is coarse and says so in its own
      source comment.

- [x] **1.3 Bind every discovered capability to evidence.** Examples: command,
      config path, CI job, schema, test fixture.
      verify (discharged): `build-now` **inside** an already-shipped surface, and
      this is the one place Phase 1 was genuinely incomplete. The property already
      HELD — every dimension in all three fixtures emits a non-empty `evidence`
      string and both `null` grades carry a `notDetectable` reason — but **nothing
      asserted it**, so an eleventh dimension could have shipped with
      `evidence: ''` and no gate, test or reviewer would have noticed.
      Closed by the `1.3 evidence binding` block appended to
      `tests/scripts/grade_target_readiness.test.ts`: every dimension in every
      fixture carries a non-empty evidence ref, a `null` grade always states why
      it is not detectable, and a graded one never does. Sabotage-probed both ways
      — blanking one `evidence` string reds the first assertion, deleting one
      `notDetectable` reds the second — then restored, diff empty. 19/19 green.
      The grader was not rebuilt; an unasserted invariant was pinned.

- [x] **1.4 Produce a human-readable `agent readiness` report.** Report the
      vector, critical gaps and confidence. A scalar score may be displayed only
      as a secondary convenience and may never determine policy.
      verify (discharged): `already-shipped`, and **stricter** than this line
      permits. No scalar is displayed at all, not even as a convenience: the
      grader's docstring states "No aggregate number is ever emitted — no
      percentage, no x/100, no mean", and `renderMatrix` carries a test that greps
      its own output for `%` and `/100`. Removing a critical behavioural capability
      changes the level because the verdict is `min` over the four knockouts, and
      an undetectable knockout binds at L0 with its reason printed — asserted, and
      sabotage-probed by the sibling run at `max` instead of `min` (3 of 17 red)
      and at `0` instead of `null` (4 red).

## Phase 2 — risk-to-assurance policy engine

**Verdict: split. The classifier is `already-shipped`; the policy resolver is
`already-cancelled-measured` on a pre-registered null, and its config file does
not exist.**

- [x] **2.1 Define R0-R4 with deterministic signals first.** File/path signals,
      public contracts, migrations, auth/security surfaces, infrastructure
      blast-radius markers and explicit user intent should precede LLM
      classification.
      verify (discharged): `already-shipped` for the deterministic half, and the
      divergence is recorded rather than glossed. `classify_change_risk.ts` makes
      **no model call by construction** — its docstring: "the whole point is a
      class an agent cannot talk itself out of, and a classifier that asks a model
      is the agent's self-label wearing a script's clothes". Ties and unknowns
      resolve upward; an empty path set is R3. Golden fixtures produce stable
      classifications with no model involved, asserted by a seven-case self-test
      plus the five cases added in 0.4.
      **The shipped classifier has FOUR classes, not five:** `R0 cosmetic · R1
      internal · R2 behaviour-changing · R3 critical`. `R4` occurs zero times in
      that file. This roadmap's § Risk model describes an R4
      "critical / irreversible / risk acceptance" band; it is **not implemented**,
      and the substance of it is not missing from the tree — irreversible and
      risk-acceptance actions are governed by the Hard Floor
      (`non-destructive-by-default`), which is a permission gate rather than a
      risk class. Recorded as a deliberate divergence: adding a fifth class to a
      classifier whose four-class output was never validated against a human
      corpus would give an unvalidated band real authority.
      *Revisit-if:* a human-labelled corpus exists and shows R3 conflating two
      populations that need different evidence.

- [x] **2.2 Add semantic classification only for unresolved cases.**
      verify (discharged): `already-cancelled-measured`, and it discharges as a
      **stronger** null than the step imagined. There is no semantic tier at all —
      not "absent for deterministic fixtures", absent entirely — so the
      "stored with rationale/confidence for ambiguous fixtures" half has nothing
      to store. Unresolved cases resolve **upward** instead, which is the
      conservative direction and needs no model. The archived sibling records why
      a model tier was never reached: its Phase 2 was cancelled because the
      class had no validated ground truth, and giving an unvalidated class real
      authority is Risk 7 there.
      *Revisit-if:* the `> 40 %` R3-rate defect threshold in the classifier's own
      docstring fires, which would mean the override list — not a missing model —
      is the problem.

- [x] **2.3 Resolve required/optional/forbidden capabilities from
      `(risk, project capabilities, change type)`.**
      verify (discharged): `already-cancelled-measured`. The resolver's home was
      `src/config/assurance-policy.json`, the archived sibling's Phase 2 file, and
      that file **does not exist** — verified 2026-08-23. Its blocker
      `b-human-risk-corpus` names the missing input: ≥ 60 independently
      human-labelled R0–R3 changes with the labeller blind to the classifier, plus
      a named external target repository. Neither is producible by an agent.
      The half of this step that shipped anyway is worth naming: the R0 side is
      already true — R0/R1 owe nothing expensive because the classifier's verdict
      **owes no gate at all** ("nothing consumes this class"). The R3 side —
      "R3 auth does request an abuse case and independent verification when
      available" — is exactly what the cancelled wiring would have done, and it is
      unbuilt.

- [x] **2.4 Define degraded paths.**
      verify (discharged): `build-now`, at the vocabulary layer, and honestly
      partial. `missing → silently skipped` is unrepresentable **in the
      registry**: a `degraded` capability must carry a non-empty `limitations`
      array and a non-`degraded` one must not, both asserted and sabotage-probed
      (deleting `independent-review`'s limitations reds). That makes § P8's floor —
      "never present same-context review as independent review" — checkable, which
      it was not before.
      **What is NOT built:** the per-required-capability tri-state
      `satisfied | degraded-with-named-substitute | human-gate` for a *change*.
      That needs the policy resolver 2.3 records as cancelled, so it is recorded
      as blocked on the same missing corpus rather than as met.

## Phase 3 — capability bootstrap

**Verdict: `transferred` in full to
[`stubs/road-to-target-project-bootstrap-enforce.md`](../stubs/road-to-target-project-bootstrap-enforce.md),
which already exists and was written from the same inbox drop. Nothing here is
abandoned; the scope decision was already taken and the stub is capability-gated
on fixture projects, package installs and a promotion-time tool-maintenance
re-check that no repository automation supplies.**

- [-] **3.1 Add adapter registry keyed by capability + ecosystem.** Keep
      recommendation logic separate from installation commands.
      verify (discharged): `transferred`. The stub carries the per-stack candidate
      table (TS/React, PHP/Laravel, Python) and states the separation as its own
      constraint — the loop lives "as mode bodies under
      `quality-tools/references/`, one per stack, **not** as new skills (estate
      ratchet)". The vocabulary half of this step is met here: the registry is
      keyed by capability and holds no tool name, so adding an adapter cannot
      change policy vocabulary.

- [-] **3.2 Prefer existing project tooling.**
      verify (discharged): `transferred`, and the stub states the rule in its own
      words for each stack — "do not add a second unit test framework", reuse
      Pest/PHPUnit and PHPStan where present. The fixture assertions this verify
      line asks for need fixture *projects* with installed toolchains, which the
      three committed target-repo fixtures deliberately are not: they are
      config-presence fixtures for the grader, not runnable projects.

- [-] **3.3 Implement `detect -> recommend -> configure -> prove -> enforce`.**
      The "prove" step must deliberately exercise failure sensitivity before CI
      enforcement.
      verify (discharged): `transferred`, and the stub's rule 1 is this verify
      line: "`verify` runs the generated config once and fails the bootstrap if
      the tool does not execute — a written config is not a capability." Its
      rule 4 adds that `enforce` means a CI job without `continue-on-error` plus a
      required status check, and that the parent's matrix must move the dimension
      from 1 to 2 — which is the acceptance test. Note the ordering the stub
      chose deliberately: `enforce` is planned **before** `bootstrap` runs,
      because "a tool that does not block CI does not exist for an agent".

- [-] **3.4 Add legacy changed-surface mode.**
      verify (discharged): `transferred`, to a *different* stub —
      [`stubs/road-to-legacy-target-onboarding-ratchet.md`](../stubs/road-to-legacy-target-onboarding-ratchet.md),
      which owns exactly this: a violations-ratchet so a low-coverage target has a
      path, generalising the PHPStan baseline policy at
      `quality-tools/references/php-tools.md:170-174`. Recorded as a separate
      transfer rather than folded into 3.1-3.3, because the two stubs have
      independent promotion conditions.

- [-] **3.5 Mutation adapters are evidence probes, not score factories.**
      Start with changed-line/file modes where supported; surface survivors and
      timeout inflation separately.
      verify (discharged): `transferred` for the adapter; **the policy half is met
      here and now**, which is the part that could have gone wrong silently.
      `src/config/assurance-capability-registry.json` contains **no min-MSI
      constant and no mutation threshold of any kind**, and `mutation-sensitivity`
      is registered `degraded` with its limitations naming detection-only
      operation and the explicit line that no universal min-MSI constant exists
      here or may be added. The stub carries the diff-scoped requirement
      (Infection `--git-diff-lines`, Stryker `--incremental`) and the R2 < 5 min
      latency budget. The `97 %`-with-timeouts fixture needs a mutation run, which
      needs the adapter — transferred with it.
      Also recorded: for **this package's own** suite a tool-assisted rig was
      **REFUSED on measured grounds** by the archived test-independence sibling —
      hand-probing kept up, 10 probes in minutes — so the substitute is named, not
      silent (`testing-anti-patterns/SKILL.md:185`).

## Phase 4 — compose existing TDD, test independence, review and traceability

**Verdict: split. 4.1–4.4 are `build-now` and shipped in this change as the
sibling-disposition record; 4.5 is `transferred`.**

- [x] **4.1 Route policy-selected TDD into the existing
      `test-driven-development` skill.** Do not duplicate its RED/GREEN logic.
      verify (discharged): **no new TDD skill or command was added** —
      `git diff --name-only` over this branch contains no path under
      `src/skills/` and no new command. The route is recorded in the registry:
      `test-red-evidence` declares `owner_surface:
      src/skills/test-driven-development/SKILL.md` with `projection: null` and the
      reason that an observed failing test is a fact about a run which no
      repository scan can recover (`SKILL.md:140`).
      **The word "policy-selected" is not discharged and is not claimed**: there
      is no policy resolver to select it (2.3, cancelled). What is discharged is
      that the capability is named, owned exactly once, and not duplicated.

- [x] **4.2 Consume the outcome of
      `road-to-test-independence-and-mutation-evidence`.** If its experiment
      returns null, do not force spec-first independent test authorship. If it
      passes, make that capability selectable for the risk classes justified by
      its own evidence.
      verify (discharged): capability availability follows the sibling
      disposition, not this roadmap's preference —
      **`independent-test-author` = `unknown`** (AI council 2/2, pick 1a). The
      sibling returned `unmeasurable-here`, its pre-registered third state, which
      is neither a null nor a refutation: the measurement did not run for want of
      a subagent dispatch primitive. Recorded with its evidence ref
      (`agents/evidence/analysis/test-independence-unmeasurable.md`) and with the
      explicit note that it must never be read back as evidence *against*
      spec-first authorship. Policy cannot select it, and an assertion forbids the
      state `available` for it.
      The sibling's other measured outcomes are recorded too, so a later reader
      does not re-derive them: watched-fail **PASS** (30 % survivors of 10 hand
      probes against a pre-registered > 10 % threshold), tool-assisted rig
      **REFUSED (measured)**, and a `test_authorship` envelope field shipped with
      `unknown` as its default.

- [x] **4.3 Consume `road-to-review-independence`.**
      verify (discharged): **`independent-review` = `degraded`** (AI council 2/2,
      pick 2b), and same-session self-review cannot satisfy it — the state is
      forced to carry its limitations, and one of them is the record that
      `self_review_gate.ts:471` still hardcodes `independenceFields(['anthropic'])`.
      The author/context relation the review roadmap defines is what the
      capability points at: `dispatch_r2_reviewer.ts` emits `single-member` /
      `fresh` with the derived pair `provisional` / `single-pass`. `degraded`
      rather than `available` because one member cannot supply the model-family
      axis, and because `check_review_schema` reports `scanned: 1` in this
      repository — a corpus of one, indistinguishable from a conforming corpus.

- [x] **4.4 Consume requirements-traceability only at its measured adoption
      level.**
      verify (discharged): optional traceability remains optional —
      **`requirement-trace` = `degraded`** (AI council 2/2, pick 3b), with all
      four of the sibling's falsifiers recorded by name and state
      (`no_opportunity` FIRED, `no_adoption` FIRED, `poor_resolution` not fired,
      `no_demonstrated_value` not evaluable). Enforcement is parked and nothing
      here tightens it.
      **The council overruled its own earlier round here**, and the reasoning is
      the load-bearing part: two earlier reviewers picked `available` on the ground
      that "the capability exists; policy chooses not to enforce it", and the final
      round rejected that as an internal contradiction — `state: available` beside
      `no_adoption: fired` is precisely the laundering this roadmap's
      `sibling-roadmap-dispositions` blocker exists to prevent. A measured
      constraint is not a policy preference.

- [-] **4.5 Introduce one aggregate assurance evidence schema.** Existing
      evidence stays source-of-truth and is referenced, not copied.
      verify (discharged): `transferred` to
      [`stubs/road-to-target-project-evidence-contract.md`](../stubs/road-to-target-project-evidence-contract.md),
      which owns `agents/evidence/changes/<sha>.evidence.json`, its gate-written
      vs agent-written field split, and the refs-not-copies principle this step
      states. **Deliberately not built here**, and the reason is this roadmap's own
      AC-2: writing a schema whose owner is an existing stub would be the
      duplication the closure forbids. One council member's ordered artefact list
      did propose building it, contradicting that member's own disposition table;
      the table is followed and the contradiction is recorded.
      What IS discharged is the reference discipline on the target axis: every
      graded dimension carries an evidence string rather than a copied log, and
      that is now asserted (1.3).

## Phase 5 — application and runtime verification

**Verdict: `cut`, with the reason stated by the archived sibling and echoed by the
shipped grader: runtime verification needs a deploy platform this package does
not own. This is a cut, not a silent drop — the grader reports the dimension as
`not detectable` with that reason in its own output rather than grading it 0.**

Static source gates are not enough for user-visible and operational behavior.

- [-] **5.1 Detect whether the project can boot an isolated change instance.**
      Prefer existing Docker/devcontainer/worktree/runtime mechanisms.
      verify (cut): `cut`. `grade_target_readiness.ts:270` records
      `notDetectable: 'needs a deploy platform this tool does not own'`, and the
      archived sibling's *What this roadmap will not build* table cuts runtime
      verification with the same reason: "stubbed, not planned".
      *Revisit-if:* this package gains a deploy or runtime surface it owns.

- [-] **5.2 Add runtime probes selected by surface.** Examples: HTTP smoke,
      browser flow, CLI invocation, queue/event observation, migration dry-run.
      verify (cut): `cut` with 5.1 — a probe needs the bootable instance 5.1 was
      cut for. The `runtime-verification` dimension exists in the grader and is
      permanently `not detectable`, so the gap is visible rather than absent.

- [-] **5.3 Make observability agent-readable when locally available.** Logs,
      metrics and traces should be queryable evidence, not screenshots pasted by
      a human.
      verify (cut): `cut` here, and **not** cut from the tree: observability is an
      active sibling roadmap of its own
      ([`road-to-observability-plate`](../road-to-observability-plate.md)). Building
      a second observability surface inside an assurance umbrella would violate
      AC-2. Recorded as owned elsewhere rather than as unwanted.

- [-] **5.4 Never infer production safety solely from local runtime success.**
      verify (cut): vacuously satisfiable and therefore cut rather than ticked —
      with 5.1-5.3 cut there is no local runtime success to over-read. Ticking it
      would be the cheapest kind of assurance theatre. The substance is not
      missing: production-affecting actions are gated by the Hard Floor
      (`non-destructive-by-default`), which requires this-turn confirmation and
      which no assurance level lifts.

## Phase 6 — assurance verdict and autonomy ceiling

**Verdict: split. 6.2 and 6.3 are `already-shipped` as *reports* — the grader
grants nothing and blocks nothing; 6.1 and 6.4 are `transferred` to the evidence
contract that owns a per-change verdict.**

- [-] **6.1 Implement the structured verdict:** `verified`, `verified-degraded`,
      `blocked`, `human-decision`, `unknown`.
      verify (discharged): `transferred`. `verified-degraded` occurs zero times in
      `src/`, verified 2026-08-23; the per-change verdict is owned by
      `stubs/road-to-target-project-evidence-contract.md`, which specifies
      `verdict ∈ {pass, no-commit, escalate}` and — the part worth carrying
      forward — that "the verifier generates it, the human or the merge gate
      authorises it; these are never the same party".
      **What is discharged here is the property, not the enum:** "tests pass" alone
      cannot produce a positive verdict, because the readiness verdict is `min`
      over four knockouts and an undetectable knockout binds at L0. A repository
      with green tests and no blocking CI reports `L0 — bound by CI enforcement`,
      which the `ci-absent` fixture asserts.

- [x] **6.2 Compute the autonomy ceiling from evidence, not a global setting.**
      verify (discharged): `already-shipped` **as a report**, and the distinction
      is the honest scope. `L<n> — bound by <dimension>` is computed per
      repository from that repository's own evidence, so identical
      code-generation capability does receive a different level in an A1 vs an A4
      repository — the `full` fixture grades `L2` and `ci-absent`, differing only
      by the absence of `.github/workflows/`, grades `L0`.
      **The words "autonomy ceiling" appear nowhere in `src/`** — verified — and
      nothing consumes the level to widen or narrow what an agent may do. So the
      *derivation* is shipped and the *enforcement* is not; the enforcement half is
      transferred to `stubs/road-to-target-project-bootstrap-enforce.md`, which
      needs a policy decision on thresholds that § blocker
      `assurance-enforcement-thresholds` governs.

- [x] **6.3 Preserve merge/user authority as a separate concern.**
      verify (discharged): `already-shipped`, and this one is structurally
      guaranteed rather than merely intended. No assurance level auto-grants merge
      permission because the grader **cannot**: its documented exit contract is
      `0` for any matrix "including L0 — a low grade is a finding about the
      target, never a failure of this gate", asserted by
      `expect(main(['--quiet','--target',full])).toBe(0)`. A gate that always
      exits 0 grants and withholds nothing. Merge authority remains governed by
      `non-destructive-by-default` and `commit-policy`, which no level touches.

- [x] **6.4 Add residual-risk reporting.**
      verify (discharged): split, and both halves are recorded. **Discharged at
      the capability layer:** every `degraded` capability must name its
      limitations, which is a residual-risk entry per degraded path, asserted and
      sabotage-probed. **Transferred at the change layer:** a per-change
      `residual_risk` field is owned by
      `stubs/road-to-target-project-evidence-contract.md`, which routes it from
      `risk-officer/SKILL.md:79`. The "named justification that the substitute
      closes the same property" alternative is exercised once, in
      `mutation-sensitivity`, whose named substitute is the manual
      control-inversion probe.

## Phase 7 — default-workflow integration

**Verdict: split. 7.2 and 7.3 are `already-shipped`; 7.1 is
`already-cancelled-measured` — it is precisely the wiring the sibling cancelled on
a pre-registered null; 7.4 is `already-shipped` and now asserted.**

- [x] **7.1 Add assurance assessment to normal planning/execution, not only a
      hidden expert command.**
      verify (discharged): `already-cancelled-measured`. This step and the
      archived sibling's cancelled step 2.1 are the same work — "a new step in the
      procedure of `verify-completion-evidence/SKILL.md` runs
      `classify_change_risk.ts` and prints the class and the owed gate set before
      the existing fresh-output gate". It was cancelled with its phase because the
      owed-gate table lived in `src/config/assurance-policy.json`, which does not
      exist, and because giving an unvalidated class authority over every
      completion claim is Risk 7 there. The classifier's own docstring states the
      consequence without hedging: "nothing consumes this class".
      **Not re-decided here.** Re-wiring it would overturn a measured null on
      preference, which is the one thing the `sibling-roadmap-dispositions`
      blocker forbids.
      *Revisit-if:* the human-labelled corpus that blocker names is supplied.

- [x] **7.2 Provide an explicit doctor surface for humans.** Suggested UX:
      project readiness, missing capabilities, why they matter, and "build this
      capability" actions.
      verify (discharged): `already-shipped`, and the "never a second scanner"
      requirement is met **literally**: `/project:analyze` invokes
      `./scripts-run src/scripts/grade_target_readiness --target <project root>`
      (`project/analyze/command.md:40`) and prints its output **verbatim**
      (`:83` — "READINESS (verbatim from grade_target_readiness)"). The doctor is a
      projection over the same engine because it is the same process.
      **What is missing and not claimed:** the "build this capability" actions.
      Those are the bootstrap loop, transferred to
      `stubs/road-to-target-project-bootstrap-enforce.md`. The report says what is
      absent; it cannot yet offer to fix it.

- [x] **7.3 Keep trivial work trivial.**
      verify (discharged): `already-shipped`, and trivially so in the strongest
      sense — R0/R1 changes trigger no council, no mutation run and no browser
      boot because **no risk class triggers any of them**: the classifier's verdict
      owes no gate at all. The R0 side of this step is therefore met by
      construction, and the assertion in 0.4 pins that a forty-file generated-doc
      change stays R0 rather than escalating on size.
      Recorded honestly: this step is met for the reason 7.1 was cancelled, not
      because a cost-aware policy chose to spare cheap changes.

- [x] **7.4 Make failures instructional.** Tool/gate output should tell an agent
      what property failed and where to find detailed logs.
      verify (discharged): `already-shipped` and, as of this change, **asserted**.
      Bounded stdout: the readiness output is a fixed ten-row matrix plus one
      verdict line, and every row carries the evidence string that says which
      property was read — `no workflows`, `every job is continue-on-error`,
      `lockfile; no SAST config; no blocking audit step`. A not-detectable row
      states why rather than reporting a false absence. The 1.3 block now fails if
      any row's reason is empty, so an uninstructive failure cannot ship silently.
      The durable-log half applies to large failures this surface does not produce.

## Phase 8 — evaluation before stronger enforcement

**Verdict: `transferred` in full to
[`stubs/road-to-assurance-benchmark.md`](../stubs/road-to-assurance-benchmark.md),
created in this change, plus the pre-registration
`src/config/assurance-threshold-budget.json` that makes the transfer honest —
see § blocker `assurance-enforcement-thresholds`.**

**Q3 and Q2 disagreed here and the more preservation-friendly verdict wins.** The
closure-shape council (Q3) tabled Phase 8 as `cut`; the threshold council (Q2),
asked the same question with the pre-registration in front of it, returned
`(i) transfer to a successor stub` — both seats, explicitly, "to prevent roadmap
stall". `cut` and `transferred` differ in exactly one thing, whether a successor
exists, and `roadmap-progress-sync`'s deferred-item preservation test prefers the
disposition that keeps the item alive in the estate. So the phase transfers. The
disagreement is recorded rather than silently reconciled.

Nothing in this roadmap became blocking, so nothing needs the benchmark yet; the
pre-registration exists so that whatever becomes blocking later cannot register
its thresholds after seeing the results.

- [-] **8.1 Build a frozen benchmark corpus across risk classes.** Include
      known bugs, weak tests, architectural violations, security mistakes,
      legacy debt and false-positive traps.
      verify (discharged): `transferred` to
      [`stubs/road-to-assurance-benchmark.md`](../stubs/road-to-assurance-benchmark.md).
      No corpus exists and none can be built inside a drain run: it needs seeded
      defects across risk classes in real target repositories, plus a labeller
      independent of the harness. The neighbouring requirement — ≥ 60
      human-labelled changes with a blind labeller — is already on record as
      unobtainable by an agent in the archived sibling's
      `blocker: b-human-risk-corpus`. The stub's promotion probe names "a named
      external target repository" as its first condition.

- [-] **8.2 Measure false confidence, not only catch rate.** Track cases where
      the system said `verified` and a seeded defect survived.
      verify (discharged): `transferred` with 8.1 — a false-verified rate needs
      seeded defects to survive. But the metric is **first-class today, not on
      promotion**: `false_verified_rate` is pre-registered by name in
      `src/config/assurance-threshold-budget.json` with `threshold: null`,
      `measurement: null` and a `set_when` clause naming Phases 8.1 + 8.2 + 8.4.
      A spec asserts that a number cannot appear there without a measurement
      beside it, sabotage-probed by setting `0.05` with a null measurement — red.

- [-] **8.3 Measure cost and latency by assurance capability.**
      verify (discharged): `transferred` with 8.1. Pre-registered as `cost_budget`
      with the unit spelled out (`{p50_seconds, p50_tokens, p95_seconds,
      p95_tokens}`) and — the one asymmetry worth keeping — a `set_when` that does
      **not** require the ablation, so cost is settleable before the other three.
      Note what would have to be measured for this to mean anything: the grader is
      a single filesystem pass with no model call, so its own cost is not the
      interesting number — the interesting number belongs to the mechanisms
      Phase 3 would bootstrap, which are transferred.

- [-] **8.4 Run ablations.** Compare baseline AC vs:
      - risk policy only;
      - risk + bootstrap;
      - risk + independent review;
      - risk + mutation sensitivity;
      - full assurance composition.
      verify (discharged): `transferred` with 8.1, and this step is why waiting is
      correct rather than merely convenient: **three of the five arms do not exist
      to be ablated.** No risk *policy* (2.3, cancelled — its config file does not
      exist), no bootstrap (Phase 3, transferred), no mutation run (3.5 — the
      grader detects config presence and never executes a pass). An ablation over
      unbuilt arms measures nothing. The stub's promotion probe therefore requires
      **two** runnable arms, deliberately not five: one arm is not an ablation, and
      five would make the file unpromotable until every transferred sibling lands.

- [-] **8.5 Tighten only supported policies.** An attractive mechanism with null
      incremental signal is parked, not institutionalized.
      verify (discharged): `transferred` **and vacuously satisfied today**, which is
      worth stating precisely because it is the criterion most easily faked. This
      change makes **nothing blocking**: the registry is read by tests, the grader
      always exits 0, and no gate was added — so there is no blocking policy that
      could lack a predating benchmark artifact.
      The rule survives as the pre-registration, and it binds **before** the stub
      is promoted: `registered_at` is a cutoff, so a policy proposed after it is
      governed by these thresholds even while they are null. What keeps that from
      becoming a universal minimum — the vanity constant AC-8 forbids under
      another name — is `dimension_applicability`, which keys governance to
      observable policy characteristics rather than author claims, plus a
      `safety_floor_exemption` so a hard red line may block without an empirical
      uplift claim. Sabotage-probed by deleting that exemption — red.
      **What is promised and deliberately not shipped:** the enforcement gate. It
      is deferred because there is no proposed blocking policy to test it against,
      and because here a new gate script trips three ratchets while a gate over an
      empty corpus exits green — worse than absent. Named as the stub's first step
      on promotion.

## Suggested child-roadmap boundaries

This umbrella should remain the architectural owner. Implementation should be
split only where a child has an independent acceptance surface.

1. `road-to-assurance-capability-model`
   - vocabulary, discovery evidence, schema, readiness projection.
2. `road-to-risk-adaptive-assurance`
   - R0-R4 classifier and policy resolver.
3. `road-to-assurance-bootstrap`
   - adapter registry and detect/recommend/configure/prove/enforce.
4. `road-to-assurance-evidence-contract`
   - aggregate refs, residual risk, verdict.
5. `road-to-runtime-verification-surface`
   - bootability, browser/API/runtime/observability probes.
6. `road-to-assurance-benchmark`
   - frozen corpus, false-confidence metric, cost/latency ablations.

Do **not** create children for TDD, test independence, review independence or
requirements traceability while their current owners exist.

## Dependency / coordination table

This is the **owner table** step 0.2's verify line asks for. The `Disposition`
column is what closure added; every row is now closed against a fact in the tree
rather than an intention, and four rows changed meaning between authoring and
closure — those are marked.

| Capability | Current owner | Planned action | Disposition at closure (2026-08-23) |
|---|---|---|---|
| TDD RED/GREEN/REFACTOR | `src/skills/test-driven-development/SKILL.md` + `/tdd` | route/reuse | **routed, not duplicated.** Registered as `test-red-evidence`, `projection: null` — an observed failing test is a fact about a run no repository scan recovers. No new TDD skill added. |
| Test anti-gaming / manual mutation probe | `src/skills/testing-anti-patterns/SKILL.md` | route/reuse | **routed.** The named substitute for `mutation-sensitivity`; a tool-assisted rig for AC's own suite was REFUSED on measured grounds (`SKILL.md:185`). |
| Independent test authorship experiment | `archive/road-to-test-independence-and-mutation-evidence.md` | consume disposition | **consumed → `unknown`.** `unmeasurable-here`, the pre-registered third state. Council 2/2. |
| Fresh-context review | `archive/road-to-review-independence.md` | consume capability | **consumed → `degraded`.** Dispatcher shipped; single-member, `provisional`/`single-pass`. Council 2/2. |
| Requirement → acceptance → evidence links | `archive/road-to-requirements-traceability-minimal.md` | consume measured adoption | **consumed → `degraded`.** Schema ships; enforcement parked under two FIRED falsifiers. Council 2/2. |
| Static/type/lint tools | `src/skills/quality-tools/SKILL.md` and stack skills | discover/reuse | **discovered, with the gap recorded.** PHP and JS/TS mode bodies only; on a Python target the dimension is `not detectable`, never 0, and binds at L0. |
| Completion evidence | `src/skills/verify-completion-evidence/SKILL.md` | aggregate by reference | **reference discipline met on the readiness axis** (asserted); the per-change aggregate is transferred to the evidence-contract stub. That skill still emits prose. |
| Assurance inventory | ~~**missing**~~ | build here | **BUILT HERE.** `src/config/assurance-capability-registry.json` + `tests/scripts/assurance_capability_registry.test.ts`. The one row this roadmap genuinely owned and closed. |
| Risk → required verification policy | ~~**missing as one canonical layer**~~ | build here | **CHANGED — half shipped elsewhere, half cancelled measured.** `classify_change_risk.ts` ships the class (R0–R3, no model call); the resolver's config `src/config/assurance-policy.json` does not exist and its phase was cancelled for want of a human-labelled corpus. |
| Bootstrap orchestration | ~~**missing**~~ | build here | **CHANGED — transferred**, before this roadmap ran, to `stubs/road-to-target-project-bootstrap-enforce.md` (+ the legacy ratchet stub for the changed-surface half). |
| Autonomy ceiling | ~~**missing**~~ | build here | **CHANGED — derivation shipped, enforcement absent.** `L<n> — bound by <dimension>` is computed per repository; the words "autonomy ceiling" occur nowhere in `src/` and nothing consumes the level. The grader always exits 0, so it grants nothing. |
| Runtime evidence composition | partial / stack-specific | unify here | **CHANGED — cut with a stated reason**, and visibly: the dimension exists and is permanently `not detectable` with the reason printed. Observability itself is owned by an active sibling, `road-to-observability-plate`. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Assurance theater | product | More green badges create more confidence without catching more defects | frozen corpus, false-verified metric, ablations before enforcement | Phase 8 — evaluation before stronger enforcement |
| 2 | Duplicate AC mechanisms | implementation | umbrella reimplements TDD/review/traceability | explicit ownership table + no-dup acceptance criteria | Phase 0 — inventory and overlap contract |
| 3 | Tool sprawl | implementation | AC installs fashionable tools beside project-native equivalents | capability-first registry + prefer-existing rule | Phase 3 — capability bootstrap |
| 4 | Mutation cargo cult | product | universal MSI threshold becomes the goal | changed-surface probes, survivor findings, no universal core threshold | P5 — test sensitivity beats raw coverage |
| 5 | Cost explosion | product | every change triggers browser + mutation + multiple reviewers | R0-R4 risk selection + measured incremental value | Phase 2 — risk-to-assurance policy engine |
| 6 | Correlated agent errors | implementation | multiple agents repeat the same mistaken premise | independence metadata + deterministic oracles + spec-first only if measured | P6 — independent verification is risk-conditioned |
| 7 | Legacy lockout | product | old repos can never become "agent-ready" | changed-surface ratchet + explicit grandfathered debt | P4 — changed-surface ratchet for legacy |
| 8 | Silent degradation | implementation | unavailable tool is skipped while final result still says verified | degraded verdict is schema-visible; no silent skip | P8 — no silent degradation |
| 9 | Readiness score gaming | product | teams optimize a scalar | vector is source of truth; critical capability floors override score | P2 — readiness is a vector |
| 10 | Risk classifier drift | implementation | semantic model over-classifies or misses sensitive changes | deterministic signals first + benchmarked ambiguity path | Phase 2 — risk-to-assurance policy engine |
| 11 | Stale evidence | implementation | capability existed last month but command/config is broken now | evidence freshness + proof command + re-discovery triggers | Evidence contract |
| 12 | Human role ambiguity | product | "high assurance" is read as automatic merge authority | merge/risk-acceptance remains separate user-governance concern | Phase 6 — assurance verdict and autonomy ceiling |

## Acceptance Criteria

Each criterion is closed against one of: **met** · **met by `<path>`** ·
**amended** (replacement sentence written in full) · **transferred to `<stub>`** ·
**cut with reason**. Fourteen of fourteen are dispositioned; none is skipped, and
three are amended because the closure genuinely weakens what they promised.

- [x] **AC-1 — one capability vocabulary:** project assurance is represented by
      tool-neutral capabilities with observable evidence and
      `available|missing|degraded|unknown`; no competing readiness vocabulary
      exists.
      **AMENDED**, because the last clause was already false when written and this
      closure must not pretend otherwise. Replacement, in full:
      *"Project assurance capabilities are named in one tool-neutral vocabulary —
      `src/config/assurance-capability-registry.json`, 19 terms, each with an
      owner surface, an axis, observable evidence, a revisit condition and a state
      drawn from the closed set `available|missing|degraded|unknown`. Target-repository
      readiness is MEASURED by exactly one instrument,
      `src/scripts/grade_target_readiness.ts`, over 10 knockout-based dimensions.
      Vocabulary and measurement are separate surfaces: the vocabulary is a
      naming and ownership contract, the grader is the measurement instrument, and
      no second grader exists."*
      Why amended: the 10 shipped dimensions and the 19 vocabulary terms are
      different granularities with different consumers, so "no competing
      vocabulary" cannot be honestly asserted of the pair. Making the grader
      canonical instead (option e2) was rejected by both council seats on one
      concrete failure — a later property-test question would force splitting
      `test-presence`, which forks the grader and violates AC-2. The separation is
      asserted, not just declared: no projected capability may name an owner
      script other than the declared grader, sabotage-probed red.

- [x] **AC-2 — no duplication:** no new TDD skill, test-coverage judge,
      fresh-reviewer mechanism or requirement-id grammar is introduced while
      the current owners exist.
      **MET.** This change adds two JSON configs, four vitest specs and one stub.
      `git diff --name-only` over the branch contains **no path under
      `src/skills/`**, no new command, no new judge and no new grammar. The
      registry points at existing owners by path rather than restating them, and
      every non-`none` owner path is asserted to resolve on disk.

- [x] **AC-3 — risk-adaptive:** at least R0-R4 resolve to materially different
      assurance requirements, and trivial work demonstrably avoids expensive
      gates.
      **AMENDED.** Replacement, in full: *"At least R0–R3 resolve to materially
      different risk classes from deterministic path signals with no model call,
      and trivial work demonstrably avoids expensive gates. R4 is not implemented:
      irreversible and risk-acceptance actions are governed by the Hard Floor
      (`non-destructive-by-default`), which is a permission gate rather than a
      risk class. Requirements do not yet differ per class, because the policy
      resolver that would attach them is recorded as cancelled on a pre-registered
      null."*
      Why amended: `R4` occurs zero times in `classify_change_risk.ts`, and
      "materially different assurance **requirements**" needs the resolver that
      does not exist. What IS discharged, and asserted: the classes differ
      deterministically, and a forty-file generated-doc change stays R0 while a
      one-file auth change is R3 — so triviality is decided by risk, never size.

- [-] **AC-4 — bootstrap closes the loop:** for at least PHP, TypeScript and
      Python fixtures, AC can detect a missing capability, recommend an adapter,
      configure it in a fixture project, prove it with a sensitive failure, and
      re-discover it as available.
      **TRANSFERRED** to [`stubs/road-to-target-project-bootstrap-enforce.md`](../stubs/road-to-target-project-bootstrap-enforce.md).
      The **detect** step is met for all three ecosystems by the committed
      fixtures. Everything from **recommend** onward needs runnable fixture
      projects with installed toolchains, which the three committed fixtures
      deliberately are not — they are config-presence fixtures for the grader.

- [-] **AC-5 — legacy-safe:** a repository with poor global historical metrics
      can satisfy assurance for changed behavior without rewriting untouched
      code, while legacy debt remains visible.
      **TRANSFERRED** to [`stubs/road-to-legacy-target-onboarding-ratchet.md`](../stubs/road-to-legacy-target-onboarding-ratchet.md),
      which owns the violations-ratchet. Visibility without a path is what the
      tree has today, and that stub names it as the defect it closes: "a
      low-coverage target repo currently has no path".

- [x] **AC-6 — evidence over claims:** a final `verified` verdict is impossible
      when any policy-required evidence is missing; test/review/runtime evidence
      is referenced structurally.
      **MET at the readiness layer, TRANSFERRED at the per-change layer**, and the
      split is the honest reading. Met: the readiness verdict is `min` over four
      knockouts and an undetectable knockout binds at L0 with its reason printed,
      so "tests pass" cannot produce a positive verdict — the `ci-absent` fixture
      grades `L0 — bound by CI enforcement` with everything else present. Every
      dimension carries an evidence *reference* rather than a copied log, now
      asserted and sabotage-probed. Transferred: the per-change aggregate record
      and the `verified|verified-degraded|blocked|human-decision|unknown` enum go
      to [`stubs/road-to-target-project-evidence-contract.md`](../stubs/road-to-target-project-evidence-contract.md);
      `verified-degraded` occurs zero times in `src/` today.

- [x] **AC-7 — independence is explicit:** a same-session review cannot satisfy
      `independent-review`; test authorship is consumed from the existing
      experiment rather than assumed.
      **MET, verbatim, and asserted.** `independent-review` is registered
      `degraded` and a `degraded` state must carry non-empty `limitations` — one of
      which records that `self_review_gate.ts:471` still hardcodes a single
      provider. `independent-test-author` is `unknown`, consumed from the
      sibling's pre-registered `unmeasurable-here` rather than assumed. A spec
      forbids the state `available` for any of the three sibling-owned
      capabilities; sabotage-probed by setting `requirement-trace` to `available`
      — red.

- [x] **AC-8 — mutation is evidence, not vanity:** the core system has no
      universal min-MSI constant; survivors/timeouts are visible and
      changed-surface operation is supported where the adapter can do it.
      **MET on the constant, TRANSFERRED on the adapter.** Neither
      `assurance-capability-registry.json` nor `assurance-threshold-budget.json`
      contains a mutation threshold of any kind, and `mutation-sensitivity` is
      registered `degraded` with a limitation stating in as many words that no
      universal min-MSI constant exists here or may be added. The subtler half:
      four `null` thresholds could themselves have become a universal minimum of
      infinity, which `dimension_applicability` plus `safety_floor_exemption`
      prevent — asserted, and probed by deleting the exemption. Survivor/timeout
      visibility and changed-surface operation need a mutation run; transferred
      with the adapter.

- [x] **AC-9 — autonomy is bounded by assurance:** the same requested task can
      receive different autonomy ceilings when repository assurance differs,
      without altering user merge authority.
      **AMENDED.** Replacement, in full: *"The grader REPORTS a per-repository
      assurance level computed from that repository's own evidence — `L<n> — bound
      by <dimension>` — and identical capability does receive a different level
      when assurance differs. It does not BLOCK: its documented exit contract is 0
      for any matrix including L0, because a low grade is a finding about the
      target and never a failure of the gate. Enforcement — consuming the level to
      widen or narrow what an agent may do — is not implemented and is transferred.
      User merge authority is untouched and remains governed by
      `non-destructive-by-default` and `commit-policy`."*
      Why amended: the phrase "autonomy ceiling" occurs **nowhere** in `src/`, so
      the original wording claims an enforcement surface that does not exist. The
      derivation half is real and asserted (`full` grades L2, `ci-absent` grades
      L0, differing only by the absence of `.github/workflows/`).

- [x] **AC-10 — runtime-aware:** user-visible/runtime changes can require
      executable runtime evidence, while pure/non-runtime changes are not forced
      through it.
      **CUT, with the reason stated in the tree rather than only here.** Runtime
      verification needs a deploy platform this package does not own. This is a
      visible cut, not a silent drop: the grader ships a `runtime-verification`
      dimension that is permanently `not detectable` and prints
      `needs a deploy platform this tool does not own`
      (`grade_target_readiness.ts:270`) rather than grading it 0 — so the gap
      appears in every readiness report. The half of this criterion that survives
      is met: pure changes are not forced through runtime evidence, because
      nothing is.

- [-] **AC-11 — benchmarked enforcement:** every newly blocking assurance
      mechanism cites a pre-existing evaluation showing incremental signal or a
      hard safety property that justifies blocking without an empirical uplift
      claim.
      **TRANSFERRED** to [`stubs/road-to-assurance-benchmark.md`](../stubs/road-to-assurance-benchmark.md),
      **and vacuously satisfied today** — this change makes nothing blocking, so
      no blocking mechanism could lack a predating evaluation. The criterion is
      kept checkable rather than parked: `assurance-threshold-budget.json` carries
      `threshold_setting_procedure`, which requires a set threshold to cite either
      an empirical derivation (percentile, delta, dated run) or a named safety
      invariant, and rejects one citing neither. That is this criterion's second
      limb made mechanical, before any corpus exists.

- [-] **AC-12 — false confidence measured:** the evaluation suite reports
      false-verified rate, not just caught-defect rate.
      **TRANSFERRED** with Phase 8. Not merely deferred: `false_verified_rate` is
      **pre-registered by name**, first in the closed dimension set, with its
      `set_when` naming Phases 8.1 + 8.2 + 8.4 and a spec forbidding a number
      there without a measurement beside it — probed by setting `0.05` against a
      null measurement, red.

- [-] **AC-13 — cost visible:** assurance reports expose incremental runtime and
      model-call cost by mechanism sufficiently to tune the policy.
      **TRANSFERRED** with Phase 8, pre-registered as `cost_budget` with its unit
      spelled out (`{p50_seconds, p50_tokens, p95_seconds, p95_tokens}`) and — the
      one useful asymmetry — a `set_when` that does not require the ablation, so
      cost is settleable before the other three. Worth recording why the number
      would be uninteresting today: the grader is a single filesystem pass with no
      model call, so the cost that matters belongs to the mechanisms Phase 3 would
      bootstrap.

- [x] **AC-14 — default-path adoption:** ordinary AC implementation flows use
      the assurance engine; the human-facing doctor is only a projection over the
      same source of truth.
      **MET on the projection, `already-cancelled-measured` on the default path.**
      The doctor requirement is met literally: `/project:analyze` invokes
      `grade_target_readiness` (`project/analyze/command.md:40`) and prints its
      output **verbatim** (`:83`), so it is a projection because it is the same
      process — never a second scanner. The default-path half is **not** met, and
      is not re-decided here: wiring the risk class into
      `verify-completion-evidence` is the archived sibling's cancelled step 2.1,
      cancelled because its owed-gate table lived in a config file that does not
      exist and because giving an unvalidated class authority over every completion
      claim was named Risk 7 there. Overturning a measured null on preference is
      the one thing `blocker: sibling-roadmap-dispositions` forbids.

## Blockers

### blocker: sibling-roadmap-dispositions

- **Status:** resolved
- **Owner:** agent / maintainer
- **Blocks:** enforcement portions of Phase 4
- **What to do:** consume the final measured dispositions of:
  - `road-to-test-independence-and-mutation-evidence.md`
  - `road-to-review-independence.md`
  - `road-to-requirements-traceability-minimal.md`
- **Recommendation:** build Phases 0-3 so capability slots can represent
  `unknown`/`unavailable`, but do not hard-code a positive outcome for any
  sibling experiment.
- **If you do nothing:** this roadmap launders hypotheses from sibling roadmaps
  into mandatory policy before their own falsifiers run.
- **Resolved when:** each consumed capability records the sibling disposition
  and evidence ref, including null/parked outcomes.
- **Resolution (2026-08-23) — resolved by execution and by one mapping decision.**
  All three siblings are COMPLETE and archived; the live reading was taken at
  2026-08-23T13:26:33Z from `agents/roadmaps/archive/`, not from this file's prose,
  and each is 13/13, 20/20 and 12/12 closed with zero `[ ]` and zero `[~]`. So the
  wait condition was already satisfied; what remained was deciding which of
  `available | missing | degraded | unknown` each consumed capability carries.
  **AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/gpt-4o),
  convergent on all three picks**; the maintainer is unreachable in this autonomous
  drain run and this class is council-decidable. Response:
  `agents/runtime/council/responses/assur-q1-sibling-dispositions.md`.

  | Capability | Pick | State | Sibling disposition consumed |
  |---|---|---|---|
  | `independent-test-author` | (1a) | **`unknown`** | `unmeasurable-here` — the third pre-registered state, NOT a null and NOT a refutation; the measurement did not run for want of a subagent dispatch primitive |
  | `independent-review` | (2b) | **`degraded`** | fresh-context dispatcher shipped, but single-member / single model family, derived pair `provisional / single-pass`, and `self_review_gate.ts:471` still hardcodes one provider |
  | `requirement-trace` | (3b) | **`degraded`** | schema ships and resolves deterministically; enforcement parked under two FIRED falsifiers, adoption 1 of 25 and self-referential |

  **Where the record lives:** `src/config/assurance-capability-registry.json`, with
  per-capability `state`, `limitations`, `falsifiers`, `evidence` and `revisit_if`.
  Its invariants are asserted by `tests/scripts/assurance_capability_registry.test.ts`,
  including the two that make this blocker's own failure mode unrepresentable: a
  `degraded` capability MUST name its limitations, and none of the three
  sibling-owned capabilities may be `available`. Both were sabotage-probed red.

  **The council overruled its own earlier round on `requirement-trace`, and the
  reasoning is worth keeping.** Two of three earlier reviewers had picked
  `available` on the ground that "the capability exists; policy chooses not to
  enforce it". The final round rejected that as an internal contradiction:
  `"state": "available"` beside `"falsifiers": {"no_adoption": "fired"}` is
  precisely the laundering this blocker's `If you do nothing` names. A measured
  constraint is not a policy preference.

  **The path deviates from the council's suggestion, deliberately.** Both members
  named `src/contracts/capability-registry.json`. That directory does not exist in
  this tree — configs live in `src/config/*.json` and contracts are markdown under
  `docs/contracts/`. The file is placed by the repository's own convention and the
  deviation is recorded here rather than silently taken.

  **A defect in this blocker's own premise, found while discharging it.** The
  blocker asks Phase 4 to consume these three siblings as capabilities of the
  repository under assurance — but all three measured **this package's own** tests
  and reviews, while `grade_target_readiness.ts` measures **a target repository**.
  Those are two different questions with two different answers, and the umbrella
  had them on one list. The registry therefore carries a required `axis` field
  (`self` | `target` | `both`); all three of these are `axis: self`, and the
  target-axis analogues are graded separately as the `independent-verification`
  and `evidence-traceability` dimensions. Conflating them would have reported a
  fact about AC's own suite as a fact about the user's repository.

  **`Revisit-if:`** any of — a subagent dispatch primitive ships and the
  test-independence pre-registration is re-run; `self_review_gate.ts` stops
  hardcoding a single provider AND multi-family routing or single-family parity is
  measured; traceability adoption reaches >= 3 eligible active roadmaps, OR >= 1
  non-maintainer-prompted roadmap adopts the fields, OR its `no_demonstrated_value`
  falsifier becomes measurable. No calendar trigger.

### blocker: assurance-enforcement-thresholds

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 8.5 and any new blocking policy not already a hard safety floor
- **What to do:** commit a pre-registration file at
  `src/config/assurance-threshold-budget.json` <!-- ref-ignore --> carrying one entry per dimension,
  each with a number and the measurement that produced it, before the comparison
  run. The dimension set is exactly four and is closed here:
  1. `false_verified_rate` — a change the harness reports verified that is not.
  2. `defect_catch_uplift` — defects caught with the mechanism minus without.
  3. `cost_budget` — wall-clock and token cost per gated change.
  4. `false_positive_burden` — reds a maintainer overrides as not-a-defect.
  Same shape and the same `owner` / `review_by` obligation as every other budget
  config in `src/config/`; the numbers stay unset until the corpus exists.
- **Recommendation:** do not choose a universal number in this roadmap. Establish
  the benchmark corpus first and register thresholds before seeing the ablation
  results. The file above is where they land — naming the location is not choosing
  the values.

> **Corrected from reproduction (`/analyze:inbox`, 2026-08-22).** The original
> `What to do:` was prose and carried no command, path or enumerated option set,
> so `lint_roadmap_blockers:decidability` refused it (`:919`) and the roadmap
> could not land. The correction adds the artefact path and closes the dimension
> list the prose already named — it decides no threshold, which is precisely what
> the Recommendation forbids.
- **If you do nothing:** the benchmark becomes post-hoc justification for
  whatever mechanism was already preferred.
- **Resolved when:** thresholds are committed before the policy comparison run.
- **Resolution (2026-08-23) — option (a): the file is committed with all four
  thresholds explicitly `null`.** AI council 2026-08-23, 2/2 quorum
  (anthropic/claude-sonnet-4-5 + openai/gpt-4o), convergent. Response:
  `agents/runtime/council/responses/assur-q2-enforcement-thresholds.md`. Artefact:
  `src/config/assurance-threshold-budget.json`, asserted by
  `tests/scripts/assurance_threshold_budget.test.ts` (12 assertions).

  **The contradiction in this blocker's own text is resolved, in the direction
  that keeps the pre-registration honest.** `What to do:` asked for "a number and
  the measurement that produced it"; five lines later, "the numbers stay unset
  until the corpus exists". Both cannot hold. What is committed is the *slot* plus
  the *specification of the measurement that will fill it*: `threshold: null`,
  `measurement: null`, and a `set_when` clause naming the specific run. So
  "committed" means **present in a falsifiable state**, not "populated with a
  number" — and not "absent", which is why a spec asserts the `threshold` key
  exists even while null (a missing key and an explicit null are the same value in
  JS and are not the same claim; probed by deleting the key — red).

  **No number was invented.** No corpus exists, so no measurement could have
  produced one. Option (b) — four provisional numbers with an honest admission
  beside each — was rejected because a number in a `src/config/` file is read by
  later readers as derived whatever the comment says. Option (c) — leave the
  blocker open — was rejected because it conflates *unknown thresholds*, which is
  the true state, with *unknown dimensions*, which is false: the four are closed.

  **Two clauses do the real work, and neither was in the blocker's own text.**
  `dimension_applicability` keys governance to **observable policy
  characteristics** rather than to what a policy's author claims about it — "any
  policy that gates done", "any policy that can return red" — because a
  self-declared scope makes the whole framework opt-in. And a
  `safety_floor_exemption`, so a hard red line may block without an empirical
  uplift claim. Without those two the four nulls would congeal into a universal
  "no blocking policy may be adopted" constant, which is a universal minimum
  threshold of infinity wearing another name — exactly what **AC-8** forbids and
  what the Recommendation above means by "do not choose a universal number".
  Sabotage-probed by deleting the exemption — red.

  **The enforcement gate is promised and deliberately NOT shipped, and this is a
  deviation from one council member's first round that the final round itself
  sustained.** There is no proposed blocking assurance policy in the tree for a
  gate to run against, and committing untested CI automation is how a defect is
  found on the critical path. Two repository-specific reasons reinforce it: a new
  gate script here trips three ratchets, and a gate whose corpus is empty exits
  green — worse than absent, because it reads as coverage. It is named as the
  first step on promotion of
  [`stubs/road-to-assurance-benchmark.md`](../stubs/road-to-assurance-benchmark.md).

  **One deviation from the council's literal file content, recorded rather than
  taken silently.** Both members wrote `review_by` as prose ("90 days after the
  frozen benchmark corpus commit, or 2027-12-31, whichever is earlier") and
  `registered_at` as `2025-01-23`. Every other budget config in `src/config/`
  carries `YYYY-MM-DD` and the gates read that shape, so `review_by` is
  `2027-08-23` and `registered_at` is today's real date, `2026-08-23`; the
  corpus-indexed 90-day condition is carried in `revisit_if`, which is where the
  council also put it. A `review_by_note` field records the substitution in the
  file itself.

  **`Revisit-if:`** any of — a threshold is still null 90 days after the frozen
  corpus is committed; a proposed blocking policy's observable characteristics map
  to no dimension; a failure mode orthogonal to all four emerges; or the promised
  gate is removed or bypassed without a schema bump and re-registration.

  **Amended `What to do:`** — commit the pre-registration declaring the closed
  four-dimension framework before the comparison run, each dimension carrying
  `threshold: null`, `measurement: null`, `description`, `unit`, `direction`,
  `_comment`, a `set_when` clause naming the specific measurement run(s), and
  `blocks_enforcement: true`; plus a `dimension_applicability` section keyed to
  observable policy characteristics and a `threshold_setting_procedure` stating
  technical requirements without prescribing governance. The gate implementation
  is deferred but promised.

  **Amended `Resolved when:`** — the pre-registration file is committed with all
  four dimensions declared, each carrying an explicit `threshold: null` and
  `measurement: null`, plus the `dimension_applicability` and
  `threshold_setting_procedure` clauses, **before** the frozen benchmark corpus is
  built or any ablation runs. Satisfied 2026-08-23: no corpus exists and no
  ablation has run, so the registration precedes the thing it constrains — which
  is the only property that makes it a pre-registration at all.

## What this roadmap deliberately does not build

- A second TDD workflow.
- A second test writer before the existing test-independence experiment
  finishes.
- A new review dispatcher.
- A universal code-coverage target.
- A universal mutation-score target.
- Mutation testing on every PR by default.
- A requirement-traceability mandate before the existing measurement says the
  representation is useful.
- A giant always-loaded "agent assurance" rule blob.
- A single numeric readiness score as a policy source.
- Automatic merge permission derived from assurance.
- A model-only risk classifier where deterministic repository facts are
  available.

## Research notes / external evidence

### OpenAI — Harness engineering in an agent-first world (2026-02-11)

Observed lessons:

- agent productivity depended on environment, tools, repository structure and
  feedback loops, not only model capability;
- humans shifted toward intent/acceptance criteria and improving the harness;
- architecture boundaries were encoded in custom linters and structural tests;
- application UI, logs, metrics and traces were made directly accessible to the
  agent;
- most review load could move agent-to-agent only after those capabilities were
  built;
- OpenAI explicitly warns that this autonomy is repository-specific and should
  not be generalized without similar investment.

Source:
https://openai.com/index/harness-engineering/

### Anthropic — Building a C compiler with a team of parallel Claudes (2026-02-05)

Observed lessons:

- most human effort went into tests, environment and feedback;
- verifier quality must be extremely high or the agent optimizes the wrong
  target;
- CI/regression enforcement became necessary as new agent changes broke old
  behavior;
- bounded, machine-readable feedback is important for long-running agents;
- the experiment still warns that passing tests is not equivalent to complete
  human verification.

Source:
https://www.anthropic.com/engineering/building-c-compiler

### Spec-driven test generation (2026-08)

The paper "Grounding AI Agents in Contracts: An Empirical Evaluation of
Spec-Driven Test Generation" reports improved bug detection and branch coverage
when test generation is preceded by explicit preconditions, postconditions and
undefined-behavior analysis.

Use this as evidence to evaluate a behavior-contract/spec capability. Do not
translate the paper into "formal specification mandatory for every change."

Source:
https://arxiv.org/abs/2608.17177

### Test-Driven AI Agent Definition (2026-03)

TDAD uses behavioral specifications, executable tests, hidden tests and semantic
mutation concepts to reduce specification gaming for tool-using agents. It is
useful evidence for hidden/independent evaluation patterns, but it evaluates
agent definitions/prompts rather than general application software and should
not be over-generalized.

Source:
https://arxiv.org/abs/2603.08806

### Infection mutation testing

Official docs support changed-file and changed-line mutation modes specifically
for large or legacy projects. The docs also state that the interesting question
is escaped mutations, not blindly maximizing a global score, and newer versions
make timeout behavior visible because timeouts can inflate MSI.

Sources:
https://infection.github.io/guide/how-to.html
https://infection.github.io/guide/
https://infection.github.io/2026/01/14/whats-new-in-0.32.3/

### Ecosystem patterns inspected

Useful implementation ideas, not normative sources:

- `Source I` — strict RED/GREEN/REFACTOR/MUTATE and changed-code mutation.
- `Source J` — agent separation, adversarial QA and dynamic rigor.
- `Source K` — isolated test/code/reviewer roles and mutation.
- `Source L` — quality gates and multi-reviewer "Sentinel".
- `Source M` and related forks — evidence-over-claims, TDD and review
  decomposition.

These are reference patterns. AC should harvest mechanisms only when they fit
its existing owners and evidence contracts.

## Final target state

When this road is complete, an ordinary AC run can say something like:

```text
Change: authentication expiry behavior
Risk: R3 HIGH

Repository assurance:
  unit tests                AVAILABLE
  integration tests         AVAILABLE
  e2e                      AVAILABLE
  TDD red evidence          AVAILABLE
  mutation sensitivity      AVAILABLE (changed-lines)
  static analysis           AVAILABLE
  security scan             AVAILABLE
  independent review        AVAILABLE
  independent test author   DEGRADED (not measured useful yet)
  requirement traceability  OPTIONAL / measured-adoption phase

Required for this change:
  behavior contract         PASS
  red evidence              PASS
  boundary/error/abuse      PASS
  unit/integration          PASS
  mutation sensitivity      PASS — 0 survivors, 0 timeouts
  static/security           PASS
  fresh-context review      PASS
  runtime login flow        PASS

Residual risk:
  independent spec-first test authorship not required by current measured policy

Verdict: VERIFIED
Autonomy ceiling: high inside repository/tool boundaries
Merge authority: unchanged — user governance still applies
```

For a weak legacy repository, the same engine should instead say:

```text
Risk: R2 NORMAL

Missing project capabilities:
  stable integration test entrypoint
  static analysis baseline

Action:
  bootstrap the two missing capabilities for the changed surface first

Legacy debt outside changed surface:
  visible, grandfathered, non-blocking

Verdict: NOT READY FOR THIS CHANGE YET
```

That is the intended shift: AC does not merely tell an agent to "write clean,
tested code". It helps build the repository-level feedback system that makes
agent work falsifiable, repeatable and progressively more autonomous.
