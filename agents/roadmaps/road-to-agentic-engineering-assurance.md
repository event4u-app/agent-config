---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
research_pin:
  repository: event4u-app/agent-config
  main: 572e147cc0110f4453dc23ea04891bca4e38d897
  date: 2026-08-22
estate_offset_exempt: "Ships status: draft, so it charges neither active_roadmaps nor open_blockers until the owner flips it to ready — that flip is the estate decision and it is not an external session's to take. Nothing to offset against: no active roadmap covers assurance-readiness discovery, and archiving an unrelated one to pay for this would be an unreviewed disposition dressed up as bookkeeping. Landed by /analyze:inbox with its claims re-verified at 577bdbf88 (all nine mutation/architecture tool names still return 0 files in src/)."
---
# Road to Agentic Engineering Assurance

> **Source:** `agents/tmp.old/robert-c-martin/road-to-agentic-engineering-assurance.md` — landed by `/analyze:inbox` on 2026-08-22.
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

`agents/roadmaps/road-to-test-independence-and-mutation-evidence.md` already
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

`agents/roadmaps/road-to-review-independence.md` already identifies a shipped
fresh-context reviewer dispatcher and plans to route the default review path
through it, while recording author/reviewer context relation.

**Consequence:** the assurance engine asks "is independent review available and
required for this risk?" It does not implement another reviewer.

### Existing requirements-traceability roadmap — dependency, not duplicate

`agents/roadmaps/road-to-requirements-traceability-minimal.md` already proposes
optional requirement / acceptance / evidence references plus a listing gate and
a measured adoption decision.

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

## Phase 0 — inventory and overlap contract

- [ ] **0.1 Pin and inventory every assurance primitive already shipped or
      actively roadmapped.** At minimum: TDD, test-case discovery,
      testing-anti-patterns, judge-test-coverage, quality-tools,
      verify-completion-evidence, review independence, test independence /
      mutation evidence, requirements traceability, security and architecture
      gates.
      verify: one machine-readable inventory maps each capability to exactly one
      owner surface or declares it missing; duplicate owners are findings.

- [ ] **0.2 Define the non-duplication boundary.** This roadmap owns discovery,
      policy resolution, bootstrap orchestration and aggregate assurance
      evidence. Existing skills/roadmaps continue to own their mechanisms.
      verify: the architecture note contains an owner table and no new skill or
      reviewer is introduced in Phase 0.

- [ ] **0.3 Register capability vocabulary v1.** Keep it tool-neutral and small.
      verify: every capability has a definition, observable evidence and
      `available|missing|degraded|unknown`; no tool name appears in a capability
      identifier.

- [ ] **0.4 Separate risk from complexity.**
      verify: fixtures include a simple-but-high-risk auth change and a
      complex-but-low-risk generated-doc change and classify those axes
      independently.

## Phase 1 — repository assurance discovery

- [ ] **1.1 Build stack/workspace discovery adapters.** Reuse current code
      intelligence/project discovery surfaces where possible.
      verify: fixtures cover at least PHP/Laravel, TypeScript/React and Python,
      including one monorepo with mixed workspaces.

- [ ] **1.2 Discover executable entrypoints, not package names alone.** A
      dependency in a lockfile is not proof that a capability works.
      verify: a fixture with an installed-but-broken test runner resolves to
      `degraded`, not `available`.

- [ ] **1.3 Bind every discovered capability to evidence.** Examples: command,
      config path, CI job, schema, test fixture.
      verify: `available` without at least one evidence ref fails schema
      validation.

- [ ] **1.4 Produce a human-readable `agent readiness` report.** Report the
      vector, critical gaps and confidence. A scalar score may be displayed only
      as a secondary convenience and may never determine policy.
      verify: removing a critical behavioral test capability changes the
      readiness level even if any optional scalar remains numerically high.

## Phase 2 — risk-to-assurance policy engine

- [ ] **2.1 Define R0-R4 with deterministic signals first.** File/path signals,
      public contracts, migrations, auth/security surfaces, infrastructure
      blast-radius markers and explicit user intent should precede LLM
      classification.
      verify: golden fixtures produce stable classifications without a model
      call where deterministic signals suffice.

