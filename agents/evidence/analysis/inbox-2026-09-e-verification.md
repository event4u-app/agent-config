<!-- evidence-type: analysis -->
# Inbox round 2026-09-e — verification and disposition

> Analysed 2026-09-04 against `main@56aa348b3`, which is the exact baseline the
> round was drafted against. Three files, one of them a 7,690-line concatenation
> of roughly eleven independent model reviews of release 14.16.0.
>
> Every claim below was re-derived from this tree. Where a figure came only from
> the round, it is marked `unverifiable` rather than adopted.

## Triage

| file | genre | drafted-against | recurrence | lineage | disposition |
|---|---|---|---|---|---|
| `chat.txt` (7,690 lines) | external-review, ~11 voices | `56aa348b` (exact) | see below | n/a | deep-read, 6-way parallel extraction |
| `road-to-cross-corpus-parity-v14.md` | external-review (comparative audit) | `56aa348` | 4th audit of D-A; 7th of the flip watch | declares v13 as parent, present in `tmp.old` | deep-read |
| `w1-status-update-v14.16.0.md` | external-review (status) | `56aa348b` | 6th flat-estate round | n/a | read; no independent claims |

The round directory arrived under a speaking name and was renamed before any
file was quoted, per `/analyze:inbox` Phase 1 and `source-confidentiality`. The
first opaque id chosen, `inbox-2026-09-a`, **collided** with a round consumed on
2026-08-31 that already held it — dated ids are not unique and `agents/tmp.old/`
must be checked before one is taken, or the `mv` nests the new round inside the
old one and every tracked `Source:` line points at the wrong set. Corrected to
`inbox-2026-09-e` before the first commit. No encrypted source token is recorded because the
source is the maintainer's own review pipeline, not an external project.

## What the round is, structurally

Eleven reviews of one release. Scores cluster between 9.9 and 9.99 out of 10,
with one outlier at ~8.4 — and the outlier is the one that produced most of the
findings below. High agreement on praise is weak signal; the disagreement is
where the information was.

## Verified findings that became roadmaps

### F-1 — Two negation grammars, one of them unhardened → `road-to-one-negation-vocabulary`

**still-true, reproduced.** `isRevocation` (`git_authorization_hook.ts:675-681`)
carries its own forward-only negation regex while `classifyAuthorization`
(`:930`) uses a clause-scoped check evaluating the clause before, the match, and
the clause after (`negatedBefore`, `:915-927`). Measured by calling the shipped
module:

```
"Merge PR #12 auf keinen Fall."      isRevocation=false   classifyAuthorization=[]
"Merge #12 under no circumstances."  isRevocation=false   classifyAuthorization=[]
"Merge PR #12? Actually, don't."     isRevocation=false   classifyAuthorization=[]
foldGrants, prior [[12]] → after "Merge PR #12 auf keinen Fall." → [[12]]  SURVIVES
```

`NEGATION_WORD`'s own docblock (`:743-748`) states the rule the second grammar
breaks: *"ONE vocabulary for the whole file, deliberately."* The gap fails in
both directions — `"Please do not push, but merge PR #7."` produces
`classifyAuthorization=["pr-merge"]` and `isRevocation=true`, a direct
contradiction on a corpus row asserted green.

Not owned by any roadmap or stub. The negation corpus (20 rows) is fed only to
`classifyAuthorization`.

**This is also the un-dispositioned high finding `64d61651eff3` from PR #1836.**

### F-2 — Release 14.16.0 has no findings ledger → `road-to-the-unwritten-ledger`

**still-true.** PR #1836's gate comment reports ten findings, one
`high (Blocking)` security, and carries them in an intact machine block.
`agents/evidence/release-findings/` holds only `14.15.0.json` and `9.14.0.json`.

```
$ npx tsx src/scripts/check_finding_dispositions.ts --release 14.16.0
✅  no recorded findings for 14.16.0 (ledger absent)      exit 0
```

An absent ledger for a released version reads as zero findings. This is one level
above the ordering defect `road-to-release-finding-ordering` owns: that one is
about *when* the consumer reads inside the pull-request workflow; this is a
post-tag read with no workflow involved, reproducible locally with no
`release/*` branch and therefore outside the Hard Floor that parked the sibling.

Two of the ten findings repeat classes the 14.15.0 ledger recorded as `fixed`.

### F-3 — Three defect classes fixed at one site each → `road-to-defect-population-sweeps`

**still-true, counted.**

