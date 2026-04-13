---
name: analysis-autonomous-mode
description: "ONLY when user explicitly requests: autonomous analysis, deep investigation, or multi-step research workflow. NOT for regular tasks."
---

# analysis-autonomous-mode

## Mission

Autonomous coordinator — decide WHAT to analyze, WHICH specialist, WHEN to switch, HOW to synthesize. Route to specialists, merge output.

## When to use: broad investigation, multiple problem classes, full audit, coordinating analysis. NOT for: single narrow skill, small changes, coding.

## Available specialist skills

| Skill | Purpose | When to route |
|---|---|---|
| `universal-project-analysis` | Understand any codebase — architecture, packages, versions, patterns | Unknown system, broad understanding needed |
| `project-analysis-laravel` | Deep Laravel/PHP-specific analysis — boot flow, Eloquent, queues, packages | Laravel project, framework-specific issue |
| `bug-analyzer` | Bug investigation (reactive + proactive) — Sentry errors, Jira tickets, code audits, hidden bugs | Known error, stacktrace, OR proactive bug hunting |
| `performance-analysis` | Find bottlenecks — queries, loops, caching, I/O, scaling | Slow system, heavy queries, scaling pain |
| `security-audit` | Find vulnerabilities — injection, auth bypass, input handling | Security concern, trust boundary analysis |
| `project-analyzer` | Generate structured documentation — domain maps, service maps | Onboarding, knowledge transfer, documentation |

## Routing

| Request | Primary | Chain |
|---|---|---|
| Understand project | `universal-project-analysis` | branch per findings |
| Analyze Laravel | `project-analysis-laravel` | `bug-analyzer`, `performance-analysis` |
| Find bugs | `bug-analyzer` (proactive) | `universal-project-analysis` for context |
| Endpoint crashes | `bug-analyzer` (reactive) | `universal-project-analysis` if context missing |
| Slow system | `performance-analysis` | `bug-analyzer` if logic broken |
| Security concern | `security-audit` | `universal-project-analysis` for packages |
| Document project | `project-analyzer` | `universal-project-analysis` |

Unclear → start with `universal-project-analysis`.

## Before specialist: detect stack, versions (lock files), key packages, entrypoints, project docs. Never send blind.

## Chain signals: bug during perf → `bug-analyzer`. Package misuse → `universal-project-analysis`. Auth issue → `security-audit`. N+1 → `performance-analysis`.

## Synthesize: confirmed root causes → contributing factors → unproven risks → fixes (prioritized) → next steps. Never dump fragments.

## Loop: assess → identify unknown → choose specialist → execute → evaluate → update model → narrow or broaden → repeat until confident.

## Adapt: hypothesis fails → pivot. New evidence → re-evaluate. Stuck → broaden. Pattern recognized → narrow. 3 failures → stop, ask user.

## Escalation: narrow→broad (can't explain, unverified assumptions, cross-boundary). Broad→narrow (context exists, symptoms clear).

## Conflicts: code evidence > assumptions > docs > best practices. Mark uncertainty.

## Output: Summary (what/which skills/why) → Context (stack/versions) → Findings (issue/severity/cause/evidence/fix/confidence) → Risks → Fix order (impact→exploitability→user-facing→effort).

## Gotcha: max 10 steps without user check-in, breadth before depth, save intermediate findings.

## Do NOT: deep analysis yourself (route to specialists), run all skills without reason, stay in one skill when evidence points elsewhere, mix confirmed with guesses, output without synthesis.