- [ ] **2.2 Add semantic classification only for unresolved cases.**
      verify: model usage is absent for deterministic fixtures and its result is
      stored with rationale/confidence for ambiguous fixtures.

- [ ] **2.3 Resolve required/optional/forbidden capabilities from
      `(risk, project capabilities, change type)`.**
      verify: R0 does not request mutation/TDD; R3 auth does request an abuse
      case and independent verification when available.

- [ ] **2.4 Define degraded paths.**
      verify: every required capability has exactly one of `satisfied`,
      `degraded-with-named-substitute`, or `human-gate`; `missing -> silently
      skipped` is unrepresentable.

## Phase 3 — capability bootstrap

- [ ] **3.1 Add adapter registry keyed by capability + ecosystem.** Keep
      recommendation logic separate from installation commands.
      verify: adding a new tool adapter does not change policy vocabulary.

- [ ] **3.2 Prefer existing project tooling.**
      verify: fixture containing PHPUnit/Pest never proposes Jest or a second PHP
      test framework; fixture with existing static analysis extends it instead
      of installing a sibling.

- [ ] **3.3 Implement `detect -> recommend -> configure -> prove -> enforce`.**
      The "prove" step must deliberately exercise failure sensitivity before CI
      enforcement.
      verify: a newly bootstrapped capability cannot resolve to `available`
      until its negative fixture is seen fail for the intended reason and green
      after restoration/fix.

- [ ] **3.4 Add legacy changed-surface mode.**
      verify: a fixture with poor global coverage can satisfy an R3 change when
      the touched behavior meets its resolved assurance requirements; unrelated
      historical debt remains visible but non-blocking.

- [ ] **3.5 Mutation adapters are evidence probes, not score factories.**
      Start with changed-line/file modes where supported; surface survivors and
      timeout inflation separately.
      verify: fixtures prove that `97%` with timeouts is not rendered equivalent
      to `97%` with zero timeouts, and no universal min-MSI constant exists in
      the core policy.

## Phase 4 — compose existing TDD, test independence, review and traceability

- [ ] **4.1 Route policy-selected TDD into the existing
      `test-driven-development` skill.** Do not duplicate its RED/GREEN logic.
      verify: no new TDD skill/command is added.

- [ ] **4.2 Consume the outcome of
      `road-to-test-independence-and-mutation-evidence`.** If its experiment
      returns null, do not force spec-first independent test authorship. If it
      passes, make that capability selectable for the risk classes justified by
      its own evidence.
      verify: capability availability follows the sibling roadmap disposition,
      not this roadmap's preference.

- [ ] **4.3 Consume `road-to-review-independence`.**
      verify: `independent-review` is satisfied only by the author/context
      relation the review roadmap defines; same-session self-review cannot
      satisfy it.

- [ ] **4.4 Consume requirements-traceability only at its measured adoption
      level.**
      verify: optional traceability remains optional until the sibling roadmap's
      disposition explicitly supports enforcement.

- [ ] **4.5 Introduce one aggregate assurance evidence schema.** Existing
      evidence stays source-of-truth and is referenced, not copied.
      verify: the aggregate record contains refs/hashes/identifiers rather than
      full duplicated test/review logs.

## Phase 5 — application and runtime verification

Static source gates are not enough for user-visible and operational behavior.

- [ ] **5.1 Detect whether the project can boot an isolated change instance.**
      Prefer existing Docker/devcontainer/worktree/runtime mechanisms.
      verify: capability reports include environment reproducibility evidence.

- [ ] **5.2 Add runtime probes selected by surface.** Examples: HTTP smoke,
      browser flow, CLI invocation, queue/event observation, migration dry-run.
      verify: a frontend behavior change can require browser evidence while a
      pure library function does not.

- [ ] **5.3 Make observability agent-readable when locally available.** Logs,
      metrics and traces should be queryable evidence, not screenshots pasted by
      a human.
      verify: runtime evidence records the query/probe and bounded result.

- [ ] **5.4 Never infer production safety solely from local runtime success.**
      verify: production-specific residual risks remain explicit.

## Phase 6 — assurance verdict and autonomy ceiling

- [ ] **6.1 Implement the structured verdict:** `verified`, `verified-degraded`,
      `blocked`, `human-decision`, `unknown`.
      verify: "tests pass" alone cannot produce `verified` if policy-required
      evidence is absent.

