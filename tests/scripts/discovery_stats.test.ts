// Tests for src/scripts/discovery_stats.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (_fmt_row, main exit codes, error channels) plus a
// golden-parity layer that runs python3 vs tsx on the REAL manifest and on
// tmp fixtures (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ds from '../../src/scripts/discovery_stats.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'discovery_stats.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'discovery_stats.py');
const DEFAULT_MANIFEST = path.join(REPO_ROOT, 'dist', 'discovery', 'discovery-manifest.json');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function runTs(args: string[]): { status: number; stdout: string; stderr: string } {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function runPy(args: string[]): { status: number; stdout: string; stderr: string } {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('discovery_stats — unit', () => {
    it('_fmt_row left-justifies the label to width 14 and joins parts with two spaces', () => {
        expect(ds._fmt_row('by category', { skill: 3, rule: 1 })).toBe('  by category    skill=3  rule=1');
    });
    it('_fmt_row with empty counts emits the trailing space then nothing', () => {
        expect(ds._fmt_row('by trust', {})).toBe('  by trust       ');
    });
});

describe('discovery_stats — main exit codes', () => {
    // The success path prints `manifest.relative_to(ROOT)`, which raises in the
    // Python original when the manifest is an absolute path OUTSIDE the repo
    // (a latent bug the TS twin replicates). To exercise the success + the
    // non-fatal error paths the way CI does (default manifest under ROOT), the
    // fixtures live in a tmp dir UNDER the repo root.
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(REPO_ROOT, '.ds-test-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('missing manifest → exit 1', () => {
        const r = runTs(['--manifest', path.join(tmp, 'nope.json')]);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('manifest not found');
    });

    it('invalid JSON → exit 1', () => {
        const p = path.join(tmp, 'bad.json');
        fs.writeFileSync(p, '{not json');
        const r = runTs(['--manifest', p]);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('invalid JSON');
    });

    it('no stats block → exit 1', () => {
        const p = path.join(tmp, 'no-stats.json');
        fs.writeFileSync(p, JSON.stringify({ artefacts: [] }));
        const r = runTs(['--manifest', p]);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('no `stats` block');
    });

    it('valid stats → exit 0 with formatted rows', () => {
        const p = path.join(tmp, 'm.json');
        fs.writeFileSync(
            p,
            JSON.stringify({
                stats: {
                    total_artefacts: 7,
                    by_category: { skill: 5, rule: 2 },
                    by_lifecycle: { stable: 7 },
                    by_trust_level: { core: 7 },
                    unassigned_count: 0,
                },
            }),
        );
        const r = runTs(['--manifest', p]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('  total          7');
        expect(r.stdout).toContain('skill=5');
        // unassigned_count is 0 → falsy → not printed.
        expect(r.stdout).not.toContain('unassigned');
    });
});

describe.runIf(hasPython3())('discovery_stats — golden parity (python3 vs tsx)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-gold-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it.runIf(fs.existsSync(DEFAULT_MANIFEST))('byte-identical on the real manifest (no args)', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });

    for (const name of ['missing', 'bad', 'no-stats', 'rich']) {
        it(`byte-identical for the ${name} fixture`, () => {
            let arg: string;
            if (name === 'missing') {
                arg = path.join(tmp, 'nope.json');
            } else {
                const p = path.join(tmp, `${name}.json`);
                if (name === 'bad') {
                    fs.writeFileSync(p, '{not json');
                } else if (name === 'no-stats') {
                    fs.writeFileSync(p, JSON.stringify({ x: 1 }));
                } else {
                    fs.writeFileSync(
                        p,
                        JSON.stringify({
                            stats: {
                                total_artefacts: 12,
                                by_category: { skill: 8, rule: 3, command: 1 },
                                by_lifecycle: { stable: 10, beta: 2 },
                                by_trust_level: { core: 9, professional: 3 },
                                unassigned_count: 2,
                                documented_unassigned_count: 1,
                            },
                        }),
                    );
                }
                arg = p;
            }
            const py = runPy(['--manifest', arg]);
            const ts = runTs(['--manifest', arg]);
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            // stderr error prose is interpreter-dependent for two cases:
            //  - 'bad'  → JSONDecodeError message text differs;
            //  - 'rich' → an absolute --manifest outside ROOT triggers the
            //             latent `relative_to` ValueError (traceback prose).
            // Both compare exit code + stdout (a stable parity contract); the
            // stable 'missing' / 'no-stats' messages are compared in full.
            if (name !== 'bad' && name !== 'rich') {
                expect(ts.stderr).toBe(py.stderr);
            }
        });
    }
});
