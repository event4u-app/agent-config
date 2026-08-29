<!-- evidence-type: analysis -->

# Council intelligence baseline — shipped behaviour, pinned

Step 0.1 of `road-to-inbox-harvest-2026-08-e-council-topology-evidence`.

**Read at:** the working tree of this branch on 2026-08-29. Every citation below
was opened in this pass. No line number is carried over from the roadmap's own
`research_pin` — several were re-measured and found wrong, and those
corrections are stated inline rather than silently applied.

**How to refute a line.** Each behavioural sentence ends with a
`path:line` citation, or names a command. Open the line; if it does not say what
the sentence says, the sentence is wrong. Where a doc and the code disagree,
both citations are given and the code's behaviour is named as authoritative.

Anything this pass could not pin is in § Not established, with the reason. That
section is the honest half of the artefact, not a shortfall.

---

## 1. Ladder council rung

The council is one rung of a single task-side resolver. `judgment_ladder.ts`
declares itself "the ONE resolver that decides which of the five dispatch rungs
(0-4), or the silent ∅, a task resolves to" (`src/scripts/_lib/judgment_ladder.ts:2-6`).
It wraps `classifyTask` rather than replacing it, because rungs 1 and 2 *are*
`classifyTask`'s existing dispatch verdict while rungs 0, 3 and 4 are signal
layers checked around it in a fixed priority order — "because the order IS the
contract" (`src/scripts/_lib/judgment_ladder.ts:8-13`). It consolidates three
previously-scattered classification surfaces into "ONE committed name and ONE
resolver here — never a fourth parallel classifier bolted on beside it"
(`src/scripts/_lib/judgment_ladder.ts:15-19`), and declares itself
"Deliberately independent of `ai_council/necessity.ts`", keeping rung-4 signals
as local constants "rather than an import so this resolver carries no runtime
dependency on the council module" (`src/scripts/_lib/judgment_ladder.ts:21-28`).
The independence claim holds in code: the module's only import is from
`./auto_dispatch.js` (`src/scripts/_lib/judgment_ladder.ts:30-37`).

**Contradiction inside one file — the rung count.** The docstring says five
rungs (`:2-3`); `LadderRung` is `0 | 0.5 | 1 | 2 | 3 | 4 | null`
(`src/scripts/_lib/judgment_ladder.ts:40`), which is **six** rungs plus the
silent ∅. The code is authoritative: rung 0.5 exists and is a bounded question
routed to one completion via `ask_transport`
(`src/scripts/_lib/judgment_ladder.ts:47-51`).

Verdicts are `'script' | 'subagent' | 'team' | 'council' | 'ask' | 'in-session'`
(`src/scripts/_lib/judgment_ladder.ts:42-52`), with rung 4 → `council`
(`src/scripts/_lib/judgment_ladder.ts:46`).

### How a task reaches rung 4

The predicate is `detectContestedJudgment`, three regexes checked in order and
returning on the first hit (`src/scripts/_lib/judgment_ladder.ts:222-236`):

- `DESIGN_DECISION_RE` — the literal `design decision` / `architectur(e|al) decision`, or a decision verb (`record`/`decide`/`decision`/`accept`/`approve`/`challenge`/`choose`/`reject`) within 40 characters of the token `ADR`, either side (`src/scripts/_lib/judgment_ladder.ts:216-217`).
- `SECURITY_DOWNGRADE_RE` — `security downgrade` / `downgrade (the) security` / `security exception` (`src/scripts/_lib/judgment_ladder.ts:218`).
- `RELEASE_GATE_ESCALATION_RE` — `gate escalation` / `escalate to (the) council`, or an escalation verb within 40 characters of `release-gate` (`src/scripts/_lib/judgment_ladder.ts:219-220`).

The 40-character proximity requirement was added deliberately: a bare
`\badr\b` matched "update the ADR index" and "fix the release-gate CI script
typo" and suppressed the correct rung-2 nudge on both
(`src/scripts/_lib/judgment_ladder.ts:210-215`).

The resolution order that reaches it is: interactive-approval → ∅
(`:343-349`); rung 0 (`:354-361`, checked before any guard because rung 0 never
spawns, `:351-353`); recursive-dispatch guard (`:363-371`); activation gate
(`:373-378`); **then rung 4** (`:380-383`); then rung 3 with its `agentTeams`
precondition and rung-2 degradation (`:385-406`); then `classifyTask`
(`:408-411`); then the size floor, `SIZE_FLOOR = 1`
(`src/scripts/_lib/auto_dispatch.ts:25-26`, applied at
`judgment_ladder.ts:424`); then rung 1 (`:444-447`); else ∅ (`:449-453`).

### Two consequences, both load-bearing for this roadmap

**The council rung sits behind the subagent-spawn gate.** `if
(!inp.activation.subagent_spawn) return { rung: null, verdict: 'in-session', … }`
executes at `src/scripts/_lib/judgment_ladder.ts:378-379`, before
`detectContestedJudgment` is called at `:382`. On a host reporting no
`subagent_spawn` primitive, a task carrying `design decision` resolves ∅ and
the council predicate never runs.

**That ∅ carries no `degraded_from`, and the contract says it must.**
`src/agent-src/contexts/execution/auto-dispatch-classification.md:80-82` states
the Iron Law "A MATCHED RUNG-3/4 SIGNAL WITHOUT ITS HOST PRECONDITION DEGRADES,
RECORDED — IT NEVER SILENTLY DROPS TO ∅." The code at
`src/scripts/_lib/judgment_ladder.ts:378-379` returns no `degraded_from` field;
only rung 3 has a degradation path, and it does set `degraded_from: 3`
(`src/scripts/_lib/judgment_ladder.ts:396,403`). **The code silently drops for
rung 4.** The same contract's rung table also names a host precondition for
rung 3 (`agent_teams: true`) and none for rung 4
(`auto-dispatch-classification.md:75-76`), so the Iron Law's "rung-3/4"
presupposes a precondition the table never states.

### What the resolver returns, and who consumes it

`LadderResult` is `{ rung, verdict, reason, degraded_from?, mode? }`
(`src/scripts/_lib/judgment_ladder.ts:54-75`); `degraded_from` names the rung
the signal originally pointed at, never the resolved one (`:58-64`).
`insideSubagentSession` is a caller-supplied fact the resolver never probes,
because no host discriminator exists (`:267-285`).

Two production call sites, and **only one acts — it discards the council
verdict.** `src/scripts/hooks/delegation_nudge_hook.ts:424-430` calls
`classifyLadder`, then `if (ladder.verdict !== "subagent") return null`
(`src/scripts/hooks/delegation_nudge_hook.ts:440-441`), whose own comment
enumerates what is thrown away including "rung-3/4 team/council". So on the only
runtime carrier a rung-4 resolution produces no output at all;
`buildNudgeLine` has a rung-0.5 branch (`:369-377`) and no rung-3 or rung-4
branch. The second caller is a report renderer:
`src/scripts/explain_run.ts:770` calls `explainLadder` and cites the resolver as
its source (`src/scripts/explain_run.ts:631`).

### The enforcement, and its stated blind spots

`one_resolver_invariant.ts` exists because all three docstring claims were
prose and "A docstring cannot fail, so a second task-side council router could
land beside the ladder and every gate in this tree would stay green"
(`src/scripts/_lib/one_resolver_invariant.ts:11-15`). It parses with the
TypeScript compiler after three text-scanning implementations were each killed
by the repair for the last, the third losing 54 files and 231 exports because a
backtick inside a regex literal read as a template opener
(`src/scripts/_lib/one_resolver_invariant.ts:17-47`).

It asserts three things syntactically: no module outside the sanctioned
resolver exports a binding whose *name* matches a router pattern, the resolver
exports a callable one, and the resolver names no council-internal module in
any import, re-export, dynamic import or `require` specifier
(`src/scripts/_lib/one_resolver_invariant.ts:61-65`). Constants:
`SANCTIONED_RESOLVER = src/scripts/_lib/judgment_ladder.ts` (`:99`),
`COUNCIL_INTERNAL_DIR = src/scripts/ai_council` (`:102`), `SCAN_ROOT = 'src'`
(`:105`), `ROUTER_NAMES` (`:122-126`). Four violation kinds, including
`resolver-missing` because "'Exactly one' is violated by zero as well as by two"
(`:396-403`) and `resolver-is-not-a-resolver` for a stub that keeps the name
(`:404-415`). `checkOneResolver` returns `{ violations, scanned }` so an
unscanned tree cannot be mistaken for a clean one (`:138-141,373-380`).

It asserts **nothing** requiring symbol resolution or a module graph: "A router
exported under an unrelated name, or reached through an alias chain this file
cannot follow, is outside the claim"
(`src/scripts/_lib/one_resolver_invariant.ts:66-69`). Five further limits are
recorded and deliberately unrepaired, two of them silent-green — a symlinked
directory is invisible, and a UTF-16 file is counted in `scanned` while read as
mojibake (`src/scripts/_lib/one_resolver_invariant.ts:71-92`).

