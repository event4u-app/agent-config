---
kind: analysis
subject: continuity-retirement-scope
observed_at: 2026-09-08
commit: 8a3160242197c39b070e58d288a504a8d1c371fc
---

<!-- evidence-type: analysis -->

# Council record — scoping the continuity retirement for one PR (2026-09-08)

> **Verbatim transcription of a council run, not a summary.** The council CLI
> writes only under `agents/runtime/council/responses/`, which is gitignored, so
> a verdict cited from there is unresolvable to any reviewer. Both seat
> responses are reproduced below in full, unedited.

## Run metadata

| Field | Value |
|---|---|
| Mode | `design` / prompt-mode `design` |
| Depth | `deep` — 3 rounds, blind chairman |
| Members | `anthropic/claude-sonnet-4-5`, `openai/codex-default` |
| Quorum | **2 of 2 present** — concluded, NOT degraded |
| Transport | CLI / subscription |
| Billed | 0.0000 USD |

**On the attendance line specifically.** The pre-run probe recorded
`anthropic: unavailable (live_probe: last exchange 2026-09-08 — other)` and the
run announced it would proceed with one seat. **Both seats then answered**, and
the run's own quorum block records `present: 2, total: 2`. The verdict below is
therefore a full two-seat convergent council, and the `DEGRADED` line in the
console output describes the pre-run probe rather than the run. Stated
explicitly because reading that console line alone would understate the
evidence.

## Verdict — convergent on all five decisions

| # | Decision | Ruling, both seats |
|---|---|---|
| D1 | scope of the single PR | **Option 3**, narrowed. Measurement instrument first, and as a NON-PUBLIC CI gate — openai: *"Turning it into a public CLI command would enlarge the very surface being reduced."* Schema variant defined and every reader made tolerant BEFORE any writer. `context-fill.json` retirement authorised on the supplied producer/no-consumer evidence. The two slash-command retirements conditional on a proven non-use audit — *"Retiring them requires proving non-use, not just proving they're marked internal."* The `concern_count` ratchet resolved by legitimate subtraction and **explicitly not** by a temporary allowance. OUT: `hot-context`, `session:recycle`, the `chat-history:checkpoint` rename, downstream installed-hook migration, claiming the target vector, and enabling any writer by default. |
| D2 | is the capture-endpoint rename owner-reserved? | **Option 2 — owner-reserved.** openai: *"Net zero describes a count, not authorization. A new endpoint name is a new callable contract. A deprecation alias also means the old name remains operational and therefore has not yet been retired."* File the blocker the roadmap already anticipates. |
| D3 | AC-7 when the vector cannot read `0/0/1/1/0` | **Option 3 — split.** AC-7a — the derivation exists, is CI-wired, and publishes the inventory with every exclusion's reason — closes now. AC-7b — the vector reads the target — carries to a named receiver with the current vector stated. |
| D4 | may parity be discharged deterministically? | **Neither Option 1 nor Option 2.** Fixture equivalence discharges *transformation* parity only. Activation, consumption, publication and failure-isolation parity need integration evidence against the real dispatcher and storage adapter with controlled failures — but openai: *"A wall-clock soak is unnecessary if these behaviors are exercised against the real dispatcher and storage adapter with controlled failures."* |
| D5 | does the writer without the retirement reproduce Risk 1? | **Option 3 — acceptable only under a staged activation contract:** writer default-off behind its own switch, independent switches per handler, readers tolerant before emission, atomic create-if-absent publication, safe skip plus a diagnostic when the slot is occupied, rollback documentation distinguishing "disable the new behaviour" from "revert a deletion", and named automatic trip criteria. |

## The two findings neither the question nor the roadmap anticipated

**1. The estate-count ratchet is a sequencing blocker for step 3.1.** Both seats
raised it independently, unprompted. `check_estate_count` ratchets
`concern_count` with allowance 0; splitting one concern into three is +2, and
nothing inside this PR's authorised scope retires a concern to pay for it.
Anthropic: *"This must be resolved before D1 is executable."* Openai: *"Resolve
the estate-count ratchet through legitimate final-tree subtraction or an
explicitly reviewed taxonomy correction. No temporary allowance."* Of the three
resolutions anthropic listed, only the third — *"Defer splitting until after
retirements reduce the count"* — is available here, because no concern
retirement is inside the scope this PR may execute.

**2. The authoritative record slot, not the dispatcher, is the primary trust
boundary.** Openai's hardest pushback: the producer to single-slot
consume-by-rename record to validating-and-destructive consumer chain has no
documented conflict ownership, and automatic production changes contention from
rare to routine. A capacity policy — safe skip, quarantine, or a bounded
multi-record queue — is *"an open architectural decision disguised as filesystem
plumbing"*, and it must be settled before an automatic writer is enabled.

