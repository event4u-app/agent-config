<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (sixteenth round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent wrote the ledger. -->

# Step 7.1: do six sampled ledger rows match their code, and with the disagreements and owner now published, is the exit criterion met?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Where a fact is missing, say so. The asking agent wrote the
ledger and the mapping. Separate sessions of the same model wrote the branch
inventory and the mapping review. Treat the asking agent's work with suspicion.

## Background

The exit criterion is: "every live-tree check pinned red at Phase 7 start
carries a classification in 7.1's record." The four classes are invariant,
snapshot, tolerance and observation.

A classification is semantic: it attaches to one currently implemented
assertion under one named mode. Current exit behaviour is recorded
separately.

In the last round the seats split.

- **One seat said yes, narrowly**, and asked that reliance in 7.2 be blocked
  until a pin-renewal owner and an enforceable suspension gate exist.
- **The other seat said no.** It asked for three things:
  - publish the twelve review disagreements and their dispositions;
  - name a pin-renewal owner;
  - run a cross-provider spot-check of a sample of ledger rows against the
    check code.

Out of scope here are everything both seats placed in 7.2: a historical
re-enumeration, rollback scope, and quorum rules.

## The twelve review disagreements, disposed — revision 11

Round 15 (D39): anthropic would not accept *"honours every review verdict"*
without seeing the disagreements and how each one ended. Here is all of them.
The reviewer is the separate session, and its suggestion was adopted in
**12 of 12**. Not one was resolved in favour of the ledger author's original
mapping. The reconciler enforces this: an adopted disagreement that is
reverted fails the run (self-test case *a review disagreement is reverted*).

| Check | Branch | Author mapped | Reviewer suggested | Now | Reviewer reason |
|---|---|---|---|---|---|
| `check_gate_completeness` | `c1-dead-scope` | `R1.c` | `op:could-not-run` | `op:could-not-run` | Dead scope (no registered gate script found) is the tool being unable to measure, which the definition excludes; every other dead-scope branch (c5,c6,c7,c9,c11,c12,c13) i… |
| `lint_ticked_unmet_criteria` | `c2-selftest-recurse` | `R2.b` | `op:usage` | `op:usage` | Refusing to recurse when GATE_SELF_TEST_CHILD=1 is an invocation guard (exit 2), not a finding about the fixture table that R2.b describes. |
| `check_rule_invariants` | `c3-selftest-empty` | `R3.b` | `op:could-not-run` | `op:could-not-run` | No invariant to mutate means the self-test cannot run; it says nothing about whether removal is detected (the R3.b property). |
| `check_rule_invariants` | `c3-selftest-baseline-broken` | `R3.b` | `op:could-not-run` | `op:could-not-run` | Precondition failure: first invariant absent from src, so the mutation cannot be performed. The repo fact itself (string missing) is R3.a's property, not R3.b's. |
| `check_rule_invariants` | `c3-selftest-src-unreadable` | `R3.b` | `op:could-not-run` | `op:could-not-run` | Unreadable src file, exit 3 internal error — identical in nature to c3-json-read-or-parse which is mapped op:could-not-run. |
| `check_rule_invariants` | `c3-selftest-mutation-noop` | `R3.b` | `op:could-not-run` | `op:could-not-run` | Defensive "mutation did not apply" guard: the self-test could not set up its mutation; it does not measure detection. (op:unreachable is also defensible.) |
| `check_rule_invariants` | `c3-selftest-load-errors` | `R3.b` | `op:could-not-run` | `op:could-not-run` | Same invariants.json load/parse/malformed errors as c3-json-not-array/-malformed-entry/-read-or-parse (all op:could-not-run), exit 3; mapping the selftest-path copy to R3… |
| `check_token_quality_golden` | `c8-tasks-not-list` | `R8.a` | `op:could-not-run` | `op:could-not-run` | validate() records the structural error but task_count is then 0, so assertScanned throws first and main returns 2 with the dead-scope message (check_token_quality_golden… |
| `check_composite_arming` | `c16-store-unreadable` | `R16.c` | `R16.d` | `R16.d` | Store absent/unreadable is exactly row R16.d ("store absent"). R16.c is partial malformation. Mapping swapped with c16-ledger-skip / c16-malformed-warn. (By the definitio… |
| `check_composite_arming` | `c16-ledger-skip` | `R16.d` | `R16.c` | `R16.c` | Malformed lines recorded as precondition_unmet in the ledger is verbatim R16.c's evidence ("the gate ledger records each dropped line as precondition_unmet"). R16.d is st… |
| `check_composite_arming` | `c16-dead-scope` | `R16.b` | `op:could-not-run` | `op:could-not-run` | Empty store (zero records, zero malformed lines) is dead scope / evidence-missing, not malformation; the definition excludes it. R16.b's row text folds "empty store also … |
| `check_composite_arming` | `c16-malformed-warn` | `R16.d` | `R16.c` | `R16.c` | Malformed lines ignored while usable records exist = R16.c "partial malformation". R16.d is store absent. |

Four of the twelve corrected author errors that changed a row's meaning:

- the swapped composite rows (`R16.c` and `R16.d`), three branches;
- the dead-scope branch behind `R1.c`, which led to `R1.c`'s withdrawal.

The other eight moved precondition and invocation-guard branches out of rows
and into `op:could-not-run` or `op:usage`.

## The owner and candidate-state rules, verbatim from step 7.2

- *Owner (D39).* The accountable role for pin renewal, and for keeping
  7.2 blocked while a pin is stale, is the agent lane holding this
  roadmap's claim at that moment. The role does three things:
  1. initiates the council round on the stale diff;
  2. records the round under `agents/evidence/council/`;
  3. leaves the pin stale until the round answers 2/2 present.

  A degraded round renews nothing, and the role never renews on its own
  reading. Independent approval beyond the council is the second
  principal, and it stays owner-reserved under
  `external-bootstrap-boundary-for-phases-2-3`.
- *Candidate state (D39).* Re-attestation runs the reconciler against the
  proposed merge result of the 7.2 change, before it lands, and not
  against the current branch. That is how the sequencing rule avoids
  deadlock.

## Spot-check: six ledger rows and the code they classify

**R1.a** — check: `check_gate_completeness` · aspect: adoption ratchet · property: un-adopted gate count ≤ the recorded count, the recorded count exists, and it was landed or reaffirmed within `STALE_AFTER_DAYS` (56); three verdicts fail: regressed, unbaselined, stale · applicability: always · class: **invariant** (shrink-only)

**R4.a** — check: `check_augment_description_cap` · aspect: description length · property: every `type: auto` rule description ≤ `DESC_CAP` · applicability: when the scan root contains at least one `type: auto` rule; with none the check exits 0 having scanned nothing (`op:silent-pass`, a defect carried to 7.2) · class: **invariant**

**R5.a** — check: `check_trigger_evals` · aspect: freshness · property: `last_eval` present and not more than 90 days before the run date (a future date computes a negative age and is accepted) · applicability: always · class: **invariant, time-qualified**

**R10.l** — check: `check_knowledge_cards` · aspect: G3 redaction — `--global` · property: no confidential pattern (secret, email, internal host, external-source name, hidden Unicode) in a global card · applicability: only with `--global` · class: **invariant** in that mode

**R12.c** — check: `lint_agents_layout` · aspect: consumer shape — default mode · property: in **consumer mode only** (no source-repo markers in the working directory), entries outside the consumer-target shape are reported as warnings · applicability: consumer mode, invocation without `--strict`; never in this repository, which is in source-repo mode · class: **observation**

**R16.c** — check: `check_composite_arming` · aspect: partial malformation · property: malformed lines next to usable ones are counted and named per line · applicability: the store exists · class: **observation**

#### R1.a — `check_gate_completeness.ts` lines 196-222
```ts

    const verdict = checkRatchet({
        gate: 'check_gate_completeness',
        actual: unledgered.length,
        repoRoot: REPO_ROOT,
    });

    if (!QUIET && unledgered.length > 0 && verdict.status !== 'within') {
        process.stdout.write('\nun-adopted gates:\n');
        for (const row of unledgered) {
            process.stdout.write(`    - ${row.id}\n`);
        }
    }

    if (verdict.ok) {
        if (!QUIET) {
            process.stdout.write(`\n⚠️   ${verdict.message}\n`);
        }
        return 0;
    }
    process.stderr.write(`\n❌  ${verdict.message}\n`);
    return 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
```

#### R4.a — `check_augment_description_cap.ts` lines 112-151
```ts
    return RULES_DIR;
}

export function main(argv: readonly string[] = []): number {
    const failures: Array<[string, number, string]> = [];
    let checked = 0;

    for (const p of _globMdSorted(_resolve_root(argv))) {
        const text = fs.readFileSync(p, 'utf-8');
        const fm = parse_frontmatter(text);
        if (fm['type'] !== 'auto') {
            continue;
        }
        const desc = fm['description'] ?? '';
        checked += 1;
        if (desc.length > DESC_CAP) {
            failures.push([path.basename(p), desc.length, desc]);
        }
    }

    // Gate-coverage contract (src/config/gate-coverage.yml): emitted BEFORE the
    // pass/fail branch. Coverage and verdict are different questions — a gate that
    // found real violations still scanned its corpus, and reporting the count only
    // on the success path would make it look 'silent' to check_gate_coverage.
    process.stdout.write(`scanned: ${String(checked)}\n`);

    if (failures.length) {
        process.stderr.write(
            `❌  ${failures.length} auto-rule description(s) exceed ${DESC_CAP} chars:\n\n`,
        );
        for (const [name, dlen, desc] of [...failures].sort((a, b) => b[1] - a[1])) {
            process.stderr.write(`  [${String(dlen).padStart(3, ' ')}] ${name}\n`);
            process.stderr.write(`        ${desc}\n`);
        }
        process.stderr.write(
            `\n  Guard rationale: each char in an auto-rule description ` +
                `costs one char in the\n  Augment workspace-guidelines budget ` +
                `(cap: src/config/budgets.yml). Trim to ≤ ${DESC_CAP}.\n`,
        );
        return 1;
```

#### R5.a — `check_trigger_evals.ts` lines 136-158
```ts
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        return [`${rel}: unreadable JSON (${msg})`];
    }

    const errors: string[] = [];
    const obj = _asObject(data);

    const raw = obj ? obj['last_eval'] : undefined;
    const when = typeof raw === 'string' ? _parse_iso(raw) : null;
    if (when === null) {
        errors.push(`${rel}: missing or non-ISO \`last_eval\` (got ${_pyRepr(raw)})`);
    } else {
        const age = _days_between(today, when);
        if (age > MAX_AGE_DAYS) {
            errors.push(
                `${rel}: \`last_eval\` ${raw as string} is ${age}d old (> ${MAX_AGE_DAYS}d) ` +
                    '— re-run skill_trigger_eval and bump it',
            );
        }
    }

    // Two supported shapes: a single `queries` list of {q, trigger:bool}, or
```

#### R10.l — `check_knowledge_cards.ts` lines 160-180
```ts
                }
            }
            for (const field of ['source_repo', 'owner', 'review_after', 'promotion_reason']) {
                if (!prov[field]) {
                    errors.push(`${rel}:0 — G5: provenance footer missing '${field}'`);
                }
            }
        }
    }

    // G3 — redaction must have fired: a global card MUST be clean of confidential
    // patterns (secrets, emails, internal hostnames, external-source names, …).
    // A vendor card carrying a secret means redaction did not halt → hard fail.
    if (_kgr !== null) {
        for (const v of _kgr.redaction_scan(text)) {
            errors.push(
                `${rel}:0 — G3: confidential pattern in global card ` +
                    `(${v.category}: ${_pyRepr(v.snippet)}) — redaction must have fired before sharing`,
            );
        }
    }
