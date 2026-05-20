# Visibility sync audit log

Append-only. Every `--apply` run of `scripts/sync_github_metadata.py`
(invoked by the `workflow_dispatch`-only
[`sync-visibility.yml`](../../.github/workflows/sync-visibility.yml)
workflow) logs one block here with timestamp, repo slug, and the
mutations applied.

The split between this audit-bearing apply workflow and the read-only
[`check-visibility-drift.yml`](../../.github/workflows/check-visibility-drift.yml)
detector is the AI-Council security review's nuclear-permission
mitigation: `administration: write` never runs on `push`. See
[`CONTRIBUTING.md` § Visibility surface](../../CONTRIBUTING.md#visibility-surface)
for the threat model.
