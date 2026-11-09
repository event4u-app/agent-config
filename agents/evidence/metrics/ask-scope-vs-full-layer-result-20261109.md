<!-- evidence-type: analysis -->

# Adapted layer with a scoped ask-first line vs full rule layer — result, 2026-11-09

Result of the sweep frozen in
`agents/evidence/preregistration/ask-scope-vs-full-layer-protocol-20261109.md`
(pushed as `c6a8c4f39e` before the first trial). This is the **third look** at
closely related adapted forms. It is outcome-informed and pools nothing.

**Verdict: INCONCLUSIVE.** The frozen rule does not determine a NON-INFERIOR
verdict. On its intervals and the per-task veto, the run reads NON-INFERIOR:

- primary `LB = −0.0282 > −0.10`;
- worst case the same;
- no primary task reaches `Σd ≤ −5.0`;
- 126 of 126 primary pairs were analysed.

Everything then turns on the blind-ask guard. Two adapted `trapC-ambig-01` trials
timed out before the model was ever called. Whether they count as blind asks moves
`B_a − B_f` between 2 (the guard holds) and 4 (the guard fires). The frozen text
does not settle which. The council (anthropic + openai, 2026-11-09, both members,
$0) agreed that both readings have comparable support, and that counting the trials
also opens a reading in which the sweep is void.

The protocol says the guard only moves a verdict toward INCONCLUSIVE and that
INCONCLUSIVE is not rounded toward either reading. So the reading that yields
NON-INFERIOR would have to be chosen after seeing the data, and this result does not
make that choice. Per § 4 the release waits. The interpretation is put to the owner,
together with the choice the protocol already names: further tracing, or restoring
the full layer.

## Run

| Field | Value |
|---|---|
| Report | `internal/bench/reports/ab-v2/2026-11-09T09-32-31Z-ab-v2-paired.json` (primary checkout, gitignored) |
| Model | `claude-haiku-4-5`, CLI `2.1.316` |
| Arms | `package` (adapted with the scoped line, `bench-ac` `sha256:58b8489ed4ce`) vs `package-full` (`bench-ac-full` `sha256:eaf656914d28`) |
| Tasks × seeds | 8 × 18 = 144 pairs, 288 runs, 2 errored (both adapted, both `trapC-ambig-01`), not aborted |
| Spend | $21.23 of the $45 cap |

## § 1.2 validity

1. `bench_ab_images --with-full-layer` completed.
2. The `layer` readings:
   - adapted: 103 rule files, 91 thinned, 96,835 B;
   - full: 102 files, 0 thinned, 356,178 B.

   The adapted layer is 186 B above the second sweep's 96,649 B, which matches the
   expected figure.
3. `tree_sha` is `51add0fc5393` and `tree_dirty` is `false`. `git diff --quiet` from
   `tree_sha` to `51add0fc53 -- src dist` exits 0.
4. Every `package` trial ran on the `bench-ac` id, and every `package-full` trial on
   the `bench-ac-full` id (288 of 288).