`tests/scripts/one_resolver_invariant.test.ts` is 418 lines with 47 `it(` blocks
across 14 `describe` blocks, including a sensitivity block ("the guard is
observed RED, not assumed", `:76`), a polarity block (`:258`), and a block for
what the guard deliberately does not see (`:300`). **The roadmap's step-0.5
note says "80 tests, all green"; the file holds 47 `it(` blocks.** Probe:
`grep -c 'it(' tests/scripts/one_resolver_invariant.test.ts`.

---

## 2. Necessity gate

`necessity.ts` is "a heuristic pre-flight that decides whether the request
actually warrants a council deliberation. Three verdicts drive three exit paths
in the dispatcher (skip / educate / proceed)"
(`src/scripts/ai_council/necessity.ts:1-7`). It states the classifier is
"**shape-based**, not semantic — it scans the prompt for marker words
associated with each bucket", and that false positives on the `necessary` side
are preferable because an extra council run is cheaper than a missed strategic
decision (`src/scripts/ai_council/necessity.ts:9-13`).

**It is council-internal, not task-side**, established three ways: the ladder
names it "the council's OWN necessity gate" whose modes "stay the council-side
surface" (`src/scripts/_lib/judgment_ladder.ts:21-24`);
`one_resolver_invariant.ts` treats `src/scripts/ai_council/` as
`COUNCIL_INTERNAL_DIR`, skips it from the task-side scan
(`src/scripts/_lib/one_resolver_invariant.ts:101-102,424`), and flags any
import of it *by* the resolver as a violation (`:437-445`); and its only
production caller is the council CLI's own gate, invoked after the question is
already built (`src/scripts/council_cli.ts:1901`, from `:2478` and `:3016`).

Signature: `classify_necessity(prompt, lens = 'analysis', _invocation = 'agent'): ClassificationResult`
(`src/scripts/ai_council/necessity.ts:234-238`). The invocation parameter is
underscore-prefixed and unused — the docstring says it "Does not change the
verdict itself; the dispatcher routes on the pair `(verdict, invocation)`"
(`src/scripts/ai_council/necessity.ts:227-229`). Verdicts are
`'necessary' | 'borderline' | 'unnecessary'`
(`src/scripts/ai_council/necessity.ts:31`); `category` is a bucket name,
`"unclassified"` when no marker fired (`:117-118`), or `"empty"` (`:243`).

Four necessary buckets in insertion order, which is also tie-break order:
`architecture` (16 terms, `:55-60`), `tradeoff` (14, `:61-65`), `ambiguity`
(12, `:66-70`), `strategic` (15, `:71-75`). Four unnecessary buckets: `bugfix`
(`:86-90`), `syntax` (`:91-94`), `single_file` (`:95-99`), `lookup`
(`:100-104`). Matching is whole-word case-insensitive `\b…\b`
(`src/scripts/ai_council/necessity.ts:19-21,170`) and counts **distinct trigger
terms**, not occurrences, ties broken by insertion order (`:190-217`). Note
`rename` appears in both `syntax` and `single_file` (`:93,97`), so one word
scores two unnecessary hits.

The verdict table (`src/scripts/ai_council/necessity.ts:253-292`):

| Condition | Verdict | Line |
|---|---|---|
| empty prompt after strip | `unnecessary`, category `empty` | `:240-248` |
| `n_hits >= 2 && n_hits > u_hits` | `necessary` | `:261-266` |
| `n_hits >= 1 && u_hits === 0` | `necessary` if `n_hits >= 2`, else `borderline` | `:267-272` |
| `u_hits >= 2 && n_hits === 0` | `unnecessary` | `:273-278` |
| `u_hits >= 1 && n_hits === 0` | `unnecessary` if `u_hits >= 2`, else `borderline` | `:279-284` |
| mixed, or no markers at all | `borderline` | `:285-292` |

One lens pass follows: on a strict lens (`_STRICT_LENSES = {'debate'}`, `:111`)
a `borderline` with `n_hits === 0` flips to `unnecessary` (`:294-302`).

**Default with no signals: fail-open toward deliberation.** No markers produces
`borderline`, not `unnecessary` (`src/scripts/ai_council/necessity.ts:285-292`),
and the gate proceeds on every verdict that is not `unnecessary`, printing one
line for `borderline` (`src/scripts/council_cli.ts:1918-1927`). The only path
where an unmarked prompt is skipped is the `debate` lens
(`src/scripts/ai_council/necessity.ts:297-302`). Empty input is the single
fail-closed case (`:240-248`).

Three config keys, each defaulted at load and independently defaulted again at
read time:

| Key | Default | Load | Read |
|---|---|---|---|
| `necessity_classifier.enabled` | `true` | `src/scripts/ai_council/config.ts:914` | `src/scripts/council_cli.ts:1854` |
| `necessity_classifier.mode` | `'educate'` | `src/scripts/ai_council/config.ts:920` | `src/scripts/council_cli.ts:1862` |
| `necessity_classifier.user_explicit_mode` | `'warn-only'` | `src/scripts/ai_council/config.ts:927` | `src/scripts/council_cli.ts:1859` |

Valid modes are exactly `off | educate | block | warn-only`
(`src/scripts/ai_council/config.ts:364-369`), enforced on both keys
(`:921-935`) and on the two per-lens override maps
(`src/scripts/ai_council/config.ts:480-481,1365-1381`, resolved at
`src/scripts/council_cli.ts:1855-1866`). The contract doc agrees with all three
defaults (`docs/contracts/ai-council-config.md:125-128`).

`_necessity_gate` (`src/scripts/council_cli.ts:1887-1969`) short-circuits when
disabled or `mode === 'off'` (`:1898-1900`), emits a `council:necessity`
telemetry event per outcome (`:1905-1916`; `skip_necessity` is an enumerated
`events_log` action at `src/scripts/ai_council/events_log.ts:87,94`), and then:
`block` → skip, exit 0, with `--proceed-anyway` explicitly inert (`:1937-1946`);
`educate` + agent → skip, exit 0 (`:1948-1955`); `educate` + user_explicit +
`--proceed-anyway` → proceed (`:1957-1965`); `educate` + user_explicit without
the flag → print and **exit 2** (`:1966-1968`).

`necessity.ts` also holds `classify_size_fit` (downgrade-only model-size fit,
`:417-517`; length tiers `short < 200`, `medium < 800`, else `long`, measured in
Unicode code points and explicitly not tokens, `:37-38,378-386`),
`classify_impact` (five classes, `high_impact` and `user_required` structurally
locked to `user` routing, `:545-560,689-762`), and `route_decision`
(`confidence_threshold` default **0.6**, `mode` default `'user'`, `:905-906`;
missing config falls back to `user` as an "Iron-Law fallback", `:893-903`).

**Two of those are dead on the production path.** Grep over `src/` returns zero
callers for `route_decision` and zero for `classify_impact_with_corpus`
(`src/scripts/ai_council/necessity.ts:789-826,884-944`); production uses
`classify_impact_with_corpus_fuzzy` in
`src/scripts/ai_council/low_impact.ts:920-953`, which re-imports
`classify_impact` dynamically (`:950-953`). So the impact→routing surface in
this module is currently unreachable from production code.

---

## 3. Advisor wiring

Five advisor personas exist on disk, each with `council_advisor: true` in its
frontmatter: `contrarian.md`, `executor.md`, `expansionist.md`,
`first-principles.md`, `outsider.md`, all at
`src/agent-src/personas/advisors/` (`ls src/agent-src/personas/advisors/`), with
the same five basenames under `dist/agent-src/personas/advisors/`
(`ls dist/agent-src/personas/advisors/`).

**Doc-vs-tree contradiction.**
`docs/contracts/ai-council-config.md:602-603` says the five "ship under
`.agent-src.uncondensed/personas/advisors/`". That directory does not exist in
this tree: `ls -d .agent-src.uncondensed` returns "No such file or directory".
The loader searches `dist/agent-src/<persona_path>` first and
`.agent-src.uncondensed/<persona_path>` second
(`src/scripts/ai_council/advisors.ts:115-118`), so the first candidate resolves
and the doc's cited path resolves nothing. The code is authoritative.

`resolve_persona_text` reads the first existing candidate, splits YAML
frontmatter, and returns `[body.trim(), frontmatter]`
(`src/scripts/ai_council/advisors.ts:111-131`); a miss throws
`CouncilConfigError` naming both searched paths (`:126-130`). Condensed-tree
preference is stated "so production runs match the same projection the rest of
the package consumes" (`:106-109`). Frontmatter uses `yaml` at `version: '1.1'`
to mirror PyYAML `safe_load`, degrading to `{}` on any parse error rather than
throwing (`:67,72-92`).

`plan_advisor_swap` skips advisors with `enabled` false (`:145-148`), throws on
a second advisor binding the same provider (`:149-156`), and returns
`Map<provider, AdvisorPlan>` (`:157-169`). Display name prefers frontmatter
`role`, else a Python-`str.title()`-equivalent of the key (`:95-101,215-228`).

**Advisors are opt-in and default to disabled.** `_build_advisor` defaults
`enabled` to `false` (`src/scripts/ai_council/config.ts:2044`); `member` is
required and must be a known provider or load fails (`:2022-2028`); `persona`
defaults to `personas/advisors/<name>.md` (`:2029-2034`). The `advisors` block
itself defaults to `{}` (`src/scripts/ai_council/config.ts:768`), and an
*enabled* advisor bound to a missing or disabled member is a hard load error,
"never a silent skip — so a typo never costs the user money on an unintended
call plan" (`:777-798`). Nothing in `src/config/` ships an `advisors:` block, so
a default install seats none. `docs/contracts/ai-council-config.md:119-124`
documents the same four fields and states no default for `enabled`.

**Advisor output is not combined — replace mode swaps a system prompt**, so the
call count is unchanged (`src/scripts/ai_council/advisors.ts:8-11`). In
`_run_round`, `_system_prompt_for_member` uses the lens prompt with no plan and
`advisor_system_prompt(plan.persona_text, …)` with one
(`src/scripts/ai_council/orchestrator.ts:576-594`, branch at `:589-591`).
`advisor_system_prompt` returns `handoff_preamble + "\n\n" + persona_text` and
throws on empty persona text (`src/scripts/ai_council/prompts.ts:769-781`) — so
an advisor call carries **no lens-specific system prompt at all**. The cost
estimator mirrors the swap so the preview does not under-state the bill
(`src/scripts/ai_council/orchestrator.ts:292-295,310-322`).

Persona identity survives into peer review as a label:
`build_persona_labels` maps `provider:model → display_name` for post-swap
members only (`src/scripts/ai_council/advisors.ts:186-199`), built at
`src/scripts/council_cli.ts:2709` and handed to peer review at `:2719`;
`anonymize_responses` renders `Response-A (Contrarian Advisor)` when a source
has a label (`src/scripts/ai_council/consensus.ts:487-508,499-502`).

**Declared but not wired, three items.** (a) Blind review drops the persona
label: `build_blind_labels` calls `anonymize_responses(shuffled, { persona_labels: null })`
— hardcoded, with no parameter to pass labels in
(`src/scripts/ai_council/blind_review.ts:60-70`, call at `:66`) — while
`docs/contracts/ai-council-config.md:619-623` states the anonymisation step
"preserves the **advisor persona label** as signal". Both hold of *different*
paths: peer review preserves it, blind review does not. (b) `seating.ts` is
entirely unwired — grep over `src/` returns zero consumers of
`readSeatConstraints`, `resolveSeating`, `freezeSeating`, `familyOf` or
`checkModelAdmissibility`, and the module says so: "Phase 2 ships the
DECLARATION and no caller reads it yet"
(`src/scripts/ai_council/seating.ts:45-51`). It also records that today's
selection is "config-static ask-all: every enabled member, every question, no
per-question seating" (`src/scripts/ai_council/seating.ts:4-6`), and the word
"advisor" does not appear in it at all — seating and advisor selection are
unrelated surfaces. (c) `_run_round`'s outsider ablation
(`no_project_context_members`, `src/scripts/ai_council/orchestrator.ts:578-582`)
has no equivalent in `estimate`, which computes one shared `base_sys` with
project context for everyone (`:307`), so an ablated seat's estimate is
over-stated.

---

## 4. Round resolution

**Two independent round loops, not one.** `consult()` runs a `rounds`-count loop
over `_run_round` (`src/scripts/ai_council/orchestrator.ts:438`) with `rounds`
supplied by the caller through `ConsultOptions.rounds` (`:335`); its docstring
states `rounds >= 2` enables multi-round debate and that only the final round's
responses are returned, intermediate rounds surfacing via `on_round_complete`
(`:387-393`). `run_debate()` runs the structured debate loop at `:1300`,
bounded by `max_rounds`, whose in-code default is **2** (`:1240`), with
`max_rounds < 1` rejected outright (`:1250-1252`).

The count is config-driven at the CLI layer. `_resolve_rounds` resolves it in
precedence order (`src/scripts/council_cli.ts:1609-1619`): explicit `--rounds`
wins (`:1610-1611`), else `ai_council.min_rounds` defaulting to 2 (`:1613`),
and on `depth === 'deep'` the result is `max(deep_min_rounds, min_rounds)`
(`:1614-1617`). Typed defaults are `min_rounds: 2`
(`src/scripts/ai_council/config.ts:1510`) and `deep_min_rounds: 3` (`:1511`).

**The depth vocabulary is two values, not three, and it does not live in
`modes.ts`.** `--depth` accepts `choices: ['standard', 'deep']`
(`src/scripts/council_cli.ts:3611`) and defaults to `'standard'` (`:3538`).
There is no `quick` tier. `modes.ts` resolves *transport* only — `VALID_MODES`
is `{api, manual, cli, auto}` (`src/scripts/ai_council/modes.ts:60`) with
built-in fallback `manual` (`:67`).

**There is no separate steel-man pass.** It is a directive embedded in the
round-2+ prompt suffix, so it runs inside every round from 2 onward.
`_debate_suffix` instructs the member to identify the single strongest opposing
position and "write a rebuttal addressed at its strongest steel-manned form. Do
NOT search for common ground" (`src/scripts/ai_council/orchestrator.ts:1040-1043`),
mirrored in the `DEBATE_MODE` system prompt
(`src/scripts/ai_council/prompts.ts:154-156`), and invoked only when a further
round remains (`src/scripts/ai_council/orchestrator.ts:1365-1369`).

Three mechanisms actually end rounds early: a **budget hard cap** — the
projected next-round cost is compared against `budget.max_total_usd` and a
breach throws `DebateCapExceeded`
(`src/scripts/ai_council/orchestrator.ts:1394-1406`); the **continue-prompt
gate** — `on_continue(checkpoint)` returning false returns the completed rounds
immediately (`:1414-1417`), with a `null` callback auto-continuing
(`:1219-1222`); and **per-member cost gating** inside `_run_round` via
`on_overrun` (`:379-384`).

**The argument-exhaustion predicate is unreachable on the production path.**
`argument_exhaustion.ts` implements `evaluateStop` requiring all four conjuncts
— `roundsCompleted >= MIN_ROUNDS` (=2, `:46`, checked `:85`),
`dissentRepairAttempted` (`:89`), every present member a self-near-duplicate
(`:91-98`), zero unresolved adversarial triggers (`:100`) — returning `stop`
only when the blocker list is empty (`:102`). Majority size is deliberately
excluded because unanimity is what conformity collapse produces (`:22-38`). A
repo-wide search for `argument_exhaustion|evaluateStop|renderStop` outside the
module returns only `tests/scripts/argument_exhaustion.test.ts` and prose in the
originating roadmap. No production file imports it: it is pure, tested, and
never called.

**The first-round fan-out is SEQUENTIAL.** Executable probe:

```
grep -c 'Promise.all' src/scripts/ai_council/orchestrator.ts   # → 0
```

The module docstring gives the rationale: "v2 contract (sequential +
interactive overrun prompt): — Members are called **sequentially** in input
order. The previous parallel ThreadPoolExecutor was traded for predictable
mid-flow user prompts; with 2-3 council members the latency cost is small"
(`src/scripts/ai_council/orchestrator.ts:8-12`). Member dispatch order and
sequential cost gating are pinned byte-for-byte by tests (`:3-6`), `consult`'s
own docstring repeats it (`:374`), and the trade is explicit: sequencing exists
so `on_overrun` can interrupt before each individual member's call (`:15-19`).

---

## 5. Blind-review ordering

Blind synthesis strips provider identity from the chairman transcript by
reusing `consensus.anonymize_responses`
(`src/scripts/ai_council/blind_review.ts:9-14`). `build_blind_labels` first
applies a deterministic shuffle so that *which* response becomes `Response-A`
is not input order — "position alone leaks nothing" (`:52-58`, implemented
`:60-71`). The shuffle is a `sha256(question_text + NUL + index)` decorate-sort
with no `Math.random` and no `Date` (`:42-46`). Blinding is decision-time only,
never the archive: `render_deanonymization_block` restores the
`label → provider · model` mapping after the verdict (`:13-14,79-87`), and the
map is persisted as `blind_review_map` (`src/scripts/council_cli.ts:2795-2797`).

**The asymmetry, confirmed with two line corrections to the roadmap.** Blind
chairman synthesis is **default-ON**: the CLI arg default is
`blind_chairman: true` at **`src/scripts/council_cli.ts:3551`** — the roadmap's
`:3557` is wrong by six lines. The adjacent comment records the decision: "`Ü1`
ADOPTED (road-to-council-blind-review Phase 3, 2026-07-28): blind synthesis is
the default — 0/10 + 0/10 pre-registered degradation triggers on the n=10 A/B;
opt out per-invocation with --no-blind-chairman" (`:3545-3550`). Blind **peer
review is opt-in**: `_peer_review_active` returns true only on the
`--peer-review` flag or `ai_council.peer_review.enabled`
(`src/scripts/council_cli.ts:1289-1295`) — the roadmap's `:1288-1294` is off by
one at the start; 1288 is the section comment. The arg default is
`peer_review: false` (`:3534`).

