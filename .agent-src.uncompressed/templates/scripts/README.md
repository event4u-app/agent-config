# PR Risk Review — installation

Heuristic PR risk classifier. Posts a sticky comment on every non-draft PR
with a **low / medium / high** risk label and a list of matched hotspots,
then applies a matching `risk:<level>` label.

The classifier is **informational**. It is a conversation starter for
reviewers, not a merge gate. Add a separate required check if you want a
hard stop on high-risk PRs.

## What gets installed

| File in package | Copy to | Purpose |
|---|---|---|
| `templates/github-workflows/pr-risk-review.yml` | `.github/workflows/pr-risk-review.yml` | GitHub Actions workflow |
| `templates/scripts/pr_risk_review.py` | `scripts/pr_risk_review.py` | The classifier (Python 3.10+, PyYAML) |
| `templates/scripts/pr-risk-config.example.yml` | `.github/pr-risk-config.yml` | Per-project patterns (optional) |

## Install

```bash
# from the consumer repo root
cp .augment/templates/github-workflows/pr-risk-review.yml .github/workflows/
cp .augment/templates/scripts/pr_risk_review.py          scripts/
cp .augment/templates/scripts/pr-risk-config.example.yml .github/pr-risk-config.yml
```

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

## Uninstall

```bash
rm .github/workflows/pr-risk-review.yml
rm scripts/pr_risk_review.py
rm .github/pr-risk-config.yml  # if you created one
gh label delete risk:low risk:medium risk:high
```

## Verifying locally

```bash
python3 scripts/pr_risk_review.py \
  --base origin/main --head HEAD \
  --config .github/pr-risk-config.yml \
  --output /tmp/risk-report.md \
  --level-file /tmp/risk-level.txt

cat /tmp/risk-report.md
cat /tmp/risk-level.txt
```

## Limitations

- **Heuristic only.** A PR with no matched patterns is labeled `low` even
  if it changes business-critical logic. Reviewers still need to read.
- **No semantic analysis.** The classifier looks at paths, not diff
  content. A whitespace-only edit to `composer.lock` is still `high`.
- **Not a policy engine.** Use CODEOWNERS + required reviews for
  enforcement; use this workflow for triage and discussion.
