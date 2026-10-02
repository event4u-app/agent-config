---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "lane of road-to-leading-every-row; the set's growth is declared there. The flip condition this lane starts measuring was written by archive/road-to-reachable-code-memory.md:54-58 and has no owner; later/road-to-ac-deep-capabilities Workstream C owns promotion and cannot absorb a measurement that must start before its own entry condition."
relates:
  - slug: road-to-leading-every-row
    relation: depends
    note: "the programme; this lane owns its learning row"
  - slug: road-to-ac-deep-capabilities
    relation: disjoint
    note: "Workstream C owns promotion; this lane owns only the reading and a read-only view"
  - slug: road-to-experience-loop-owner-decisions
    relation: disjoint
    note: "decision 9.6 stays owner-reserved; nothing here reads experience into any path"
depends: [road-to-leading-every-row]
---
# Road to learning you can see

> **Source:** `agents/tmp.old/inbox-2026-10-b/` — a code-level comparison against a
> curated host-config collection with a visible learned-pattern status; every anchor
> re-read at `9bc8cd4`. Class: external comparison corpus. Corrected where reproduction
> diverged.

## Goal

The learning loop's default is decided by a reading somebody started, and what it has
learned is one command away. At `9bc8cd4`: `memory.learn_on_session_end: false`
(`src/config/agent-settings.template.yml:1379`) ships OFF with a written flip condition —
30-day dogfood with non-trivial signal and session-end p95 under 2 s (`:1376-1378`;
`archive/road-to-reachable-code-memory.md:54-58,189-192`); no window was ever opened, and
the measurement would read nothing even if one were: the maintainer checkout's
`agents/memory/intake/` holds no signal file and has never held one, and `runLearn` returns
before any measurement point when there are no signals
(`src/scripts/memory_learn_hook.ts:183-186`). The sidecar is sound and read-only unless
`--write` (`src/scripts/learning_sidecar.ts:1-27`); its verdicts are `preferred`,
`contested`, `dead_end` (`:49,198-202`). Done: signals demonstrably arrive, a dated window
records the two numbers the flip condition names, and `memory:learn --format status`
answers what was learned in one screen — promotion and routing untouched.

## Phase 1 — Make the reading possible, then open the window

- [x] **1.1 Prove signals arrive.** Find which producers (`src/scripts/memory_signal.ts`
      and its callers) should write into `agents/memory/intake/` during a maintainer
      session, run one session, and record whether a `signals-*.jsonl` appears. If none
      does, the defect is the producer, and it is fixed here before 1.2.
      `corrected-from-reproduction` — the supplied draft assumed signal supply.
      verify: `ls agents/memory/intake/ | grep -c 'signals-'` -> /[1-9]/
- [x] **1.2 Turn the flag on in the maintainer workspace only.**
      `learn_on_session_end: true` in the maintainer checkout's `.agent-settings.yml`, never
      in the template; the hook (`src/scripts/memory_learn_hook.ts:58,98-148`) reads the
      project file.
      verify: `grep -c '^  learn_on_session_end: false' src/config/agent-settings.template.yml` -> /1/
- [x] **1.3 Record the two numbers per session end, including empty ones.** The hook
      appends one line per run to a gitignored `agents/runtime/state/learning-dogfood.jsonl`
      — `{at, wall_ms, signals_in, lessons_out, preferred}` — written before the early
      returns, so a zero-signal session is a line and not a silence. The new state file gets
      its continuity-surface row in the same diff.
      verify: fixture — a session end with zero signals appends exactly one line with `signals_in: 0`
- [x] **1.4 Date the window.** `agents/evidence/analysis/learning-dogfood-2026-Q4.md` records
      the start date, the reading command and the two thresholds verbatim from `:1376-1378`.
      verify: `grep -c '2 s\|2,000 ms\|2000 ms' agents/evidence/analysis/learning-dogfood-2026-Q4.md` -> /[1-9]/

## Phase 2 — One screen that says what was learned

- [x] **2.1 `memory:learn --format status`.** A third format beside `text|json`, no new
      verb (ADR-041): counts of `preferred`, `contested` and `dead_end`, the top five
      `preferred` lessons with origin count and age, and the sidecar's sentence on what a
      promotion requires. Reads only; writes nothing. `corrected-from-reproduction` — the
      supplied draft named states the sidecar does not have.
      verify: `agent-config memory:learn --format status` on the fixture sidecar -> /preferred: [0-9]+/
