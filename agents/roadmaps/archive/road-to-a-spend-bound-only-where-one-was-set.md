---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "An owner directive of 2026-10-05 says the package ships no spend limit unless someone sets one. At the pin the general cost layer already behaves that way and four other layers do not: the council budget, the debate cap, the two paid-gate caps and the run figure stop or ask without anyone having chosen them, and for a billable council seat the unbounded state is the one that asks. A stub builds on the paid-gate caps and a parked roadmap detects a provider-side cliff; neither owns the defaults. Folding the change into the parked billing-cliff roadmap was considered and rejected: that file waits on its own entry condition and measures a provider, while this one removes bounds the package itself defines. Adds no script, no hook concern and no settings key."
estate_growth_exempt: "Grows open_blockers by one. The record of step 1.1 relaxes ceilings that two owner-directed decision records and one recorded disposition set, on the strength of a sentence the owner said in another session; the blocker puts the exact list of superseded clauses in front of the owner before anything lands. Also grows active_roadmaps by one, because the owner asked on 2026-10-05 for this round's roadmaps to land as ready in one change."
relates:
  - slug: road-to-typed-grants-that-persist
    relation: disjoint
    note: "Business spend is the typed op `payment` and stays there. This file touches only what an agent spends on its own tooling."
  - slug: road-to-billing-cliff-detection
    relation: disjoint
    note: "Later. Its step 3.1 anchors on byte-identical decisions to the current gate in `spend_gate.ts`; step 2.1 here changes one of those decisions and says so in a dated note there."
  - slug: road-to-gate-preauth-authorization
    relation: disjoint
    note: "Stub. Builds on the two paid-gate caps; step 2.2 here changes what their absence means and leaves the caps themselves in place as options."
---
# Road to a spend bound only where one was set

> **Source:** an owner directive given on 2026-10-05 during an external
> comparison round against an autonomous-runtime tree (opaque id S1), whose
> spend tracker ships hourly and daily caps as constants. The directive, in the
> owner's words: by default no spend limit is wanted; it is fine for limits to
> be settable as an option. Every anchor below was read, the zero-cap probe
> run, and the whole file re-read by an independent pass, at `main` @
> `df377ca64` on 2026-10-05. Class: owner directive; external comparison
> corpus.
>
> Round `agents/tmp.old/inbox-2026-10-d/`. Re-verified anchor by anchor at
> `main` @ `975d03d01` on 2026-10-05 by five independent read-only passes;
> the one commit since the pin moved no anchor, and their corrections are in.

## Goal

With nothing configured, no USD or token ceiling that the package ships stops
a council run, a debate, a paid gate or a roadmap run, and none of them asks
the user because no ceiling exists. Every such ceiling can be switched off by
the value its own contract documents. Spend is still estimated before a run
and recorded after it, bounded or not. A person who wants a ceiling sets it
and gets the behaviour its contract describes — including the one optional
hard stop the tree already defines, which today cannot fire.

What is not a ceiling on money stays, and is listed by name: provider
refusals, plan-quota and fan-out guards, the confirmation a paid gate asks
for, and the budget an unattended run must be given.

## Context

At `df377ca64`:

- **The general cost layer already follows the directive.** `cost.budgets.daily`,
  `weekly` and `monthly` ship `0` with `enforcement: advisory`
  (`src/config/agent-settings.template.yml:263-287`), and the contract says:
  "If no budget is configured at all → exits `0` (fail-open). Never blocks
  unbudgeted work" (`docs/contracts/cost-enforcement.md:67-68`).
- **The council budget has three default layers, and all three bound.** The
  loader defaults to 500,000 input tokens, 200,000 output tokens, 50 calls and
  USD 20 per invocation (`src/scripts/ai_council/config.ts:1674-1677`). Where
  a user's council file carries no `cost_budget` block, the command falls back
  to 50,000, 20,000 and 10 calls (`src/scripts/council_cli.ts:2563-2565`,
  `:3079-3081`), which are also the constructor's own defaults
  (`src/scripts/ai_council/spend_gate.ts:38-40`); that fallback keeps
  `max_total_usd` at `0`, so it bounds tokens and calls, not USD. A debate refuses to start
  above USD 5 by default in two places (`config.ts:1023`,
  `council_cli.ts:2130`). A breach ends the remaining seats of the run, because the command passes no
  `on_overrun` callback; with one, a breach asks per member
  (`orchestrator.ts:376-380`).
