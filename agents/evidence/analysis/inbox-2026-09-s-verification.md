<!-- evidence-type: analysis -->
# Inbox round 2026-09-s — verification and disposition

> Analysed 2026-09-06 against `main@9b75231ed`. One topic folder, 4 files,
> 2,333 lines: an owner prompt, a 1,966-line deep roadmap from one session, a
> 246-line consolidated master proposal from a second, and a provenance annex
> marked not-for-the-repo.
>
> **This is the first round of three whose leading proposal is adoptable.** Its
> own conclusion is why: it ran the external skill as a **test corpus against
> this tree's detector** rather than as a rule list to import, and every item it
> raises starts from a defect it measured here. That inversion is what the two
> previous rounds' eleven proposals lacked.

## Triage

| file | genre | age | drafted-against | recurrence | lineage | disposition |
|---|---|---|---|---|---|---|
| owner prompt (71) | transcript | same day | unstated | n/a — the request itself | n/a | read; carries three plaintext repository URLs that stay in the gitignored tree |
| master proposal (246) | external-review (consolidated) | same day | `6af83a64` — real, one merge behind HEAD | humanizer subject: 15 consumed rounds | n/a | deep-read, verified here |
| deep roadmap (1,966) | external-review | same day | `6af83a64` | same subject | n/a | deep-read, delegated |
| provenance annex (50) | — | same day | — | — | — | **not opened**; its own title says it is not for the repo |

## What did not survive verification

| claim | source | verdict | evidence |
|---|---|---|---|
| the humanizer has no evidence discipline, so one must be built (§10/§11 and Phase 5 of the deep roadmap) | deep roadmap | **never-true** | `src/scripts/bench_humanizer_eval.ts` is a paired, length-controlled eval with a deterministic per-pair A/B seed and a spend gate; `docs/CLAIMS.md:466-471` registers the claim **with its own scope limit** ("real-world lift is unmeasured"); the blocker naming that is open at `agents/roadmaps/archive/road-to-humanizer-hardening.md:168`. The file demands an honesty discipline that is documented more sharply than its own. |
| six absolute-rule gaps — all adverbs, passive, wh-openers, em-dashes, three-item facts, human subjects (§4.1–4.6) | deep roadmap | **never-true** | none was ever a rule here. A probe file built from all six categories, including the file's own verbatim examples, scores `hard 0 · cluster 0`. |
| the eleven "what not to build" items (§26) | deep roadmap | **already-fixed** | every one is a shipped exclusion — detector-evasion and shipped-ML-detector at `src/skills/humanizer/SKILL.md:128-142`, zero-em-dash at `:216-217`, docs CI-gate refused in the scanner's own header, no authorship probability by construction. §26 is a description of the present tense written as an imperative. |
| `14-product-philosophy.before` keeps its rule-of-three hit | master | **never-true** | that fixture scores `per_pattern: {}`. Five other seeded fixtures do carry the rule (`01-gtm-post`, `04-blog-paragraph`, `07-event-recap`, `11-hiring-post`, `15-talk-recap`); the acceptance criterion was rewritten against those. |
| the marketplace listing misattributes the skill (D12) | master | **unverifiable** | an external listing; the network is out of bound for this phase, and it stays out. |
| the external 35/50-score ablation found no benefit (deep, line 352) | deep roadmap | **unverifiable** | an external measurement with no artifact here. It carries argumentative load in two sections and may not. |

Nine further items of the deep roadmap are `already-fixed` rather than open —
its evals directory, its trigger near-misses, six of its eleven German patterns,
its technical-prose skip, `--json`, half of its apply/judge split and half of its
model provenance. After that subtraction roughly a third of the file is a rebuild
of what ships.

## What survived, reproduced here by running the detector

