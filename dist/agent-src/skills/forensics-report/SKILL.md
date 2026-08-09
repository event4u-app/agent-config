---
name: forensics-report
description: "Use when a release review needs machine-derived evidence from git history — hotspot risk and change-coupling analyzers. Triggers on 'hotspot', 'what changes together', 'release forensics'."
domain: engineering
model_tier: medium
workspaces:
  - engineering
packs:
  - forensics
trust:
  level: experimental
install:
  default: false
  removable: true
---

# forensics-report

## When to use

- Before or during a **release review**, when machine-derived evidence is
  wanted alongside the human review: "which files are the risk hotspots in
  this release", "what changes together", "release forensics".
- When intended module boundaries should be checked against what the git
  history actually shows (change-coupling across module lines).
- The output is **advisory, never a gate** — it points reviewers at places
  worth attention; it never passes or fails anything.
- NOT for IT-security incident forensics (route to `incident-commander`) and
  NOT for runtime performance hotspots (route to `performance-analysis`).

## Procedure

1. **Pick the range** — the previous release tag to HEAD (`vPREV..HEAD`) or a
   released pair (`vPREV..vNEW`). Pin the range explicitly; a floating range
   breaks determinism.
2. **Run the report:**

   ```bash
   ./scripts-run src/scripts/forensics_report --range vPREV..vNEW --out report.json
   ```

   Two deterministic, git-log-based analyzers run, read-only and offline:
   - **Hotspot risk** = normalized change frequency x normalized complexity
     per file over the range.
   - **Change-coupling** = `co_changes(A,B) / min(changes(A), changes(B))`
     per file pair.
3. **Optionally feed the release findings ledger:** add
   `--findings-out findings.json`, then ingest via

   ```bash
   ./scripts-run src/scripts/check_finding_dispositions --ingest findings.json --release X.Y.Z
   ```

   which appends to the existing ledger at
   `agents/evidence/release-findings/<version>.json`. Emitted findings are
   `kind: correctness` with `severity: low|medium` — non-blocking for the
   release gate by construction.
4. **Read the results:**
   - `hotspots[]` — a hotspot is a place for reviewer attention, NEVER a
     quality verdict. A frequently changed complex file can be exactly right
     as it is; the score says "look here", not "this is bad".
   - `coupling[]` — file pairs that habitually change together.
   - `boundary_contradictions[]` — cross-module coupling above the threshold,
     i.e. a contradiction between intended and actual boundaries. This is a
     finding CLASS to discuss, not a failure.

## Output format

Deterministic JSON with these fields:

| Field | Meaning |
|---|---|
| `mode` | analyzer mode the run used |
| `range` | the pinned rev-range analyzed |
| `scanned` | commit/file counts, including skipped bulk commits |
| `params` | thresholds and normalization parameters in effect |
| `hotspots[]` | per-file hotspot entries (path, frequency, complexity, score) |
| `coupling[]` | file-pair coupling entries (paths, co-change ratio) |
| `boundary_contradictions[]` | cross-module coupling hits above threshold |

Findings emitted via `--findings-out` conform to
`src/scripts/schemas/review-findings.schema.json` (`kind: correctness`,
`severity: low|medium`).

## Gotchas

- **Bulk commits are coupling noise** — commits touching more than
  `max_commit_files` files (default 50) are skipped by the coupling analyzer
  and counted in the report's `scanned` section.
- **Only git log + working-tree file metrics are read** — renamed files
  appear as two separate paths, splitting their history across both.
- **Deterministic only with a pinned range** — `vPREV..vNEW` reproduces;
  "since today" or a date-relative range does not.

## Do NOT

- Do NOT build a gate out of this report — the pre-registered value question
  in `docs/CLAIMS.md` (`forensics-pack-value`) decides promotion or closure;
  until then the output stays advisory.
- Do NOT sell hotspot scores as a code-quality proxy — they measure change
  frequency and complexity, not correctness or craftsmanship.
- Do NOT emit findings with `severity: high|critical` or
  `kind: security|claim` — that would block the release gate, which this
  analyzer must never do.

## See also

- `src/scripts/forensics_report.ts` — the analyzer implementation.
- `docs/CLAIMS.md` — the pre-registered `forensics-pack-value` question.
