---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
research_pin: "agent-config @ f16c7d9df2e1a4a6f480e734be6ed3a0138fc14d · @event4u/agent-config 14.10.0 · every baseline re-measured against the landing HEAD 2026-08-24"
estate_offset_exempt: "The one-in-one-out half of the estate ratchet fires on every added agents/roadmaps/road-to-*.md whatever its status, and the only roadmaps this drain run archived carried status: draft, which the ratchet never counted — so none of them is available as this file's offset."
---

# Road to a legible command surface

> **Source:** `agents/tmp.old/claude-promts/road-to-prompt-library-harvest.md`
> (authored in German; translated in full at landing per
> [`language-and-tone`](../../src/rules/language-and-tone.md) — all `.md` under
> `agents/` is English)

## Goal

Make this suite's **visible** command surface legible to a first-time reader:
copyable worked examples with a checkable pedagogy line, machine-declared
external tool prerequisites that an existing doctor entry point can probe, and
two small behavioural gaps closed — a re-orientation protocol and a delta mode
for repeat analysis runs.

Everything here is **defect-first**: no pattern is adopted additively. A source
was consulted only where a measured defect in this tree already existed, per the
inverted-harvest form the source draft used.

## Context

### Anonymized provenance

Per [`source-confidentiality`](../../src/rules/source-confidentiality.md), the
external references are named **source-anonymously**; real links are retained as
`ENC1:` tokens for maintainer recovery only.

| Ref | What it contributed | Link |
|---|---|---|
| **Source A** | Slot-template prompt shape with filled example invocations; a per-prompt pedagogy annotation; a `needs:`-style prerequisite declaration with rendered setup help; six distilled meta-patterns. | `ENC1:` (pending maintainer encryption) |
| **Source B** | A one-line re-orientation precaution for long sessions, and an "if the artefact exists, improve it instead of rewriting" analysis mode. | `ENC1:` (pending maintainer encryption) |
| **Source C** | Ecosystem context only — aggregator directories and best-practice lists. Contributed no adopted mechanism. | `ENC1:` (pending maintainer encryption) |

Previously-audited sources were **not** re-harvested. Nothing in this roadmap
adopts a mechanism from an aggregator list: per the harvest-freeze doctrine
there is no additive adoption without a measured repo defect.

### Method

Three loops. Loop 1 produced nine defect candidates from source comparison.
Loop 2 verified each against the live tree — **four were struck**, three were
quantified with a baseline. Loop 3 ran an adversarial pass against this suite's
own doctrine (estate-ratchet cost, ADR-236 one-artefact-one-layer,
falsifiability), producing the scope cuts and the pre-registered gates below.

At landing, a fourth pass re-measured every baseline and found that **three of
the source draft's proposed new artefacts already exist in this tree** — see
§ Corrections applied at landing. Each was re-scoped from *create* to *extend*.
Building any of the three fresh would have tripped ratchets for a capability
the tree already has.

---

## Verified defects

### D1 — No worked-example layer on the visible command surface

**Measured:** **4 of 61** top-level command files carry an `## Example` /
`### Example` section — `estimate-ticket`, `implement-ticket`, `refine-ticket`,
`work` (`grep` over `dist/agent-src/commands/*.md`).

`src/scripts/schemas/command.schema.json` knows `argument-hint` and
`suggestion.trigger_description`, but carries no field and no convention for a
**filled** example invocation. The site documentation shows structure, not
copyable slot-filled examples.

### D2 — No pattern pedagogy attached to examples

`grep -ril "why this works" src/ dist/agent-src/commands/` returns **0**. There
is no vocabulary in which an example can say *which* pattern makes it work, so
any pedagogy added today would be free-text and would drift.

### D3 — Command-level external tool dependencies are neither declared nor probeable

**Measured at landing, and corrected from the source draft:** across **202**
recursive command files, **14** mention `gh` / `docker` / `kubectl` /
`terraform`, and **8** actually invoke one — `council/pr.md`,
`roadmap/next.md`, `tests/execute.md`, `pr/merge.md`, `pr/create.md`,
`fix/seeder.md`, `fix/quality.md`, `fix/ci.md`.

None carries a machine-readable prerequisite declaration. The schema's `install`
field is `{default, removable}` only (ADR-013 install hints), not an environment
prerequisite; `src/config/host-capabilities.yml` is an evidence-gated
discipline-lift list, not a tool inventory.

**A house precedent already exists:** `reach:doctor` plus
`src/config/reach-channels.yml` — per-channel probe, pinned fix command,
lifecycle state — scoped to reach channels only.

### D4 — No re-orientation protocol after external edits between messages