**A stale docstring inside the blind-review module itself.**
`src/scripts/ai_council/blind_review.ts:23-24` says "All four exports are inert
unless a CLI flag opts in". That describes the pre-Phase-3 state; the code sets
`blind_chairman: true` by default (`src/scripts/council_cli.ts:3551`), so
the `Ü1` export is not inert without a flag. The code is authoritative.

Pass order in `cmd_run` is fixed by source order: stance tally → handoff
envelope (`src/scripts/council_cli.ts:2708`), **peer review** (`:2710-2720`),
consensus scoring (`:2722`), quorum re-annotation (`:2724`), **chairman
synthesis** (`:2726-2736`), blind mapping on the host path only (`:2740-2751`).
Peer review therefore always precedes chairman synthesis. The blind map at the
last step is computed only when no member chairman ran (`chairman === null`,
i.e. `mode === 'host'`); the member-chairman path blinds inline (`:2737-2742`).
Only non-error, non-empty responses enter the pairs (`:2745-2747`).

Chairman *selection* is pure and enforces a no-self-judge rule: a member that
deliberated cannot chair and falls back to host with a visible annotation
(`src/scripts/ai_council/chairman.ts:59-65`); `auto` picks from
non-deliberators, tie-broken by tier then config order (`:68-85`); annotations
are never silent substitutions (`:29-31`).

---

## 6. Consensus semantics

**The unit is per-finding, plus a separate per-option tally.** `consensus.ts`
scores individual findings: "members score each other's findings. The renderer
ranks findings by consensus and surfaces a 'Minority Views' section"
(`src/scripts/ai_council/consensus.ts:5-8`), and `ConsensusMetadata` is
explicitly "per-finding aggregate" (`:15-17`). A second, orthogonal unit exists
for "A or B?" questions, and `stance_tally.ts` states the gap it fills:
"`consensus.ts` scores *findings*; nothing here produces an *option-level*
verdict" (`src/scripts/ai_council/stance_tally.ts:3-4`).

Per finding, `consensus_strength = mean(score)/10 × agreement_rate`
(`src/scripts/ai_council/consensus.ts:151`, implemented `:196-198`). Self-scores
are dropped — a finding's author never scores it (`:153-155`, enforced
`:170-172`) — and a finding with no scorers gets `strength = 0` (`:178-192`).
Bucketing defaults are `DEFAULT_STRONG_THRESHOLD = 0.7` and
`DEFAULT_MINORITY_THRESHOLD = 0.4` (`:43-44`), overridable per call (`:236-237`)
and validated for ordering `0 ≤ minority ≤ strong ≤ 1` (`:238-242`), with
strict-greater assignment on both edges (`:261-267`). A separate
evidence-quality letter buckets the mean: H at ≥ 8.0, M at 6.0–8.0, L below
(`:83-89`).

For the option tally, confidence weights are `high 1.0 / med 0.75 / low 0.5`
(`src/scripts/ai_council/stance_tally.ts:17-21`), and consensus requires the
leading option to clear `CONSENSUS_FRACTION = 2/3` of the base-weight total
(`:24`), compared with a float epsilon guard (`:205`).

**Minority and dissent are retained three ways.** A dedicated bucket:
sub-threshold findings land in `bucket.minority` "so they remain audit-trail
signal rather than silent drop" (`src/scripts/ai_council/consensus.ts:6-8`),
including uncontested-but-unsupported findings (`:232-233`), each bucket sorted
strongest-first (`:269-273`). Named reasons: `dissent_reasons` holds
`(scorer, reason)` pairs for dissenters only, in scoring order (`:102`, built
`:202-205`), beside `dissent_count` and `concur_count` (`:197-201`). And
refusal preservation in the tally: a member who responded but whose stance line
did not parse **still counts toward the quorum denominator** while backing
nothing (`src/scripts/ai_council/stance_tally.ts:178-180`). The comment records
the measured attack this closes — `w_total` once counted only parseable
stances, so a prose refusal "vanished from the quorum and made consensus
EASIER": margin −0.25 → +0.4167, "Δ 0.6667, outcome flipped" (`:161-176`). The
same measurement is published as a claim
(`docs/CLAIMS.md:526`: post-fix steering margin exactly 0).

The stance grammar is
`STANCE: <label> | CONFIDENCE: high|med|low | DEALBREAKER: yes|no`
(`src/scripts/ai_council/prompts.ts:174-176`), matched by `_STANCE_RE` with
`medium` accepted as an alias (`src/scripts/ai_council/stance_tally.ts:65-68`).
So the vocabulary is **not** agree/disagree/abstain: the option label is
free-text and peers must reuse each other's wording, the only reserved label is
`abstain` (`ABSTAIN_LABEL`, `:27`), and the orthogonal axes are a three-tier
`Confidence` (`:14`) and a boolean `dealbreaker` (`:35`). The `agree: bool`
field belongs to the separate finding-scoring schema
(`src/scripts/ai_council/consensus.ts:13-14`). The last well-formed line wins if
several appear (`stance_tally.ts:73-82,101-104`), and a lenient re-pass forgives
exactly two cosmetic defects — markdown emphasis and `,`/`;` separators — then
re-runs the same strict grammar, because "leniency never invents a stance from
prose" (`:112-122`).

**On a split, `consensus` is null and nothing is forced.** The interface comment
is explicit: "`consensus` is null on a split — never a forced winner"
(`src/scripts/ai_council/stance_tally.ts:46`, computed `:205-207`), the
docstring adds "never a forced winner, never an auto-added round" (`:144-145`),
and rendering escalates in words: "Escalated: no option cleared the threshold —
the split is returned to the user, not forced" (`:270-272`). Abstentions raise
the bar without backing anything (`:182-186`, rendered `:250-252`).

Quorum is a separate module: `evaluateQuorum` yields `concluded` when present ≥
threshold, else `inconclusive` (`src/scripts/ai_council/quorum.ts:100-103`),
threshold resolved from a `majority`-default setting (`:70`), with
`withUnparsed` recomputing status when unparsed members are folded in
(`:122-130`). The module states that deciding what to *do* with `inconclusive`
— block, retry — is deliberately not its job (`:9-10`).

---

## 7. Anti-conformity and novelty gates

`debate_gates.ts` is pure and deterministic with no LLM call; it decides
*whether* a bounded repair re-prompt is warranted, while dispatch and policy
live in the run path (`src/scripts/ai_council/debate_gates.ts:3-7`).

**Novelty gate.** `is_near_duplicate` measures token-set Jaccard similarity
between a member's round-N and round-(N−1) replies, order-independent and
lowercased, firing at `>= threshold`
(`src/scripts/ai_council/debate_gates.ts:32-41`). Threshold:
`NOVELTY_DUP_THRESHOLD = 0.8`, described as reuse of the existing shared
MERGE-level Jaccard bar (`:14-15`). Empty text on either side returns false
(`:37-39`). A duplicate means the member added nothing and warrants one targeted
re-prompt (`:29-30`).

**Dissent quota.** `count_dissenters` counts replies carrying an objection
marker (`src/scripts/ai_council/debate_gates.ts:49-57`) and `dissent_quota_met`
compares against quota (`:60-62`). Threshold: `DISSENT_QUOTA = 2` distinct
dissenting members (`:17-18`). Below quota the round "has collapsed toward
agreement" and the most-recently-converged member gets one dissent re-prompt
(`:44-47`). The marker regex is local because the engine has no dissent parser
— existing "dissent" is LLM-score-derived, not text-marker-derived (`:20-23`).
Empty and error replies do not count (`:48`, enforced `:52`).

**Repair policy.** `repair_action` returns `skip` if the member was already
repaired this round, else `fire` under `--auto-continue` and `confirm`
interactively (`src/scripts/ai_council/debate_gates.ts:81-89`). The cap is
absolute: ≤ 1 repair per member per round regardless of mode (`:73-79`).

**The anti-conformity directive** is `ANTI_CONFORMITY_DIRECTIVE` at
`src/scripts/ai_council/prompts.ts:180`. It requires defending a still-believed
position, changing only when a specific named flaw is identified, and states
"agreement without a named reason is conformity, not reasoning". Its doc block
explains it counters round-over-round convergence drift and is byte-identical
across api/cli/manual transports because it rides in the shared `user_prompt`
(`:172-179`). Wiring: imported at
`src/scripts/ai_council/orchestrator.ts:64` and injected into the round-2+
suffix only when the `anti_conformity` flag is set (`:1029`, placed at `:1035`).

**The whole cluster is default-OFF, config-only, with no CLI flag.** The typed
builder defaults `enabled` to `false` at
**`src/scripts/ai_council/config.ts:1118`** (`const enabled = _get(d, 'enabled', false);`),
rejecting a non-bool rather than coercing (`:1119-1121`); an absent block is
normalised to `{}` first (`:832-834`). **The roadmap's `config.ts:1113` points
at the docstring, not the default** — `:1113` is the comment `` /** `ai_council.debate_gates` (Phase 3). `{enabled}`, default false. */ ``.
The CLI reads it with no flag override: `debate_gates_on` requires
`ai_council.debate_gates.enabled === true`
(`src/scripts/council_cli.ts:3179-3182`). Executable probe:

```
grep -c "'--debate-gates'" src/scripts/council_cli.ts   # → 0
```

Both halves hang off that one boolean: `debate_gates: debate_gates_on` and
`on_repair: debate_gates_on ? _make_repair_confirm(...) : null`
(`src/scripts/council_cli.ts:3194-3195`), and
`_run_debate_gate_repairs` runs only when `opts.debate_gates === true` **and**
`round_idx > 0` (`src/scripts/ai_council/orchestrator.ts:1334-1359`). With
`on_repair` null the gates "detect but never dispatch (no unplanned spend
without an explicit transport)" (`:1179-1183`).

---

## 8. Spend / overrun / daily gates

**Five independent gates, bounding different things.**

**(1) Per-run token caps.** `CostBudget` carries `max_input_tokens` /
`max_output_tokens`, defaulting to `50_000` / `20_000` in the class constructor
(`src/scripts/ai_council/spend_gate.ts:38-39`). `_breach` returns `'tokens'`
when accumulated spend plus the next member's estimate crosses either
(`src/scripts/ai_council/spend_gate.ts:104-109`). These apply even with no price
table, i.e. even when the USD ceiling is off
(`src/scripts/ai_council/orchestrator.ts:376-378`).

**(2) Per-run call-count cap.** `max_calls` defaults to `10` in the class
(`src/scripts/ai_council/spend_gate.ts:40`) and is a **hard throw before any
call**: `consult` raises `Council has N members but budget caps at M calls.`
when the roster exceeds it (`src/scripts/ai_council/orchestrator.ts:418-422`,
repeated on the debate path at `:1254-1257`).

**(3) Per-run USD ceiling.** `max_total_usd` defaults to `0.0` in the class, and
`0` means **disabled** — the comment says so in as many words
(`src/scripts/ai_council/spend_gate.ts:26`, initialised `:41`). `_breach`
returns `'session'` only when `budget.max_total_usd > 0` (`:113`).

**(4) Rolling 24h USD cap — the "daily" gate.** `daily_limit_usd` defaults to
`0.0`, again disabled at zero, and disabling it *also disables the spend ledger*
because the orchestrator only appends while a cap is live
(`src/scripts/ai_council/spend_gate.ts:27,42`; the coupling is stated at
`src/scripts/ai_council/config.ts:292-294`). `_breach` returns `'daily'` via
`would_exceed` (`src/scripts/ai_council/spend_gate.ts:110-112`).

**(5) Per-provider daily CLI-call quota.** A separate, count-based gate for
subscription (`mode: cli`) seats, default `50` calls per provider per UTC day
(`DEFAULT_CLI_CALLS_PER_DAY = 50`,
`src/scripts/ai_council/cli_call_budget.ts:60`). `resolveCliCallCaps` **seeds
every known provider with the default** and applies overrides on top, so an
absent, empty or malformed config yields the defaults and never "uncapped"
(`src/scripts/ai_council/cli_call_budget.ts:88-105`) — the header records that
omission-reads-as-uncapped was a live defect (`:73-77`).

### Two default sets exist, and only one is live

The runtime `CostBudget` in `cmd_run` is built from the raw
`ai_council.cost_budget` dict with fallbacks `50_000 / 20_000 / 10 / 0.0 / 0.0`
(`src/scripts/council_cli.ts:2586-2597`, duplicated on the debate path at
`:3098-3108`). The *validated* config builder uses different numbers:
`max_input_tokens: 500_000`, `max_output_tokens: 200_000`, `max_calls: 50`,
`max_total_usd: 20.0`, `daily_limit_usd: 0.0`
(`src/scripts/ai_council/config.ts:1666-1670`).