```

#### R12.c — `lint_agents_layout.ts` lines 206-216
```ts
        if (CONSUMER_EXPECTED_ENTRIES.has(name)) {
            continue;
        }
        // Flat-file UNKNOWNs are already an error — don't double-count.
        if (_isFile(p) && !ALLOWED_FLAT_FILES.has(name)) {
            continue;
        }
        const kind = _isDir(p) ? 'dir' : 'file';
        warnings.push(`${p} (${kind}): legacy artefact outside the consumer-target shape.`);
    }
    return warnings;
```

#### R12.c — `lint_agents_layout.ts` lines 257-271
```ts
        );
        return 1;
    }

    if (warnings.length > 0) {
        if (!quiet) {
            process.stdout.write('⚠️  agents/ consumer-shape warnings:\n\n');
            for (const w of warnings) {
                process.stdout.write(`  - ${w}\n`);
            }
            process.stdout.write(`\n${MIGRATE_HINT}\n`);
        }
        if (strict) {
            return 1;
        }
```

#### R16.c — `check_composite_arming.ts` lines 362-371
```ts
        fs.writeFileSync(out, renderDistribution(readings, v), 'utf-8');
        process.stdout.write(`✅  wrote ${path.relative(REPO_ROOT, out)} (n=${String(v.usable)}, sessions=${String(v.sessions.length)})\n`);
        return 0;
    }

    if (malformed > 0) {
        process.stdout.write(`⚠️   ${String(malformed)} malformed line(s) ignored (${String(readings.length)} parsed)\n`);
    }
    if (v.armable) {
        process.stdout.write(
```


## Questions

**Q1 — Spot-check.** For each of the six rows, does the stated property,
applicability and class match what the code excerpt does? Answer per row:
*match*, *mismatch* (say what), or *cannot tell from the excerpt*.

**Q2 — The previous seat's three items.** Are the disagreements, the owner and
the spot-check now adequate?

**Q3 — Closure.** With revision 11 recorded as 7.1's verdict, is the exit
criterion met? Answer yes or no. If no, name the single thing still missing and
whether only the owner-reserved second principal can supply it.

Answer each with a recommendation, the strongest objection, and your
confidence.