- **"0 disables this cap" is documented and not implemented for tokens.** The
  config contract says so for both token caps and the call cap
  (`docs/contracts/ai-council-config.md:84-86`). `_breach` compares the token
  totals with no zero guard (`spend_gate.ts:104-108`), while the two USD
  comparisons beside it carry one (`:110`, `:113`). Probed on this commit: a
  budget with every cap at zero returns `tokens` for a ten-token estimate.
- **For a billable seat, the unbounded state is the one that asks.**
  "Billable member with no ceiling (both `0`, i.e. both disabled) | Ask, as
  before" (`docs/decisions/ADR-230-*.md:53`); removing the ask was considered
  there and rejected: "'Standing authorization' has to be a bound the user
  actually set, not the absence of one" (`:87-89`). Five shipped files carry
  that rule in eight lines: `src/skills/ai-council/SKILL.md:314-316`, its
  reference `procedure.md:48-50`, and the commands
  `src/domains/meta/council/command.md:37`, `default/command.md:154-164` and
  `debate/command.md:70-88`. A sixth, `references/cost-and-redaction.md`,
  holds the prompt itself (`:49-62`) and a second ask for a stale price table
  (`:65-74`).
- **A later owner record points the other way.** ADR-268 § 0 lists "Requiring
  a confirmation for an operation outside" the typed vocabulary as a break of
  the declared outcome (`:120`), and § 8 says of a ceiling that would be crossed: "the
  run **pauses and reports** … It does not ask" (`docs/decisions/ADR-268-*.md:241-246`).
  Council spend is not one of the eleven typed ops. ADR-268 superseded neither
  ADR-230 nor ADR-237.
- **A run carries a fixed figure.** "`> $25 → OWNER APPROVAL BEFORE CROSSING`"
  (`src/domains/product-basic/roadmap/process-full/command.md:506-507`; the
  same file repeats the figure at `:503` and `:509`), from
  ADR-237 § 3 (`docs/decisions/ADR-237-*.md:118-122`); two shipped contexts
  repeat the figure
  (`src/agent-src/contexts/execution/roadmap-execution-contract.md:218`,
  `roadmap-process-loop.md:337`, `:1007`). The record says of itself:
  "Nothing mechanical checks any of this" (`ADR-237:205`).
- **A paid gate needs two caps to exist before it will run.** The template
  ships USD 5 per run and USD 25 per seven days
  (`agent-settings.template.yml:713`, `:717`), and so does the schema
  (`src/server/schemas/settings.ts:259-265`). With no caps the verdict is
  `no_caps` and the entry is rendered instead of run
  (`src/agent-src/scripts/gate_budget.ts:241-249`) — by design: "An install
  whose settings do not carry the caps has not authorised a standing budget"
  (`:105-109`). The two figures are a recorded disposition: option (a), two
  seats convergent, 2026-08-20
  (`agents/roadmaps/archive/road-to-gate-autonomy.md:490-494`).
- **Counting depends on a bound.** The spend ledger is appended only while a
  daily limit is set (`src/scripts/ai_council/orchestrator.ts:807`;
  `config.ts:294-295`: "disabling it also disables the spend ledger"). Its
  path is resolved once, at import, under the user-global configuration home
  (`src/scripts/ai_council/budget_guard.ts:54`); the suite's setup file keeps
  the real home and does not point that variable elsewhere
  (`tests/_lib/hermetic-env.ts:28-31`).
