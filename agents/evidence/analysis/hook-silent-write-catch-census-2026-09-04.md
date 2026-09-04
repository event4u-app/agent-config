# Silent write-adjacent catches under `src/scripts/hooks/` — a census

> Taken 2026-09-04 on `drain/defect-population-sweeps`, which is stacked on
> `drain/one-negation-vocabulary`. Produced by
> `road-to-defect-population-sweeps` step 1.3. This is a **count and a list**,
> not a sweep of edits: 45 of the 47 rows below are correct as they stand and
> are recorded so the next reader does not have to re-decide them.

## Why this exists

A release commit repaired two `catch` blocks that swallowed a failed write
under the comment `observability only`, and wrote the argument into the code:

> *"'Observability only' was the reason given for writing nothing, which
> inverted the word: a grant that silently fails to be consumed is a capability
> that outlives its single use, and the operator has no way to know."*

It repaired the two sites it was pointed at and never searched for the rest.
`downstream-changes` § Defect-pattern search requires the opposite: name the
exact wrong construct, grep the tree, report the count and the files.

## Sweep 1 — the exact phrase

Construct, verbatim:

```
grep -rniE "^\s*/[/*]+\s*observability only" src --include="*.ts"
```

**Before this change: 4 live instances.** A broader `grep -rni "observability
only" src --include="*.ts"` returns **6**, of which two are prose that reasons
*about* the hazard rather than committing it and are correctly left alone.

| site | disposition |
|---|---|
| `src/scripts/hooks/block_unauthorized_git.ts:934` | repaired — fail-CLOSED, the refusal repeats, but the user's numbered answer became unrecordable |
| `src/scripts/hooks/evidence_independence.ts:368` | repaired — fail-OPEN, the turn's second self-scoped evaluation went unwarned |
| `src/scripts/language_mirror_hook.ts:634` | repaired — the roadmap did not name this one; the phrase sweep found it |
| `src/scripts/language_mirror_hook.ts:1128` | repaired — likewise |
| `src/scripts/git_authorization_hook.ts:1211` | not a defect — the prose of the repair that rebutted the phrase |
| `src/scripts/language_mirror_hook.ts:613` | not a defect — a docblock reasoning about this exact hazard for the legacy-marker migration |

**After this change the construct returns zero.** Held there by
`tests/scripts/hook_write_swallow_observability.test.ts`, which asserts both
polarities: no bare `observability only` catch body survives, and the docblock
occurrence that legitimately reasons about the hazard must NOT be swept away.

### Two corrections to the roadmap's own enumeration

Both were checked against `main@56aa348b3`, the commit the roadmap cites.

1. **The population was 4, not 2.** The roadmap scoped its census to
   `src/scripts/hooks/`; the phrase does not respect that boundary. Council
   2026-09-04 (anthropic + openai, 1 round, quorum 2/2, $0.0359, verdict
   **unanimous**) held that the roadmap's "only the two named sites" bound was
   aimed at the 47 generic silent catches below, not at further instances of the
   exact rebutted phrase, and that repairing two of four would be the pathology
   the roadmap exists to end. All four are repaired.
2. **`block_unauthorized_git.ts:935`'s dangling `see above` is not dangling.**
   The roadmap states it "points at nothing in that file". At `56aa348b3` it
   points at the four-line comment immediately above its own `try`, which
   explains the degradation correctly. The claim was false when written. The
   comment is rewritten anyway, because the diagnostic replaces it.

## Sweep 2 — the wider population, counted and verdicted

Construct: every `catch` clause under `src/scripts/hooks/` whose body contains
no `process.stderr.write` / `process.stdout.write` / `console.*` / `throw`, and
whose corresponding `try` block contains a write primitive (`atomic_write_json`,
`atomic_write_text`, `writeFileSync`, `appendFileSync`, `mkdirSync`,
`renameSync`, `rmSync`, `unlinkSync`).

| measure | count |
|---|---|
| `.ts` files under `src/scripts/hooks/` | 49 |
| of those, containing a write primitive | **26** |
| `catch` clauses in the directory | 252 |
| silent (no diagnostic in the body) | 242 |
| **silent AND write-adjacent — the census population** | **47** |