- Commit `1cf8f708` ("stop swallowing a failed write") repaired two sites in
  `git_authorization_hook.ts` and wrote a rebuttal of the phrase
  `/* observability only */` into the code. That exact phrase still guards a
  swallowed `atomic_write_json` at `hooks/block_unauthorized_git.ts:934-936`
  (with a `see above` pointing at nothing local) and at
  `hooks/evidence_independence.ts:366-370`. Population: 26 hook files with write
  calls, 33 silent `catch {` blocks.
- `tests/scripts/git_auth_destructive_coverage.test.ts` is a frozen table of 25
  operations probed on one date, covering one guard, enumerating nothing from a
  truth source.
- Of four "claims a property it does not satisfy" fixes in the 14.16.0 window,
  exactly one shipped a resolver (`2bd8e506` →
  `accessibility_wcag_version_claim.test.ts`); the other three are prose, a
  fixture, and doc edits.

### F-4 — The most-repeated finding is routed to the wrong lock → `road-to-the-tenth-arrival`

**still-true, and the routing error is new.** The activation/eager-all finding
has now arrived ten times. `inbox-2026-09-d-disposition.md:78-102` routes it to
`b-behavioural-bench-spend` — *"spend-bearing and therefore owner-reserved."*
That blocker gates whether the remaining 15 always-on rules cost behaviour
(`road-to-mixed-trigger-activation-cost.md:516-536`), not the mode flip.

The flip's own recorded holds are three: the activation charge (two slot-sum rows
in `src/config/hook-token-budget.json`, whose own reason names the flip as the
run that must move them), Claude-only scope, and an authority question. The
trigger corpus sub-item is held by nothing and inherited a blocker by
association.

Put to the AI council 2026-09-04 (anthropic/claude-sonnet-4-5 +
openai/codex-default, 2 rounds, quorum 2/2, subscription-authed, $0.00):
**both seats found the routing error and both chose split-into-three.** codex:
*"the disposition uses a spend lock from an adjacent workstream to halt the
delivery-mode workstream. That is a routing error."* Recorded disagreement: codex
holds that landing the budget-policy rows may still need maintainer review even
though it is not spend; the anthropic seat added the sequencing correction that
the rows must be sized *after* trigger coverage is measured, not before.

### F-5 — Residue of settled decisions → `road-to-decided-but-not-done`

**still-true.** `.agent-memory/hits.jsonl` is read live by
`src/scripts/_cli/explain_last/memory.ts:40` and written by nothing in the tree
except a test fixture that exists to exercise the reader; ADR-094 removed that
layer. `src/scripts/attest_artifact.ts` has zero importers outside its own test
at its fourth consecutive external audit, and ADR-220's two reopen conditions are
both unfired. Two artefacts record a limitation as *"Carried to the follow-up"*
with no receiver findable anywhere under `agents/roadmaps/`.

### F-6 — A rule asked for twice, neither built nor declined → `road-to-meta-ratio-measured`

**still-true.** *"kein Meta-Verwaltungs-Feature ohne Anwender-Artefakt im selben
PR"* was asked in two consecutive cycles. Verified: no such rule or gate exists
in `src/rules/`, `docs/contracts/` or `.github/workflows/`; nothing owns it;
`check_estate_count` caps the *number* of active roadmaps and is silent on the
mix; `inventory_meta_layers.ts` is read-only.

Put to the AI council 2026-09-04 (same two seats, 2 rounds, quorum 2/2, $0.00):
**both seats declined the per-PR gate and specified the same replacement.** The
grounds converged — codex: *"a same-PR gate measures packaging, not progress"*;
the anthropic seat: the predicate rejects legitimate work (a CI fix, a dependency
bump, an analysis round that produces only roadmaps) by construction. Both
refused to pick a threshold on one observed cycle, and both noted the reviewer's
"more than half the cycle" carries no denominator.

The replacement is a release-level four-bucket classifier read from changed paths,
two published views, a baseline over two releases before any number, and a
mandatory written response when governance-only commits outnumber consumer-only
ones.

## Prevented — claims that did not survive verification

### P-1 — The stderr leak is a false positive, and was already adjudicated

One reviewer's single strongest ask was *"Prüf, ob 7aee57d1 gefixt oder geparkt <!-- md-language-check: ignore -->
ist"* — a high-severity claim that the Stage-2 impact scan pipes unsanitised diff
content into the hook's stderr refusal.

