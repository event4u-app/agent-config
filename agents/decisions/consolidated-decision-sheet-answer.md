# Consolidated decision sheet — the answer

<!-- sheet-answer: option (a) — accept all rendered defaults | answered: 2026-08-20 | authority: agents/evidence/council/drain-blocker-dispositions-b.md -->

> **This file is NOT derived.** `agents/decisions/consolidated-decision-sheet.md` is
> regenerated from the roadmaps on every run, so an answer written there is lost. This
> is where the answer lives, and `agent-config gates --sheet` reads the marker above
> and prints it in the sheet's own header — which is what `road-to-estate-drawdown`
> blocker `b-consolidated-decision-sheet` means by "the sheet records which option was
> used".

**Option used: (a) — accept all rendered defaults.**
Answered 2026-08-20. Authority: the AI council,
[drain-blocker-dispositions-b](../evidence/council/drain-blocker-dispositions-b.md),
row `b-consolidated-decision-sheet | D | satisfied`, both seats convergent. The
roadmap's own `Recommendation:` was option (c); the council overrode it to (a), so
this row is itself an override of the rendered default and is recorded as such below.

## Option (a) was applied per row, not blanket — and here is why

The council session that chose (a) carried a dissent worth acting on rather than
skipping: *"blanket acceptance of an unseen consolidated sheet is not an informed
decision."* So every rendered default was read and audited against one question —
**is this default conservative and reversible?** — where a default is NOT conservative
if it would lower a security, privacy or safety floor, create an irreversible or
externally visible commitment, or lower a Hard Floor.

That audit has a decisive input the sheet itself does not show. Batch B adopts the
framework of round 1 by name, and that framework's **Rule 3 is categorical**:

> repository creation, a legal signature, a shipped-default flip, a repo-admin
> setting, a host-env modification, or any externally visible / irreversible action
> takes `B`, never `D`. The council may record its preferred choice inside the stub;
> the parent may not record the action as done.

Read together — and batch B inherits that framework explicitly — option (a) means
*accept the rendered default as the recorded choice*, and it cannot mean *record an
externally-gated action as done*. Applying (a) blanket would have silently reversed
**ten** dispositions the same council had already made in round 1, and would have
accepted one default that expands standing agent authority. So:

| Verdict | Rows | Meaning |
|---|---:|---|
| **accepted** | 7 | Conservative, reversible, and the council's own row adopts the same option. |
| **overridden** | 1 | The council settled the values itself and chose the *conservative* variant against the rendered default. |
| **transferred** | 12 | Rule 3, or (one case) the default's own content. The rendered default is recorded as the preferred choice *inside* the transfer, never as done. |
| **answered** | 1 | This blocker itself. |

## The twenty-one rows

Rendered by `agent-config gates --sheet` on 2026-08-20; the sheet says 21 where the
roadmap's blocker text says thirteen, because the estate grew between drafting and
answering — the arrival rate T3 exists to bound, already recorded at step 0.1.

