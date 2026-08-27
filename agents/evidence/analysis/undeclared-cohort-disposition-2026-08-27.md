<!-- evidence-type: analysis -->
# The undeclared cohort, dispositioned — 2026-08-27

**Population, two independent readings, taken on the same tree:**

```
grep -L 'enforced_by\|instruction-only' src/rules/*.md | wc -l   ->  82
check_enforcement_coverage                        undeclared    ->  82
```

They agree, so the cohort is a fact about the tree rather than an artefact of one
script's parse. Phase 1.1 required a mismatch to be *reported* rather than
reconciled by hand; there was none to report.

## Before

```
enforcement coverage · 15/120 rules (12.5%) have a backstop that fails a CI build
  declared 38 · local-only 0 · observer 10 · unwired 0 · missing 0 · undeclared 82
  frequency: 9 gap · 9 unclassified (kernel — block_kernel_rule_writes denies the field)
  denominator: 120 rule(s), frame in-scope (src/rules/*.md) == governed-total 120
```

## After Phase 1.3 — measured, then REVERTED, and the reversion is the finding

The 14 declarations were written, measured, and **taken back out**. What they
produced is recorded here because the numbers are real; what stopped them from
shipping is recorded below, because it is a repo-wide constraint that has nothing
to do with this cohort.

```
enforcement coverage · 15/120 rules (12.5%) have a backstop that fails a CI build
  declared 52 · local-only 3 · observer 14 · unwired 0 · missing 0 · undeclared 68
  local-only = a validator no workflow runs. It fails `task ci` if someone types it; it does not fail the build. Counted separately, never in the headline.
  frequency: 14 gap · 9 unclassified (kernel — block_kernel_rule_writes denies the field)
  denominator: 120 rule(s), frame in-scope (src/rules/*.md) == governed-total 120
```

**82 → 68, a drop of exactly 14** — the size of the two buckets Phase 1.3
addresses, with nothing else moved. `unwired 0` and `missing 0` held across the
change: every declaration written resolved to a carrier that exists and is
reachable, which is the property that separates a declaration from a claim.

Two counts moved in the direction that tells the truth rather than the flattering
one: `observer` 10 → 14 and `local-only` 0 → 3. **The headline "15/120 rules have
a backstop that fails a CI build" did not move at all**, and that is correct —
nothing in this change made an obligation safer at runtime. Risk 3 of the roadmap
names exactly this trap, and the instrument's own class separation is what
prevents it.

## Why none of the 14 landed