Those two sets do **not** both apply. `load_settings` overwrites
`settings['ai_council']` with a block synthesised from the parsed
`CouncilConfig` whenever `.ai-council.yml` exists
(`src/scripts/council_cli.ts:468-471`), and that block carries the
`cost_budget` fields verbatim
(`src/scripts/_lib/council_settings_block.ts:85-91`). So with a council config
file present — the only state in which a council runs at all — the **effective**
defaults are the `config.ts` ones (500k / 200k / 50 / **$20.00** / 0.0), and the
`council_cli.ts` fallbacks are dead-lettering for the file-absent case. All five
`cost_budget.*` fields are validated `>= 0`
(`src/scripts/ai_council/config.ts:1672-1687`). `cli_call_budget.warn_at`
defaults to `0.8`, constrained to `[0.0, 1.0]` (`:1964-1968`).

### On overrun: hard refusal, and the documented prompt is not code

`_breach` is consulted before each member. With an `on_overrun` callback,
returning false records `_aborted(member, error_tag)` and continues to the next
member (`src/scripts/ai_council/orchestrator.ts:716-719`); **without one the
orchestrator short-circuits every remaining member with
`cost_budget_exceeded` and returns** (`:720-726`).

**No in-tree caller ever supplies `on_overrun`.** The identifier appears only in
`orchestrator.ts`, `orchestrator_results.ts`, `spend_gate.ts` and documentation;
`council_cli.ts` contains zero occurrences. So the "Cost budget overrun —
pausing before next member" block with numbered options documented at
`src/skills/ai-council/references/cost-and-redaction.md:76-98` is
**agent-carried prose, not code** — the CLI header states it is non-interactive
by contract and the cost gate is the `--confirm` flag, "never an interactive
y/n" (`src/scripts/council_cli.ts:12-13`). Doc and code disagree; the code
short-circuits.

Two genuine mid-flow interactive prompts do exist, both on the `debate` path
only: the per-round cost checkpoint
`debate:checkpoint round=N/M cost_so_far=$X next_round_estimate=$Y — continue? [y/N]:`,
read from stdin with blank/EOF treated as "N"
(`src/scripts/council_cli.ts:2940-2951`), wired only in `cmd_debate`
(`:3147-3149`) and consulted at
`src/scripts/ai_council/orchestrator.ts:1407-1418`, suppressed entirely by
`--auto-continue` (`src/scripts/council_cli.ts:2936-2938`); and a repair
re-prompt confirm of the same shape (`:2926-2928`). Above the checkpoint sits a
**hard** cap: a projected round crossing `max_total_usd` throws
`DebateCapExceeded` (`src/scripts/ai_council/orchestrator.ts:1395-1405`), which
the CLI catches, reports with the partial-persist path, and exits `3`
(`src/scripts/council_cli.ts:3202-3213`).

The CLI-quota gate is a **pure refusal with no downgrade**: `ask()` checks the
counter *before spawning*, writes a `block_quota` event, and returns
`error: 'cli_quota_exhausted'` with `metadata.quota_source = 'local_budget'`
(`src/scripts/ai_council/clients.ts:1440-1477`). The two `quota_source` values
are deliberately distinguished — `local_budget` means nothing was sent or
billed, `provider` means a process ran and the call is booked
(`src/scripts/ai_council/cli_call_budget.ts:46-53`; the provider branch is
stamped at `src/scripts/ai_council/clients.ts:1586-1587`).

### Where the counters live, and how they reset

**USD, rolling window.** `~/.event4u/agent-config/council-spend.jsonl`, mode
0600 (`src/scripts/ai_council/budget_guard.ts:46,54`, root constant at
`src/scripts/_lib/user_global_paths.ts:50`), with the legacy
`~/.config/agent-config/` location still **read** as a fallback
(`src/scripts/ai_council/budget_guard.ts:65-74`). There is **no reset** — it is
a rolling window, not a daily bucket: `today_spend_usd` sums entries with
`ts >= now - 24h` and older lines simply stop counting
(`src/scripts/ai_council/budget_guard.ts:451-465`, `ROLLING_WINDOW_HOURS = 24`
at `:55`). The ledger is append-only (`:17`, appended `:519`), never raises on
disk failure (`:518-524`), and skips zero-cost calls (`:500-502`). The only
append site is the orchestrator, gated on `daily_limit_usd > 0`
(`src/scripts/ai_council/orchestrator.ts:812-818`).

**CLI calls, per UTC day.** `~/.event4u/agent-config/cli-calls.json`
(`CLI_CALLS_FILENAME`, `src/scripts/ai_council/clients.ts:1008`, resolved
`:1041-1043`). Reset is by **UTC date-marker mismatch**, not by pruning:
`load_cli_call_counts` returns `{}` whenever the file's `date` field differs
from `_today_utc_iso()` (`src/scripts/ai_council/clients.ts:1067-1069`, helper
`:1045-1052`). Writes are lock-held and atomic (`:1116-1122`,
`writeStateAtomically` at
`src/scripts/ai_council/cli_call_budget.ts:121-125`) — the header explains the
non-atomic predecessor could blank the whole budget, because a reader landing
mid-write swallows the parse error and sees zero used (`:110-119`). A manual
reset exists (`reset_cli_call_counts`,
`src/scripts/ai_council/clients.ts:1132-1149`), reachable as
`council quota --reset <provider> --confirm`
(`src/scripts/council_cli.ts:3369-3378`). Attribution lives in a **sidecar**
`cli-calls.json.attribution.json` deliberately kept out of the file the gate
reads (`src/scripts/ai_council/cli_call_budget.ts:29`, rationale `:20-27`).

### Price resolution, and the unpriced-model behaviour

Prices are read from `agents/runtime/.agent-prices.md`
(`src/scripts/ai_council/pricing.ts:28`), which `agents/runtime/` gitignores
wholesale (`.gitignore:196`). `load_prices` bootstraps the file from the shipped
table when missing (`src/scripts/ai_council/pricing.ts:403-407`, writer
`:410-415`). The shipped defaults are 13 hand-maintained rows,
`LAST_UPDATED = '2026-05-14'`
(`src/scripts/ai_council/_default_prices.ts:16`, table `:25-44`). Live refresh
pulls an upstream price map over HTTPS (`src/scripts/update_prices.ts:31-32`)
and **falls back to the shipped defaults on network or filter failure**, tagging
the source label accordingly (`src/scripts/update_prices.ts:144-159`).

**An unpriced model prices at zero, silently.** `estimate_cost` returns
`input_usd: 0.0, output_usd: 0.0` when `lookup` finds no row
(`src/scripts/ai_council/pricing.ts:128-138`). `lookup` mitigates the common
cause — dated vendor aliases — with a longest-prefix fallback inside the same
provider, requiring a separator (`-`, `.`, `:`, `@`) or end-of-id after the
prefix so `claude-opus-4-1` cannot match a `claude-opus-4-15` row (`:71-101`;
the silent-zero incident is recorded at `:56-61`). The zero-total ambiguity is
called out explicitly and is why `allSeatsNonBillable` exists rather than
inferring "subscription-authed" from a zero total: an unpriced *billable* model,
an errored billable seat, and a zero-token seat all produce zero (`:216-232`).
Cache repricing uses constants, not table columns: read `0.1×`, 5-min write
`1.25×`, 1-hour write `2.0×` (`:264-266`).

Staleness is computed against the most recent UTC Monday, with a malformed
`last_updated` treated as stale (`src/scripts/ai_council/pricing.ts:392-399`).
**`is_stale` has no consumer in `council_cli.ts`** — the only in-tree caller is
`update_prices` (`src/scripts/update_prices.ts:167`), so the staleness gate at
`src/domains/meta/council/default/command.md:137` is agent-carried, not enforced
by the run path.

### probation_gate and confidence_gate — both unreachable

**`probation_gate`** operates on the low-impact corpus, not on spend: it prunes
`seen` timestamps older than `WINDOW_DAYS = 30` and promotes an entry from
`## On Probation` to `## Validated` at `PROMOTION_THRESHOLD = 3` surviving
timestamps, one-way (`src/scripts/ai_council/probation_gate.ts:33-34`, rules
`:12-19`), idempotent and writing only on a non-no-op run (`:10,28`, `is_noop`
at `:55-61`). **It has no in-tree caller**: the docstring says the caller
invokes it "at council startup AND after every intake append" (`:9`) and
`src/scripts/ai_council/low_impact_intake.ts:22` names it, but only in prose —
`run_gate` (`probation_gate.ts:218`) is referenced from no production call site.

**`confidence_gate`** gates solo-member dispatch on a *content* signal.
`should_escalate` runs refusal → split → short → low-confidence → ok
(`src/scripts/ai_council/confidence_gate.ts:209-230`). Below `40` code points is
`short_response` (`:20`, applied `:222`); hedge-word density above `0.04`
matches per 100 chars drives the derived score (`:26`, computed `:156-158`); an
explicit `Confidence: 0.X` / `NN%` marker wins over the density heuristic
(`:127-147`). The floor is `low_impact.solo_confidence_floor`, default `0.7`
(`src/scripts/ai_council/config.ts:1616`, validated to `[0.0, 1.0]`
`:1623-1628`). **Not default-on and not reachable:** its only caller is
`dispatch_with_escalation` (`src/scripts/ai_council/solo_dispatch.ts:253`),
which is referenced from nothing outside its own module and its test —
`council_cli.ts` imports only `AuthCache` and `select_solo_member`
(`src/scripts/council_cli.ts:78`), and the `--single` path that does run never
scores the response (`:2363-2406`).

### The zero-spend probes a reviewer runs

The dispatch table is
`['estimate', 'run', 'debate', 'render', 'replay', 'quota', 'shadow-report', 'status', ...BILLING_SUBCOMMANDS]`
(`src/scripts/council_cli.ts:3502`), routed at `:3871-3896`.

```
agent-config council:status --json      # config + resolved transports + billing class
agent-config council:quota              # today's per-provider CLI-call use vs the ENFORCED cap
agent-config council:estimate <file>    # per-member cost preview; no seat is contacted
```

`council:quota` (`src/cli/registry.ts:124`, body
`src/scripts/council_cli.ts:3356-3405`) prints
`provider · used/limit · status · by <consumer> N` per provider and reads the cap
through the *same* resolver the gate uses (`:3364-3366`, rationale `:3360-3363`).
`council:estimate` (`src/cli/registry.ts:120`) is tagged spend-free in its own
construction comment (`src/scripts/council_cli.ts:1668-1671`).

**None of the three prints the `cost_budget` USD ceilings.** `cmd_status`
reports config path, provenance, enabled members, resolved transport, billing
class, qualification and `fallback.api_on_quota`
(`src/scripts/council_cli.ts:2288-2293,2334`). The USD ceiling is surfaced by
`cmd_doctor` instead (`src/scripts/_cli/cmd_doctor.ts:2349`) and by the
detection report (`src/scripts/_cli/detection_report.ts:362`).

---

## 9. Replay schema

**The artefact is Markdown and carries no version field.**
`render_decision_replay` returns a prose Markdown body, not JSON
(`src/scripts/ai_council/replay.ts:210`, final return `:330`). There is no
`schema_version` and no version field of any kind — probe:
`grep -c version src/scripts/ai_council/replay.ts`. The header points at
`docs/contracts/ai-council-config.md` § "Decision-replay schema" as the
documentation of record (`src/scripts/ai_council/replay.ts:11-13`).

Input schema `DecisionReplayInputs` (`src/scripts/ai_council/replay.ts:38-61`):
`findings`, `scores`, `metadata`, `deliberation` (last-round per-member texts),
`original_ask` (default `''`), `include_member_arguments` (default `true`).

Output sections in emission order: `# Decision Replay` (`:248`), the ask as a
blockquote truncated at 400 code points (`:249-255`);
`*No findings were extracted for this session.*` with an early return on an
empty finding set (`:256-259`); one `## <finding-id> — <title>` block per
finding, title truncated at 120 (`:271-276`), ranked by `consensus_strength`
descending with a stable tie-break on input order (`:218-246`); per finding
`- **Consensus**`, `- **Evidence quality**`, `- **Agreement**: <concur>/<concur+dissent> members concur, <dissent> dissent`
(`:277-284`), with band thresholds `> 0.7 → Strong`, `> 0.4 → Moderate`, else
`Weak` (`:149-157`); `**Agreeing members**:` / `**Dissenting members**:` lists
emitted **only** when `include_member_arguments` (`:285-308`), each argument
preferring the scorer's `reason`, falling back to a truncated deliberation
snippet, and degrading to the literal `no argument captured` (`:166-187`);
`**Synthesis verdict**` (`:309`); an `- **Evidence spread**` /
`- **Provider spread**` trailer (`:314-327`); and
`_artefact mode: full_` or `_artefact mode: redacted (counts only)_`
(`:328-329`), so a consumer can tell at a glance whether arguments were redacted
(`:206-208`). The artefact is a pure projection of consensus data plus
per-member texts — **no extra model calls** (`:10-11`).

**Where it is written, and whether tracked.** Automatic, during a run:
`decision-replay.md` beside the responses artefact,
`path.join(path.dirname(out_path), 'decision-replay.md')`
(`src/scripts/council_cli.ts:1281-1283`), responses living under
`agents/runtime/council/responses` (`:220`). Manual, via the subcommand:
`--output` is validated to live under `agents/runtime/council/sessions`
(`:3335-3338`, canonical map `:219-223`, validator `:3409-3426`). Both are
gitignored twice over — the catch-all `/agents/runtime/` (`.gitignore:196`, with
the Volatile Runtime policy comment naming council sessions at `:188-195`) and
the managed consumer block re-listing `agents/runtime/council/responses/` and
`.../sessions/` (`.gitignore:319-320`). The automatic write is gated by
`decision_replay.enabled`, **default `true`**, with `include_member_arguments`
also `true`, both overridable per lens
(`src/scripts/council_cli.ts:1239-1256`, gate `:1267-1270`).

