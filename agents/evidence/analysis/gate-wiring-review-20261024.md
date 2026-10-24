<!-- evidence-type: analysis -->

# Wiring changes since the attested base: the review record (A5)

This is acceptance item A5 of the closed renewal bar (D50, round 29). The wiring
files are pinned as whole files:

- `Taskfile.yml`;
- every taskfile it includes, which the reconciler enumerates from its
  `includes:`;
- the three workflows that run Phase 7 checks.

Every wiring file that changed since the attested base `a9a9ecd98d` (revision
16) has a row below. The row names the base blob, the current blob, the class of
the change and the exact diff. The reconciler refuses a changed wiring file that
has no row for that exact blob pair. This record's own blob is pinned, so an
edited row stales the set.

There are two classes:

- **phase-7** is a step or task that runs, names or orders one of the 16 checks.
- **non-phase-7** is everything else.

| File | Base blob | Current blob | Class |
|---|---|---|---|
| `taskfiles/ci-fast.yml` | `aedb0b222ef39622a6dc66abe6d94f95eaad46b7` | `9be191d285878e4c3699b9fb1b6fa96bd16d65fb` | non-phase-7 |
| `.github/workflows/rule-backstops.yml` | `015473465df2afb82e32ada7fce9d458d6c17055` | `dfef566b52604885d1547a4d9d1c19cc73d380c5` | non-phase-7 |
| `.github/workflows/tests.yml` | `0e1e0c9882919e10ff783780315a84b5e5f5dea3` | `b522f84608d8b2bc3859ca94240addda17594460` | phase-7 |

The other ten wiring files are byte-identical to the base.

## The changes, verbatim

### `taskfiles/ci-fast.yml`: non-phase-7

```diff
@@ -903,8 +903,8 @@ tasks:
 
   check-step-production-reach:
     silent: true
-    desc: "Report a roadmap step this diff ticks whose tested symbols no production entry reaches, or that is ticked while it says `built, not wired`. Report-only for one release (road-to-a-tick-the-shipped-path-earns 3.3), enforcing after. Diff-scoped against origin/main"
-    cmd: ./scripts-run src/scripts/check_step_production_reach --base origin/main
+    desc: "Report a roadmap step this diff ticks whose tested symbols no production entry reaches, or that is ticked while it says `built, not wired`. Enforcing since road-to-a-tick-the-shipped-path-earns 3.3; a false positive carries a line `reach exempt: <reason>` in its own step block. Diff-scoped against origin/main"
+    cmd: ./scripts-run src/scripts/check_step_production_reach --base origin/main --enforce
 
   lint-deferral-integrity:
     silent: true
```

This switches `check_step_production_reach` from report mode to `--enforce`. That
script is not one of the 16 Phase 7 checks. No Phase 7 task's command,
dependencies or order changes.

Whether that script should enforce is decided by its own roadmap,
`road-to-a-tick-the-shipped-path-earns` 3.3, and is outside this attestation.
This row attests only that the change does not alter how any Phase 7 check runs.

### `.github/workflows/rule-backstops.yml`: non-phase-7

```diff
@@ -181,10 +181,11 @@ jobs:
         run: ./scripts-run src/scripts/check_step_receipts --base origin/main
 
       # A tick whose tested code no production entry reaches is a step closed on a
-      # path that never ships. Diff-scoped like the receipts; report-only for one
-      # release, then enforcing.
+      # path that never ships. Diff-scoped like the receipts; enforcing since
+      # road-to-a-tick-the-shipped-path-earns 3.3, after report mode shipped in
+      # 17.1.0 through 17.4.0. A false positive is exempted in its own step block.
       - name: step production reach (a ticked step's tested symbols ship)
-        run: ./scripts-run src/scripts/check_step_production_reach --base origin/main
+        run: ./scripts-run src/scripts/check_step_production_reach --base origin/main --enforce
 
       # A `[~]` carried to a follow-up is validated once, when the parent is
       # archived, by a sweep that then never sees the pair again — so the
```

This is the same switch to `--enforce` in CI, with its comment, and it changes no
Phase 7 step. The steps that run `check_composite_arming --self-test` and
`lint_ticked_unmet_criteria` are untouched.

### `.github/workflows/tests.yml`: phase-7

```diff
@@ -532,10 +532,11 @@ jobs:
         # discovered as a surprise when someone tries to arm the ceiling.
         if: always()
         # continue-on-error, deliberately: this step REPORTS, it does not gate. A
-        # bench run that failed before writing leaves no store, and the predicate
-        # correctly exits 1 on a store it cannot read (an empty store must not
-        # pass as "no readings yet"). That is the right behaviour for the
-        # predicate and the wrong reason to red this job.
+        # bench run that failed before writing leaves no store, which the
+        # predicate reports as "not measured yet" and exits 0 on (D46); the bench
+        # step above is what fails the job in that case. A store that exists but
+        # is unreadable, malformed or empty still exits 1, which is the right
+        # behaviour for the predicate and the wrong reason to red this job.
         continue-on-error: true
         run: ./scripts-run src/scripts/check_composite_arming --store "$RUNNER_TEMP/composite-reading.jsonl"
 
```

This change touches only comments inside the composite-arming step: it now
describes D46's absent-store exit 0. The step's `run`, `if` and
`continue-on-error` keys are unchanged.