### The roadmap's second denominator does not reproduce

It states *"**33** `catch {` blocks in that directory swallow without a
diagnostic"*. Neither measurement lands there: 242 silent clauses, 47 of them
write-adjacent. 33 is between the two and matches neither, and the roadmap
records no construct for it. Recorded as unreproducible rather than reconciled —
inventing a filter that yields 33 would be fitting the method to the number.

### Verdicts

The question 1.3 asks is: **does this write's failure change what a later run
may do?** Four dispositions:

- **REPAIRED** (2) — it does, and the failure was invisible.
- **advisory-state** (21) — the write persists a counter, dedup marker or
  measurement. Losing it costs a repeated nudge, an under-reported count, or a
  lost measurement. It cannot change an authorization or gate outcome.
- **idempotent-delete** (13) — the write is a removal whose failure means the
  file is already in the desired state, or costs disk only.
- **not-silent** (11) — a classifier false positive worth keeping: the catch
  propagates the failure as a **return value** (`return "failed"`, `return
  null`, `return EXIT_ALLOW`). The failure reaches the caller; it just does not
  reach stderr. These are not swallows.

The `not-silent` rows are reported rather than filtered out. Tuning the detector
until they disappeared would have produced a tidier number and a less honest
one — the population is what the stated construct returns.