**The roadmap's CLI-wiring citation is wrong.** `council_cli.ts:1270,1280` are
inside `_maybe_write_decision_replay`, the *automatic* in-run writer: `:1270` is
the closing brace of the `if (!enabled || consensus === null) return null;`
guard and `:1280` is the closing paren of the `render_decision_replay(...)` call
(`src/scripts/council_cli.ts:1266-1284`). Neither names the argspec nor the
dispatch. The verified wiring is: argspec `case 'replay'` with positional
`responses` and flags `--output`, `--redact-member-arguments`,
`--include-member-arguments`, `--low-impact-stats`
(`src/scripts/council_cli.ts:3655-3665`); body `cmd_replay` (`:3306-3346`),
which **exits 2 with `payload has no consensus block`** when the consensus block
is absent (`:3312-3318`); dispatch
`if (args.cmd === 'replay') return cmd_replay(args);` (`:3883-3885`).
`--low-impact-stats` diverts to a different artefact entirely (`:3307-3309`,
body `:3278-3304`). `council:replay` is **not** in `src/cli/registry.ts:120-126`;
the reachable form is
`./scripts-run src/scripts/council_cli replay <responses.json>`.

**events_log — a separate artefact.** One JSON line per council event at
`<repo>/agents/runtime/council/events.log`
(`src/scripts/ai_council/events_log.ts:120-126`), gitignored by
`.gitignore:196`. Eight reserved fields in insertion order (`:252-261`):
`schema_version`, `ts_utc`, `lens`, `invocation`, `action`, `verdict`,
`provider_caps`, `original_ask_hash`; caller-supplied diagnostic fields pass
through, reserved fields winning on collision (`:262-270`). **Append-only by
construction** — `fs.appendFileSync` with no read-modify-write anywhere in the
module (`:275`), parent directory created on demand (`:273`). The action
vocabulary is closed and an unknown action **throws** (`:228-233`): `proceed`,
`skip_necessity`, `block_quota`, `quorum_result`, `transport_fallback`
(`_VALID_ACTIONS`, `:92-103`). Privacy is by construction: `original_ask` is
never written verbatim — the caller passes the raw string and `appendEvent` pops
it and writes `sha256(...)[:12]` (`:13-16`, pop `:239-249`, hash `:134-143`,
with a stable twelve-zero sentinel for empty input at `:136`), and the
`quorum_result` line's `absent` entries carry a member name and a
closed-vocabulary reason with no field able to hold free-form content, the CLI's
own `detail` string being *dropped rather than scrubbed* (`:409-413`).
`AGENT_CONFIG_NO_EVENTS_LOG=1` short-circuits to a no-op returning `false`
(`:18-19,109`, checked `:223-225`). `appendQuorumEvent` is fail-open — every
error is swallowed, because attendance telemetry must never kill a pass
(`:415-420,490-492`).

**Schema evolution is additive-only, and nothing rejects an unknown version.**
`SCHEMA_VERSION = 5` (`src/scripts/ai_council/events_log.ts:83`), history
documented field-by-field at `:40-82`: v2 added the `quorum_result` action, v3
`gate_class` + `floor_would_hold`, v4 `min_present`, v5 `stance_agreement`. Every
bump is purely additive — no field renamed, retyped or moved — so an older
reader parses a newer line unchanged (`:43-53`). The same field list and
history are independently recorded in
`src/config/quorum-attendance-budget.json:2,8`. `parseLog` skips a malformed
*line* but never inspects `schema_version`
(`src/scripts/council_attendance_metrics.ts:64-81`, with the explicit note that
an unreadable line is "counted nowhere" at `:75-78`). Compatibility is handled
by **stratification instead of rejection**: the agreement rate filters to
`schema_version >= STANCE_AGREEMENT_SINCE` (=5) and reports
`agreement_eligible` / `agreement_excluded` separately rather than defaulting
earlier lines (`src/scripts/council_attendance_metrics.ts:36,116-118`, contract
`:53-61`), and the producer-side obligation is stated the same way
(`src/scripts/ai_council/events_log.ts:78-81`). Additive fields are preferred
over new actions because a new action is invisible to every consumer filtering
`action === 'quorum_result'` and would silently move the denominator of all four
registered metrics (`:452-458`). **The one place a version mismatch does throw**
is the low-impact corpus lockfile, not the events log: `load_corpus_lock` raises
`CorpusParseError('schema_version_mismatch')` unless `schema_version === 1`
(`src/scripts/ai_council/low_impact_corpus.ts:483-488`).

**A fixture/producer field drift.**
`tests/fixtures/council-events-schema-span/` holds exactly two files, `README.md`
and `events.log`, spanning the v4→v5 bump with four v4 `post_run`/`command=run`
lines, three v5 lines (one per agreement value), and two lines that must be
excluded from every rate. Its timestamp key is `ts` (8 occurrences; `ts_utc`: 0)
while `appendEvent` writes `ts_utc`
(`src/scripts/ai_council/events_log.ts:254`). The README claims the lines
"follow the field set `appendQuorumEvent` writes" — they do not, for that one
field. It passes only because `computeMetrics` never reads a timestamp
(`src/scripts/council_attendance_metrics.ts:83-118`). The code is authoritative.

**No JSON schema exists for any of this.** `ls src/scripts/schemas/` returns 29
files, none matching council / event / replay. The replay and events-log shapes
are pinned by tests and prose contracts only.

---

## 10. Low-impact path

**Three layered classifiers.**

**(1) Keyword — `classify_impact`**
(`src/scripts/ai_council/necessity.ts:689-762`). Empty question →
`user_required` at confidence `1.0` (`:691-698`). **User-fence markers beat
every other signal** → `user_required` at `1.0`; the set is `ask me`,
`review first`, `plan only`, `don't decide`, `do not decide`, `wait for me`,
`I'll decide`, `i will decide`, `let me decide`, `frag mich`, `warte auf mich`
(`:566-570`, applied `:704-715`). Then severity precedence
`high_impact → medium_impact → low_impact → trivial` (`:720-749`). Confidence is
`min(1.0, 0.5 + 0.15 × hits)`, floored at `0.85` for `high_impact` (`:733-738`).
No marker → `medium_impact` at confidence `0.3`, deliberately so the routing
layer escalates rather than letting the agent resolve (`:754-761`). The
`low_impact` trigger list is 14 phrases (`:583-588`), `high_impact` carries 28
(`:594-601`), and `user_required` is deliberately empty (`:602`).
`LOCKED_IMPACT_CLASSES = {high_impact, user_required}` is structurally locked to
`user` routing and unremappable via config (`:557-560`, rationale `:552-556`;
config-side rejection at `src/scripts/ai_council/config.ts:1170-1173`).

**(2) Exact corpus — `classify_impact_with_corpus`**
(`src/scripts/ai_council/necessity.ts:789-826`). Runs `classify_impact` first and
returns immediately on a locked class (`:793-796`), then normalises — lowercase,
strip non-`\p{L}\p{N}_\s`, collapse whitespace, spelled out explicitly because
JS `\w` is ASCII-only under `/u` (`:800-807`) — and short-circuits to
`low_impact` at **confidence `0.9`**, category `corpus_validated`, on an exact
normalised match against any `## Validated` phrase (`:811-822`).

**(3) Fuzzy corpus — `classify_impact_with_corpus_fuzzy`**
(`src/scripts/ai_council/low_impact.ts:940-1014`), threshold default **`0.92`**
(`:945`). Four rejection gates, all returning the base verdict: a locked base
class (`:954-956`); no corpus paths or a threshold outside `(0.0, 1.0]`
(`:957-959`); a **high-impact veto** — any `high_impact` trigger present as a
whole word in the lowered query wins the Iron Law regardless of similarity
(`:967-977`); `best_validated < threshold` (`:993-995`); and an **anti-example
veto** — `best_anti >= best_validated` rejects the match, so the corpus can
actively flag a shape as user-required (`:997-1003`). On success: `low_impact`,
confidence `min(0.9, best_validated)` rounded to 4dp, category
`corpus_validated_fuzzy` (`:1005-1013`). The similarity metric is a faithful
port of Python `difflib.SequenceMatcher.ratio()` —
`2.0 × matches / (len(a) + len(b))` over the recursive longest-matching-block
decomposition, no autojunk (`src/scripts/ai_council/low_impact.ts:1017-1098`,
return `:1097`).

**Neither corpus classifier has an in-tree caller.** Grep of `src/` for
`classify_impact_with_corpus` returns only the definitions and one docstring
cross-reference (`src/scripts/ai_council/low_impact.ts:920,940`,
`src/scripts/ai_council/necessity.ts:789`); same for `classify_impact` itself.

### The four transparency markers

Each is built in `low_impact.ts` with a comment saying its wording is fixed by
`fast-path-marker-visibility.md`'s Iron Law.

- **Resolved** — `> Resolved via low-impact council fast-path: ${verdict}.` (`src/scripts/ai_council/low_impact.ts:440`), where `verdict` is `single-member answer` for ≤1 answer, else `${n}-member consensus` (`:434-439`).
- **Unavailable** — `> Low-impact council unavailable (no opted-in members) — escalating to user.` (`src/scripts/ai_council/low_impact.ts:420-422`).
- **Split** — `> Low-impact council split — escalating to user (${parts}):` (`:410`), `parts` joining `member: <first line, 80 code points>` with ` / ` (`:406-409`).
- **Aborted** — `> Low-impact council aborted (${reason}) — escalating to user: members tried: ${names}.` (`:393-396`).

**One code/rule discrepancy, on the aborted marker.** The rule specifies the
literal `> Low-impact council aborted (token cap) — escalating to user:`
(`src/rules/fast-path-marker-visibility.md:41`). The code parameterises the
reason and, on the only path that constructs it, passes `'all members failed'`
(`src/scripts/ai_council/low_impact.ts:707`). The prefix matches; the
parenthetical does not, and the code emits a trailing `members tried: …` clause
the rule does not show — the comment at `:388-389` states that trailer is
deliberate so pattern matchers can still extract who was called. The other three
markers match the rule's literals byte-for-byte
(`src/rules/fast-path-marker-visibility.md:38-40`). The rule additionally
requires the marker be the first non-whitespace line, verbatim, **in English
even when the user wrote another language**, once only, no emoji, with the
leading `> ` prefix intact (`:47-53`), and lists five named violations
(`:66-72`).

A separate plan-time marker exists, unrelated to the four:
`[fast-path: N members (names) · cap $X.XX · NNNN tokens]`
(`src/scripts/ai_council/low_impact.ts:252-255`).

### How the resolution is decided

`resolve_low_impact` (`src/scripts/ai_council/low_impact.ts:596-775`): an
unresolvable plan → `unavailable` (`:607-613`); per member an optional
cheapest-rung model downgrade, with a guard refusing to downgrade a member left
on the vendor-default sentinel unless a human pinned an override (`:630-649`);
a **per-answer hard cap** — an answer whose projected cumulative cost exceeds
`max_total_usd` is refused with
`would exceed fast-path cap $X (projected $Y)` and the loop **breaks**
(`:682-698`); zero ok answers → `aborted` (`:706-722`); one ok answer →
`resolved` (`:724-740`); two ok answers with **identical normalised answer
lines** → `resolved`, otherwise → `split` (`:742-774`). Consensus here is a
string equality on the normalised first line, not a semantic comparison.

**`resolve_low_impact` has no in-tree caller**, and neither does
`plan_fast_path`; both appear only in `low_impact.ts`, their tests, and the
`dist/mcp` bundle. The only thing `council_cli.ts` uses from `low_impact.ts` is
`parse_low_impact_log` + `render_low_impact_stats` for the
`replay --low-impact-stats` report (`src/scripts/council_cli.ts:3279-3291`), and
nothing in `src/` **writes** `low-impact-resolutions.md` — the CLI only reads it
(`:3281-3288`). Executing the fast path is agent-carried; the skill documents the
artefact location as
`agents/runtime/council/sessions/<date>-<slug>/low-impact-resolutions.md`
(`src/skills/ai-council/references/advanced-modes.md:308`).

### The redactor: eight classes, two declared gates, one real

