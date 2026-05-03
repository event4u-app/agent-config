---
title: "Phase 3b/3c — feasibility audit (project-analysis-* + skill-*)"
roadmap: agents/roadmaps/road-to-structural-optimization.md
phase: "3b, 3c"
stability: beta
locked_at: 2026-05-03
status: closed
verdict: do_not_consolidate
---

# Phase 3b/3c — Feasibility audit

**Verdict: DO NOT CONSOLIDATE.** Same shape as Phase 3a (locked at
`.agent-src.uncompressed/contexts/judges/no-consolidate-rationale.md`):
the procedural skeleton across both families is too thin for
extraction to clear the 30 % per-skill LOC reduction threshold.

## Method

For each family, computed lines that appear in ≥ 2 sibling skills
(after stripping leading whitespace and frontmatter, length ≥ 5).
This is a tight upper bound on "skeleton hoistable into a shared
context" — actual extractability is lower because most repeats are
markdown section headers each skill still needs locally.

## 3b — `project-analysis-*` (8 skills, 959 LOC)

| Skill | Body LOC | Shared | Shared % |
|---|---:|---:|---:|
| project-analysis-core | 91 | 9 | 10 % |
| project-analysis-hypothesis-driven | 85 | 9 | 11 % |
| project-analysis-laravel | 77 | 15 | 19 % |
| project-analysis-nextjs | 80 | 12 | 15 % |
| **project-analysis-node-express** | **72** | **19** | **26 %** |
| project-analysis-react | 78 | 12 | 15 % |
| project-analysis-symfony | 72 | 17 | 24 % |
| project-analysis-zend-laminas | 69 | 16 | 23 % |

**Max shared %: 26** (node-express). To hit the roadmap's 30 %
per-skill LOC reduction target on the 111-line node-express skill,
~33 lines must be hoisted. Only 19 are available, and 14 of those
are markdown section headers each skill **still needs locally**
(`## Procedure`, `## When to use`, `## Do NOT`, `## Output format`,
`## Gotcha`, `## Core principles`, `Use this skill when:`,
`Do NOT use when:`).

**Net hoistable lines per skill: ~5.** The 30 % bar is
unreachable.

## 3c — `skill-*` (4 skills, 782 LOC)

| Skill | Body LOC | Shared | Shared % |
|---|---:|---:|---:|
| skill-improvement-pipeline | 102 | 8 | 8 % |
| skill-management | 86 | 5 | 6 % |
| skill-reviewer | 147 | 7 | 5 % |
| skill-writing | 189 | 6 | 3 % |

**Max shared %: 8** (improvement-pipeline). 8 unique shared lines
total — all of them markdown section headers
(`## Do NOT`, `## Output format`, `## When to use`, `## Gotcha`,
`Use this skill when:`, `## Gotchas`). Zero shared procedural
content. The four skills cover **disjoint lifecycle phases**
(write → review → improve → manage); they are not variants of one
procedure, they are siblings in a pipeline.

**Net hoistable procedural lines: 0.** 30 % bar is structurally
impossible.

## Why the math doesn't work

Same root cause as Phase 3a:

1. **Markdown section headers are not extractable.** Each skill
   needs its own `## Procedure` / `## When to use` / `## Do NOT` —
   they are part of the skill's local navigation surface, not a
   shared-procedure body. Counting them as "shared" inflates the
   apparent overlap.
2. **Body content is intrinsically framework-/phase-specific.**
   `project-analysis-laravel` analyzes Eloquent and middleware;
   `project-analysis-react` analyzes hooks and rendering. The
   "shared procedure" reduces to "discover the project, read its
   code" — too generic to be a useful context.
3. **`project-analysis-core` is already the shared host.** It
   covers the universal discovery workflow (project discovery,
   version resolution, docs loading, architecture mapping) and is
   referenced by `universal-project-analysis` as the entry point.
   Framework-specific skills already build on top of it; further
   consolidation would collapse two layers that are deliberately
   separate.
4. **`skill-*` is a pipeline, not a family.** The four skills are
   not lens-variants of one procedure (the way `judge-*` are
   lens-variants of "review a diff"). They are sequential
   lifecycle stages. Persona-style consolidation does not apply.

## Decision

- **Phase 3b — closed without restructure.** Same Path B success as
  Phase 6: the audit ran, the answer was "already optimal".
  `project-analysis-core` continues to host the shared workflow;
  framework-specific skills stay self-contained.
- **Phase 3c — closed without restructure.** Same outcome. The
  four skills cover disjoint lifecycle phases; no shared procedure
  exists to extract.

The locked Phase-3a decision rationale at
[`.agent-src.uncompressed/contexts/judges/no-consolidate-rationale.md`](../../.agent-src.uncompressed/contexts/judges/no-consolidate-rationale.md)
already anticipated this outcome:

> "The same argument applies to procedural duplication in any small
> skill family where the procedural skeleton is short and the
> persona table is the bulk of the file."

## Reopening conditions

Reopen 3b only if **all** of:

1. A new framework analysis skill is added bringing the family to ≥ 10.
2. A non-trivial cross-framework procedural step (≥ 30 LOC) is
   identified that all framework skills must execute identically.
3. `project-analysis-core` is itself measurably bloated (> 200 LOC).

Reopen 3c only if the four skills converge on a shared lifecycle
hook (e.g. a unified telemetry path) ≥ 30 LOC long.

Otherwise, treat any "let's extract shared procedure across these
skills" proposal as a regression and cite this file.

## Reproducibility

Reproduce the line-overlap analysis with the inline Python below
(saved alongside this audit on the commit that closes 3b/3c). If
the per-file shared % moves above 30 % in ≥ 2 skills of either
family, this verdict is stale and must be re-run.

```python
from pathlib import Path
from collections import Counter

def analyze(paths):
    bodies = {}
    for p in paths:
        text = p.read_text(encoding="utf-8")
        if text.startswith("---\n"):
            _, _, text = text[4:].partition("\n---\n")
        bodies[p.parent.name] = [
            ln.strip() for ln in text.splitlines() if len(ln.strip()) >= 5
        ]
    counter = Counter()
    for lines in bodies.values():
        for ln in set(lines):
            counter[ln] += 1
    shared = {ln for ln, c in counter.items() if c >= 2}
    for name, lines in sorted(bodies.items()):
        in_shared = sum(1 for ln in lines if ln in shared)
        pct = in_shared / len(lines) * 100 if lines else 0
        print(f"  {name:50s}  {in_shared:3d}/{len(lines):3d}  ({pct:.0f}%)")

ROOT = Path(".agent-src.uncompressed/skills")
print("3b:"); analyze(sorted(ROOT.glob("project-analysis-*/SKILL.md")))
print("3c:"); analyze(sorted(ROOT.glob("skill-*/SKILL.md")))
```
