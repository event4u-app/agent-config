# Inbox round `inbox-2026-10-b` — disposition

> **Source:** `agents/tmp.old/inbox-2026-10-b/` (one topic, `s01`). Analysed
> 2026-10-01 by `/analyze:inbox` against `9bc8cd4`; the supplied plans were drafted at
> `eb2cc9ea`, 218 commits earlier. External packages are named by class only: a
> code-graph tool, an orchestration-and-memory platform, a curated host-config
> collection, a UI/UX skill bundle. Their identities live only in the round's encrypted
> intake note.

## What arrived

One topic folder holding an owner chat (2,372 lines, 14 turn separators, 5 user turns),
eight supplied roadmap files from a first author, a 490-line consolidating master and two
analyses from a second author, two annexes, one parked file, and `old/` with twenty earlier
numbered plans of the second author plus seven earlier copies of the first author's files.
It is the second arrival of this subject: `inbox-2026-09-ab` topic `t06` carried the first
draft of the same programme and landed four of its lanes.

## Triage table

| file | genre | drafted-against | recurrence | lineage | disposition |
|---|---|---|---|---|---|
| `chat.txt` | transcript | 2026-09-29 | second arrival (`inbox-2026-09-ab/t06`) | n/a | primary demand source, walked turn by turn |
| `road-to-leading-every-row.md` | feature-spec | `eb2cc9ea` | second arrival | declares P1+P2, complete | adopted, corrected |
| `road-to-a-graph-that-feeds-the-gate.md` | feature-spec | `eb2cc9ea` | first-seen | n/a | adopted, corrected |
| `road-to-touched-files-that-pass-their-own-tools.md` | feature-spec | `eb2cc9ea` | first-seen | n/a | adopted, corrected |
| `road-to-stacks-beyond-php.md` | feature-spec | `eb2cc9ea` | first-seen | n/a | adopted, corrected |
| `road-to-learning-you-can-see.md` | feature-spec | `eb2cc9ea` | first-seen | n/a | adopted, corrected |
| `road-to-a-tree-that-keeps-its-neighbours.md` | feature-spec | `eb2cc9ea` | first-seen | n/a | adopted, corrected + final-turn additions |
| `road-to-neighbours-that-pull-their-weight.md` | feature-spec | `eb2cc9ea` | first-seen | n/a | adopted, corrected + final-turn additions |
| `road-to-a-federated-control-plane-that-leads-every-row.md` | feature-spec (consolidation) | "after PR #2087" | first-seen | consumes the first author's set | no file; new items folded |
| `three-pass-deep-analysis-final.md` | external-review | 2026-09-29 | first-seen | n/a | read; no file |
| `disposition-matrix-final.md` | external-review | 2026-09-29 | first-seen | maps `old/10-19` | read; disagreements recorded below |
| `ANNEX-NOT-FOR-REPO.md` | scratch-note (codename map) | — | — | n/a | read for context, never quoted |
| `ANNEX-nicht-ins-repo.md` | scratch-note (codename map + loop log) | — | — | n/a | read for context, never quoted |
| `later/road-to-federation-behind-adr-278.md` | feature-spec | `eb2cc9ea` | first-seen | n/a | adopted as parked, corrected |
| `old/road-to-a-graph-that-feeds-the-gate.md` | revision | `eb2cc9ea` | — | identical to top level | discharged by identity |
| `old/road-to-touched-files-that-pass-their-own-tools.md` | revision | `eb2cc9ea` | — | identical | discharged by identity |
| `old/road-to-stacks-beyond-php.md` | revision | `eb2cc9ea` | — | identical | discharged by identity |
| `old/road-to-learning-you-can-see.md` | revision | `eb2cc9ea` | — | identical | discharged by identity |
| `old/road-to-leading-every-row.md` | revision | `eb2cc9ea` | — | earlier member | diffed, below |
| `old/road-to-a-tree-that-keeps-its-neighbours.md` | revision | `eb2cc9ea` | — | earlier member | diffed, below |
| `old/road-to-neighbours-that-pull-their-weight.md` | revision | `eb2cc9ea` | — | earlier member | diffed, below |
| `old/ANNEX-nicht-ins-repo.md` | scratch-note | — | — | earlier member | context only |
| `old/00-*` master | feature-spec | "after PR #2087" | — | superseded by the second author's master | declined |
| `old/01-*` outcome benchmark | feature-spec | same | — | — | folded into `stubs/road-to-assurance-benchmark.md` |
| `old/02-*` session orchestration plane | feature-spec | same | substrate stub, 13th arrival | — | killed K18 |
| `old/03-*` memory that earns recall | feature-spec | same | — | — | killed K19 (bestand) |
| `old/04-*` intelligence → decision | feature-spec | same | — | — | declined (bestand / parked) |
| `old/05-*` adaptive routing | feature-spec | same | — | — | killed K20 |
| `old/06-*` cross-host conformance | feature-spec | same | — | — | killed K22; neighbour-survival fixture folded |
| `old/07-*` causal self-improvement | feature-spec | same | — | — | killed K21 |
| `old/08-*` three-pass analysis v1 | external-review | same | — | superseded | declined |
| `old/09-*` gap matrix | external-review | same | — | — | declined (identities only) |
| `old/10-*` capability federation | feature-spec | same | — | — | parked behind ADR-278 |
| `old/11-*` provider manifest | feature-spec | same | — | — | killed K27 |
| `old/12-*` external content compiler | feature-spec | same | — | — | killed K28; labels folded |
| `old/13-*` policy arbitration | feature-spec | same | — | — | killed K26; precedence folded |
| `old/14-*` external runtime broker | feature-spec | same | — | — | killed K17 |
| `old/15-*` intelligence provider broker | feature-spec | same | — | — | killed K23 |
| `old/16-*` provider trust | feature-spec | same | — | — | killed K24 (remote auto-use) |
| `old/17-*` provider routing benchmark | feature-spec | same | — | — | parked file Phase 3 |
| `old/18-*` provider profiles | scratch-note | same | — | — | declined (identities only) |
| `old/19-*` federation deep analysis | external-review | same | — | superseded | declined |