Anthropic's own hardest pushback lands on the same seam from the other side:
splitting `session_eol_hook.ts` is *"architecture change disguised as
refactoring"* — the three things it does today share one `stop` firing, one
session-end detection and one failure mode, so separating them introduces
ordering and failure semantics that did not previously exist.

## The question, as asked

The full question file is reproduced below so a reader can check the verdict
against what was actually put, rather than against a description of it.

~~~markdown
# Scoping `road-to-continuity-retirement-sequencing` for a single autonomous PR

You are asked to rule on five decisions. Answer each with an explicit option
choice and a `Resolved when:` condition. Direction alone is not enough — the
asking session is autonomous, has end-to-end execution authority (ADR-237), and
will act on whatever you rule, so a ruling that cannot be executed is worse than
a narrow one that can.

## The situation, with the facts re-derived at this commit

`agents/roadmaps/road-to-continuity-retirement-sequencing.md` is the receiver of
six `[~]` items deferred out of the archived `road-to-one-continuity-record`. It
carries 6 open steps (3.1, 3.2, 3.3, 4.1, 4.1b, 4.2) and 3 open acceptance
criteria (AC-5, AC-7, AC-8). Nine open boxes, none ticked.

The goal is SUBTRACTIVE. Its success measure is five end-state numbers reading
`0 / 0 / 1 / 1 / 0`: public continuity commands 0, session resume pickers 0,
persistent continuity artefacts 1, continuity schemas 1, normal-path manual
actions 0.

A prior council (2026-09-07, 2 seats, anthropic + openai) ruled option 1
directionally on five decisions and DENIED the implementation greenlight. It
named a nine-step sequence and said steps 5 to 9 "are not reachable from a
session that cannot observe downstream installations or run an observation
window". Its D2 required that `run_checkpoint` production NOT be folded into a
continuity concern — independent handlers behind a lifecycle dispatcher, with
independent kill switches. Its D3 said relocating where the `hot-context`
restore activates is new architecture needing evidence of equivalence plus an
explicit trust contract. Its D4 said the deterministic writer must add a schema
VARIANT rather than stuff absence markers into `main_session`, and tolerant
readers must exist before any writer emits it.

### What is measured true in the tree right now

- `src/scripts/hooks/session_eol_hook.ts` (462 lines) does three unrelated
  things on `stop`: EOL counters (`:354-367`), `context-fill.json`
  (`:369`, constant `:77`), and `run_checkpoint` (`:391-412`, gated on
  `shouldAdvise` at `:392`, so it fires on exactly one Stop per session).
- The session-index restore is NOT in that file. It is in
  `src/scripts/hot_context_hook.ts:404-425`, lazily requiring
  `session_memory_index.js`, wired at `:489-492`.
- `run_checkpoint` has exactly ONE producer (`session_eol_hook.ts:404/:407`) and
  real consumers: `src/scripts/run_supervise.ts:48-52`,
  `src/scripts/_lib/headless_invocation.ts:66/:89`, and the model-facing resume
  protocol at `src/agent-src/contexts/execution/roadmap-process-loop.md:756`.
- NO automatic continuity-record writer exists. The only writer today is the
  manual verb `session:recycle` (`src/cli/registry.ts:73`,
  `src/scripts/_cli/cmd_session_recycle.ts`).
- The reader exists and already reuses every guard by name:
  `src/scripts/handoff_context_hook.ts:158-282` calls `validateRecycleEnvelope`
  (`:215`), `RECYCLE_MAX_AGE_HOURS` (`:226`), the workspace identity check
  (`:233-243`), `predecessorTracePresent` (`:250`), `scanEnvelopeDirectives`
  (`:263`), `wrapAsPriorSessionData` (`:265`) and consume-by-rename (`:192-205`).
- The reader does NOT dispatch on `session_start` `source`
  (`handoff_context_hook.ts:309` treats every `session_start` alike). The
  hot-context restore DOES (`hot_context_hook.ts:480`, `restore_hot_context(root,
  source)`), so the pattern exists to copy.
- Kill switches are NOT uniform. `hot-context`, `handoff-context`, `session-eol`
  and `session-register` have NO settings kill switch at all — only env vars
  (`AGENT_RECYCLE_THRESHOLD_TOKENS=0`, `AGENT_CONFIG_REPLAY`). Only
  `journal-record` uses `hooks.<section>.enabled` via
  `src/scripts/_lib/hook_settings.ts:30`.
- Schema state: `CAPSULE_SCHEMA_VERSION = 4`
  (`src/scripts/_lib/subagent_capsule.ts:112`), `ACCEPTED_CAPSULE_VERSIONS =
  [3, 4]` (`:144`), `CAPSULE_VARIANTS = ['worker', 'main_session']` (`:147`).
  So D4's third variant does not exist yet, and its unknown-variant branch is
  untested by construction.
- NO command derives the five numbers. `grep -rn -i "end-state" src/scripts/`
  returns one unrelated hit; there is no continuity counter anywhere. AC-7's
  "re-derived by command" is net-new work.
