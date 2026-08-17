<!-- evidence-type: analysis -->

# Rule-stub projection — Phase 0 measurement of the migrated corpus

> **Roadmap:** `road-to-rule-stub-projection` Phase 0 (steps 0.1–0.3).
> **Measured at:** `origin/main` @ `be9db6a66`, 2026-08-17.
> **Regenerate with:** `./scripts-run src/scripts/check_rule_stub_ceiling --report`
> — this file is a rendering of that command, not a hand-kept table. A size
> quoted from a document is a stale number by the time it is read; regenerate
> rather than cite.

## What was measured

Every rule under `src/rules/` carrying a migration pointer — a line of the shape
*"Body migrated to `guideline:X`"* or *"merged into X"* — measured in **exact BPE**
(`js-tiktoken`, `cl100k_base`, via `_lib/token_count.gpt_tokens`), with its
pointer target resolved against the tree.

**44 rules carry a pointer, not 42.** The roadmap's § 0 cited 42 from the
adoption draft; the live count via the ledger gate's own matcher is 44 of 117.
The `lint_rule_migration_ledger` header cites 44 of 111, so the numerator has
been stable and the denominator moved. Corrected here rather than in the roadmap
prose, because this file is the regenerable one.

## The measurement path in the roadmap's step 0.1 does not exist

Step 0.1 says to measure *"in exact BPE via the tokenizer path
`rule_activation_census.ts` already uses"*. **That script uses no tokenizer** —
`grep` over its imports returns `fs`, `path`, `node:url` and three helpers from
`condense.ts`, and it prints no token figure at all. The exact-BPE path is
`src/scripts/_lib/token_count.ts` (`gpt_tokens` + `TIKTOKEN_AVAILABLE`), which
`check_rule_activation_census.ts` imports — the *checker*, not the census. This
measurement uses that one.

Its `<!-- verify: -->` annotation is separately wrong: it reads
`./scripts-run src/scripts/rule_activation_census.ts --help`, and `scripts-run`
appends `.ts` itself, so the annotation as written fails with *no script found
for … .ts.ts*. Both are recorded rather than silently worked around.

## Result

