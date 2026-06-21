// Tests for src/scripts/lint_trust_coherence.ts (py2ts Phase 4 / Wave 4b).
//
// Layer 1: 1:1 port of tests/test_lint_trust_coherence.py — the three
//   Phase-5.4 invariants. The pytest monkeypatches the module constants
//   (ROOT / MANIFEST / ROUTER / COMPILED_SRC); the TS twin exposes the same
//   seam via _setConfigForTest, and main() reads its path defaults from that
//   config, so the port drives the exact same fixture.
// Layer 2: golden parity on the REAL REPO — python3 vs tsx, byte-identical
//   stdout/stderr/exit (skipped without python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as tc from '../../src/scripts/lint_trust_coherence.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


const _BANNER = tc._BANNER_MARKER;

function writeManifest(p: string, artefacts: unknown[], packs: unknown[]): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ artefacts, packs }, null, 2));
}
function writeRouter(p: string, kernel: string[]): void {
    fs.writeFileSync(p, JSON.stringify({ kernel }));
}
function writeCompiled(root: string, rel: string, body: string): void {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
}

// --- Layer 1: 1:1 port of tests/test_lint_trust_coherence.py ---------------

/** Run a fn capturing stderr; returns the captured text. */
function captureErr(fn: () => void): string {
    let err = '';
    const spyErr = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => {
        err += String(c);
        return true;
    });
    const spyOut = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
        fn();
        return err;
    } finally {
        spyErr.mockRestore();
        spyOut.mockRestore();
    }
}

describe('lint_trust_coherence — Phase-5.4 invariants (port of pytest)', () => {
    let tmp: string;
    let manifest: string;
    let router: string;
    let compiled: string;

    function buildFixture(): void {
        manifest = path.join(tmp, 'dist', 'discovery', 'discovery-manifest.json');
        router = path.join(tmp, 'router.json');
        compiled = path.join(tmp, 'dist/agent-src');

        writeManifest(
            manifest,
            [
                {
                    category: 'rule',
                    name: null,
                    path: 'packages/core/.agent-src.uncondensed/rules/scope-control.md',
                    packs: ['engineering-base'],
                    trust: { level: 'core', confidence: 'high', human_review_required: false },
                },
                {
                    category: 'rule',
                    name: null,
                    path: 'packages/pack-finance-basic/.agent-src.uncondensed/rules/finance-safety-floor.md',
                    packs: ['finance-basic'],
                    trust: { level: 'advisory', confidence: 'high', human_review_required: true },
                },
            ],
            [
                {
                    id: 'finance-basic',
                    trust_summary: { advisory: 1, core: 0, professional: 0 },
                },
                { id: 'engineering-base', trust_summary: { core: 1 } },
            ],
        );
        writeRouter(router, ['scope-control']);
        writeCompiled(
            compiled,
            'rules/finance-safety-floor.md',
            `${_BANNER}\n> HUMAN REVIEW REQUIRED · trust: advisory · owner: finance\n\n# Body\n`,
        );
        writeCompiled(compiled, 'rules/scope-control.md', '# scope-control\n');

        tc._setConfigForTest({ ROOT: tmp, MANIFEST: manifest, ROUTER: router, COMPILED_SRC: compiled });
    }

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-'));
        buildFixture();
    });
    afterEach(() => {
        // Restore default config so other suites are unaffected.
        const root = path.resolve(REPO_ROOT);
        tc._setConfigForTest({
            ROOT: root,
            MANIFEST: path.join(root, 'dist', 'discovery', 'discovery-manifest.json'),
            ROUTER: path.join(root, 'dist', 'router.json'),
            COMPILED_SRC: path.join(root, 'dist/agent-src'),
        });
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function runMain(): number {
        return tc.main(['--quiet', '--manifest', manifest, '--router', router, '--compiled-src', compiled]);
    }

    it('clean fixture passes', () => {
        let code = -1;
        captureErr(() => {
            code = runMain();
        });
        expect(code).toBe(0);
    });

    it('pack missing safety floor fails', () => {
        const data = JSON.parse(fs.readFileSync(manifest, 'utf-8'));
        data.artefacts = (data.artefacts as { path: string }[]).filter(
            (a) => !a.path.includes('safety-floor'),
        );
        fs.writeFileSync(manifest, JSON.stringify(data));
        let code = -1;
        const err = captureErr(() => {
            code = runMain();
        });
        expect(code).toBe(1);
        expect(err).toContain('pack `finance-basic`');
        expect(err).toContain('safety-floor');
    });

    it('missing banner in compiled output fails', () => {
        fs.writeFileSync(
            path.join(compiled, 'rules', 'finance-safety-floor.md'),
            '# finance-safety-floor (no banner)\n',
        );
        let code = -1;
        const err = captureErr(() => {
            code = runMain();
        });
        expect(code).toBe(1);
        expect(err).toContain('missing the HRR banner');
    });

    it('missing compiled output fails', () => {
        fs.rmSync(path.join(compiled, 'rules', 'finance-safety-floor.md'));
        let code = -1;
        const err = captureErr(() => {
            code = runMain();
        });
        expect(code).toBe(1);
        expect(err).toContain('compiled output');
        expect(err).toContain('missing');
    });

    it('kernel rule not core fails', () => {
        const data = JSON.parse(fs.readFileSync(manifest, 'utf-8'));
        for (const a of data.artefacts as { path: string; trust: { level: string } }[]) {
            if (a.path.endsWith('scope-control.md')) {
                a.trust.level = 'advisory';
            }
        }
        fs.writeFileSync(manifest, JSON.stringify(data));
        let code = -1;
        const err = captureErr(() => {
            code = runMain();
        });
        expect(code).toBe(1);
        expect(err).toContain('kernel rule `scope-control`');
        expect(err).toContain('trust.level=`advisory`');
    });

    it('kernel rule missing from manifest fails', () => {
        writeRouter(router, ['scope-control', 'nonexistent-rule']);
        let code = -1;
        const err = captureErr(() => {
            code = runMain();
        });
        expect(code).toBe(1);
        expect(err).toContain('kernel rule `nonexistent-rule`');
        expect(err).toContain('no matching artefact');
    });

    it('missing manifest raises SystemExit', () => {
        const nope = path.join(tmp, 'nope.json');
        expect(() =>
            tc.main(['--quiet', '--manifest', nope, '--router', router, '--compiled-src', compiled]),
        ).toThrow(tc.SystemExit);
    });
});

// --- Layer 2: golden parity on the REAL REPO -------------------------------

