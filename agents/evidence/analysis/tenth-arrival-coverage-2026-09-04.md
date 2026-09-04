<!-- evidence-type: analysis -->
# Trigger coverage and skill activation, re-derived from the tree

`road-to-the-tenth-arrival` Phases 2.1 and 2.3. Every number below is
reproduced by the command printed next to it, run in a clean worktree at
`origin/main@66f4a1cdd` plus this branch's changes. No figure is adopted from
the review round that raised the finding.

## 2.1 — What "100 of 299" counts, and what it does not

The disposition (`inbox-2026-09-d-disposition.md:85`) states "a trigger corpus
at 100 of 299 skills". That figure reproduces exactly, and the instrument is
already in the tree:

```
$ ./scripts-run src/scripts/check_routing_coverage
  = rules    94 / 105  = 0.8952  (seed 0.8952)
  = skills  100 / 299  = 0.3344  (seed 0.3344)
```

The measurement is declared in `src/config/routing-coverage-seed.json`:
`src/skills/*/evals/triggers.json` over `src/skills/*/SKILL.md`. Reproduced
directly:

```
$ ls src/skills/*/evals/triggers.json | wc -l   # 100
$ ls src/skills/*/SKILL.md | wc -l              # 299
```

### The divergence the roadmap flagged, resolved

`road-to-the-tenth-arrival` 2.1 warned that the review's figure and
`grep -l 'triggers:' src/skills/*/SKILL.md` disagree. They do, and they are
counting three different populations. All three readings are correct about
their own question:

| Reading | Command | Value | What it counts |
|---|---|---|---|
| Corpus coverage | `ls src/skills/*/evals/triggers.json \| wc -l` | **100** | skills with an eval corpus — the finding's figure |
| Frontmatter key, line-anchored | `grep -l '^triggers:' src/skills/*/SKILL.md \| wc -l` | 13 | skills whose file contains a line-start `triggers:` **anywhere** |
| Frontmatter key, in frontmatter only | `./scripts-run src/scripts/report_skill_activation` | 12 | the same, restricted to the first `---` fence pair |

The 13 → 12 step is one file: `src/skills/rule-writing/SKILL.md` carries
`triggers:` at line 195, in the body, as an authoring example; its frontmatter
ends at line 10. `report_skill_activation` slices the frontmatter before
matching (`report_skill_activation.ts:96-99`), so it is right and the bare grep
is not.

A fourth reading, `grep -l 'triggers:' src/skills/*/SKILL.md` without the line
anchor, returns 27 — it also matches prose that mentions the word.

**The finding's figure is the corpus one, and it is sound.** The number is not
in doubt; what the divergence shows is that "trigger coverage" names two
unrelated surfaces — a test corpus and a routing declaration — and the review
did not say which. That distinction is what makes the 2.3 null below readable.

## 2.2 — The wave was authored, measured, and reverted

AI council 2026-09-04 (anthropic/claude-sonnet-4-5 + openai/codex-default,
2 rounds, quorum 2/2, $0.00 — both seats subscription-authed) converged on a
bounded wave of 10–15 files over closing the 199-file gap in one run, selected
by a declared rule rather than alphabetical order. The rule used, reproducible
from the census this roadmap already runs: **the skills that carry a
deterministic `MUST` / `NEVER` / `ALWAYS` obligation and had no corpus** — 16 of
the 34 `report_skill_activation` names. 14 were authored, and every
corpus-local gate went green at `skills 114 / 299 = 0.3813`.

**The step's premise then turned out to be false and the wave was reverted.**
The corpus is not "held by nothing": it is pinned by three published
reproduce-from-tree measurement records, and the frozen holdout artefact
reserves the partition of any later wave to a Phase 5 decision. The full
finding, the three pins, the council decision and the 14 files themselves are
preserved in
`agents/evidence/analysis/trigger-corpus-wave2-deferred-2026-09-04.md`.

Coverage on this branch is therefore **unchanged at 100 / 299**, the ratchet
seed is unchanged at 0.3344, and the grandfather allowlist is unchanged at 199.

### What the near-miss discipline can and cannot assert

Step 2.2's verify line asks that "the near-miss rows fail if the trigger is
widened by one word". On the **rule** surface that is machine-decidable and
already enforced. On the **skill** surface it is not: the skill harness
(`rule_trigger_eval.ts:4`) is advisory only, never gating, and skill selection
is model judgement over prose rather than a matcher a fixture can widen. The
authored files discharge it in the reviewable form instead — every negative
declares a `class` (`near-miss` vs `counterexample`) and carries a `note` naming
the neighbour skill it must route to. Recorded here because it is a limit of the
surface, not of the reverted wave, and it applies equally to whatever Phase 5
lands.

## 2.3 — Activation at the new coverage: an honest null

The instrument is `report_skill_activation` (advisory, gates on nothing —
`taskfiles/ci-fast.yml:1015`). Reading over the project's own transcript store,
before and after the wave, same command:

```
$ ./scripts-run src/scripts/report_skill_activation \
    --store "$HOME/.claude/projects/-Users-mathiasberg-projects-galawork-galawork-packages-event4u-agent-config"
```

| | before the wave (100/299) | with the wave applied (114/299) |
|---|---|---|
| sessions scanned | 30 | 30 |
| assistant turns | 11,013 | 11,049 |
| Skill invocations | **0** | **0** |
| distinct skills invoked | **0 of 299 (0.0%)** | **0 of 299 (0.0%)** |
| skills with a machine-matchable trigger key | 12 (4.0%) | 12 (4.0%) |

**The null is the finding, and it is sharper than the claim it tests.**
`docs/CLAIMS.md` says activation "is separately measured and is near zero"; over
this store it is zero, not near it. The turn-count difference is this session's
own turns accumulating while it ran, not a change in the corpus.

Both readings are real: the second was taken with the 14 files present, before
the reversion described in § 2.2. The reading did not move, and the reason is
structural rather than disappointing: `evals/triggers.json` is a **test fixture**, read by
`check_routing_coverage`, `lint_skill_trigger_corpus` and `check_trigger_evals`.
It is not read by any host at routing time, and nothing in this branch delivers
it to a session. Expecting an activation gain from it would have been the same
category error the 2.1 divergence exposes — two surfaces called "triggers".

What the null therefore licenses: the corpus wave improved the **testability**
of routing and did not touch the **delivery** of it. What it does not license:
any conclusion about whether the delivery-mode flip would move activation. That
question needs the flip, which is Phase 3 and owner-reserved.

Not measured, and stated so it is not read as covered: whether each skill
reaches the model **with its description**. The host's injected catalogue is not
persisted in the transcript, so the bare-name hypothesis remains a
single-session observation. Falsifier, unchanged: log the catalogue once per
session from a `session_start` concern, then count descriptions against bare
names.
