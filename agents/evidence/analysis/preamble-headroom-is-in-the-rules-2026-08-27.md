<!-- evidence-type: analysis -->
# The preamble ceiling has 4 tokens of headroom, and the skill catalogue is not where to find more

**Measured 2026-08-27** in a clean worktree at `origin/main` = `830e31aa3`, for
`road-to-database-erd-landing` blocker `erd-skill-cannot-clear-the-preamble-ceiling`.

The question this answers is narrow and was raised by an AI council seat as a
falsifiable test: *"If descriptions average 2-3 sentences when 1 clear sentence
suffices, trimming them isn't spending reduction on growth — it's fixing bloat.
Test: trim all 299 descriptions to one sentence. If that saves 2,000+ tokens, the
catalogue is bloated regardless of whether ERD lands."*

**The test was run. It fails. The catalogue is not bloated, and the headroom is
not there to be found.**

## 1. The headroom, re-measured

```
$ ./scripts-run src/scripts/check_preamble_payload_budget
  project-scope rules                      122611 tok
  preloaded skills catalog                  14851 tok
  CLAUDE.md hierarchy (project only)          746 tok
  measured total                           138208 tok (baseline 102520, +35688; ceiling 107646)
```

CI gates this with `--ceiling "$grace_ceiling"`
(`.github/workflows/standing-payload-delta.yml:131`) where
`src/config/preamble-payload-budget.json` sets
`ci_delivery.grace_ceiling = 138212`.

**Headroom = 4 tokens.** The same roadmap recorded **17** on 2026-08-24. The
figure fell by 13 tokens in three days with no reduction work in between, which
is consistent with the budget file's own recorded drift of ~+1,400 tokens/day
against a design ceiling of 107,646.

## 2. The catalogue is already capped, so there is nothing to trim

Measured over all 299 skills in `dist/agent-src/skills/*/SKILL.md`:

| Statistic | Value |
|---|---|
| Skills carrying a description | 299 |
| **Longest description** | **200 chars** |
| p90 | 195 chars |
| Mean | 177 chars |
| Median | 182 chars |
| Descriptions over 200 chars | **0** |

The distribution is flat against a wall at exactly 200. That is not an accident:
the description cap is already enforced at 200 characters, so the "2-3 sentences
where 1 would do" premise describes a corpus that does not exist here. **Every
description is already at or under one long sentence.**

What a *further* cap would buy, if one were imposed retroactively on all 299
skills:

| Hypothetical cap | Skills affected | Saving |
|---|---|---|
| 150 chars | 268 | ~2,084 tok |
| 120 chars | 299 | ~4,265 tok |
| 100 chars | 299 | ~5,760 tok |

Even the most aggressive of these — halving every skill's description across the
whole estate — recovers ~5,760 tokens. That is **16 % of the 35,688-token
overshoot** against the design ceiling, bought by degrading the one field that
decides whether a skill is ever selected. It is not a mechanism; it is a rounding
error paid for with routing quality.

## 3. Where the payload actually is

| Bucket | Tokens | Share of the gated total |
|---|---|---|
| project-scope rules (`dist/agent-src/rules/*.md`, 119 files) | 122,611 | **88.7 %** |
| preloaded skills catalogue (299 skills) | 14,851 | 10.7 % |
| CLAUDE.md hierarchy | 746 | 0.5 % |

The ten largest rule files:

| Tokens | File |
|---|---|
| ~2,912 | `design-fidelity.md` |
| ~2,775 | `decision-revisit-gate.md` |
| ~2,672 | `design-review-after-ui-write.md` |
| ~2,579 | `roadmap-progress-sync.md` |
| ~2,374 | `settings-ask-protocol.md` |
| ~2,364 | `session-canary.md` |
| ~2,307 | `code-provenance.md` |
| ~2,241 | `context-hygiene.md` |
| ~2,240 | `ui-audit-gate.md` |
| ~2,127 | `domain-safety-pii.md` |

The top 20 rule files carry **35.1 %** of the rules bucket. A single one of the
files above outweighs the entire hypothetical gain from capping every skill
description at 150 characters.

## 4. What this settles

- **The catalogue-trim unlock is refuted.** A council seat proposed landing the
  ERD skill after freeing headroom by trimming descriptions. The measurement says
  that headroom does not exist in that bucket at any acceptable cost.
- **A new *rule* is strictly worse than a new skill.** The same seat proposed
  landing the ERD capability as scripts plus a routing **rule** instead of a
  skill, on the stated ground that this would incur "zero catalog payload hit".
  It would incur a *rules-bucket* hit instead, and the rules bucket is gated by
  the same check — `preamble-payload-budget.json` lists
  `"project-scope rules (dist/agent-src/rules/*.md)"` first among its
  `gated_buckets`. The smallest rule in the projection is larger than the
  53-token skill description the proposal was trying to avoid. **The alternative
  costs more than the thing it replaces**, so the option is refused on its own
  arithmetic rather than on a vote.
- **The only mechanism that can move this number is a rules reduction**, which is
  what `road-to-cost-parity-1-rule-payload-diet` and
  `road-to-standing-context-40k` were written for. Both are in
  `agents/roadmaps/later/`, and `preamble-payload-budget.json`'s
  `status_2026_08_24.committed_reduction_mechanism` reads **"NONE"**.

## 5. What this does not settle

This measures *where* the tokens are, not *which* of them are removable. Nothing
here says the ten rules listed above are too long for what they do — several are
kernel or near-kernel rules whose length is load-bearing, and
`preservation-guard` forbids weakening them to save bytes. Establishing which
rule weight is genuinely removable is the parked payload-diet roadmap's job and
is not attempted here.

It also does not establish that the 2026-11-10 recovery milestone is reachable.
It establishes only that the skill catalogue is not the place to look.
