<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (twenty-seventh round that
     day), committed verbatim. The asking agent wrote the reconciler, the ledger
     and the fix below. -->

# Step 7.1: re-attestation of the input set at revision 22, and item 4

## Where 7.1 stands

**Closure standard.** The owner's Option A requires items 1, 4, 5, 6, 7 and 8.
Items 1, 5, 6, 7 and 8 were met 2/2 in round 21.

**Item 4's pass condition.** The class predicates are mutually exclusive, or
their precedence is defined, and each aspect satisfies its predicate.

**Rule D38.** A pin is never renewed by its author alone. A council round on the
diff that staled it renews it.

**The last attested input set** is revision 16, commit `a9a9ecd98d`. Twelve inputs
have moved since then. This round evaluates **revision 22**, the cumulative diff
since revision 16.

**Round 26** evaluated revision 21. It answered *do not renew* and *item 4 not
met*, both 2/2. Its findings:

1. Flags were matched as substrings (`preds.includes(mode)`, `/--[a-z]/`).
2. The inventory's effects were trusted, never checked against code.
3. No operational state or rollback for the absent-store exit 0.
4. The renewal unit carried an unexamined wiring change.

Section 5 shows what revision 22 changed for each finding.

## 1. The owner-chosen behaviour fix (D46) — `src/scripts/check_composite_arming.ts`

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
-| 3 | | mutation self-test — `--mutation-selftest` | removing the first invariant string in memory makes the check fail | `tests/golden/invariants.json` | only with `--mutation-selftest`; no caller found | the expectation file | **invariant** | the header: guards the checker aga
+| 3 | | mutation self-test — `--mutation-selftest` | removing the first invariant string in memory makes the check fail | `tests/golden/invariants.json` | only with `--mutation-selftest`; no caller found | the expectation file | **invariant** | the header: guards the checker aga
-| 14 | `lint_readme_jargon` | above-fold density | ≤ 3 watchlist hits in README lines 1–120 | README.md | always | README edits | **invariant** (numeric bound) | no named risk owner, so not a tolerance | `R14.a` |
+| 14 | `lint_readme_jargon` | above-fold density | ≤ 3 watchlist hits in README lines 1–120 | README.md | always | README edits | **invariant** (numeric bound) | fixed cap `MAX_HITS = 3`, more hits return 1 (`lint_readme_jargon.ts:172-188`); no named risk owner, so not a toleran
-| 16 | | store absent | the store file exists | same | no store file | bootstrap | **observation** | its own contract: no readings yet is "not measured yet" and never a build failure. Runtime metadata, not a class: `not-evaluated: evidence-missing`. Current behaviour diverges: t
+| 16 | | store absent | the store file exists | same | no store file | bootstrap | **observation** | its own contract: no readings yet is "not measured yet" and never a build failure. Runtime metadata, not a class: `not-evaluated: evidence-missing`. Behaviour matches since D46 (
```

## 4. Wiring files: the two trunk changes, and this lane's `tests.yml` comment

```diff
-      # path that never ships. Diff-scoped like the receipts; report-only for one
-      # release, then enforcing.
+      # path that never ships. Diff-scoped like the receipts; enforcing since
+      # road-to-a-tick-the-shipped-path-earns 3.3, after report mode shipped in
+      # 17.1.0 through 17.4.0. A false positive is exempted in its own step block.
-        run: ./scripts-run src/scripts/check_step_production_reach --base origin/main
+        run: ./scripts-run src/scripts/check_step_production_reach --base origin/main --enforce
-        # bench run that failed before writing leaves no store, and the predicate
-        # correctly exits 1 on a store it cannot read (an empty store must not
-        # pass as "no readings yet"). That is the right behaviour for the
-        # predicate and the wrong reason to red this job.
+        # bench run that failed before writing leaves no store, which the
+        # predicate reports as "not measured yet" and exits 0 on (D46); the bench
+        # step above is what fails the job in that case. A store that exists but
+        # is unreadable, malformed or empty still exits 1, which is the right
+        # behaviour for the predicate and the wrong reason to red this job.
-    desc: "Report a roadmap step this diff ticks whose tested symbols no production entry reaches, or that is ticked while it says `built, not wired`. Report-only for one release (road-to-a-tick-the-shipped-path-earns 3.3), enforcing after. Diff-scoped against origin/main"
-    cmd: ./scripts-run src/scripts/check_step_production_reach --base origin/main
+    desc: "Report a roadmap step this diff ticks whose tested symbols no production entry reaches, or that is ticked while it says `built, not wired`. Enforcing since road-to-a-tick-the-shipped-path-earns 3.3; a false positive carries a line `reach exempt: <reason>` in its own step block. Diff-scoped against origin/main"
+    cmd: ./scripts-run src/scripts/check_step_production_reach --base origin/main --enforce
```
`check_step_production_reach` is not one of the 16 checks. The `tests.yml`
change is a comment. It corrects the arming step's description of the
absent-store exit.

## 5. Revision 22: the answers to round 26

| Round-26 finding | Revision 22 |
|---|---|
| 1. Substring and any-flag mode matching | Flags compare as exact tokens. Each flag-only branch carries one structured flag in `flag_branches` (3 branches). That flag must be a token of the branch's predicates and a literal in the check's source. The branch blocks only for a row whose mode is that flag. There are three self-test cases: a substring, a missing flag, a foreign flag. The substring case was seen red. |
| 2. Effects not checked against code | The site scanner refuses a hard exit site (a non-zero return, exit or exit code) that lies only in branches declaring a non-blocking effect. 0 contradictions were found. The self-test case was seen red. Coverage is stated, not claimed: 63 of 167 blocking branches contain a hard exit or throw site. The other 104 report through an aggregated exit, which a syntactic scan cannot attribute. |
| 3. No operational state or rollback for D46 | `⏳ NOT MEASURED YET` is a distinct state. In CI, a failed bench write fails the bench step before it. There are two revert triggers: the bench passes but the store is absent; or the store stays absent across the 10 runs the floor needs. |
| 4. Unexamined wiring change | The two wiring pins attest only that no Phase 7 invocation moved. They attest nothing about `check_step_production_reach`'s enforcement. |

The derivation code in revision 22:

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
                const tokens = flagTokens((b.predicates ?? []).join(' '));
                if (mode !== null && !tokens.has(mode)) failures.push(`mode: ${r.id} is the ${mode} mode but reaching branch ${b.id} names no ${mode} token in its predicates`);
                const flag = grounds.flag_branches?.[`${c.check} ${b.id}`];
                if (b.effect === FLAG_EFFECT) {
                    if (flag === undefined) failures.push(`mode: flag-only branch ${b.id} has no structured flag in ${FILES.grounds}`);
                    else if (!tokens.has(flag)) failures.push(`mode: flag-only branch ${b.id} declares ${flag}, absent as a token from its predicates`);
                    else if (!io.read(`src/scripts/${c.check}.ts`).includes(`'${flag}'`) && !io.read(`src/scripts/${c.check}.ts`).includes(`"${flag}"`)) failures.push(`mode: flag-only branch ${b.id} declares ${flag}, absent from ${c.check}`);
                }
                if ((BLOCKING_EFFECTS.includes(b.effect) && !(b.effect === 'exit-code-only' && b.exit_code === 0)) || (b.effect === FLAG_EFFECT && mode !== null && flag === mode)) blocking.push(b.id);
                else if (NON_BLOCKING_EFFECTS.includes(b.effect) || b.effect === FLAG_EFFECT || (b.effect === 'exit-code-only' && b.exit_code === 0)) nonBlocking.push(b.id);
                else failures.push(`class predicate: ${r.id} is reached by ${b.id} with unknown effect ${b.effect}`);
            }
        }
        const derived = blocking.length > 0 && nonBlocking.length === 0 ? 'invariant' : nonBlocking.length > 0 && blocking.length === 0 ? 'observation' : blocking.length > 0 ? 'mixed' : 'unreached';
```

The effect-versus-code check in the site scanner:

```js
    // A hard exit site (a non-zero return, exit or exit code) inside branches
    // that all declare a non-blocking effect contradicts the inventory: the
    // code can fail the run where the inventory says it cannot. The reverse is
    // not decidable here, because most findings are pushed and the exit is
    // aggregated, so it is reported as a coverage count, never claimed.
    const effectOf = {};
    for (const c of inv.checks) for (const b of c.branches) effectOf[`${c.check} ${b.id}`] = b;
    const nonBlocking = (b) => b.effect === 'warning-exit-zero' || (b.effect === 'exit-code-only' && b.exit_code === 0);
    const HARD = ['return-nonzero', 'exit-nonzero', 'exit-code'];
    const confirmed = new Set();
    for (const r of report) {
        const bs = r.covering.map((id) => effectOf[`${r.check} ${id}`]).filter((b) => b !== undefined);
        if (HARD.includes(r.kind) || r.kind === 'throw') for (const id of r.covering) confirmed.add(`${r.check} ${id}`);
        if (HARD.includes(r.kind) && bs.length > 0 && bs.every(nonBlocking)) failures.push(`effect contradicts code: ${r.check}:${r.line} ${r.kind} lies only in non-blocking branch(es) ${r.covering.join(', ')}`);
    }
    const blockingIds = Object.entries(effectOf).filter(([, b]) => !nonBlocking(b) && b.effect !== 'warning-exit-nonzero-only-with-flag').map(([k]) => k);
    const effectCoverage = { blocking: blockingIds.length, confirmedByHardSite: blockingIds.filter((k) => confirmed.has(k)).length };
```

Grounds file now: `modes` for 11 rows, `flag_branches` for 3 branches, `waivers` `{}`, `structured` `{}`.

## Verbatim output at `HEAD`
```text
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --aspects | tail -7
| R16.a | `check_composite_arming` | observation | default | — | c16-armable, c16-not-armable-readings, c16-not-armable-sessions, c16-unusable-dropped | observation | derived |
| R16.b | `check_composite_arming` | invariant | default | c16-all-malformed | — | invariant | derived |
| R16.c | `check_composite_arming` | observation | default | — | c16-ledger-skip, c16-malformed-warn | observation | derived |
| R16.d | `check_composite_arming` | observation | default | — | c16-store-absent | observation | derived |
| R16.e | `check_composite_arming` | invariant | default | c16-selftest | — | invariant | derived |

aspects 49 · derived 49 · waived 0 · refused 0
$ node agents/evidence/analysis/gate-branch-sites.mjs | tail -2
effects: 167 blocking branches, 63 confirmed by a hard exit or throw site in their range; the rest report through an aggregated exit and rest on the independent inventory's reading. Contradictions refused: a hard exit site only in non-blocking branches.
OK: every site of the declared vocabulary in the 16 checks lies inside an inventoried branch or carries a disposition naming one; no site is a branch the inventory lacks.
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --self-test | tail -1
self-test: 36/37 case(s) behaved
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs | tail -12
- STALE: a ledger row changed since the table was pinned (a36ea7fff → 30068e36f)
- STALE: src/scripts/check_composite_arming.ts changed since the verdict was pinned (899e5d1fa → be71581b2)
- STALE: taskfiles/ci-fast.yml changed since the verdict was pinned (aedb0b222 → 9be191d28)
- STALE: .github/workflows/rule-backstops.yml changed since the verdict was pinned (015473465 → dfef566b5)
- STALE: .github/workflows/tests.yml changed since the verdict was pinned (0e1e0c988 → b522f8460)
- STALE: agents/evidence/analysis/gate-branch-inventory-20261024.json changed since the verdict was pinned (119214ea1 → 5dc4e1648)
- STALE: agents/evidence/analysis/gate-branch-mapping-20261024.json changed since the verdict was pinned (c296fd9f0 → f7c41542f)
- STALE: agents/evidence/analysis/gate-branch-mapping-review-20261024.json changed since the verdict was pinned (46227ecda → 704d26ae8)
- STALE: agents/evidence/analysis/gate-ledger-reconcile.mjs changed since the verdict was pinned (906f66045 → a42c36b67)
- STALE: agents/evidence/analysis/gate-branch-reconciliation-20261024.md changed since the verdict was pinned (d25580a37 → 332d251f3)
- STALE: agents/evidence/analysis/gate-branch-sites.mjs changed since the verdict was pinned (d926f34aa → 3d7f2072d)
- STALE: agents/evidence/analysis/gate-class-grounds-20261024.json changed since the verdict was pinned (3ae580599 → b031cbd35)
```

The one failing self-test case is "baseline is clean". It reports the stale
pins listed above.

## Questions

**Q1. Re-attestation (D38).** Should the twelve moved inputs at revision 22 be
renewed together as one attested set? Answer *renew* or *do not renew*. For do
not renew, name the input and the concrete defect.

**Q2.** Is item 4 met? Answer *met* or *not met*. For not met, name the concrete
shortfall against item 4's pass condition.

**Q3.** Given the round-21 verdicts and your Q1 and Q2, is 7.1 closed under
Option A? Answer yes or no.

Give your confidence.
