# Council question — two CI placement decisions (2026-10-22)

<!-- evidence-type: analysis -->

Repository: event4u/agent-config (a governed rule/skill suite; GitHub Actions CI).
Context: PR CI time-to-green is 20-57 min. The required checks are two
(`Sync + Generate Tools Consistency`, `Standing payload delta + budget gate`); no
macOS job and no `Tests` job is required. ADR-223 forbids demoting a *required*
check on cost grounds. There is no merge queue; `push: main` runs the full `Tests`
matrix after every merge (22-39 merges/day).

Answer each decision independently. For each: pick one option, give the reason,
and name the evidence that would change your answer.

## Decision A — which macOS legs of `tests.yml` run on a pull request

Facts:
- `tests.yml` requests 13 macOS jobs per run (install ×1 after this change,
  install-aux, node-tests ×4, golden, svg-witness, collector-lifecycle
  [macOS-only], workspace). GitHub-hosted macOS is capped at 5 concurrent jobs.
  On PR #2569 every ubuntu job started within 63 s of creation; macOS jobs waited
  5.7-33 min for a runner.
- Per-OS failure attribution over the 520 most recent completed `Tests` runs
  (5365 decisive macOS/ubuntu twin pairs, every run attempt counted):
  macOS fail + ubuntu pass: 10 pairs (0.2 %), all `Node Tests`, 9 of them shard 4/4
  (a separately filed stub tracks a 10 s testTimeout class on macOS);
  macOS pass + ubuntu fail: 20 pairs (0.4 %); both fail: 143; both pass: 5192.
  Zero macOS-only reds in golden, svg-witness, install, install-aux or workspace.
- An in-repo classifier marks a PR `full` when its diff touches installer, hook,
  collector, workflow or dependency paths, or when the diff is empty/unreadable;
  otherwise `tier`. `push: main` always runs all macOS legs.

Options:
1. Keep all 13 macOS legs on every PR (status quo).
2. On a `tier` PR run only install, install-aux, collector-lifecycle and workspace
   on macOS; node-tests ×4, golden and svg-witness macOS legs run when the
   classifier says `full`, when the PR carries label `ci:macos`, and on every
   `push: main`.
3. As option 2, but node-tests macOS legs stay on every PR (only golden and
   svg-witness macOS legs move).
4. Another split you propose.

## Decision B — a diagnostic step inside the `Static Checks` job

Facts:
- `Static Checks` (ubuntu, not required) contains a blocking hook-latency bench
  gate, then a non-gating "hook-latency path comparison (diagnostic, never
  gates)" step (`continue-on-error`, ~150 s on PR #2569). Its inline comment says
  both diagnostic legs run back to back in the same job so they share a cache
  state, and that the delta between the gate's cli number and the diagnostic's cli
  number "reports the warm/cold effect for free".
- On PR #2569 Static Checks took 6m07; the slowest ubuntu node shard 8m40;
  the whole Tests run ~40 min (macOS queue). Moving the diagnostic into its own
  parallel job would shorten Static Checks by ~150 s but cost a second runner's
  checkout + npm ci + build (~1.5-2 min) and lose the same-job warm/cold delta.

Options:
1. Move the diagnostic (and the composite-arming report beside it) into a
   separate parallel non-gating job.
2. Leave it where it is.
3. Another arrangement you propose.
