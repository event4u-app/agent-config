<!-- evidence-type: analysis -->
# Inbox round 2026-09-q — verification and disposition

> Analysed 2026-09-06 against `main@99d14b2e7`, which is the exact baseline all
> three files were drafted against — an unusually favourable case: nothing in the
> round could be stale by construction, so `already-fixed` had to come from
> movement inside the audited window itself, and twice it did.
>
> Three files: a 9,666-line concatenation of roughly a dozen independent model
> reviews of releases 14.17.0 and 14.18.0, a cross-corpus parity proposal, and a
> status-update note. Every claim below was re-derived from this tree; where a
> figure came only from the round it is marked `unverifiable` rather than adopted.

## Triage

| file | genre | age | drafted-against | recurrence | lineage | disposition |
|---|---|---|---|---|---|---|
| `chat.txt` (9,666 lines) | external-review (multi-voice) | same day | `99d14b2e` = HEAD | ~18 explicit markers, 8× "endlich", two explicit arrival counts ("dritte Runde", "achte Baseline") | n/a | deep-read, 5 slices |
| `road-to-cross-corpus-parity-v15.md` | external-review (comparison) | same day | `99d14b2` = HEAD | v15 of a standing series; supersedes v14 | complete (declares v14, v14 present in the consumed inbox) | deep-read |
| `w1-status-update-v14.18.0.md` | external-review (status) | same day | `99d14b2e` = HEAD | eighth baseline of a standing probe | n/a | deep-read |

The round directory arrived under a speaking name and was renamed to
`inbox-2026-09-q` before Phase 2; the true source is recorded once, `ENC1:`
encrypted, in the round's own intake note.

## What did not survive verification

| claim | source | verdict | evidence |
|---|---|---|---|
| `attest_artifact.ts` has zero importers and is "untouched by the window" | parity proposal, § carried defect D-A, fifth audit | **already-fixed** | The file does not exist. `e58e11f9b` (2026-09-04) removed it — *inside* the audited window `56aa348b..99d14b2e`. A defect carried through five audits was closed by the very window that audited it. |
| the 14.16.0 findings ledger is missing | transcript tail | **already-fixed** | `agents/evidence/release-findings/14.16.0.json` exists (`c5073530e`); `check_finding_dispositions --release 14.16.0` exits 0 with all ten findings dispositioned. |
| ADR-254 supersedes ADR-252 **and** ADR-251 | transcript, slice D | **never-true** | `ADR-254…:6` → `supersedes: ADR-252`. ADR-251 appears only under `evidence.basis`. |
| `release.ts` shrinks by 143 lines | transcript, slice B | **never-true** | `git diff --numstat` → `31 143`, i.e. net −112. The deletion count was reported as the shrinkage. |
| 14.18.0's governance mix is "16 vs 6" | transcript tail | **never-true** | 55 vs 16 (`CHANGELOG.md:496`). "16 vs 6" is the worked example in `docs/contracts/CHANGELOG-conventions.md:362`. The same document quotes 55 vs 16 correctly earlier — a self-contradiction that carries the report's strategic conclusion. |
| "four active roadmaps" | transcript, slice A | **never-true** | Ten. The same block counts nine new ones. |
| 237 commits / 240 commits / 32 PRs | transcript, two voices | **never-true** | 241 commits, 33 merge commits. Neither 237 nor 240 reproduces under any counting method tried. |
| `recruit-sessions/` holds five templates | transcript, slice D | **never-true** | Five files, exactly one template; the rest are a README and three runbooks. |
| `check_finding_dispositions` exits 0 on an absent ledger (fail-open) | one analysis slice, not the round | **never-true** | Exit **1**, reproduced three times for both 14.17.0 and 14.18.0. The slice read the code through a pipe and captured the pipe's status. Recorded because a fail-open reading would have inverted the roadmap this round produced. |
| per-class benchmark table: grep P=1/R=1 on `path-between` and `references` | transcript, slice E | **never-true** | Columns transposed — the report's own text corrects itself two pages later; `graph` holds the 1.0 values. |

Nine falsified claims out of roughly 190 checked. The round's quantitative base
is otherwise exact, including 241/298/+25,207/−2,041, the governance mix, the
enforcement-coverage figures, every line-count delta, and all twelve skill word
counts.

