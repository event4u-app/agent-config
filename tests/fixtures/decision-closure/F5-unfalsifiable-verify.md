---
status: draft
execution:
  mode: autonomous
---
<!-- A detector FIXTURE, not a plan. It carries `## Phase` headings and
     checkbox steps because the detector reads step blocks, and it carries no
     `complexity:` tier because it is not a roadmap and has no work to size.
     The tier was present in the first draft and `check_agent_artifact_location`
     classified this file as a roadmap misfiled outside `agents/roadmaps/` —
     frontmatter tier plus a `## Phase` heading plus a checkbox is exactly its
     three-signal test. -->

# F5 — verify clauses whose oracle cannot say no

Fixture for the `unfalsifiable-verify` family. Every step below carries a
`verify:` clause, so none of them is a `missing-verify` finding — the point is
that having one is not the same as having an oracle.

## Phase 1 — the three shapes that cannot fail

- [x] **1.1 A fixed-output command head.** The command runs, exits 0, and says
      nothing about the property the step claims.
      verify: `cat agents/roadmaps/some-file.md`
- [x] **1.2 A fixed-output head with an exit expectation.** Naming exit 0 on a
      command that cannot exit anything else adds a symbol, not an oracle.
      verify: `echo done` -> 0
- [x] **1.3 An expectation the failure output also prints.** The regex matches
      the command's own text, so a shell that echoes the command satisfies it.
      verify: `./scripts-run src/scripts/closure_scan f.md` -> /closure_scan/
- [x] **1.4 An unmeasured number in a manual step.** The clause claims a
      quantity and names nothing that produces it.
      verify: the page shows 51 of 155 clauses carrying a command

## Phase 2 — the controls, which must NOT fire

- [x] **2.1 A real command with a real regex expectation.** The oracle can say
      no: the count is the thing being claimed.
      verify: `grep -c 'positive control' file.md` -> /[1-9]/
- [x] **2.2 A real command with an exit expectation.** A gate that can exit
      non-zero is falsifiable by its exit code alone.
      verify: `./scripts-run src/scripts/lint_thing` -> 0
- [x] **2.3 A manual clause with no quantity in it.** Prose is MANUAL, not
      unfalsifiable — a human reads it, and that is a declared oracle.
      verify: a reviewer confirms the page names its producing command
- [x] **2.4 A manual clause whose STEP carries numbers it did not write.** The
      commonest shape in the live tree, and the one that was missing here: a
      clause with no quantity, followed by the evidence block recorded under it.
      The clause runs to the end of its paragraph, so the numbers below are not
      its own — reading them as its own produced 46 false positives.
      verify: a reviewer confirms the page names its producing command

      **Evidence 2026-09-19.** 12 sabotage probes, 15/15 cases green, baseline
      lowered 243 -> 148, and 318 gate-open fires recorded.
