---
complexity: structural
status: active
source_analysis: 2026-07-25
---

# Road to Enforcement Proof — say only what the machine actually enforces

> A source-level comparison against an external governance reference surfaced one
> class of defect that this package cannot see from the inside: **rules and
> contracts that assert enforcement the code does not deliver.** Four
> verification agents re-read every load-bearing claim against this repo's own
> source. The claims that survived are below; the ones that did not are recorded
> as refutations, because a discarded false alarm is evidence too.
>
> One sentence: **AC checks that a claim has a pointer. It does not check that
> the pointer is true — and in four places it claims enforcement that does not
> exist.**

## Goal

Close the gap between what this package's prose asserts is enforced and what its
CI, hooks, and linters actually enforce — and make that gap continuously
measurable, so it cannot silently reopen.

## Context — verified, do not relitigate

Every finding below carries a `file:line` a verification agent actually read.
Where the source analysis was wrong, the correction is recorded in the same line;
this is the "findings are hypotheses, log the refutation" discipline applied to
our own intake.

| # | Finding | Evidence | Correction to the source analysis |
|:--|:---|:---|:---|
| F1 | Override layer has no non-overridable class; a consumer can shadow any of the 9 kernel rules | `src/agent-src/contexts/override-system.md:96`; no `kernel/iron/safety` match in the override surface | The resolver `_lib/agents_overlay.ts:135` has **zero production callers** — enforcement is prose-to-model, not code. A prompt-layer hole, not a resolver bug |
| F2 | Subagent briefs carry no safety floor | `composeSpawnBrief` `_lib/subagent_spawn.ts:62-97` emits 6 fields, none governance; 0 floor hits in the 8 worker-prompt templates | The TS spawn path is **inert** (test-only callers). The live surface is `src/skills/subagent-orchestration/prompts/*.md`. There is no `hardenedSpawnEnv` symbol |
| F3 | `docs/contracts/subagent-boundary.md:38` **promises** "every floor applies inside the subagent… a subagent cannot do what its parent may not" — nothing delivers a byte of it | contract vs. brief schema + prompt templates | This doc↔code gap is the actual finding; the inert TS file is not |
| F4 | Claims ledger verifies pointer *existence*, never truth | `check_claims.ts:174-196` — dated URL (regex, never fetched), path (`existsSync`), path#substr (`includes`). `last_verified` parsed at `:66,106,119`, compared to nothing | Ledger is 29 entries / 24 backed / 6 markered — smaller than implied. **0 of 24** point at a runnable command, but ~14 point at artefacts with a producer already wired in CI |
| F5 | No `enforced_by` on rules. Sample of 10: **4** hard CI gates, **2** advisory hooks (`fail_closed: false`), **4** nothing | `rule.schema.json` (18 fields, `additionalProperties: false`) | "Nothing enforces them" overstates it — but coverage is far too thin to call the field ceremonial |
| **D1** | `lint_output_slop.ts` **ships and is wired nowhere** (0 hits across taskfiles, workflows, hook manifest) while `src/rules/output-discipline.md:43-44` asserts "violations cause a CI exit-code-2" | direct grep, both sides | **A false enforcement claim in shipped prose.** Found by the F5 sample, not by any existing gate |
| **D2** | `non-destructive-by-default` — `tier: safety-floor`, the Hard Floor — has no mechanical backstop of any kind | F5 sample row 2 | — |
| **D3** | `docs/customization.md:492-494` cites `agents_overlay.py` / `check_overlay_cascade_subdirs.py`; both were deleted in the TS port | `ls` on both paths | — |
| F6 | 128 ADRs (not 129); `review_trigger`/`review_cadence` = 0 | `ls docs/decisions/ADR-*.md \| wc -l` | **Missing field, not missing concept** — 33 ADRs state a revisit condition in prose, 11 carry a stray `review_date`, 1 has `## Revisit-if`. `decision-record` SKILL L108-112 already *mandates* the line. Root cause: **no ADR frontmatter schema exists** — `validate_frontmatter.ts` covers skills, rules, commands, personas only |

### What the reference object taught, corrected by reading it

