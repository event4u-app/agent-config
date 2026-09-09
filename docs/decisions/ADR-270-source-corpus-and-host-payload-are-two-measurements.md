---
adr: 270
status: accepted
date: 2026-09-09
decision: source-corpus-and-host-payload-are-two-measurements-one-of-them-gated
supersedes: —
superseded_by: —
type: structural
reopen_policy: directional
protected_dimensions: governance
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E3
  basis:
    - src/scripts/check_preamble_payload_budget.ts
    - src/scripts/generate_host_cost_table.ts
    - src/scripts/_lib/host_projection_reach.ts
    - src/scripts/report_standing_payload_by_host.ts
    - agents/evidence/analysis/standing-payload-by-host-2026-09.md
    - tests/scripts/check_preamble_payload_budget.test.ts
review_trigger: >-
  Every material host has a deterministic, writer-derived payload measurement and
  an approved per-host budget. At that point the blocking governance may migrate
  from the source corpus to per-host budgets, and this record is reopened rather
  than assumed. Also reopened if the host reading is ever found to have changed a
  gated verdict, which the sabotage-proven test in
  `tests/scripts/check_preamble_payload_budget.test.ts` exists to prevent.
---

# ADR-270 — `source_corpus` and `host_payload` are two measurements, and only one of them is gated

## Status

Accepted 2026-09-09. Decided by an AI council convened under a written owner
delegation covering an autonomous roadmap-drain run. **2 of 2 seats present
(anthropic/claude-sonnet-4-5, openai/codex-default), converged on the same option
for this decision.** Subscription transport, `$0.0000` billed, two rounds with
peer review.

The same council was asked three linked questions. This record carries **only the
first**, which both seats classified as council-decidable. The other two were
classified **owner-reserved by both seats** and are recorded as open questions in
`agents/roadmaps/road-to-delivery-for-every-host.md` steps 4.2 and 4.4 — see
§ What this record deliberately does not decide.

## Context

`road-to-delivery-for-every-host` shipped a `delivery` projection mode for the
`claude-code` host. Measured on a clean consumer-shaped root:

| Tree | `eager-all` | `delivery` | verdict |
|---|---:|---:|---|
| `.claude/rules` | 99,598 tok | **24,166 tok** | −75.7 %, 114 files both sides |
| `.cursor/rules` | 121,242 tok | 121,242 tok | byte-identical |
| `.clinerules` | 121,242 tok | 121,242 tok | byte-identical |

Three steps and two acceptance criteria then stalled on one fact.
`check_preamble_payload_budget` **cannot be pointed at a host tree.** It had no
`--project-rules-dir` flag at all — the roadmap borrowed that name from the
sibling `preamble_byte_census`, which does have one — and its rules root is
hardcoded through `surfaceRoot('project-scope-rules')` to `dist/agent-src/rules`,
the projection **source**. Its only override parameter is `repoRoot`, which
changes which checkout is read and never which subtree.

So the gate read **138,200 tok before the flip and 138,200 after.** The mechanism
that halved a real host's standing payload was invisible to the gate that governs
standing payload.

**Three different policies had collapsed into one number** — this was the
openai seat's framing and it is the cleanest statement of the defect: the
source-corpus size, the host-loaded payload, and the roadmap's acceptance
criterion were all being read off the same figure, and changing one silently
amended the others.

## Decision

**The two quantities are named apart, measured separately, and only the source
corpus is gated.**

1. `check_preamble_payload_budget` gains `--host <id>` and, mutually exclusive
   with it, `--project-rules-dir <path>`. The host id resolves through
   `HOST_SURFACES` in `_lib/host_projection_reach.ts` — the committed constant
   `check_host_projection_reach` already walks. **Not a path map written into the
   gate**, which both seats required explicitly: a second list describing one
   boundary is the drift shape this repository has already paid for.
2. **The gated surface does not move.** The no-argument source measurement, the
   blocking step in `.github/workflows/standing-payload-delta.yml`, the
   `task ci` invocation, and the base-ref shrink-only ratchet all continue to
   measure `dist/agent-src/rules`. No existing `baseline_tokens`,
   `baseline_history` or `grace_ceiling_history` entry is reinterpreted.
3. **The host reading never changes the exit code.** It is an informational
   census. This is the load-bearing invariant of the whole decision and it has a
   sensitivity-proven test, not merely a passing one.
4. JSON output carries `measurement_scope`, `source_corpus` and `host_payload`
   as structurally separate fields. Until the two are named apart, every ceiling
   discussion risks comparing unlike quantities.
5. The per-host cost table is published from the reproducible reading — the
   `report_standing_payload_by_host` census, whose unit is the projection source
   minus the ADR-004 `type: manual` rules no per-tool tree receives, i.e. the
   **upper bound** a host loads on an unscoped, un-deduplicated install.
   `generate_host_cost_table` writes it into `docs/contracts/rule-router.md` and
   refuses when the census is missing, unparseable, unpinned, or disagreeing with
   the tree.

### Which reading answers which question

| Question | Reading | Gated |
|---|---|---|
| May this change ship? | source corpus, `dist/agent-src/rules` | **yes** |
| Did the ceiling rise in this change? | base-ref ratchet over the source | **yes** |
| What is the upper bound a host loads? | the pinned per-host census | no — published |
| What does *this* install load? | `--host <id>` on the gate | no — informational |

Conflating rows 3 and 4 is the error the `PARTIAL TREE` diagnostic exists to
stop, and it is not hypothetical: on the checkout where this landed the host
reading is **6,648 tok** for `claude-code` against the roadmap's 39,758, because
a maintainer checkout holds **13** rule files against **119** in the source.
User-scope dedup and workspace/pack scope both shrink a maintainer tree below
what a consumer receives, for reasons that have nothing to do with the projection
mode. A bare token total cannot tell a genuine saving from a tree that was never
fully written, and those two send a reader to completely different places — so
the file counts travel with the number and the reading says `PARTIAL TREE` when
the host tree is smaller than the source.