`grep -rlEi "re-orient|reorient|edited outside|external edit"` over `src/` and
`dist/agent-src/` returns exactly **one** carrier:
`src/scripts/hooks/run_continuation_hook.ts`. The failure mode is real and
long-session-specific: the user edits files outside the session, and the agent
keeps working against a stale world model.

### D5 — `project-analysis-*` has no improvement mode

`grep -nEi "re-run|cache|existing analysis|refresh|already exists"` in
`src/skills/project-analysis-core/SKILL.md` returns **nothing**. Results land in
`agents/knowledge/concepts/` as a reviewed batch (`SKILL.md:146`), but a second
run has no "an artefact exists → update it in place" path.

### D6 — The pattern vocabulary file is genuinely absent

`src/config/discovery/` holds `command-verbs.yml`, `packs.yml`,
`session-profiles.yml`, `unassigned-artefacts.yml`, `workspaces.yml` — and no
`prompt-patterns.yml`. This one is a real create, and `command-verbs.yml` is its
ratchet precedent: its header states the forward-only contract this file should
copy.

---

## Prevented items — verified already-shipped

| Proposed | Already shipped at | Disposition |
|---|---|---|
| New gate `check_no_local_abs_paths` scanning published `.md` for `/Users`-style paths | `src/scripts/check_bundle_path_leakage.ts`, wired in CI at `.github/workflows/tests.yml:141`, with `/Users` and `/home` patterns, username redaction, and dead-scope protection via `src/scripts/_lib/scan_scope.ts` | **Re-scoped to extend**, not create — see 0.2 |
| New schema field `needs: {binaries, mcp, notes}` | `src/scripts/schemas/skill.schema.json:45-89` defines `runtime_requires` with `bins`, `env`, `primary_env`, `network`, explicitly *"in the form `doctor`/`preflight` can actually probe"*; its `$comment` records that zero skills use it today | **Re-scoped to reuse that vocabulary** — see 1.1 |
| A new "why this works" pedagogy convention plus its own linter | `src/scripts/lint_examples.ts:13-17` already requires a Why-it-works explanation, detected at `:88-93` as `### Why it works` or `**Why it works:**`, live across the **4** `docs/guidelines/agent-infra/*-demos.md` files | **Re-scoped to adopt the shipped string and extend that linter** — see 2.2 |
| Risk-assessment tiers (high/medium/low + triggers) | Covered and stricter: `trust.level` (5 states) plus `requires_confirmation` with staging semantics ("never act while asking") in the command schema | Struck in Loop 2 |
| Declarative workflow chains, context sharing, cache TTLs | Declarative YAML with no runtime or enforcement — the governance overhead this suite avoids; the `/work` engine already orchestrates phases with a state file | Struck in Loop 2 |
| Fat repository guides loaded as truth | Contradicts the knowledge-card doctrine head-on (positive structure is a hypothesis, never "verified"); only the improvement **mode** is adopted, at 3.2 | Struck in Loop 2 |
| Token budgeting | Covered by `token-optimizer` | Struck in Loop 2 |
| 1,500-line command-authoring prompts with an embedded best-practice corpus | Context bloat; solved here by the `command-writing` skill plus schema plus lints | Struck in Loop 3 |
| A 13-member focused-validation scan family | Covered by the `judge-*` family, `quality-tools`, and the `/analyze` cluster | Struck in Loop 2 |
| Blog pipeline, external note-store integration, vector memory | Covered (`ghostwriter`, `editorial-calendar`, `memory-consolidation`) or unproven infrastructure under the default-off doctrine | Struck in Loop 2 |
| An interactive SDLC × role browser UI | Profiles plus `docs/getting-started-by-role.md` plus the site command docs already carry the taxonomy; only the example layer was missing | Struck in Loop 2 |
| A session-stance priming command family | Stance is already trigger-delivered through skills and rules; only the re-orientation case was uncovered, and that is 3.1 | Struck in Loop 3 |

---

## Corrections applied at landing (2026-08-24)

