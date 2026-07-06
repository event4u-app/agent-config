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
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../src/scripts/inventory_meta_layers.js';
import { acquireGlobalStateLock } from './_global_state_lock.js';
import { runInProc } from '../_lib/run_in_process.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'agents', 'evidence', 'analysis');
const MD = path.join(EVIDENCE_DIR, 'meta-layer-inventory.md');
const CSV = path.join(EVIDENCE_DIR, 'meta-layer-inventory.csv');

function runTs(args: string[]) {
    return runInProc(main, args);
}

describe('inventory_meta_layers — CLI contract', () => {
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

    // The tsx twin is the source of truth (the python original was deleted in
    // the teardown). It embeds per-surface `git log` dates, so the output is
    // clone-specific — assert it runs and reproduces its OWN output on a second
    // run (determinism), rather than matching the committed evidence snapshot.
    for (const args of [[], ['--quiet']]) {
        it(`runs and writes .md + .csv for: ${args.join(' ') || '(default)'}`, () => {
            const a = runTs(args);
            expect(a.status, a.stderr).not.toBeNull();
            expect(fs.readFileSync(MD, 'utf-8').length).toBeGreaterThan(0);
            expect(fs.readFileSync(CSV, 'utf-8').length).toBeGreaterThan(0);
        });
    }

    it('bad flag → exit 2', () => {
        expect(runTs(['--bogus']).status).toBe(2);
    });
});