`7aee57d1` is **not a commit**. It is the first eight characters of finding id
`7aee57d1e98e`, dispositioned `false_positive` in
`agents/evidence/release-findings/14.15.0.json:12-19`. The property was verified
empirically at disposition time and is now pinned by
`tests/scripts/merge_impact_closed_vocabulary.test.ts`, which drives the real
`classifyDiff → describeImpact` pipeline over a patch carrying `ghp_…`,
`AKIAIOSFODNN7EXAMPLE`, a POSIX home path, a Windows path and an internal URL,
and includes a sabotage case that must fail if diff text is ever interpolated.
Re-run in this worktree: **7/7 green**.

Every variable in the refusal message resolves to a literal or an integer:
`impact.markers` comes from a closed 8-entry table, `impact.reason` is one of
four literals, `filesChanged` is a count, and subprocess stderr is discarded
(`merge_impact.ts:203`, `stdio: ["ignore","pipe","ignore"]`). The one residual
the ledger already names — `filesChanged` is patch-derived — reveals size, not
content.

Three reviewers searched the commit log for a finding id. That is a legible-id
problem, and it is `road-to-the-unwritten-ledger` step 2.3.

### P-2 — Already owned, no new artefact

- `README.md:486` "Zero overhead by default" surviving the ADR-249 retirement —
  owned by active `road-to-checklist-rows` Phase 4.
- Python-era doc references — closed and archived inside the reviewed window.
- Design-slop side-stripe detector gaps, catalog id ranges, `transition-all` in a
  Good Example — all are findings on PR #1836 and become ledger dispositions in
  `road-to-the-unwritten-ledger` Phase 1.3, not separate roadmaps.

## Owner-reserved — surfaced, not built

Nothing below is agent-doable. Each is named so the eleventh round meets a state
rather than a fresh argument.

| item | why reserved | evidence |
|---|---|---|
| Make the self-review gate enforcing | Blocker `self-review-gate-cost`: requires the API secret, a per-PR budget, and turning the check required in branch protection. Two consecutive releases merged with a `high (Blocking)` finding; `--enforce` exists as a one-flag path | `src/scripts/self_review_gate.ts:23-26`, `gateVerdict` `:85-88` |
| **ADR-134 expires 2026-09-15 — eleven days** | The record's own `review_trigger` says a lapsed expiry with neither a post nor a superseding ADR "is an open compliance finding for the next review cycle, not a silent extension". Zero commits have touched it since creation | `docs/decisions/ADR-134-launch-decision-dated-defer.md:10-17` |
| Generalising target-bound grants beyond `pr-merge` | ADR-252 refuses it by name and classifies the exemption as lowering a security floor: `reopen_policy: owner`, `protected_dimensions: security_floor`. The companion amendment is a kernel-rule edit `block_kernel_rule_writes` denies | `ADR-252:9-11, 40, 158-163, 186-188` |
| The `lean_projection.mode` flip itself | Shipped consumer-facing default; the 2026-08-23 council flagged the authority question as "genuinely close" | `road-to-the-tenth-arrival` Phase 3.3 prepares the packet |
| `b-behavioural-bench-spend` | Spend-bearing paired A/B run | stays on `road-to-mixed-trigger-activation-cost`, unmodified |

## Declined — recorded so it is not re-proposed

- **A cross-surface semantic-consistency engine / global coverage engine.** Asked
  for in one form and warned against in another by the same round: *"Ich würde <!-- md-language-check: ignore -->
  daraus aber keine neue globale Coverage Engine machen"*, *"Allerdings will ich
  daraus NICHT sofort noch einen allgemeinen Consistency Engine bauen."* <!-- md-language-check: ignore -->
  `road-to-defect-population-sweeps` Phase 3 takes the narrow version instead —
  three measured claim kinds with a planted-negative test.
- **A "Structured Operation Authorization Core" as the next build.** Requested by
  several voices, and by the same voices coupled with *"Keine neuen Authorization-
  Dimensionen, bevor der aktuelle Stack konsolidiert ist"* and a six-item
  do-not-build list. Building a new core while freezing dimensions is
  self-contradictory. `road-to-one-negation-vocabulary` takes the
  freeze-compatible half: two parsers become one.
- **Persistent Code Intelligence, Episode Controller Convergence, event-driven
  wait/resume, candidate-aware runner.** Genuine and repeatedly named — Code
  Intelligence for the third review running. Each is a structural programme, not
  an inbox item, and writing four aspirational roadmaps would add four active
  entries to an estate whose growth the same round criticises. Named here as
  unowned rather than planned.
