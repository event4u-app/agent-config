# Case study — `<short-title>`

> **Step-12 Phase 7 L128–131 template.** Drop a copy into `docs/case-studies/` with filename `<YYYY-MM-DD>-<user-type>-<slug>.md`. Anonymise as needed; metrics must be real.

## Subject

- **User-type:** (consultant | creator | founder | finance | ops | gtm | developer)
- **Tool host:** (claude-code | cursor | windsurf | copilot | claude.ai web | other)
- **`agent-config` install:** `npx agent-config init --user-type=<type>`
- **Anonymised:** yes / no (if yes — describe what was abstracted)

## Workflow before

One paragraph. What was the specific job-to-be-done? How was it solved before `agent-config` (which tool, how many steps, where did it stall)? Include **time-to-output** as a baseline metric.

## Workflow after

One paragraph. Same job, after install. Which **3–5 skills** carried the load? Which **commands** did the user actually invoke? Where did the agent ask vs. act?

## Top-10 skill invocations (proof of non-dev workflow)

Paste output of `task bench --history --top 10` (or the equivalent host log). The closure gate (L130) requires this list to contain **zero** of: `test`, `deploy`, `ci`. If it does, the case study counts as proof of non-dev workflow rather than disguised dev work.

```
 1. <skill-name>          (N invocations)
 2. ...
 ...
10. ...
```

## Quantified outcomes

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Time-to-output (minutes) | | | |
| Number of revision passes | | | |
| Self-reported confidence (1–5) | | | |
| <domain-specific KPI> | | | |

Example: *"Brief drafting: 90 min → 25 min, 73 % time reduction."*

## What broke

Be specific. The case study is only useful if it lists at least **two real friction points** — skill misfires, rule false-positives, missing user-type tags, confusing description language. These feed back into the corpus + skill descriptions.

1. ...
2. ...

## Verbatim quote (optional, with consent)

> "...short quote that captures the value the user got, in their voice..."

— `<role>, <anonymised company shape>`

## Provenance & consent

- **Interview / live walkthrough date:** YYYY-MM-DD
- **Consent for publication:** signed / verbal-recorded / declined-attribution
- **Author:** maintainer initials
- **Reviewed by user before merge:** yes / no