| # | Source claim | Correction | Basis |
|---|---|---|---|
| 1 | Add a new gate `check_no_local_abs_paths` | **Extend** `check_bundle_path_leakage.ts` — already in CI, already carrying the `/Users` / `/home` regexes, username redaction and `scan_scope.ts` dead-scope protection, but scoped to bundle roots. Extend its scan roots to published `.md`, reusing both helpers. | `src/scripts/check_bundle_path_leakage.ts:1-30`; `.github/workflows/tests.yml:141`; `src/scripts/_lib/scan_scope.ts` |
| 2 | Add a new `needs:` field | **Reuse `runtime_requires`** — its vocabulary (`bins`, `env`, `primary_env`, `network`) exists and is described as probeable by `doctor`/`preflight`, with a `$comment` noting zero skills use it. Also recorded: `command.schema.json` is `additionalProperties: false` at `:8`, so any key addition is a schema change plus four regenerations; and **`requires` as a bare key name is reserved** for ADR-015 pack-dependency edges, which the schema's own description states. | `src/scripts/schemas/skill.schema.json:45-89`; `src/scripts/schemas/command.schema.json:8` |
| 3 | Invent a "why this works" convention | **Adopt the shipped literal `Why it works`** and extend `lint_examples.ts` to commands, rather than creating a parallel convention. | `src/scripts/lint_examples.ts:13-17,88-93`; 4 `*-demos.md` files |
| 4 | "14 command files invoke external binaries undeclared" | **8 invoking / 14 mentioning, of 202** recursive command files. The denominator was 61 in the source (top-level only) and the invoke/mention distinction was collapsed. | Re-measured at landing; file list in D3 |
| 5 | `ONBOARDING.md` cleanup as Phase 0 of this roadmap | **Split out** into § Recommended as a separate change — it is a standalone hygiene fix with no dependency on any phase here. The roadmap keeps only the ratchet that stops the class recurring. | See that section |
| 6 | (implicit) the file is shipped to npm consumers | It is **not** in the npm payload — `src/config/publish-surface.json` carries **0** `ONBOARDING` references. The exposure is the public git tree, not the package. | Re-measured at landing |
| 7 | "~20 visible commands" cited from the source | Left deliberately unpinned: measure the exact tier-0/1 count against the live tree when implementing 2.1, never quote it from a proposal. | Source draft's own instruction, kept |

---

## Recommended as a separate change, not a phase here

**`ONBOARDING.md` at the repo root should be resolved in its own change, before
or independently of this roadmap.** It was Phase 0 of the source draft; it is
split out because it has no dependency on anything else here, and bundling a
standalone hygiene fix into a structural roadmap delays it for no benefit.

Verified at the landing HEAD:

- The file carries **37** occurrences of a local absolute path, including the
  maintainer's real home directory (`grep -c '/Users/' ONBOARDING.md` → 37,
  all of them under one real home path).
- The repository is `private: false`, so the tracked git tree is public.
- Its content is a subagent-orchestration mapping report, not an onboarding
  document — the root placement and the filename are both misleading.
- It has been untouched since **2026-06-23** (`01b798f42`).
- It cites Python modules, while `find src/scripts -name '*.py'` returns
  **0** files.
- It is **not** in the npm payload: `src/config/publish-surface.json` has 0
  `ONBOARDING` references. The exposure is the public git tree.

Suggested shape for that separate change: move the content — with paths
rewritten repo-relative — to `docs/architecture/` or `agents/reference/`, and
either delete the root file or replace it with a thin, real onboarding page
pointing at `docs/getting-started-by-role.md`.

What **this** roadmap keeps is only the ratchet that prevents recurrence
(step 0.2), which is useful whether or not the file is fixed first.

---

## Phase 0 — The path-leakage ratchet

- [x] 0.1 Measure the current absolute-path population across published `.md`
  and record it as the pre-registered baseline before changing any scan scope.
      verify (discharged 2026-08-24):
      `agents/evidence/analysis/published-md-path-leakage-baseline.md` — count,
      per-pattern breakdown, full file:line table, and the derivation of the
      population from `package.json` `files[]`.

      **947 published `.md` · 12 hits · 9 files · ZERO leaks.** Every hit is one of
      three classes: an anonymised documentation example (4), an occurrence inside
      the rules that FORBID the pattern and must quote it (6), or a legitimately
      absolute path (2).

      **The measurement corrected itself twice, and both are recorded rather than
      overwritten.** The first pass said 11 of 1,079. It ran four of the gate's six
      patterns on a stated assumption that the two `node_modules` ones were
      "bundle-shaped and cannot occur in prose" — false, there is one prose hit, so
      the real figure is 12. And it scanned `src/agent-src/` wholesale when
      `files[]` ships only two subtrees of it, counting 132 files no consumer
      receives. **The second error was caught by the new test asserting every
      declared root is inside `files[]`** — a test written for the gate, catching
      the measurement.

      The narrow lesson, worth more than the numbers: run the gate rather than
      re-implementing its patterns.
