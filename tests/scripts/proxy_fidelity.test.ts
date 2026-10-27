// `road-to-routing-assurance-live-floors` 5.4 — proxy fidelity and the
// downgrade-to-advisory path, demonstrated on a synthetic degradation.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    FIDELITY_TOLERANCE,
    applyFidelity,
    fidelityStatus,
    measureFidelity,
    readFidelityStatus,
    type FidelityCase,
} from '../../src/scripts/_lib/proxy_fidelity.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-'));
    dirs.push(d);
    return d;
}

const cases: FidelityCase[] = [
    { unit: 'code-review', prompt: 'code-review this', consulted: true },
    { unit: 'code-review', prompt: 'look over my diff', consulted: true },
    { unit: 'ai-council', prompt: 'ask other models', consulted: false },
    { unit: 'ai-council', prompt: 'ai-council please', consulted: false },
];
const substring = (prompt: string, unit: string): boolean => prompt.includes(unit);

describe('measureFidelity', () => {
    it('counts agreement and both directions of disagreement', () => {
        expect(measureFidelity(cases, substring)).toEqual({
            n: 4,
            agree: 2,
            agreement: 0.5,
            checker_only: 1,
            session_only: 1,
        });
    });

    it('has no agreement figure over zero cases', () => {
        expect(measureFidelity([], substring).agreement).toBeNull();
    });
});

describe('fidelityStatus', () => {
    it('a first report is its own reference', () => {
        expect(fidelityStatus(0.4, null)).toBe('ok');
    });

    it('degrades only past the registered tolerance below the reference', () => {
        expect(FIDELITY_TOLERANCE).toBe(0.1);
        expect(fidelityStatus(0.7, 0.8)).toBe('ok');
        expect(fidelityStatus(0.69, 0.8)).toBe('degraded');
    });

    it('a report with nothing measured is degraded, never ok', () => {
        expect(fidelityStatus(null, 0.8)).toBe('degraded');
    });
});

describe('the downgrade path — demonstrated on a synthetic degradation', () => {
    it('a degraded report turns a blocking exit into an advisory 0 and says why', () => {
        const root = tmp();
        const file = path.join(root, 'routing-proxy-fidelity.json');
        // Synthetic: the reference agreed on 0.9, the checker now agrees on 0.5.
        const synthetic = measureFidelity(cases, substring);
        const status = fidelityStatus(synthetic.agreement, 0.9);
        expect(status).toBe('degraded');
        fs.writeFileSync(file, JSON.stringify({ schema: 'routing-proxy-fidelity/v1', ...synthetic, status }));

        const out: string[] = [];
        expect(applyFidelity(1, readFidelityStatus(file), (s) => out.push(s))).toBe(0);
        expect(out.join('')).toMatch(/ADVISORY/);
    });

    it('an ok or absent report leaves the exit untouched', () => {
        const root = tmp();
        const file = path.join(root, 'f.json');
        fs.writeFileSync(file, JSON.stringify({ status: 'ok' }));
        expect(applyFidelity(1, readFidelityStatus(file), () => undefined)).toBe(1);
        expect(applyFidelity(1, readFidelityStatus(path.join(root, 'absent.json')), () => undefined)).toBe(1);
    });

    it('an unreadable report is degraded', () => {
        const root = tmp();
        const file = path.join(root, 'f.json');
        fs.writeFileSync(file, '{ not json');
        expect(readFidelityStatus(file)).toBe('degraded');
    });
});
