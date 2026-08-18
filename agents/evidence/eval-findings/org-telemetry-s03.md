<!-- evidence-type: analysis -->

# Spike s03 — the regex collector's undercount, as a number

**Date:** 2026-08-18
**Roadmap:** [road-to-org-telemetry.md](../../roadmaps/road-to-org-telemetry.md) Phase 0
**Tree:** `851568b5c` (branch base `origin/main`)
**Host stamp:** Claude Code 2.1.234 · node v25.9.0 · store `~/.claude/projects`
**Pre-registered threshold:** none — the step is a measurement, not a gate. It
exists to satisfy the roadmap's acceptance criterion "the regex collector's
undercount is published as a number before any decision retires it."

## Verdict — published: the current method detects 0 of 89 real skill invocations

On the session set `skill_usage_collect` actually reads, the `mention` signal
that decides `status: active` fired **once**, for a skill that was **never
invoked**, while 12 skills were invoked 89 times and scored `dead` or
`exposed-only`. On this sample the signal is not merely lossy — it is
**uncorrelated with invocation**: the overlap between invoked and mentioned is
zero.

| Metric | Canonical slug (what the collector reads) | Every worktree slug of this repo |
|---|---:|---:|
| session files | 119 | 283 |
| Skill invocations (`tool_use`, name `Skill`) | **89** | **164** |
| distinct skills invoked | 12 | 17 |
| `mention` records emitted | **1** | 2 |
| distinct slugs mentioned | 1 | 1 |
| invoked ∩ mentioned | **0** | 1 |
| invocations the method misses | **89 / 89 = 100 %** | 163 / 164 = 99.4 % |

## Two independent causes, quantified separately

**1 — the signal never looks at tool calls.** `skill_usage_collect.ts` emits two
kinds. `exposure` reads a `skill_listing` attachment; `mention` reads assistant
**text** for `` `slug` `` after one of nine anchor verbs, or a `SKILL.md` path
(`:164-191`). Neither inspects `tool_use`. An actual invocation therefore leaves
no record unless the assistant separately writes prose naming it — which on 119
real session files happened for **zero** of 89 invocations.

The 12 skills invoked and unseen: `ai-council`, `challenge-me-with-docs`,
`condense`, `optimize:project`, `pr:create`, `roadmap-process-full`,
`roadmap-writing`, `roadmap:ai-council`, `roadmap:process-full`,
`threat-modeling`, `using-git-worktrees`, `worktree:create`.

**2 — the store is scoped to one directory.** The slug is `REPO` with `/`→`-`
(`:63-84`), so every worktree of this repository is a separate, invisible store.
48 such directories exist; the collector reads **119 of 283** session files, i.e.
**42.0 %**. A further 75 invocations are out of scope before the signal defect is
even reached.

## The causal chain to "Active: 0", closed end to end

`skill_usage_report.ts:13` defines `active = mentions_30d ≥ 1`. So the published
report's `Active: 0` rests entirely on the signal measured at 0/89 above. Running
the report over three different inputs makes the chain visible:

| Input | Tracked | Active | Exposed-only | Dead |
|---|---:|---:|---:|---:|
| committed `skill-usage-report.md` (2026-05-26) | 337 | 0 | 181 | 156 |
| the data that exists on disk today, `agents/runtime/metrics/skill-usage.jsonl` (2026-05-16) | 348 | **0** | 0 | 348 |
| a fresh collection over the canonical slug, today | 393 | **1** | 175 | 217 |

The third row is the finding. A fresh collection today reports exactly **one**
active skill — and it is `agent-handoff`, the single prose mention, which appears
in **zero** `tool_use` blocks. Every skill that was actually used is counted as
dead or exposed-only.

**A third cause, found while measuring: the report's input path does not exist.**
Both scripts read and write `agents/metrics/skill-usage.jsonl` in code
(`skill_usage_collect.ts:34`, `skill_usage_report.ts:27`), and that path is
absent on the maintainer machine. What exists is
`agents/runtime/metrics/skill-usage.jsonl`, gitignored and last written
2026-05-16 — the path the report's own emitted prose still names
(`skill_usage_report.ts:231`). So the committed baseline was produced under a
superseded layout, and a default-flag re-run today reads nothing. Row 2 above is
what that stale file yields: every record is older than the 30-day window, so
that zero is staleness, not measurement. This is a real defect in the surface
Phase 4 extends, and it is recorded here rather than fixed — Phase 0 ships no
code.

## Method

One read-only scan, `spike13_scan.py`, over `~/.claude/projects/`:

- **event arm** — every assistant `tool_use` block with `name == "Skill"`,
  deduped on `(session, turn, skill)` to match the collector's own dedup tuple.
- **regex arm** — a replica of `find_mentions` / `extract_listing` /
  `extract_text`, deduped on `(session, turn, slug)`.
- **validation of the replica against the real tool**, which matters because a
  measurement written by the same hand as the thing measured can agree with
  itself: `skill_usage_collect --project-slug <canonical> --out <scratch>`
  emitted `exposure: 8908, mention: 1`, slug `agent-handoff`. The replica's
  mention arm returned 1 record, 1 slug, same slug. Agreement on the axis that
  carries the verdict.

Known-slug vocabulary: 338 in-repo slugs from `.augment/skills`, `.claude/skills`
and `dist/agent-src/skills`, the same three roots the collector loads.

One honest artefact of the validation run: `skill_usage_collect` exits non-zero
when `--out` points outside the repository, because its summary line calls
`_relToRepoPosix` (`:349-355`). The throw happens **after** the append loop has
closed its file handle, so the 8,909-record output is complete — verified by
counting it. The crash is a property of a scratch `--out`, not of the collection.

## Consequence for the roadmap

- Phase 0 step 3: **closed.** The undercount is published: 0 of 89 on the read
  set, 163 of 164 across the repository's real session estate.
- The acceptance criterion "the regex collector's undercount is published as a
  number before any decision retires it" is now satisfiable by citation.
- The Context table's claim that the zero is an instrumentation artifact rather
  than an adoption measurement is **confirmed with a number**, and it was in fact
  understated: the signal is anti-correlated with use on this sample, not merely
  blind to it.
- Phase 4 inherits a prerequisite this spike surfaced: the report's input path is
  broken, so adding the sink as a *second* source lands beside a first source
  that reads nothing.

## Reproduction

```bash
python3 spike13_scan.py "$PWD"          # scratch-only; § Method specifies it
./scripts-run src/scripts/skill_usage_collect \
    --project-slug -Users-…-agent-config --out /tmp/collector-canon.jsonl
./scripts-run src/scripts/skill_usage_report \
    --in /tmp/collector-canon.jsonl --out /tmp/report-fresh.md
```
