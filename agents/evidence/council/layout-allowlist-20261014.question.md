<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-14, committed verbatim so the
     verdict beside it can be checked against what was actually asked. -->

# Question: where may a tracked file whose name starts with `council-` live?

## Context (repository facts, each re-read on 2026-10-14)

- `src/scripts/check_council_layout.ts` flags any file under `agents/` whose
  basename matches `/^\.?council-/` unless it sits in
  `agents/runtime/council/{questions,responses,sessions}/` or under a
  top-level `agents/` directory whose name starts with `audits` or `runtime`.
  It exits 1 today, on 11 files, and runs in no workflow. A roadmap step asks
  that its findings be fixed and that it then be wired into a required CI job.
- The 11 files: 7 under `agents/evidence/analysis/` (four are verbatim
  transcriptions of council runs dated 2026-09-08, three are analyses whose
  subject is the council subsystem itself: a behaviour baseline, a surface
  inventory, a verbatim scan), and 4 under `agents/evidence/reviews/` named
  `council-<branch-slug>.findings.md` — completion-review artefacts of branches
  whose slug starts with `council-`. A separate memory of this repository
  records that review artefacts may not be renamed (their name is keyed to the
  branch by contract).
- `agents/runtime/` is gitignored and auto-pruned after 7 days; nothing in it
  is ever committed.
- `docs/contracts/agents-layout.md` lists `agents/evidence/` as tracked-durable,
  permanent, "everything evidential", with sub-dirs including `council/`.
- `src/skills/ai-council/references/output-and-synthesis.md` § Forbidden lists
  "any other directory below `agents/` (e.g. `agents/scratch/`,
  `agents/evidence/notes/`)" and § Exempt lists only `agents/evidence/audits/`
  ("audit bundles are tracked, cohesive narratives that may include council
  artefacts"). The gate's actual exemption is the top-level `agents/audits*`,
  so the skill and the gate already disagree on that path.
- The council-reference rule forbids durable artefacts from LINKING to files in
  `agents/runtime/council/`, and asks that convergence summaries be inlined.

## Options

A. Exempt the whole top-level `agents/evidence/` in the gate (it is the
   contract's tracked-durable home), and correct the skill reference's
   Forbidden / Exempt lists to say so; the canonical runtime dirs stay the only
   home for raw session files that are not deliberately kept as evidence.
B. Exempt only `agents/evidence/reviews/` (names keyed to branch slugs) and
   `agents/evidence/audits/`, and move the 7 analysis files to
   `agents/evidence/council/` under names without the `council-` prefix,
   migrating every inbound reference.
C. Change nothing in the gate or the files; record the gate as not wirable and
   leave the roadmap step open.
D. Another option you consider better.

## What is asked

Which option should be taken, and why? Name any risk the chosen option carries
that the others do not.
