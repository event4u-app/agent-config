# thin-inject — the four endpoints, scored

> Run **2026-08-23** against `origin/main` @ `e7c437fe5` plus this branch.
> Pre-registration: [`../thin-inject-PREREG.md`](../thin-inject-PREREG.md),
> committed at `2026-08-23 16:15:50 +0200`, before this file existed.
> Reproduce: `./scripts-run src/scripts/model_rule_injection --endpoints`.
> Corpus: `tests/eval/routing-matrix/`, frozen — 94 labelled rules, 305
> positives, 194 near-misses. No metered call was made for any figure below.

> **This licenses delivery equivalence and cost. It does not measure behavioural
> equivalence; that instrument is closed (ADR-202) and this run does not reopen
> it.**

## Result: 4 of 4 endpoints hold

```

  PASS (a-delivery) delivery census — injected body byte-equal to the eager projection
       reading: 579 deliveries byte-equal, 0 not
       bar:     zero tolerance: unequal == 0
  PASS (b-recall) per-rule recall floor — no labelled rule left unreachable
       reading: 94/94 rules reachable; unreachable: none; partial: roadmap-progress-sync 2/3, user-interrupt-priority 2/3
       bar:     unreachable == 0 (a rule with zero matched positives is a rule the mode removed)
  PASS (c-false-fire) false-fire ceiling — a near-miss never delivers its labelled rule
       reading: 0 of 194 near-miss prompts fired
       bar:     falseFires == 0
  PASS (d-price) price — delivery below eager at 50 turns x 5 spawns
       reading: delivery 0.7285 USD vs eager 4.0335 USD
       bar:     delivery < eager

endpoints: 4/4 hold
This licenses delivery equivalence and cost. It does not measure behavioural
equivalence; that instrument is closed (ADR-202) and this run does not reopen it.
```

## What each reading means, and what it does not

**(a) 579 deliveries byte-equal, 0 not.** Scored through the shipped concern's
own `buildInjection`, so what passed is the payload the model would receive —
not a file compared to itself. Sensitivity checked by sabotage: truncating the
payload by three bytes turns this row from 579/0 to **0/579** and flips both this
endpoint and `--selftest` to FAIL.

**(b) 94 of 94 labelled rules reachable, none unreachable.** Two rules land
partial and are named rather than averaged away:

| rule | recall | the missed prompt |
|---|---|---|
| `roadmap-progress-sync` | 2/3 | "Continue with the next open step of the plan." |
| `user-interrupt-priority` | 2/3 | "Process the whole roadmap without pausing between phases." |

Both misses are prompts carrying no distinctive trigger token — they describe an
intent the rule governs without using any word the rule declares. That is a
recall cost of exact-trigger matching and it is real; it is not an unreachable
rule, which is what endpoint (b) gates on. Whoever wants those two prompts
covered adds a trigger, and the corpus will say whether it also adds false fires.

**(c) 0 of 194 near-miss prompts fired.** No labelled near-miss delivered its
rule. The registered allowance was zero and the reading is zero.

**(d) delivery $0.7285 vs eager $4.0335** per 50-turn × 5-spawn session at
sonnet rates — a 5.5× reduction, driven by the standing corpus dropping from
120,582 to 18,573 exact-BPE tokens and by that corpus being re-written as
uncached input on every spawn. Assumptions in `sessionCostUsd`'s docstring.

## The two arms that were NOT run, and why

**subagent arm not run — 0.6 no.**
`agents/evidence/investigations/subagent-start-payload-probe.md` (2026-08-23,
claude 2.1.241) returned three negatives: the `subagent_start` payload carries
no prompt field, `user_prompt_submit` does not fire inside a child session, and
neither do the tool slots. There is no surface to census. Delivery is
orchestrator-only, and blocker `b-subagent-payload-trigger-match` closed on
that measurement.

**live host census not run — descoped by council decision, 2026-08-23.** Step
2.3 as written asks for 20 zero-tool-call prompts on the installed host, each
answered by asking the agent to quote the fired rule's first line and
exact-string-matching it. The council resolving
`b-behavioural-equivalence-unmeasurable` chose modified option B and judged
that cost not worth paying: endpoint (a) already establishes byte-equality
**deterministically and over 579 deliveries**, where a 20-prompt live census
would establish it stochastically over 20 — and the live arm additionally depends
on a self-report ("quote the first line"), which is a weaker instrument than a
byte comparison, not a stronger one.

Stated as the loss it is: the live arm would have tested the HOST's delivery of
the injected context, which the offline arm cannot see. That question is
untested, not answered. The concern's emission was verified by hand on both
slots (`user_prompt_submit` on a migration prompt, `pre_tool_use` on
`resources/views/x.blade.php`), which is one observation each, not a census.

## The council reading behind this run — DEGRADED, and said so

Council 2026-08-23, 2 members configured, **1 answered**; the second returned
`cli_quota_exhausted`. That is a degraded reading and not convergence, and it
is recorded here rather than in a footnote because the decision it produced —
skip the live census, make any flip conditional — is the one this report rests
on. The answering member's own hedge, verbatim: *"flag to owner for post-roadmap
review given the authority question is genuinely close."*

## Consequence for the shipped default

**The default does not move in this run.** All four endpoints hold, so the
delivery mode is licensed as delivery-equivalent and cheaper — and the flip
itself carries an unpaid activation charge that this run deliberately does not
pay: `rule-inject`'s registered 20,480-byte emission sits above the
4,096-byte `user_prompt_submit` and 2,048-byte `pre_tool_use` slot sums. Those
two rows are the flip's cost, the flip's run must pay them, and the authority
question the single council member flagged is the owner's.

**Latency is no longer part of that charge, and the correction is recorded
rather than the figure quietly swapped.** This section read "gate-open latency
p95 **87.8 ms** against 0.06–0.16 ms gate-closed" when it was written. That
87.8 ms was a `js-tiktoken` load, not delivery work: the cap was in exact-BPE
tokens and `_lib/token_count.ts` resolves the tokenizer at module load, so the
concern dragged it into every dispatch. With the cap moved to bytes the same
measurement reads **p50 0.52 / p95 0.61 ms** gate-open and **p95 0.04–0.05 ms**
gate-closed, and the whole-slot `pre_tool_use` p95 went 202 ms → 62 ms against a
175 ms budget.

`docs/CLAIMS.md` carries the entry, scoped to what these four endpoints
license and nothing wider.