| site | verdict | why |
|---|---|---|
| `block_config_weakening.ts:230` | advisory-state | Allowlist-growth counter. A lost count under-reports growth toward the 20-entry cap; it can never fabricate one, and the guard's block reads the count it has. Fails toward not-blocking, which is the direction a read-only tree already implies. |
| `block_unauthorized_git.ts:934` | REPAIRED | Pending-refusal record. Fail-CLOSED — the refusal repeats — but the user's numbered answer became unrecordable with no diagnostic. Repaired in this change. |
| `code_graph_nudge_hook.ts:123` | advisory-state | Nudge dedup. A lost write costs one repeated nudge. |
| `design_pass_hook.ts:230` | advisory-state | Dedup marker; the comment states the cost and it is correct. |
| `design_slop_hook.ts:119` | advisory-state | Dedup marker. Same shape. |
| `dispatch_hook.ts:459` | not-silent | Parse fallback, not a write catch — it assigns `_raw_text` and continues. Write-adjacency is a same-function artefact of the scan, not this try. |
| `dispatch_hook.ts:477` | not-silent | `return;` propagates the failure to the caller as a no-op path. |
| `dispatch_hook.ts:995` | advisory-state | Counter publish. Cannot change a dispatch decision. |
| `edit_shape_hook.ts:217` | advisory-state | Per-session shape state; a lost write costs one un-deduped advisory. |
| `end_review_nudge_hook.ts:624` | advisory-state | Audit-line append. A lost line is a lost measurement — the telemetry this rule's own honesty clause already calls advisory. |
| `end_review_nudge_hook.ts:688` | advisory-state | Fired-at marker; costs one repeated nudge on the Stop path. |
| `evidence_independence.ts:368` | REPAIRED | Evaluation counter. Fail-OPEN — the second self-scoped evaluation in the turn goes unwarned. Repaired in this change. |
| `injection_budget.ts:426` | idempotent-delete | Prune of a file a peer may already have removed; absence is the desired state. |
| `injection_budget.ts:430` | idempotent-delete | Same prune, unreadable-directory arm. |
| `injection_budget.ts:491` | advisory-state | Budget bookkeeping append. A lost entry under-reports spend; it cannot grant budget. |
| `interruption_ledger_hook.ts:221` | advisory-state | Ledger append; the comment names it advisory by construction and that is accurate. |
| `probe_throttle.ts:72` | advisory-state | Throttle stamp. A lost write costs one extra probe — it cannot suppress one. |
| `reread_guard_hook.ts:159` | advisory-state | Re-read ledger; a lost write costs one un-flagged re-read. |
| `rule_inject_hook.ts:144` | advisory-state | Injection state; the comment states the cost (one re-injection) and it is correct. |
| `rule_inject_hook.ts:152` | idempotent-delete | `rmSync` with `force: true` — the failure set is effectively empty. |
| `run_continuation_hook.ts:600` | idempotent-delete | Keyed-state removal; force-delete of a file whose absence is the goal. |
| `run_continuation_hook.ts:606` | idempotent-delete | Legacy-path removal, same shape. |
| `run_continuation_hook.ts:980` | advisory-state | Ledger append; the comment names it observability and that is accurate here — the verdict is computed before the write. |
| `run_continuation_hook.ts:1243` | not-silent | `return EXIT_ALLOW` is the propagated outcome, not a swallow. |
| `run_continuation_hook.ts:1251` | not-silent | Same. |
| `session_eol_hook.ts:275` | advisory-state | Context-fill state on the Stop path; advisory. |
| `session_eol_hook.ts:354` | advisory-state | Recording state on the Stop path; advisory. |
| `ship_diff_volume_hook.ts:215` | advisory-state | State behind an advisory warning; the comment states the read-only-tree case explicitly. |
| `source_first_gate_hook.ts:296` | advisory-state | Gate state; a lost write costs one repeated prompt. |
| `source_first_gate_hook.ts:358` | advisory-state | Measurement append. |
| `state_io.ts:448` | idempotent-delete | Lock reclaim — a peer winning the race is the documented path and the retry below sees it. |
| `state_io.ts:479` | idempotent-delete | Lock-file removal, force-delete. |
| `state_io.ts:815` | idempotent-delete | Tombstone prune; costs disk, never state. |
| `state_io.ts:862` | idempotent-delete | Prune arm; costs disk. |
| `state_io.ts:867` | idempotent-delete | Prune arm; the comment enumerates the failure set correctly. |
| `state_io.ts:912` | idempotent-delete | Legacy-state prune; absent is nothing to do. |
| `state_io.ts:1050` | not-silent | `return "failed"` — the failure is the RETURN VALUE. Every caller branches on it. |
| `state_io.ts:1067` | not-silent | Same. |
| `state_io.ts:1086` | not-silent | Same. |
| `state_io.ts:1103` | not-silent | Same. |
| `state_io.ts:1112` | not-silent | Same. |
| `state_io.ts:1137` | not-silent | Same. |
| `subagent_ledger_hook.ts:600` | idempotent-delete | Open-marker removal; a duplicate stop finding it gone is normal. |
| `suggestion_capture_hook.ts:185` | idempotent-delete | Latch removal; the latch is consumed for the turn either way. |
| `suggestion_capture_hook.ts:196` | not-silent | `return null` propagates as stale_block, which the comment states. |
| `turn_end_gate_hook.ts:840` | advisory-state | Marker whose loss costs at most one extra refusal — fail-CLOSED and bounded, and the comment already reasons it through. The nearest call in the census; kept unrepaired because the direction is toward MORE refusal, never less. |
| `ui_route_nudge_hook.ts:226` | advisory-state | Nudge state; costs one repeated nudge. |
## The nearest miss, named

`turn_end_gate_hook.ts:840` is the closest call in the table and is deliberately
**not** repaired. Its write is a marker whose loss costs at most one extra
refusal — the direction is toward MORE refusal, never less — and its catch body
already reasons that through in full. Repairing it would be a diagnostic on a
fail-closed, bounded, already-documented path, which is the drive-by edit
`minimal-safe-diff` forbids. Recorded here so the next reader sees it was
decided rather than missed.

## What would have caught the remaining instances

`tests/scripts/hook_write_swallow_observability.test.ts` — a structural
assertion that no bare `observability only` catch body exists under
`src/scripts/hooks/` or in `language_mirror_hook.ts`, plus a per-site
fault-injection probe (`chmod 0o500` on the state directory) for each of the
four repairs. Each probe was run against its own reverted fix and observed red
before being accepted: a fault-injection test never seen red has unknown
sensitivity.

It does **not** generalise to the 45 rows above, and that is deliberate — the
verdicts here are judgements about failure direction, not a property a linter
can read. The census is the durable artefact for those; the test is the
mechanism only for the construct that was actually wrong.