Eight forbidden-content classes, enumerated in the module header
(`src/scripts/ai_council/redact_low_impact_entry.ts:17-35`), each emitting a
distinct `category`: `secret` via `_RAW_KEY_PREFIXES` +
`[A-Za-z0-9_-]{6,}` (`:195-210`) and via
`api[_-]?key\s*[:=]\s*[A-Za-z0-9+/=_-]{12,}` (`:185-188`, hit `:211`); `email`
(`:153-156`, hit `:225`); `project_path` for `/Users/`, `/home/`, `/opt/`,
`/private/`, `[A-Z]:\` (`:160-165`, hits `:228,231`); `customer_name` from a
caller-supplied list (`:247`); `internal_hostname` for `*.internal`, `*.local`
plus caller domains (`:168-171`, hits `:234,238`); `monetary_amount`
(`:178-182`, hit `:242`); `sql_identifier` from a caller-supplied list (`:253`);
and `long_code_excerpt` for a backtick run `{41,}` chars (`:191`, hit `:259`).
`_RAW_KEY_PREFIXES` is seven entries
(`src/scripts/ai_council/config.ts:111-119`).

**The redactor never auto-rewrites** — that would be a soft privacy gate. It
refuses and surfaces what to rephrase
(`src/scripts/ai_council/redact_low_impact_entry.ts:272-278`), returning
`redaction REFUSED — <category>: <repr(snippet)>; …` (`:133-139`); entry point
`redact_low_impact_entry` (`:279-291`).

**The two declared gates — only one is in code.** The rule and the module header
both say the redactor runs at the write gate (intake) and the upstream gate
(`src/rules/low-impact-corpus-privacy-floor.md:20-25`;
`src/scripts/ai_council/redact_low_impact_entry.ts:9-15`). The **upstream gate
is real**: `build_preview` runs the redactor on every candidate Validated phrase
and buckets refusals into `refused`, which blocks the PR
(`src/scripts/ai_council/learn_low_impact_preview.ts:291-305`, Iron Law `:102`,
refused section `:132`). The **write gate is agent-carried, not enforced**:
`low_impact_intake.ts` contains no import of and no call to the redactor — its
only mention is a docstring saying "the host agent … runs the privacy redactor,
and routes the result through this module"
(`src/scripts/ai_council/low_impact_intake.ts:9-10`), so `record_intake`
(`:149`) will append an unredacted entry if the agent skips the step. The rule's
"runs at both gates" is true of the intended flow and false of the intake code
path.

The redactor is separately reused as a general primitive by three unrelated
surfaces: `src/scripts/hooks/hot_context_hook.ts:165` (violating lines
**dropped**, not refused, per `:32`), `src/scripts/pattern_share.ts:102`, and
`src/scripts/_lib/knowledge_global_redaction.ts:42-43`.

Intake triggers are 11 substring phrases, DE + EN
(`src/scripts/ai_council/low_impact_intake.ts:29-43`), and intake outcomes are
`appended_seen | new_probation | duplicate_validated | noop` (`:54`).

### Where the corpus lives, and the seed that does not exist

The project-local corpus is `agents/decisions/low-impact-decisions.md`, named
consistently across four modules
(`src/scripts/ai_council/low_impact_corpus.ts:2`,
`low_impact_intake.ts:2`, `probation_gate.ts:2`,
`redact_low_impact_entry.ts:2`; compiler default at
`src/scripts/ai_council/compile_corpus.ts:67`), with the compiled lockfile at
`agents/decisions/low-impact-decisions.lock.yaml` (`compile_corpus.ts:68`). Both
exist on disk, and both loaders **prefer the lockfile and fall back to lenient
Markdown** when it is missing (`low_impact_corpus.ts:433-439` for validated,
`:451-457` for anti-examples), silently dropping malformed lines so a broken
corpus never blocks classification — strict validation lives in
`parse_corpus_strict` and CI (`:429-431`). `install.sh` migrates both files from
a legacy `agents/` root to `agents/decisions/`, idempotently and never
overwriting (`src/scripts/install.sh:1012-1035`).

**The upstream seed does not exist at any of the three paths that name it.**
`src/rules/low-impact-corpus-privacy-floor.md:56-57` declares
`data/low-impact-decisions-seed.md` an "upstream seed shipped with the package",
and the rule's own `path_prefix` trigger is `data/low-impact-decisions-seed`
(`:7`). There is no `data/` directory in this repo (`ls data/` → *No such file
or directory*). The command that consumes the seed names a different path,
`.agent-src.uncondensed/data/low-impact-decisions-seed.md`
(`src/domains/meta/memory/learn-low-impact/command.md:25,61,105`), and
`ls -d .agent-src.uncondensed` also returns *No such file or directory*. No
`.ts` file in the tree references a seed path; `build_preview` takes `seedPath`
as a caller-supplied argument with no default
(`src/scripts/ai_council/learn_low_impact_preview.ts:268-271`).

### Is the low-impact path default-on? No — three defaults each keep it off

`decision_resolution.enabled` defaults to `true`
(`src/scripts/ai_council/config.ts:1187`), but
`decision_resolution.classes.low_impact.mode` **defaults to `agent`**, not
`council` (`_DEFAULT_RESOLUTION_MODES`, `:1175-1181`) — so a low-impact question
resolves in-session by default and never reaches a fast-path council. And
`members.<name>.participate_low_impact` **defaults to `false`** (`:1803`), while
`select_fast_path_members` requires `enabled && participate_low_impact`
(`src/scripts/ai_council/low_impact.ts:201`) — so with shipped defaults the
selection is empty, `plan_fast_path` returns the unavailable plan with reason
"no member has `participate_low_impact: true` …" (`:240-249`), and
`resolve_low_impact` emits the `unavailable` marker (`:607-613`). Third,
`decision_resolution.fast_path.fuzzy_match.enabled` **defaults to `false`**
(`src/scripts/ai_council/config.ts:1317`), threshold `0.92` (`:1324`).

Other fast-path defaults, all hard-validated: `max_members` `2`, constrained to
1 or 2 (`src/scripts/ai_council/config.ts:1258-1271`); `max_rounds` **LOCKED to
`1`** (`:1272-1279`); `max_tokens` `2500` (`:1280`); `max_cost_usd` `0.05`, must
be `> 0` (`:1287-1300`). `low_impact.dispatch` defaults `'full'`,
`shadow_sample_rate` `0.1`, `solo_confidence_floor` `0.7`
(`:1582,1602,1616`). The token budget splits 60/40 input/output via
`_INPUT_RATIO = 0.6` (`src/scripts/ai_council/low_impact.ts:48`, applied
`:218-219`), and `max_calls` is pinned to `max_members` so the orchestrator
short-circuits when the fast-path quota is spent (`:223`, rationale `:214-215`).
Selection order is alphabetical by provider name — deliberately, with no hidden
cost-rank heuristic (`:187-188`, sort `:205`).

---

## 11. Current synthesis policy

**Three different things produce the final artefact, and only one of them is a
model call.**

**Default: the host agent, via a template slot — no model call at all.**
`render()` selects a lens-aware synthesis *template*
(`src/scripts/ai_council/orchestrator.ts:1936-1943`) and, when the template is
empty, emits the literal placeholder `*to be summarised by the host agent*`
(`src/scripts/ai_council/orchestrator.ts:1970-1975`). The slot is always pushed
as `## Convergence / Divergence`
(`src/scripts/ai_council/orchestrator.ts:2014`).

**Opt-in: a designated non-deliberating member authors it with one extra
billable call.** `_maybe_run_chairman` returns `null` and does nothing when
`ai_council.chairman.mode === 'host'` (`src/scripts/council_cli.ts:1354-1358`);
otherwise it dispatches `consult([client], synthQ, budget, …)` — a separate
invocation with its own ledger (`src/scripts/council_cli.ts:1428-1433`), called
from `cmd_run` (`:2724-2734`). Cost is modelled as exactly one extra call priced
at the most expensive member estimate (`src/scripts/council_cli.ts:1302-1309`).

**Deterministic aggregation exists but is not the verdict.** Consensus bucketing
(`src/scripts/ai_council/consensus.ts:157,235`) and the option-level stance
tally (`src/scripts/ai_council/orchestrator.ts:1988-1993`) render as their own
sections; neither authors the synthesis prose.

Chairman selection is pure (`src/scripts/ai_council/chairman.ts:42-86`), driven
by `chairman.mode ∈ {host, member, auto}` defaulting to `host`
(`src/scripts/ai_council/config.ts:1078`). `host` → `{member: null, annotation: 'Chairman: host'}`
(`chairman.ts:48-50`); `member` → the named member only if enabled (`:52-58`)
**and it did not deliberate this session** (`:59-65`); `auto` → the first
non-deliberating enabled candidate in config order, with a strictly-higher
optional `members.<name>.tier` as tie-break (`:70-85`), an empty pool falling
back to annotated host (`:71-76`). Candidates are enabled `members` entries in
config-object order (`src/scripts/council_cli.ts:1360-1369`), and "deliberated"
is derived from responses with no error and non-empty text (`:1370-1372`).
`mode: member` naming a missing or disabled member fails **closed at config
load** (`src/scripts/ai_council/config.ts:1092-1109`). A selected member with no
constructed client degrades to host with an annotation
(`src/scripts/council_cli.ts:1377-1385`). A per-invocation
`--chairman host|auto|member:NAME` override is parsed
(`src/scripts/ai_council/blind_review.ts:182-197`) and applied as a pure config
override (`src/scripts/council_cli.ts:2429-2432`).

**What the chairman sees:** only responses with no error and non-empty text
(`src/scripts/council_cli.ts:1395`), **blinded by default** because
`blind_chairman` defaults to `true` (`src/scripts/council_cli.ts:3551`), which
routes the transcript through `build_blind_labels` into `## Response-A/B/…`
blocks (`src/scripts/ai_council/blind_review.ts:60-71`,
`src/scripts/ai_council/consensus.ts:487-508`). With `--no-blind-chairman` the
transcript carries attributed `## <provider> - <model>` headers
(`src/scripts/council_cli.ts:1401-1405`). The chairman never sees the consensus
output or the host's reasoning — only the member transcript plus the template.

The synthesis prompt is composed at `src/scripts/council_cli.ts:1409-1415`. The
blind wrapper reads "You are the council CHAIRMAN. You did not deliberate.
Author the synthesis of the anonymized member positions below (labels A–E). Do
not guess identities." (`src/scripts/council_cli.ts:1410-1412`); the attributed
wrapper substitutes "…the attributed member positions below, following the
template." (`:1413-1415`). The template is `synthesis_template(question.mode)`
(`src/scripts/ai_council/prompts.ts:424-443`), resolving to `DEFAULT_SYNTHESIS`
— Agreement / Clashes / Blind spots / Recommendation / Kill criteria / Concrete
next step (`src/scripts/ai_council/prompts.ts:246-275`) — or `PR_SYNTHESIS`
(`:277-302`), `ANALYSIS_SYNTHESIS` (`:304-335`), or `CREATIVE_SYNTHESIS` for the
`design`/`optimize` lenses (`:342-361`). `--chairman-fields` appends
`## Collective blind spot` + `## One-line verdict`
(`src/scripts/council_cli.ts:1406-1408`), default off (`:3553`).

Final block order, joined by `\n\n---\n\n`
(`src/scripts/ai_council/orchestrator.ts:2038`): consensus block when non-empty
(`:1915-1922`) → one block per member response with a meta line and
`*ERROR:* \`…\`` for failures (`:1923-1932`, meta at
`src/scripts/ai_council/response_render.ts:31-66`, which also stamps
`transport: api (fell back from cli…)` at `:54-64`) → peer-review block
(`:1933-1935`) → Vote Tally when `stance_tally` is on, plus a
`> **Verdict/tally mismatch:** …` line rather than a throw (`:1984-2012`) →
`## Convergence / Divergence` (`:2014`) → Handoff when non-empty (`:2020-2022`)
→ `### De-anonymization map` (`:2023-2027`) → the `**Quorum:**` line with solo
and DEGRADED caveats (`:2031-2033`, format `:2063`, caveats
`src/scripts/ai_council/quorum.ts:155-165`) → `### Absent Members`
(`:2034-2037`). A chairman-authored text **replaces** the template body prefixed
with the annotation, never silently substituted (`:1976-1983`); a chairman that
ran but produced nothing still prefixes its annotation (`:1981-1982`).

**Synthesis can be skipped in three distinct senses.** The chairman *model call*
is skipped whenever `chairman.mode === 'host'`, the default
(`src/scripts/council_cli.ts:1354-1358`), and whenever selection yields no
member (`:1374-1376`); a chairman call that errors or returns empty degrades to
the host path with `Chairman: <name> (FAILED - host fallback)` (`:1435-1442`).
The synthesis *section* is never omitted
(`src/scripts/ai_council/orchestrator.ts:2014`), but `prose_synthesis: true`
empties the template so the body becomes the bare placeholder (`:1937-1938`,
`:1970-1975`). And the verdict-discipline check is **not wired to the emit
path**: `assert_synthesis_sections` has zero production call sites and its own
docstring says so, because wiring it would throw on every templated render
(`src/scripts/ai_council/prompts.ts:473-506`). `parse_verdict_line` is
deliberately case-SENSITIVE so ordinary prose beginning `Verdict:` is not read
as a machine verdict (`src/scripts/ai_council/prompts.ts:514-521`).

---

## 12. Transport / qualification / quorum resolution

**Vocabulary.** `Transport = 'api' | 'manual' | 'cli'`
(`src/scripts/ai_council/transport_resolver.ts:54`); accepted *mode* values add
the resolver-only `auto` (`:68-73`, mirrored at
`src/scripts/ai_council/modes.ts:60`). `manual` is explicitly excluded from the
`auto` chain because it is always "available" and would make `auto` mean "ask
the human to copy-paste"
(`src/scripts/ai_council/transport_resolver.ts:17-20`). Client-side:
`ExternalAIClient.transport = 'api'` (`src/scripts/ai_council/clients.ts:406`),
`CliClient` overrides to `'cli'` with `billable = false` (`:1213-1215`),
`ManualClient` to `'manual'` (`:2382-2384`). Single dispatch entry points are
the abstract `ask()` (`:414-418`) and the cache-aware `ask_split()` (`:429-439`),
reached through `callMember` (`src/scripts/ai_council/response_render.ts:74-98`).

