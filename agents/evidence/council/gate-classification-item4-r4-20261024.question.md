<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (twenty-fifth round that day),
     committed verbatim. The asking agent wrote the reconciler and the ledger. -->

# Step 7.1: are round 24's must-fixes closed, and is R16.d the only residue?

The closure standard is the owner's **Option A**: items 1, 4, 5, 6, 7 and 8.
Items 2 and 3 are not required. Items 1, 5, 6, 7 and 8 were met 2/2 in round 21.
Only item 4 is open.

Round 24 ruled item 4 not met, 2/2, and refused renewal, 2/2. It set seven
must-fixes:

1. structured mode, not prose;
2. R16.d: fix the behaviour, or get an owner amendment that allows waivers;
3. a waiver reads `waived`, never satisfaction;
4. no waiver for mixed, unreached or unknown;
5. a waiver needs an approver, an issue, an expiry and a milestone;
6. snapshot and tolerance metadata supplements behaviour and does not replace it;
7. atomic attestation of the inputs.

The asking agent wrote everything below; treat its work with suspicion. It has
routed must-fix 2 to the owner, because both seats routed it there.

## The predicate code at commit `49e8fce705`

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
                if (BLOCKING_EFFECTS.includes(b.effect) || (b.effect === FLAG_EFFECT && mode !== null && preds.includes(mode))) blocking.push(b.id);
                else if (NON_BLOCKING_EFFECTS.includes(b.effect) || b.effect === FLAG_EFFECT) nonBlocking.push(b.id);
                else failures.push(`class predicate: ${r.id} is reached by ${b.id} with unknown effect ${b.effect}`);
            }
        }
        const derived = blocking.length > 0 && nonBlocking.length === 0 ? 'invariant' : nonBlocking.length > 0 && blocking.length === 0 ? 'observation' : blocking.length > 0 ? 'mixed' : 'unreached';
        const waiver = grounds.waivers?.[r.id];
        let verdict = null;
        if (r.cls === 'snapshot' || r.cls === 'tolerance') {
            const f = grounds.structured?.[r.id] ?? {};
            const fields = r.cls === 'snapshot' ? typeof f.baseline === 'string' && io.exists(f.baseline) : typeof f.bound === 'string' && typeof f.risk_owner === 'string' && typeof f.expiry === 'string';
            if (!fields) failures.push(`class predicate: ${r.id} is recorded ${r.cls} without its structured fields in ${FILES.grounds}`);
            else if (derived !== 'invariant') failures.push(`class predicate: ${r.id} is recorded ${r.cls} but its reaching branches derive ${derived}, not blocking behaviour`);
            else verdict = 'derived';
        } else if (derived === r.cls) {
            verdict = 'derived';
        } else if (waiver !== undefined) {
            const today = new Date().toISOString().slice(0, 10);
            const why = [];
            if (!['invariant', 'observation'].includes(derived)) why.push(`derived ${derived} is never waivable`);
            if (waiver.semantic !== r.cls || waiver.behaviour !== derived) why.push('semantic/behaviour do not match the row');
            if (!blocking.concat(nonBlocking).includes(waiver.branch)) why.push(`branch ${waiver.branch} does not reach the row`);
            if (typeof waiver.issue !== 'string' || waiver.issue.length < 20) why.push('no issue');
            if (waiver.approver !== 'owner' || typeof waiver.directive !== 'string' || !io.exists(waiver.directive)) why.push('no owner approval with an existing directive');
            if (typeof waiver.expiry !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(waiver.expiry) || waiver.expiry < today) why.push('no unexpired expiry');
            if (why.length === 0) verdict = 'waived';
            else failures.push(`class predicate: ${r.id} is recorded ${r.cls}, derives ${derived}, and its waiver is refused: ${why.join('; ')}`);
        } else {
            failures.push(`class predicate: ${r.id} is recorded ${r.cls} but its reaching branches derive ${derived} (blocking: ${blocking.join(', ') || 'none'}; non-blocking: ${nonBlocking.join(', ') || 'none'})`);
        }
        aspects.push({ id: r.id, check: r.check, recorded: r.cls, mode: mode ?? 'default', derived, blocking, nonBlocking, verdict: verdict ?? 'REFUSED' });
    }
    for (const id of Object.keys(grounds.waivers ?? {})) if (!aspects.some((a) => a.id === id && a.derived !== a.recorded)) failures.push(`stale waiver ${id}: the row no longer diverges`);
    for (const id of Object.keys(modes)) if (!binding.some((r) => r.id === id)) failures.push(`mode names ${id}, which is not a binding row`);
```

The attested-set check:
```js
    // The pins are attested as one set (round 24). The set digest covers the
    // recorded pin lines, the recorded table digest and the recorded closure
    // digest, so no single pin can be renewed without renewing the set line in
    // the same diff; the individual pins still say which input is stale.
    // Rollback restores the last attested set, never selected pins.
    const recordedSet = sha256([...pins.map((m) => `${m[1]} ${m[2]}`).sort(), `table ${tablePin?.[1] ?? ''}`, `closure ${closurePin?.[1] ?? ''} ${closurePin?.[2] ?? ''}`].join('\n'));
    const setPin = pinSection.match(/attested set: sha256 `([0-9a-f]{64})`/);
    if (setPin === null) failures.push('no attested-set pin found');
    else if (setPin[1] !== recordedSet) failures.push(`pin set broken: a pin line changed without its attested-set line (${setPin[1].slice(0, 9)} → ${process.env.GATE_FULL_DIGEST ? recordedSet : recordedSet.slice(0, 9)})`);
