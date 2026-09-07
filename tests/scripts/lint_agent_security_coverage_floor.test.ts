/**
 * The negative control the `lint_agent_security` coverage row owes —
 * road-to-scan-that-fails-closed Phase 3.3.
 *
 * A floor nobody has watched fail is a number, not a floor. `check_gate_coverage`
 * exists because gates that scanned an emptied tree reported success and were
 * believed; registering a gate in its manifest without ever driving that gate's
 * count below its own floor reproduces the same trust one level up.
 *
 * So this drives the real thing: the shipped CLI, pointed at an EMPTY scope,
 * through the guard's own `classify`, against the floor as it is written in
 * `src/config/gate-coverage.yml` — never a fixture floor, because a fixture
 * floor would prove the arithmetic and not the registration.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { main } from '../../src/scripts/lint_agent_security.js';
import { classify, load_manifest, parse_scanned } from '../../src/scripts/check_gate_coverage.js';
import { runInProc } from '../_lib/run_in_process.js';

const GATE_ID = 'lint_agent_security';

describe('lint_agent_security — the coverage floor can fail', () => {
    let empty: string;
    beforeAll(() => {
        empty = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-sec-empty-scope-'));
    });
    afterAll(() => {
        fs.rmSync(empty, { recursive: true, force: true });
    });

    it('is registered in the manifest as enforced, with a floor above zero', () => {
        const spec = load_manifest().find((s) => s.id === GATE_ID);
        expect(spec, `${GATE_ID} is absent from src/config/gate-coverage.yml`).toBeDefined();
        expect(spec!.status).toBe('enforced');
        // A `> 0` check is not a floor; the manifest's own rule 3 says so.
        expect(spec!.min_scanned).toBeGreaterThan(0);
        // CI calls it bare, and the row must reproduce that call.
        expect(spec!.argv).toEqual([]);
    });

    it('an empty scope publishes scanned: 0 and the gate refuses', () => {
        const r = runInProc((argv: string[]) => main(argv), ['--root', empty]);
        expect(r.status, r.stdout + r.stderr).toBe(1);
        expect(parse_scanned(r.stdout + r.stderr)).toBe(0);
        // Not merely "it exited 1": every child must be named as not having
        // completed, which is what distinguishes an empty scope from a clean one.
        expect(r.stdout).toContain('5 of 5 child linter(s) did not complete');
    });

    it('the guard reds on that reading rather than passing on a zero count', () => {
        const spec = load_manifest().find((s) => s.id === GATE_ID)!;
        const verdictAtZero = classify(spec, 0, false);
        expect(verdictAtZero.verdict).toBe('below_floor');
        // `below_floor` is one of the three verdicts check_gate_coverage counts
        // as failures, and the result carries the gate's own id so the guard's
        // output names it.
        expect(verdictAtZero.id).toBe(GATE_ID);
        expect(verdictAtZero.message).toContain(String(spec.min_scanned));
    });

    it('the floor is a floor, not a zero-check — a large partial collapse also reds', () => {
        // The failure this floor is calibrated for is one child's corpus
        // shrinking without reaching zero, which the children's own dead-scope
        // assertions cannot see.
        const spec = load_manifest().find((s) => s.id === GATE_ID)!;
        expect(classify(spec, spec.min_scanned - 1, false).verdict).toBe('below_floor');
        expect(classify(spec, spec.min_scanned, false).verdict).toBe('ok');
    });

    it('the real tree sits above the floor — otherwise the row is red on arrival', () => {
        const spec = load_manifest().find((s) => s.id === GATE_ID)!;
        const r = runInProc((argv: string[]) => main(argv), []);
        const scanned = parse_scanned(r.stdout + r.stderr);
        expect(scanned).not.toBeNull();
        expect(scanned!).toBeGreaterThan(spec.min_scanned);
        // Risk 2 of the roadmap that added this row, made mechanical: a count of
        // CHILDREN would satisfy a `> 0` guard while measuring nothing.
        expect(scanned!).toBeGreaterThan(5);
    });
});