| defect | reproduction at `9b75231ed` |
|---|---|
| **precision** | `We shipped apples, pears, and plums. We track revenue, churn, and margin. The team is Alice, Bob, and Carol.` — 19 words of ordinary English — scores `cluster 39.47/500w` against a cap of 3 and **exits 1**. `tell-rule-of-three` matches every Oxford-comma list. |
| **no short-text floor** | `Not a tool — a system.` scores `dashes 83.33/500w` against a cap of 2 and **exits 1**. |
| **documentation drift** | `src/skills/humanizer/references/anti-aiisms.md:80-93` lists five bounds and says the deterministic subset is enforced by the scanner. Three of the five are implemented nowhere: six consecutive short declaratives score `hard 0 · cluster 0`. |
| **German recall** | six German tells in one paragraph score `hard 0 · cluster 0` under `--language de`; four DE rules exist and `tell-de-negative-parallelism` requires the literal `nicht nur`. |
| **no clean corpus** | `tests/fixtures/ai-tells/` holds 40 files, all seeded pairs, no `clean/`. The design side ships the template — `internal/bench/corpora/design-slop-clean/` with **32** files and a pre-registration — and the prose side does not. |
| **no tune/holdout split** | `bench_humanizer_eval.ts:66-89` reads every fixture into one array, so overfitting to 20 pairs is not excluded by construction. |
| **no decision record** | 198 ADRs under `docs/decisions/` and a grep for `humaniz\|prose.tell\|anti-slop\|em.dash` over all of them returns **zero**. The verdicts governing a shipped, default-on surface live in one archived roadmap and in code comments. |
| **no audit-only mode** | `src/domains/gtm-marketing/humanize/command.md` step 4 always prints the rewrite; `audit-only`, `--audit`, `dry-run` and `findings-only` return 0 matches. |

The last two are this run's own, in neither proposal. The missing decision record
is the more consequential: it is the most plausible reason two independent
external sessions treated a settled question as open, and one of them proposed
re-litigating it.

## The point ledger

```
claims         70 extracted → 52 still-true / 10 already-fixed / 4 never-true / 4 unverifiable
instructions    7 selected  →  4 reproduced /  3 diverged / 0 unexecutable / 0 out-of-bound
                              rest not-attempted (selection)
demands        14 extracted →  6 adopted / 3 already-satisfied / 3 declined / 2 owner-decision
```

**Instructions: seven selected, and four reproduced — the first round where any
did.** Both proposals state probes with asserted outcomes, which is Phase 4b
criterion (a). Four came back as the file expects: the staccato probe, the German
probe, the README house-style probe (`words 4588 · hard 0 · dashes 13.08/500w`,
exact), and the deep roadmap's six-category absolute-rule probe. Three
**diverged**, all on figures rather than mechanisms: the rule-of-three sample
scores 39.47/500w here against the stated 32.61, the short-text sample 83.33
against the stated 125, and the fixture named as keeping its hit has none. The
mechanisms hold in all three; the roadmap carries the measured figures and the
corrected fixture names, tagged `corrected-from-reproduction`.

**Demands: the three declines.** The two new commands belong to the `analyze:*`
cluster, which ships in the non-default `analysis-workbench` pack while the
humanizer sits in `gtm-marketing` — a consumer with the humanizer would not have
them, so the placement is declined and the capability is not. A `severity:
"medium"` field in the detector JSON is declined: the machine axis is
deliberately two-valued and the three-valued axis is editorial, and merging them
would erase that distinction. And the statistical drift loop is declined in the
form proposed, because turning measured frequency into a ban is the rejected
blanket rule reached by another route.

## Recurrence

The humanizer subject appears in **15** consumed inbox rounds under
`agents/tmp.old/` (distinct round directories, measured 2026-09-06); the
narrower tell phrasing in 5. The counter is now written on
`agents/roadmaps/archive/road-to-humanizer-hardening.md` — an archived file on
purpose, because the blocker a later round needs is the open one there. The four
detector defects above are new and were raised by no earlier round.

## The council verdicts, honoured without being cited

Both proposals reject exactly the six absolute rules this repository rejected on
2026-07-11 (`agents/roadmaps/archive/road-to-humanized-writing.md:28-60`), and
the deep roadmap lists the documentation CI-gate under "do not build" itself.
Neither cites the record — a grep for `council` or the date over the 1,966-line
file returns nothing. They re-derived it. That is a re-derivation finding rather
than a violation, and it is the same observation as the missing ADR, seen from
the other side.

## One owner decision

Whether real drafts written through step 4b may be collected at all — carried as
a blocker on `agents/roadmaps/road-to-measured-prose-tells.md` with three named
outcomes, one of them text-free. Phases 1, 2 and 4 of that roadmap are
independent of it.