- [x] 0.2 **Extend** `src/scripts/check_bundle_path_leakage.ts` to cover
  published `.md` files, reusing its existing username redaction and the
  `src/scripts/_lib/scan_scope.ts` dead-scope protection. Do **not** add a
  second gate: this one is already in CI at `.github/workflows/tests.yml:141`
  and already carries the patterns a new gate would duplicate.
      verify (discharged 2026-08-24), all four halves:

      | Probe | Result |
      |---|---|
      | seeded `/Users/realperson/…` in a published `.md` | **red** (exit 1) |
      | same seed **inside backticks** | **red** (exit 1) |
      | seed removed | green |
      | bundle-root behaviour | unchanged — an explicit single-file run reports `1 bundle + 0 published-md`, and the 31 pre-existing tests pass untouched |
      | **scope extension sabotaged** (`PUBLISHED_MD_ROOTS` emptied) with the seed in place | **exit 0 — it stopped firing**, which is the sensitivity proof |

      **The backtick row is the load-bearing one.** It empirically refutes the
      other candidate mechanism: both council seats rejected "exempt matches inside
      backticks and fenced blocks" because *a real leaked path is commonly
      formatted as code*, and the seeded-in-backticks probe is that argument as a
      measurement rather than a prediction.

      Extended rather than duplicated, as the step required: this gate already runs
      in CI, already carries the patterns, the username masking and the
      `scan_scope` dead-scope protection.

      **One defect the extension exposed and fixed:** the per-pattern hints are
      bundle-shaped (*"rebuild from a clean checkout"*), which is the wrong
      instruction for prose — nothing is rebuilt to fix a `.md`. A published-md hit
      now gets its own line naming the two real options: anonymise, or pin.
- [x] 0.3 Convert the measured baseline into a forward-only ratchet: new and
  edited files must be clean, the existing population melts down, target 0.
      verify (discharged 2026-08-24 with the mechanism CHANGED, and the change is
      the finding): a new dirty file fails; the recorded population does not.

      **"Target 0" was unreachable and the numeric ratchet was rejected.** The
      measured population contains six occurrences inside the rules that exist to
      FORBID the pattern — `doc-screenshot-hygiene` and `screenshot-hygiene` quote
      `/Users/<realname>/…` because that is their subject, and
      `low-impact-corpus-privacy-floor` lists `/opt/` and `/private/` as the
      patterns it detects. **A gate that reds on those makes the rule unwritable.**
      Melting the population to 0 would mean deleting correct content.

      AI council 2026-08-24, 2/2: **the floor is 0 UNAPPROVED matches, not a
      count.** A numeric floor of 12 was rejected for a specific reason — it lets
      an approved hit disappear while a real leak takes its slot and the count
      stays 12. So the twelve are **line-pinned exceptions** in `.path-leak-allow`,
      each carrying its reason and its class, and everything else reds.

      **Line-pinned deliberately, with the cost named:** the pins point into
      `dist/agent-src/`, a generated tree, so a pin drifts when its source gains a
      line. That reds the gate, which is the safe direction — someone re-audits and
      moves it — and a test asserts **every pin still matches something**, because
      a pin matching nothing suppresses nothing and hides that the exception was
      never re-audited. This tree has been bitten by the opposite already: a
      `.secret-allow` pin sat one line off on `main` for a day, covering nothing,
      invisible because that gate is diff-scoped.

      **No `gate-violation-baselines.json` entry**, and that is a consequence
      rather than an omission: a zero-unapproved floor has no number to ratchet, so
      the mechanism costs one of the three ratchets a new numeric baseline would
      have.

## Phase 1 — Command prerequisites and probing (from D3)

- [~] 1.1 Declare command prerequisites using the **existing** <!-- deferred: transferred to agents/roadmaps/stubs/road-to-command-runtime-requirements.md — gated on a maintainer schema-ownership decision -->
  `runtime_requires` vocabulary from
  `src/scripts/schemas/skill.schema.json:45-89` (`bins`, `env`, `primary_env`,
  `network`) rather than inventing a second shape. Note two hard constraints
  before touching the schema: `command.schema.json` is
  `additionalProperties: false` at `:8`, so this is a schema change plus four
  regenerations; and **`requires` as a bare key is reserved** for ADR-015
  pack-dependency edges and must not be used.
      verify: `./scripts-run src/scripts/validate_frontmatter` green, the four
      regenerations are run in order (`task sync` then `task generate-tools`),
      and the key name is not `requires`; blocked on
      `blocker: command-schema-additionalproperties`
- [~] 1.2 Add gate `check_command_needs`: a static body scan (invocation <!-- deferred: transferred with 1.1; the corrected 8/6 baseline travels with it -->
  heuristic on `gh`, `docker`, `kubectl`, `terraform`, extensible) against the
  declaration. Pre-registered baseline: **8 invoking / 14 mentioning, of 202**
  recursive command files. Forward-only ratchet on the `command-verbs.yml`
  precedent — new and changed commands must declare; the existing population
  melts down toward 0.
      verify: the gate reds on a seeded undeclared invocation, and the 8/14
      distinction is triaged by hand before the gate goes blocking, so a
      documentation-only mention is not counted as an invocation
