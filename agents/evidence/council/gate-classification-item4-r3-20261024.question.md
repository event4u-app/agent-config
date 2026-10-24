<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (twenty-fourth round that day),
     committed verbatim. The asking agent wrote the reconciler and the ledger. -->

# Step 7.1: item 4 from structured fields, and re-attestation

## The fixed standard

The repository owner fixed the closure standard as **Option A**. Under it, 7.1
requires acceptance items **1, 4, 5, 6, 7 and 8 only**. Items 2 and 3 are
**explicitly not required** (`agents/evidence/owner-directives/2026-10-24-7-1-closure-standard.md`).

## Where the items stand

- Round 21: items 1, 5, 6, 7 and 8 met **2/2**.
- Round 23: item 4 **not met 2/2**. The prose keyword predicate could not read
  polarity. openai named what would change its verdict: *"structured fields —
  such as an asserted contract, enforcement mechanism, and failing outcome"*.
- Round 23 split on renewing the revision-17 pins, so nothing was renewed and
  the record now reads **quarantined**. That is the designed state for an
  unattested renewal.

The asking agent wrote everything below; treat its work with suspicion.

## Where the classes now come from

1. **The independent branch inventory**
   (`gate-branch-inventory-20261024.json`). A separate agent session produced it
   from the 16 scripts only, without sight of the ledger. It has 198 branches,
   each with `where`, `effect` and `exit_code`. Effects found: `error-exit-nonzero`
   135, `throw` 27, `exit-code-only` 17, `warning-exit-zero` 16,
   `warning-exit-nonzero-only-with-flag` 3.
2. **The branch→row mapping.** It was independently reviewed, and its
   agree/disagree/unsure verdicts bind (enforced in earlier revisions, unchanged).
3. **The mechanical site scanner.** It confirms that every syntactic exit, throw
   or finding push in the 16 sources lies inside an inventoried branch or carries
   a disposition (items 5, met).

## The predicate code at commit `579f352419`

The prose predicates of revisions 16 and 17 are deleted. This is the whole replacement:

```js
// The class predicates read structured fields, never ledger prose. The branch
// inventory was produced without sight of the ledger, and its branch-to-row
// mapping was independently reviewed; each branch's `effect` says whether the
// run fails. A row in a flag mode ("in that mode") counts a flag-only failure as
// blocking; a default-mode row counts it as non-blocking.
export const BLOCKING_EFFECTS = ['error-exit-nonzero', 'throw', 'exit-code-only'];
export const NON_BLOCKING_EFFECTS = ['warning-exit-zero'];
export const FLAG_EFFECT = 'warning-exit-nonzero-only-with-flag';

// … inside reconcile(), after every binding row is shown reached:
    // Class predicates (round-20 item 4), derived per binding aspect from the
    // effects of the branches that reach it. Blocking only → invariant;
    // non-blocking only → observation; both or neither is refused. A snapshot
    // or tolerance needs its structured fields. A semantic class that differs
    // from the derived behaviour passes only as a recorded divergence owed to 7.2.
    const grounds = JSON.parse(io.read(FILES.grounds));
    const aspects = [];
    for (const r of binding) {
        const flagMode = /in that mode/.test(cells(r.raw)[7] ?? '');
        const blocking = [];
        const nonBlocking = [];
        for (const c of branchInv.checks.filter((x) => x.check === r.check)) {
            for (const b of c.branches) {
                if (!String(mapping[c.check]?.[b.id] ?? '').split('+').includes(r.id)) continue;
                if (BLOCKING_EFFECTS.includes(b.effect) || (b.effect === FLAG_EFFECT && flagMode)) blocking.push(b.id);
                else if (NON_BLOCKING_EFFECTS.includes(b.effect) || b.effect === FLAG_EFFECT) nonBlocking.push(b.id);
                else failures.push(`class predicate: ${r.id} is reached by ${b.id} with unknown effect ${b.effect}`);
            }
        }
        const derived = blocking.length > 0 && nonBlocking.length === 0 ? 'invariant' : nonBlocking.length > 0 && blocking.length === 0 ? 'observation' : blocking.length > 0 ? 'mixed' : 'unreached';
        const div = grounds.divergences?.[r.id];
        let verdict = derived === r.cls ? 'derived' : null;
        if (r.cls === 'snapshot' || r.cls === 'tolerance') {
            const f = grounds.structured?.[r.id] ?? {};
            const ok = r.cls === 'snapshot' ? typeof f.baseline === 'string' : typeof f.bound === 'string' && typeof f.risk_owner === 'string' && typeof f.expiry === 'string';
            verdict = ok ? 'structured' : null;
            if (!ok) failures.push(`class predicate: ${r.id} is recorded ${r.cls} without its structured fields in ${FILES.grounds}`);
        } else if (verdict === null && div !== undefined && div.semantic === r.cls && div.behaviour === derived && blocking.concat(nonBlocking).includes(div.branch) && div.owed_to === '7.2') {
            verdict = 'divergence owed to 7.2';
        } else if (verdict === null) {
            failures.push(`class predicate: ${r.id} is recorded ${r.cls} but its reaching branches derive ${derived} (blocking: ${blocking.join(', ') || 'none'}; non-blocking: ${nonBlocking.join(', ') || 'none'})`);
        }
        aspects.push({ id: r.id, check: r.check, recorded: r.cls, mode: flagMode ? 'flag' : 'default', derived, blocking, nonBlocking, verdict: verdict ?? 'REFUSED' });
    }
    for (const id of Object.keys(grounds.divergences ?? {})) if (!aspects.some((a) => a.id === id && a.verdict === 'divergence owed to 7.2')) failures.push(`stale divergence ${id}: the row no longer diverges or its record does not match`);
```

