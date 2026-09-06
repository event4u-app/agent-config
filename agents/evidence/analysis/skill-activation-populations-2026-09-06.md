<!-- evidence-type: analysis -->
# The 299 skills, split by what reaching them would take

`road-to-the-activation-census-consequence` Phases 2.1 and 2.2. Every count
below is printed by the command beside it, run against this branch. Nothing is
carried over from the round that raised the finding.

## The table

| Population | Count | Command |
|---|---|---|
| Shipped skills (`SKILL.md` under `src/skills/`) | 299 | `ls -d src/skills/*/ \| wc -l` |
| Declare a machine-matchable trigger key in frontmatter | 12 | `./scripts-run src/scripts/report_skill_activation` — line `machine-matchable trigger key` |
| Carry an `evals/triggers.json` corpus | 100 | `ls src/skills/*/evals/triggers.json \| wc -l` |
| In BOTH of the two above | 2 | `./scripts-run src/scripts/report_skill_activation` — line `both of the above` |
| Reachable only by a human naming them | 189 | `./scripts-run src/scripts/report_skill_activation` — line `human-named only` |

The overlap is what makes the three reconcile, and it is 2 — `authz-review` and
`threat-modeling`, reproduced by

```
comm -12 \
  <(grep -lE '^(triggers|trigger_description|file_pattern|path_prefix):' src/skills/*/SKILL.md \
      | sed 's|src/skills/||;s|/SKILL.md||' | sort) \
  <(ls -d src/skills/*/evals/triggers.json | sed 's|src/skills/||;s|/evals/triggers.json||' | sort)
```

Reconciliation, printed by the census itself so it cannot be asserted
separately from the counts: `12 + 100 - 2 + 189 = 299`.

The trigger-key grep above is looser than the census: it matches the key
anywhere in the file, so `src/skills/rule-writing/SKILL.md` — which shows the
key inside a documentation example — is a thirteenth hit. The census reads the
frontmatter fence only, which is why the number here is 12 and a naive grep
returns 13. Where the two disagree the census is the figure, because a key in
prose is not a declaration a host could match on.

## What a zero means, per population

The census reads 0 Skill invocations over 30 sessions and 11,338 assistant
turns. That single zero is three different statements:

**The 12 with a machine-matchable trigger key.** A matchable declaration exists
in the tree and nothing acted on it. Zero here is a defect — not of the skill,
of the path between the declaration and a selection. What it does NOT establish
is where that path is broken: this repository declares the key, no host in the
supported set is known to read it, and the census cannot see a host's selection
step at all.

**The 100 with an `evals/triggers.json` corpus.** Zero licenses nothing in
either direction. The file is a TEST fixture read by `check_routing_coverage`,
`lint_skill_trigger_corpus` and `check_trigger_evals`; no host reads it at
routing time. The two surfaces share the word "trigger" and are unrelated, so
neither a zero nor a non-zero census would be evidence about this corpus.

**The 189 reachable only by a human naming them.** Invocation here is a reader
opening a file, or a person typing the skill's name. No automatic selection is
claimed for this population, so a zero automatic-invocation count is the design
rather than a failure of it. Stating that is not a defence of the number: it
says only that this population was never the thing the census could measure,
and it is the larger part of the 299.

## What this split is not

It partitions the 299 by what each skill DECLARES, not by what any host does
with it. It does not establish that the 189 are unreachable, that the 12 are
reachable, or that the boundary is drawn in the right place — a host that
selects on `description` prose would cut the population differently and this
table would say nothing about it.

The split is also machine-checked in one direction only. `report_skill_activation
--check` refuses a published claim whose counts disagree with
`agents/evidence/metrics/skill-activation-census.json`, so the table cannot be
redrawn in prose to make the zero look benign. It cannot check that the record
still describes the world: the transcript store it was taken from is one
machine's and is absent from CI.