## What survived and became work

| finding | reproduction | receiver |
|---|---|---|
| 14.17.0 and 14.18.0 shipped with no findings ledger; the gate proving it is red and has no caller on `main` | `check_finding_dispositions --release 14.17.0` and `--release 14.18.0` → exit 1; the only caller is `release-validation.yml`, gated on `startsWith(github.head_ref, 'release/')` | `agents/roadmaps/road-to-the-ledger-two-releases-skipped.md` |
| ADR-134's `Expiry 2026-09-15` is nine days out and `adr_cite_check` cannot decide a date | `adr_cite_check ADR-134` → `trigger state indeterminate` on a trigger whose first two words are a date | `agents/roadmaps/road-to-a-dated-trigger-that-decides.md` |
| the release head's `Next cycle ships` promise is generated and presence-enforced, and never read back against the successor | `release_material.ts` generates it; `check_release_highlights.ts` enforces presence; no reader of the previous head exists | same |
| the skill-activation census reads zero, is published as a backed claim, and its instrument has no caller | `report_skill_activation` appears in no CI job, no Taskfile target, and neither `gate-coverage.yml` nor `release-gate-locality.yml` | `agents/roadmaps/road-to-the-activation-census-consequence.md` |
| ADR-225's parked skill-size ceiling has fired | twelve skills above 2,500 words against a threshold of "more than ten"; p95 2,367 at n=299, so the other half did not fire | `agents/roadmaps/road-to-the-skill-size-park-fired.md` |
| an active roadmap carries a grep-derived count that includes a comment line | `grep -c "severity: blocking"` → 8; a YAML parse → 7; `hook_manifest.yaml:510` is a comment | fixed in place this change (`road-to-host-enforcement-truth.md:23`) |
| the governance-vs-consumer share has been asked three times and no object holds it | `CHANGELOG.md:496` 55 vs 16; the measurement roadmap is archived, the ratchet was council-declined, ADR-253 declines the per-PR gate | `agents/roadmaps/stubs/road-to-consumer-capability-share.md`, carrying the arrival count |

## The point ledger

```
claims        190 extracted → 172 still-true / 2 already-fixed / 7 never-true / 9 unverifiable
instructions   77 extracted →  0 reproduced / 0 diverged / 0 unexecutable
                              / 0 out-of-bound / 77 not-attempted (see below)
demands        41 extracted →  4 adopted / 21 already-satisfied / 14 declined
                              / 2 owner-decision
```

**Instructions: 77 not-attempted, and the reason is the selection rule, not the
ceiling.** Every directive in this round is of the form *build X in this
repository* — a change to make, never a procedure with an asserted outcome that
could be run against the tree. Neither Phase 4b membership criterion is met by
any of them: none pairs a step with an outcome the tree would confirm, and none
is a reusable recipe. Each was instead checked for presence in the tree, which
is what the per-instruction status tables in the slice reports record. Zero
reproduced is therefore the correct reading and not a skipped phase; the ceiling
never fired.

**Demands: the 14 declines, grouped.** Nine are scorecard values and grades
(9.95, 9.999, 118/120, per-axis deltas) — a reviewer's own scale, with no action
attached. Three ask for a mechanism a recorded decision already declined on
evidence — a ratio ratchet, a per-PR artifact gate, and a machine-readable
grammar for semantic reopen conditions — and re-proposing them without new
evidence is the mechanism-match failure `decision-revisit-gate` names. Two are
self-contradicting within their own document: one voice demands a typed
high-risk operation gate as P0 and, forty lines later, warns that building one
before the owner reopens ADR-254 would be a covert rebuild; the conservative half
is the tree-conformant one and is what the estate already holds.

## Two owner decisions, posed rather than parked

Both are carried on the objects they belong to and are named in the round's
reply, so the next round meets a posed question rather than a fresh argument:
the governance-vs-consumer share (three arrivals, stub above), and ADR-134's
expiry action (blocker in the dated-trigger roadmap, nine days at authoring).

## Note on the comparators

The parity proposal names six external repositories. They are not carried into
any tracked artifact, per `src/rules/source-confidentiality.md`; the finding that
survived from that file is entirely about this tree.
