# agents/reports/ — retention convention

Reports here are one of two kinds; nothing else accumulates:

1. **Regenerated-in-place artifacts** — outputs of a script that overwrites
   the same path on every run (`command-surface.{md,json}`,
   `command-budget-audit.{md,json}` from `audit_command_surface.ts`;
   `auto-rules-audit.*`, `auto-rules-overlap.json`; `skill-overlap.*`;
   `user-type-axis-audit.md` from `audit_user_type_axis.ts`). Staleness is
   fixed by re-running the generator, never by hand-editing.
2. **Decision-provenance snapshots** — point-in-time worksheets that stable
   artifacts (ADRs, contracts) cite as evidence. They stay tracked exactly as
   long as a stable artifact links them. Current set:
   `command-classification-6.0.0-d.md` (cited by ADR-044/-047/-048/-055).

Everything else is expired by default: a one-shot report with **zero inbound
references** from stable artifacts is deleted when noticed (git history is
the archive). Before deleting, run the sweep:

```bash
grep -rln "<file>" --include='*.md' --include='*.ts' --include='*.yml' \
  src docs agents .github | grep -v 'agents/reports/\|roadmaps/archive'
```

Convention landed 2026-07-12 (road-to-opt-hygiene-and-debt Phase 3); the
same pass deleted `step-16-19b-execution-plan.md`,
`6.0.0-e-md-language-audit.md`, `6.0.0-upgrade-cleanup-verification.md`,
and the stale `human-owner-todo.md` (all zero-reference).