- [~] 1.3 Probe declared prerequisites from an **existing** doctor entry point, <!-- deferred: transferred with 1.1 -->
  emitting the pinned fix command, reusing the reach probe taxonomy rather than
  building a parallel doctor.
      verify: a missing binary yields the pinned fix command and the correct
      probe state; blocked on `blocker: reach-doctor-generalisation-verdict`
- [~] 1.4 Hold the non-goals: no auto-install, and no network access on the <!-- deferred: transferred with 1.1 — a non-goal has nothing to hold until the phase runs -->
  default path (`--deep` stays opt-in, per the reach doctrine).
      verify: the probe issues zero network calls without `--deep`

## Phase 2 — A worked-example layer with checkable pedagogy (from D1 + D2)

- [ ] 2.1 Convention: every **visible** command (tier 0/1) carries an
  `## Examples` section with 1-3 filled invocations and exactly **one** Why
  line each. Measure the exact tier-0/1 count against the live tree when
  implementing — do not quote a figure from a proposal.
      verify: the measured tier-0/1 count is recorded in the change, and the
      convention is stated once in `command-writing`, not per command
- [ ] 2.2 Controlled pattern vocabulary: the Why line cites exactly one pattern
  ID from the six-member set (`outcome-not-steps`, `self-check-loop`,
  `point-at-reference`, `measurable-target`, `give-the-artifact`,
  `say-the-format`), stored as `src/config/discovery/prompt-patterns.yml` —
  genuinely absent today, with `command-verbs.yml` as the ratchet precedent.
  **Adopt the shipped literal**: `### Why it works` or `**Why it works:**`, the
  exact strings `lint_examples.ts:88-93` already detects. Extend that linter's
  scope to commands rather than authoring a parallel convention.
      verify: the vocabulary file exists with a forward-only header, the
      extended linter reds on an unregistered pattern ID, and the 4 existing
      `*-demos.md` files still pass byte-unchanged
- [ ] 2.3 Gate `check_command_examples`: (a) a tier-0/1 command without an
  Examples section fails, forward-only with the existing population melting
  down; (b) an example invocation must parse against the `argument-hint`
  grammar and the `routes_to` subcommands, so examples cannot drift silently
  through a refactor; (c) the Why line must cite a registered pattern ID.
  Pre-registered baseline: **4 of 61** top-level commands today.
      verify: each of the three sub-checks reds on its own seeded violation and
      greens on repair
- [ ] 2.4 Site sync: the site renders the Examples from the same source files —
  single-copy doctrine, no second maintained copy.
      verify: editing one source example changes the rendered page, and no
      duplicate example text exists in the site content tree

## Phase 3 — Two small behavioural fixes (from D4 + D5)

- [ ] 3.1 Add a re-orientation paragraph — **not** a new artefact, per ADR-236
  — to the appropriate execution context (candidates: the evidence-discipline
  or developer-like-execution context; decide when implementing): when the user
  mentions external edits, or a file read contradicts the last known state,
  re-orient first (renamed files, moved blocks), then continue. About 10 lines,
  accepted by review, no gate of its own.
      verify: the paragraph lands in exactly one context file and no new
      artefact is created; `./scripts-run src/scripts/check_references` green
- [ ] 3.2 Add an improvement mode to `project-analysis-core`: before a full
  analysis, check whether an artefact for the target already exists under the
  `agents/knowledge/concepts/` convention (`SKILL.md:146`); if so, take a
  targeted delta path — gaps, stale sections, new patterns — instead of a full
  rewrite. This stays entirely inside the card doctrine: cards are a hypothesis
  cache, never truth, and the mode changes only the write economics, never the
  trust status.
      verify: a fixture test asserts that an existing artefact selects the
      delta path and a missing one selects the full path

## Phase 4 — Later and only with evidence

- [~] 4.1 A "make it stick" suggestion: repeated manual invocations of the same <!-- deferred: transferred to agents/roadmaps/stubs/road-to-make-it-stick-telemetry.md — the telemetry to test the hypothesis does not exist -->
  command with similar arguments (local-analytics signal) produce a read-only
  suggestion to capture a preset or a learning via `learning-to-rule-or-skill`.
  Default-off. **Pre-registered precondition, carried over from the source
  draft:** local analytics must show **≥ 3 such repetition clusters in 30
  days** — otherwise do not build it.
      verify: the precondition is measured and recorded before any code; a
      failing measurement closes this step as a published null; blocked on
      `blocker: make-it-stick-telemetry`

---

## Blockers

### blocker: command-schema-additionalproperties

> **TRANSFERRED 2026-08-24 with Phase 1** to
> [`stubs/road-to-command-runtime-requirements.md`](stubs/road-to-command-runtime-requirements.md),
> probe `probe-command-schema-runtime-requires`. It stays **open** and moves file
> rather than closing: the schema-ownership question is unchanged and is the
> maintainer's. AI council 2/2 — an autonomous run may not widen a contract every
> consumer's frontmatter validates against.
- **Status:** open
- **Owner:** maintainer
- **Blocks:** 1.1, and by dependency 1.2 and 1.3. Phases 0, 2 and 3 ship
  without it.