- **The one optional hard stop cannot fire in this tree.** The cost preflight
  spawns `scripts/cost/budget.mjs` relative to the working directory
  (`src/scripts/cost/preflight.mjs:19`); the script lives under `src/scripts/`.
  Empty output is read as "no budget configured". Run from the repository's
  own over-budget fixture, whose `expected_exit` is 1 and whose settings say
  `hard-stop`, it prints "no budget configured — pass" and exits 0. Nothing
  on a roadmap run calls it; one manual task does
  (`taskfiles/engine.yml:377-389`).
- **Three presets print figures nothing enforces.** `balanced`, `fast` and
  `strict` carry daily, weekly and monthly USD values
  (`src/agent-src/presets/balanced.yml:25-27`); `explain` prints them as
  "cost caps" (`src/scripts/_cli/cmd_explain.ts:315-317`); no reader compares
  spend with them (`src/scripts/config/presets.ts:53-55` maps them to
  environment names). The same presets carry `mcp.per_call_max_usd` and
  `mcp.per_session_max_usd` (`balanced.yml:22-23`), which nothing enforces
  either; step 3.5 labels them the same way.
- **One sentence is stale in the other direction.** The council example file
  still says the command "always asks before invoking, even under autonomy:
  on" (`agents/templates/.ai-council.yml.example:32-34`); ADR-230 removed that.
- **Where each figure lives decides how it moves.** The two paid-gate caps
  are Class C settings; a Class C default was last moved "by hand in the
  template and the schema on a recorded AI-council verdict … under the
  owner's written delegation" (`docs/contracts/settings-classes.md:278-280`).
  The council figures live in the user-global council file and its loader,
  outside the class table; the run figure is prose in three files and no key.
- **Three files this touches cannot grow.** `orchestrator.ts` (2,038 lines),
  `config.ts` (2,179) and `council_cli.ts` (3,954) are over the 1,500-line
  ceiling of the summed-excess source-size ratchet
  (`src/scripts/check_source_size_budget.ts:85`), and the council example file is pinned
  by path and size (`src/scripts/check_pack_size.ts:335`).

## Phase 1 — The directive is a decision on record

- [x] **1.1 One decision record, drafted as proposed.** A new ADR with
      `status: proposed`, numbered with the next free number and carrying
      `no-spend-bound-by-default` in its file name, quotes the directive with
      its date and states: no USD or token
      ceiling the package defines applies unless a person set it; estimating
      and recording spend never depend on a ceiling; a configured ceiling that
      would be crossed pauses the run and reports, as ADR-268 § 8 says. It
      names what it supersedes, clause by clause — the third row of ADR-230's
      table and that record's rejection of removing the ask; the fixed figure
      in ADR-237 § 3; and, for the paid gate, the reading that absent caps
      refuse — and what stays, by the list in the last section but one of this
      file. It carries the scoped-supersession fields and the `## Not reopened`
      and `## Evidence` sections the ADR gates require. While it is proposed,
      the records it would supersede are not touched. Its move to `accepted`
      is the blocker's subject, not this step's.
      verify: `grep -l 'supersedes_scope' docs/decisions/*no-spend-bound-by-default* | wc -l` -> /^1$/
- [x] **1.2 The verdict on what is a spend bound.** One council question, with
      the table of shipped figures as its bundle: which are ceilings on money
      or tokens and move, which are plan-quota, fan-out or authorisation
      controls and stay. The verdict is recorded at
      `agents/evidence/council/spend-bound-defaults-2026-10.md` with its
      `evidence-type` marker, covers the unattended budget and the
      between-round confirmation by name, and may overturn decisions D3, D4
      and D7 below.
      verify: `grep -c 'unattended' agents/evidence/council/spend-bound-defaults-2026-10.md` -> /^[1-9]/

- [x] **1.3 On acceptance, the superseded records point to it.** ADR-230 and
      ADR-237 gain their reciprocal field and the index is regenerated, in the
      change that carries the accepted record.
      verify: `grep -l 'no-spend-bound-by-default' docs/decisions/ADR-230-*.md docs/decisions/ADR-237-*.md | wc -l` -> /^2$/