The reference was read at source level (535 files, 93 Python tools). Two of its
mechanisms are weaker than its own docs claim, and recording that is part of the
borrowing:

- Its evidence re-executor is real (prefix-tuple allowlist, argument hardening
  on `--flag=value` right-hand sides, `shell=False`) — but it has **zero callers
  by choice**, documented as "the exemplar of refuse-vacuous-wiring" because
  nothing yet produces the input it consumes. Wiring a check with no real input
  is theatre; leaving it unwired and saying so is the honest form.
- Its "hash chain" does **not** cascade: the canonical form excludes `prev_sha`,
  so `H(n) = hash(content_n)`, not `hash(content_n ‖ H(n-1))`. Editing entry 5
  and rewriting entry 6's `prev_sha` yields a valid chain. Truncated to 32 bits.
  The external git-prefix witness is the part that carries the weight — which is
  why Phase 6 below parks the chain and keeps only the witness on the table.
- Its portable safety nucleus is 9 lines, not the "~15" its own ADR states three
  times, and its freshness check is registered at WARN despite the ADR promising
  FAIL. Both are the same defect class as D1 — prose asserting more than the
  wiring delivers.

The single most transferable norm found: **a rule with no feasible enforcement
tier is deleted rather than kept as honor-system theatre, and a check with no
real input is left unwired rather than run as decoration.** Everything below is
that norm applied to this package.

---

## Phase 1 — Make the gap measurable (`enforced_by` + coverage)

The cheapest phase, and the one that already paid: the 10-rule sample drawn to
size it surfaced D1 and D2 before a line of code was written.

- [x] **P1.1 — `enforced_by` in `rule.schema.json`.** Values: `hook:<name>` ·
      `validator:<script>` · `test:<path>` · `observer:<surface>` · `none`.
      Optional for now, so no retrofit is forced; `none` is legal but counted.
      The schema is `additionalProperties: false`, so this is a schema change,
      not a free-form annotation.
- [x] **P1.2 — Resolution, not declaration.** The coverage script must *resolve*
      each value against the filesystem and the wiring — a `validator:` whose
      script exists but appears in no taskfile, workflow, or hook manifest
      resolves to **unwired**, not to covered. This is the check that catches D1;
      a declaration-only field would have rated `output-discipline` as enforced.
- [x] **P1.3 — Distinguish blocking from instrumenting.** A hook registered with
      `fail_closed: false` is `observer:`, never `validator:`. Two of ten sampled
      rules read as enforced today purely because a hook exists that never
      blocks.
- [x] **P1.4 — Coverage report + committed baseline.** Emit counts per tier to
      `internal/reports/`. Ratchet: coverage may not fall. Publish the number in
      `docs/proof.md` and bind it in the ledger.
- [x] **P1.5 — Fix D1 honestly.** Either wire `lint_output_slop.ts` into CI, or
      correct `output-discipline.md:43-44,83` to state what is actually true.
      Decide by whether the linter has real input today — the refuse-vacuous-
      wiring test, not a preference.
- [x] **P1.6 — Fix D2 or state it.** `non-destructive-by-default` is a
      safety-floor rule with no backstop. If a mechanical backstop is infeasible
      (much of the Hard Floor is a model-behaviour obligation), the rule carries
      `enforced_by: observer:` **and** says so in-band, in the honest-labelling
      form the reference object uses throughout.

**Honest-null path.** If resolution shows ≥ 80 % of rules already carry a wired
backstop, P1.1's obligation is bureaucracy: keep the report as a published
number, drop the field requirement. The sample says this is unlikely (4/10), but
the sample is 10 of 107 and the full count decides.

## Phase 2 — Kernel carve-out for the override layer

The class the package's own security story assumes exists and does not.

- [x] **P2.1 — Single-source the kernel list.** The 9 names are duplicated across
      `check_kernel_rule_bundle.ts:39`, `iron_law_sha.ts`, and
      `measure_rule_budget.ts`. Any carve-out must import one, not add a fourth.
