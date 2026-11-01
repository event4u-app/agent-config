---
proposed_by: the repository owner, in chat, 2026-11-01 (agents/evidence/owner-directives/2026-11-01-map-auto-refresh.md)
implemented_by: claude-opus-5.5 session on feat/map-always-fresh
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 11 of 2026-11-01
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: 358ad3539cc7b80f29e20c0c45ac04b0dcc9efec3e4f6ec9cf9185c6be53807d
---

<!-- evidence-type: ratification -->

# Ratification — a code-graph refresh that turns itself on by use and also runs at turn end

`check_kernel_edit_ratified` gates three hook-plumbing files on this branch:
`src/config/hook-bundle-budget.json`, `src/scripts/hook_manifest.yaml` and its
compiled projection `src/scripts/hook_manifest.json`. The `subject:` digest
covers all three, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `29803487a1`. The gated files are byte-identical to the ones round
11 reviewed; the commit after it touched only the `auto-refresh status` wording
in `src/scripts/code_graph/cli.ts`, which is not gated. The header is the output
of `ratification_header --seat anthropic=ratified --seat openai=ratified`.
`ratification_record` could not render it: the council run was made without
`--stances`, so no seat closed on a parsed stance line; both seats closed on a
literal `VERDICT: ratified` line, quoted below.

## What was ratified

- **Consent by use.** A local `code-graph build` or `map` (outside CI, without
  a prior `auto-refresh off`) writes the auto-refresh opt-in into the
  gitignored `agents/map/.build/`; `auto-refresh off` leaves a sticky opt-out
  and exits 1 if it cannot persist it. The owner confirmed this policy,
  agents included, in chat (quoted in the owner directive).
- **Turn-end binding.** `code-graph-refresh` is bound on `stop` on the seven
  platforms that bind it on `session_start`; on claude before `journal-record`.
- **Admission.** One `O_EXCL` claim file per (HEAD, 10-minute window) in a
  per-UTC-day folder, created right before the spawn after an age check by a
  fresh clock; only day folders two or more days old are swept; tracked
  opt-in, cache or claim storage is refused before a claim is read.
- **Containment.** Every write the change adds — claim, outcome record, opt-in,
  opt-out — goes through `src/scripts/_lib/contained_write.ts`: every component
  from the repository root down must be a real directory by `lstat`, and the
  file is opened with `O_NOFOLLOW`.
- **Budget.** Bundle ceiling 1,560,400 → 1,562,000 and the concern's chunk
  ceiling 15,400 → 20,500, each with a `raise_log` entry.

## Stated limits the seats accepted

- At most one launch per HEAD and fixed window: two can fall either side of a
  window boundary, and each new commit may launch one.
- A duplicate launch for one pair needs a dispatch pause or clock disagreement
  of more than a day; it backs off on the single-flight refresh lock while the
  first refresh runs, and otherwise finds the graph fresh.
- Node has no `openat`-style descriptor walk: a concurrent replacement of a
  checked folder by a symlink is narrowed, not closed.
- The engine's pre-existing writes under `agents/map/` are not contained;
  parked as `agents/roadmaps/later/road-to-a-map-engine-that-never-writes-through-a-symlink.md`.

## Review record

Eleven rounds, all with both seats present; prompts committed under
`agents/evidence/council/map-always-fresh-ratification-r{1..11}-20261101.question.md`.
Rounds 1–10 were refused 2/2; every named defect was fixed and covered by a test
seen red without its fix (the round history is in the round 11 prompt). Round 11:

- anthropic — "**VERDICT: ratified** — The throttle works as designed (one spawn
  per HEAD and window); the consent-by-use expansion is explicitly authorized by
  the owner; the containment race is disclosed and acceptable; no defect found
  that would cause unintended spawns or authority leakage."
- openai — "**APPROVE** the supplied implementation because its admission
  protocol matches the stated guarantee and the owner confirmation supports the
  policy expansion." Closing line: `VERDICT: ratified`.

Both seats' non-blocking refinement — say that each new commit may launch a
refresh within a window — landed in the `auto-refresh status` line after the
round. Council responses are gitignored and pruned; these quotes and the
committed prompts are the evidence a reader checks the seats against.