- **What to do:** `src/scripts/schemas/command.schema.json` is
  `additionalProperties: false` at `:8`, so adding any prerequisite key is a
  schema change plus four regenerations, not an additive edit. Pick exactly
  one: (a) add the key using the **existing** `runtime_requires` vocabulary
  from `skill.schema.json:45-89` and run `task sync` then
  `task generate-tools` in that order; (b) carry the declaration outside the
  frontmatter (a sidecar keyed by command id) and keep the schema untouched;
  (c) scope Phase 1 to the 8 invoking commands only, declared by hand in a
  config file, and skip the schema entirely. **In every branch, do not name
  the key `requires`** — that name is reserved for ADR-015 pack-dependency
  edges, as the schema's own description states.
- **Recommendation:** (a) — the vocabulary already exists and was written to be
  probeable; a sidecar creates a second place to forget.
- **If you do nothing:** Phase 1 cannot start, and the 8 invoking commands keep
  failing silently on a host without `gh` or `docker`.
- **Resolved when:** the branch is chosen and, for (a), the schema change plus
  all four regenerations are committed together with `validate_frontmatter`
  green.

### blocker: reach-doctor-generalisation-verdict

> **TRANSFERRED 2026-08-24 with Phase 1.3** to the same stub. Unchanged and still
> open; 1.3 is the only step it gates and that step moved.
- **Status:** open
- **Owner:** maintainer
- **Blocks:** 1.3 only. 1.1, 1.2 and 1.4 are unaffected.
- **What to do:** `src/scripts/reach_doctor.ts:24-31` records a
  **pre-registered benchmark verdict of `band: stop`** — native arm 12/12,
  reach arm 0 outright wins — and states in the same docstring that no router
  ships and no channel is routed, preferred or suggested to an agent.
  Generalising its probe into a command doctor therefore re-opens a settled
  verdict and must run through
  [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) first.
  Then pick one: (a) confirm that reusing only the **probe taxonomy** (the five
  states) does not touch the routing verdict, and proceed on that narrow
  reading; (b) run the revisit gate properly and record a verdict; (c) build
  the command probe standalone and leave the reach code untouched.
- **Recommendation:** (a) — the verdict is about routing and recommendation,
  not about probing, so a taxonomy reuse is plausibly a different mechanism.
  Record that mechanism-match reasoning explicitly rather than assuming it.
- **If you do nothing:** 1.3 stays blocked and the declarations from 1.1 are
  unprobed, which makes them documentation rather than a mechanism.
- **Resolved when:** the mechanism-match reading is recorded, or a revisit
  verdict exists with a `revisit-if` line.

### blocker: make-it-stick-telemetry

> **TRANSFERRED 2026-08-24 with Phase 4.1** to
> [`stubs/road-to-make-it-stick-telemetry.md`](stubs/road-to-make-it-stick-telemetry.md),
> probe `probe-make-it-stick-telemetry`. Still open. It is a separate stub from its
> sibling deliberately: this one is gated on a **measurement that has to be built**,
> the other on a **decision that could be taken tomorrow** — different producers,
> different re-entry conditions, and `stubs/README.md` refuses to merge two probes
> into one.
- **Status:** open
- **Owner:** agent
- **Blocks:** 4.1 only.
- **What to do:** the precondition is already pre-registered in the source
  draft and carried into 4.1 verbatim — local analytics must show **≥ 3
  repetition clusters in 30 days**. Run `agent-config analytics:show` over a
  30-day window, count clusters of the same command invoked with similar
  arguments, and record the figure. Under 3 → publish the null and close 4.1
  without building.
- **Recommendation:** measure now and expect the null — the honest outcome is a
  published measurement either way, and it costs one command.
- **If you do nothing:** 4.1 stays open indefinitely as a plausible-sounding
  feature with no demand evidence, which is the shape this suite's own product
  gate exists to catch.
- **Resolved when:** the 30-day cluster count is recorded, and 4.1 is either
  unblocked or closed against the published null.

---

## Step ledger — every step in a defined state

The council that re-scoped this roadmap on 2026-08-24 required this table
explicitly: *"a 14-step roadmap partially executed needs each step in a defined
state, and 'the rest later' is not one."*

