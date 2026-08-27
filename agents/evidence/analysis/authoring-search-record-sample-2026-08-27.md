<!-- evidence-type: analysis -->
# Does a newly added artefact record what incumbent it was searched against?

**Measured 2026-08-27** against `origin/main` at `5a8f6b592`, for
`road-to-composition-before-creation` Phase 1. Sample: the **twenty most
recently added** skills and rules by first-commit date
(`git log --diff-filter=A --follow --format=%aI -1`), spanning 2026-08-06 to
2026-08-23.

## The instrument, and its two-direction check

Step 1.3 forbids reading the count before the detection has been checked in both
directions, so that is done first and reported first.

An artefact carries an **authoring-search record** iff a passage in its own
committed text does **both**: (a) names a specific incumbent artefact in this
tree, and (b) states the delta — why this artefact exists rather than being
folded into that incumbent.

| Direction | Artefact | Result |
|---|---|---|
| Known positive | `src/rules/fix-what-you-see.md:77-87` — `## Why separate from active-remediation`, naming the incumbent and giving two measured reasons it was insufficient | detected **positive** ✅ |
| Known negative | `src/skills/experiment-loop/SKILL.md` — no `## See also`, no incumbent named anywhere in the file | detected **negative** ✅ |

Both directions behave. The count below is from an instrument that has been seen
to fire and seen to stay silent.

## The reading decides the answer — three counts, not one

Applying the definition surfaced a problem the roadmap's own criterion does not
resolve: the word "record" admits three readings, and they give three different
answers to the same kill criterion.

| Reading | Definition | Count |
|---|---|---|
| **Machine-readable** | a frontmatter field a script can parse, naming the incumbent and the delta — the roadmap's Goal says "machine-readable, written at authoring time, checkable" | **1 / 20** |
| **Strict prose** | a passage stating an authoring *decision* about a named incumbent — "why separate from X", "lifted out of X", "the procedure half of X", "the twin of X, because…" | **9 / 20** |
| **Loose prose** | any passage naming an incumbent with a stated difference, including a `Do NOT use when` routing row or a `See also` gloss | **18 / 20** |

The kill criterion (1.3) cancels Phases 2–4 at **≥ 15 / 20**. So the loose
reading **cancels** the roadmap, the strict and machine-readable readings
**continue** it. The criterion is silent on which it meant, and the count alone
cannot decide it.

## The twenty rows

`file:line` per positive; an explicit blank per negative. `S` = strict, `L` = loose.