- [x] **P2.2 — Non-overridable class + an exception registry.** Both council
      members converged here from opposite starting points: a blanket name ban is
      right in direction but breaks this repo's own legitimate artefact
      (`agents/overrides/rules/verify-before-complete.md`, mode `extend`, which
      only *tightens* by mandating Playwright for UI changes). So: kernel and
      `tier: safety-floor` rules are non-overridable **except** via a registry
      entry naming rule, mode, justification, and approver. Flexibility survives;
      it just stops being silent.
- [x] **P2.3 — Mode is the machine-checkable proxy.** A linter cannot prove
      "relaxes" vs "legitimately narrows" from prose. So: `extend` on a kernel
      rule is allowed *with* a registry entry, `replace` is refused. State the
      residual honestly — an `extend` block can still say "ignore the above", and
      no linter catches that.
- [x] **P2.4 — Citation obligation.** Every override carries
      `> Overrides: <rule> §<section> — <reason>`. Makes the layer auditable
      instead of merely usable.
- [x] **P2.5 — Fix the consumer-facing docs, which are the strongest claim.**
      `src/templates/minimal/agents-overrides-readme.md` and
      `docs/customization.md:468-495` describe unconditional whole-file shadowing
      with no mode concept at all — a consumer following the shipped README would
      correctly expect an empty file to win. Also repair the D3 stale pointers in
      the same pass.
- [x] **P2.6 — An override audit *report*, not a gate.** The council's sharpest
      point, and it overturns the obvious design: a lint that fails the build on
      a kernel-named override file guards exactly one of several routes by which
      a consumer can tell a model to ignore a rule (a persona file, a skill
      override, host-level agent config, or a direct instruction all bypass it).
      Blocking route one does not reduce the surface — it relocates the override
      to a route with no visibility, while looking like coverage. So the script
      **reports and never fails the build**: it enumerates kernel-named overrides
      and registry coverage into a published audit. A consumer reading "0 kernel
      overrides" or "2 kernel overrides, both registered" gets real signal; a red
      X on one of several doors does not.
      The one thing it *does* hard-fail: a `replace`-mode override with no
      registry entry, because that is a check on our own authoring surface where
      the coverage claim is true.

## Phase 3 — A floor the subagent actually receives

- [x] **P3.1 — Floor block in the shared prompt prefix.** The 8 templates under
      `src/skills/subagent-orchestration/prompts/` already share a cache-stable
      prefix; a fixed block is served from cache at ~0.1× after the first sibling,
      so fan-out cost is near-zero. This is the only change that reaches a live
      subagent today.
- [x] **P3.2 — Keep it short and derived, not hand-written.** Generate from the
      kernel source so it cannot drift; the reference object's nucleus is 9 lines
      and that is the right order of magnitude. A hand-copied floor is a second
      source of truth.
- [x] **P3.3 — Freshness gate that actually fails.** The reference promises FAIL
      and registers WARN — do not inherit that. Drift between kernel source and
      generated floor fails in this repo.
- [x] **P3.4 — Delegation clause.** The primary treats a subagent-proposed
      destructive mutation as subject to the same Hard Floor; the subagent's own
      confirmation does not satisfy it. Without this the subagent is a detour
      around the gate.
- [x] **P3.5 — Reconcile the contract with reality.**
      `docs/contracts/subagent-boundary.md:38` states the floor as an ownership
      fact. After P3.1 it is partly delivered; the residual (host-native spawn
      inheritance is a host property this package neither asserts nor tests) is
      recorded in-band rather than left as an implied guarantee.

**Honest-null path.** If a prefix-cost measurement shows the floor block raises
cohort cost by more than a few percent and an A/B over the adversarial corpora
shows zero behavioural delta, the injection is theatre: publish the null,
default it off behind an opt-in, and say so.

## Phase 4 — ADR durability, so decisions can be overturned on purpose

The maintainer's standing position is that no decision is permanent. Today
overturning one is per-case archaeology: the concept is canon in
`decision-revisit-gate` and `decision-record`, but 128 ADRs have nowhere to put it.

- [x] **P4.1 — An ADR frontmatter schema at all.** None exists; `review_date`
      drifted into 11 ADRs and back out unnoticed precisely because nothing
      validates this surface. This is the root cause, and it is the cheap fix.
