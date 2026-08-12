# Symptom intake — production reports from operators

> One file per report. Nothing else. This directory exists because a production
> symptom arriving from an operator — "endless subagent runs", "the agent
> screenshots instead of reading the code" — previously had **nowhere in the tree
> to land**: it lived in a chat log until someone happened to turn it into a
> roadmap, and the three 2026-08-12 reports are the proof (all three were real
> defects; none had a home).

Convention established by `road-to-symptom-driven-harvest-loop` (executed and
archived 2026-08-12) — named, not linked, because a stable artifact must not
carry a link into `agents/roadmaps/`, which is a transient layer. The procedure
this intake feeds is
[`symptom-driven harvest`](../../../docs/guidelines/agent-infra/symptom-driven-harvest-loop.md);
the falsifier below is the live part of the plan.
This is intake, not a tracker: it records that a symptom was reported and what
became of it. It has no status workflow, no SLA, and no dashboard.

## The convention

One markdown file per report, named `YYYY-MM-DD-<short-slug>.md`. Copy
[`_template.md`](_template.md). Frontmatter:

| Key | Meaning |
|---|---|
| `reported` | `YYYY-MM-DD` — when the operator reported it, not when it was filed |
| `reporter` | a **role**, never a name (`operator`, `maintainer`, `colleague-of-maintainer`) |
| `host` | the tool the symptom appeared on, with version if known (`claude-code 2.1.220`) |
| `symptoms` | a list, one line each, in the reporter's own terms |

The body is free-form. What the reporter said is worth keeping verbatim in
meaning; write it in English (this tree's `.md` language rule applies here too —
the raw transcript, in whatever language it arrived, stays in the consumed inbox).

## Resolution — every entry ends in one of two blocks

A symptom is only useful once someone has checked it against the tree. After
**30 days** an entry must carry exactly one of these; `lint_symptom_intake`
warns until it does.

```markdown
## confirmed:

- **Defect:** <one line> — `path/to/file.ts:LINE`
- **Pinned at:** <commit sha>
- **Roadmap:** <link to the roadmap that owns the fix>
```

```markdown
## null:

- **Checked:** <what was actually run or read>
- **Pinned at:** <commit sha>
- **Verdict:** not reproducible — <why>
- **Evidence:** <link, or "this file">
```

A `null:` is a **result**, not a failure to act. An operator report that turns
out not to reproduce on current main is worth exactly as much as one that does,
and recording it stops the same symptom being re-investigated next quarter.

## What NOT to put here

- Feature requests, ideas, or preferences — those are roadmap or ticket material.
- Bugs the reporter already diagnosed to a file — that is a roadmap item.
- Anything auto-filed. Intake is human-reported by design; a bot filing symptoms
  would flood the staleness lint and make the 30-day signal meaningless.
- Names, emails, customer identifiers, or internal hostnames — `reporter` is a
  role for exactly this reason.

## Falsifier

Two release cycles with zero entries beyond the three backfills → this surface
has no demand: delete the directory and the lint, and record the null. The
cautionary precedent is `docs/install-friction-report.md`, an intake instrument
that has read `status: template — awaiting sessions (no real data yet)` across
every release review since it was created. An instrument nobody feeds is estate
weight, and it reads as coverage while measuring nothing.
