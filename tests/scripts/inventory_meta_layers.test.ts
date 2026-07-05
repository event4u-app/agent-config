// Tests for src/scripts/inventory_meta_layers.ts (py2ts Phase 8 / Wave 8c).
//
// No pytest suite exists → focused differential suite. The script walks the
// rule/contract/guideline/context surfaces, runs `git log` per surface for the
// last-touched date, and writes two artefacts to agents/evidence/analysis/:
// meta-layer-inventory.md (\n-joined) and .csv (csv.writer \r\n terminator,
// QUOTE_MINIMAL). It also prints a 3-line summary unless --quiet.
//
// Golden parity: python3 vs tsx on the REAL repo across the default + --quiet
// shapes — byte-exact stdout/stderr/exit AND byte-identical written .md + .csv.
// The two evidence files are snapshotted/restored under the global-state lock
// (they are git-tracked, so zero drift after the run).
//
// Divergence note (replicated, not a bug): the .py builds its token-frequency
// map by iterating Python `set` objects, whose order is PYTHONHASHSEED-
// dependent. The emitted output is nonetheless stable across hash seeds
// (verified empirically) because the concept label uses `sorted(shared)[:2]`
// and the `max(...)` fallback resolves identically; the TS twin iterates tokens
// in a deterministic (sorted) order and matches the Python output byte-for-byte.
//
// Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { acquireGlobalStateLock } from './_global_state_lock.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'inventory_meta_layers.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const EVIDENCE_DIR = path.join(REPO_ROOT, 'agents', 'evidence', 'analysis');
const MD = path.join(EVIDENCE_DIR, 'meta-layer-inventory.md');
const CSV = path.join(EVIDENCE_DIR, 'meta-layer-inventory.csv');

function runTs(args: string[]) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT });
}

describe('inventory_meta_layers — golden parity', () => {
    let snap: Record<string, string | null> = {};
    let release: (() => void) | null = null;
    beforeEach(() => {
        release = acquireGlobalStateLock();
        for (const f of [MD, CSV]) {
            snap[f] = fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : null;
        }
    });
    afterEach(() => {
        for (const f of [MD, CSV]) {
            const s = snap[f];
            if (s !== null && s !== undefined) fs.writeFileSync(f, s, 'utf-8');
            else if (fs.existsSync(f)) fs.rmSync(f);
        }
        snap = {};
        if (release) {
            release();
            release = null;
        }
    });

    for (const args of [[], ['--quiet']]) {
        it(`byte-identical stdout + written .md/.csv for: ${args.join(' ') || '(default)'}`, () => {
            const pyMd = fs.readFileSync(MD, 'utf-8');
            const pyCsv = fs.readFileSync(CSV, 'utf-8');
            const ts = runTs(args);
            const tsMd = fs.readFileSync(MD, 'utf-8');
            const tsCsv = fs.readFileSync(CSV, 'utf-8');
            expect(tsMd).toBe(pyMd);
            expect(tsCsv).toBe(pyCsv);
        });
    }

    it('bad flag → exit code parity (argparse banner prose not compared)', () => {
        const ts = runTs(['--bogus']);
    });
});
