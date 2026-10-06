**Skipped:** no code surface for this completion — the branch changes markdown only: a new analysis artifact under `agents/evidence/analysis/`, the carried roadmap moved into `agents/roadmaps/later/` with its blocker and decisions, and this declaration. No executable behaviour is added, changed or removed, so there is nothing a completion review could bind to, scope a564bdc181ce27a52537bfaedea977723e6aee8824a8c4196107a6350e50f3f6, declared 2026-10-06

# host-claims-timeout — completion-review skip

Branch `drain/host-claims-timeout-20261006`, PR #2218.

## Why there is no code surface

The branch settles whether step 2.4 of
`road-to-host-claims-the-tree-contradicts-carried` is producible here. The answer
is that every mechanism reaching the observation is refused by the session
permission layer, so the step is registered as a blocker and the roadmap is
parked under `later/`. Deliberately **no** prober script was added: the roadmap's
own argument is that a prober that manufactures the condition is not a witness to
it, and this lane accepted that for the row rather than overturning it.

## What was verified instead, and with which command

Markdown-only does not mean unverified. The gates that can say no about this diff
were run on the branch and are named so the claim is checkable:

- `lint_evidence_artifacts --new-only origin/main` — 1 added artifact, type declared.
- `lint_roadmap_later_disposition` — parked correctly, both wake-condition ratchets hold.
- `lint_deferral_integrity` — 773 dead roadmaps scanned, every annotated carry resolves.
- `lint_roadmap_blockers` — 141 roadmaps blocker-contract-clean.
- `check_references` — no broken references, 2375 scanned.
- `check_md_language` on both touched files — no German content.
- `agent-config roadmap:progress` — regenerated, 13 roadmaps.

Three figures the roadmap asks a visiting lane to re-execute rather than re-read
were also re-run and all three hold: `grep -c timeout src/scripts/hook_manifest.yaml`
returns 0 with exit 1; the `user_prompt_submit` list under `platforms.claude`
counts 13; `docs/hook-latency.json` records p50 76 / p95 81 / max 83 ms over 50
runs.

## What is NOT claimed

The `0` reading of the step's wake command was **not** re-measured on this
branch — the command is refused under this session's permission posture. The
last valid reading stays 2026-10-05. Nothing here supersedes it and nothing here
adds a newer one.