## What this record deliberately does not decide

Both seats classified two sibling questions as **owner-reserved**, and this
record does not route around that.

- **The rules bucket misses its 20,000-token limb by 4,166.** The roadmap's own
  text says *"closing it needs an owner call between two E2 clauses that
  conflict, not more engineering"*, and both seats read K9 the same way:
  its escalation clause permits **asking** the missing question, it does not
  authorise the council to rewrite the criterion. anthropic: *"the escape allows
  ASKING, not unilateral criterion revision."* openai: *"That confuses the
  prescribed escalation procedure with permission to choose the relaxed
  outcome."* Recorded as an open question at roadmap step 4.2, which stays `[ ]`.
- **Retiring the grace ceiling.** Both seats reserved the *date* dimension to the
  owner: moving `grace_end_date` is a substantive relaxation of ADR-264 in time
  even though the numeric ceiling does not rise. Recorded as an open question at
  roadmap step 4.4, which stays `[ ]`.

They split on the mechanism they would recommend if the owner delegated —
anthropic proposed a dual-track retirement (per-host ceilings **or** source
packaging, whichever completes first, with 2026-11-10 as a hard deadline);
openai proposed a one-time owner-approved date extension tied to completing
blocking per-host governance, and rejected relocating prose out of the counted
directory as *"accounting theater"* that would risk violating K9 in substance.
Both are in the roadmap step bodies; neither is executed here.

The one substantive disagreement worth carrying forward: anthropic's proposed
conditional-rule manifest (a `pre_tool_use` dispatcher that loads full rule
bodies on a trigger match) rests on a host capability **nobody has demonstrated**,
and openai noted that if it injects bodies through the governed hook, calling it
a new delivery mechanism does not necessarily escape K4's `rule-inject`
prohibition. Feasibility first, then the question.

## Consequences

- The saving is measurable for the first time. It was real before this change and
  unreportable by the gate that owns the subject.
- **Dual governance is now explicit and temporary by intention.** Two readings of
  one subject is a cost, accepted only because the alternative was to reinterpret
  every historical baseline. The `review_trigger` above names the exit: when
  every material host has a writer-derived measurement and an approved budget,
  blocking governance migrates to per-host and the source-corpus grace retires as
  part of that migration.
- A published number now has a gate behind it. `generate_host_cost_table --check`
  reds when the contract drifts from the census, and reds when the census drifts
  from the tree — the second of which caught a real five-byte staleness on its
  first run, against a census the roadmap's own `verify:` would have accepted.
- Nothing about consumption is claimed. Whether a host READS what it is handed is
  the axis `docs/enforcement-by-host.md` owns; a host with a rule tree it never
  loads looks identical in every table here.

## Evidence

**E3 — the decision rests on measurements taken and re-taken in this change, not
only on argument.**

| Claim | Evidence |
|---|---|
| The gate had no host-directed flag and a hardcoded rules root | `src/scripts/check_preamble_payload_budget.ts`, `surfaceRoot('project-scope-rules')` against `_lib/prefix_stable_surfaces.ts` |
| The source reading is unmoved by the flip: 138,474 tok, ceiling 138,490, green | `./scripts-run src/scripts/check_preamble_payload_budget --ceiling 138490` |
| The host reading on this checkout is 6,648 tok from 13 rule files against 119 | `./scripts-run src/scripts/check_preamble_payload_budget --host claude-code` |
| The host reading cannot turn an over-budget source green | `tests/scripts/check_preamble_payload_budget.test.ts`, *"a host tree far SMALLER than the source does not make the gate pass"* |
| That test is SENSITIVE, not merely passing | Routing the host total into `verdict.withinBudget` and `decision.ok` turns it RED (1 failed / 31 passed); reverting restores 32 passed. Recorded in the test's own comment. |
| Every ambiguous invocation is exit 2 | five cases pinned: both flags, `--host` with no value, `--host` swallowing the next flag, `--project-rules-dir` with no value, unknown host |
| The census disagreed with the tree by 5 bytes across 4 host rows | `generate_host_cost_table` first run, before re-emitting the census at `b6af20db` |

**What the evidence does not establish**, named rather than implied:

- **That the 24,166 / 39,758 consumer figures reproduce here.** They do not, and
  cannot: this is a maintainer checkout. Those numbers come from the roadmap's
  clean consumer-shaped measurement, and `--project-rules-dir` exists so a reader
  can reproduce them against such a root rather than trusting this one.
- **That the sibling "byte-identical" test is sensitive.** It is not, and the
  test file says so: it compares `evaluate()` either side of a `main()` call, and
  `evaluate()` survives any sabotage inside `main`. The first sabotage probe left
  all 32 tests green, which is exactly why a second, faithful probe was run
  before the sensitivity claim was made.
- **That per-host budgets are the right long-term governance.** That is the
  reopen condition, not a finding.

## References

- `agents/roadmaps/road-to-delivery-for-every-host.md` — steps 4.2, 4.4, 7.2
- `docs/decisions/ADR-264-standing-payload-grace-ceiling-may-not-rise.md`
- `docs/decisions/ADR-267-delivery-default-for-claude-code.md`
- `docs/contracts/rule-router.md` — where the generated table lands
- `docs/contracts/prefix-stable-surfaces.md` — the source-side surface registry
- `agents/evidence/analysis/standing-payload-by-host-2026-09.md` — the census
