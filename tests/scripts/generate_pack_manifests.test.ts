// Tests for src/scripts/generate_pack_manifests.ts (py2ts Phase 8 / Wave 8a).
//
// No standalone pytest suite exists. WRITER with PyYAML safe_dump output —
// the golden-parity layer is the load-bearing test: it asserts python3 and
// tsx regenerate EVERY committed pack.yaml + README.md byte-identically, and
// that a full write run leaves zero git drift. The committed manifests ARE
// the byte target. A `--check` parity layer confirms the drift verdict
// matches. Skipped without python3. Every write run snapshots + restores the
// committed manifest set so the suite leaves the tree clean.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as gpm from '../../src/scripts/generate_pack_manifests.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_pack_manifests.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'generate_pack_manifests.py');
const SRC_PACKS = path.join(REPO_ROOT, 'src', 'packs');
const SRC_DOMAINS = path.join(REPO_ROOT, 'src', 'domains');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

/** Every committed pack.yaml + README.md under src/packs + src/domains. */
function manifestFiles(): string[] {
    const out: string[] = [];
    for (const parent of [SRC_PACKS, SRC_DOMAINS]) {
        let dirs: string[];
        try {
            dirs = fs.readdirSync(parent);
        } catch {
            continue;
        }
        for (const d of dirs.sort()) {
            for (const f of ['pack.yaml', 'README.md']) {
                const p = path.join(parent, d, f);
                if (fs.existsSync(p)) out.push(p);
            }
        }
    }
    return out.sort();
}

function snapshot(): Map<string, string> {
    const snap = new Map<string, string>();
    for (const p of manifestFiles()) {
        snap.set(p, fs.readFileSync(p, 'utf-8'));
    }
    return snap;
}

function restore(snap: Map<string, string>): void {
    for (const [p, content] of snap) {
        if (fs.readFileSync(p, 'utf-8') !== content) {
            fs.writeFileSync(p, content, 'utf-8');
        }
    }
}

describe.skipIf(!py3)('generate_pack_manifests — golden parity (python3 vs tsx)', () => {
    let snap: Map<string, string>;
    beforeEach(() => {
        snap = snapshot();
    });
    afterEach(() => {
        restore(snap);
    });

    function runPy(args: string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('--check → identical stdout/stderr/exit (same drift verdict)', () => {
        const p = runPy(['--check']);
        const t = runTs(['--check']);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
    });

    it('write run regenerates EVERY manifest byte-identically (PY vs TS)', () => {
        // Run python; capture the bytes it produced for every manifest.
        runPy([]);
        const pyBytes = new Map<string, string>();
        for (const p of manifestFiles()) pyBytes.set(p, fs.readFileSync(p, 'utf-8'));

        // Restore to committed baseline, then run TS from the same start.
        restore(snap);
        runTs([]);
        const tsBytes = new Map<string, string>();
        for (const p of manifestFiles()) tsBytes.set(p, fs.readFileSync(p, 'utf-8'));

        // Every file PY produced must equal what TS produced, byte-for-byte.
        expect([...tsBytes.keys()].sort()).toEqual([...pyBytes.keys()].sort());
        for (const [p, tsContent] of tsBytes) {
            expect(`${path.relative(REPO_ROOT, p)}:\n${tsContent}`).toBe(
                `${path.relative(REPO_ROOT, p)}:\n${pyBytes.get(p)}`,
            );
        }
    });

    it('TS write run leaves zero drift vs the committed manifests', () => {
        // The committed manifests are the byte target — a clean TS write must
        // reproduce them exactly (this is what `task generate-pack-manifests`
        // asserts in CI).
        runTs([]);
        for (const [p, committed] of snap) {
            expect(`${path.relative(REPO_ROOT, p)}:\n${fs.readFileSync(p, 'utf-8')}`).toBe(
                `${path.relative(REPO_ROOT, p)}:\n${committed}`,
            );
        }
    });
});

// PyYAML safe_dump scalar-quoting parity — the byte-identity risk flagged for
// this writer. Compares the TS emitter against python3 yaml.safe_dump for a
// spread of tricky scalar shapes (colon, bool-like, number-like, leading/
// trailing space, hash, em-dash/unicode, empty list/string).
describe.skipIf(!py3)('generate_pack_manifests — PyYAML safe_dump scalar parity', () => {
    const CASES: Array<Record<string, unknown>> = [
        { description: 'Git workflow — commit, pull requests, branch sync.' },
        { description: 'Vision: fundraising narrative, competitive moat.' },
        { label: 'Founder — Strategy' },
        { label: 'AI Video' },
        { version: '5.10.1' },
        { artefact_count: 86 },
        { owner: ['engineering'] },
        { empty: [] },
        { description: '' },
        { x: 'yes' },
        { x: 'no' },
        { x: 'on' },
        { x: 'y' },
        { x: 'true' },
        { v: '1.2' },
        { nested: { a: 1, b: 'two' } },
        { hash: '# leading hash' },
        { quote: "it's fine" },
        {
            id: 'fun',
            label: 'Fun',
            onboarding: {
                example_workflow: 'prediction-pool-optimizer',
                first_win_doc: 'FIRST_WIN.md',
                time_to_first_value_minutes: 6,
            },
            owner: ['small-business'],
            dependencies: { rules: [], skills: ['prediction-pool-optimizer'] },
        },
    ];

    function pyDump(obj: unknown): string {
        const r = spawnSync(
            'python3',
            [
                '-c',
                'import sys,json,yaml; ' +
                    'sys.stdout.write(yaml.safe_dump(json.loads(sys.stdin.read()), sort_keys=True, allow_unicode=True))',
            ],
            { input: JSON.stringify(obj), encoding: 'utf8' },
        );
        return r.stdout;
    }

    it('every scalar shape matches python3 yaml.safe_dump byte-for-byte', () => {
        for (const c of CASES) {
            const tsOut = gpm._py_safe_dump(c);
            const pyOut = pyDump(c);
            expect(tsOut).toBe(pyOut);
        }
    });
});