- `docs/CLAIMS.md` carries 96 claim rows and NOT ONE backed row depends on
  `handoff`, `session:recycle`, `chat-history:checkpoint` or any of the seven
  runtime artifacts. Shrinking the surface invalidates no backed claim.
- Blast radius of the authorised retirement set, measured by grep over tracked
  files: `hot-context` / `hot_context` appears in 35+ files including
  `src/config/agent-settings.template.yml`, `src/server/schemas/settings.ts`,
  `src/scripts/_lib/loss_class.ts`, `src/scripts/check_loss_class_declared.ts`,
  `src/scripts/routing_doctor.ts`, `src/scripts/_lib/config_cost.ts`,
  `src/scripts/_lib/obligation_frequency.ts`, `src/config/hook-token-budget.json`,
  `src/config/gate-coverage.yml`, 8 docs and 2 ADRs. `session:recycle` appears
  in 18. Both sets carry live tests.
- `chat-history:checkpoint` is a DISPATCHER ALIAS, not a script subcommand:
  `src/scripts/_dispatch.bash:1045-1051` maps it to `chat_history.ts hook-append
  --event phase`. The verb string is baked into four generated git hooks
  (`src/scripts/install-hooks.sh:459-484`) already installed in downstream
  checkouts, and `post-merge` / `post-checkout` carry a SECOND appended
  auto-sync segment (`:509-575`), so ownership detection must match two
  generated contents per hook.
- `src/scripts/check_estate_count.ts` already ratchets a `concern_count` axis
  read from `src/scripts/hook_manifest.yaml` with allowance 0. Splitting one
  concern into three is +2 concerns against that ratchet in the same change.

### The dependency chain that constrains any plan

Retiring `session:recycle` requires an automatic writer to exist (3.1), or the
tree has NO continuity writer at all. Retiring the `hot-context` concern
requires relocating the `memory.session_index` restore, which the 2026-09-07 D3
put behind evidence of equivalence and a trust contract. Retiring the
`chat-history:checkpoint` NAME requires a surviving endpoint name AND a
migration for hooks already installed in checkouts this session cannot observe.

## The five decisions

### D1 — the scope of this single PR

- **Option 1 (full):** execute all six steps and all three ACs in one PR,
  including the full retirement set and the installed-hook migration.
- **Option 2 (additive half):** execute 3.1, 3.2, 3.3 and defer all of Phase 4.
- **Option 3 (instrument + writer + reachable retirements):** execute 4.2 first
  as the measuring instrument (a `check_continuity_surface` gate publishing the
  behavioural inventory, its exclusions with reasons, and the five numbers, plus
  the add-without-retire ratchet), then 3.1 / 3.2 / 3.3, then only those
  retirements that need neither a downstream installation nor an observation
  window — `context-fill.json` (producer, no consumer; the 2026-09-07 D2 already
  authorised retiring it with the concern) and the `/chat-history` +
  `/chat-history import` slash commands (both `visibility: internal`, no
  installed-hook dependency, and `/chat-history import` is literally a session
  resume picker, i.e. end-state number 2). Defer `hot-context` (D3) and
  `session:recycle` (parity window) with a recorded reason.
- **Option 4:** something else you specify precisely.

`Resolved when:` you name one option and, if it is 3 or 4, state which
retirements are in and which are out.

### D2 — is retiring the `chat-history:checkpoint` NAME owner-reserved?

The stub reserves "introducing a new public command as the surviving capture
endpoint" to the owner, on the ground that the 2026-09-06 authorisation "names
what is retired, not what is added". A rename retires one public name and adds
one, net zero public commands.

- **Option 1:** a rename is inside the authorisation (net zero), so the run may
  execute it with a deprecation alias for installed hooks.
- **Option 2:** a rename introduces a new public name and is owner-reserved; the
  run files a blocker and does not execute it. The roadmap itself anticipates
  this at its § "Two things this roadmap may not decide": *"If 4.1b's migration
  turns out to need a new public command, that is the point at which a blocker
  is filed."*
- **Option 3:** other.

`Resolved when:` you rule reserved or not reserved, and if not reserved you name
the migration shape (alias vs flag-day) the run must use.

### D3 — AC-7 when the numbers cannot yet read `0 / 0 / 1 / 1 / 0`

Under D1 option 3 the derivation command exists and is CI-wired, but the numbers
will read lower-than-today rather than the target, because `hot-context`,
`session:recycle` and the `chat-history:checkpoint` name are still standing.

- **Option 1:** AC-7 is satisfied by the DERIVATION existing, being CI-wired and
  publishing the inventory; the target VALUES are carried to a receiver.
- **Option 2:** AC-7 is not satisfied until the values read `0/0/1/1/0`; it must
  be carried whole and the roadmap may not close.
- **Option 3:** split AC-7 into a mechanism half (closeable now) and a value
  half (carried), each stated as its own criterion.

