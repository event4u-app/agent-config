---
complexity: lightweight
status: ready
---

# Road to a prompt optimizer that deflates before it polishes

**Goal.** Teach `prompt-optimizer` to strip the inflation patterns of viral
prompt collections — grandiose persona, presupposed canon, scope stuffing —
before it improves anything, so the optimizer stops polishing a premise the
target model will confabulate around.

**Source:** an external, German-language viral-prompt collection, harvested into
a proposal roadmap that arrived in the inbox. The source is referenced
anonymously per `source-confidentiality`; the raw proposal, with its links and
its verbatim specimen, stays local-only at
`agents/tmp.old/road-to-viral-prompt-intake-hardening.md`. Triage and the
reasons two of its four phases were dropped:
`agents/evidence/analysis/inbox-harvest-2026-08-c-triage.md`.

## Context

The proposal declared its drafting revision, which made verification mechanical:
57 commits landed since, and `git diff --quiet <drafted-SHA>..HEAD` over every
path it cites returns clean. Nothing it claims could have been overtaken, and
nothing was. Two of its greps reproduce as **empty** against the current tree:

- `grep -rin "anti-pattern"` over `src/skills/prompt-optimizer/` and
  `src/skills/refine-prompt/` → **0 hits**. Neither skill names a single input
  pattern as one to strip.
- `grep -in "debug|iterate|failure"` over
  `src/skills/prompt-optimizer/SKILL.md` → **0 hits**. The skill has a Deliver
  step (`:104`) and no notion of a delivered prompt coming back unsatisfactory.

The behavioural gap is what those two absences produce together. Fed a
specimen of the genre, the optimizer improves the slots — clearer role,
tighter constraints, better output format — while preserving a presupposition
the prompt smuggles in, so the target model invents a canon to satisfy it. The
Diagnose step (`:88`) has nothing that says *remove* rather than *sharpen*.

No roadmap owns the prompt cluster: a grep for the five prompt skills and the
template guideline across all 33 active and 42 parked roadmaps returns nothing.

## What was dropped from the proposal, and why

- **Its eval-fixture phase.** It rests on the claim that `prompt-optimizer` is
  the only cluster member without `evals/`. Literally true, and misleading: 247
  of 289 skills carry no `evals.json`, so the absence is an 86 % norm rather
  than a defect. The eval runner is also stubbed, so the fixtures could not
  execute. If the fixtures are wanted they belong to the roadmap that owns the
  eval harness, as corpus — not to a second owner.
- **Its full-collection sweep phase.** Gated on an export from a source that
  already returned an honest null, and its own pre-registration expects
  "additional fixtures at most, zero template adoptions". That is a null worth
  publishing now, not a step worth parking in a 42-deep queue.

## Phase 1 — A de-inflation step in Diagnose

- [ ] Add a de-inflation sub-step to `### 3. Inspect + Diagnose` in
      `src/skills/prompt-optimizer/SKILL.md`, naming the three patterns to strip
      and, for each, what it costs: a grandiose persona spends tokens without
      changing behaviour; a presupposed canon invites confabulation; scope
      stuffing produces an answer to a question nobody asked.
      *verify:* `grep -c "de-inflat" src/skills/prompt-optimizer/SKILL.md`
      returns non-zero and the skill linter reports the file clean.
- [ ] Add the matching entries to the skill's `## Gotcha` section (`:115`), so
      the failure is visible to a reader who skips the procedure.
      *verify:* the Gotcha section names all three patterns.
- [ ] Add a "viral-prompt anti-patterns" subsection to
      `docs/guidelines/prompt-templates.md`, so the 12-template catalogue says
      what it deliberately does not contain.
      *verify:* the subsection exists and the guideline stays under its size
      budget.

## Phase 2 — Provenance, recorded either way

- [ ] Decide whether `prompt-optimizer` gets an entry in
      `agents/settings/contexts/skills-provenance.yml`, which today carries one
      prompt-cluster entry (`:114`). Record the decision and its reason in the
      file or in this roadmap — an explicit no is a complete answer, since the
      de-inflation content is own analysis rather than adopted material.
      *verify:* the decision is written down somewhere a reader will find it.
- [ ] Check the upstream attribution already present in the tracked skill body
      against `source-confidentiality`'s recommending-versus-deriving split, and
      either leave it with a one-line reason or route it through the encrypted
      form.
      *verify:* `check_no_external_sources` passes and the disposition is stated.

## Acceptance criteria

- [ ] Diagnose names the three inflation patterns and what each one costs.
- [ ] The template guideline states what the catalogue deliberately omits.
- [ ] The provenance question has a recorded answer, yes or no.
- [ ] No new skill, no new template, no new command.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | De-inflation becomes a licence to discard the author's intent | product | Stripping a persona is one step from stripping a constraint the author meant, and an optimizer that quietly removes requirements is worse than one that polishes noise | The step names exactly three patterns and states the cost of each rather than granting a general mandate to shorten; anything outside those three stays | Phase 1 — A de-inflation step in Diagnose |
| 2 | The source leaks into the tracked tree | implementation | The proposal names its source by domain, author and handle, and reproduces a third-party prompt verbatim well past the quoting floor; copying its framing across would carry both into a tracked artefact | The source is referenced anonymously here, the specimen is not reproduced, and the raw file stays in the gitignored inbox archive | Context |
| 3 | Prose lands with no way to tell whether it helped | implementation | The change is guidance, and guidance that nobody measures is exactly the surface these reviews ask the package to stop growing | The scope is deliberately two files and no new artefact, and the eval-fixture phase was dropped rather than kept as a fig leaf of measurement it could not deliver | What was dropped from the proposal, and why |
