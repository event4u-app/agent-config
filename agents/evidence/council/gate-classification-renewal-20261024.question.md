<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (twenty-sixth round that day),
     committed verbatim. The asking agent wrote the reconciler, the ledger and
     the fix below. -->

# Step 7.1 — re-attestation of the input set, and item 4

**Closure standard (owner's Option A):** items 1, 4, 5, 6, 7, 8. Items 1, 5, 6,
7 and 8 were met 2/2 in round 21. Item 4's pass condition: class predicates
mutually exclusive or with precedence defined, each aspect satisfying its
predicate. Round 25 found must-fixes 1 and 3–7 of round 24 closed 2/2 except
must-fix 5, which was then implemented; it refused renewal until the owner
decided R16.d. The owner (D46) chose to correct R16.d's behaviour, not to waive
it.

**Rule D38:** a pin is never renewed by its author alone; a council round on the
diff that staled it does. The last attested input set is revision 16 (commit
`a9a9ecd98d`). Ten inputs have moved since. This round decides whether they are
renewed as one set.

## 1. The behaviour fix — `src/scripts/check_composite_arming.ts`

```diff
@@ -32,8 +32,9 @@
- *       a successful measurement, never a build failure)
- *   1 — the store is unreadable or malformed
+ *       a successful measurement, never a build failure), or there is no store
+ *       yet ("not measured yet", likewise never a build failure)
+ *   1 — the store exists but is unreadable, malformed or empty
@@ -249,10 +250,22 @@ export function selfTest(): number {
-            name: 'rejects a missing store rather than reporting armable',
-            expect: 'reject',
+            name: 'a missing store is "not measured yet", not a build failure',
+            expect: 'accept',
+        {
+            name: 'rejects a store path that exists but is not a readable file',
+            expect: 'reject',
+            run: () => {
+                const d = fs.mkdtempSync(path.join(os.tmpdir(), 'arm-'));
+                try {
+                    return runGateCli(REPO_ROOT, SELF, ['--store', d], REPO_ROOT);
+                } finally {
+                    fs.rmSync(d, { recursive: true, force: true });
+                }
+            },
+        },
@@ -280,16 +293,20 @@ function main(argv?: readonly string[]): number {
+    if (!fs.existsSync(store)) {
+        process.stdout.write(
+            `⏳  NOT MEASURED YET — no composite store at ${path.relative(REPO_ROOT, store)}.\n` +
+                `    The bench appends to it with \`--record-composite\`; until CI runs have\n` +
+                `    accumulated readings there is nothing to evaluate. That is not "armable",\n` +
+                `    and it is not a build failure.\n`,
+        );
+        return 0;
+    }
-        process.stdout.write(
-            `❌  no composite store at ${path.relative(REPO_ROOT, store)}.\n` +
-                `    The bench appends to it with \`--record-composite\`; until CI runs have\n` +
-                `    accumulated readings there is nothing to evaluate. This is "not measured yet",\n` +
-                `    which is NOT the same as "armable".\n`,
-        );
+        process.stdout.write(`❌  composite store at ${path.relative(REPO_ROOT, store)} exists but cannot be read as a file.\n`);
@@ -337,7 +354,7 @@ function main(argv?: readonly string[]): number {
-    // the first. The missing-file case above already exits 1; this catches the
+    // the first. A missing store is "not measured yet" above; this catches the
```

New tests in `tests/scripts/composite_arming.test.ts`:

| Case | Exit |
|---|---|
| absent store | 0 |
| store path exists but is a directory | 1 |
| store with only malformed lines | 1 |
| empty store | 1 |

The absent-store test failed before the fix. With the two failing-store returns
changed to 0, the directory test, the malformed test and the script's self-test
failed. After restoring, 22/22 passed.

## 2. Check 16: the independent inventory, mapping and review

A separate session re-inventoried `check_composite_arming` from source only,
without access to the ledger. Check 16's branches before and after:

```text
before: c16-selftest exit-code-only/1 · c16-store-missing-value error-exit-nonzero/2 · c16-store-unreadable error-exit-nonzero/1 · c16-ledger-skip warning-exit-zero/null · c16-ledger-throw throw/null · c16-accounting-mismatch error-exit-nonzero/2 · c16-all-malformed error-exit-nonzero/1 · c16-dead-scope error-exit-nonzero/1 · c16-rethrow throw/null · c16-publish exit-code-only/0 · c16-publish-write-throw throw/null · c16-malformed-warn warning-exit-zero/0 · c16-not-armable-readings warning-exit-zero/0 · c16-not-armable-sessions warning-exit-zero/0 · c16-unusable-dropped warning-exit-zero/0
after:  c16-selftest error-exit-nonzero/1 · c16-store-missing-value error-exit-nonzero/2 · c16-store-absent warning-exit-zero/0 · c16-store-unreadable error-exit-nonzero/1 · c16-ledger-skip warning-exit-zero/null · c16-ledger-throw throw/null · c16-accounting-mismatch error-exit-nonzero/2 · c16-all-malformed error-exit-nonzero/1 · c16-dead-scope error-exit-nonzero/1 · c16-rethrow throw/null · c16-publish exit-code-only/0 · c16-publish-write-throw throw/null · c16-malformed-warn warning-exit-zero/0 · c16-armable exit-code-only/0 · c16-not-armable-readings warning-exit-zero/0 · c16-not-armable-sessions warning-exit-zero/0 · c16-unusable-dropped warning-exit-zero/0
```

Mapping changes: `c16-store-unreadable` R16.d → op:could-not-run; `c16-store-absent` — → R16.d; `c16-armable` — → R16.a.

A second separate session reviewed the three mappings and agreed with all three
(3/3). Its reasons are recorded verbatim in the mapping review.

The old review entry for `c16-store-unreadable` was replaced. It read *disagree →
R16.d* and was written when that branch was the absent-store case.

Inventory, mapping and review changes are confined to check 16. The site
scanner reports OK, and its self-test passes 6/6.

## 3. Ledger-table cells changed since revision 16

```diff
-| 3 | | mutation self-test — `--mutation-selftest` | removing the first invariant string in memory makes the check fail | `tests/golden/invariants.json` | only with `--mutation-selftest`; no caller found | the expectation file | **invariant** | the header: guards the checker against a silently-green normalisation bug (repository-consistency) | `R3.b` |
+| 3 | | mutation self-test — `--mutation-selftest` | removing the first invariant string in memory makes the check fail | `tests/golden/invariants.json` | only with `--mutation-selftest`; no caller found | the expectation file | **invariant** | the header: guards the checker against a silently-green normalisation bug (repository-consistency); an undetected removal returns 1 (`check_rule_invariants.ts:204-208`) | `R3.b` |
-| 14 | `lint_readme_jargon` | above-fold density | ≤ 3 watchlist hits in README lines 1–120 | README.md | always | README edits | **invariant** (numeric bound) | no named risk owner, so not a tolerance | `R14.a` |
+| 14 | `lint_readme_jargon` | above-fold density | ≤ 3 watchlist hits in README lines 1–120 | README.md | always | README edits | **invariant** (numeric bound) | fixed cap `MAX_HITS = 3`, more hits return 1 (`lint_readme_jargon.ts:172-188`); no named risk owner, so not a tolerance | `R14.a` |
-| 16 | | store absent | the store file exists | same | no store file | bootstrap | **observation** | its own contract: no readings yet is "not measured yet" and never a build failure. Runtime metadata, not a class: `not-evaluated: evidence-missing`. Current behaviour diverges: the script exits 1, which is owed to 7.2. A future transition to invariant after a bootstrap deadline needs that deadline first (D31) and is not part of this verdict | `R16.d` |
+| 16 | | store absent | the store file exists | same | no store file | bootstrap | **observation** | its own contract: no readings yet is "not measured yet" and never a build failure. Runtime metadata, not a class: `not-evaluated: evidence-missing`. Behaviour matches since D46 (owner, 2026-10-24): an absent store exits 0 as "not measured yet"; a store that exists but cannot be read still exits 1. A future transition to invariant after a bootstrap deadline needs that deadline first (D31) and is not part of this verdict | `R16.d` |
```

## 4. Wiring files changed by trunk merges (not by this lane)

```diff
-      # path that never ships. Diff-scoped like the receipts; report-only for one
-      # release, then enforcing.
+      # path that never ships. Diff-scoped like the receipts; enforcing since
+      # road-to-a-tick-the-shipped-path-earns 3.3, after report mode shipped in
+      # 17.1.0 through 17.4.0. A false positive is exempted in its own step block.
-        run: ./scripts-run src/scripts/check_step_production_reach --base origin/main
+        run: ./scripts-run src/scripts/check_step_production_reach --base origin/main --enforce
-    desc: "Report a roadmap step this diff ticks whose tested symbols no production entry reaches, or that is ticked while it says `built, not wired`. Report-only for one release (road-to-a-tick-the-shipped-path-earns 3.3), enforcing after. Diff-scoped against origin/main"
-    cmd: ./scripts-run src/scripts/check_step_production_reach --base origin/main
+    desc: "Report a roadmap step this diff ticks whose tested symbols no production entry reaches, or that is ticked while it says `built, not wired`. Enforcing since road-to-a-tick-the-shipped-path-earns 3.3; a false positive carries a line `reach exempt: <reason>` in its own step block. Diff-scoped against origin/main"
+    cmd: ./scripts-run src/scripts/check_step_production_reach --base origin/main --enforce
```

`check_step_production_reach` is not one of the 16 checks.

## 5. The reconciler and the grounds file

Revisions 17–21 replaced keyword predicates over prose. Classes are now derived
from the inventory's structured `effect` field. The same revisions added:

- the structured `modes` map;
- the waiver fields: milestone, issue, tracked directive and a real expiry;
- the one-set digest;
- an input-pin coverage check;
- in revision 21, `exit-code-only` at exit 0 counted as non-blocking. That case
  was seen red first.

The derivation code now reads:

```js
    // Class predicates (round-20 item 4), derived per binding aspect from the
    // effects of the branches that reach it, in the row's structured mode.
    // Blocking only → invariant; non-blocking only → observation; mixed,
    // unreached or an unknown effect is refused. A snapshot or tolerance needs
    // blocking behaviour AND its structured fields. A semantic class that
    // differs from the derived behaviour is reported `waived`, never satisfied,
    // and only with an approver whose directive exists, an issue and an
    // unexpired expiry.
    const grounds = JSON.parse(io.read(FILES.grounds));
    const modes = grounds.modes ?? {};
    const aspects = [];
    for (const r of binding) {
        const mode = modes[r.id] ?? null;
        const proseMode = /in that mode/.test(cells(r.raw)[7] ?? '');
        if (proseMode !== (mode !== null)) failures.push(`mode: ${r.id} ${proseMode ? 'says "in that mode" but has no structured mode' : `has structured mode ${mode} but its class cell names no mode`}`);
        if (mode !== null && !io.read(`src/scripts/${r.check}.ts`).includes(`'${mode}'`) && !io.read(`src/scripts/${r.check}.ts`).includes(`"${mode}"`)) failures.push(`mode: ${r.id} names ${mode}, absent from ${r.check}`);
        const blocking = [];
        const nonBlocking = [];
        for (const c of branchInv.checks.filter((x) => x.check === r.check)) {
            for (const b of c.branches) {
                if (!String(mapping[c.check]?.[b.id] ?? '').split('+').includes(r.id)) continue;
                const preds = (b.predicates ?? []).join(' ');
                if (mode !== null && !preds.includes(mode)) failures.push(`mode: ${r.id} is the ${mode} mode but reaching branch ${b.id} names no ${mode} in its predicates`);
                if (b.effect === FLAG_EFFECT && !/--[a-z]/.test(preds)) failures.push(`mode: flag-only branch ${b.id} names no flag in its predicates`);
                if ((BLOCKING_EFFECTS.includes(b.effect) && !(b.effect === 'exit-code-only' && b.exit_code === 0)) || (b.effect === FLAG_EFFECT && mode !== null && preds.includes(mode))) blocking.push(b.id);
                else if (NON_BLOCKING_EFFECTS.includes(b.effect) || b.effect === FLAG_EFFECT || (b.effect === 'exit-code-only' && b.exit_code === 0)) nonBlocking.push(b.id);
                else failures.push(`class predicate: ${r.id} is reached by ${b.id} with unknown effect ${b.effect}`);
            }
        }
        const derived = blocking.length > 0 && nonBlocking.length === 0 ? 'invariant' : nonBlocking.length > 0 && blocking.length === 0 ? 'observation' : blocking.length > 0 ? 'mixed' : 'unreached';
```

Grounds file now: `modes` for 11 flag-mode rows, `waivers` `{}`, `structured` `{}`.

## Verbatim output at `12a8972740`
```text
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --aspects | tail -7
| R16.a | `check_composite_arming` | observation | default | — | c16-armable, c16-not-armable-readings, c16-not-armable-sessions, c16-unusable-dropped | observation | derived |
| R16.b | `check_composite_arming` | invariant | default | c16-all-malformed | — | invariant | derived |
| R16.c | `check_composite_arming` | observation | default | — | c16-ledger-skip, c16-malformed-warn | observation | derived |
| R16.d | `check_composite_arming` | observation | default | — | c16-store-absent | observation | derived |
| R16.e | `check_composite_arming` | invariant | default | c16-selftest | — | invariant | derived |

aspects 49 · derived 49 · waived 0 · refused 0
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --self-test | tail -1
self-test: 33/34 case(s) behaved
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs | tail -12

QUARANTINED (10):
- STALE: a ledger row changed since the table was pinned (a36ea7fff → 30068e36f)
- STALE: src/scripts/check_composite_arming.ts changed since the verdict was pinned (899e5d1fa → be71581b2)
- STALE: taskfiles/ci-fast.yml changed since the verdict was pinned (aedb0b222 → 9be191d28)
- STALE: .github/workflows/rule-backstops.yml changed since the verdict was pinned (015473465 → dfef566b5)
- STALE: agents/evidence/analysis/gate-branch-inventory-20261024.json changed since the verdict was pinned (119214ea1 → 5dc4e1648)
- STALE: agents/evidence/analysis/gate-branch-mapping-20261024.json changed since the verdict was pinned (c296fd9f0 → f7c41542f)
- STALE: agents/evidence/analysis/gate-branch-mapping-review-20261024.json changed since the verdict was pinned (46227ecda → 704d26ae8)
- STALE: agents/evidence/analysis/gate-ledger-reconcile.mjs changed since the verdict was pinned (906f66045 → 5774a1b0f)
- STALE: agents/evidence/analysis/gate-branch-reconciliation-20261024.md changed since the verdict was pinned (d25580a37 → 332d251f3)
- STALE: agents/evidence/analysis/gate-class-grounds-20261024.json changed since the verdict was pinned (3ae580599 → 819647a91)
```

The one failing self-test case is "baseline is clean", which reports the stale
pins listed above.

## Questions

**Q1. Re-attestation (D38).** Should the ten moved inputs be renewed together as
one attested set? Answer *renew* or *do not renew*. For do not renew, name the
input and the concrete defect.

**Q2.** Is item 4 met? Answer *met* or *not met*. For not met, name the concrete
shortfall against item 4's pass condition.

**Q3.** Is 7.1 closed under Option A, given the round-21 verdicts and your Q1
and Q2? Answer yes or no.

Give your confidence.