- [x] **P4.2 — `review_trigger` as a named condition, not a date.** A calendar
      review is ignored; an event fires. Required for new ADRs.
- [x] **P4.3 — Emit the slot from `adr-create`.** The skill mandates a
      "Revisit-if" line and its template never emits the field — which is why
      only 1 of 128 has a structured heading.
- [x] **P4.4 — Date-based grandfathering, not a retrofit of 128.** ADRs before
      the switch date warn; after it, fail. No exemption list to maintain.
- [x] **P4.5 — Retrofit only where it pays.** Narrowed during execution, and the
      narrowing is the honest part: the `type: structural` + security subset is
      83 of 128, but retrofitting 83 by hand would mean inventing ~80 triggers to
      satisfy a field. Three ADRs had a premise this analysis actually showed to
      be time-bound and got a real condition — **ADR-016** (installer conflict
      resolution), **ADR-110** (`discipline_profile` resolves rigor by host
      capability alone, missing the diff-risk axis), **ADR-109** (subagent
      contract, whose floor guarantee was undelivered). The remaining 125 stay
      grandfathered by date and acquire a trigger when someone next touches them
      with a reason to.
- [x] **P4.6 — Record the overturn form.** An overturned ADR names (a) which
      premise changed, (b) what evidences the change, (c) that the original was
      correct under its own conditions if it was. Not "we were wrong" — "this
      premise moved, here is which". A premise that turns out false while the
      decision stays right gets a logged correction block, never a silent edit.

## Phase 5 — Measure whether `exec:` evidence is worth building

The source analysis called `exec:` evidence the single most valuable borrowing —
the hole in this package's most differentiating feature. The council disagreed on
sequencing and it was right: **you cannot know whether a fourth evidence form
earns its maintenance surface until you know how many claims could carry it.**
Building it first inverts the dependency and risks a schema change, a validator,
and a renderer that move falsifiability by a few percent.

So this phase measures and decides; it does not build.

- [x] **P5.1 — Count exec-feasibility across the 24 backed claims.** For each,
      determine whether a deterministic command could re-derive the claim, and
      whether a producer for it already exists in CI. The starting count is known
      (0 carry one today; ~14 point at artefacts with a wired producer); what is
      unknown is how many of the remaining are feasible at all.
- [x] **P5.2 — Pre-register the decision threshold, before seeing the number.**
      If `exec:` would raise machine-re-verifiable coverage by **≥ 10 percentage
      points** of the backed ledger, it is justified and becomes its own PR. Below
      that, it is parked and the count itself is published. Pre-registration is
      the same discipline this package applies to its benchmarks, applied to its
      own build decisions.
- [x] **P5.3 — Publish the count either way.** "N of 24 backed claims are
      machine-re-verifiable" is a falsifiable statement about the ledger's real
      strength, and it is worth stating even — especially — when the number is
      unflattering.
- [x] **P5.4 — Record the design that would be built, so the decision is cheap
      later.** Prefix-tuple allowlist (never a regex over shell strings);
      argument hardening covering the right-hand side of `--flag=value` (without
      it, `--rootdir=/etc` passes an allowlist on the command name); re-execution
      in CI only, never in a consumer repo, since it has full filesystem access
      by construction; narrative results classified `UNVERIFIED`, and — unlike
      the reference object, whose unverifiable entries exit 0 silently — an
      unverifiable claim must not pass quietly.

**Honest-null path is the phase itself.** This phase's deliverable is a number
and a decision, not a feature. If the number says no, that is the result.

---

## Parked, with the condition that reopens each

Not deferred-in-place: each carries a named trigger, per Phase 4's own doctrine.