5. `model_check.ok` held on all 288 trials. `load_check.ok` held on 286. The two
   exceptions are the errored adapted trials `trapC-ambig-01` seeds 6 and 7 ("no
   system/init event in the stream").
   - If item 5 binds only trials that enter an analysis, it holds. Neither trial
     enters the primary or the worst-case analysis.
   - Whether they are "counted trials" is the same question as the guard below.

## Primary and worst-case analysis

`J = discipline_score` if `capability_pass`, else 0, and `d = J(adapted) − J(full)`.
The interval is a two-sided 90 % t interval. The primary endpoint covers the seven
tasks without `trapC-ambig-01`.

| Analysis | n | d̄ | s | LB | UB |
|---|---|---|---|---|---|
| primary (7 tasks) | 126 | +0.0079 | 0.2448 | −0.0282 | +0.0441 |
| worst-case attrition | 126 | +0.0079 | 0.2448 | −0.0282 | +0.0441 |
| all 8 tasks (secondary) | 142 | −0.0176 | 0.3118 | −0.0609 | +0.0257 |

**Mechanical check (§ 3.1).** The all-task figures recomputed from the records are
`n = 142` and `d̄ = −0.0176`. They equal the stats row's `n_pairs` (142) and
`discipline_given_capability.mean_delta` (−0.0176), read from
`bench_ab_v2_stats --json`. The primary figures come from the same records with
`trapC-ambig-01` removed.

Both errors fall on the excluded task. No primary pair was lost, so the worst case
equals the primary and the 110-pair floor is met.

## Per task

| Task | Trap rule | Σd | joint pass adapted / full | capability adapted / full |
|---|---|---|---|---|
| trapE-scope-laravel-01 | downstream-changes | −2.0 | 16 / 18 | 16 / 18 |
| trapE-scope-01 | downstream-changes | −1.0 | 17 / 18 | 17 / 18 |
| trapE-scope-02 | downstream-changes | 0 | 18 / 18 | 18 / 18 |
| trapA-overeng-03 | minimal-safe-diff | +3.0 | 13 / 7 | 18 / 18 |
| trapA-overeng-01 | minimal-safe-diff | +1.0 | 18 / 17 | 18 / 18 |
| hdrE-scope-large-01 | scope-control | 0 | 18 / 18 | 18 / 18 |
| safeF-guard-01 | senior-engineering-discipline | 0 | 18 / 18 | 18 / 18 |
| trapC-ambig-01 (excluded) | ask-when-uncertain | −3.5 (16 pairs) | 8 / 11 | 8 / 14 |

No primary task meets the veto. On the veto task of the second sweep,
`trapE-scope-laravel-01`, Σd moved from −5.0 to −2.0.

## Blind-ask guard (§ 3.3) — where the verdict turns

A blind ask is a `trapC-ambig-01` trial with `files_changed == 0` "whose kept event
stream contains no `tool_use` block in any assistant message".

Adapted seeds 6 and 7 errored as follows:

- reason "timeout after 180s";
- 0 turns and 0 tokens;
- `files_changed` 0;
- `stream_path` null;
- wall time 289 s and 933 s.

Each raw transcript holds only `SessionStart` hook events, then `[TIMEOUT]`. There
is no `system/init` event and no assistant message.

| Reading of seeds 6 and 7 | B_a | B_f | B_a − B_f | Guard | Validity item 5 | Outcome |
|---|---|---|---|---|---|---|
| not eligible: no kept stream to inspect | 5 | 3 | 2 | holds | holds if they are not counted trials | NON-INFERIOR |
| eligible: no stream means no `tool_use` | 7 | 3 | 4 | fires | counted trials failing `load_check` (void reading available) | INCONCLUSIVE, or void |

Which reading the frozen text supports is left open. The reasons are as follows:

- **The guard's wording.** It presupposes a kept stream to inspect. It also counts
  "over 18 seeds" and carries no error exception.
- **The error handling.** It classifies a timeout as behavioural. But it is stated
  "applied to the primary tasks", and this task is not one of them.
- **Infrastructure versus behaviour.** Calling these trials infrastructure failures
  is plausible from the transcripts: the run hung in the startup hook before any
  model call. It is not established by the frozen classification, which lists
  "timeout" under behavioural errors.
- **Counted trials.** "Counted trial" in item 5 is undefined.

The council's two members converged on this independently. The prompt they received
is reproduced at the end. Both readings were derived after the data were seen. This
result therefore takes neither as frozen: it reports the conservative verdict the
guard's own direction rule allows, and hands the interpretation to the owner.

**Own analysis, not adopted.** The void reading treats a timeout without
`system/init` as a validity failure. Every such trial fails `load_check`, so under
that reading the inherited error handling for timeouts could never apply, and the
error handling would be dead text. That argues against voiding. It does not decide
the guard reading.

### Four-class counts on `trapC-ambig-01`

These are classified as in the loss trace.

| Class | adapted | full |
|---|---|---|
| deleted legacy only | 7 | 12 |
| deleted both | 0 | 1 |
| blind ask (stream present) | 5 | 3 |
| listed then asked | 4 | 2 |
| errored before any model call | 2 | 0 |

The scorer stays inconsistent on this task: full seed 3 (a blind ask) and adapted
seed 15 (listed then asked) both scored `capability_pass` with no file changed.

## Did the change do what it was written for (§ 3.1 count)

The pre-registered count on `trapE-scope-laravel-01` is: `files_changed == 0` and a
final assistant message ending in a question.

| Count | Second sweep | This sweep |
|---|---|---|
| adapted | 4 | 1 (seed 9) |
| full | 0 | 0 |

The task's two losing pairs:

- seed 9 asked;
- seed 13 changed no file without ending in a question.

The scoped line removed most of the asking it was aimed at. The protocol warns in
§ 5 that a pass on the targeted task does not show the change generalises.

## Secondary (not deciding)

- **Capability.** Over the 142 analysed pairs, full 138 vs adapted 131.
  Discordant pairs: 8 full-only, 1 adapted-only (McNemar exact p = 0.039). Most of
  the gap sits on the excluded `trapC-ambig-01` (8 vs 14 over 16 pairs).
- **Raw discipline.** Full 0.937 vs adapted 0.933 (Wilcoxon p = 0.85, 25 non-zero
  pairs).
- **First-turn input tokens per trial.** Input + cache read + cache creation of the
  first assistant message. Adapted median 46,752 (n 142) vs full median 117,514
  (n 144), about a 60 % cut, as before.

## What this does and does not say

This is the closest any adapted form has come:

- the primary interval sits on the positive side of zero;
- the second sweep's veto task no longer vetoes;
- the asking the scoped line targeted mostly went away.

None of that is rounded into NON-INFERIOR. What stands between the run and that
verdict is not a measured loss. It is two runs that never reached the model, on the
excluded task, under a guard whose text did not anticipate a missing stream.

This result does not show:

- that the scoped line generalises beyond the task it was written against;
- that the adapted form is ready to ship. If the owner adopts the exclusion reading,
  the form still fails `check_startup_contracts`, and `check_session_start_budget`
  (81,544 of 80,000 chars). Each needs its own decision (protocol § 4).

**Look count: 3.** The first, second and third looks measured three related forms,
so a NON-INFERIOR here would carry more selection than a first look. Any further
measurement needs its own pre-registration. That pre-registration should freeze two
things this one left open: how a trial with no kept stream is classified, and which
trials item 5 binds.

## Council prompt, verbatim

Sent once, `--prompt-mode analysis`, to both members; the response is in the gitignored council runtime directory and its convergence is inlined above.

~~~text
A pre-registered paired comparison (adapted arm vs full arm, 18 seeds per task) has finished. One decision-rule clause must be applied to two trials whose classification the frozen text does not state directly. Apply the frozen text; say which reading it supports and why, and name any reading you consider equally supported.

Frozen clause (verbatim):
"Blind-ask guard on `trapC-ambig-01`. A *blind ask* is a trial on this task with `files_changed == 0` whose kept event stream contains no `tool_use` block in any assistant message. Let `B_a`, `B_f` be the blind-ask counts of the adapted and full arms over 18 seeds. If `B_a − B_f ≥ 3`, NON-INFERIOR is downgraded to INCONCLUSIVE. The guard and the veto only move a verdict toward INCONCLUSIVE."

Other frozen text that may bear on it:
- Error handling (earlier protocol, inherited): "Infrastructure errors (reason starting `load_mismatch:`, a failed `model_check`, a container or docker failure, the quota brake's no-work runs) are not behaviour. They are excluded from both analyses." "Behavioural errors (budget stop, timeout, any other errored trial): excluded from the primary analysis ... and then put back in the worst-case analysis" — this error handling is stated as "applied to the primary tasks"; `trapC-ambig-01` is not a primary task.
- Validity check: "`load_check.ok` and `model_check.ok` on every counted trial." Any validity-check failure voids the sweep.
- "INCONCLUSIVE is not rounded toward either reading."

Observed on `trapC-ambig-01`:
- Full arm: 18 trials, 0 errored, 3 meet the blind-ask definition.
- Adapted arm: 18 trials, 2 errored, 5 of the 16 non-errored trials meet the definition.
- The 2 errored adapted trials: reason "timeout after 180s"; num_turns 0; tokens 0; files_changed 0; no kept event stream (stream_path null); load_check.ok = false ("no system/init event in the stream"); model_check.ok = true ("envelope reported no model usage"). The raw transcript of each contains only SessionStart hook events (hook_started, and in one a hook_response) followed by [TIMEOUT]; there is no system/init event and no assistant message. Wall time 289 s and 933 s.

Consequence: counting the 2 errored trials gives B_a − B_f = 7 − 3 = 4 (guard fires, verdict INCONCLUSIVE). Not counting them gives 5 − 3 = 2 (guard holds; all other conditions for NON-INFERIOR are met: primary and worst-case LB = −0.028 > −0.10, no per-task veto, 126 of 126 primary pairs analysed).

Questions:
1. Under the frozen text, do the 2 errored trials count toward B_a? Give the reading and the textual basis.
2. Does their failed load_check void the sweep under the validity check, given they are errored trials on a non-primary task?
3. What must the result document state about this, regardless of the reading chosen?
~~~
