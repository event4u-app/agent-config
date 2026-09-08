<!-- evidence-type: analysis -->
# No host reads a skill's `triggers:` frontmatter, and by default nothing in this tree does either

Pinned to commit `8a3160242197c39b070e58d288a504a8d1c371fc`. Produced to close
the provenance hole a council named as the precondition of the skill-surface
framing decision (`blocker: skill-surface-framing-ab-choice` in
`agents/roadmaps/road-to-the-skill-surface-framing-choice.md`).

## The question under test

The council of 2026-09-08 (recorded below) locked Option B **conditionally**:

> Close the provenance hole: document which hosts were census-tested and whether
> they claim frontmatter routing. If unknown, Option D becomes the honest choice.

The published claim `skill-activation-census-zero` (`docs/CLAIMS.md:245`) reads
the zero three ways, and for one of the three populations it reads it as a
**defect**: "For the 12 the zero is a defect — a matchable declaration exists and
nothing acted on it." That reading assumes something was in a position to act.
This artifact tests that assumption.

## 1. Which host was census-tested

One. `agents/evidence/metrics/skill-activation-census.json` carries a single
`stores` entry:

```
"stores": ["-Users-mathiasberg-projects-galawork-galawork-packages-event4u-agent-config"]
```

That is a Claude Code project transcript store. The 30 sessions and 11,338
assistant turns are all Claude Code. No other host contributed a session, so the
census makes no observation at all about the other eight hosts this package
projects to.

## 2. How many skills declare the key

Twelve, which is what the census records (`with_trigger_key: 12`). A naive
`grep -l '^triggers:' src/skills/*/SKILL.md` returns **13** and is wrong: it
matches `rule-writing`, whose `triggers:` occurrence is in the body, not in
frontmatter. Parsing the frontmatter block proper yields:

authz-review · laravel-migration · merge-conflicts · multi-tenancy ·
pest-testing · playwright-testing · privacy-review · runway-cognition ·
secrets-management · systematic-debugging · terraform · threat-modeling.

The 13-count is recorded here because it is the number a reader re-deriving this
with the obvious command will get, and because an earlier draft of this artifact
carried it as a discrepancy against the census before the frontmatter parse
settled it in the census's favour.

## 3. The key IS delivered — an earlier reading of this tree was wrong

A first pass compared `src/skills/` against the locally-installed
`.claude/skills/` and found 3 of 13 carrying the key, which looked like the
generator stripping it. That reading was **false and is retracted here**, because
the rendered copies under `.claude/skills/` on this machine are gitignored
install artifacts dated `Jul 5 14:40`, while their `dist/` sources are dated
`Aug 23 20:51`. The comparison measured seven weeks of local staleness, not a
projection rule.

The generator does not strip the key. `_render_native_model_md`
(`src/scripts/condense.ts:1623-1627`) performs exactly one substitution —
`model_tier:` → `model:` — and returns the rest of the file unchanged. Verified
against freshly-generated trees:

| Tree | Files matching `^triggers:` |
|---|---|
| `src/skills/` | 13 |
| `dist/agent-src/skills/` | 13 |
| `.augment/skills/` | 13 |

(13 here is the grep count of § 2, deliberately: what matters is that the
projections and the source agree file-for-file, and the same over-count on both
sides is the cleanest way to show the projection changed nothing.)

So the delivered artifact carries the declaration. The question is whether
anything reads it.

## 4. Nothing reads it at routing time, and by default nothing reads it at all

**The rule router does not.** `dist/router.json` has four content keys —
`kernel`, `tier_1`, `tier_2`, `profiles` — and no skills key.
`src/scripts/compile_router.ts` contains zero occurrences of `skills`. The
`triggers:` vocabulary that the router consumes is the one in `src/rules/`, and
the two surfaces share a word and nothing else.

**The one in-tree reader is this package's own ranker, and it is off by
default.** `src/scripts/skill_tools/score_skill_relevance.ts:170` documents the
field as "`triggers[].keyword` / `.phrase` prose. **Indexed only under
keyword-v2**", and `:261-262` records that under keyword-v1 — the default —
`skill.terms` is `tokenize(name + ' ' + description)`. So under shipped defaults
the ranker behind `suggest_skill_for_task` scores name and description, and the
trigger prose contributes nothing.

**`evals/triggers.json` is a different surface again** and was already known not
to be a host input: `docs/CLAIMS.md:245` records it as a test fixture read by
`check_routing_coverage` / `lint_skill_trigger_corpus` / `check_trigger_evals`,
with "no host reads it at routing time".

**Claude Code's own skill contract** is `name` + `description` (the host presents
a listing of those and the model selects). `triggers:` is not in that contract,
so a Claude Code session never sees the key it would have to match on.

## 5. What this establishes, and what it does not

**Establishes.** For the trigger-declaring population, the zero is not "a
matchable declaration exists and nothing acted on it". Nothing was in a position
to act: no host reads the key, the package's own router does not read it, and the
package's own ranker reads it only under a non-default mode. The declaration is
inert at the delivered surface under shipped configuration.

**Does not establish.** That skills are unreachable — `suggest_skill_for_task`
ranks name and description and is a real path. That the other eight hosts behave
this way — the census saw none of them; this section's host claim is Claude Code
only, and the router and ranker claims are host-independent because they are
facts about this tree. That `keyword-v2` would change the census — no such run
exists.

**Falsifier.** A named host publishes a skill-frontmatter contract that includes
a `triggers`-shaped key and demonstrates selection on it; or `keyword-v2` becomes
the shipped default and a census over a comparable store moves off zero.

## 6. Consequence for the published claim

`docs/CLAIMS.md:245` currently reads the zero as a **defect** for the
trigger-declaring population. On this evidence that reading is wrong in a way
that matters: it describes a mechanism that failed, where in fact no mechanism
exists. The honest reading is that all three populations reduce to one — every
shipped skill is reachable only by explicit invocation or by the package's own
ranker over name and description — which is the substance of Option B and is why
the council's precondition mattered.

Correcting that sentence is not done in this artifact. It is the execution of
Option B and is tracked where the decision is recorded.