`intake.md` (round root) is the encrypted source record and was not opened.

## Revision-set diffs

- **`road-to-leading-every-row`, old → new:** no heading, step or blocker dropped. Added
  K17–K26, blocker b8, two table rows and the two-parent provenance. The "five owner
  questions" in the Goal never matched the eight blockers in either member; corrected.
- **`road-to-a-tree-that-keeps-its-neighbours`, old → new:** no drop. The old double-gate
  keyed on a `host_lowering.yaml` blocking flag; the new one keys on `effect:` (adjudicated,
  its D4).
- **`road-to-neighbours-that-pull-their-weight`, old → new:** no drop. A band headed by
  "safety floors and kernel" was replaced by "extends the four authority bands"
  (adjudicated, its D5).
- **Four further lanes:** old and new members are byte-identical.
- **Second author `old/00-19` → master:** the master supersedes the set; the disposition
  matrix covers `10-19`. Disagreements with it: `01`, `02`, `03`, `04`, `05`, `07` are
  marked KEEP there and are bestand, parked or killed here (rows above), because each
  plans something the tree already holds or has decided against.

## Verification — what changed since the drafting SHA

Of 211 claims checked at `9bc8cd4`, the load-bearing reversals were:

- **Overtaken:** both verification checks now share one classifier; detector C reads run
  records and `verification_runs[]` exists on the verify record (`road-to-a-stop-that-holds`
  steps 1.2, 1.3 closed); `road-to-hooks-on-every-host` is archived; the
  `stop_hook_active` path already writes a shadow row; the substring match the first chat
  turn reported is exact now (`directives/ui/apply.ts:298`); `host_lowering.yaml` has 1 of 9
  `verified:` rows null, not 7 of 8.
- **Never true at the drafting SHA either:** the code-graph key deletion contradicts
  `docs/contracts/settings-classes.md:623`; the parked graph lane's Phase 3 is not the
  detector-F feeder, so the supplied carve-out blocker had nothing to carve; `detect_stack`
  can never return python or go; foreign edges would be ACCEPTED by the denylist filter;
  the `.mdc` emitter writes no ownership tag; seven call sites write hook arrays, not
  thirteen; the resolver lists no formatter and has no cost field; the sidecar has no
  `promotable` or `decaying` state; MCP telemetry cannot hold an outbound invocation record.
- **Newly found:** `docs/CLAIMS.md:287-292` (`surgical-uninstall`, backed) contradicts the
  install path; the ranker's first-wins dedupe hides a same-named second skill; the
  maintainer intake has never held a learning signal; the roadmap-receiver loop's regex
  stops at a digit.

