/**
 * One definition of "what is a gate", pinned against reality and against drift.
 *
 * Three sites each carried their own prefix regex and each got a different
 * number — 223 / 225 / 232 (measured 2026-08-04). Harmless while the numbers
 * were only reported; load-bearing the moment the hardening ratchet started
 * reading one of them, and it read the narrowest: it counted a test file (so its
 * target of 0 was unreachable) and missed 10 real gates, one of which already
 * carried an enforced floor in the coverage manifest.
 *
 * The AI council's warning about the obvious pin is the shape of this file: *"a
 * test which merely compares three regex constants would pass while all three
 * are wrong together."* So nothing here compares constants. It asserts named
 * real cases, an invariant against the manifest, and — the actual teeth — that
 * no consumer has grown a private regex back.
 */
import { describe, expect, it } from 'vitest';

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listGateScripts, matchesGatePattern } from '../../src/scripts/_lib/gate_population.js';
import { count_gate_scripts, list_unhardened_gates, load_manifest } from '../../src/scripts/check_gate_coverage.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPTS = join(REPO_ROOT, 'src', 'scripts');

describe('matchesGatePattern — the drift cases, by name', () => {
    it('a test file is not a gate, however it is prefixed', () => {
        // `check_secret_leak.test.ts` matched `^check_.*\.ts$` and was counted.
        // A test cannot be hardened, so counting one made the ratchet's own
        // target of 0 unreachable by construction — the gate could never close.
        expect(matchesGatePattern('check_secret_leak.test.ts')).toBe(false);
        expect(matchesGatePattern('check_secret_leak.ts')).toBe(true);
    });

    it('a type declaration is not a gate', () => {
        expect(matchesGatePattern('check_types.d.ts')).toBe(false);
    });

    it('the prefixes the narrow definition dropped are gates', () => {
        // `skill_linter` is the proof this mattered: it already carried an
        // enforced floor of 380 in the coverage manifest while the ratchet did
        // not consider it a gate at all.
        expect(matchesGatePattern('skill_linter.ts')).toBe(true);
        expect(matchesGatePattern('verify_physical_move.ts')).toBe(true);
    });

    it('a non-gate script stays out', () => {
        expect(matchesGatePattern('bench_run.ts')).toBe(false);
        expect(matchesGatePattern('agent_settings.ts')).toBe(false);
        expect(matchesGatePattern('checkpoint_helper.ts')).toBe(false);
    });
});

describe('the population is one set, read by every consumer', () => {
    it('no consumer carries a private gate-prefix regex any more', () => {
        // The teeth. A future edit that re-inlines `(lint|check|audit)_` in any
        // of these files silently forks the population again — and would pass a
        // test that only compared the constants those files export.
        const consumers = [
            join(SCRIPTS, 'check_gate_coverage.ts'),
            join(SCRIPTS, 'sweep_dead_scan_roots.ts'),
            join(REPO_ROOT, 'tests', 'scripts', 'check_gate_coverage.test.ts'),
        ];
        const PRIVATE_REGEX = /\/\^\((?:lint|check|audit|skill|verify)[|)]/;
        for (const file of consumers) {
            const src = readFileSync(file, 'utf8');
            const offenders = src
                .split('\n')
                .map((line, i) => ({ line, no: i + 1 }))
                .filter(({ line }) => PRIVATE_REGEX.test(line))
                // The shared module is where the regex is SUPPOSED to live; the
                // doc comments quoting the historical patterns are prose.
                .filter(({ line }) => !line.trim().startsWith('*') && !line.trim().startsWith('//'));
            expect(offenders, `${file} re-inlined a gate-prefix regex`).toEqual([]);
        }
    });

    it('every manifest entry is a member of the population', () => {
        // One direction only, per the council: a NEW gate script lands before
        // anyone registers it — that is how the registration test found this
        // drift — so registration cannot be the classifier. But a registered id
        // that the population does not recognise means the two have forked.
        const population = new Set(listGateScripts(SCRIPTS, (d) => readdirSync(d)));
        for (const spec of load_manifest()) {
            expect(population.has(spec.id), `manifest lists ${spec.id}, population does not`).toBe(true);
        }
    });

    it('the unhardened count is a subset of a population that is not the whole tree', () => {
        // Guards both directions of vacuity: a population of everything makes
        // the ratchet meaningless, a population of nothing makes it green.
        const population = count_gate_scripts();
        const unhardened = list_unhardened_gates();
        expect(population).toBeGreaterThan(0);
        expect(population).toBeLessThan(readdirSync(SCRIPTS).length);
        expect(unhardened.length).toBeLessThanOrEqual(population);
        for (const id of unhardened) {
            expect(matchesGatePattern(`${id}.ts`)).toBe(true);
        }
    });
});
