<!-- analyzed: 2026-06-15 | commit: 57588489 | files: 0 -->
# Analysis evidence — freshness convention

`project-analyzer` (and ad-hoc analysis) output lands here. Each file carries a
one-line **freshness header** so the agent can cheaply judge whether a high-tier
re-analysis is worth the tokens.

## Header

```
<!-- analyzed: <ISO date> | commit: <short sha> | files: N -->
```

- `analyzed` — when the analysis was last confirmed against the codebase.
- `commit` — the repo state it was taken at (for the staleness diff).
- `files` — count of repo paths the doc cites (best-effort; the probe re-detects).

## Probe (heuristic, not a gate)

```bash
python3 src/scripts/analysis_freshness.py --stamp <file>   # add/refresh header
python3 src/scripts/analysis_freshness.py --stamp-all
python3 src/scripts/analysis_freshness.py --check <file>   # staleness signal
python3 src/scripts/analysis_freshness.py --check-all
```

`--check` runs `git diff --name-only <commit>..HEAD` over the analyzed paths and
reports `fresh` / `aging` / `STALE`. This is a **heuristic** — a low changed-file
count *suggests* the analysis still holds; it does not prove it (a one-line change
can invalidate an analysis). Use it to decide whether re-analysis is worth the
cost, never as a correctness gate. File-first, no runtime.
