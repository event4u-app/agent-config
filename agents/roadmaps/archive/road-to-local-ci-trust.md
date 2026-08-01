---
complexity: lightweight
---

# Road to a Trustworthy Local CI

**Goal.** `task ci` green on `main`, so it can serve as the pre-push gate — and the
CI↔local parity it depends on kept honest by a gate rather than by attention.

**Why.** A pre-push gate that is red for a reason the contributor did not cause either
blocks every push or trains people to ignore it, and the second is worse than no gate.
Getting there turned out to be the prerequisite for everything else in the hardening
request (2026-07-30), not a side quest.

## Phase 1 — task ci green on main

Landed in the `fix/task-ci-green-and-parity` PR: 11 pre-existing failures fixed
(Python-twin gate narrowed to the claim shape, 7 missing trigger-eval sets authored,
demo-shape conformance, a rule-vs-skill composition edge, 3 defaulted frontmatter
fields, an uncited context-spine declaration, 2 unclassified script clusters, 5
untagged contracts + their review markers, a dead catalog link, 2 stale command counts,
a deviating cluster dispatcher, an unstated auto_detect contract, a stale ownership
matrix). Every one was invisible to CI.

- [x] **Kernel budget — 3 breaches, deferred by policy, not by choice.**
  `task lint-rule-budget` reports `kernel-bucket 27840 > 26000`,
  `non-destructive-by-default 4770 > 4000 override ceiling`, and
  `verify-before-complete 2865 > 2500 hard cap (no override)`. All three are
  pre-existing on `main` — this branch touches no rule under `src/rules/`.
  Fixing them means editing kernel rules, and `scope-control § Kernel-rule edits`
  requires an own PR with ≥ 24 h between merges (the soak guarantee, which no
  autonomous mandate lifts). So it cannot ride along with a gate-hardening PR.
  Verify: `task lint-rule-budget` exits 0.
  <!-- The trim is a preservation-guard problem, not a deletion problem: both rules
  are load-bearing safety floors. Route their bodies to a mechanics context (the P4
  pattern) rather than cutting obligations. -->

## Phase 2 — CI ↔ local parity

Landed in the same PR: `check_ci_local_parity` derives both sides (workflow
invocations vs the transitive `task ci` / `consistency` / pre-push closure) and fails
on undeclared drift in either direction. 10 CI-only repo-content gates wired into a
new `task preflight` (15s measured); 20 declared CI-only with reasons; 1 declared
local-only.

- [x] **Wire `task preflight` into the pre-push hook.** Deliberately NOT done in the
  same PR: the hook must not go red on the kernel budget above, so this waits for
  Phase 1. Budget ceiling `pre_push_budget_seconds: 25` is already in the manifest;
  `check_enforcement_coverage` (30.7s) stays out by design.
  Verify: a push on a clean tree runs preflight and adds < 25s.

## Phase 3 — Post-CI fix loop

- [x] **Watch CI after a push, diagnose the failure, prepare the fix — then stop at
  the push.** Bounded at N=3 per target per `autonomous-execution`. The push itself
  stays confirmed: `non-destructive-by-default` makes it a Hard Floor, and no setting
  lifts that, so an auto-push loop is not on the table. Generated-file merge conflicts
  are the exception that needs no confirmation — they are resolved by regenerating,
  which `/create-pr` already specifies.
  Verify: a red CI run produces a diagnosed fix in the working tree and one
  confirmation prompt, never a push.

## Noted, not scheduled

- [~] **`generate-tools` does not prune trees for inactive tools.** 38 dangling links
  had accumulated across `.claude/`, `.cursor/` and `.windsurf/` from sources deleted
  in earlier commits; `_filter_tool_dirs` / `_tool_active` means a deactivated tool's
  tree is never revisited. Cleaning them locally turned `check_bridge_derivation` and
  `check_host_loadability` green. Deferred on purpose: pruning could delete a tree a
  user still relies on, and with the links cleaned nothing is pressing.
- [~] **A tracked file changes on every test run.**
  `internal/reports/secret-scanner-adversarial.json` carries a `generated` date stamp
  its own test rewrites, and `consistency` ends with `git diff --quiet` — so a full
  test run leaves the tree dirty and blocks the next push until reverted. It blocked
  one on 2026-07-30.