**Precedence — two composed layers, joined by `resolveMemberTransport`**
(`src/scripts/ai_council/transport_resolver.ts:273-292`):

1. **Which mode was asked for** — `resolve_mode`, first non-empty wins:
   invocation flag (`src/scripts/ai_council/modes.ts:189-195`) → per-member
   `mode` (`:197-208`) → global `ai_council.mode` or `defaults.mode`
   (`:210-213`) → built-in fallback `manual` (`:215`, constant `:67`). Any
   non-empty layer carrying an invalid value throws `InvalidModeError`
   (`:93-104`).
2. **What `auto` becomes on this machine** — `resolveTransport`
   (`src/scripts/ai_council/transport_resolver.ts:158-235`): `manual` returns
   `manual` with `makesProviderCall: false` (`:164-176`); `api`/`cli` pass
   through verbatim (`:178-188`); an unrecognised mode is unavailable with a
   validation reason (`:190-197`). The `auto` chain is exactly two rungs —
   **binary resolves AND a cli auth source is present → `cli`** (`:200-214`),
   **else a key resolves → `api`** (`:216-227`), **else unavailable** with a
   three-way reason and a static `no_binary`/`no_auth` classification
   (`:229-234,320-347`).

**Billing is never derived from the chosen transport** — it comes from
`classifyBilling(provider, authSource)`
(`src/scripts/ai_council/transport_resolver.ts:160-162`, rationale `:22-37`),
with `strongestAuth` preferring cli-subscription → cli-api-key → key-file →
env-key (`src/scripts/_lib/environment_detector.ts:451-466`).

**Qualification is a seven-rung ordered ladder**
(`src/scripts/ai_council/qualification.ts:75-92`) reduced to one of four
verdicts — `available | degraded | unavailable | unknown` (`:57`) — by
`qualifyMember` (`:357-384`), where the verdict is the **weakest** claim the
evidence supports and `unknown` outranks `degraded` (`:157-172`); a `fail`
short-circuits the remaining rungs to `skipped` (`:363-381`). `installed`:
`absentReason === 'no_binary'` → fail (`:213-224`). `authenticated`:
`absentReason === 'no_auth'` → fail (`:226-234`). `transport_semantics`:
`transport === null` → fail, `manual` → **degraded**, because it performs no
provider call and cannot contribute a model's answer (`:236-256`).
`model_identifier`: blank model id or a stored `model_unservable` probe → fail
(`:271-294`). `live_probe`, the load-bearing rung: **no recorded exchange ever →
`unknown`** (`:305-313`); a non-`ok` outcome → `degraded` only for
`quota_exhausted`/`timeout`/`server_error`, else `fail` (`:314-321`, impaired
set `:202-206`, with `other` deliberately excluded `:181-201`); an `ok` record
older than the window → `unknown` (`:322-334`). `system_prompt_path` and
`tool_isolation` are implemented but **have no production caller** and always
report `skipped` in a real run — stated as an honest coverage gap in the module
header (`:37-45,258-269,296-303`).

**What disqualifies a seat from attendance:** `unavailable` and `unknown` are
not countable; `available` and `degraded` are
(`src/scripts/ai_council/qualification.ts:398-400`). Critically, an unqualified
seat does **not** shrink `n` — that would lower the `ceil(n/2)` threshold
(`:386-397,408-415`). The seam applying it is `qualifySeat` / `attendanceGate`
(`src/scripts/ai_council/qualification_wiring.ts:68-85,107-123`), emitting one
roster-wide notice rather than one per seat (`:94-106`) and recording both
`unavailable` and `unknown` under the closed enum value `unavailable`
(`:125-135`). Qualification runs only when the caller injects a probe store; an
empty out-param means **not evaluated**, never "all seats qualified" (`:20-34`).

**Probe cache and TTL.** `agents/runtime/state/council-probes.json`,
repo-relative, gitignored, never committed
(`src/scripts/ai_council/probe_store.ts:62-63,18-25`). TTL is **30 days**:
`DEFAULT_PROBE_MAX_AGE_DAYS = 30`
(`src/scripts/ai_council/qualification.ts:155`), overridable per input
(`:141-142`), applied at `:322-334`. Nothing in the module probes — a council
run that got a non-empty answer *is* the observation
(`src/scripts/ai_council/probe_store.ts:6-16`). Reads are tolerant: missing,
unparseable or wrong-schema yields the empty store (`:102-121`), and rows are
validated against a closed outcome set rather than cast (`:77-87,143-146`).
Writes are best-effort and silently swallowed (`:175-191`), suppressed entirely
under `AGENT_CONFIG_NO_EVENTS_LOG` (`:60,176`).

**Quorum.** Threshold `'majority'` → `ceil(total / 2)`, a **simple** majority,
so 1-of-2 concludes — deliberately not `floor(n/2)+1`
(`src/scripts/ai_council/quorum.ts:70-83`, rationale `:13-19`); `total === 0` →
0 (`:77-78`); a fixed integer is clamped to `[1, total]` (`:82`). Verdict is
`present >= threshold ? 'concluded' : 'inconclusive'`, with `present` clamped to
`[0, total]` so a miscount cannot manufacture a conclusion (`:92-104`).
**Below quorum the code sets a status string and nothing else** — it renders
`INCONCLUSIVE — release gate holds`
(`src/scripts/ai_council/orchestrator.ts:2051`,
`src/scripts/ai_council/quorum_wiring.ts:277`), and the module states plainly
that nothing in the tree branches on `QuorumStatus`, the only other reader being
the CLI's deserialiser (`src/scripts/ai_council/quorum.ts:216-221`; that reader
is `src/scripts/council_cli.ts:1597`). Presence is a **non-empty** answer, not
merely the absence of an error, and a `parse_failed` findings answer moves out
of `present` into an `unparsed` bucket
(`src/scripts/ai_council/quorum_wiring.ts:161-219`, `withUnparsed` at
`src/scripts/ai_council/quorum.ts:122-135`). `quorum_min_present` (default 2,
`SOLO_FLOOR_MIN_PRESENT`, `:205`) is a **counterfactual only** —
`wouldSoloFloorHold` records whether a floor would have held and no caller
branches on it (`:207-272`, especially `:207-212`).

**Mid-flight fallback.** A failed cli call may fall through to the `api` rung
**at most once per provider per invocation**
(`src/scripts/ai_council/transport_resolver.ts:564-586`), and only for failure
classes where the CLI provably never reached the provider: `binary_missing`,
`auth_rejected`, `cli_unsupported`, `model_unservable` (`:376-385`). `timeout`
and `server_error` are ineligible under **every** policy, because a
half-completed call must never be paid twice (`:518-531`). `quota_exhausted` is
eligible only under the opt-in `fallback.api_on_quota` (`:519-531,436-439`),
whose three postures are `false | true | 'ask'` (`:406-415`); under `'ask'`
without a run-scoped grant the seat is **parked** — a third state that is
neither switched to metered billing nor lost
(`src/scripts/ai_council/mid_flight_fallback.ts:86-101,174-186`), with the park
branch deliberately running *before* the eligibility test so it does not spend a
ledger attempt (`:168-173`). `establishTwin` classifies, checks policy, claims
the ledger slot, then lazily constructs the twin; a provider with no
constructible api rung emits `no_twin` and returns `null` (`:161-201`), and an
unconsumed claim is released so the seat can re-decide
(`src/scripts/ai_council/transport_resolver.ts:588-606`). Once established the
provider is substituted for the remainder of the invocation via a twin map, so a
dead binary is never spawned twice
(`src/scripts/ai_council/mid_flight_fallback.ts:122-138`). Every fallen-back
response is stamped `fallback_from` / `fallback_reason` /
`fallback_original_error`, plus `fallback_sticky` on reuse (`:225-237`), and the
stamp surfaces in the rendered meta line
(`src/scripts/ai_council/response_render.ts:51-64`).

**Airgap mode forbids nothing.** `airgap.ts` is a DNS-only detection helper, not
an enforcement mode: it resolves three provider hosts with a 1.0 s default
timeout (`src/scripts/ai_council/airgap.ts:41-47`), a single reachable host
disproves airgap, and an empty host list counts as airgapped by definition
(`:103-125`). Its outputs are a banner string
(`airgapped environment detected — defaulting to mode: api`, `:54-59`) and
`recommended_member_mode()` returning `'api'` when airgapped
(`:127-137`). Nothing in it blocks a transport, refuses a call, or gates spend —
the header says the *installer* is expected to seed `defaults.member_mode: api`
(`:11-13`).

**shadow_dispatch vs solo_dispatch.** `solo_dispatch` routes a low-impact
decision to one member instead of the full council: `select_solo_member` walks
`routing.solo_member_fallback_chain` in order, skipping missing or disabled
members, consulting an auth cache and lazily probing on a miss
(`src/scripts/ai_council/solo_dispatch.ts:125-165`), with auth verdicts cached
on a 15-minute TTL (`:29,281`). It is side-effect-free by design and a `null`
return is the caller's signal to fall back to the full council with a WARN,
**never** to fail the decision (`:1-14`). `AGENT_CONFIG_FORCE_FULL_COUNCIL=1`
short-circuits the chain to `null`, and only the literal `1` counts
(`:34,88-100,131-133`). `dispatch_with_escalation` (`:231`) re-runs the full
council when a confidence gate rejects the solo answer. `shadow_dispatch`
**measures** that shortcut rather than performing it: under
`low_impact.dispatch: single`, a Bernoulli-sampled subset is also run through
the full council so solo↔council disagreement can be counted
(`src/scripts/ai_council/shadow_dispatch.ts:1-16`, sampler `:53-58`). Rows land
in `agents/runtime/council/shadow-log.jsonl` (`:24`) under the same privacy
floor as the low-impact corpus, refused entries dropped rather than softened
(`:9-12`). SLO thresholds are `0.05` warn / `0.08` breach (`:26-27`), and the
module "emits data and an SLO banner, nothing else" — the flip back to `full` is
a user decision (`:13-15`).

### The no-spend probe a reviewer runs

```
agent-config council:status --json                    # consumer install
./scripts-run src/scripts/council_cli status --json   # in this repo
```

Executed in this pass: exit 0, `"configured":true`, config resolved to the
user-global `settings/.ai-council.yml` with `"provenance":"user-global"`, and
`"ignored_transport_keys":["defaults.mode"]` — live confirmation that a
spelled-out `defaults.mode` is parsed and discarded.

**Code establishing it makes no provider call.** The verb is registered as
`council:status · 'Is a council configured, and from which file — zero spend, no
inference.'` (`src/cli/registry.ts:123`). `cmd_status`
(`src/scripts/council_cli.ts:2231-2340`) does four kinds of work: resolve the
config path (`:2234`), `existsSync` + `load_council_config` (`:2235,2240-2246`),
read the gitignored probe store (`:2258`), and resolve transports purely
(`:2259-2261,2194-2207`). It exits 0 unconditionally on the JSON path (`:2305`),
and the header states the command reports state and does not gate
(`:2181-2182`). The one subprocess anywhere on the path is a local
`<binary> --version` under a hardened env inside the environment detector
(`src/scripts/_lib/environment_detector.ts:278-291`) — no HTTP client, no
provider SDK, no `fetch` — memoised per process (`:479-487`). Key access is a
file read only (`src/scripts/council_cli.ts:2215-2218`), and the
fallback-posture helper notes that `council:status` "is the one command that
must stay free of side effects"
(`src/scripts/_lib/council_fallback_posture.ts:11-13`).

---

## Doc-vs-code: `docs/contracts/ai-council-config.md`

The contract is **1398 lines** (`wc -l docs/contracts/ai-council-config.md`).
Checked claim-by-claim: File location, Top-level schema, Transport modes, `auto`
selection rule, Two defaults, Quorum, Graded degradation, Stance tally, Chairman
synthesis, Decision resolution, Low-impact council opt-in, Solo-member dispatch,
Confidence gate, Corpus pipeline, `model_downgrade`, `prompt_cache.ttl`,
`api_key_ref`, Precedence, Normative behaviour, Validation rules, Migration
footprint. The ranges named in § Not established were skimmed only.

**Twelve contradictions**, three families.

### Family A — the transport-key removal was not propagated

The contract states in four places that a pinned `defaults.mode` or a per-member
`mode:` still overrides `auto`. The loader ignores both and records them:
`src/scripts/ai_council/config.ts:1493-1496` (global) and `:1718-1721`
(per-member), confirmed live by `council:status --json` returning
`"ignored_transport_keys":["defaults.mode"]`.

