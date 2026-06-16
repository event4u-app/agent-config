/**
 * Tests for `agent-config eval:record` (recordTriggerEval).
 *
 * No network, no real eval run — fixtures only. Asserts the integrity guards
 * and exit-code contract: live result records & passes, mock is rejected,
 * floor miss is recorded but fails, and the domain-specific floor is applied.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRecordTriggerEval } from './recordTriggerEval.js';

let dir: string;
let manifestPath: string;
let evalPath: string;

const MANIFEST = {
    upstream: {
        repo: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill',
        sha: 'b7e3af80f6e331f6fb456667b82b12cade7c9d35',
        last_checked: '2026-06-07',
    },
};

/** Write an EvalResult JSON for `skill` at `path`. */
function writeEvalAt(
    path: string,
    over: Partial<{ router: string; precision: number; recall: number; skill: string }>,
): void {
    writeFileSync(
        path,
        JSON.stringify({
            skill: over.skill ?? 'design-intelligence',
            model: 'claude-sonnet-4-5',
            router: over.router ?? 'anthropic',
            metrics: {
                true_positive: 5,
                false_positive: over.precision === undefined ? 1 : 0,
                false_negative: over.recall === undefined ? 0 : 1,
                true_negative: 4,
                precision: over.precision ?? 0.833,
                recall: over.recall ?? 1.0,
            },
        }),
        'utf8',
    );
}

function writeEval(over: Partial<{ router: string; precision: number; recall: number; skill: string }>): void {
    writeEvalAt(evalPath, over);
}

/** Create a `.../skills/<skill>/data/manifest.json` and return its path. */
function makeManifest(root: string, skill: string): string {
    const dataDir = join(root, 'skills', skill, 'data');
    mkdirSync(dataDir, { recursive: true });
    const p = join(dataDir, 'manifest.json');
    writeFileSync(p, `${JSON.stringify(MANIFEST, null, 2)}\n`, 'utf8');
    return p;
}

beforeEach(() => {
    // Mirror the real layout `.../skills/<skill>/data/manifest.json` so the
    // skill-mismatch guard has something to infer from.
    dir = mkdtempSync(join(tmpdir(), 'eval-rec-'));
    manifestPath = makeManifest(dir, 'design-intelligence');
    evalPath = join(dir, 'eval.json');
});

afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
});

describe('runRecordTriggerEval', () => {
    it('records a passing live result and returns 0', () => {
        writeEval({});
        const code = runRecordTriggerEval({ evalJson: evalPath, manifest: manifestPath });
        expect(code).toBe(0);
        const out = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
            upstream: { last_eval?: { passed: boolean; sha_at_eval: string } };
        };
        expect(out.upstream.last_eval?.passed).toBe(true);
        expect(out.upstream.last_eval?.sha_at_eval).toBe(MANIFEST.upstream.sha);
    });

    it('rejects a MockRouter result with exit 2 and writes nothing', () => {
        writeEval({ router: 'mock' });
        const before = readFileSync(manifestPath, 'utf8');
        const code = runRecordTriggerEval({ evalJson: evalPath, manifest: manifestPath });
        expect(code).toBe(2);
        expect(readFileSync(manifestPath, 'utf8')).toBe(before);
    });

    it('allows a mock result under --allow-mock', () => {
        writeEval({ router: 'mock' });
        const code = runRecordTriggerEval({ evalJson: evalPath, manifest: manifestPath, allowMock: true });
        expect(code).toBe(0);
    });

    it('records but fails (exit 1) when recall is below the floor', () => {
        writeEval({ recall: 0.8 });
        const code = runRecordTriggerEval({ evalJson: evalPath, manifest: manifestPath });
        expect(code).toBe(1);
        const out = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
            upstream: { last_eval?: { passed: boolean } };
        };
        expect(out.upstream.last_eval?.passed).toBe(false);
    });

    it('errors (exit 2) on a skill/manifest mismatch', () => {
        writeEval({ skill: 'some-other-skill' });
        const code = runRecordTriggerEval({ evalJson: evalPath, manifest: manifestPath });
        expect(code).toBe(2);
    });

    it('does not write the manifest in dry-run', () => {
        writeEval({});
        const before = readFileSync(manifestPath, 'utf8');
        const code = runRecordTriggerEval({ evalJson: evalPath, manifest: manifestPath, dryRun: true });
        expect(code).toBe(0);
        expect(readFileSync(manifestPath, 'utf8')).toBe(before);
    });

    it('applies the domain-specific floor: brand-strategy 0.9/0.7 passes where the default 1.0/0.8 would fail', () => {
        const bsManifest = makeManifest(dir, 'brand-strategy');
        const bsEval = join(dir, 'brand-strategy-eval.json');
        // recall 0.9, precision 0.7 — below the universal default (1.0/0.8),
        // but exactly on the brand-strategy domain floor.
        writeEvalAt(bsEval, { skill: 'brand-strategy', recall: 0.9, precision: 0.7 });
        const code = runRecordTriggerEval({ evalJson: bsEval, manifest: bsManifest });
        expect(code).toBe(0);
        const out = JSON.parse(readFileSync(bsManifest, 'utf8')) as {
            upstream: { last_eval?: { passed: boolean; floor: { min_recall: number; min_precision: number } } };
        };
        expect(out.upstream.last_eval?.passed).toBe(true);
        expect(out.upstream.last_eval?.floor).toEqual({ min_recall: 0.9, min_precision: 0.7 });
    });
});