`check_preamble_payload_budget` blocks in CI **and in a test**
(`tests/scripts/check_preamble_payload_budget.test.ts` — *"exits 0 under the
grace ceiling the CI step passes"*) against a grace ceiling of **138,212** whose
config says it **may never move UP**.

Measured on this tree, each figure from a real run:

| tree | tokens | vs ceiling |
|---|---|---|
| `origin/main` | **138,212** | **exactly on it, to the token** |
| + all 14 declarations, reasons compressed to clauses | 138,433 | +221 |
| + only the 7 carrier declarations | 138,284 | **+72** |
| + none | 138,195 | **−17** |

**Even seven declarations do not fit.** The constraint is not a matter of
trimming a reason: main sits *on* the ceiling, so a rule-metadata addition of any
size is refused. That is a repo-wide fact this cohort merely happened to
discover.

A council was asked how to pay for the 221 and split 1–1 —
ship-with-recorded-debt versus find-the-offset-in-the-same-change
(`agents/evidence/council/preamble-vs-declaration.md`). **The split is now moot,
and in the dissenting seat's favour:** the question was framed as though the
ceiling were enforced only by a report-only workflow, and it is enforced by a
test. "Recorded debt" is not an available option — the repo refuses the commit,
not just the report. The framing was mine and it was wrong, exactly as the
adoption-floor framing was earlier in the same run.

The offset was attempted at three sizes and not found. Re-wrapping saves
newlines, and the gate counts tokens; removing words from rules this change does
not otherwise touch is a drive-by edit; and rushing a compression is what the
dissenting seat named as the cost of its own preferred option.

**So the 14 dispositions are decided and not written.** They are listed below in
full, with their exact declaration strings, so applying them when headroom exists
is a mechanical step rather than a re-derivation.

## The 14, ready to apply

| rule | declaration |
|---|---|
| `cli-output-handling` | `hook:rtk-wrap` |
| `delegation-policy` | `hook:delegation-nudge` |
| `source-discovery-gate` | `hook:source-first-gate` |
| `external-code-graph-interop` | `hook:code-graph-nudge` |
| `legal-safety-floor` | `validator:src/scripts/lint_legal_pack.ts` |
| `roadmap-ci-steps-policy` | `validator:src/scripts/lint_roadmap_ci_steps.ts` |
| `token-budget-discipline` | `validator:src/scripts/lint_token_budget_discipline.ts` |
| `architecture` | `instruction-only: a placement decision before any file exists` |
| `domain-adoption-policy` | `instruction-only: a pre-harvest judgement, no artefact` |
| `guidelines` | `instruction-only: consulting leaves no signature` |
| `improve-before-implement` | `instruction-only: runs before implementation, no artefact` |
| `invite-challenge` | `instruction-only: the owed-a-checkpoint judgement is invisible` |
| `senior-engineering-discipline` | `instruction-only: overfit code looks like working code` |
| `think-before-action` | `instruction-only: a pre-action read set, unobservable` |

**Two of them are worth more than the row suggests.** `legal-safety-floor` and
`roadmap-ci-steps-policy` named validators that **no workflow ran**. Declaring
them is what surfaced it, and the fix landed anyway:
`.github/workflows/rule-backstops.yml` now runs both. The declarations do not
ship; the CI coverage does.

## The four buckets

| bucket | count | landed in 1.3 |
|---|---|---|
| `already-carried` | 13 | **7** — see § The six that were not declared |
| `cheaply-probeable` | 56 | no, by design — Phase 2 decides these |
| `instruction-only-by-nature` | 7 | **7** |
| `structurally-blocked` (kernel) | 6 | no — a guard denies the write |
| **sum** | **82** | 14 |

The sum equals the population, and every rule lands in exactly one bucket.

**`cheaply-probeable` at 56 is the number to be suspicious of**, and it is
reported rather than trimmed. Risk 1 warns that a bucket which swallows
everything converts an honest unknown into a false settled state. It is the
larger half here — but it is also the bucket that *changes nothing*: a rule in it
stays undeclared until Phase 2 ranks it on a cited measurement. The failure risk 1
describes would be a large `instruction-only-by-nature` bucket, which would have
written 82 false dispositions. That bucket is 7.

## The seven carrier declarations, and what each resolved to

| rule | declaration | resolution | why not stronger |
|---|---|---|---|
| `cli-output-handling` | `hook:rtk-wrap` | observer | `fail_closed: false` |
| `delegation-policy` | `hook:delegation-nudge` | observer | `fail_closed: false` |
| `source-discovery-gate` | `hook:source-first-gate` | observer | `fail_closed: false` |
| `external-code-graph-interop` | `hook:code-graph-nudge` | observer | `fail_closed: false`, default-OFF |
| `legal-safety-floor` | `validator:src/scripts/lint_legal_pack.ts` | local-only | no workflow invokes it |
| `roadmap-ci-steps-policy` | `validator:src/scripts/lint_roadmap_ci_steps.ts` | local-only | no workflow invokes it |
| `token-budget-discipline` | `validator:src/scripts/lint_token_budget_discipline.ts` | local-only | no workflow invokes it |

The instrument performed the downgrades itself: a `hook:` declaration whose
manifest entry is `fail_closed: false` resolves to `observer` with a note, and a
validator no workflow runs resolves to `local-only`. Nothing here was
self-graded.

`consistency.yml:159` states the reason the three validators are local-only in as
many words: **"no workflow invokes `task ci`"**.

## The six that were NOT declared, and why declaring them would have been worse

A declaration that resolves to `unwired` is a *defect class* in this instrument —
the D1 class — not a neutral record. Four rules have a plausible carrier that
**nothing runs**:

| rule | claimed carrier | reachable from |
|---|---|---|
| `history-discipline` | `src/scripts/lint_persistence.ts` | **nothing** — not a workflow, not a taskfile, not a config |
| `scale-discipline` | `src/scripts/lint_persistence.ts` | **nothing** — not a workflow, not a taskfile, not a config |
| `runtime-safety` | `src/scripts/lint_skill_frontmatter_safety.ts` | **nothing** — not a workflow, not a taskfile, not a config |
| `cross-source-consistency` | `src/scripts/bench_cross_source_eval.ts` | **nothing** — not a workflow, not a taskfile, not a config |

That is a finding in its own right and the more useful half of this pass:
**three linters exist in `src/scripts/` and no workflow, taskfile or config
invokes any of them.** Declaring their rules would have moved four rows out of
`undeclared` and into `unwired`, trading an honest gap for a recorded defect.

Two more were left undeclared for a weaker but sufficient reason — the carrier
was plausible and unverified:

- `low-impact-corpus-privacy-floor` → `_lib/knowledge_global_redaction.ts` is a
  library the corpus CLI imports, not a gate over the rule's obligation.
- `media-sync-ground-truth` → `validate-vocal-map.sh` is invoked from a command
  body, not from a gate.

Over-assigning `already-carried` is the single failure that would make this
exercise false, so the bar was "I read the carrier and it enforces the
obligation", not "the name appears nearby".

## The kernel six

`_lib/kernel_rules.ts` names nine kernel rules. Three (`language-and-tone`,
`non-destructive-by-default`, `verify-before-complete`) already declare
enforcement and are not in the cohort. The remaining six are:

| rule | would it be `instruction-only` if the field could be written |
|---|---|
| `agent-authority` | yes — it is a priority index over four other rules; it carries no obligation of its own that a gate could read |
| `ask-when-uncertain` | yes — one-question-per-turn is transcript-visible, but the antecedent (*was the agent actually uncertain*) is not |
| `commit-policy` | **no** — `block_unauthorized_git` already reads the authorization ledger and denies; this one has a real carrier it cannot name |
| `direct-answers` | mixed — Iron Law 3's reply-close is probeable (`probe_promissory_closing.ts` exists), Iron Law 2's no-invented-facts is not |
| `no-cheap-questions` | yes — the Pre-Send Self-Check is a suppression decision, and a question that was correctly not asked leaves nothing behind |
| `scope-control` | **no** — the git-ops half is carried by the same ledger guard as `commit-policy` |

`block_kernel_rule_writes` denies an agent write to any of the nine
(`_lib/kernel_rules.ts:24`), which is why this is a list rather than a change.
`stubs/road-to-kernel-instruction-only-migration.md` owns the one live case.

**Two of the six would NOT be `instruction-only`** — they have carriers they are
structurally prevented from naming. That is a sharper statement than "the kernel
is unclassifiable", and it is the one worth carrying forward: the guard is
suppressing two true declarations, not nine unknowns.

## Residual

68 rules remain undeclared: **56 `cheaply-probeable` + 6 `structurally-blocked` +
6 carrier-plausible-but-unverified** = 68. The sums close.

## Phase 2 — the ranking, and the one probe it earned

**2.1, and the ranking is lopsided enough to make the decision for us.** Of the
56 rules in `cheaply-probeable`, exactly **one** carries a cited measurement of
its own failure:

| rule | measurement | cited at |
|---|---|---|
| `user-interaction` | *"every malformed ask was a one-line parenthetical or a trailing free-text offer"* — 30-session conformance audit, 2026-08-06 — and **no gate ships** for that class | `src/rules/user-interaction.md:75` |

Two others contain the word *measured* about something that is not their own
failure rate (`command-suggestion-policy`, `token-efficiency`). **1 with a
measurement, 55 without** — the roadmap's 2.1 predicted the no-measurement group
would be the larger one, and it is larger by 55×.

**One correction to 2.1's own text.** It cites `session-canary.md:105` (opening
canary dropped on 24 of 29 task starts) as a second measured rule. That rule is
**not in this cohort** — it already declares enforcement, so it was never
undeclared. The citation is a valid example of a measured obligation; it is not a
second candidate for this bucket.