| # | Decision | Roadmap | Unblocks | Default source | Verdict | Basis |
|---:|---|---|---:|---|---|---|
| 1 | `skill-activation-window` | cost-parity-1-rule-payload-diet | 49 | `agent-drafted` | **transferred** | Host-controlled, human-gated eval. Batch A `B`; merged with row 10 into one live-trigger-eval stub. |
| 2 | `autonomy-defaults-sheet` | user-out-of-the-loop | 31 | maintainer | **overridden** | Council chose `phase-checkpoints` (not `autonomous`), `halt` (not `auto-research`), and *both* deferral exits. Lane cap 2 as rendered. |
| 3 | `kernel-soak-window` | user-out-of-the-loop | 31 | maintainer | **transferred** (split) | Three non-kernel deltas accepted and proceed now; the `ask-when-uncertain` kernel delta and its soak transferred. |
| 4 | `dpo-signoff` | org-telemetry | 17 | maintainer | **transferred** | A written data-protection signature is categorically external. The narrowed *scope* is accepted; the signature is not supplied. |
| 5 | `sink-choice` | org-telemetry | 17 | maintainer | **transferred** | "The private repository" is the preferred choice; *creating* it is repository creation. |
| 6 | `compaction-census-session` | context-fidelity | 12 | maintainer | **transferred** | Ordering accepted; the experiment needs live host behaviour and an external session-state directory. |
| 7 | legacy blocked-until note | gated-reach-followup | 12 | none — legacy note | **transferred** | The sheet renders **no default at all**, so (a) has nothing to accept. Also a host-env modification (`yt-dlp` + a JS runtime). |
| 8 | `real-orchestration-usage` | orchestration-scope-decision | 6 | `agent-drafted` | **transferred** | Probe-first ordering accepted; the probe is a live-host observation. Merged with row 9. |
| 9 | `telemetry-sample-size` | subagent-value-realization-followup | 6 | maintainer | **transferred** | Reframing accepted; merged into row 8's task-completion observability stub. |
| 10 | `human-gated-live-trigger-eval` | skill-description-measurement | 4 | `agent-drafted` | **transferred** | One-sitting protocol accepted; merged into row 1's stub. |
| 11 | `b-consolidated-decision-sheet` | estate-drawdown | 3 | maintainer | **answered** | Option (a), per the council — itself an override of the rendered (c). |
| 12 | `b-guard-tool-partition` | per-turn-hook-economy | 3 | maintainer | **accepted** | Option (c) decline. Declining changes nothing; both seats refused the partition. |
| 13 | `b-injection-scan-unwrap-security` | per-turn-hook-economy | 3 | maintainer | **accepted** | Option (a). Contract + fixtures *before* narrowing the scanner — raises the security floor. |
| 14 | `b-payload-read-parse-dominates` | per-turn-hook-economy | 3 | maintainer | **accepted** | Option (a). Adds a measurement, commits to no change. Dissent recorded. |
| 15 | `b-per-turn-composite-bar` | per-turn-hook-economy | 3 | maintainer | **accepted** | Option (b) observe-only. The option that refuses to invent a number. |
| 16 | `b-stdin-read-failure-policy` | per-turn-hook-economy | 3 | maintainer | **accepted** | Option (c). Preserves fail-closed where a guard can refuse; no availability risk elsewhere. |
| 17 | `b-stop-async-split-prerequisites` | per-turn-hook-economy | 3 | maintainer | **accepted** | Option (a). Fixes a live data-integrity defect before the split. Dissent recorded. |
| 18 | `maintainer-blind-ratings` | council-blind-review | 2 | `agent-drafted` | **transferred** | Blind human judgments; the honest-null permission is preserved. Batch B `B`. |
| 19 | `manual-rubric-rater` | scale-history-bench-run | 2 | `agent-drafted` | **transferred** | Anti-anchor ordering is irreversible once violated. Batch B `B`. |
| 20 | `b-delegate-gate-maintainer-profile` | gate-autonomy | 1 | maintainer | **transferred** — pulled out | **The one default that fails the audit on its own content.** See below. |
| 21 | `b-gate-budget-preauth` | gate-autonomy | 1 | maintainer | **accepted** | Option (a), caps USD 5/run and USD 25/rolling-7-days. Accepted *with the reason stated* — see below. |

Every row's answer is written at its own originating blocker as an `- **Answer:**`
field (row 7 as a blockquote paragraph, because a legacy note has no field to carry
one). This file is the index, not the record of record.

## Row 20 — the one pulled out, and why

Rendered default (a) **enables `allow_delegate`**: a standing grant of delegated
write authority to an agent path. That is an expansion of standing authority — it does
not undo itself, and nothing in "accept all defaults" reads as authorising it. Option
(b) exists and is strictly narrower: enable the team surface for consultation, keep
`allow_delegate: false`.

The council reached the same conclusion independently. Batch B narrows this entry to
**(b)**, against the roadmap's rendered (a). So the pull-out is not a second opinion
over the council — it is the council's own live disposition, which a blanket accept-all
would have overwritten with the very option the council declined.

Three-point stub-integrity check, recorded at the blocker:

1. **Original criterion, verbatim** — "one option is recorded at this blocker, and for
   (a) or (b) the profile carries the setting with the cap named."
2. **Dependent steps moved** — `road-to-gate-autonomy` Phase 3 step 3.1 and through it
   3.2; and with them `road-to-estate-drawdown` step 4.1, whose recurring pass has no
   delegate path to run on.
3. **Named re-entry producer + probe** — the gate-autonomy maintainer writing the
   profile setting; probe: the maintainer profile carries the team surface enabled with
   `allow_delegate: false` and the per-day call cap named.

The stub file belongs to `road-to-gate-autonomy`'s own closure, not to this run: this
run answers a sheet, and creating another roadmap's stub in its name would move
ownership of work this run is not doing.

## Row 21 — accepted, with the reason stated

This is the most consequential *accepted* default on the sheet, so it is named rather
than folded into the count: it removes a per-action human keystroke on billable gates.
It is accepted because it is **bounded and audited** — a named per-run cap (USD 5), a
named rolling-week cap (USD 25), and an append-only receipt ledger — and reversible by
lowering either number to zero. A per-run cap alone bounds one mistake, not a week of
them, which is why (a) beats (b). No spend is authorised until the settings keys and
the ledger path exist, so accepting the default authorises a *shape*, not a charge.

## What this answer does NOT do

It records decisions. It does not do the work each entry names: eighteen of the
twenty-one blockers stay open because their `Resolved when` asks for an artefact, a
signature, a probe or a setting that recording a decision does not produce. Only
`b-consolidated-decision-sheet` itself closes here. A drawdown that closed the other
twenty by writing an answer next to them would be exactly the burial this campaign's
own risk register ranks first.