## Phase 2 — "No bound" can be said on every ceiling

- [x] **2.1 Zero means what the contract says.** `_breach` skips a token
      comparison whose cap is zero, and the two call-cap checks in the
      orchestrator (`orchestrator.ts:415`, `:1249`) do the same, with no line
      added to that file. The test asserts that a budget with every cap at
      zero returns no breach for an estimate of any size, and that each
      non-zero cap still breaches alone. One dated note in the parked
      billing-cliff roadmap says its anchor on this function moved.
      verify: `npx vitest run tests/scripts/ai_council/spend_gate_zero_is_unbounded.test.ts` -> 0
- [x] **2.2 A paid gate runs without caps, and one cap bounds alone.** With
      no cap configured, the verdict is `ok`; a missing estimate refuses only
      when a cap exists to compare it with. The reader returns each cap on its
      own — today it returns nothing unless both are numeric
      (`gate_budget.ts:114-123`), so a person who set one would be bound by
      none. `--confirm` is unchanged: it is the authorisation, and
      the caps only ever bounded its size. The two existing suites that pin
      the `no_caps` refusal change with the function
      (`tests/scripts/gate_budget.test.ts`, `tests/scripts/gate_execute.test.ts`).
      verify: `npx vitest run tests/scripts/gate_budget_absent_caps_run.test.ts` -> 0
- [x] **2.3 The optional hard stop fires, and its own suite says so.** The
      preflight resolves the budget script from its own location, and so do
      the two spawns of the fixture runner that already exists for it
      (`tests/cost/budget-fixtures.mjs:29`, `:43`; task `test-cost-budget`).
      At the pin that runner reports "0 passed · 5 failed" for the same
      reason and no workflow runs it; after the step it passes its five
      fixtures, the over-budget one included.
      verify: `node tests/cost/budget-fixtures.mjs` -> 0

## Phase 3 — The shipped defaults carry no money or token ceiling

- [x] **3.1 Council and debate, in all three layers.** The loader defaults,
      the command's fallbacks and the constructor's defaults for the USD and
      token caps become `0`, and so do both debate defaults. `max_calls` and
      the debate round limits keep their values. The example file, its
      pack-size pin and the config contract follow, and the example's stale
      sentence goes. No line is added to a file over the line ratchet. A
      council file a user already has is not rewritten: its figures are that
      user's until they delete them, and the release note names the lines.
      verify: `npx vitest run tests/scripts/ai_council/default_budget_is_unbounded.test.ts` -> 0
- [x] **3.2 The paid-gate caps ship unset.** Template and schema default both
      keys to `null` — the schema as a nullable number, as other keys there
      already are; the class table's default column and the generated settings
      reference follow in the same change. The keys stay, classified as they
      are.
      verify: `grep -cE '^ +max_cost_per_(run|rolling_7d)_usd: null' src/config/agent-settings.template.yml` -> /^2$/
- [x] **3.3 The unbounded ask is removed everywhere it is stated.** The five
      files of the fourth Context bullet say: no ceiling set, no ask; the
      estimate is shown and the run proceeds. In the sixth, the billable
      prompt is shown as information and the stale-price-table prompt becomes
      a stated line instead of a question, as ADR-237 already requires of an
      uncertain cost. The debate's between-round confirmation is not touched
      here.
      verify: `cat src/skills/ai-council/SKILL.md src/skills/ai-council/references/procedure.md src/skills/ai-council/references/cost-and-redaction.md src/domains/meta/council/command.md src/domains/meta/council/default/command.md src/domains/meta/council/debate/command.md | grep -cE 'no ceiling|bound is mandatory|unbounded budget without asking|Nothing bounds|Run the consultation|ask before proceeding'` -> /^0$/
      Positive control: the first four patterns return 8 at `df377ca64` and
      `975d03d01`; the last two exist so the check also sees
      `cost-and-redaction.md`, which the first four do not match.