- [x] **2.2 The screen names the human step.** Its last line prints the `/memory:propose`
      and `learning-to-rule-or-skill` paths, because this tree writes no skill on its own
      (ADR-109 `:35-41`).
      verify: `agent-config memory:learn --format status | tail -1` -> /learning-to-rule-or-skill/
- [~] **2.3 Propose the default flip.** Deferred until the window has 30 days and both <!-- deferred-resolution: carried-to=road-to-learning-you-can-see-carried -->
      thresholds hold; the proposal is an owner amendment to the council decision at `:1376`.

## Acceptance criteria

- The template still ships `learn_on_session_end: false`.
- At least one signal file exists in the maintainer intake before the window opens.
- After 30 days the dogfood file has ≥ 20 lines and the evidence page states p95 and the `preferred` count with its command.
- `--format status` is read-only (`git status` identical before and after) and prints the three verdict counts.
- The import graph of `src/scripts/_lib/experience_report.ts` is unchanged.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | measure in the maintainer workspace, never flip the template | template `:1376-1379` names the dogfood as the precondition | the council decision is amended |
| D2 | reversible-technical | agent | `--format status`, not a verb | ADR-041; the dispatcher passes args to `learning_sidecar.ts:269-279` | a second read-only view is needed |
| D4 | deterministic | agent | closure pass C1 (1.4's verify listed unfalsifiable): accepted — the page's thresholds are copied verbatim, so the grep proves the copy | `closure_scan` 2026-10-01; listing family, never a gate | the template thresholds change |
| D3 | contested-technical | evidence | no generator that writes a skill or rule | ADR-109 `:35-41`; Workstream C owns promotion | Workstream C asks for one behind its boundary |
| D5 | deterministic | evidence | 1.1's defect is REACH, not the producer: `memory_signal.ts` emits correctly when invoked; emission is reachable only from `/bug:fix`, `/judge:on-diff` and `/memory:propose`, so an ordinary session emits nothing. Diagnosed and recorded; no automatic producer built — that writes a TRACKED file on every session end and is a behaviour change this lane does not own. | probe 2026-10-01; `bug/fix/command.md:159`, `judge/on-diff/command.md:73`, `memory/propose/command.md:94` | a session-end emitter is proposed; then it needs its own decision |
| D7 | deterministic | evidence | the seeded signals live in the maintainer checkout's intake, NOT in this repo's commit. `check_knowledge_sharing` blocks staging anything under `agents/memory/intake/` beyond the `.gitkeep` + `README.md` skeleton; the `merge=union` line and the README's "Local + tracked" sit inside a block headed "Append this block to the consumer project's root .gitattributes" and are the CONSUMER contract, not this repo's. Acceptance reads "maintainer intake", and that is where the file is. | `check_knowledge_sharing.ts:71-87`; `.gitattributes:41-50`; commit refused 2026-10-01 | this repo starts tracking intake content |
| D6 | reversible-technical | agent | the ledger's `wall_ms` covers read + aggregate — the portion the 2 s budget governs — and not the two sidecar writes that follow it, which fire only when a lesson exists. Stated in the evidence page rather than widened silently. | `memory_learn_hook.ts` `runLearn`; `BUDGET_MS` guards the same span | the p95 lands near 2 s, where the omitted span stops being negligible |

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The window opens and measures nothing | product | No signal has ever reached the intake; an open window over an empty source reads as "no signal" forever. | 1.1 proves supply first; 1.3 writes zero-signal lines so an empty window is visible. | Phase 1 — Make the reading possible, then open the window |
| 2 | `--format status` becomes the place promotion happens | implementation | A list of preferred lessons is one flag away from `--apply`. | 2.1 writes nothing; 2.2 prints the human step; D3 records the generator as declined. | Phase 2 — One screen that says what was learned |
| 3 | One maintainer machine is not a corpus | product | p95 and counts from one checkout describe one person's sessions. | The evidence page states the one-machine scope; 2.3 stays an owner amendment. | Phase 1 — Make the reading possible, then open the window |
