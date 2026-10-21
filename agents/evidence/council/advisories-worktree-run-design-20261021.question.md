<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-21 for the advisories / security-fix / worktree-cleanup run, committed verbatim beside its verdict. Not edited after the run. -->

# Council question — design decisions for three roadmaps executed in one run

Repository: event4u/agent-config (a governed skill/rule/command suite for AI coding
tools; TypeScript scripts, hooks bundled into one esbuild bundle near its byte
ceiling, no resident daemon, no runtime dependency budget).

Roadmaps being executed (all `status: ready`, merged as #2564):
- road-to-worktrees-that-leave-after-the-merge — squash-aware merge evidence in
  `worktree_cleanup_check.ts`, automatic removal of the proven set
  (merged ∧ clean ∧ no local-only ignored file ∧ not live), triggers at
  `/pr:merge` and once a day, consumer-visible `/worktree cleanup`.
- road-to-advisories-heard-the-same-day — inventory of packages/runtimes,
  advisory sources, verdicts, tiers, a session notice, `/audit deps`.
- road-to-security-fixes-carried-to-the-merge — minimal fix, authority re-check,
  routing (current branch vs own worktree), PR evidence, release draft, follow
  to deployed. Merge stays with the owner.

Recorded facts:
- F1. The owner wrote on 2026-10-21: clean up worktrees "at the latest after the
  merge … checked regularly and cleaned up, automatically where possible",
  protecting active sessions, unsaved changes and unintegrated commits.
- F2. A council round on 2026-10-20 (2/2) refused two `session_start` concerns
  that could ACT (one initiating an unattended upgrade). It asked for: (b)
  declare such concerns as authority expansions, (c) keep notices read-only,
  (d) gate any action on a user-owned setting, not a rollout switch. That
  blocker (`concerns-refused-as-authority-expansion`) is still open for the
  update-notice concern.
- F3. An existing precedent: the retro's daily probe rides the existing
  `session_start` handler (no new concern), runs synchronously once per day per
  repository under a 3 s budget with a day claim, reads `gh` (disclosed in the
  settings file), never spawns, never throws.
- F4. Hook dispatch baseline is ~160 ms; the bundle is within a few hundred bytes
  of its ceiling. A new concern costs an estate allowance that is 0.
- F5. `git worktree remove` without `--force` refuses dirty/untracked trees but
  silently deletes ignored files (reproduced). The roadmap adds an ignored-file
  gate: any ignored path outside a regenerable set keeps the tree.
- F6. The project's settings contract classes keys; an existing install is asked
  once and never flipped (ADR-291).

Questions — answer each with a letter and one or two sentences of reason.

Q1. Daily worktree removal trigger.
  (a) Ride the existing `session_start` handler like the retro: synchronous,
      once per day per repository (day claim), hard budget ≤ 3 s, process as many
      candidates as fit, remove only the proven set, print one line; gated on a
      user-owned `worktrees.cleanup: auto`.
  (b) The same, but spawn a detached child process from `session_start` and let
      the next session read its summary file.
  (c) No `session_start` action at all: the session start only READS a summary
      file and prints "N removable — run /worktree cleanup --apply"; removal
      happens only on `/pr:merge` and on the explicit command.
  Is (a) or (b) an authority expansion F2 forbids, given F1 and the user-owned key?

Q2. Default of `worktrees.cleanup: auto | ask | off`.
  (a) `auto` for new installs, existing installs asked once (ADR-291).
  (b) `ask` everywhere until the user answers.

Q3. Advisory refresh path. Network inside the hook process is ruled out by the
roadmap (F4).
  (a) Refresh only from the CLI (`/audit deps`, which writes a sanitised cache of
      IDs/enums) and from an opt-in CI schedule; `session_start` reads the cache
      file only and prints one read-only line per T0/T1 finding.
  (b) Detached refresh spawned from `session_start`, daily.
  (c) Synchronous budgeted refresh in `session_start` like the retro (F3).
  And: may the read-only notice in (a) ship now by riding the existing handler
  (no new concern), since it satisfies F2 (c) by construction and is gated on a
  user-owned `advisories.mode`, or must it wait for the open blocker round?

Q4. First outbound sources for the advisory adapters (fixed host allowlist, no URL
built from fetched content, private package names never sent):
  (a) native `npm audit --json` / `composer audit --format=json` (no new network
      code — the package managers do it) + OSV `querybatch` for public packages +
      endoflife.date for runtime lifecycle;
  (b) (a) plus GitHub Dependabot alerts via the user's `gh` login;
  (c) native audits only in v1.

Q5. Shape of the security-fix work. The fix itself is performed by the agent in a
session (npm/composer commands, file edits, tests).
  (a) Deterministic TypeScript helpers with fixture tests for the decidable parts
      (routing table, PR body builder, finding lifecycle ledger, "fixed by the
      authority's own re-check" comparison, mitigation re-open), and the
      procedure in `dependency-upgrade` / `finishing-a-development-branch` skill
      text; no autonomous engine that runs package managers by itself.
  (b) A CLI engine that executes the package-manager commands itself.

Q6. Anything in the plans above that you consider unsafe or wrong? Name it.