| Item | Why parked | Reopens when |
|:---|:---|:---|
| Hash chain over ledger / lessons | The reference's chain does not cascade and is 32-bit; the value sits in the **git-prefix witness**, not the chain. Building the weaker half first buys tamper-*theatre* | A tamper scenario is observed, or the witness (below) proves cheap and a second layer is wanted |
| Git merge-base prefix witness | Genuinely good and cheap, but it is insurance with no current incident | Any ledger or audit surface becomes externally consumed, or one truncation is observed |
| Adversarial governance eval corpus + rule coverage | Largest corpus effort here; the council already exists as a run environment, so the marginal gain is the *corpus*, not the harness | Phase 1's coverage report shows a cluster of `observer:`-only safety rules — those are exactly what an adversarial corpus can test and a linter cannot |
| Allowlist-grammar strict parser for capability YAML | Real and the strongest single mechanism in the reference object, but this package's equivalent surface is smaller | A capability/routing YAML becomes consumer-writable, or a substring-presence validator is found to fail open |
| Governed-writes lint | Worth having; the borrowable detail is that the linter imports the *same* policy loader as the runtime guard, so the two cannot drift | A direct-write bypass of `fs_atomic.ts` is found in review |
| Lifecycle scenario token model | Adoption-facing, not enforcement-facing; belongs to the adoption track, not this one | The adoption track reopens |
| Installer conflict-resolution reversal (framework-authoritative paths force-update, killing the `skip \| overwrite \| merge` dialog for them) | The direction is right — "preserve everything" is unsafe, because a consumer who reformats a security rule then silently receives no further fixes to that file. But the council flagged an underweighted transition cost: a consumer who *intentionally* changed behaviour in such a file would have it silently overwritten. The correct shape is two-stage — **instrument first** (hash-mismatch emits a warning and a published conflict report: "you have N framework-authoritative customizations that will break"), **force later**, after consumers have had a migration window | Phase 1 ships and the override layer has a documented migration target — i.e. once P2 gives customizations somewhere legitimate to live |
| Risk-driven rigor escalation (second axis beside host capability) | Genuinely a gap — a weak host plus a diff in the installer provenance path yields minimum discipline today. But it is a behaviour change to the authority model and deserves its own decision, not a subclause | Measured first: log which merges *would* have escalated, then decide with data |
| Non-refusable escalation class | Collides head-on with this package's authority model, where the user decides. The defensible version is "escalate, surface, comply — and record the refusal", not "override the user" | Only alongside the measurement above, and as its own ADR |

## Council convergence — 2026-07-25

Two members (Anthropic, OpenAI), two debate rounds, adversarial format. Both
opened from opposite positions on the override question and converged:

- **Kernel carve-out** — a name-based blanket ban is right in direction but wrong
  as shipped, because it breaks legitimate tightening. Converged form: a
  non-overridable class **plus** an exception registry carrying rule, mode,
  justification and approver. Adopted as P2.2.
- **Gate vs. report** — a build-failing lint on kernel-named override files
  guards one of several routes to the same outcome and relocates the rest out of
  sight; it reads as coverage while adding none. Converged form: publish an audit
  report, hard-fail only on the authoring surface where the coverage claim is
  true. Adopted as P2.6, overturning the obvious design.
- **Sequencing** — building `exec:` evidence before the coverage baseline
  inverts the dependency chain. Converged form: measure first, pre-register the
  threshold, decide with the number. Adopted as Phase 5, which now measures
  rather than builds.
- **Installer reversal** — right direction, underweighted transition cost;
  instrument before forcing. Recorded in the parked table with that shape.

One claim in the debate — a specific count of override injection routes — was
**not** adopted: no verification pass established that number, and the argument
does not need it. The principle stands without the figure.

## Acceptance criteria

- The enforcement-coverage number is published, ratcheted, and bound in the ledger.
- No shipped rule asserts CI enforcement that does not exist (D1 closed either way).
- A kernel rule cannot be silently replaced by a consumer override; tightening
  still works, and this repo's own Playwright override still passes.
- A dispatched subagent receives a floor derived from the kernel source, with a
  freshness gate that fails on drift.
- New ADRs cannot merge without a named revisit trigger; ADR frontmatter is
  validated at all.
- The `exec:`-evidence question is answered with a published count and a
  pre-registered threshold — built only if the number clears it, parked with the
  number stated if it does not.
- Every mechanism added states its own enforcement tier in-band, including the
  ones that are honestly unenforceable.