| Doc claim | Doc cite | Verdict |
|---|---|---|
| § Normative behaviour: "Three first-class modes on the `mode:` axis"; a pinned mode on `defaults.mode` **or a per-member `mode:` still overrides** `auto` | `:1299-1313` | **contradicts** — and contradicts the doc's own `:148-164` and `:266-268` |
| § Precedence: four layers, and "the loader fills `defaults.mode` with `auto` **when the key is absent**" | `:1315-1319`, `:1276-1282` | **contradicts** — the fill is unconditional (`config.ts:1496`; the doc's own `:268` says "Unconditional"), and two of the four layers are unreachable from a config file |
| Validation rule 7: `defaults.mode` / per-member `mode` outside `{api, manual, cli, auto}` is rejected | `:1360-1361` | **contradicts** — never validated, only pushed to `ignored_transport_keys` |
| The solo-dispatch YAML example carries `defaults: mode: api` | `:1128-1129` | **contradicts** — teaches a key the doc's own `:148-164` calls dead |
| `defaults.member_mode` described as "a per-member fallback when a member doesn't set `mode`" | `:1111` | **stale description of a live default** — the default (`cli`) is correct (`config.ts:1500-1506`), the mechanism is not |

### Family B — two validation rules describe unreachable code

`effective_mode` is hard-set to `default_mode`, which is always `'auto'`
(`src/scripts/ai_council/config.ts:1700,1722,1496`), so both branches below are
dead.

| Doc claim | Doc cite | Verdict |
|---|---|---|
| Validation rule 4: `api_key_ref` missing **for an enabled member** is rejected (and `:297-303`: required for `xai`/`perplexity` in cli mode) | `:1353-1355` | **contradicts** — required only when `effective_mode === 'api'` (`config.ts:1753-1757`), which never holds; `api_key_ref` is effectively never required, and no per-provider check exists (only format validation at `:1759-1760`, `:2051-2077`) |
| Validation rule 8: `binary` set when the effective mode is **not `cli`** is an explicit error | `:1362-1363` | **contradicts twice** — `config.ts:1734-1741` permits `cli` **or** `auto`, and the branch is unreachable, so `binary` is accepted on every member. The doc states the correct permitted set at `:304-308` and `:187`, so this is also an internal inconsistency. The dead error message at `config.ts:1738-1739` still instructs the reader to "Set `mode: cli` … or `defaults.mode: cli`", both ignored keys |

### Family C — three copy-paste hazards, and one wrong marker literal

| Doc claim | Doc cite | Code cite | Verdict |
|---|---|---|---|
| The worked example places `fast_path:` at the **top level** of the file, and the prose calls it `ai_council.fast_path` | `:1037-1038`, `:1067` | `config.ts:1247-1253` reads `fast_path` off the **`decision_resolution`** dict, and every error message says `decision_resolution.fast_path.*` (`:1261,1267,1275,1283,1290`) | **contradicts** — a config pasted from this example silently resolves to the defaults, because `_getOr(d, 'fast_path', {})` defaults to `{}` and raises nothing. This is exactly the failure class the doc itself flags for `fallback` at `:253-256` |
| Resolved marker is `> Resolved via low-impact council (<member>): <answer>` | `:1093` | `low_impact.ts:433-441` emits `> Resolved via low-impact council fast-path: <verdict>.` | **contradicts, and the doc is the sole outlier** — the *rule* at `src/rules/fast-path-marker-visibility.md:38` matches the code byte-for-byte, and the rule is the surface that mandates the literal. The doc's split / aborted / unavailable markers at `:1089,1094-1095` do match |
| `participate_low_impact: true` on a disabled member "parses but is treated as `false` **with a one-line loader warning**" | `:1081-1083` | `config.ts:1803-1809` validates the bool and stores it verbatim (`:1903`); no downgrade, no warning | **contradicts (mechanism)** — the outcome holds only because selection filters on `enabled` at `low_impact.ts:201` |
| The classifier "lives in `scripts/ai_council/necessity.py`" | `:900` | The file is `necessity.ts`; no `.py` twins remain in the tree | **contradicts (stale path)**, and the same class recurs at `:1179`, `:1189`, `:1272`, `:1341`, `:1345`, and `:14-15` (which names four `.py` files) |
| **"The billable chairman dispatch (rendering the synthesis as one member call in `cmd_run`) is the remaining wiring step."** | `:818-820` | `council_cli.ts:1343-1450` dispatches it via `consult`, called from `cmd_run` at `:2724`, cost delta `:1297-1310`, persisted `:2793-2795` | **contradicts** — the dispatch is fully wired; the doc describes it as unbuilt |

### One incompleteness and one obligation with no enforcement

- `:473-476` lists the `AbsentReason`-to-`null` classes as "(`cli_unsupported`, `server_error`, `other`)"; the default branch at `transport_resolver.ts:549-562` also covers `model_unservable`, which the doc documents at `:543-547`. Short by one, not wrong.
- `:376-378` states that at a release gate an `inconclusive` quorum HOLDS the gate for a human. **Unverifiable as behaviour:** nothing branches on `QuorumStatus` (`src/scripts/ai_council/quorum.ts:216-221`; the only other reader is the deserialiser at `src/scripts/council_cli.ts:1597`). The doc is internally honest about this at `:398-400`; the two statements must not be read as one claim.

### Sections that agree — worth recording so this reads as a check, not a hunt

The file location and precedence (`:22-55` vs `config.ts:620,683-703` with
`void project_root` at `:687`), the `auto` two-rung chain (`:174-184`), the
mid-flight fallback rules and the sticky-substitution semantics
(`:194-217`), `cli_call_budget` at 50/day with `warn_at: 0.8` (`:90-91,314-320`),
`quorum` = `ceil(n/2)` (`:374-387`), `quorum_min_present` as shadow-only
(`:389-403`), the five impact classes and their locked-class Iron Law
(`:903-914,1118-1125`), `confidence_threshold: 0.6` (`:916-920`),
`second_model`'s provider restriction (`:930-954`), the fast-path caps
(`:1037-1041,1084-1085`), `model_downgrade` (`:1198-1205`), `prompt_cache.ttl`
(`:1230-1240`), and the three `necessity_classifier` defaults (`:125-128`) all
agree with the code. Two doc self-honesty notes are accurate as written:
`second_model`'s quota coupling is an obligation rather than an enforced link
(`:936-949`), and `decision_resolution.classes[*]` is read by no TypeScript path
(`:962-966`).

Two cosmetic items: `:161` writes the verb as `agent-config council status`
where the registered verb is `council:status` (`src/cli/registry.ts:123`); and
the frontmatter carries `keep-beta-until: 2026-08-12` (`:1-4`), stale by 17 days
as of this reading.

### One further doc-vs-tree contradiction, outside that file

`src/rules/low-impact-corpus-privacy-floor.md:56-57` names
`data/low-impact-decisions-seed.md` as "the upstream seed shipped with the
package", and its own trigger is `path_prefix: "data/low-impact-decisions-seed"`
(`:7`). No `data/` directory exists (`ls data/`). The consuming command names a
different path, `.agent-src.uncondensed/data/low-impact-decisions-seed.md`
(`src/domains/meta/memory/learn-low-impact/command.md:25,61,105`), and
`.agent-src.uncondensed/` does not exist either (`ls -d .agent-src.uncondensed`).
No seed ships at any of the named locations in this checkout, and no `.ts` file
carries a default for it
(`src/scripts/ai_council/learn_low_impact_preview.ts:268-271`).

---

## Not established

Every item here is a claim this pass could **not** pin. None of it is asserted
elsewhere in the file, and the reason is given so a later pass knows the cost of
closing it.

**Enforcement of the one-resolver invariant in CI.** `checkOneResolver` has zero
callers in `src/`; every reference outside its module is in
`tests/scripts/one_resolver_invariant.test.ts`. No gate script, Taskfile target,
or `src/config/gate-coverage.yml` row invokes it, so the invariant is enforced by
the vitest suite only. Whether that suite runs in remote CI was not traced —
establishing it means reading the workflow set, which this pass did not do.

**Whether the subagent-spawn-gates-council behaviour is intended.** The code is
unambiguous and the contract's *resolution order* matches it
(`auto-dispatch-classification.md:85-86`), while the same contract's Iron Law at
`:80-82` says the opposite. No record in either file resolves which is correct.

**Whether `route_decision`'s absence of callers is a regression or a library
surface.** No comment states either. `low_impact.ts:920` calls its own function
a "Fuzzy variant of `necessity.classify_impact_with_corpus`", which *suggests*
supersession — an inference, not established, and recorded as such.

**Shipped `decision_resolution` per-class values as constructed from config.**
`route_decision` takes the class map as a loosely-typed parameter to avoid a
config import cycle (`necessity.ts:863-879`), and with no production caller there
is no site that builds it from config, so no shipped per-class
`mode` / `confidence_threshold` pair could be cited from a construction site.
The loader's own defaults are cited in § 10 and are a different fact.

**Whether `blind_review.ts:66`'s hardcoded `persona_labels: null` is
deliberate.** No comment explains it, and the neutrality argument at
`docs/contracts/ai-council-config.md:619-623` cuts both ways — a blind review
might legitimately want the label stripped. No ADR or comment was found.

**Whether the `persona: ''` divergence at `src/scripts/council_cli.ts:913` is
reachable.** The CLI re-implements the advisor `persona` field with `?? ''`
rather than the loader's convention default, so on a path that bypasses
`_build_advisor` an enabled advisor with no explicit `persona` would resolve to
`''`. Establishing it needs an execution; this was a read-only pass, so the code
divergence is reported and the failure is not.

**Whether the documented `on_overrun` prompt is ever presented.** The callback
has no producer in the tree, so whether an agent following
`cost-and-redaction.md:76-98` actually emits it is unobservable from code. The
code path (short-circuit) is established; the lived behaviour is not.

**Whether `council:replay`, `council:debate` and `council:shadow-report` are
reachable as `agent-config` verbs.** They are `council_cli` subcommands
(`src/scripts/council_cli.ts:3502`) and absent from `src/cli/registry.ts:120-126`.
Whether another dispatcher layer exposes them was not traced; the reachable form
is `./scripts-run src/scripts/council_cli <sub>`.

**Whether any caller invokes `detect_airgap` on a live council path.** The
module's own code contains no refusal path
(`src/scripts/ai_council/airgap.ts:41-137`), so "airgap forbids nothing" is
established *for that module*. Whether anything consumes it was not established;
confirming a negative across the tree needs a wider sweep than this pass ran.

**Whether `agents/decisions/low-impact-decisions.md` is git-tracked.** It exists
on disk and sits outside every gitignore pattern read, and `.gitignore:194-195`
names `agents/decisions/` as the durable home — but "not ignored" is not the same
claim as "tracked", and this pass ran no git command.

**Whether a corpus seed ships in the published npm package.** All three declared
seed paths are absent from this checkout. Whether a build step materialises one
would need the packaging pipeline traced.

**Whether the `aborted (token cap)` literal was ever emitted.** The rule
specifies it (`src/rules/fast-path-marker-visibility.md:41`) and no code path
produces it — the only `_aborted_marker` call passes `'all members failed'`
(`src/scripts/ai_council/low_impact.ts:707`). Whether the rule documents a past
behaviour or an intent cannot be settled without history.

**Whether the events-log fixture's `ts` key was ever a real producer field.**
The drift is established (§ 9); its origin needs git history.

**Whether the corpus classifiers are reachable through a non-`src/` entry
point.** No caller exists in `src/`; `dist/mcp/server.mjs` (a bundle) and the MCP
tool surface were not audited.

**`docs/contracts/ai-council-config.md` § "Decision-replay schema".** Cited by
`src/scripts/ai_council/replay.ts:11-13` as the schema of record, and not opened
in this pass — so whether it matches the field set in § 9 or has drifted like the
fixture is unknown.

**Doc ranges `:493-765` and `:840-896`** (Handoff envelope, Persistent events
log, Advisor block, Advisor persona labels, Necessity-classifier body,
Decision-replay artefact, Debate enforcement gates, Critic protocol) were
skimmed for headings and default statements only, not checked claim-by-claim.
Four defaults inside them were spot-checked and agree —
`debate_gates.enabled` false (`config.ts:1118`), `decision_replay.enabled` and
`include_member_arguments` true (`:1031,1035`), `stance_tally.enabled` false
(`:1057`), `critic_protocol: legacy` (`:1149`). Everything else in those ranges
is **unverified, not verified-clean**.

**The exact Jaccard normalisation behind `NOVELTY_DUP_THRESHOLD = 0.8`.**
`jaccardSimilarity` lives in `src/scripts/_lib/text_similarity.ts`, imported at
`src/scripts/ai_council/debate_gates.ts:12` and not opened. The claim that 0.8 is
"the existing shared MERGE-level threshold" is that module's own comment,
unverified against the definition.

**Whether `<binary> --version` reaches the network.**
`src/scripts/_lib/environment_detector.ts:278-291` spawns it locally under a
hardened env; whether a given vendor CLI performs a network check inside its own
`--version` is a property of that binary, not of this tree. The § 12 claim is
scoped to "no provider API call is made by this code", which the absence of any
HTTP client on the `cmd_status` path establishes.

**Advisor test coverage counts.** `tests/scripts/ai_council/advisors.test.ts`
exists and was not read; no case count is asserted.

---

## Related published claims

Three entries in the claims ledger bear on the behaviour above and are cited
rather than restated, so this file does not become a second truth for them:

- `docs/CLAIMS.md:526` — the council aggregation was measured **steerable** against a refusal (steering margin 0.6667, outcome flipped), fixed in the same change, post-fix margin exactly 0. That fix is the quorum-denominator rule in § 6.
- `docs/CLAIMS.md:445-451` — `adversarial-council-finding-coverage` is a resolved **honest null**; the panel matched the single skeptic exactly, and the surface stays default-off permanently. Its note also records that a run via `council_cli run` was **rejected as a measurement artifact**, because that transport imposes multi-round peer-review and prose output.
- `docs/CLAIMS.md:382-385` — `council-vs-solo-baseline` is **pre-registered and unbacked**: whether full-council debate beats a single strong model on any decision subset has no measurement yet.