New structured-grounds file, in full:
```json
{
  "_doc": "Structured grounds for the class predicates that the independent branch inventory cannot supply. `divergences`: a row whose semantic class differs from the behaviour its reaching branches show, owed to 7.2. `structured`: the baseline (snapshot) or bound, risk owner and expiry (tolerance) a row of those classes must carry; no such row exists today.",
  "divergences": {
    "R16.d": {
      "semantic": "observation",
      "behaviour": "invariant",
      "branch": "c16-store-unreadable",
      "owed_to": "7.2",
      "reason": "The contract says an absent store is 'not measured yet' and never a build failure; the script currently exits 1 (check_composite_arming.ts:286-293). Reconciling that exit is an entry condition of 7.2."
    }
  },
  "structured": {}
}
```

## Verbatim output at `579f352419`
```text
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --aspects
| Row | Check | Recorded | Mode | Blocking branches | Non-blocking branches | Derived | Verdict |
|---|---|---|---|---|---|---|---|
| R1.a | `check_gate_completeness` | invariant | default | c1-ratchet-regressed, c1-ratchet-stale, c1-ratchet-unbaselined | — | invariant | derived |
| R1.b | `check_gate_completeness` | invariant | default | c1-ledger-fail-malformed, c1-malformed | — | invariant | derived |
| R2.a | `lint_ticked_unmet_criteria` | invariant | default | c2-duplicate-historical, c2-hit, c2-stale-historical | — | invariant | derived |
| R2.b | `lint_ticked_unmet_criteria` | invariant | default | c2-selftest | — | invariant | derived |
| R3.a | `check_rule_invariants` | invariant | default | c3-missing-file, c3-missing-string | — | invariant | derived |
| R3.b | `check_rule_invariants` | invariant | default | c3-selftest-undetected | — | invariant | derived |
| R4.a | `check_augment_description_cap` | invariant | default | c4-over-cap | — | invariant | derived |
| R5.a | `check_trigger_evals` | invariant | default | c6-last-eval-missing, c6-last-eval-stale | — | invariant | derived |
| R5.b | `check_trigger_evals` | invariant | default | c6-unreadable-json, c6-queries-empty, c6-query-no-q, c6-query-trigger-type, c6-split-list-empty, c6-split-item-empty, c6-no-shape, c6-one-class | — | invariant | derived |
| R6.a | `lint_subagent_determinism` | invariant | default | c5-no-frontmatter, c5-schema-version, c5-visible, c5-tools-dupes, c5-name-stem, c5-name-dup | — | invariant | derived |
| R7.a | `lint_rule_enforcement_declaration` | invariant | default | c7-undeclared-new, c7-gap-not-in-body, c7-baseline-stale, c7-baseline-shrink | — | invariant | derived |
| R7.b | `lint_rule_enforcement_declaration` | invariant | default | c7-selftest | — | invariant | derived |
| R8.a | `check_token_quality_golden` | invariant | default | c8-corpus-id, c8-id-format, c8-id-duplicate, c8-rules-empty, c8-rule-unknown, c8-nofire-kernel, c8-nofire-fires, c8-tag-not-fired, c8-scenario, c8-prompt, c8-label-status, c8-labelled-todo-rubric, c8-labelled-no-anchor | — | invariant | derived |
| R8.b | `check_token_quality_golden` | observation | default | — | c8-uncovered-warn, c8-missing-scenario-warn, c8-scaffold-notice | observation | derived |
| R8.c | `check_token_quality_golden` | invariant | flag | c8-require-complete | — | invariant | derived |
| R9.a | `check_council_layout` | invariant | default | c9-root-stray, c9-noncanonical | — | invariant | derived |
| R10.a | `check_knowledge_cards` | invariant | default | c10-C1-size | — | invariant | derived |
| R10.b | `check_knowledge_cards` | invariant | default | c10-C2-pointer | — | invariant | derived |
| R10.c | `check_knowledge_cards` | invariant | default | c10-C3-local | — | invariant | derived |
| R10.d | `check_knowledge_cards` | invariant | flag | c10-C3-url-status, c10-C3-url-unreachable | — | invariant | derived |
| R10.e | `check_knowledge_cards` | invariant | default | c10-C4-trust, c10-C4-type-wrong, c10-C4-type-missing | — | invariant | derived |
| R10.f | `check_knowledge_cards` | invariant | default | c10-C5-ancestry, c10-C5-span | — | invariant | derived |
| R10.g | `check_knowledge_cards` | invariant | flag | c10-C6-source | — | invariant | derived |
| R10.h | `check_knowledge_cards` | observation | default | — | c10-freshness-warn | observation | derived |
| R10.i | `check_knowledge_cards` | invariant | flag | c10-G1-tier-missing, c10-G1-tier-invalid | — | invariant | derived |
| R10.k | `check_knowledge_cards` | invariant | flag | c10-G2-no-footer, c10-G2-field | — | invariant | derived |
| R10.l | `check_knowledge_cards` | invariant | flag | c10-G3-redaction | — | invariant | derived |
| R10.m | `check_knowledge_cards` | invariant | flag | c10-G4-sens-missing, c10-G4-sens-invalid | — | invariant | derived |
| R10.n | `check_knowledge_cards` | invariant | flag | c10-G5-field | — | invariant | derived |
| R10.o | `check_knowledge_cards` | invariant | flag | c10-G6-prohibited | — | invariant | derived |
| R10.j | `check_knowledge_cards` | invariant | default | c10-E1-required | — | invariant | derived |
| R11.a | `check_public_links` | invariant | default | c11-target-not-found | — | invariant | derived |
| R11.b | `check_public_links` | invariant | default | c11-target-no-stability | — | invariant | derived |
| R11.c | `check_public_links` | invariant | default | c11-experimental | — | invariant | derived |
| R11.d | `check_public_links` | invariant | default | c11-self-no-stability | — | invariant | derived |
| R11.e | `check_public_links` | observation | default | — | c11-beta-marker | observation | derived |
| R11.f | `check_public_links` | invariant | flag | c11-beta-marker | — | invariant | derived |
| R11.g | `check_public_links` | invariant | default | c11-contexts-link | — | invariant | derived |
| R12.a | `lint_agents_layout` | invariant | default | c12-flat-file, c12-unknown-dir | — | invariant | derived |
| R12.c | `lint_agents_layout` | observation | default | — | c12-consumer-warning | observation | derived |
| R12.d | `lint_agents_layout` | invariant | flag | c12-consumer-warning | — | invariant | derived |
| R13.a | `lint_eval_freshness` | invariant | default | c13-manifest-unreadable, c13-no-last-eval, c13-sha-mismatch | — | invariant | derived |
| R14.a | `lint_readme_jargon` | invariant | default | c14-over-budget | — | invariant | derived |
| R15.a | `lint_readme_serial_comma` | invariant | default | c15-serial-comma | — | invariant | derived |
| R16.a | `check_composite_arming` | observation | default | — | c16-not-armable-readings, c16-not-armable-sessions, c16-unusable-dropped | observation | derived |
| R16.b | `check_composite_arming` | invariant | default | c16-all-malformed | — | invariant | derived |
| R16.c | `check_composite_arming` | observation | default | — | c16-ledger-skip, c16-malformed-warn | observation | derived |
| R16.d | `check_composite_arming` | observation | default | c16-store-unreadable | — | invariant | divergence owed to 7.2 |
| R16.e | `check_composite_arming` | invariant | default | c16-selftest | — | invariant | derived |

aspects 49 · derived 48 · divergence owed to 7.2 1 · refused 0
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --self-test
FAIL baseline is clean — got: STALE: a ledger row changed since the table was pinned (a36ea7fff → 50221733d) | STALE: agents/evidence/analysis/gate-ledger-reconcile.mjs changed since the verdict was pinned (906f66045 → 9b9632cd8)
ok   an observation row reached by a blocking branch
ok   an invariant row reached only by a non-blocking branch
ok   a flag-mode row loses its mode
ok   the recorded divergence is removed
ok   a divergence is recorded for a row that does not diverge
ok   a snapshot without its structured baseline
ok   negated prose in an evidence cell changes no class
self-test: 21/22 case(s) behaved
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs | tail -3
QUARANTINED (2):
- STALE: a ledger row changed since the table was pinned (a36ea7fff → 50221733d)
- STALE: agents/evidence/analysis/gate-ledger-reconcile.mjs changed since the verdict was pinned (906f66045 → 9b9632cd8)
```

