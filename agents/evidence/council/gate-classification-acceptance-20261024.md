<!-- evidence-type: analysis -->

# A closed acceptance list, and the philosophy question it rests on

AI council, 2026-10-24, the twentieth round that day. anthropic/claude-sonnet-4-5
+ openai/codex-default, design mode, 2 rounds with peer review, CLI transport,
`$0.00`, **2/2 present**. The prompt is committed verbatim beside this file as
`gate-classification-acceptance-20261024.question.md`.

This round did not ask whether 7.1 is met. It asked the seats to fix a closed
acceptance standard, after nineteen rounds in which each accepted the last ask
and raised the next.

## openai: a closed eight-item list

| # | Item and pass condition | Met now? |
|---|---|---|
| 1 | The execution universe and the predicate for *red* are recorded and executable: revision, discovery rule, invocation, prerequisites, timeout, outcome rules | No |
| 2 | A 330-row execution manifest: identity, invocation, outcome, reason tags, exactly one terminal disposition each, reconciling to 330 | No. The aggregate counts (3 + 10 + 8 + 16 = 37 of 330) leave the green remainder implicit |
| 3 | An independent re-derivation of the residual red set, **without reading the existing 16**, that returns exactly those 16 | No |
| 4 | Class predicates: mutually exclusive, or overlap and precedence defined; each of the 49 aspects carries evidence for its predicate | Not shown |
| 5 | A bounded emission inventory over a **declared** code surface, with zero unexplained sites. Mutation per supported type; dynamic and external surfaces dispositioned | Partially (the 159-site scan and the self-test) |
| 6 | Reproducibility and provenance: which parts were independently derived and which merely rerun | Partially |
| 7 | Validity, quarantine and reopening: drift quarantines the record from 7.2; a named error or a demonstrated coverage defect reopens 7.1; *"merely proposing another analysis technique does neither"* | No |
| 8 | The 7.1 consumption contract: 7.2 can determine identity, scope, validity and quarantine state mechanically; gate membership stays outside 7.1 | No |

The AST request is reframed: an exhaustive syntax-tree or control-flow
vocabulary *"is an unbounded technique posing as an acceptance objective"*. It
becomes item 5. The re-derivation of the 16 from the 330 is on the list as
items 2 and 3, and is not met.

**Owner-reserved:** *"No technical acceptance item should be owner-reserved."*
Only explicit risk acceptance is owner-reserved, for example waiving a surface
or letting 7.2 consume a quarantined record. Such a waiver must be visible,
scoped and expiring.

## anthropic: resolve the closure philosophy first

anthropic agrees on three items for any list:

- the 330-script manifest with named exclusions;
- the 7.2 entry contract;
- versioning and drift invalidation inside 7.1's own output.

Its hardest pushback: *"You're trying to fix a closed list when the council
hasn't converged on the closure philosophy."* The split of round 19 was
philosophical, not evidential. It names two options:

- **Option A:** classification, a fail-closed downstream consumption gate and
  reopening triggers are sufficient.
- **Option B:** an upfront completeness proof, including the 330-to-16
  re-derivation, is required before closure.

**Owner-reserved, per anthropic:** *"The closure philosophy choice itself … is
a business risk-tolerance decision, not a technical one."* Once it is chosen,
the technical items are council-decidable.

## Reading

The two seats agree on the items. They disagree on whether choosing between
the two closure standards is a council call or an owner call. openai would
reserve only waivers of risk to the owner. anthropic would also reserve the
standard. Under the owner-reserved table, a disagreement over whether a
transition is owner-reserved escalates to the owner. So the choice between
Option A and Option B goes to the owner. The work it decides is items 2 and 3
of openai's list, which needs a re-run of 330 scripts at `bbe5b73be` under a
recorded harness. Items 1 and 4 to 8 are owed under either option.
