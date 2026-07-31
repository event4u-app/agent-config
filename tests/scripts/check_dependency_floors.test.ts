/**
 * Runtime dependency-floor gate (road-to-zero-ceremony-install § Phase 2):
 * every caret floor is a settled minor, every exact pin is a named exception.
 *
 * A gate that cannot fail is worse than no gate — every rule below has a RED
 * case, and the committed manifest is asserted separately so the gate is
 * proven to hold on the real tree rather than only on fixtures.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    evaluate,
    EXACT_PIN_EXCEPTIONS,
    SECURITY_FLOOR_EXCEPTIONS,
} from '../../src/scripts/check_dependency_floors.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MANIFEST = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'),
) as { dependencies?: Record<string, string> };

describe('check_dependency_floors', () => {
    it('GREEN: settled caret floors pass', () => {
        expect(evaluate({ execa: '^9.5.0', yaml: '^2.9.0' })).toEqual([]);
    });

    it('RED: a freshest-patch caret floor is the ETARGET shape', () => {
        const errors = evaluate({ execa: '^9.6.1' });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('not a settled minor');
    });

    it('RED: the remedy names the exact replacement range', () => {
        expect(evaluate({ execa: '^9.6.1' })[0]).toContain('^9.6.0');
    });

    it('GREEN: an exact pin listed in EXACT_PIN_EXCEPTIONS passes', () => {
        expect(evaluate({ 'web-tree-sitter': '0.24.7' })).toEqual([]);
    });

    it('RED: an exact pin NOT listed is rejected', () => {
        const errors = evaluate({ lodash: '1.2.3' });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('EXACT_PIN_EXCEPTIONS');
    });

    it('RED: a range shape the rule does not cover is rejected, not ignored', () => {
        for (const range of ['~9.5.0', '>=9.5.0', '*', 'latest']) {
            expect(evaluate({ execa: range }), range).toHaveLength(1);
        }
    });

    it('every exception carries a non-trivial reason', () => {
        for (const [name, reason] of Object.entries(EXACT_PIN_EXCEPTIONS)) {
            expect(reason.length, name).toBeGreaterThan(20);
        }
    });

    it('committed manifest: every runtime floor is settled', () => {
        const deps = MANIFEST.dependencies ?? {};
        expect(Object.keys(deps).length).toBeGreaterThan(5);
        expect(evaluate(deps)).toEqual([]);
    });

    it('committed manifest: no exception is stale (each one is still a dependency)', () => {
        const deps = MANIFEST.dependencies ?? {};
        for (const name of [...Object.keys(EXACT_PIN_EXCEPTIONS), ...Object.keys(SECURITY_FLOOR_EXCEPTIONS)]) {
            expect(deps, name).toHaveProperty(name);
        }
    });
});

// A security floor is a CVE control, not a stale pin. The first version of
// this gate flagged `@fastify/static@^10.1.2` as "not a settled minor" and
// asked for `^10.1.0` — which would have re-opened a high-severity path
// traversal affecting <=10.1.1. These cases exist so that cannot recur.
describe('security floors outrank the settled-minor rule', () => {
    it('GREEN: a security floor at its required range passes untouched', () => {
        expect(evaluate({ '@fastify/static': '^10.1.2' })).toEqual([]);
    });

    it('RED: lowering a security floor to a settled minor is rejected', () => {
        const errors = evaluate({ '@fastify/static': '^10.1.0' });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('security floor must stay at ^10.1.2');
    });

    it('RED: raising it off the pinned range is rejected too — the range is the control', () => {
        expect(evaluate({ '@fastify/static': '^11.0.0' })).toHaveLength(1);
    });

    it('the settled-minor rule never fires on a security-floored package', () => {
        const errors = evaluate({ '@fastify/static': '^10.1.2' });
        expect(errors.join()).not.toContain('settled minor');
    });

    it('every security exception names the advisory and the vulnerable range', () => {
        for (const [name, entry] of Object.entries(SECURITY_FLOOR_EXCEPTIONS)) {
            expect(entry.required, name).toMatch(/^\^?\d+\.\d+\.\d+$/);
            expect(entry.reason.length, name).toBeGreaterThan(40);
        }
    });

    it('committed manifest: every security floor is actually at its required range', () => {
        const deps = MANIFEST.dependencies ?? {};
        for (const [name, entry] of Object.entries(SECURITY_FLOOR_EXCEPTIONS)) {
            expect(deps[name], name).toBe(entry.required);
        }
    });
});
