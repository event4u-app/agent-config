<!-- evidence-type: analysis -->

# Pre-registration — slim vs full end-reviewer verdict comparison

**Roadmap step:** `road-to-token-economy-dispatch-followup` 3.2a.
**Written:** 2026-11-06, before the first paid call. This file is committed
before any call is made; the probe and the run land in later commits.
**Runner:** `src/scripts/bench_slim_reviewer.ts`, scoring
`src/scripts/_lib/slim_reviewer_score.ts` (both committed before this file).

## Owner decisions this run is bound to (2026-11-06)

- **Spend cap: $20 total**, probes included. Enforced in the runner: every call
  appends its cost to `agents/evidence/analysis/slim-reviewer-2026-11-06/ledger.jsonl`;
  a call is refused when ledger total + per-call cap would exceed $20; each CLI
  call carries `--max-budget-usd 1`. The cost booked per call is the larger of
  the CLI's reported `total_cost_usd` and the `internal/bench/pricing.yaml`
  priced token buckets.
- **Agreement bar: ≥ 90 %** of fixtures with the same verdict in both arms.
- **Host model:** `claude-sonnet-4-6`. If the CLI rejects the id, the closest
  available Sonnet is used and the substitution is stated in the result.

## Arms

Both arms run `production-validator` as the session agent of a headless
`claude --print --output-format json` call (`--agents <file> --agent
production-validator`), tools Read/Grep/Glob/Bash, `bypassPermissions`, in a
throwaway directory holding only the fixture files. Same model, same agent body,
same user prompt. Only the loaded context differs:

- **full** — the agent body; the host loads its default instruction hierarchy.
- **slim** — the agent body + a review digest; the definition sets
  `omitClaudeMd: true`. The digest is: the generated subagent floor
  (`render_floor()`), two review contexts (`verification-mechanics`,
  `evaluator-independence`), and the Review mode / Severity / Rules sections of
  the `dispatch_r2_reviewer.ts` packet. The acceptance block is the fixture's
  requirement line, which is in the user prompt for both arms — a fixture has no
  roadmap whose criteria a packet could extract.

**Mechanism check (probe, before the run).** One trivial call per arm. The slim
arm counts as context-reduced only if its billed input (input + cache write +
cache read) is lower than the full arm's by at least 10k tokens. If it is not —
the host does not honour `omitClaudeMd` for a session agent — the run is not
started, and the result records that instead of substituting another mechanism.

## Prompt — neutral, identical for both arms

Per fixture: `Scope:`, the change (diff inline, or "the files as they stand"),
`Requirement:`, `Question: is this change ready to ship?`, and a format
contract (`FINDING: <file>:<line> — <severity> — <reason>` lines, then
`VERDICT: READY | NOT READY`). No expected outcome, no sceptic stance, no mention
of planted defects or controls. Generic requirement for the defect and council
fixtures: "the code under review behaves correctly for every input its
signature admits." Rendered prompts are committed under
`agents/evidence/analysis/slim-reviewer-2026-11-06/prompts/`.

## Fixtures (17)

- `wedge-hollow-detection` pair: `pv-01-hollow` (planted, `src/charge.ts`),
  `pv-02-control`.
- The 12-fixture defect corpus `internal/bench/corpora/defect-finding.yaml`:
  10 planted, 2 controls (`df-ctl-01`, `df-ctl-02`).
- The three correct-but-contested controls of the adversarial-council corpus:
  `ac-clean-01..03`.

11 planted, 6 controls, of which 3 contested.

## Seeds

**1.** Decided now, not after seeing the probe cost.

## Endpoints and definitions (fixed now)

1. **Verdict agreement** — fixtures where both arms parse to the same verdict,
   over 17. An unparsed verdict or an errored call never agrees.
2. **Missed planted defects** per arm — planted fixtures where the arm did not
   both return `NOT READY` and name the planted file (basename) in a FINDING.
3. **False positives on the contested controls** per arm — `NOT READY` on
   `ac-clean-*`. Reported alongside: `NOT READY` on all 6 controls.
4. **Priced cost** per arm — sum of booked cost per call.

## Bar

**Pass** iff agreement ≥ 0.90 (16 or 17 of 17) **and** slim contested-control
false positives ≤ full's. Otherwise **fail**. A fail is recorded as a fail; the
prompts, digest and scoring are not tuned and the run is not repeated.

## Known limits, stated before the result

- N = 1 per fixture per arm; 17 fixtures. Agreement at this size is a coarse
  instrument: one disagreement already costs 6 points.
- `production-validator`'s own remit is hollow implementations, not general
  defects; low recall on the defect corpus in both arms is a property of the
  agent, not of the arm. The comparison is slim against full, not against
  ground truth alone.
- The full arm runs outside any repository, so it loads the user-level
  hierarchy but no project `CLAUDE.md` — smaller than a real end review inside a
  consumer repo, which biases its context cost downward.
- The `pv-hollow` fixture's own source comments name the planted hollow path; it
  is the existing wedge fixture and is used unchanged in both arms.