```

`gate-class-grounds-20261024.json` (modes and the R16.d waiver):
```json
{
 "modes": {
  "R8.c": "--require-complete",
  "R10.d": "--check-urls",
  "R10.g": "--strict",
  "R10.i": "--global",
  "R10.k": "--global",
  "R10.l": "--global",
  "R10.m": "--global",
  "R10.n": "--global",
  "R10.o": "--global",
  "R11.f": "--strict",
  "R12.d": "--strict"
 },
 "waivers": {
  "R16.d": {
   "semantic": "observation",
   "behaviour": "invariant",
   "branch": "c16-store-unreadable",
   "owed_to": "7.2",
   "reason": "The contract says an absent store is 'not measured yet' and never a build failure; the script currently exits 1 (check_composite_arming.ts:286-293). Reconciling that exit is an entry condition of 7.2.",
   "issue": "road-to-authority-routing-mechanism 7.2 entry condition: row 16's exit-1 divergence reconciled",
   "approver": null,
   "directive": null,
   "expiry": null
  }
 },
 "structured": {}
}
```

## Verbatim output
```text
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --aspects | grep -E "flag|R16|R4.a |aspects"
| Row | Check | Recorded | Mode | Blocking branches | Non-blocking branches | Derived | Verdict |
| R8.c | `check_token_quality_golden` | invariant | --require-complete | c8-require-complete | — | invariant | derived |
| R10.d | `check_knowledge_cards` | invariant | --check-urls | c10-C3-url-status, c10-C3-url-unreachable | — | invariant | derived |
| R10.g | `check_knowledge_cards` | invariant | --strict | c10-C6-source | — | invariant | derived |
| R10.i | `check_knowledge_cards` | invariant | --global | c10-G1-tier-missing, c10-G1-tier-invalid | — | invariant | derived |
| R10.k | `check_knowledge_cards` | invariant | --global | c10-G2-no-footer, c10-G2-field | — | invariant | derived |
| R10.l | `check_knowledge_cards` | invariant | --global | c10-G3-redaction | — | invariant | derived |
| R10.m | `check_knowledge_cards` | invariant | --global | c10-G4-sens-missing, c10-G4-sens-invalid | — | invariant | derived |
| R10.n | `check_knowledge_cards` | invariant | --global | c10-G5-field | — | invariant | derived |
| R10.o | `check_knowledge_cards` | invariant | --global | c10-G6-prohibited | — | invariant | derived |
| R11.f | `check_public_links` | invariant | --strict | c11-beta-marker | — | invariant | derived |
| R12.d | `lint_agents_layout` | invariant | --strict | c12-consumer-warning | — | invariant | derived |
aspects 49 · derived 48 · waived 0 · refused 1
| R16.d | `check_composite_arming` | observation | default | c16-store-unreadable | — | invariant | REFUSED |
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --self-test
FAIL baseline is clean — got: STALE: a ledger row changed since the table was pinned (a36ea7fff → 50221733d) | STALE: agents/evidence/analysis/gate-ledger-reconcile.mjs c
ok   a Phase 7 check is dropped from the ledger
ok   the Phase 7 record is altered
ok   an unsure review verdict loses its resolution
ok   a reviewed row branch is laundered into a category
ok   a review disagreement is reverted
ok   a pinned source changes
ok   a helper on the closure changes
ok   a row's applicability is edited after review
ok   a branch is mapped to the withdrawn row
ok   a line of the committed branch reconciliation is edited
ok   the mechanical site scanner finds an undisposed site
ok   a stale pin quarantines rather than invalidates
ok   a laundered mapping invalidates
ok   an observation row reached by a blocking branch
ok   an invariant row reached only by a non-blocking branch
ok   a flag-mode row loses its structured mode
ok   a structured mode the class cell does not name
ok   a mode the reaching branch does not name
ok   the waiver is removed
ok   an unapproved waiver is refused
ok   an approved, unexpired waiver is reported waived, not derived
ok   an expired waiver is refused
ok   a mixed derivation is never waivable
ok   a waiver for a row that does not diverge
ok   a pin line renewed without its attested-set line
ok   a snapshot without its structured baseline
ok   negated prose in an evidence cell changes no class
ok   an unknown flag appears in a check

self-test: 28/29 case(s) behaved
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs | tail -5
INVALID (4):
- STALE: a ledger row changed since the table was pinned (a36ea7fff → 50221733d)
- STALE: agents/evidence/analysis/gate-ledger-reconcile.mjs changed since the verdict was pinned (906f66045 → 97aa849e1)
- STALE: agents/evidence/analysis/gate-class-grounds-20261024.json changed since the verdict was pinned (3ae580599 → c1a64979e)
- class predicate: R16.d is recorded observation, derives invariant, and its waiver is refused: no owner approval with an existing directive; no unexpired expiry
```

The remaining 38 default-mode aspects all derive their recorded class from their
reaching branches' effects: 31 invariant, 7 observation including R16.d's
semantic class. The full table is in the ledger.

## Questions

**Q1.** For each of must-fixes 1, 3, 4, 5, 6 and 7, answer *closed* or *open*.
If a must-fix is open, name the concrete gap.

**Q2. Re-attestation (D38).** Should the pin set be renewed to the current
inputs? Answer *renew* or *do not renew*. Renewal cannot make the record valid
on its own, because R16.d stays refused until the owner answers.

**Q3.** Is R16.d now the **only** shortfall of item 4, and is it owner-reserved?
Answer yes or no. If no, name what else stands.

**Q4.** State the options to put to the owner for R16.d in one sentence each.
Say which option you would recommend, and why.

Give your confidence.