| Step | State | Where it went / why |
|---|---|---|
| 0.1 baseline | **executed** | `agents/evidence/analysis/published-md-path-leakage-baseline.md` — 947 files, 12 hits, 0 leaks |
| 0.2 extend the gate | **executed** | `check_bundle_path_leakage` scans published `.md`; four sensitivity probes incl. the backtick case |
| 0.3 the ratchet | **executed, mechanism changed** | `.path-leak-allow`, floor = 0 unapproved. "Target 0" was unreachable |
| 1.1 `runtime_requires` | **transferred** | [`stubs/road-to-command-runtime-requirements.md`](stubs/road-to-command-runtime-requirements.md) · probe `probe-command-schema-runtime-requires` |
| 1.2 `check_command_needs` | **transferred** | same stub; the corrected 8/6 baseline travels with it |
| 1.3 doctor probe | **transferred** | same stub |
| 1.4 hold the non-goals | **transferred** | same stub — a non-goal has nothing to hold until the phase runs |
| 2.1 `## Examples` convention | **open, executable, NOT executed** | see below |
| 2.2 pattern vocabulary | **open, executable, NOT executed** | see below |
| 2.3 `check_command_examples` | **open, executable, NOT executed** | see below |
| 2.4 site sync | **open, executable, NOT executed** | see below |
| 3.1 re-orientation paragraph | **open, executable, NOT executed** | see below |
| 3.2 `project-analysis-core` improvement mode | **open, executable, NOT executed** | see below |
| 4.1 "make it stick" | **transferred** | [`stubs/road-to-make-it-stick-telemetry.md`](stubs/road-to-make-it-stick-telemetry.md) · probe `probe-make-it-stick-telemetry` |

### The six open steps are open, not blocked — and the distinction is the point

```
PHASES 2 AND 3 NEED NO CAPABILITY THIS RUN LACKED. THEY WERE NOT REACHED.
RECORDING THEM AS TRANSFERRED WOULD CLAIM A BLOCKER THAT DOES NOT EXIST.
```

The council ruled both **executable in this run**, and it was right — there is no
schema decision, no missing telemetry, no absent host. The autonomous drain run
that executed Phase 0 simply did not get to them, and that is a **capacity** fact
about the run, not a **capability** fact about the work. A `stubs/` transfer
asserts the second, so using one here would be a false blocker.

What Phase 2 needs, measured so the next run starts from numbers rather than the
proposal's:

- The axis is **`visibility:`**, not `tier:` — `command.schema.json:20` records
  that the integer `tier:` alias was **removed**, so the roadmap's "tier 0/1"
  vocabulary is stale. 201 of 202 command files carry no `tier:` key at all.
- Over the 222 files `lint_command_tiers` scans: **179 `internal` · 18 `advanced` ·
  5 `visible` · 20 with NO `visibility:` key**.
- The convention binds `visible` **+** `advanced` (council 2/2) = **23 governed**,
  of which **5 already carry `## Examples`** → **18 to write.**
- **The 20 missing-key files are a Phase 2 CLOSURE PREREQUISITE**, not a separate
  concern: Phase 2 cannot honestly close while 20 commands silently evade the
  classification the convention keys on. Establish whether omission has a
  documented default; if not, classify them, then re-run the census before
  freezing the gate.
- `check_command_examples` will cost the same **three ratchets** as any new gate.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Estate-ratchet cost of a per-command example duty | product | Phase 2 raises the maintenance load on every visible command; an unbounded duty makes the surface harder to change, not easier to read | Scoped to tier 0/1 only (2.1); examples machine-validated against `argument-hint` and `routes_to` so refactors surface drift instead of rotting (2.3b); single-copy rendering (2.4) | Phase 2 — A worked-example layer with checkable pedagogy |
| 2 | Heuristic noise in the binary scan | implementation | The invocation heuristic conflates mentioning a binary with calling one — measured 14 mentions against 8 real invocations | The 8/14 split is triaged by hand before the gate goes blocking, with an allowlist for code blocks that only document a binary (1.2) | Phase 1 — Command prerequisites and probing |
| 3 | A parallel gate duplicating an existing one | implementation | A fresh `check_no_local_abs_paths` would trip three ratchets and duplicate patterns, redaction, and dead-scope protection that already ship | Re-scoped to extend `check_bundle_path_leakage.ts` (0.2), whose bundle-root behaviour must stay byte-unchanged | Phase 0 — The path-leakage ratchet |
| 4 | A second prerequisite vocabulary | implementation | Inventing `needs:` beside the shipped `runtime_requires` creates two schemas for one concept, and using the bare name `requires` would collide with ADR-015 pack edges | 1.1 reuses `runtime_requires` and names the reserved key explicitly; `blocker: command-schema-additionalproperties` forces the branch decision before any edit | Phase 1 — Command prerequisites and probing |
| 5 | Pedagogy drifting into essays | product | A free-text "why" line degrades into prose nobody reads and nothing can check | 2.2 restricts the line to one ID from a closed six-member vocabulary in `prompt-patterns.yml`, enforced by the extended linter (2.3c) | Phase 2 — A worked-example layer with checkable pedagogy |
| 6 | False-positive fatigue on the examples gate | implementation | A gate that forces frequent cosmetic fixes gets disabled, taking the real coverage with it | Pre-registered downgrade, carried from the source draft: if `check_command_examples` forces more than 2 false-positive fixes per week over 60 days, it drops to warn | Phase 2 — A worked-example layer with checkable pedagogy |
| 7 | Re-opening a settled verdict by reusing reach code | product | `reach_doctor.ts:24-31` records a `band: stop` verdict; generalising its probe without a revisit record would override a live decision | `blocker: reach-doctor-generalisation-verdict` gates 1.3 behind either an explicit mechanism-match reading or a recorded revisit verdict | Phase 1 — Command prerequisites and probing |
| 8 | Building 4.1 without demand | product | A repetition-suggestion feature is easy to justify by intuition and hard to justify by data | The ≥ 3 clusters / 30 days precondition is pre-registered and default-off; `blocker: make-it-stick-telemetry` requires the measurement first | Phase 4 — Later and only with evidence |
| 9 | The improvement mode eroding the card doctrine | product | A delta path over existing analysis artefacts could be read as treating a card as verified truth | 3.2 states explicitly that only the write economics change, never the trust status; the fixture test asserts path selection, not content trust | Phase 3 — Two small behavioural fixes |
| 10 | The re-orientation fix becoming a new artefact | implementation | A behavioural protocol invites its own file, which ADR-236 one-artefact-one-layer forbids | 3.1 is a ~10-line paragraph in exactly one existing context, accepted by review with no gate of its own | Phase 3 — Two small behavioural fixes |

