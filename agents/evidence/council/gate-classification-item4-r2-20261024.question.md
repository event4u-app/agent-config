<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (twenty-third round that day),
     committed verbatim. The asking agent wrote the reconciler and the ledger. -->

# Step 7.1: item 4 with a positive invariant predicate, and closure

## The fixed standard

The repository owner fixed the closure standard as **Option A**. Under it, 7.1
requires acceptance items **1, 4, 5, 6, 7 and 8 only**. Items 2 and 3 (a 330-row
manifest and an independent 330→16 re-derivation) are **explicitly not
required**, by the owner's directive
`agents/evidence/owner-directives/2026-10-24-7-1-closure-standard.md`. Do not
condition your answer on items 2 or 3.

## Where the items stand

| Round | Result |
|---|---|
| 21 | Items 1, 5, 6, 7 and 8 met **2/2** |
| 22 | The revision-16 pins renewed **2/2** |
| 22 | Item 4 split. openai ruled it not met: *"`invariant` has no predicate; it is an unconditional fallback."* anthropic agreed that this was a weakness. |

The asking agent wrote everything below; treat its work with suspicion.

Item 4's pass condition: class predicates mutually exclusive, or with precedence
defined; each aspect satisfies its predicate.

## The change: revision 17, commit `52d029f33f`

@@ -66,6 +66,9 @@ function realIo() {
 }
 
 export const PREDICATE_ORDER = ['observation', 'tolerance', 'snapshot', 'invariant'];
+// An invariant's evidence names its fixed contract or the failing outcome that
+// enforces it. No predicate holding is unclassifiable, never invariant by default.
+export const INVARIANT_EVIDENCE = /\bfixed\b|\bfrozen\b|\bno baseline\b|\bcontract\b|\berrors?\b|\bfail|\bexit 1\b|returns? 1|may only (go down|shrink)|\bequality\b/i;
 
 function section(text, heading) {
     const start = text.indexOf(heading);
@@ -175,8 +178,9 @@ export function reconcile(io) {
             observation: /exit 0|exits 0|not a failure|never a build failure/i.test(evidence),
             tolerance: /bound/i.test(evidence) && /risk owner/i.test(evidence) && /expir/i.test(evidence),
             snapshot: /(?<![-\w])baseline\b/i.test(evidence.replace(/\bno baseline\b/gi, '')),
+            invariant: INVARIANT_EVIDENCE.test(evidence),
         };
-        const derived = PREDICATE_ORDER.find((c) => c === 'invariant' || held[c]);
+        const derived = PREDICATE_ORDER.find((c) => held[c]) ?? 'unclassifiable';
         aspects.push({ id: r.id, check: r.check, recorded: r.cls, derived, held: PREDICATE_ORDER.filter((c) => held[c]) });
         if (derived !== r.cls) failures.push(`class predicate: ${r.id} is recorded ${r.cls} but its evidence derives ${derived} (held: ${PREDICATE_ORDER.filter((c) => held[c]).join(', ') || 'none'})`);
     }
@@ -393,6 +397,7 @@ function selfTest() {
         ['a stale pin quarantines rather than invalidates', { ...io, blob: (rel) => (rel === 'src/scripts/lint_readme_jargon.ts' ? '0'.repeat(40) : io.blob(rel)) }, 'quarantined'],
         ['a laundered mapping invalidates', json(FILES.mapping, (j) => { j.mapping.check_knowledge_cards['c10-E1-required'] = 'op:informational'; return j; }), 'invalid'],
         ['an invariant row whose evidence states a permissive baseline', mutated(io, FILES.ledger, (t) => t.replace('| fixed fixture table (fixed-policy).', '| compared against a recorded baseline of known findings.')), /class predicate: R7\.b is recorded invariant but its evidence derives snapshot/],
+        ['an invariant row whose evidence states no fixed contract or failing outcome', mutated(io, FILES.ledger, (t) => t.replace('| fixed cap |', '| a cap |')), /class predicate: R4\.a is recorded invariant but its evidence derives unclassifiable/],
         ['an observation row without a non-blocking contract', mutated(io, FILES.ledger, (t) => t.replace('| warning severity, exit 0 |', '| warning severity |')), /class predicate: R11\.e/],
         ['an unknown flag appears in a check', mutated(io, 'src/scripts/lint_readme_jargon.ts', (t) => `${t}\nconst x = '--surprise';\n`), /unclassified invocation mode: lint_readme_jargon --surprise/],
     ];