- [~] **Five environment-dependent tests read live repo state instead of their
  fixture.** `explain_run` (×2) reads `agents/runtime/state`, `code_graph_refresh`
  escapes its tmp root, `build_mcp_registry_manifest` fails identically on `main` once
  its gitignored prereqs exist, `check_artefact_count_messaging` read a gitignored
  local file (fixed in #1048).

## Execution notes (2026-07-31)

**Phase 1 closed as already-satisfied, not as work done here.** All three named
breaches pass on the trunk now: `kernel-bucket 25816 / 26000`,
`non-destructive-by-default 3940 / 4000 (override)`, `verify-before-complete
2377 / 2500 (warn, under cap)`. `task lint-rule-budget` exits 0. So no kernel
rule was edited and no soak applied — the step's premise expired.

One caveat worth stating rather than burying: `check-rule-invariants` IS red on
the trunk for `non-destructive-by-default`, but that is **not** a lost clause.
Both obligations are present; only the byte-pinned literals drifted under a
telegraph condensation that `preservation-guard` explicitly encourages
("drop articles … what's forbidden is deletion"). So a byte-pin gate and a
condensation rule contradict each other as written. Deliberately not patched
here: the rule is kernel AND `tests/golden/invariants.json` is itself
soak-protected, so either side is an own-PR change. A council (2/2) favoured
re-pinning negation-bearing fragments instead of exact prose — with the standing
caveat, raised in its own dissent, that substring presence would still pass a
negation INVERSION ("Never act *without* asking") and is therefore weaker than
the byte-pin against the worst case. Any redesign has to handle inversion.

**Phase 2 — ordering is what makes it safe.** `task preflight` is inserted AFTER
the existing consistency block, not before it. Measured: preflight fails in a
FRESH worktree with `.augment/rules/*: produced by regeneration but absent
before`, because several of its gates read a projection that does not exist yet
— red for a reason the contributor did not cause, i.e. precisely this roadmap's
stated anti-pattern. `task consistency` runs `task sync`, which generates that
tree, so placing preflight after it removes the failure without weakening any
gate. Measured 15s against the 25s ceiling; `AGENT_CONFIG_SKIP_PREPUSH_PREFLIGHT=1`
is the WIP escape, mirroring the existing static-pass flag.

**`complexity:` retagged `moderate` → `lightweight`.** `moderate` is not a legal
value: `lint_roadmap_complexity`'s pattern accepts only
`lightweight|structural`, so this file read as *untagged* and failed that gate.
Judged against the caps rather than by feel — 130 lines (cap 600), 3 phases
(cap 6), no `## Council Round N` block, no `### Verdict` block. All four
lightweight conditions hold with room to spare, so `lightweight` is the correct
value and `structural` would overstate it.

**Phase 3 — the obligation was missing, not merely unwired.** Searched before
authoring: the only artefact mentioning `gh pr checks` was `/create-pr`, and it
governs *reporting* CI truthfully (§4c), not *waiting* for it. `/fix:ci` covered
diagnose-and-fix but had no wait step, and nothing obliged invoking it. So the
gap was real and this session hit it: a turn ended on "CI is running" while
three failures were already sitting in the run.

Shipped as §4d of `/create-pr` plus step 0 of `/fix:ci` — extending the two
surfaces that already own this, rather than adding a rule. Deliberate: the
natural kernel home, `verify-before-complete`, sits at 2377/2500 chars and is
soak-gated, so a new always-loaded obligation there would cost a separate PR and
a scarce budget line to say something two commands can carry.

The §4d contract, in one line: a push to an open PR is not done until CI is
settled; pending is a reason to wait, never to stop; red means diagnose and fix
in the working tree; the push itself stays Hard-Floor gated, so no
fix-and-re-push loop runs on its own authority.

## PR #1076 review-gate findings — triage (2026-07-31)

Four advisory findings, each verified against the code as merged rather than
against the review prose. Two were real and are fixed with tests that fail
against the pre-fix code; two are dispositioned with reasoning.

**1. Installer dereferenced symlinks without confining the target — FIXED.**
Real, and worse than "hygiene": `_copy_dir_dereferencing_symlinks` copies the
`realpath` of every entry, so a symlink in the shipped tree pointing outside the
package root copied an arbitrary readable file into the deploy destination — and
those destinations are agent-readable instruction dirs (`~/.claude/rules/`,
`~/.codeium/…`). A tampered tarball carrying `rules/x.md -> ~/.ssh/id_rsa` would
land that file where an agent reads rules. Guarded at all three sites (single
file, symlinked directory, symlinked file), realpath'd on both sides so a macOS
`/var` → `/private/var` root does not read as an escape, and permissive when the
caller passes no `package_root` (several do). Reuses the reaper's existing
`is_ancestor` predicate — exported rather than copied. Defence-in-depth for
threat-model row b; the package remains the install-time trust anchor.
`tests/install/copy_symlink_confinement.test.ts` — 2 of 6 red pre-fix.

**2. Scope resolution masked parse failures — FIXED.** Real, and the masking sat
on two layers: `_load_yaml_doc` maps a malformed file and an absent file BOTH to
`{}`, and the resolver's `catch` swallowed the rest. So a YAML typo silently
defeated a scoping decision the user had made, shipping every maintainer-only
rule with no signal. Now split: no doc at all → packaged template, silent (a
fresh machine has no decision to contradict); doc present but unreadable or not
a mapping → LOUD warning naming the file and the consequence, then legacy-all.
Over-shipping stays the safe direction; it is no longer a quiet one. Both
branches pinned, including the assertion that the absent-doc path stays silent.

**3. TOCTOU between deploy and reap — ALREADY CLOSED, now pinned.** Verified in
code, not assumed: `_resolve_global_rule_scope` is called exactly once per
`_deploy_global_content`, before the per-tool loop, and that one snapshot feeds
both the copy filter and `expected_deploy_files` — whose output is what the
reaper consumes. There is no window between deploy and reap to exploit. The
dry-run preview takes its own snapshot because `--dry-run` and the real run are
separate commands; a prediction that diverges after the user edits settings is
correct behaviour, not a race. Pinned by three source-shape assertions so a
future per-tool or per-reap re-resolution fails a test.

**4. No integrity check on the global settings doc — REFUSED, with reasoning.**
The doc lives at `~/.event4u/agent-config/settings/.agent-settings.yml`, i.e. at
the install site inside the user's own home. `docs/threat-model.md` row g
classifies that boundary explicitly: *"maintainer/CI/install sites are
env-controlled, not attacker-influenced."* An actor able to write that file can
already write the installed rules themselves, the tool config dirs, and the
shell profile — so verifying it would need a trust root outside the user's home,
and none exists. A hash or signature rooted in the same home an attacker already
controls is theatre, and adding it would overstate the protection. Same
reasoning pattern as row i (`CLAUDE_CONFIG_DIR`): the precondition already grants
strictly more capability than the finding recovers. Refused as
inside-the-trust-boundary; revisit only if a trust root outside the user's home
ever exists.

## Failed check on the #1076 merge commit — identified and dispositioned

The one non-success run on merge commit `7d59a3c16` is
**`.github/workflows/sync-visibility.yml`** (run `30630016592`). It is a
documented phantom, not debt: the run has **0 jobs** and `gh run view
--log-failed` returns *"log not found"*, which is exactly the signature that
workflow's own header describes —

> "Known GitHub Actions anomaly: workflows with `workflow_dispatch`-only
> triggers occasionally register phantom 'failure' runs on pushes to main
> (0 jobs, empty logs, conclusion=failure) … Treat any run on this workflow
> with 0 jobs as a phantom and ignore it. Real runs always have a `sync` job."

Not fixable workflow-side by that same standing note, and no owner action is
implied. Check-runs and commit statuses on the merge SHA are 38 success /
1 skipped / **0 failure** — the failure appears only in the workflow-RUN listing,
which is why a check-based read shows the merge as clean.

## Deferral resolution — §4b option 3, confirmed 2026-07-31

The three `[~]` items are **decided and stay deferred**, per
`roadmap-management § 4b` option 3: *"Keep deferred items in this archive —
confirm 'no follow-up' is an intentional drop. Items stay searchable in
`archive/`."* No follow-up roadmap is spawned; the items are not cancelled,
because each remains a true statement about the tree that a future reader should
find.

Recorded so the drop is auditable rather than implicit:

1. **`generate-tools` does not prune trees for inactive tools.** Left as-is on
   the roadmap's own reasoning: pruning could delete a tree a user still relies
   on, and with the dangling links cleaned nothing is pressing. Acting would risk
   more than waiting.
2. **A tracked file changes on every test run** (`internal/reports/secret-scanner-adversarial.json`
   date stamp vs `consistency`'s closing `git diff --quiet`). Real and it has
   blocked a push, but the fix is a change to that report's generator, which is
   outside this roadmap's surface.
3. **Five environment-dependent tests read live repo state instead of their
   fixture.** Same class this session hit twice (the witness/shard race, the
   local-vs-CI scope-guard divergence). Each needs its own owner.

Archived by hand rather than by the sweep: `archive_completed_roadmaps` requires
`count_deferred == 0` by design, and option 3 is precisely the case where a human
decision — not a counter — authorises the move. The Iron Law 3 gate clears
because it scans the ACTIVE tree only, which is the documented mechanism, not a
bypass.