- [x] **3.4 The run's ceiling is whatever was configured, and the text says
      who carries it.** The command and the two contexts state the rule once:
      the model reads the configured `cost.budgets` windows; where its spend
      plus what it reasonably expects would cross one, the run pauses and
      reports; none configured, none applies. The text does not claim that
      code enforces this on a run — none does, as ADR-237 says of its own
      figure. The figure 25 appears in none of the three files, and no key is
      added.
      verify: `cat src/domains/product-basic/roadmap/process-full/command.md src/agent-src/contexts/execution/roadmap-execution-contract.md src/agent-src/contexts/execution/roadmap-process-loop.md | grep -cE '(USD |[$])25'` -> /^0$/
      Positive control: the same command returns 7 at `df377ca64`.
- [x] **3.5 A figure nothing enforces is not printed as a cap.** `explain`
      prints the preset's cost values — the daily, weekly and monthly figures
      and the two `mcp.*_max_usd` figures — under a label that says they are
      shown and not enforced, beside the configured `cost.budgets` and their mode.
      verify: `npx vitest run tests/scripts/_cli/cmd_explain_cost_line.test.ts` -> 0

## Phase 4 — Spend is recorded with or without a ceiling

- [x] **4.1 The suite stops writing to the real ledger.** The suite's setup
      file points the user-global configuration home, which the ledger path
      already follows, at a temporary directory before anything imports it,
      and one test fails if a run under test appends outside it. No line is
      added to the orchestrator. This lands before 4.2.
      verify: `npx vitest run tests/scripts/ai_council/ledger_is_hermetic.test.ts` -> 0
- [x] **4.2 The ledger does not wait for a limit.** The orchestrator appends
      each billable response whether or not a daily limit is set; the limit
      decides only whether the total is compared.
      verify: `npx vitest run tests/scripts/ai_council/ledger_without_limit.test.ts` -> 0
- [x] **4.3 A default ceiling cannot come back unnoticed.** One test builds
      the budget the way the command does for a council file with no
      `cost_budget` block and asserts: no breach for a large estimate, an `ok`
      gate verdict with no caps, a ledger line after a billable response, and
      a breach again as soon as any one cap is set.
      verify: `npx vitest run tests/scripts/no_default_spend_bound.test.ts` -> 0

## What stays, by name

- A provider's own refusal: a quota, rate or billing error still stops the
  step and is surfaced.
- The per-day call guards for subscription seats and for the team transport.
  They are sized against a plan quota, and a zero there is documented as a
  block.
- `max_calls` per invocation and the debate round limits, which bound fan-out.
- The confirmation a class-1 gate asks for, and the two caps as options.
- The debate's between-round confirmation.
- The budget an unattended run must be given: "an absent budget disables
  unattended runs rather than permitting unbounded ones"
  (`src/scripts/_lib/unattended_guard.ts:221-228`).
- The USD cap of the low-impact fast path (`config.ts:1294-1306`). It must be
  above zero and is written as a hard stop that escalates to the user
  (`src/scripts/ai_council/low_impact.ts:577-579`); its executor has no
  production caller at the pin.
- `api_on_quota: false`, worker token budgets and `subagents.downshift`.
- `cost.enforcement: hard-stop` for a person who configures it and runs the
  preflight — which step 2.3 makes fire.
- Business spend: `payment` stays a typed op with its own grant.

## What this roadmap deliberately does not do

- No budget tiers, no downgrade ladder and no resource ledger beyond tokens and
  USD; none has a reader, and budget routing was retired on 2026-08-16.
- No new settings key. A per-run key would have had no code reader.
- No rewrite of a user's own council file.
- No new reader of the ledger; 4.2 changes when a line is written.

## Blockers

### blocker: spend-directive-reading-confirmed
- **Status:** resolved — the owner answered (a) on 2026-10-06 via
  `/roadmap:resolve-blockers` (D9), and ADR-279 landed `accepted` on
  2026-10-06 carrying exactly that reading. The exit condition was executed,
  not read: `grep -l 'status: accepted' docs/decisions/*no-spend-bound-by-default*`
  prints `docs/decisions/ADR-279-no-spend-bound-by-default.md`.
