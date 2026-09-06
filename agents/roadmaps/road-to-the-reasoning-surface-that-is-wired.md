---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-the-activation-census-consequence
    relation: disjoint
    note: >
      That roadmap owns the question of whether the skill surface is entered at
      all, across all 299. This one owns four wiring defects on one skill and
      its evaluation corpus, each reproduced by a command. A census can read
      zero for reasons that have nothing to do with these four, and fixing
      these four would not move a census.
estate_growth_exempt: "Four defects on one surface, each reproduced at 6af83a64b and owned by no active roadmap, later roadmap or stub: an evaluation corpus of 21 fixtures whose only two validators were deleted in the Python retirement and never replaced, with five surviving references instructing a reader to run them; a skill that instructs the model to call a tool `mcp.json` registers nowhere; that same skill grandfathered into the trigger-eval allowlist while carrying no `evals/` directory; and three skills whose description says explicit-request-only while their body publishes auto-trigger keywords. The adjacent owner named in `relates:` answers a different question and says so."
estate_offset_exempt: "Offsets nothing. The nearest candidate would be the activation-census roadmap, and archiving it to pay for this would close the population question by accounting while leaving the population unmeasured."
---
# Road to the reasoning surface that is wired

> **Source:** `agents/tmp.old/inbox-2026-09-r/` — one of eleven prepared harvest
> loops delivered on 2026-09-06. Two of the four defects were named there; the
> corpus-has-no-validator finding and the empty `mcp.json` are this run's own
> reproduction. The round's own claim that the tree pin was unresolvable is
> `never-true` and is not carried: `6af83a64b` is `origin/main`.

## Goal

Every instruction the reasoning surface gives — to a model, to a reader, or to
CI — points at something that exists. Four things reproduced at `6af83a64b` do
not. First: `tests/reasoning-layer-eval/` holds 21 fixtures across 8 disciplines
and **zero** validators — `find … -name '*.ts' -o -name '*.py'` returns nothing —
while `README.md:18,22,56,57` and `trigger-fixtures.json:3` instruct a reader to
run `validate_fixtures.py` and `src/scripts/skill_trigger_eval.py`, both deleted <!-- ref-ignore -->
with the Python retirement; `grep -rn reasoning-layer-eval Taskfile.yml
.github/workflows/` returns zero, so nothing runs the corpus either. Second:
`src/skills/sequential-thinking/SKILL.md:148-151` tells the model how often to
call a `sequentialthinking` tool, and `mcp.json` is `{"servers": {}}`. Third:
`src/scripts/trigger_eval_grandfather.json:169` grandfathers that same skill out
of the trigger-eval requirement, and the skill carries no `evals/` directory to
be excused from. Fourth: `adversarial-review`, `project-analyzer` and
`sequential-thinking` each say `explicit request only` in their description and
each publish an `## Auto-trigger keywords` section. Out of scope by decision:
registering any MCP server (a consumer-facing install decision), and any change
to what the RDP itself requires.

## Phase 1 — The corpus can be checked

- [ ] **1.1 Write the structural validator the corpus lost.** A TypeScript check over
      `trigger-fixtures.json` asserting the real schema — the five keys `q`, `trigger`,
      `discipline`, `host`, `note`, `host` in `standard|strong`, `trigger` boolean — and
      failing on a malformed row. The deleted Python is the specification, not the
      implementation; nothing about the corpus needs a model call.
      verify: the check passes on the 21 shipped rows, and a fixture row with a sixth
      key, a missing `discipline`, or `host: "medium"` reddens it.
- [ ] **1.2 Wire it, or say in the corpus that nothing runs it.** Either a Taskfile
      target and a `src/config/gate-coverage.yml` row with a CI-identical `argv`, or a
      line in `README.md` stating that the corpus is checked by hand.
      verify: `grep -rn reasoning-layer-eval Taskfile.yml .github/workflows/` returns a
      caller, or `README.md` carries the statement and no file claims a check that no
      caller performs.
- [ ] **1.3 Repair the five dangling instructions.** `README.md:18,22,56,57` and
      `trigger-fixtures.json:3` name two deleted files. Point them at 1.1's validator,
      or delete the instruction where the capability is genuinely gone — the billable
      live-scoring path has no replacement and should say so rather than name a file.
      verify: `grep -rn "validate_fixtures.py\|skill_trigger_eval.py" tests/ src/`
      returns only historical notes that say the file was retired.

