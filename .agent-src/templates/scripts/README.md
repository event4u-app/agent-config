# PR Risk Review — installation

Heuristic PR risk classifier **and** review routing. Posts two sticky
comments on every non-draft PR:

- **PR Risk** — `low / medium / high` label plus matched hotspots;
  applies a `risk:<level>` label.
- **Review Routing** — owner-mapped reviewer roles from
  `ownership-map.yml` and any matched entries from
  `historical-bug-patterns.yml`.

Both are **informational** — conversation starters for reviewers, not
merge gates. Add a separate required check if you want a hard stop on
high-risk PRs.

## What gets installed

| File in package | Copy to | Purpose |
|---|---|---|
| `templates/github-workflows/pr-risk-review.yml` | `.github/workflows/pr-risk-review.yml` | GitHub Actions workflow |
| `templates/scripts/pr_risk_review.py` | `scripts/pr_risk_review.py` | Risk classifier (Python 3.10+, PyYAML) |
| `templates/scripts/pr_review_routing.py` | `scripts/pr_review_routing.py` | Routing classifier |
| `templates/scripts/pr-risk-config.example.yml` | `.github/pr-risk-config.yml` | Risk patterns (optional) |
| `templates/scripts/ownership-map.example.yml` | `.github/ownership-map.yml` | Ownership entries (optional) |
| `templates/scripts/historical-bug-patterns.example.yml` | `.github/historical-bug-patterns.yml` | Registered failure modes (optional) |

## Install

```bash
# from the consumer repo root
cp .augment/templates/github-workflows/pr-risk-review.yml    .github/workflows/
cp .augment/templates/scripts/pr_risk_review.py              scripts/
cp .augment/templates/scripts/pr_review_routing.py           scripts/
cp .augment/templates/scripts/pr-risk-config.example.yml     .github/pr-risk-config.yml
cp .augment/templates/scripts/ownership-map.example.yml      .github/ownership-map.yml
cp .augment/templates/scripts/historical-bug-patterns.example.yml .github/historical-bug-patterns.yml
```

The routing step in the workflow is **conditional** — it only runs if
`scripts/pr_review_routing.py` exists, so risk classification alone works
without routing being installed.

Create the three labels once (or let them be auto-created on first run):

```bash
for level in low medium high; do
  gh label create "risk:$level" --color "$(case $level in
    high) echo b60205 ;; medium) echo fbca04 ;; low) echo 0e8a16 ;;
  esac)" --description "PR risk: $level" --force
done
```

Commit the workflow and config. The first PR you open afterwards triggers
the action.

## Customize

Edit `.github/pr-risk-config.yml`:

- **Add** patterns to `high` for paths where review must be careful
  (payment code, tenant boundaries, feature flags you care about).
- **Add** patterns to `medium` for shared services, public endpoints,
  non-critical jobs.
- **Add** patterns to `ignore` for paths that should never influence the
  level (docs, generated files, snapshot tests).

Matching uses `fnmatch` glob syntax (`**/auth/**`, `composer.lock`, …).

If you do not want a config file, delete it — the script falls back to
defaults that cover migrations, lockfiles, auth, workflows, and infra
across Laravel, Symfony, Django, Rails, Node, and Next.js.

## What the PR comment looks like

```
## 🟡 PR Risk: medium

_14 changed file(s), 2 risk signal(s)._

### 🟡 Medium
- `**/app/Http/Controllers/**` — 2 file(s)
  - `app/Http/Controllers/Api/OrderController.php`
  - `app/Http/Controllers/Api/PaymentController.php`
- `composer.json` — 1 file(s)
  - `composer.json`

---
_Classifier is heuristic. Merge is not blocked by this check._
```

The same comment is **updated** (not re-posted) on every new push thanks
to `marocchino/sticky-pull-request-comment`.

## Routing comment format

```
## 🔴 Review Routing: high

_3 changed file(s), 2 historical pattern(s) matched._

### Suggested reviewers (role-based)
- primary:   finance-engineering — focus: tax calculation + idempotency
- secondary: security            — focus: tax calculation + idempotency

### Historical patterns matched
- 🔴 queue-job-not-idempotent — Queue job without idempotency key
    required test: assert a retried job does not double-write
- 🔴 blade-unsafe-html        — Blade component renders user input with {!! !!}

_Data source: ownership-map.yml + historical-bug-patterns.yml. …_
```

Curate `ownership-map.yml` and `historical-bug-patterns.yml` over time —
see `../../../docs/guidelines/agent-infra/review-routing-data-format.md` for
the full schema.

## Uninstall

```bash
rm .github/workflows/pr-risk-review.yml
rm scripts/pr_risk_review.py
rm scripts/pr_review_routing.py
rm .github/pr-risk-config.yml .github/ownership-map.yml .github/historical-bug-patterns.yml
gh label delete risk:low risk:medium risk:high
```

## Verifying locally

```bash
python3 scripts/pr_risk_review.py \
  --base origin/main --head HEAD \
  --config .github/pr-risk-config.yml \
  --output /tmp/risk-report.md \
  --level-file /tmp/risk-level.txt

python3 scripts/pr_review_routing.py \
  --base origin/main --head HEAD \
  --ownership-map .github/ownership-map.yml \
  --patterns .github/historical-bug-patterns.yml \
  --output /tmp/routing-report.md \
  --level-file /tmp/routing-level.txt

cat /tmp/risk-report.md /tmp/routing-report.md
```

## Limitations

- **Heuristic only.** A PR with no matched patterns is labeled `low` even
  if it changes business-critical logic. Reviewers still need to read.
- **No semantic analysis.** The classifier looks at paths, not diff
  content. A whitespace-only edit to `composer.lock` is still `high`.
- **Not a policy engine.** Use CODEOWNERS + required reviews for
  enforcement; use this workflow for triage and discussion.

---

# Memory Hygiene — installation

Weekly staleness report for the four engineering-memory files under
`agents/memory/`. Opens (or updates) a single tracking issue with the
`memory-hygiene` label when entries are past their
`review_after_days` window. Closes the issue automatically once all
entries are fresh again. Purely informational — it does **not** block
PRs.

## What gets installed

| File in package | Copy to | Purpose |
|---|---|---|
| `templates/github-workflows/memory-hygiene.yml` | `.github/workflows/memory-hygiene.yml` | Weekly staleness workflow |
| `templates/scripts/check_memory.py` | `scripts/check_memory.py` | YAML schema + staleness validator |

## Install

```bash
# from the consumer repo root
cp .augment/templates/github-workflows/memory-hygiene.yml .github/workflows/
cp .augment/templates/scripts/check_memory.py            scripts/
```

Commit both. The first scheduled run (Mondays 06:00 UTC) reports on
whatever is under `agents/memory/`. Trigger manually with
`gh workflow run memory-hygiene.yml`.

## Verifying locally

```bash
python3 scripts/check_memory.py --path agents/memory
```

Exit `0` = clean, `1` = violations (missing required fields, duplicate
ids, or obvious secrets — staleness alone is informational).

Schema reference: `../../../docs/guidelines/agent-infra/engineering-memory-data-format.md`.
Schema examples: `.augment/templates/agents/memory/*.example.yml`.
