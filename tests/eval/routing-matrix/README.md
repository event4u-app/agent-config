# Routing-Matrix Fixtures (tier-1 rules)

One YAML file per tier-1 rule id from `dist/router.json` (`tier_1` array). Each file
pins prompts that MUST route to the rule (positives) and topically adjacent prompts
that must NOT route (near-misses). Data only — the runner is built separately.

## Schema

```yaml
rule: <rule-id>                # must equal the tier_1 entry id and the file name
positives:                     # >= 3, at least one German prompt
  - prompt: "<realistic user prompt>"
    open_files: ["<path>"]     # optional — needed for path_prefix / file_pattern triggers
    command: "/<cmd>"          # optional — needed for command triggers
near_misses:                   # >= 2, plausible real-world prompts
  - prompt: "<adjacent prompt with NO trigger substring>"
    open_files: ["<path>"]     # optional — a non-matching path is a valid near-miss probe
```

## Matching semantics (source: `src/scripts/router_telemetry.ts` — `trigger_matches`)

- `keyword` / `phrase` — case-insensitive **unanchored substring** on the prompt.
- `path_prefix` — `startsWith` over `open_files` entries.
- `file_pattern` — fnmatch over `open_files` entries (`*` matches `/` too).
- `command` — case-sensitive `startsWith` on the invoked command.

A positive must match at least one of the rule's real triggers; a near-miss must
match **zero** of them. Because keyword matching is unanchored substring, a
near-miss must not contain any trigger keyword even inside another word
(e.g. "options" contains "option", "specs" contains "ecs").

## Adding a file

1. Read the rule's triggers from `dist/router.json` (`tier_1`).
2. Create `<rule-id>.yaml` following the schema above.
3. Verify every positive matches >= 1 trigger and every near-miss matches 0,
   using the real `trigger_matches(trigger, prompt, open_files, command)` import —
   never by eyeballing the substrings.

## Rules with no matrix, and why that is correct

A matrix pins a **routing** decision: which prompts and open files activate a
path- or keyword-triggered rule, and which near-misses must stay silent. A rule
that loads **unconditionally** makes no such decision, so it has nothing for a
matrix to assert — every prompt is a positive and there are no near-misses.

Four rules moved into that category on 2026-08-20 (road-to-single-delivery Phase
5.1, ADR-236 + ADR-227): `no-roadmap-references`, `rule-type-governance`,
`skill-quality` and `source-confidentiality`. Their path triggers were removed so
they survive `/compact` once the delivery partition removes their unscoped global
twin. Their matrices were **deleted rather than emptied**, because the alternative
shapes are both worse: a matrix with zero positives fails this directory's own
`≥3 positives / ≥2 near-misses` floor, and one that keeps its old positives asserts
routing behaviour the rules no longer have — which is exactly how these four turned
red when the triggers came out. The deletion is the honest record: no routing
decision, no matrix.

If any of them regains a trigger, it needs its matrix back, positives and
near-misses both. `check_rule_activation_census` is what notices the change of
category (it pins the scoped / mixed ID sets by identity), so the pairing is not
left to memory.

## `expected_skills` — the labelling protocol

Every case in this directory carries an `expected_skills` list. It answers a
different question from the `rule:` key above: the rule key says which RULE the
prompt must activate, the list says which SKILL a competent agent should surface
for it. The two are independent, which is why a rule near-miss can still carry a
skill label — "must not load this rule" and "should surface this skill" are not
in tension.

```yaml
  - prompt: "Run php artisan migrate in the app container and show me the output."
    expected_skills: [docker]
```

Three states, and they are NOT interchangeable:

| Written | Means | Effect on the measurement |
|---|---|---|
| `expected_skills: [a, b]` | a labelled row: `a` or `b` is a correct top answer | in the accuracy denominator |
| `expected_skills: []` | deliberately no skill expectation | EXCLUDED from the denominator, never a miss |
| key absent | a defect — nobody has judged this row | reported as `missing_label_key`; pinned at zero by `tests/scripts/measure_skill_ranker_baseline.test.ts` |

A label names at most three skill ids, best fit first. A hit is scored when any
one of them appears in the ranker's top-1 (or top-3) — so a multi-skill label is
a claim that ANY of them is an acceptable answer, never that all are required.

### Who may write a label

```
LABELS ARE WRITTEN BY A SEAT THAT HAS NOT READ THE RANKER'S SCORING.
NEVER BY THE RANKER UNDER TEST, AND NEVER BY ITS AUTHOR.
```

A label written by someone who knows how the ranker scores will drift toward
what the ranker already does, and the resulting hit rate measures agreement with
the implementation rather than correctness. Each labelling seat is therefore
given the skill catalogue (`name` + `description`, grouped by pack) and the bare
prompt text, and is instructed not to open `score_skill_relevance.ts`,
`skillRanking.ts`, or `measure_skill_ranker_baseline.ts`, and not to reason about
keyword overlap at all. The case id is withheld as a hint too: it names an
unrelated rule fixture, and labelling from it would import the rule's subject
into a skill judgement.

### The blind second seat

A 10 % sample is relabelled by a second seat that has read neither the first
seat's output nor this directory. Agreement is recorded rather than reconciled:
the disagreements are the honest width of the ground truth, and quietly
overwriting one seat with the other would hide it.

**2026-09-29, first labelling round.** 550 existing cases labelled by six seats;
38 further prompts authored for packs the matrix did not reach. Blind relabel of
55 cases (10.0 %) by a seventh seat:

| Measure | Result |
|---|---|
| exact set agreement | 39 / 55 — 70.9 % |
| polarity agreement (labelled vs. deliberately empty) | 50 / 55 — 90.9 % |
| of the 30 rows both seats labelled, at least one shared skill | 29 / 30 — 96.7 % |
| fully disjoint labels | 1 — `roadmap-ci-steps-policy#positives[1]`, `roadmap-writing` vs `github-ci` |

The one disjoint pair is a genuinely ambiguous prompt ("add a step that runs
`task ci` before opening the PR" — a CI workflow step or a roadmap step), and it
is left as the first seat wrote it. Read the middle row as the one that matters:
the seats agree about WHETHER a prompt has a skill answer nine times in ten, and
when both say yes they name a common skill in all but one case. The exact-set
figure is lower because a second or third skill in a three-slot label is where
reasonable people differ, and that difference does not change a top-3 hit.

### Adding a labelled prompt

1. Write the prompt for the skill, not from the skill's description — a prompt
   that reuses the description's vocabulary measures nothing.
2. Place it in the matrix file for the rule it routes to (as a positive) or, when
   it routes to no rule, in the file of a rule it is topically adjacent to and
   must stay silent for (as a near-miss). `tests/scripts/routing_matrix.test.ts`
   enforces both directions against the real matcher, so a misplacement is a red
   test rather than a silent corpus defect.
3. NEVER add a positive that only routes because of a trigger the rule should not
   have fired on. A positive asserts desired behaviour; pinning a router false
   positive there makes the defect permanent.
4. Re-run `./scripts-run src/scripts/measure_skill_ranker_baseline --corpus routing-matrix`
   and check `packs_below_floor` is still empty.