- **A Council Deletion Review over the nine council mechanisms.** Reasonable and
  unowned; declined this round only because `road-to-council-topology-evidence-followups`
  is already the active carrier in that area and cannot close by a recorded
  verdict. Re-propose against that carrier, not as a new roadmap.

## One tension this round leaves in place

This analysis answers a round that criticises estate growth — *"Estate wächst <!-- md-language-check: ignore -->
weiter"*, estate simplicity scored down 4.5 → 4.3 — by adding **six** active <!-- md-language-check: ignore -->
roadmaps, taking the estate from 4 to 10. That is the pattern the criticism
names, and stating it is cheaper than the reading that nobody noticed.

Three things bound it rather than excuse it. Each roadmap carries an
`estate_growth_exempt` reason naming what parking it costs, which is the tree's
own mechanism for claiming growth rather than evading the ratchet. Five of the six
are single-shape and small — a parser, a ledger, three counted sweeps, three
residues — and each has acceptance criteria a reviewer can fail. And the sixth,
`road-to-meta-ratio-measured`, is precisely the instrument that would make this
tension a published number next time instead of a sentence in an evidence file.

The honest version of the ratio is that this change is 100 % governance by the
classifier it proposes. The first reading it takes should say so.

## Reproduction table (Phase 4b)

| # | step, as the round states it | verdict | what was observed |
|---|---|---|---|
| 1 | "Prüf, ob `7aee57d1` gefixt oder geparkt ist" | **diverged** | Not a commit; a finding id, dispositioned `false_positive`, property pinned by a test that runs 7/7 green | <!-- md-language-check: ignore -->
| 2 | `isRevocation("Merge PR #12 auf keinen Fall.")` should revoke | **reproduced** | `false`; `foldGrants` leaves `[[12]]` intact |
| 3 | `check_finding_dispositions --release 14.16.0` | **reproduced** | exit 0, "ledger absent" |
| 4 | Grep the tree for a `.agent-memory` writer | **reproduced** | one hit, a test fixture |
| 5 | Grep for importers of `attest_artifact` | **reproduced** | zero outside its own test |
| 6 | `git log` for the 2026-08-25 attestation ruling the audit cites | **unexecutable** | no such ruling found in the archived parent roadmap or ADR-220; recorded as searched-and-not-found, not refuted |
| 7 | Run the self-review gate under `--enforce` against a release PR | **out-of-bound** | requires an API key and a synthetic `release/*` branch — Hard Floor |
| 8 | Re-derive "trigger corpus 100 of 299" | **diverged** | `grep -l 'triggers:' src/skills/*/SKILL.md` returns 27; the round's figure counts a different population, which is why `road-to-the-tenth-arrival` step 2.1 makes re-derivation a step rather than adopting the number |

Ceiling: none fired. Eight steps selected of the round's directives; the rest are
opinions or claims, handled above.

## Found while shipping this analysis — the gate cannot tell documented from introduced

The self-review gate ran over this change's own pull request: six roadmaps and one
evidence file, prose describing defects and introducing none. It reported **ten
findings, two `high (Blocking)` security**, each mapping 1:1 to a defect this
change *documents* — `5642305ff717` is the negation defect
`road-to-one-negation-vocabulary` exists to fix, `e2fb09a4665b` is the swallowed
write `road-to-defect-population-sweeps` counts.

This bears directly on the round's most-repeated P0. Making the gate enforcing
would, today, block every analysis pull request with the findings it was written
to record, and the way to pass would be to describe defects less precisely.
Carried as `road-to-the-unwritten-ledger` Phase 2b — a correctness precondition on
the `self-review-gate-cost` blocker that the round's reviewers did not have,
because none of them had run the gate over an analysis diff.

## Council rounds

| question | members | rounds | quorum | verdict |
|---|---|---|---|---|
| Is the activation finding routed to the wrong lock? | anthropic/claude-sonnet-4-5, openai/codex-default | 2 | 2/2 | Yes; split into three sub-items; only the shipped-default decision and actual spend stay owner-reserved |
| Adopt the "meta feature needs a user artifact in the same PR" rule? | anthropic/claude-sonnet-4-5, openai/codex-default | 2 | 2/2 | No — the predicate measures packaging and rejects legitimate work. Replace with a release-level four-bucket measurement, baseline over two releases, mandatory response, and record the decline in an ADR |

Both seats subscription-authed; $0.00 billed.