- [ ] **6.2 Compute the autonomy ceiling from evidence, not a global setting.**
      verify: identical code-generation capability receives different autonomy
      recommendations in an A1 vs A4 repository.

- [ ] **6.3 Preserve merge/user authority as a separate concern.**
      verify: no assurance level auto-grants merge permission.

- [ ] **6.4 Add residual-risk reporting.**
      verify: every degraded verification path emits a residual-risk entry or a
      named justification that the substitute closes the same property.

## Phase 7 — default-workflow integration

- [ ] **7.1 Add assurance assessment to normal planning/execution, not only a
      hidden expert command.**
      verify: an ordinary implementation task resolves risk and required
      capabilities before implementation begins.

- [ ] **7.2 Provide an explicit doctor surface for humans.** Suggested UX:
      project readiness, missing capabilities, why they matter, and "build this
      capability" actions.
      verify: doctor is a projection over the same engine used by execution,
      never a second scanner.

- [ ] **7.3 Keep trivial work trivial.**
      verify: R0/R1 fixtures show no expensive agent council, mutation run or
      browser boot unless a specific surface requires it.

- [ ] **7.4 Make failures instructional.** Tool/gate output should tell an agent
      what property failed and where to find detailed logs.
      verify: bounded stdout + durable log/ref on large failures.

## Phase 8 — evaluation before stronger enforcement

- [ ] **8.1 Build a frozen benchmark corpus across risk classes.** Include
      known bugs, weak tests, architectural violations, security mistakes,
      legacy debt and false-positive traps.
      verify: corpus and scoring criteria are committed before policy tuning.

- [ ] **8.2 Measure false confidence, not only catch rate.** Track cases where
      the system said `verified` and a seeded defect survived.
      verify: false-verified rate is a first-class metric.

- [ ] **8.3 Measure cost and latency by assurance capability.**
      verify: report deterministic-tool runtime, model-call count and incremental
      wall-clock contribution separately.

- [ ] **8.4 Run ablations.** Compare baseline AC vs:
      - risk policy only;
      - risk + bootstrap;
      - risk + independent review;
      - risk + mutation sensitivity;
      - full assurance composition.
      verify: no expensive mechanism becomes default unless it shows incremental
      signal over the cheaper stack on the frozen corpus.

- [ ] **8.5 Tighten only supported policies.** An attractive mechanism with null
      incremental signal is parked, not institutionalized.
      verify: every blocking policy cites a benchmark/evidence artifact that
      predates enforcement.

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

| Capability | Current owner | This roadmap action |
|---|---|---|
| TDD RED/GREEN/REFACTOR | `test-driven-development` + `/tdd` | route/reuse |
| Test anti-gaming / manual mutation probe | `testing-anti-patterns` | route/reuse |
| Independent test authorship experiment | `road-to-test-independence-and-mutation-evidence` | consume disposition |
| Fresh-context review | `road-to-review-independence` | consume capability |
| Requirement -> acceptance -> evidence links | `road-to-requirements-traceability-minimal` | consume measured adoption |
| Static/type/lint tools | `quality-tools` and stack skills | discover/reuse |
| Completion evidence | existing evidence/verify surfaces | aggregate by reference |
| Assurance inventory | **missing** | build here |
| Risk -> required verification policy | **missing as one canonical layer** | build here |
| Bootstrap orchestration | **missing** | build here |
| Autonomy ceiling | **missing** | build here |
| Runtime evidence composition | partial / stack-specific | unify here |

## Risk Register