| rule | tokens | frontmatter | body (ceiling) | floor | residue | pointer target | resolves |
|---|---:|---:|---:|---:|---:|---|---|
| `context-hygiene` | 2601 | 155 | 2447 | 218 | 2229 | `../docs/guidelines/agent-infra/context-hygiene-mechanics.md` | yes |
| `design-fidelity` | 2591 | 347 | 2245 | 583 | 1662 | `../docs/guidelines/design-fidelity-mechanics.md` | yes |
| `autonomous-execution` | 1799 | 167 | 1633 | 83 | 1550 | `contexts/execution/autonomy-mechanics.md` | yes |
| `active-remediation` | 1808 | 208 | 1601 | 293 | 1309 | `../docs/guidelines/agent-infra/active-remediation-mechanics.md` | yes |
| `ui-audit-gate` | 1988 | 709 | 1280 | 108 | 1171 | `../skills/existing-ui-audit/SKILL.md` | yes |
| `architecture` | 1081 | 127 | 955 | 82 | 873 | `../skills/module-detect-on-the-fly/SKILL.md` | yes |
| `roadmap-progress-sync` | 1608 | 185 | 1424 | 585 | 839 | `guideline:agent-infra/roadmap-progress-mechanics` | yes |
| `git-history-discipline` | 1434 | 230 | 1205 | 369 | 836 | `skill:git-workflow` | yes |
| `legal-safety-floor` | 1706 | 306 | 1401 | 665 | 736 | `../skills/legal-practice-profile/SKILL.md` | yes |
| `improve-before-implement` | 1055 | 211 | 845 | 122 | 723 | `../../docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md#8-improve-before-implement--pre-implementation-validation` | yes |
| `minimal-safe-diff` | 1061 | 169 | 893 | 187 | 707 | `../docs/guidelines/agent-infra/minimal-safe-diff-mechanics.md` | yes |
| `untrusted-input-defense` | 1025 | 181 | 845 | 244 | 601 | `../docs/guidelines/agent-infra/untrusted-input-spotlighting.md` | yes |
| `broken-access-control` | 973 | 231 | 743 | 248 | 495 | `../skills/authz-review/SKILL.md` | yes |
| `artifact-drafting-protocol` | 763 | 153 | 611 | 126 | 485 | `../docs/guidelines/agent-infra/artifact-drafting-protocol-mechanics.md` | yes |
| `code-comment-discipline` | 893 | 202 | 692 | 241 | 451 | `../docs/guidelines/code-clarity.md#comment-discipline--state-a-constraint-not-a-narration` | yes |
| `framework-neutrality-in-generic-skills` | 1116 | 496 | 621 | 226 | 395 | `../docs/guidelines/agent-infra/framework-neutrality-patterns.md` | yes |
| `no-roadmap-references` | 887 | 244 | 644 | 314 | 330 | `../skills/agent-docs-writing/SKILL.md` | yes |
| `domain-adoption-policy` | 694 | 198 | 497 | 245 | 252 | `../docs/guidelines/agent-infra/domain-adoption-gates.md` | yes |
| `decision-revisit-gate` | 744 | 200 | 545 | 335 | 210 | `../skills/decision-review/SKILL.md` | yes |
| `provider-lifecycle-discipline` | 773 | 302 | 472 | 301 | 171 | `../../docs/contracts/provider-lifecycle.md#-4--agent-obligations` | yes |
| `roadmap-ci-steps-policy` | 890 | 327 | 564 | 425 | 139 | `../contexts/execution/roadmap-ci-steps-mechanics.md` | yes |
| `persona-governance` | 621 | 292 | 330 | 204 | 126 | `../../docs/contracts/persona-schema.md#-8--governance-discipline-the-four-checks` | yes |
| `commit-conventions` | 253 | 118 | 136 | 46 | 90 | `skill:conventional-commits-writing` | yes |
| `reviewer-awareness` | 264 | 134 | 131 | 43 | 88 | `skill:review-routing` | yes |
| `model-recommendation` | 314 | 159 | 156 | 75 | 81 | `guideline:agent-infra/model-recommendation` | yes |
| `augment-edit-discipline` | 340 | 204 | 137 | 62 | 75 | `guideline:augment-portability-patterns` · `skill:agent-docs-writing` | yes |
| `linked-projects-onboarding-gate` | 381 | 210 | 172 | 98 | 74 | `guideline:agent-infra/linked-projects-onboarding-gate` | yes |
| `devcontainer-routing` | 246 | 119 | 128 | 71 | 57 | `skill:devcontainer` | yes |
| `copilot-routing` | 241 | 114 | 128 | 72 | 56 | `skill:copilot-config` | yes |
| `symfony-routing` | 259 | 131 | 129 | 74 | 55 | `skill:symfony-workflow` | yes |
| `laravel-routing` | 312 | 187 | 126 | 72 | 54 | `skill:laravel` | yes |
| `missing-tool-handling` | 231 | 129 | 103 | 52 | 51 | `guideline:agent-infra/missing-tool-handling` | yes |
| `brand-consistency` | 243 | 111 | 133 | 90 | 43 | `brand-source-of-truth.md` | yes |
| `laravel-translations` | 210 | 129 | 82 | 43 | 39 | `skill:laravel` | yes |
| `cli-output-handling` | 421 | 339 | 83 | 46 | 37 | `skill:rtk-output-filtering` | yes |
| `docker-commands` | 235 | 157 | 79 | 42 | 37 | `skill:docker` | yes |
| `rule-type-governance` | 206 | 120 | 87 | 51 | 36 | `guideline:agent-infra/rule-type-governance` | yes |
| `skill-improvement-trigger` | 191 | 111 | 81 | 47 | 34 | `skill:skill-improvement-pipeline` | yes |
| `slash-command-routing-policy` | 211 | 135 | 77 | 43 | 34 | `skill:command-routing` | yes |
| `php-coding` | 232 | 153 | 80 | 48 | 32 | `guideline:php/php-coding-patterns` | yes |
| `analysis-skill-routing` | 185 | 110 | 76 | 45 | 31 | `skill:analysis-skill-router` | yes |
| `upstream-proposal` | 185 | 110 | 76 | 45 | 31 | `skill:upstream-contribute` | yes |
| `package-ci-checks` | 184 | 111 | 74 | 44 | 30 | `skill:lint-skills` | yes |
| `skill-quality` | 217 | 140 | 78 | 50 | 28 | `guideline:agent-infra/skill-quality-checklist` | yes |
| **total (44 rules)** | **33672** | **8871** | **24845** | **7463** | **17383** | | |

Column residual: `frontmatter + floor + residue` = 33717 against 33672 whole-file tokens (+45, 0.13 %), and `frontmatter + body` = 33716. BPE is not additive across segment boundaries — merges spanning a split are lost when the segments are encoded separately. **The ceilings are keyed on the `body (ceiling)` column**, not on the whole file: frontmatter is the routing surface, and a rule that gains a trigger must not trip a prose ceiling.

Stated because a reader who adds the columns will find the gap, and a table that
silently fails to reconcile is worse than one that says by how much.

## 0.1 — every pointer target resolves. Zero broken.

**All 45 pointers across the 44 rules resolve.** This is an honest null for the
finding half of Phase 1: the gate ships as regression protection for a state that
is already correct, not as a repair.

It took one correction to establish. Resolving a relative href from `src/rules/`
reported **12 of 44 broken** — a false red. Rule bodies are authored for the
**projected** tree, where `../docs/` is the sibling docs directory; under
`src/rules/` the same href points at `src/docs/`, which does not exist.
`check_references.ts` already solved this by stripping leading `./` / `../` and
trying a prefix list. That strategy is adopted
verbatim rather than a second one invented — a gate disagreeing with the
reference checker consumers already trust would be worse than no gate.

## 0.2 — floor and residue, with the criterion

**Floor 7,463 · residue 17,383 tokens**, out of 24,845 body tokens. The
criterion, applied per line:

| classified | when |
|---|---|
| floor | an Iron Law heading at any level, including numbered variants |
| floor | every line of a fenced block opened inside an Iron Law section |
| floor | any line carrying a capitalised negation clause (`NEVER` / `NO` / `NOT` / `DO NOT`) |
| floor | the migration pointer **paragraph** — the sentence and its continuation lines, to the blank line that ends it |
| residue | everything else in the body |

The Iron-Law section boundary is the next heading at the same level or
shallower, so a `###` inside an `## Iron Law` stays inside it — demotion is the
norm in these files and a level-keyed boundary would mis-split every demoted
section.

**This is a judgment with a mechanical criterion, and Risk 2 of the roadmap says
so.** It is published per rule *with* the criterion precisely so a reader can
disagree with one row without discarding the total. No gate verdict depends on
it.

Two known imprecisions, neither hidden:

- A capitalised negation line **outside** an Iron Law section counts as floor.
  That over-counts floor wherever emphatic prose uses caps, which biases the
  residue figure **downward** — i.e. against this roadmap's own premise, which is
  the safe direction for a number that argues for the work.
- A table or marker list is residue by default. `preservation-guard` plausibly
  requires some of those to stay; 46 rules were adjudicated `keep` on exactly
  that ambiguity. The split does not attempt to resolve it.

**Both figures moved between the first measurement and this one, and the reason
is a defect the completion review found.** The pointer was classified per line,
so for the soft-wrapped pointers the code already knew existed, the continuation
landed in residue. The first pass therefore read floor 6,678 / residue 18,149 —
a split biased in the direction this roadmap's premise favours, which is the one
direction an author is least likely to question. Fixed to classify the pointer
paragraph; ~766 tokens moved from residue to floor. Both published numbers are
post-fix.

### The pre-registration is falsified

Phase 0 pre-registered **residue ≥ 25 %** of the 103,265-token census baseline,
with **< 10 %** as the honest-null threshold.

**Measured: 17,383 / 103,265 = 16.8 %.**

So the band is missed and the honest null is *not* reached. The lever is real but
smaller than pre-registered: roughly 17k tokens of the always-on corpus sit in
bodies that already declare they should be elsewhere. Recorded as a miss rather
than reframed — the pre-registration existed to be falsifiable, and stating a
16.8 % result against a 25 % bar is the whole value of having written the bar
down first.

## 0.3 — reconciliation against the closed disposition record

`agents/decisions/rule-activation-dispositions.yml` is **CLOSED** (line 1). It is
read here and not written to; its row count and dispositions are unchanged.

| migrated rules (44) | recorded disposition |
|---|---:|
| `digest` | 25 |
| `keep` | **1** |
| absent from the record | 18 |

The 18 absences are **expected, not drift**: the record covers non-kernel rules
with *no* path-shaped trigger, and every absent rule has one (`design-fidelity`,
`ui-audit-gate`, `php-coding`, `laravel-translations`,
`linked-projects-onboarding-gate`, `provider-lifecycle-discipline`,
`roadmap-ci-steps-policy`, `domain-adoption-policy`,
`framework-neutrality-in-generic-skills`, `augment-edit-discipline`,
`persona-governance` are all in the census mixed set). They were out of the
record's scope by construction.

### The one contradiction: `legal-safety-floor`

`legal-safety-floor` is recorded **`keep`** — "stays always-on and monolithic,
deliberately" — and simultaneously carries a migration pointer to
`../skills/legal-practice-profile/SKILL.md`. The two statements are opposites.

Reported, not resolved. The record is closed and this roadmap never adds a row to
it; whether the `keep` or the pointer is the stale half is a maintainer call. Its
measured shape, for whoever takes it: 1,706 tokens, of which 665 are floor and
736 residue — the highest floor share of any rule in the set, which is at least
consistent with a deliberate `keep`.

## The live defect this measures, restated with fresh numbers

`src/rules/context-hygiene.md` is **2,601 tokens** and declares its body migrated
to `context-hygiene-mechanics.md`. It carries **2,229 residue tokens** — the
largest residue in the corpus, in the rule with the smallest floor-to-residue
ratio of the top four. The roadmap's byte framing (10,988 B rule against a
3,491 B target) holds in tokens too.

And the aggregate ratchet is green while this is true. Measured this run:

```
check_rule_activation_census: 8 scoped · 17 mixed · 103676 unconditional tokens (exact BPE) · 117 rule file(s).
```

against a pinned baseline of **103,265** — the corpus is **+411 tokens above its
own baseline and the gate passes**, because the drift allowance is 2,000 tokens
and is deliberately not zero. Per-rule re-growth under an aggregate cap with a
tolerance band is exactly the gap `check_rule_stub_ceiling` closes.

## See also

- `src/scripts/check_rule_stub_ceiling.ts` — the gate; `--report` regenerates this table.
- `src/config/rule-stub-ceilings.json` — the per-rule baseline written from this measurement.
- `src/scripts/lint_rule_migration_ledger.ts` — the sibling gate: where each pre-migration heading WENT. This one asserts the rule stays small; that one asserts the loss was recorded.
- `src/scripts/check_rule_activation_census.ts` — the aggregate axis, and the tolerance band that makes this gate necessary.
