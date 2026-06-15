# First Win — Analysis Workbench

**Time to first value:** ≈ 8 minutes from a resolved incident to a blame-free
post-mortem plus a structured learning that feeds future safety checks.

## What you'll get

A blame-free analysis of something that happened (or might) — post-mortem,
root cause, premortem, or decision-review — that ends by drafting a redacted
`incident-learnings` candidate into your memory intake. The next time anyone
touches the same surface, `security-sensitive-stop` surfaces that learning.
The loop closes itself; analysis stops being write-only.

## The one workflow

```text
1. /analyze            (after an outage, near-miss, risky plan, or old decision)
2. → the suggester proposes a weighted framework path as numbered options;
     you pick (it never auto-runs the wrong framework)
3. → e.g. /analyze postmortem: consumes the incident-commander skeleton,
     derives root cause via root-cause-frameworks, writes the blame-free
     post-mortem + corrective actions (owner + closure criterion each)
4. → it runs a dedup pre-check, then drafts a redacted incident-learnings
     candidate to /memory propose  (NEVER auto-promoted to curated memory)
5. → you review and /memory promote the ones worth keeping
```

## Expected output shape

```markdown
## Post-mortem — <incident>
Impact · Timeline (ref) · Detection · Root cause · Contributing factors
What went well / wrong

### Corrective actions
| Action | Type | Owner | Closure criterion | Signal |

### Memory candidate (draft → /memory propose)
pattern · consequence · guardrail · last_validated · review_after_days
```

## Where to start

`decision-review` is the universal entry point — it needs no prior incident,
just a past decision worth revisiting. Post-mortem / root-cause / premortem
come into play around real incidents and risky plans.

## What it does NOT do

- Coordinate a LIVE incident — that's `incident-commander`.
- Auto-promote anything to curated memory — the `/memory promote` gate stays
  human (a wrong promoted learning would mis-advise every future retrieve).
- Blame individuals — systems and processes only.