- **Owner:** owner
- **Blocks:** 1.3, 2.2, 3.1, 3.2, 3.3, 3.4, 4.2, 4.3
- **What to do:** pick exactly one — (a) accept the proposed record of step
  1.1 as drafted, with the three superseded clauses and the list under "What
  stays, by name"; (b) accept it with one or more lines moved between the two
  lists, naming them — the candidates are the paid-gate caps, the unattended
  budget, the between-round confirmation, the fast-path cap and the per-day
  call guards.
- **Resolved when:** `grep -l 'status: accepted' docs/decisions/*no-spend-bound-by-default*`
  prints the record.
- **Recommendation:** (a) — it removes every ceiling on money the package
  invented and keeps the one place where nobody is present to notice spend.
- **If you do nothing:** every default in the Context stays, and a billable
  council seat without a ceiling keeps asking. Steps 1.1, 1.2, 2.1, 2.3, 3.5
  and 4.1 do not wait: they draft the record, ask the council, and repair
  what is wrong under either reading.

## Acceptance Criteria

- [x] AC-1 — With a council file that has no `cost_budget` block, a run with a
      billable seat proceeds without a question and without a breach, and its
      spend is in the ledger afterwards.
- [x] AC-2 — Each documented cap, set alone, produces the breach its contract
      describes; set to zero, it produces none.
- [x] AC-3 — No shipped command, skill or context file states a USD figure as
      an approval threshold.
- [x] AC-4 — The decision record is accepted, names the clauses it supersedes
      and the controls that stay, and the superseded records point to it.
- [x] AC-5 — No test run appends to a ledger outside a temporary directory.
- [x] AC-6 — With a budget configured and `hard-stop` set, the preflight
      exits non-zero when the budget is spent, from any working directory.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | No USD or token ceiling the package defines applies unless a person set it; optional ceilings stay | The directive of 2026-10-05, quoted in 1.1; blocker `spend-directive-reading-confirmed` | — |
| D2 | deterministic | evidence | Zero disables a token cap and the call cap | `ai-council-config.md:84-86` against `spend_gate.ts:104-108`; the probe | — |
| D3 | reversible-technical | agent | Per-day call guards, the per-invocation call cap and the debate round limits keep their defaults | "Sized as a guard against silent quota exhaustion … not as a brake on normal use" (`src/scripts/ai_council/cli_call_budget.ts:57-58`); a subscription call has no marginal price | The council of 1.2, or the owner, reads the directive as covering them |
| D4 | reversible-technical | agent | The class-1 `--confirm` and the between-round confirmation stay | "The caps bound the SIZE of an authorised spend; they never manufacture the authorisation" (`gate_budget.ts`, header) | The council of 1.2, or the owner, reads a confirmation as a limit |
| D5 | deterministic | evidence | The ledger is written without a limit, after the suite is isolated from it | The directive keeps measuring on; `orchestrator.ts:807`; `hermetic-env.ts:28-31` | — |
| D6 | deterministic | evidence | The run text points at the existing `cost.budgets` windows and says the model carries it; no per-run key and no claim of enforcement on a run | Keys that were "configured, documented, surfaced and inert" were deleted for that reason (`settings-classes.md:440-449`); ADR-237: "Nothing mechanical checks any of this"; nothing on a run calls the preflight | A run-scoped check with a code reader is wanted |
| D8 | deterministic | evidence | The preflight is repaired, because an optional limit that cannot fire is not an option | The fixture's recorded exit is 1 and the script exits 0 (`preflight.mjs:19`) | — |
| D7 | reversible-technical | agent | An unattended run still needs a budget | `unattended_guard.ts:160-162`: an absent budget "must not read as 'unlimited'"; nobody is present to see the estimate | The council of 1.2, or the owner, reads the directive as covering it |
| D10 | reversible-technical | council | The 13 shipped figures classify as: token ceiling (1), one USD-ceiling family at five scopes (2, 3, 5, 9, 11), count/plan-quota guards (4, 7), authorization controls (6, 8), an unattended-run safety precondition (10), an external provider refusal (12), and unenforced display figures (13). D3, D4 and D7 are confirmed, not overturned | `agents/evidence/council/spend-bound-defaults-2026-10.md` — 2026-10-06, 2/2 seats answered (anthropic/claude-sonnet-4-5, openai/codex-default), $0.0000 actual, both subscription-authed. Dissent recorded: the openai seat marks row 10's budget UNITS and finite-ness "needs discovery" and calls "requiring a budget ≠ imposing a ceiling" too categorical — accepted, and it does not change row 10's disposition | the units or enforcement of a configured unattended budget are settled, which could make that mechanism a money ceiling after all |
| D9 | product-owned | owner | the directive's reading is (a): step 1.1's record supersedes the three clauses as drafted (ADR-230 table row 3 and its rejection of removing the ask; the fixed figure in ADR-237 § 3; absent paid-gate caps refusing) and keeps every control under "What stays, by name" unchanged | owner answer 2026-10-06 to blocker `spend-directive-reading-confirmed`, options (a) as drafted / (b) with named moves | a control kept under "What stays" is found to bound money rather than quota, fan-out or authorisation, or the owner moves one |