| # | Artefact | S | L | Evidence (`file:line`) |
|---|---|:-:|:-:|---|
| 1 | `src/skills/workspace-link/SKILL.md` | — | ✅ | See also — `monorepo-workspace` — "which manager, which workspaces, which graph" (a boundary, not an authoring decision) |
| 2 | `src/skills/monorepo-workspace/SKILL.md` | — | ✅ | `:19-21` "This is the Class-A shape `standards-from-config` uses, and for the same reason" — states derivation *from* an incumbent, never why it is not *inside* it |
| 3 | `src/skills/server-hardening/SKILL.md` | — | ✅ | `:20-26` `Do NOT use when` naming `operational-readiness`, `security-audit`, `security`, `authz-review`, `terraform`, `aws-infrastructure` |
| 4 | `src/skills/operational-readiness/SKILL.md` | — | ✅ | `:24-25` "`launch-readiness` — that is a pre-merge procedure; this is a verdict over operational evidence" — a real delta, in a routing block |
| 5 | `src/skills/alerting-doctrine/SKILL.md` | — | ✅ | `:20-21` "use `logging-monitoring` first — you cannot alert on a signal the project does not have" |
| 6 | `src/skills/storybook-workshop/SKILL.md` | ✅ | ✅ | `:19-20` "Lifted out of `react-shadcn-ui` § Component workshop, which keeps a pointer here rather than a copy" |
| 7 | `src/skills/js-library-packaging/SKILL.md` | ✅ | ✅ | `:20` "The JavaScript twin of `composer-packages`" + `:170` "the PHP twin; same surface discipline, different manifest" |
| 8 | `src/rules/playbook-precedence.md` | — | ✅ | See also — "`standards-from-config` — the Class-A rule this applies to procedure". The body's contrast is with the *class* "a shipped skill", not a named incumbent |
| 9 | `src/skills/playbook-authoring/SKILL.md` | ✅ | ✅ | `:17-19` "It is the procedure half of `standards-from-config`'s Class-A rule" |
| 10 | `src/skills/judge-spec-compliance/SKILL.md` | ✅ | ✅ | `:22-27` "reused rather than reinvented… reachable only through one orchestration mode; this skill is the same job on the default review path", under `## Why this judge exists` |
| 11 | `src/rules/fix-what-you-see.md` | ✅ | ✅ | `:77-87` `## Why separate from active-remediation` |
| 12 | `src/rules/recurring-criticism.md` | ✅ | ✅ | `:109` "the other entrance… Separate file only because that one sits four lines under the 200-line cap" |
| 13 | `src/skills/experiment-loop/SKILL.md` | — | — | *(blank — no incumbent named anywhere in the file)* |
| 14 | `src/rules/missing-skill-recovery.md` | ✅ | ✅ | See also — "`external-code-graph-interop` — its rule-side twin, **and the model this rule's trigger set follows**" — an authoring lineage, not only a boundary |
| 15 | `src/skills/forensics-report/SKILL.md` | — | — | *(blank — See also names a script and `docs/CLAIMS.md`, no incumbent artefact)* |
| 16 | `src/rules/self-repair-loop.md` | — | ✅ | See also — "`skill-improvement-pipeline` — the sibling loop for capability gaps" |
| 17 | `src/rules/council-availability.md` | — | ✅ | `:59` `## Why this rule exists` explains a *failure* (five sessions read the tree instead of the resolver), not a rejected incumbent |
| 18 | `src/rules/settings-ask-protocol.md` | ✅ | ✅ | frontmatter `collision_ok["canary_name"]` — "`session-canary` owns what the NAME then does…, this rule owns how it is asked for and where the answer goes". **The only machine-readable row in the sample.** |
| 19 | `src/rules/design-review-after-ui-write.md` | ✅ | ✅ | `:60` "This is that rule's twin, deliberately built to the same shape: same tier, same pack, same diff-decidable allow-list" |
| 20 | `src/rules/evaluator-independence.md` | — | ✅ | See also — "`verify-before-complete` — the completion-claim gate this narrows" |

**Totals: machine-readable 1, strict 9, loose 18 — of 20.**

## The finding that changes the shape question

Row 18 is not a one-off. `collision_ok` is a **shipped, schema-validated,
CI-enforced** frontmatter field:

- `src/scripts/schemas/rule.schema.json:195` defines it.
- `src/scripts/lint_trigger_collisions.ts:146` requires every sharer of a
  colliding trigger to carry `collision_ok[<value>]` with a one-line reason, and
  `:241` prints the remedy.
- **47 of 120 rules** carry one.
- **0 of 299 skills** carry one — the schema does not offer it to skills.

So a machine-readable "named incumbent plus a one-line delta" field already
exists in this tree, is already enforced, and is already adopted at 39% on the
surface that has it. Two properties keep it from being the thing this roadmap is
looking for, and both are load-bearing:

1. **It is keyed by trigger value, not by incumbent.** It answers "may these two
   rules share the keyword `judge`?", not "what did you search before adding
   this?".
2. **It fires only on a collision.** An addition that overlaps an incumbent in
   *substance* while sharing no trigger is invisible to it — and an artefact
   with no trigger collision at all is never asked the question.

This is the strongest available argument that the gap is real *and* that the
mechanism should extend an incumbent rather than land beside it: the tree
already proved authors will fill in a one-line delta field when a lint asks for
it, at 39% adoption on rules and a hard gate behind it.

## What this measurement does NOT establish

- **Nothing about quality.** A row scoring ✅ was not checked for whether the
  search it implies actually happened. The strict reading measures whether a
  delta was *written*, never whether it was *earned* — which is Risk 1 in the
  roadmap ("the field becomes a pro-forma line") and is untouched by this pass.
- **Nothing about the other 279 skills and 100 rules.** Twenty is the sample the
  roadmap asked for; recency was the selection criterion, and recently added
  artefacts are plausibly *more* careful than the corpus mean, not less. The
  counts here are therefore an upper bound on the corpus, not an estimate of it.
- **Nothing about commit messages or PR bodies.** The detection reads the
  artefact's own committed text only, per 1.1's wording. A search recorded in a
  PR body and nowhere else counts as absent here — which is arguably the right
  reading for a record that is supposed to be checkable in the tree, but it is a
  choice and it is stated rather than hidden.