`Resolved when:` you name the option and, if 1 or 3, the exact wording of what
closes now.

### D4 — may the parity requirement be discharged deterministically?

The 2026-09-07 sequence step 6 requires "a non-authoritative comparison with
outputs physically separated", and the stub's probe P3 reads FALSE. That shape
presumes a shadow writer running alongside a live one over an observation
window. But the writer this roadmap builds is DETERMINISTIC BY CONSTRUCTION —
step 3.1 requires it to run "without model spend" and write "only what it can
derive", so its output is a pure function of on-disk state.

- **Option 1:** for a deterministic writer, a fixture-driven equivalence test
  (recorded transcripts and roadmap states in, both writers' outputs compared
  field by field, outputs in a scratch directory that is neither the
  authoritative filename nor the authoritative directory) fully discharges the
  parity requirement, and a wall-clock observation window adds nothing a
  deterministic function can fail at.
- **Option 2:** the observation window is required regardless; a fixture test is
  not parity evidence.
- **Option 3:** fixture equivalence discharges it for the deterministic fields
  and a named subset still needs live observation — you name that subset.

`Resolved when:` you name the option and the evidence artifact that closes it.

### D5 — does adding the writer without the full retirement reproduce Risk 1?

Risk 1 of both this roadmap's and its parent's register is *"the record is added
and nothing is retired"* — the thirteenth layer that removes nothing. Under D1
option 3 the change adds one genuinely new mechanism (the automatic writer),
relocates two (run-checkpoint production, session-index restore), retires
`context-fill.json` and two slash commands, and lands the ratchet plus the
behavioural inventory in the SAME change.

- **Option 1:** acceptable — the ratchet landing in the same change is exactly
  Risk 1's stated mitigation, and a measured, published, CI-enforced inventory
  is a stronger guard than the twelve prior layers ever had.
- **Option 2:** not acceptable — the writer must not land until the retirement
  set lands with it, so 3.1 defers too.
- **Option 3:** acceptable only under a named additional condition you state.

`Resolved when:` you name the option, and if 3, the condition.

## What the asking session will do with your answer

It will execute the option you name, close the steps its verify lines support,
file blockers or council-backed descopes for the rest, and ship one PR. It will
not come back to ask again. Rule precisely.
~~~

## Seat responses, verbatim

### Seat: `anthropic/claude-sonnet-4-5`

Matze, I'll review the prior critiques, then rule on the five decisions with the architectural concerns neither reviewer adequately addressed.

#### Agreement and disagreement with prior rounds

##### Points I agree with

**Reviewer A:**
- D1 Option 3 is the only credible scope — full retirement requires capabilities this session cannot observe
- D2 Option 2 is correct — "net zero" counts commands, not authority; the new name is an addition
- D3 Option 3 split is the right approach — mechanism is verifiable now, values are not
- The five conditions listed for D5 are good gates, but insufficient (see below)

**Reviewer B:**
- The lifecycle dispatcher IS a new trust boundary — treating 3.2 and 3.3 as "ordinary relocations" glosses over ordering, failure propagation, and exactly-once semantics
- D4's determinism argument is incomplete — transformation purity ≠ operational parity
- Independent kill switches are prerequisites, not enhancements
- The estate-count ratchet blocking concern is real and unaddressed by Reviewer A

##### Points I disagree with

**Reviewer A, D4:**
Your fixture list (≥5 sessions, 100% field match) proves the transformation is correct but not that the lifecycle integration is correct. The 2026-09-07 council ruling required "non-authoritative comparison with outputs physically separated" — that phrase is about operational isolation, not just file location. You're testing the wrong layer.

**Reviewer B, D4:**
You correctly identify the lifecycle-layer gaps, but "bounded lifecycle integration report" is under-specified. How bounded? What counts as "exercising the actual dispatcher"? A receiver "explicitly owning" future evidence doesn't close the gap this PR creates by landing the writer.

**Both reviewers, D1 ordering:**
Neither of you caught that the proposed ordering (4.2 → 3.1/3.2/3.3 → retirements) creates a parity gap: the writer lands before its parity is proven. Reviewer A's D4 fixture test is CI-wired "before the PR merges," but D1 never states that 4.2 must complete before 3.1 starts. Reviewer B requires "deterministic-field parity passes over the committed corpus" but doesn't sequence it against writer landing.

#### New points not raised in round 1

##### 1. The estate-count ratchet is a sequencing blocker