## Reproduction

Selected: verify lines carrying an asserted outcome that runs before the work exists.
Ceiling not reached on any file.

| verdict | count | examples |
|---|---:|---|
| reproduced | 6 | receiver absent; `npx` block at `README.md:171`; no `format|prettier|typecheck` in the manifest; `effect:` count 0; code-graph key read by no code; subagent ledger verdict distribution |
| diverged | 7 | receiver loop regex; commit-mix figures; learning-flag line and hook path; mtime staleness under `git stash`; two serialisation steps against work that already landed; the archived host-hooks lane |
| unexecutable | 9 | `measure_release_mix --since`; `description_route_check --root`; `src/scripts/doctor`; `tests/scripts/json_pointers`; `cli query --json`; `cli node`; `tests/server/settings`; a Laravel payload fixture; `memory:learn --status` states |
| out-of-bound | 1 | turning on the learning flag in the maintainer settings (writes outside the tree bound) |
| not-attempted | 212 | 49 lane steps whose verify targets work not yet built; 163 master and bundle steps dispositioned by class (duplicate / bestand / collision) |

## Point ledger

```
claims       211 extracted → 159 still-true / 13 already-fixed / 31 never-true / 8 unverifiable
instructions 235 extracted → 6 reproduced / 7 diverged / 9 unexecutable / 1 out-of-bound / 212 not-attempted
demands       33 extracted → 22 adopted / 4 already-satisfied / 5 declined / 2 owner-decision
```

The claim-to-demand ratio is 6.4 : 1. It points the inverted way for a source set with a
transcript, and the reason is visible: only 5 of the chat's 14 turns are the owner's; the
other nine are two assistants' analyses, which carry claims, not wants.

### Demands

| id | turn | demand | disposition | where |
|---|---|---|---|---|
| U1-1 | 1 | deep analysis of what closes the gaps | adopted | this file; every lane Goal |
| U1-2 | 1 | build a plan | adopted | `road-to-leading-every-row` |
| U1-3 | 1 | refine it three times | adopted | three-pass contract below |
| U1-4 | 1 | roadmaps a local agent can execute | adopted | eight roadmaps |
| U2-1 | 2 (asked twice) | keep native capability — constraint | adopted | programme Goal (outcome parity), K31 |
| U2-2 | 2 | integrate and orchestrate installed neighbours | adopted | both neighbour lanes |
| U2-3 | 2 | do what they do and better — constraint | adopted | programme row table and Goal |
| U2-4 | 2 | use evolving neighbours directly | adopted (census, foreign graph) / b8 (invocation) | tree lane Phase 3, parked file |
| U2-5 | 2 | prevent overlaps and rules cancelling each other | adopted | pull lane 1.2, 2.1–2.3; tree 2.3 |
| U2-6 | 2 | extend the plan in detail | adopted | neighbour lanes |
| U3-1 | 3 | deep analysis with everything known, three loops | adopted | three-pass contract below |
| U4-1 | 4 | guarantee neighbours loaded first cannot ignore us | declined | the host owns load and context order; no package can guarantee it |
| U4-2 | 4 | no silent bypass of this suite — constraint | adopted | programme Goal limit + Risk 5; tree 2.4, 2.5; pull 2.3 |
| A-1 | assistant | a separate effect-ledger lane | declined | K33: no host exposes foreign hook execution |
| A-2 | assistant | environment states controlled / coordinated / degraded / uncontrolled | adopted | tree 2.5 |
| A-3 | assistant | orchestrate only what is observable; others are ambient | adopted | pull lane Goal |
| A-4 | assistant | a census at every session start | declined | a per-session filesystem sweep on every start buys nothing a doctor census does not, at a cost every session pays |
| A-5 | assistant | hook provenance | adopted | tree 2.2 |
| A-6 | assistant | this suite re-verifies completion itself | already-satisfied | `src/scripts/before_complete_hook.ts:180`, detector C reads run records |
| A-7 | assistant | one owner per mutating effect | adopted | tree 2.3, parked 2.3 |
| A-8 | assistant | post-hoc reconciliation | already-satisfied | the stop gate reads recorded runs, `hooks/turn_end_gate_hook.ts:843-920` |
| A-9 | assistant | non-negotiables as effects, not rules | adopted | pull 2.3 |
| A-10 | assistant | liveness and settings-takeover lines | adopted | tree 2.4 |
| A-11 | assistant | double-gate says "both denies apply" | adopted | tree 2.3 |
| A-12 | assistant | disable a neighbour's overlapping hooks granularly | declined | writing a neighbour's configuration is the Class C write K15 already refuses |
| A-13 | assistant | outcome parity, not feature parity | adopted | K31 |
| A-14 | assistant | MCP protocol capability discovery | owner-decision | K34 → b8 |
| A-15 | assistant | an outcome benchmark as P0 | adopted | folded into `stubs/road-to-assurance-benchmark.md` |
| A-16 | assistant | no new research wave; consolidate into tracks | adopted | one programme, 34 kills |
| A-17 | assistant | drain the previous round's consumer-effect roadmaps | already-satisfied | active estate fell from 30 to 12 |
| A-18 | assistant | land the classifier and the stop gate together | already-satisfied | both landed (`archive/road-to-one-verification-classifier.md`) |
| A-19 | assistant | four owner questions of the previous round's roadmaps | declined | they live in the roadmaps that carry them, e.g. `road-to-an-obligation-row-that-names-its-writer` |
| A-20 | assistant | name the two benchmark repositories | owner-decision | b4 |