**2.2 — one probe, for the top-ranked rule.**
`src/scripts/probe_unblocked_ask.ts`, a third instance of the shipped
transcript-probe pattern. It measures what `check_reply_consistency` structurally
cannot: an assistant hand-back that **hands a decision with no numbered-options
block**, and whether a recommendation label follows it.

Measured over the 40 most recent sessions in this project's store:

```
  hand-back turns          117
  …with a numbered block   36   (excluded — check_reply_consistency reads that surface)
  …unblocked asks           4   3.4% of hand-backs
  …of those, malformed      4   100.0% of unblocked asks
```

**All four are the exact shape the 2026-08-06 audit named** — `sag Bescheid,
wenn …`. The instrument reproduces that audit's finding independently, on a
different corpus, without being told what to look for. The class is rare and,
when it occurs, malformed every time — which is what *"no gate ships for this
class"* predicts.

The figure is a **ceiling**: "hands a decision" is a heuristic, a rhetorical
question can match it, and a recommendation is matched on its label. Both bounds
are printed by the probe rather than left to the reader.

`--self-test` covers 7 cases, 3 positive and 4 negative. The negatives are the
load-bearing half — an instrument that fires on everything measures nothing.

**2.3 — stopped at one.** No second probe was built.

## Phase 4 — the ratchet, and a defect it exposed in its own instrument

The blocker `is-a-declaration-worth-anything` recommended **(c)**: decide once
Phase 1 has produced the distribution. The distribution decides it — **(a)**.

A ratchet on `undeclared` would gate a constant only if most of the 82 were
genuinely unobservable. **Seven are.** The other 75 are either already carried,
probeable, or blocked by a guard rather than by nature, so the number can move,
and it just moved by 14.

`check_enforcement_coverage --check` already carried a ratchet. It now also
guards `undeclared`, shrink-only. Sabotage-verified: removing one
`instruction-only` declaration produces
`undeclared rules rose: 68 → 69` and exit 1; restored, exit 0.

**And landing Phase 1.3 exposed a defect in that ratchet, which is the more
interesting half.** Two of its existing checks fired on this change:

```
· frequency gaps rose: 9 → 14 (a rule's carrier no longer fires often enough…)
· validators fell back to taskfile-only: 0 → 3 (a gate left .github/workflows/…)
```

**Neither happened.** No carrier fires less often and no validator moved. A rule
with no declaration has no carrier, so it can contribute to neither counter —
which means **declaring a rule truthfully can only raise both**. Both compare
against a baseline taken when the rule was invisible.

So the instrument punishes honest declaration, and the punishment scales with how
much honesty a change lands. The sanctioned response is the one its own failure
message names — regenerate the baseline — and the obligation added here is that a
change doing so **says why**, because a regenerated baseline and a hidden
regression are indistinguishable in a diff. The reasoning is written into
`check_enforcement_coverage.ts` beside the new check, not only here.

`undeclared` does not have that asymmetry, and that is why it is the only one of
the three that is a true shrink-only ratchet.