`check_estate_count.ts` enforces `concern_count: 0` growth. Splitting `session_eol_hook` into three handlers is +2 concerns. Neither reviewer resolved whether:
- The manifest taxonomy changes (if so, what becomes the countable unit?)
- A temporary allowance is introduced (violating the ratchet's purpose)
- Retirements offset the increase in the same commit (making the count the sum of adds and removes, not just adds)

**This must be resolved before D1 is executable.** If the ratchet counts handlers and three retirements offset two adds, the sequence is: retire three → add writer + relocate two, all in one commit. If it counts concerns and the taxonomy changes, that change must be specified and justified.

##### 2. The schema decision is executable only with a named variant

Reviewer B observes "the proposal does not name the new variant." Reviewer A doesn't address it. But D4's parity requirement and the 2026-09-07 D4 ruling both require that "tolerant readers must exist before any writer emits it."

**The third variant must be named NOW, with its required fields, or D1 Option 3 cannot execute 3.1.** The writer cannot write "a new variant" without knowing what fields that variant carries. Options:
- Variant `continuity_auto` with fields `{session_id, workspace_id, predecessor_trace, directives, state_snapshot, lifecycle_source}`
- Extend `main_session` with an optional `lifecycle_source` discriminator
- Something else you specify

The ruling must name the variant shape or defer 3.1.

##### 3. Parity requires proving activation, not just transformation

Both reviewers treat the writer as "the function that produces the record." But the determinism claim in step 3.1 is about the record generation, not about:
- **When does it activate?** (`shouldAdvise` logic, token threshold, session-end detection)
- **What does it consume?** (roadmap state, transcript, workspace identity — and are those reads atomic?)
- **Where does it write?** (authoritative filename, consume-by-rename races, cross-device moves)
- **What happens if it fails?** (does it prevent `run_checkpoint` from firing?)

**D4 parity evidence must cover activation + consumption + publication, not just transformation.** Fixture tests prove the latter. The former needs either:
- A lifecycle integration test that mocks the dispatcher and proves exactly-once, ordered execution, and failure isolation, OR
- A documented defer of activation/publication parity to the receiver that retires `session:recycle`

##### 4. The three reachable retirements are not equally reachable

**`context-fill.json`** — producer only, no consumer → genuinely reachable.

**`/chat-history` and `/chat-history import`** — marked `visibility: internal`, but:
- Are they invoked by any still-active automation?
- Do they appear in any shipped examples, docs, or error messages?
- Is there a usage grep proving they're not called?

Retiring them requires proving non-use, not just proving they're marked internal. If that proof doesn't exist, they're not "reachable in this session."

##### 5. Rollback boundaries must be load-bearing, not advisory

Reviewer B correctly requires independent kill switches, but doesn't specify what "independent" means operationally. If the writer and checkpoint production both read `hooks.session_eol.enabled`, they're not independent — disabling one disables both.

**Rollback specification:**
- Writer: `hooks.continuity_writer.enabled` (default true, kill switch is explicit false)
- Checkpoint production: `hooks.run_checkpoint.enabled` (default true, independent of writer)
- Session-index restore: `hooks.session_index_restore.enabled` (default true, independent of both)
- Disabling any one restores pre-PR behavior for that handler only; others proceed

These must exist in the same commit as the handlers, not as future work.

***

#### My rulings (executable specificity)

##### D1 — Option 3, with corrected sequencing and named gaps

**IN, in this order:**

1. **Resolve estate-count taxonomy** — either:
   - Change the ratchet to count net change (adds − removes), OR
   - Emit the manifest change that makes three reachable retirements offset two handler additions, OR
   - Defer splitting until after retirements reduce the count
   
   The PR cannot land without this decision.

2. **Step 4.2 first** — `check_continuity_surface` with inventory, exclusions, five numbers, CI ratchet

3. **Prove `/chat-history` and `/chat-history import` are unused** — grep over tracked files + examples + docs; if not provable, defer them

4. **Retire provably unused items** — `context-fill.json` + any commands proven unused above

5. **Name the third schema variant** (see #2 above) — or defer 3.1

6. **Steps 3.1, 3.2, 3.3** — writer + lifecycle handlers, with:
   - Independent kill switches in the same commit
   - Fixture transformation parity in CI
   - Lifecycle activation/publication parity deferred to explicit receiver with concrete evidence requirement

**OUT:**
- `hot-context` (D3 equivalence + trust contract)
- `session:recycle` (parity window or activation/publication evidence)
- `chat-history:checkpoint` name (D2 owner decision)
- Any command not proven unused

**Resolved when:** All IN items land in one commit; CI enforces the ratchet; every OUT item has a receiver with named exit condition; the five numbers are published (not necessarily at target values).

##### D2 — Option 2, owner-reserved

Agree with both reviewers. File blocker:

> *"Step 4.1b migration requires introducing a new public command name `chat-history:record` (or other owner-chosen name) as the surviving capture endpoint, with deprecation alias for downstream-installed hooks. This exceeds the retirement-only authorization and is owner-reserved. Deferred pending owner decision on: new command name, compatibility period, downstream-installation detection, alias-removal criterion."*

**Resolved when:** Blocker filed with status `owner-reserved`, step 4.1b marked `[-]` with this reason in the roadmap.

##### D3 — Option 3, split AC-7 (agree with both reviewers)

**Close now:**
> **AC-7a — Measurement exists:** Command `agent-config continuity:surface` deterministically derives and publishes the five-number inventory, CI ratchet enforces non-regression, every counted item has file location, every exclusion has documented reason.

**Carry forward:**
> **AC-7b — Target state reached:** Command reports exactly `0 / 0 / 1 / 1 / 0` with no excluded normal-path continuity mechanism.

**Resolved when:** AC-7a ticked in this PR, AC-7b carried to receiver with current actual values stated.

##### D4 — New Option 4: transformation parity now, lifecycle parity explicitly deferred

**Disagree with Reviewer A's Option 1** — fixture equivalence does not prove operational parity.
**Disagree with Reviewer B's Option 3** — "bounded lifecycle integration" without a specified bound is not an executable ruling.

**Evidence required NOW (in this PR):**
- Fixture corpus at `tests/fixtures/continuity/` with ≥3 sessions: clean-stop, interrupted, with-directives
- Deterministic transformation test at `tests/continuity/writer_transform.test.ts` proving field-by-field parity between:
  - New writer: `scripts/_lib/continuity_writer.ts`
  - Reference: existing `session:recycle` record-generation logic
- Output to `tests/scratch/continuity-transform/` (not authoritative location)
- CI-gated, must pass before PR merges

**Evidence DEFERRED (to explicit receiver):**
- Activation parity: when does the writer fire, compared to manual `session:recycle`?
- Consumption parity: what does it read, are reads atomic, does it see partial state?
- Publication parity: consume-by-rename races, cross-device behavior, exactly-once guarantees
- Failure isolation: does writer failure prevent checkpoint or other lifecycle handlers?

**Receiver specification:**
Create `docs/decisions/ADR-NNN-continuity-lifecycle-parity.md` stating:
- Activation/consumption/publication parity is required before `session:recycle` retirement
- Evidence form: lifecycle integration test mocking dispatcher, or documented bounded observation of writer firing in production-like conditions
- Exit condition: no duplicate records, no missed records, no races, failure isolation proven
- Owner: [assigned at ADR creation]

**Resolved when:** Transformation parity passes in CI this PR, lifecycle ADR exists with named owner and exit condition.

##### D5 — Option 3: acceptable only with same-PR kill switches

**Disagree with Reviewer A's Option 1** — the five conditions are necessary but not sufficient.
**Agree with Reviewer B's Option 3** — but specify the rollback boundaries precisely.

**Additional conditions beyond Reviewer A's five:**

6. **Independent kill switches land in the same commit:**
   - `hooks.continuity_writer.enabled` (default `true`)
   - `hooks.run_checkpoint.enabled` (default `true`, already exists)
   - `hooks.session_index_restore.enabled` (default `true`, may need to be added)
   
   Each can be disabled independently; disabling one restores pre-PR behavior for that handler.

7. **Lifecycle dispatcher contract documented:**
   - Handlers execute in deterministic order
   - One handler's failure does not prevent others (fail-open for unrelated lifecycle work)
   - Exactly-once guarantee per session per handler
   - No shared mutable state between handlers

8. **Rollback verification test:**
   - With `continuity_writer.enabled: false`, `run_checkpoint` still fires
   - With `session_index_restore.enabled: false`, other session_start hooks still fire
   - Test must pass in CI

**Resolved when:** All eight conditions are CI-testable assertions (not prose promises), rollback is documented as specific settings with residual behavior, and the estate-count ratchet allows the net change.

***

#### Hardest architectural pushback

**I push back hardest on the claim that splitting `session_eol_hook.ts` is "ordinary relocation."**

Reviewer B correctly identifies this as a trust boundary, but doesn't go far enough. The current `session_eol_hook.ts:354-412` is a **monolith with hidden coupling**:
- EOL counters (`:354-367`)
- `context-fill.json` write (`:369`)
- `run_checkpoint` advise (`:391-412`, gated on `shouldAdvise` at `:392`)

These share:
- The same `stop` event firing exactly once
- The same session-end detection logic
- The same failure mode (uncaught exception prevents all three)

**Splitting them changes operational properties:**
1. **Ordering** — which fires first? Does order matter? (It does if checkpoint depends on counters being flushed.)
2. **Failure isolation** — if the writer throws, does checkpoint fire?
3. **Exactly-once** — are three handlers guaranteed to fire once each, or might one fire twice if another fails and retries?

The document treats this as "move code to new files." It's actually "introduce a lifecycle dispatcher with ordering and failure semantics that didn't exist before."

**Evidence that would change my mind:**

1. A lifecycle dispatcher contract document (`docs/contracts/lifecycle-dispatcher.md`) specifying:
   - Handler registration
   - Execution order (deterministic or unspecified?)
   - Failure policy (fail-fast, fail-open, retry?)
   - Exactly-once guarantees
   - Shared-state constraints

2. A test proving the dispatcher implements that contract:
   - Three handlers registered for `stop`
   - One throws → other two still fire
   - All three fire exactly once per session
   - Order is deterministic (if contract promises it)

3. A migration path showing how the current coupled behavior maps to the new isolated handlers without semantic change.

Without these, "splitting the concern" is architecture change disguised as refactoring, and the parity requirement doesn't cover the thing that actually changed.

***

**Summary:** Approve D1 Option 3 with estate-count resolution first; reserve D2; split D3; defer lifecycle parity in D4; require same-PR kill switches in D5. The lifecycle dispatcher is the under-specified trust boundary that blocks clean execution.

### Seat: `openai/codex-default`

Matze, my verdict is a conditional greenlight for a narrowed Option 3. The proposal correctly recognizes that full retirement is unreachable, but it still bundles measurement, schema evolution, lifecycle dispatch, automatic publication, and deletion as though they form one independently reversible change. They do not.

#### Assessment of the prior critiques

##### Points I agree with

Reviewer A is right that:

- The proposed `4.2 → 3.1/3.2/3.3 → retirements` ordering is incomplete. Reader compatibility, schema definition, and parity evidence must precede writer activation—not merely precede merge.
- The concern-count ratchet is a real sequencing gate. A temporary allowance would turn the ratchet into paperwork.
- `/chat-history` and `/chat-history import` need evidence of non-use beyond `visibility: internal`.
- Splitting `session_eol_hook.ts:354-412` creates a lifecycle execution boundary with new ordering and failure semantics.

Reviewer B is right that:

- Deterministic transformation does not imply deterministic activation, publication, retry behavior, or consumption.
- The manual writer is not a sufficient specification oracle. Field parity could faithfully reproduce an existing defect.
- Publication must be create-if-absent rather than overwrite.
- “Exactly once” should be expressed as idempotent observable behavior, not assumed from `shouldAdvise`.
- A kill switch cannot restore removed commands or artifacts; that requires reverting the PR.
- `check_continuity_surface` should remain an internal CI command. Turning it into a public CLI command would enlarge the very surface being reduced.

##### Points I disagree with

Reviewer A’s D4 ruling defers too much operational evidence. Activation and publication are properties of the automatic writer introduced by this PR. They cannot all be deferred until `session:recycle` retirement without allowing an inadequately verified writer into the normal path.

Reviewer A also says all in-scope work should land “in one commit.” Atomicity belongs at the PR/release boundary, not necessarily the Git commit boundary. Requiring one commit makes review and bisecting worse without improving deployment safety.

Reviewer B requires “exactly-once observable publication.” That wording is stronger than a filesystem lifecycle can honestly guarantee across crashes. The executable contract should be:

- at most one authoritative unconsumed record;
- repeated events converge without overwriting it;
- interruption before atomic rename leaves no authoritative partial record;
- interruption after rename is safely recognized on retry.

Reviewer B also accepts retiring all three named items too readily. `context-fill.json` is supported by the supplied producer/no-consumer evidence. The two slash commands remain conditional on a tracked-source and generated-content reachability audit.

Both reviewers understate one coupling: the automatic writer and the existing reader communicate through a shared authoritative filename and consume-by-rename protocol. That storage location is effectively a single-slot queue. Its conflict policy, durability, and ownership are a trust contract—not an implementation detail.

#### Rulings

##### D1 — Option 3, with activation held behind a default-off switch

In scope:

1. Implement `check_continuity_surface` first as a non-public CI gate.
2. Define the new continuity schema variant and update every reader before any writer can emit it.
3. Implement deterministic record construction and lifecycle publication tests.
4. Add the automatic writer behind its own settings switch, initially defaulting to `false`.
5. Separate `run_checkpoint` production and session-index restoration into independently switchable handlers only if the dispatcher contract and integration tests land in the same PR.
6. Retire `context-fill.json`.
7. Retire `/chat-history` and `/chat-history import` only if a tracked-source audit proves no runtime, generated-hook, documentation, example, test-fixture, or error-path dependency.
8. Resolve the estate-count ratchet through legitimate final-tree subtraction or an explicitly reviewed taxonomy correction. No temporary allowance.

Out of scope:

- `hot-context` retirement;
- `session:recycle` retirement;
- `chat-history:checkpoint` rename or retirement;
- downstream installed-hook migration;
- claiming the target vector;
- enabling the automatic writer by default.

The new schema variant should be named `continuity_record`. Its precise required fields must be derived from the existing validated envelope contract; this ruling does not authorize inventing parallel identity or directive fields. Variant-specific validation must explicitly define required fields, forbidden fields, unknown-variant behavior, and version compatibility.

`Resolved when:` the final PR passes both ratchets; tolerant readers are deployed before emission is possible; the writer defaults off; publication is atomic and create-if-absent; dispatcher isolation and switch behavior are tested; `context-fill.json` is absent; each slash-command retirement is either proven safe and completed or individually deferred with evidence; and every out-of-scope item has a receiver and exit condition.

##### D2 — Option 2: owner-reserved

“Net zero” describes a count, not authorization. A new endpoint name is a new callable contract. A deprecation alias also means the old name remains operational and therefore has not yet been retired.

Leave `chat-history:checkpoint` unchanged and file the anticipated blocker.

`Resolved when:` the blocker records the required owner decisions: surviving endpoint name, compatibility duration, migration mechanism for already-installed hooks, detection/measurement of migrated installations, and the objective alias-removal threshold.

##### D3 — Option 3: split AC-7

Close now:

> **AC-7a — Continuity-surface derivation:** A deterministic, non-public CI check derives and publishes all five continuity-surface values from tracked sources, identifies each counted item by source location and classification rule, records every exclusion with a reason, and fails on unreviewed surface growth.

Carry forward:

> **AC-7b — Continuity target:** The derived vector is exactly `0 / 0 / 1 / 1 / 0`, and no exclusion represents a normal-path continuity mechanism that would change the vector if counted.

`Resolved when:` AC-7 is replaced by AC-7a and AC-7b; AC-7a passes in CI and records the pre-PR and post-PR vectors; AC-7b remains open in a named receiver carrying the target and current vector.

##### D4 — Option 3: deterministic parity plus bounded runtime evidence

Fixture equivalence closes transformation parity only.

Deterministic-field evidence must include:

- independent semantic invariants, not only comparison with `session:recycle`;
- valid, malformed, stale, foreign-workspace, missing-trace, directive-bearing, interrupted, and existing-target fixtures;
- output outside the authoritative path;
- proof that tests cannot consume or modify authoritative records.

Runtime evidence must cover:

- repeated Stop events;
- event eligibility;
- atomic create-if-absent publication;
- pre-existing target behavior;
- interruption before and after publication;
- source routing;
- fail-open isolation between writer and checkpoint handlers;
- idempotent convergence after retry.

A wall-clock soak is unnecessary if these behaviors are exercised against the real dispatcher and storage adapter with controlled failures.

`Resolved when:` the committed fixture suite proves semantic transformation correctness, and integration tests prove at-most-one authoritative publication, no overwrite, no partial authoritative file, retry-safe convergence, correct routing, and handler failure isolation. The writer may then exist default-off; enabling it by default requires a separate receiver decision.

##### D5 — Option 3: acceptable only with a staged activation contract

The writer may land before full retirement only if:

- its settings switch is independent and defaults to `false`;
- `run_checkpoint` and session-index restoration have separate switches;
- all readers accept the new variant before writer activation;
- publication is atomic and create-if-absent;
- an existing unconsumed record causes a safe skip and diagnostic;
- the continuity vector does not regress;
- the promised retirements are CI-verified;
- rollback documentation distinguishes disabling new behavior from reverting deletions;
- automatic trip criteria are defined.

Trip criteria must include malformed output, overwrite attempt, duplicate authoritative publication, foreign-workspace acceptance, checkpoint suppression, or one handler preventing a later independent handler.

`Resolved when:` every condition above is represented by an executable test or CI assertion; the writer remains default-off; rollback documents residual behavior for each switch; and enabling criteria are assigned to a named receiver.

#### New refinements

The surface inventory needs a canonical taxonomy. Otherwise aliases, generated-hook strings, internal commands, and downstream compatibility shims can be classified opportunistically to produce the desired numbers.

The lifecycle dispatcher should promise deterministic ordering only where a dependency exists. Independent handlers should not silently depend on order. If checkpoint correctness requires counters to flush first, that dependency must be explicit and tested rather than hidden in registration order.

The authoritative continuity location needs a capacity policy. A create-if-absent single-slot queue can lose fresh continuity state whenever an older record remains unconsumed. The design must choose among safe skip, quarantining the stale record, or a bounded multi-record queue. That is currently an open architectural decision disguised as filesystem plumbing.

#### Hardest architectural pushback

My strongest objection is enabling an automatic writer whose authoritative storage is a single consume-by-rename record without first specifying conflict ownership.

The critical trust boundary is:

`automatic producer → authoritative record slot → validating/destructive consumer`

A lifecycle dispatcher test cannot answer what should happen when the slot is occupied. Nor can fixture parity with the manual writer. Automatic production changes contention frequency and makes this policy part of normal operation.

Evidence that would change my mind:

- a documented state machine for absent, published, consuming, consumed, quarantined, and conflicting records;
- atomic storage-adapter tests across interruption points;
- proof that retry never overwrites or destroys an unconsumed record;
- an explicit policy for preserving or reporting newer state when the slot is occupied;
- telemetry sufficient to trigger the writer kill switch.

**End summary:** Approve constrained Option 3 with a default-off writer; reserve the checkpoint rename; split AC-7; require semantic and runtime parity; and treat the authoritative record slot—not just the dispatcher—as the primary trust boundary.
