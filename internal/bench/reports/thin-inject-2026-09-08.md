# thin-inject — the four endpoints, re-scored after the R2 completion review

> Run **2026-09-08** on `drain/delivery-for-every-host` @ `80769d76a`, base
> `origin/main` @ `2cc536be2`.
> Pre-registration: [`../thin-inject-PREREG.md`](../thin-inject-PREREG.md).
> Reproduce: `./scripts-run src/scripts/model_rule_injection --endpoints`.
> Corpus: `tests/eval/routing-matrix/`, frozen — 101 labelled rules, 330
> positives, 212 near-misses. No metered call was made for any figure below.

> **This licenses delivery equivalence and cost. It does not measure behavioural
> equivalence; that instrument is closed (ADR-202) and this run does not reopen
> it.**

## Why this file exists rather than an edit to the 2026-08-23 report

R2 finding 7 on PR #1923: `docs/CLAIMS.md` credited the re-measured 2026-09-07
figures (616/616 byte-equal, 101/101 reachable, 0 of 212 near-misses, $0.7167 vs
$4.0401) to `thin-inject-2026-08-23.md#endpoints` — the same pointer that carries
**579/579 and 94/94** over a 94-rule corpus with 194 near-misses. That report was
not among the branch's changed files and could not have carried the newer numbers.
`check_claims` only checks that a pointer RESOLVES, so the row stayed `backed`
while its evidence predated the measurement it was credited with. Editing the
older report would have destroyed the record of the run it does describe, so this
is a new artefact and the pointer moves to it.

## Result: 4 of 4 endpoints hold

```

  PASS (a-delivery) delivery census — injected body byte-equal to the eager projection
       reading: 591 deliveries byte-equal, 0 not
       bar:     zero tolerance: unequal == 0
  PASS (b-recall) per-rule recall floor — no labelled rule left unreachable
       reading: 101/101 rules reachable; unreachable: none; partial: none | shipped user_prompt_submit reach (open_files IGNORED): 98/101; reachable only via a path trigger: design-review-after-ui-write, source-of-truth, ui-audit-gate (of which thinned, i.e. at no scope on that route: none)
       bar:     unreachable == 0 (a rule with zero matched positives is a rule the mode removed)
  PASS (c-false-fire) false-fire ceiling — a near-miss never delivers its labelled rule
       reading: 0 of 212 near-miss prompts fired
       bar:     falseFires == 0
  PASS (d-price) price — delivery below eager at 50 turns x 5 spawns
       reading: delivery 0.7047 USD vs eager 4.0497 USD
       bar:     delivery < eager

endpoints: 4/4 hold
```

`--selftest`: **4/4 rejecting cases green** — a one-byte payload mutation flips
(a); removing a rule's triggers flips (b); a planted firing near-miss is counted
by (c); an empty router scores zero recall over all 330 positives. Every endpoint
rejects a planted defect before its reading is reported.

## What moved since 2026-09-07, and why

Two changes on this branch move three of the four readings. Both are R2 fixes and
neither is a corpus change — the corpus is frozen and untouched.

**(a) 616 → 591 deliveries, and (d) $0.7167 → $0.7047.** `CAP_BYTES` was lowered
20,480 → 16,384 B (R2 finding 3): the concern's own cap and the
`user_prompt_submit` slot sum had been the same statistic in two units, leaving
one concern licensed 25 % above the whole slot's registered sum. Reconciled
downward onto owner ruling E2's number. `selectForInjection` therefore withholds
more bodies on large fires — measured over the same corpus: fires truncated
33 → 45, bodies withheld 63 → 88, p90 fire 16,865 → 14,507 B, max
20,406 → 16,348 B. Fewer bodies delivered is fewer delivery comparisons and a
lower price. **This is a delivery reduction, not an improvement**, and (a)'s bar
is unequal == 0, which is unaffected by how many were delivered.

**(b) gains a second reading.** The pre-registered bar is scored with `open_files`
HONOURED and is unchanged at 101/101. That is the reach of the MECHANISM and not
of the SHIPPED BINDING: `rule-inject` is bound on `user_prompt_submit` +
`pre_compact` only, and `user_prompt_submit` never populates `openFiles`, so a
rule whose only matching positives carry `open_files` was credited as reachable
while no shipped slot could deliver it on that route. The endpoint now publishes
the same recall with `open_files` ignored — **98/101** — and names the three rules
that differ. All three are path-only and are kept full-bodied by
`project_thin_rules.path_only_ids`, so they are reachable by projection rather
than by delivery, and **no thinned rule is unreachable**. R2 finding 1.

**One false miss was removed in the same change.** `loadCorpus` dropped the
corpus `command:` field, so the two `command`-triggered positives
(`roadmap-progress-sync`, `user-interrupt-priority`) scored as unmatched plain
prompts. With the field parsed, `roadmap-progress-sync` leaves the shipped-reach
miss list. The two errors ran in opposite directions and had been cancelling.

## What these readings do NOT cover — the residue, named

18 rules carry BOTH path-shaped and non-path triggers and are all thinned, so
their path-shaped half has no carrier. They are not in (b)'s difference column
because each also has at least one prompt-matching positive, which is exactly why
the labelled corpus cannot see the loss. Under `eager-all` these 18 loaded
unconditionally on Claude Code — `src/install/claudePathsPlan.ts:250` emits no
`paths:` for a mixed-trigger rule on purpose — so what is lost is the difference
between unconditional and prompt-triggered, not a route that existed and was
removed. Names, measurement and the two owner-reserved closures:
`agents/roadmaps/stubs/road-to-a-path-route-under-delivery.md`.

## Council

NOT consulted for any judgement in this file: both enabled seats read 50/50
exhausted on 2026-09-08 (`./scripts-run src/scripts/council_cli quota`). Every
number above is a reproduction of a command in this tree, so nothing here rests
on a seat's opinion.