`no-demand`: the chat's first two turns answer an owner question not present in the file
(whether the previous round's PR improves the suite); their claims are in the ledger, and
every roadmap they rate is since executed or archived.

## Coverage ledger

```
batch     this run covers topic [s01] of 1; deferred: none (round ~400 KB, one topic)
sources   43 files in 3 source sets (top level, later/, old/); 3 revision sets diffed, 4 identical pairs; 1 transcript
anchors   990 counted by inbox_source_census → rows produced for top level and later/;
          old/ anchors discharged by class line (identical copies, diffed revisions, per-file rows); unaccounted 0 by that grouping
passes    pass 1: 5 parallel verifier slices (claims); pass 2: +9 rows (the final user turn's
          five protection layers and three additions, the CLAIMS contradiction, first-wins
          dedupe, signal supply); pass 3: 1 adopted-not-found (A-3, the
          ambient-actor principle) — repaired by writing it into the pull lane's Goal
topics    1 topic → 7 active roadmaps + 1 parked roadmap + 4 stub edits + this file
```

Pass 2 converged at the second extraction pass: re-reading the transcript against the
ledger after pass 1 added the nine rows above, and a third read added none.

## Owner decisions required

One block, carried in `road-to-leading-every-row` § Blockers, plus the held objects that
crossed a third arrival:

- **Subagent return gate** (`stubs/road-to-subagent-return-gate.md`, 27 arrivals) — b1.
- **Runtime orchestration substrate** (`stubs/road-to-runtime-orchestration-substrate.md`,
  13 arrivals) — its posed question stands unchanged; this round added a killed proposal
  (K18), not a new argument.
- **Code-graph benchmark** (`stubs/road-to-code-graph-benchmark-rerun.md`, 73 arrivals) —
  b4, the two subject repositories.
- b2 consumer-first re-arm, b5 skill growth per stack, b6 neighbour precedence, b7 ADR-088
  premise, b8 ADR-278.
- The assurance-benchmark stub's `review_by` lapsed on 2026-09-25.

## Declines, one sentence each

- **The second author's master file:** every phase is a lane step here, bestand, parked or
  a collision, and its frontmatter uses relations and risk types outside the closed sets.
- **The eight-band precedence order:** it puts the current turn above the Hard Floor, which
  `src/rules/agent-authority.md:12-26` forbids (K26).
- **Profile hook flags:** profiles are installer substitution with no runtime layer, and
  the flags are Class C.
- **Deleting `hooks.code_graph.enabled`:** the key is registered by a recorded commitment.
- **The graph carve-out blocker:** the parked lane's Phase 3 is different work.
- **`old/00`, `08`, `09`, `18`, `19`:** analysis or profile notes superseded by the final
  set, several carrying identities.

## Recurrence

Second arrival of the programme (`inbox-2026-09-ab/t06`). Counters were written onto the
held objects, not only here: `road-to-leading-every-row` (2), subagent-return stub (27),
substrate stub (13), code-graph benchmark stub (73), assurance-benchmark stub (1 counted).