| Rank | Risk | Failure mode | Mitigation |
|---|---|---|---|
| 1 | Assurance theater | More green badges create more confidence without catching more defects | frozen corpus, false-verified metric, ablations before enforcement |
| 2 | Duplicate AC mechanisms | umbrella reimplements TDD/review/traceability | explicit ownership table + no-dup acceptance criteria |
| 3 | Tool sprawl | AC installs fashionable tools beside project-native equivalents | capability-first registry + prefer-existing rule |
| 4 | Mutation cargo cult | universal MSI threshold becomes the goal | changed-surface probes, survivor findings, no universal core threshold |
| 5 | Cost explosion | every change triggers browser + mutation + multiple reviewers | R0-R4 risk selection + measured incremental value |
| 6 | Correlated agent errors | multiple agents repeat the same mistaken premise | independence metadata + deterministic oracles + spec-first only if measured |
| 7 | Legacy lockout | old repos can never become "agent-ready" | changed-surface ratchet + explicit grandfathered debt |
| 8 | Silent degradation | unavailable tool is skipped while final result still says verified | degraded verdict is schema-visible; no silent skip |
| 9 | Readiness score gaming | teams optimize a scalar | vector is source of truth; critical capability floors override score |
| 10 | Risk classifier drift | semantic model over-classifies or misses sensitive changes | deterministic signals first + benchmarked ambiguity path |
| 11 | Stale evidence | capability existed last month but command/config is broken now | evidence freshness + proof command + re-discovery triggers |
| 12 | Human role ambiguity | "high assurance" is read as automatic merge authority | merge/risk-acceptance remains separate user-governance concern |

## Acceptance Criteria

- [ ] **AC-1 — one capability vocabulary:** project assurance is represented by
      tool-neutral capabilities with observable evidence and
      `available|missing|degraded|unknown`; no competing readiness vocabulary
      exists.
- [ ] **AC-2 — no duplication:** no new TDD skill, test-coverage judge,
      fresh-reviewer mechanism or requirement-id grammar is introduced while
      the current owners exist.
- [ ] **AC-3 — risk-adaptive:** at least R0-R4 resolve to materially different
      assurance requirements, and trivial work demonstrably avoids expensive
      gates.
- [ ] **AC-4 — bootstrap closes the loop:** for at least PHP, TypeScript and
      Python fixtures, AC can detect a missing capability, recommend an adapter,
      configure it in a fixture project, prove it with a sensitive failure, and
      re-discover it as available.
- [ ] **AC-5 — legacy-safe:** a repository with poor global historical metrics
      can satisfy assurance for changed behavior without rewriting untouched
      code, while legacy debt remains visible.
- [ ] **AC-6 — evidence over claims:** a final `verified` verdict is impossible
      when any policy-required evidence is missing; test/review/runtime evidence
      is referenced structurally.
- [ ] **AC-7 — independence is explicit:** a same-session review cannot satisfy
      `independent-review`; test authorship is consumed from the existing
      experiment rather than assumed.
- [ ] **AC-8 — mutation is evidence, not vanity:** the core system has no
      universal min-MSI constant; survivors/timeouts are visible and
      changed-surface operation is supported where the adapter can do it.
- [ ] **AC-9 — autonomy is bounded by assurance:** the same requested task can
      receive different autonomy ceilings when repository assurance differs,
      without altering user merge authority.
- [ ] **AC-10 — runtime-aware:** user-visible/runtime changes can require
      executable runtime evidence, while pure/non-runtime changes are not forced
      through it.
- [ ] **AC-11 — benchmarked enforcement:** every newly blocking assurance
      mechanism cites a pre-existing evaluation showing incremental signal or a
      hard safety property that justifies blocking without an empirical uplift
      claim.
- [ ] **AC-12 — false confidence measured:** the evaluation suite reports
      false-verified rate, not just caught-defect rate.
- [ ] **AC-13 — cost visible:** assurance reports expose incremental runtime and
      model-call cost by mechanism sufficiently to tune the policy.
- [ ] **AC-14 — default-path adoption:** ordinary AC implementation flows use
      the assurance engine; the human-facing doctor is only a projection over
      the same source of truth.

## Blockers

### blocker: sibling-roadmap-dispositions

- **Status:** open
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

### blocker: assurance-enforcement-thresholds

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 8.5 and any new blocking policy not already a hard safety floor
- **What to do:** commit a pre-registration file at
  `src/config/assurance-threshold-budget.json` carrying one entry per dimension,
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

- `longcipher/pb-spec` — strict RED/GREEN/REFACTOR/MUTATE and changed-code mutation.
- `joshft/correctless` — agent separation, adversarial QA and dynamic rigor.
- `MadeByTokens/bon-cop-bad-cop` — isolated test/code/reviewer roles and mutation.
- `pedrofuentes/agents-template` — quality gates and multi-reviewer "Sentinel".
- `obra/superpowers` and related forks — evidence-over-claims, TDD and review
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