## Amendment 1 — 2026-11-06, after the mechanism probe, before any fixture call

**What the probe showed.** Probe v1 (`raw/probe-v1.*.json`, $0.100 booked):
full arm 8,505 billed input tokens, slim arm 12,089. Both answered YES to the
`Rust Token Killer` marker, a phrase that lives only in the user-level
`CLAUDE.md` import. The pre-registered check therefore **failed**: run as the
*session* agent (`--agent`), the host does not honour `omitClaudeMd`, so slim
and full loaded the same hierarchy and differed only by the digest. Per the
check as written, the run was not started on that harness.

**Second defect in the harness, found in the same reading.** The fixture
directory was under the system temp directory, so the full arm saw the
user-level `CLAUDE.md` but none of the ancestor `.claude/rules` hierarchy a real
review in this account loads — its 8.5k is not the full context the step means.

**The amendment — harness only.** Endpoints, definitions, bar, seeds, fixtures,
prompts and the $20 cap are unchanged.

1. `production-validator` is dispatched as a **subagent** by a parent session
   (`--agents <file>`, no `--agent`), which is the only place `omitClaudeMd` is
   defined to act. The parent prompt only wraps the committed review prompt
   between markers and tells the parent to dispatch once and reply DONE; the
   parent prompt is identical for both arms. What is scored is the subagent's
   own final message, read from the `tool_result` of the dispatch in the
   `stream-json` output — never the parent's relay. A call whose parent does not
   dispatch counts as errored (UNPARSED).
2. Fixture directories move to `~/.cache/slim-reviewer-runs/`: under the home
   directory, so the user-level hierarchy loads; outside any repository, so no
   ground-truth file is reachable from a parent directory.
3. Booked cost is the whole call, parent included, in both arms.

**Mechanism check, restated for the new harness.** One probe call per arm
(probe v2). The run starts only if the subagent's first-request billed input in
the slim arm is lower than the full arm's by at least 10k tokens **and** the
slim subagent answers NO to the marker question. Otherwise the run is not
started and the result records that.

## Amendment 2 — 2026-11-06, after probe v2, before any fixture call

**Probe v2** (`raw/probe-v2.*.json`, $1.114 booked; ledger total $1.214): the
subagent harness dispatches in both arms. The slim subagent answered `NO` to the
marker question and its hand-back footer reports `subagent_tokens: 10675`. The
full call hit the $1 per-call cap before its subagent returned (203k tokens of
cold cache write — parent and subagent each carry the ~100k user-level
hierarchy), so the full side of the check was not measured.

Two harness parameters change; nothing else does:

1. **Per-call cap $1 → $2.** A $1 cap truncates the full arm's cold call, which
   would score as UNPARSED and manufacture disagreements that are budget
   artefacts, not verdicts. The $20 total cap and its guard are unchanged (a
   call is refused when ledger + $2 would exceed $20).
2. **Context measure.** The `stream-json` output carries no per-request events
   for the subagent, so "first-request billed input" is not observable. The
   measure becomes the host's own `<usage>subagent_tokens` footer on the
   hand-back. Criterion otherwise as in Amendment 1: slim lower than full by at
   least 10k, and the slim subagent answers NO. Probe v3 re-measures both arms.

**Probe v3:** full subagent 100,716 tokens, marker YES; slim 10,675, marker NO.
Check passed; the run started.

## Amendment 3 — 2026-11-06, budget-forced fixture order, before any verdict was read

**What happened.** The first five run calls (pv-01 both arms, pv-02 both arms,
df-logic-01 full) cost $3.96; ledger total $6.88. Every call re-writes the
parent session's ~100k-token prefix cold (billed at the 1h-TTL write rate), in
both arms — something in the session-scoped context differs per session, so
the prompt cache does not carry it across calls. The full reviewer subagent's
own prefix is sometimes reused, sometimes not. A fixture costs $1.2–1.7, so the
remaining $13.12 covers about 8–10 of the 15 fixtures left, not all of them.
The runner was stopped by its own guard (a temporary reservation line in the
ledger, removed afterwards; the ledger total above is the real spend). The
df-logic-01 full call is kept as `raw/df-logic-01.full.s1.unpaired.json`, booked
in the ledger, and not scored.

**No verdict had been read** when this order was fixed — only costs and token
counts were inspected.

**The amendment.** The remaining fixtures run in this order, until the
unchanged guard stops the run:

`ac-clean-01, ac-clean-02, ac-clean-03, df-logic-01, df-ctl-01, df-race-01,
df-secsmell-01, df-empty-01, df-offbyone-01, df-ctl-02, df-logic-02,
df-race-02, df-secsmell-02, df-empty-02, df-offbyone-02`

The contested controls come first because half of the bar reads them; the
defect fixtures follow, one per defect class before any class repeats, with the
second control in the middle. Results are scored over every fixture whose two
arms both completed (`--score-raw`), and the record states how many of the 17
that is. **The agreement bar is applied to the scored set, and the result names
the set size.** A run that scores fewer than 17 fixtures is reported as partial
coverage, never as a 17-fixture result.