## Kill register

| ID | Proposal | Killed by | Note |
|---|---|---|---|
| K1 | Budget tiers that conserve, downgrade or stop | Budget routing "RETIRED 2026-08-16 … Nothing below is implemented" (`docs/contracts/budget-routing.md:8-9`); the directive | Planned in the parallel proposal as an optional kernel |
| K2 | A resource ledger over network bytes, subprocess seconds and retries | No reader for any of them | Same |
| K3 | Keep the ask and make the default ceiling larger | The directive names the absence of a limit, not its size | — |
| K4 | Remove the plan-quota guards with the money ceilings | `cli_call_budget.ts:57-58`, `:72-73` | Left to 1.2 |
| K5 | A new hook that blocks on cost when a ceiling is set | `cost-enforcement.md` already defines `hard-stop`; no concern in the manifest reasons about cost | — |
| K6 | A `cost.budgets.run` key read only by command prose | `settings-classes.md:440-449` | An earlier draft of this file planned it |
| K7 | Comment the paid-gate keys out of the template | The settings-class lint reads a missing leaf as a stale row and an unfenced key | An earlier draft planned it |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A billable fan-out runs larger than anyone expected | product | With no ceiling, a council with API seats is bounded only by its call and round limits. | 3.1 keeps both limits; 4.2 records every billable response; the cost disclosure before a debate stays on; one line in the council file restores a ceiling. | Phase 3 — The shipped defaults carry no money or token ceiling |
| 2 | A user who wrote `0` meaning "nothing allowed" gets the opposite | implementation | Zero changes from an always-breach to no bound for token caps. | The contract has documented zero as "disables" since the keys exist; 2.1's test pins both directions; the team transport's `0`, which is documented as a block, is not touched. | Phase 2 — "No bound" can be said on every ceiling |
| 3 | A sentence said in another session is transcribed into superseded clauses | product | The record relaxes bounds that two owner-directed ADRs and one recorded disposition set. | 1.1 drafts the record as proposed, quotes the sentence and lists every clause; the blocker holds every default-changing step until the owner accepts it. | Phase 1 — The directive is a decision on record |
| 4 | Existing installs keep the old figures and the change looks inert | product | A council file copied from the example carries USD 20 and the token caps explicitly. | 3.1 says so and the release note names the lines; nothing rewrites a user's file. | Phase 3 — The shipped defaults carry no money or token ceiling |
| 5 | The always-on ledger records test traffic as spend | implementation | Every suite that exercises a billable seat would append to the developer's real ledger. | 4.1 lands first and fails on any append outside a temporary directory. | Phase 4 — Spend is recorded with or without a ceiling |