---

## Acceptance Criteria

1. No new absolute-path gate exists; `check_bundle_path_leakage.ts` covers
   published `.md`, reuses its own redaction and `scan_scope.ts`, and its
   bundle-root behaviour is byte-unchanged.
2. The path-leakage ratchet value equals a recorded pre-registered
   measurement, and a newly-dirty file fails while the recorded population
   does not.
3. Command prerequisites are declared in the `runtime_requires` vocabulary,
   never in a second invented shape, and never under the reserved key
   `requires`.
4. Any `command.schema.json` change ships with all four regenerations in the
   same change, with `validate_frontmatter` green.
5. `check_command_needs` reds on a seeded undeclared invocation, and its
   baseline is recorded as **8 invoking / 14 mentioning, of 202** recursive
   command files.
6. The declared prerequisites are actually probed from an existing doctor
   entry point, with the pinned fix command emitted — or 1.3 is explicitly
   scoped out with its blocker resolved.
7. No auto-install exists, and the default probe path issues zero network
   calls.
8. Every visible tier-0/1 command carries an `## Examples` section with filled
   invocations, against a count measured on the live tree rather than quoted
   from a proposal.
9. The pedagogy line uses the shipped literal `Why it works` and cites exactly
   one ID from the closed vocabulary in
   `src/config/discovery/prompt-patterns.yml`. <!-- ref-ignore --> <!-- this roadmap own deliverable -->
10. `lint_examples.ts` is **extended** to commands; the 4 existing
    `*-demos.md` files still pass byte-unchanged, and no parallel pedagogy
    linter exists.
11. Example invocations parse against `argument-hint` and `routes_to`, so a
    refactor surfaces example drift instead of leaving it silent.
12. Examples render on the site from the same source files, with no second
    maintained copy.
13. The re-orientation protocol lands as a paragraph in exactly one existing
    execution context, with no new artefact.
14. `project-analysis-core` selects a delta path when an artefact exists,
    proven by a fixture test, with the card trust status unchanged.
15. 4.1 is built only after the ≥ 3 clusters / 30 days measurement is
    recorded, or closed against a published null.
16. No row in § Prevented items has been built.
17. No external source is named in the tracked text; references appear only as
    Source A/B/C with `ENC1:` links, and
    `./scripts-run src/scripts/check_no_external_sources` is green.
18. The `ONBOARDING.md` resolution is **not** part of this roadmap's phases;
    only the recurrence ratchet is.

---

## Explicit non-goals

- No auto-install of any external binary, and no network access on a default
  probe path.
- No second prerequisite vocabulary beside `runtime_requires`, and no use of
  the reserved key `requires`.
- No parallel doctor implementation, and no router or recommendation surface
  built on the reach registry.
- No free-text pedagogy — the Why line is a closed vocabulary or it does not
  ship.
- No new artefact for the re-orientation protocol (ADR-236).
- No second maintained copy of any example text.
- No additive command adoption from an aggregator list without a measured
  defect in this tree.
- No repetition-suggestion feature before its pre-registered demand threshold
  is measured.