Ledger evidence cells changed (R3.b, R14.a); the pin lines renewed:
```diff
-recorded value is the ledger table: sha256 `a36ea7fffc461b6c22ef98b663c7d7f97ba82b165e3c7e67412bd13d3f2d27a1`.
+recorded value is the ledger table: sha256 `50221733d4caac00e5a02a9f77dfa6978efb25e89c447a1ccab701e2a12b5630`.
-| `agents/evidence/analysis/gate-ledger-reconcile.mjs` | `906f66045927abfba9889d382ed123db5fe35f81` |
+| `agents/evidence/analysis/gate-ledger-reconcile.mjs` | `05e8a87a596cbe08bedc32c7d8beeb2a729e8ea5` |
-| 3 | | mutation self-test — `--mutation-selftest` | removing the first invariant string in memory makes the check fail | `tests/golden/invariants.json` | only with `--mutation-selftest`; no caller found | the expectation file | **invariant** | the header: guards the checker against a silently-green normalisation bug (repository-consistency) | `R3.b` |
+| 3 | | mutation self-test — `--mutation-selftest` | removing the first invariant string in memory makes the check fail | `tests/golden/invariants.json` | only with `--mutation-selftest`; no caller found | the expectation file | **invariant** | the header: guards the checker against a silently-green normalisation bug (repository-consistency); an undetected removal returns 1 (`check_rule_invariants.ts:204-208`) | `R3.b` |
-| 14 | `lint_readme_jargon` | above-fold density | ≤ 3 watchlist hits in README lines 1–120 | README.md | always | README edits | **invariant** (numeric bound) | no named risk owner, so not a tolerance | `R14.a` |
+| 14 | `lint_readme_jargon` | above-fold density | ≤ 3 watchlist hits in README lines 1–120 | README.md | always | README edits | **invariant** (numeric bound) | fixed cap `MAX_HITS = 3`, more hits return 1 (`lint_readme_jargon.ts:172-188`); no named risk owner, so not a tolerance | `R14.a` |
```

## Verbatim output
```text
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --aspects
| Row | Check | Recorded | Derived by decision order | Predicates that held |
|---|---|---|---|---|
| R1.a | `check_gate_completeness` | invariant | invariant | invariant |
| R1.b | `check_gate_completeness` | invariant | invariant | invariant |
| R2.a | `lint_ticked_unmet_criteria` | invariant | invariant | invariant |
| R2.b | `lint_ticked_unmet_criteria` | invariant | invariant | invariant |
| R3.a | `check_rule_invariants` | invariant | invariant | invariant |
| R3.b | `check_rule_invariants` | invariant | invariant | invariant |
| R4.a | `check_augment_description_cap` | invariant | invariant | invariant |
| R5.a | `check_trigger_evals` | invariant | invariant | invariant |
| R5.b | `check_trigger_evals` | invariant | invariant | invariant |
| R6.a | `lint_subagent_determinism` | invariant | invariant | invariant |
| R7.a | `lint_rule_enforcement_declaration` | invariant | invariant | invariant |
| R7.b | `lint_rule_enforcement_declaration` | invariant | invariant | invariant |
| R8.a | `check_token_quality_golden` | invariant | invariant | invariant |
| R8.b | `check_token_quality_golden` | observation | observation | observation, invariant |
| R8.c | `check_token_quality_golden` | invariant | invariant | invariant |
| R9.a | `check_council_layout` | invariant | invariant | invariant |
| R10.a | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.b | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.c | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.d | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.e | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.f | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.g | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.h | `check_knowledge_cards` | observation | observation | observation, invariant |
| R10.i | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.k | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.l | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.m | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.n | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.o | `check_knowledge_cards` | invariant | invariant | invariant |
| R10.j | `check_knowledge_cards` | invariant | invariant | invariant |
| R11.a | `check_public_links` | invariant | invariant | invariant |
| R11.b | `check_public_links` | invariant | invariant | invariant |
| R11.c | `check_public_links` | invariant | invariant | invariant |
| R11.d | `check_public_links` | invariant | invariant | invariant |
| R11.e | `check_public_links` | observation | observation | observation |
| R11.f | `check_public_links` | invariant | invariant | invariant |
| R11.g | `check_public_links` | invariant | invariant | invariant |
| R12.a | `lint_agents_layout` | invariant | invariant | invariant |
| R12.c | `lint_agents_layout` | observation | observation | observation |
| R12.d | `lint_agents_layout` | invariant | invariant | invariant |
| R13.a | `lint_eval_freshness` | invariant | invariant | invariant |
| R14.a | `lint_readme_jargon` | invariant | invariant | invariant |
| R15.a | `lint_readme_serial_comma` | invariant | invariant | invariant |
| R16.a | `check_composite_arming` | observation | observation | observation, invariant |
| R16.b | `check_composite_arming` | invariant | invariant | invariant |
| R16.c | `check_composite_arming` | observation | observation | observation |
| R16.d | `check_composite_arming` | observation | observation | observation, invariant |
| R16.e | `check_composite_arming` | invariant | invariant | invariant |

aspects 49 · derived = recorded 49 · mismatches 0
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --self-test | tail -5
ok   an invariant row whose evidence states no fixed contract or failing outcome
ok   an observation row without a non-blocking contract
ok   an unknown flag appears in a check

self-test: 18/18 case(s) behaved
# the same self-test with the old fallback (`?? 'invariant'`) restored in a scratch run:
FAIL an invariant row whose evidence states no fixed contract or failing outcome
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --status | jq -c "{state,consumable}"
{"state":"valid","consumable":true}
```

## Questions

**Q1.** Is item 4 now met? *met* / *not met*; if not, name the concrete
shortfall against item 4's own pass condition, not a new requirement.

**Q2. Re-attestation (rule D38).** Revision 17 renewed the reconciler pin and the
ledger-table pin; the table moved because R3.b's and R14.a's evidence cells
gained a verified enforcing line. Does the diff change any classification or
weaken any check in a way that should block renewal? *renew* / *do not renew*.

**Q3.** With items 1, 5, 6, 7 and 8 met 2/2 in round 21, and your Q1, is 7.1
closed under the owner's Option A? *yes* / *no*.

Give your confidence.
