// Contract tests for src/scripts/measure_density.ts (py2ts Phase 8 / Wave 8c).
//
// The script reads the whole artifact corpus and prints a report (default) or
// deterministic JSON (--json); --snapshot writes JSONL to the gitignored
// agents/runtime/density/snapshot.jsonl. The tsx twin is the source of truth
// (the python original was deleted in the teardown). Runs in-process via
// runInProc (no tsx cold-start per call) for speed.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { main } from '../../src/scripts/measure_density.js';
import { runInProc } from '../_lib/run_in_process.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SNAPSHOT = path.join(REPO_ROOT, 'agents', 'runtime', 'density', 'snapshot.jsonl');

const runTs = (args: string[]) => runInProc(main, args);

describe('measure_density — CLI contract', () => {
    it('default + --json run deterministically over the repo (exit 0)', () => {
        for (const args of [[], ['--json']]) {
            const a = runTs(args);
            expect(a.status, `${args.join(' ')}: ${a.stderr}`).toBe(0);
            expect(a.stdout.length).toBeGreaterThan(0);
        }
        expect(() => JSON.parse(runTs(['--json']).stdout)).not.toThrow();
    });

    it('--snapshot writes valid JSONL (gitignored path; restored)', () => {
        const before = fs.existsSync(SNAPSHOT) ? fs.readFileSync(SNAPSHOT) : null;
        try {
            const ts = runTs(['--snapshot']);
            expect(ts.status, ts.stderr).toBe(0);
            const bytes = fs.readFileSync(SNAPSHOT, 'utf-8');
            expect(bytes.length).toBeGreaterThan(0);
            for (const line of bytes.trim().split('\n')) {
                expect(() => JSON.parse(line)).not.toThrow();
            }
        } finally {
            if (before !== null) {
                fs.writeFileSync(SNAPSHOT, before);
            } else if (fs.existsSync(SNAPSHOT)) {
                fs.rmSync(SNAPSHOT);
            }
        }
    });
});