## The pin state to attest

The last attested pins are those of revision 16 (round 22, 2/2). Two have moved
since, and neither has been renewed:

- **The reconciler blob.** Revisions 17 and 18 changed it: the predicates above,
  the self-test cases, and the input-coverage check.
- **The ledger-table digest.** Revision 17 added a verified enforcing line to the
  evidence cells of R3.b (`check_rule_invariants.ts:204-208` returns 1) and R14.a
  (`lint_readme_jargon.ts:172-188` returns 1 above `MAX_HITS = 3`). No class
  changed.

Two inputs gained **new** pins in revision 18, not renewals:

- the invocation inventory, which the input-coverage check found had never been
  pinned;
- the grounds file.

## Questions

**Q1.** Is item 4 now met? Answer *met* or *not met*. If not met, name the
concrete shortfall against item 4's own pass condition: class predicates
mutually exclusive, or with precedence defined, and each aspect satisfying its
predicate.

**Q2. Re-attestation (D38).** Do the cumulative revision-17 and revision-18
diffs change the meaning of any classification, or weaken any check, in a way
that should block renewing the reconciler pin and the ledger-table pin? Answer
*renew* or *do not renew*, with the reason.

**Q3.** If Q1 is met and Q2 is renew, is 7.1 closed under Option A? Answer yes
or no.

Give your confidence.