## Phase 2 — A skill does not instruct a call nothing serves

- [ ] **2.1 Say what `sequentialthinking` is, where it comes from, and what happens
      without it.** `mcp.json` registers no servers, so on a default install the
      skill's three usage limits govern a call the model cannot make. Either the skill
      names the server a consumer must register and states the degraded path, or the
      tool-call framing is replaced by the in-session procedure it describes.
      verify: the skill contains no unqualified instruction to call a tool, and a
      reader on a default install can tell from the skill alone whether the tool is
      available to them.
- [ ] **2.2 Resolve the grandfather entry against reality.** `trigger_eval_grandfather.json:169`
      excuses a skill from a trigger-eval requirement it does not meet, which reads as a
      waived obligation rather than an absent one.
      verify: either `src/skills/sequential-thinking/evals/` exists and the entry is
      removed, or the entry carries a reason naming the absence rather than the waiver.

## Phase 3 — A description and its body agree

- [ ] **3.1 Decide, per skill, which of the two statements is true.** For
      `adversarial-review`, `project-analyzer` and `sequential-thinking` the description
      says explicit-request-only and the body publishes auto-trigger keywords. One of
      them is wrong in each case and the pair is what a router and a reader read.
      verify: no `SKILL.md` in the tree both matches `explicit request only` in its
      description and carries an `## Auto-trigger keywords` section; a fixture carrying
      both reddens a check.
- [ ] **3.2 Make the contradiction a check rather than a finding.** The pair is
      mechanically decidable from the file, so it should not need a reviewer to notice
      it again.
      verify: `./scripts-run src/scripts/check_gate_coverage` passes with the new check
      registered, and the check names the skills it inspected.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The validator is written and validates nothing that could fail | implementation | A schema check over 21 hand-written rows that were already valid is the definition of a green gate that never fires; it would satisfy 1.1 while proving nothing about the corpus. | 1.1's verify names three concrete malformations — extra key, missing `discipline`, illegal `host` — and requires each to redden; a validator that passes all three is rejected by the step rather than accepted by it. | Phase 1 — The corpus can be checked |
| 2 | Phase 2 quietly registers an MCP server | product | The shortest path to "the skill's instruction is true" is to add a server entry to `mcp.json`, which changes what a consumer install runs and is a decision this roadmap does not own. | The goal names MCP registration as out of scope by decision, and 2.1's verify is satisfied by the skill describing the dependency and its degraded path — never by the dependency being installed. | Phase 2 — A skill does not instruct a call nothing serves |
| 3 | Phase 3 resolves the contradiction by deleting the harder half | product | Removing the `## Auto-trigger keywords` section from all three skills clears the check in minutes and may silently narrow how three skills reach the model, which is a routing change wearing a consistency fix. | 3.1 requires a per-skill decision about which statement is true rather than a uniform edit, and 3.2's check is registered so a later reversal is visible rather than silent. | Phase 3 — A description and its body agree |
| 4 | The corpus is wired into CI and then costs a model call | implementation | The corpus's second, deleted validator was explicitly billable; wiring "the eval" into CI without distinguishing the two would put a paid call on every pull request. | 1.1 is scoped to structure and states that nothing about the corpus needs a model call; 1.3 requires the billable path to be described as absent rather than named as a file, so the two cannot be confused by a later reader. | Phase 1 — The corpus can be checked |

## Acceptance Criteria

- [ ] AC-1 — A structural validator for `trigger-fixtures.json` exists, passes on the 21 shipped rows, and reddens on each of three named malformations.
- [ ] AC-2 — Either a caller runs it and `src/config/gate-coverage.yml` carries its row with a CI-identical `argv`, or the corpus states in its own README that nothing runs it.
- [ ] AC-3 — No file under `tests/` or `src/` instructs a reader to run a retired Python script except as a historical note.
- [ ] AC-4 — `src/skills/sequential-thinking/SKILL.md` carries no unqualified instruction to call a tool that a default install does not serve, and no MCP server was registered by this roadmap.
- [ ] AC-5 — The grandfather entry for that skill either names the absence or is gone, with an `evals/` directory in its place.
- [ ] AC-6 — No `SKILL.md` both declares explicit-request-only and publishes auto-trigger keywords, and a fixture carrying both reddens a registered check.
