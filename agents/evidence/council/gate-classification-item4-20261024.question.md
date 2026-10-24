<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (twenty-second round that day),
     committed verbatim. The asking agent wrote the reconciler and the ledger. -->

# Step 7.1 — item 4, per aspect, and re-attestation of two pin renewals

The closure standard is fixed by the repository owner: **Option A**. It does not
reopen here. In round 21 you ruled items 1, 5, 6, 7 and 8 met, 2/2. Item 4 split.

- **anthropic: not met.** *"No row-level evidence that all 49 binding aspects
  were checked."*
- **openai: met.**

The stricter reading was taken. The asking agent wrote everything below; treat
its work with suspicion.

Item 4's pass condition: class predicates mutually exclusive, or with precedence
defined; each aspect satisfies its predicate.

## The change: revision 16, commit `a9a9ecd98d`

@@ -65,6 +65,8 @@ function realIo() {
     };
 }
 
+export const PREDICATE_ORDER = ['observation', 'tolerance', 'snapshot', 'invariant'];
+
 function section(text, heading) {
     const start = text.indexOf(heading);
     if (start < 0) throw new Error(`missing section ${heading}`);
@@ -133,7 +135,7 @@ export function reconcile(io) {
     const rowsDigest = sha256(ledgerRows.map((r) => r.raw).join('\n'));
     const tablePin = pinSection.match(/ledger table: sha256 `([0-9a-f]{64})`/);
     if (tablePin === null) failures.push('no ledger-table pin found');
-    else if (tablePin[1] !== rowsDigest) failures.push(`STALE: a ledger row changed since the table was pinned (${tablePin[1].slice(0, 9)} → ${rowsDigest.slice(0, 9)})`);
+    else if (tablePin[1] !== rowsDigest) failures.push(`STALE: a ledger row changed since the table was pinned (${tablePin[1].slice(0, 9)} → ${process.env.GATE_FULL_DIGEST ? rowsDigest : rowsDigest.slice(0, 9)})`);
 
     const pins = pinSection
         .split('\n')
@@ -162,15 +164,21 @@ export function reconcile(io) {
 
     const binding = ledgerRows.filter((r) => !r.migration && !r.withdrawn);
     for (const r of binding) if (r.cls === null) failures.push(`unclassified binding aspect: ${r.check} / ${r.aspect}`);
-    // Class predicates (round-20 item 4), checked against each row's own
-    // evidence cell: an observation states its non-blocking contract; a
-    // tolerance names a bound, a risk owner and an expiry; a snapshot names a
-    // baseline a governed act may move.
+    // Class predicates (round-20 item 4), applied in decision order to each
+    // binding aspect's own evidence cell; the first predicate that holds is the
+    // derived class, and it must equal the recorded one. An invariant therefore
+    // also proves that no earlier predicate holds. Every aspect is recorded.
+    const aspects = [];
     for (const r of binding) {
         const evidence = cells(r.raw)[8] ?? '';
-        if (r.cls === 'observation' && !/exit 0|exits 0|not a failure|never a build failure/i.test(evidence)) failures.push(`class predicate: ${r.id} is an observation but its evidence states no non-blocking contract`);
-        if (r.cls === 'tolerance' && !(/bound/i.test(evidence) && /risk owner/i.test(evidence) && /expir/i.test(evidence))) failures.push(`class predicate: ${r.id} is a tolerance without bound, risk owner and expiry`);
-        if (r.cls === 'snapshot' && !/baseline/i.test(evidence)) failures.push(`class predicate: ${r.id} is a snapshot without a baseline`);
+        const held = {
+            observation: /exit 0|exits 0|not a failure|never a build failure/i.test(evidence),
+            tolerance: /bound/i.test(evidence) && /risk owner/i.test(evidence) && /expir/i.test(evidence),
+            snapshot: /(?<![-\w])baseline\b/i.test(evidence.replace(/\bno baseline\b/gi, '')),
+        };
+        const derived = PREDICATE_ORDER.find((c) => c === 'invariant' || held[c]);
+        aspects.push({ id: r.id, check: r.check, recorded: r.cls, derived, held: PREDICATE_ORDER.filter((c) => held[c]) });
+        if (derived !== r.cls) failures.push(`class predicate: ${r.id} is recorded ${r.cls} but its evidence derives ${derived} (held: ${PREDICATE_ORDER.filter((c) => held[c]).join(', ') || 'none'})`);
     }
     for (const r of ledgerRows.filter((x) => x.migration)) {
         const hasCurrent = binding.some((b) => b.check === r.check && b.aspect.replace('— current', '').trim() === r.aspect.replace('— target', '').trim());
@@ -312,7 +320,7 @@ export function reconcile(io) {
         reasons: failures,
         consumable: state === 'valid',
     };
-    return { failures, report, matrix, artefact, status };
+    return { failures, report, matrix, artefact, status, aspects };
 }
 
 function renderBranchMatrix(lines, resolutions, t) {
@@ -384,6 +392,7 @@ function selfTest() {
         ['the mechanical site scanner finds an undisposed site', { ...io, sites: () => false }, /site scanner/],
         ['a stale pin quarantines rather than invalidates', { ...io, blob: (rel) => (rel === 'src/scripts/lint_readme_jargon.ts' ? '0'.repeat(40) : io.blob(rel)) }, 'quarantined'],
         ['a laundered mapping invalidates', json(FILES.mapping, (j) => { j.mapping.check_knowledge_cards['c10-E1-required'] = 'op:informational'; return j; }), 'invalid'],
+        ['an invariant row whose evidence states a permissive baseline', mutated(io, FILES.ledger, (t) => t.replace('| fixed fixture table (fixed-policy).', '| compared against a recorded baseline of known findings.')), /class predicate: R7\.b is recorded invariant but its evidence derives snapshot/],
         ['an observation row without a non-blocking contract', mutated(io, FILES.ledger, (t) => t.replace('| warning severity, exit 0 |', '| warning severity |')), /class predicate: R11\.e/],
         ['an unknown flag appears in a check', mutated(io, 'src/scripts/lint_readme_jargon.ts', (t) => `${t}\nconst x = '--surprise';\n`), /unclassified invocation mode: lint_readme_jargon --surprise/],
     ];
@@ -415,6 +424,14 @@ if (process.argv.includes('--self-test')) selfTest();
 else if (process.argv.includes('--matrix')) printMatrix();
 else if (process.argv.includes('--branches')) {
     process.stdout.write(reconcile(realIo()).artefact);
+} else if (process.argv.includes('--aspects')) {
+    const { aspects, failures } = reconcile(realIo());
+    console.log('| Row | Check | Recorded | Derived by decision order | Predicates that held |');
+    console.log('|---|---|---|---|---|');
+    for (const a of aspects) console.log(`| ${a.id} | \`${a.check}\` | ${a.recorded} | ${a.derived} | ${a.held.join(', ') || 'none'} |`);
+    const agree = aspects.filter((a) => a.derived === a.recorded).length;
+    console.log(`\naspects ${aspects.length} · derived = recorded ${agree} · mismatches ${aspects.length - agree}`);
+    process.exit(failures.length === 0 && agree === aspects.length ? 0 : 1);
 } else if (process.argv.includes('--status')) {
     const { status } = reconcile(realIo());
     process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);

Ledger evidence-cell change (row R7.b), and the two renewed pins:
```diff
-recorded value is the ledger table: sha256 `2de7c81166b9af0e19c1f8f8ac1e42623f9c652b9e9f3d074fdfb39262d9b35a`.
+recorded value is the ledger table: sha256 `a36ea7fffc461b6c22ef98b663c7d7f97ba82b165e3c7e67412bd13d3f2d27a1`.
-| `agents/evidence/analysis/gate-ledger-reconcile.mjs` | `5874a3b72cf04c99a0aae9cc00f16bae6e9cb6bd` |
+| `agents/evidence/analysis/gate-ledger-reconcile.mjs` | `906f66045927abfba9889d382ed123db5fe35f81` |
+`R3.a` and `R7.b`, as deriving snapshot.
+- `R7.b` described a different mode, `--write-baseline`, in words that read as a
+  `op:write`. Its sentence now says only that, so the evidence cell describes R7.b
+| R7.b | `lint_rule_enforcement_declaration` | invariant | invariant | none |
-| 7 | | self-test — `--self-test` | the checker's own fixture table behaves as declared: each planted case is accepted or refused as its row says | fixtures in source | only with `--self-test`; no caller found | edits to the checker | **invariant** | fixed fixture table (fixed-policy). `--write-baseline` is a write mode that rewrites the baseline file and asserts nothing, so it carries no class | `R7.b` |
+| 7 | | self-test — `--self-test` | the checker's own fixture table behaves as declared: each planted case is accepted or refused as its row says | fixtures in source | only with `--self-test`; no caller found | edits to the checker | **invariant** | fixed fixture table (fixed-policy). `--write-baseline` is a write mode (`op:write`) that asserts nothing, so it carries no class | `R7.b` |
```

## Verbatim output
```text
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --aspects
| Row | Check | Recorded | Derived by decision order | Predicates that held |
|---|---|---|---|---|
| R1.a | `check_gate_completeness` | invariant | invariant | none |
| R1.b | `check_gate_completeness` | invariant | invariant | none |
| R2.a | `lint_ticked_unmet_criteria` | invariant | invariant | none |
| R2.b | `lint_ticked_unmet_criteria` | invariant | invariant | none |
| R3.a | `check_rule_invariants` | invariant | invariant | none |
| R3.b | `check_rule_invariants` | invariant | invariant | none |
| R4.a | `check_augment_description_cap` | invariant | invariant | none |
| R5.a | `check_trigger_evals` | invariant | invariant | none |
| R5.b | `check_trigger_evals` | invariant | invariant | none |
| R6.a | `lint_subagent_determinism` | invariant | invariant | none |
| R7.a | `lint_rule_enforcement_declaration` | invariant | invariant | none |
| R7.b | `lint_rule_enforcement_declaration` | invariant | invariant | none |
| R8.a | `check_token_quality_golden` | invariant | invariant | none |
| R8.b | `check_token_quality_golden` | observation | observation | observation |
| R8.c | `check_token_quality_golden` | invariant | invariant | none |
| R9.a | `check_council_layout` | invariant | invariant | none |
| R10.a | `check_knowledge_cards` | invariant | invariant | none |
| R10.b | `check_knowledge_cards` | invariant | invariant | none |
| R10.c | `check_knowledge_cards` | invariant | invariant | none |
| R10.d | `check_knowledge_cards` | invariant | invariant | none |
| R10.e | `check_knowledge_cards` | invariant | invariant | none |
| R10.f | `check_knowledge_cards` | invariant | invariant | none |
| R10.g | `check_knowledge_cards` | invariant | invariant | none |
| R10.h | `check_knowledge_cards` | observation | observation | observation |
| R10.i | `check_knowledge_cards` | invariant | invariant | none |
| R10.k | `check_knowledge_cards` | invariant | invariant | none |
| R10.l | `check_knowledge_cards` | invariant | invariant | none |
| R10.m | `check_knowledge_cards` | invariant | invariant | none |
| R10.n | `check_knowledge_cards` | invariant | invariant | none |
| R10.o | `check_knowledge_cards` | invariant | invariant | none |
| R10.j | `check_knowledge_cards` | invariant | invariant | none |
| R11.a | `check_public_links` | invariant | invariant | none |
| R11.b | `check_public_links` | invariant | invariant | none |
| R11.c | `check_public_links` | invariant | invariant | none |
| R11.d | `check_public_links` | invariant | invariant | none |
| R11.e | `check_public_links` | observation | observation | observation |
| R11.f | `check_public_links` | invariant | invariant | none |
| R11.g | `check_public_links` | invariant | invariant | none |
| R12.a | `lint_agents_layout` | invariant | invariant | none |
| R12.c | `lint_agents_layout` | observation | observation | observation |
| R12.d | `lint_agents_layout` | invariant | invariant | none |
| R13.a | `lint_eval_freshness` | invariant | invariant | none |
| R14.a | `lint_readme_jargon` | invariant | invariant | none |
| R15.a | `lint_readme_serial_comma` | invariant | invariant | none |
| R16.a | `check_composite_arming` | observation | observation | observation |
| R16.b | `check_composite_arming` | invariant | invariant | none |
| R16.c | `check_composite_arming` | observation | observation | observation |
| R16.d | `check_composite_arming` | observation | observation | observation |
| R16.e | `check_composite_arming` | invariant | invariant | none |

aspects 49 · derived = recorded 49 · mismatches 0
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --self-test | tail -4
ok   an observation row without a non-blocking contract
ok   an unknown flag appears in a check

self-test: 17/17 case(s) behaved
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --status | jq -c "{state,consumable}"
{"state":"valid","consumable":true}
```

The first run of the decision-ordered check flagged three invariants as deriving
snapshot: `R2.b` and `R3.a` (evidence says *"no baseline"*) and `R7.b` (its
cell described the separate `--write-baseline` write mode, dispositioned
`op:write`). The predicate was made negation-aware and R7.b's sentence reworded;
no class changed.

## Questions

**Q1.** Is item 4 now met? *met* / *not met*; if not, name the concrete
shortfall against item 4's own pass condition.

**Q2. Re-attestation (rule D38).** The diff renewed two pins: the reconciler's
own blob, and the ledger-table digest, which moved because R7.b's evidence cell
changed. Does the diff change the meaning of any classification, or weaken any
check, in a way that should block renewing those pins? Answer *renew* or
*do not renew*, with the reason.

**Q3.** Given round 21 and your answers to Q1 and Q2, is 7.1 closed under the
owner's standard? Answer yes or no.

Give your confidence.
