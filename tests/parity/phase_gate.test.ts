import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    parseManifest,
    runPhaseGate,
    type Phase,
} from '../../src/scripts/parity/phase_gate.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function manifestJson(phases: ReadonlyArray<Record<string, unknown>>): string {
    return JSON.stringify({ _doc: 'test manifest', phases });
}

function phase(
    phaseNumber: number,
    name: string,
    categories: readonly string[],
    status: string,
): Record<string, unknown> {
    return { phase: phaseNumber, name, categories, status };
}

describe('parseManifest', () => {
    it('parses the checked-in manifest (phases 2-12, all pending)', () => {
        const raw = readFileSync(
            resolve(REPO_ROOT, 'src/scripts/parity/phase-manifest.json'),
            'utf-8',
        );
        const phases = parseManifest(raw);
        expect(phases.map((p) => p.phase)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(phases.every((p) => p.status === 'pending')).toBe(true);
        // installer category gates both phase 3 and phase 11.
        const installerPhases = phases.filter((p) => p.categories.includes('installer'));
        expect(installerPhases.map((p) => p.phase)).toEqual([3, 11]);
    });

    it('sorts phases by number', () => {
        const phases = parseManifest(
            manifestJson([
                phase(3, 'installer', ['installer'], 'pending'),
                phase(2, 'shared-libs', ['libs'], 'pending'),
            ]),
        );
        expect(phases.map((p) => p.phase)).toEqual([2, 3]);
    });

    it('rejects invalid JSON', () => {
        expect(() => parseManifest('{ not json')).toThrow(/not valid JSON/);
    });

    it('rejects a missing or empty phases array', () => {
        expect(() => parseManifest('{}')).toThrow(/"phases" must be a non-empty array/);
        expect(() => parseManifest('{"phases": []}')).toThrow(/non-empty array/);
    });

    it('rejects an unknown status', () => {
        expect(() =>
            parseManifest(manifestJson([phase(2, 'shared-libs', ['libs'], 'done')])),
        ).toThrow(/status must be one of/);
    });

    it('rejects an unknown category', () => {
        expect(() =>
            parseManifest(manifestJson([phase(2, 'shared-libs', ['no-such-bucket'], 'pending')])),
        ).toThrow(/unknown category/);
    });

    it('rejects duplicate phase numbers', () => {
        expect(() =>
            parseManifest(
                manifestJson([
                    phase(2, 'shared-libs', ['libs'], 'pending'),
                    phase(2, 'again', ['hooks'], 'pending'),
                ]),
            ),
        ).toThrow(/duplicate phase number 2/);
    });
});

describe('runPhaseGate', () => {
    const basePhases: Phase[] = parseManifest(
        manifestJson([
            phase(2, 'shared-libs', ['libs'], 'pending'),
            phase(3, 'installer', ['installer'], 'pending'),
            phase(4, 'linters', ['linters'], 'pending'),
        ]),
    );

    const samplePyFiles = [
        'src/scripts/_lib/agent_settings.py', // libs
        'src/scripts/_lib/fs_atomic.py', // libs
        'src/scripts/install.py', // installer
        'src/scripts/check_refs.py', // linters
    ];

    it('passes when all phases are pending (real-repo day-one state)', () => {
        const result = runPhaseGate(basePhases, samplePyFiles);
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
        expect(result.checks.every((c) => c.ok)).toBe(true);
    });

    it('fails on a sequencing gap: phase 3 in-progress while phase 2 is pending', () => {
        const phases = parseManifest(
            manifestJson([
                phase(2, 'shared-libs', ['libs'], 'pending'),
                phase(3, 'installer', ['installer'], 'in-progress'),
            ]),
        );
        const result = runPhaseGate(phases, samplePyFiles);
        expect(result.ok).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatch(/sequencing violation: phase 3/);
        expect(result.errors[0]).toMatch(/phase 2 .* still "pending"/);
    });

    it('fails when a complete phase still has tracked .py files in its categories', () => {
        const phases = parseManifest(
            manifestJson([phase(2, 'shared-libs', ['libs'], 'complete')]),
        );
        const result = runPhaseGate(phases, samplePyFiles);
        expect(result.ok).toBe(false);
        const check = result.checks.find((c) => c.phase === 2);
        expect(check?.ok).toBe(false);
        expect(check?.remaining).toBe(2);
        expect(check?.message).toMatch(/marked complete but 2 tracked .py file\(s\) remain/);
    });

    it('passes when a complete phase has zero remaining .py files', () => {
        const phases = parseManifest(
            manifestJson([
                phase(2, 'shared-libs', ['libs'], 'complete'),
                phase(3, 'installer', ['installer'], 'in-progress'),
            ]),
        );
        const pyFiles = ['src/scripts/install.py', 'src/scripts/check_refs.py'];
        const result = runPhaseGate(phases, pyFiles);
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
        expect(result.checks.find((c) => c.phase === 2)?.remaining).toBe(0);
    });

    it('reports the remaining count for in-progress phases (informational, never failing)', () => {
        const phases = parseManifest(
            manifestJson([phase(2, 'shared-libs', ['libs'], 'in-progress')]),
        );
        const result = runPhaseGate(phases, samplePyFiles);
        expect(result.ok).toBe(true);
        const check = result.checks.find((c) => c.phase === 2);
        expect(check?.ok).toBe(true);
        expect(check?.remaining).toBe(2);
        expect(check?.message).toMatch(/2 .py remaining .* \(informational\)/);
    });

    it('gates phase 11 (installer-finalization) on the shared installer category', () => {
        const phases = parseManifest(
            manifestJson([
                phase(3, 'installer', ['installer'], 'complete'),
                phase(11, 'installer-finalization', ['installer'], 'complete'),
            ]),
        );
        const result = runPhaseGate(phases, ['src/scripts/install.py']);
        expect(result.ok).toBe(false);
        expect(result.checks.filter((c) => !c.ok).map((c) => c.phase)).toEqual([3, 11]);
    });
});
