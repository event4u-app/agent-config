/**
 * The doors name `analysis_validate.ts` and `analysis_run_record.ts` as stages
 * the agent runs; each needs a command-line entry a door can call, or the
 * deterministic gate and the run record are reachable only through ad-hoc code.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRun, transition, RUN_STATES, type ForwardState, type RunRecord } from '../../src/scripts/analysis_run.js';
import { buildRunJson, writeRunJson } from '../../src/scripts/analysis_run_record.js';
import { main as recordMain } from '../../src/scripts/analysis_run_record.js';
import { main as validateMain } from '../../src/scripts/analysis_validate.js';

let root: string;
let out: string[];

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-stage-cli-'));
    out = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => (out.push(String(s)), true));
    vi.spyOn(process.stderr, 'write').mockImplementation((s) => (out.push(String(s)), true));
});

afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
});

function runAt(state: ForwardState): { runDir: string; record: RunRecord } {
    let { runDir, record } = createRun(root, { runId: 'run-x', pins: { head: 'a'.repeat(40) }, tokenCap: 1000 });
    for (const s of RUN_STATES.slice(1, RUN_STATES.indexOf(state) + 1)) record = transition(runDir, record, s);
    return { runDir, record };
}

describe('analysis_validate main', () => {
    it('refuses a run that is not in emitted, naming its state', () => {
        const { runDir } = runAt('judged');
        expect(validateMain(['--run', runDir, '--root', root, '--content-only'])).toBe(2);
        expect(out.join('')).toContain('judged');
    });

    it('moves an emitted run with clean files to validated, without the tree gates under --content-only', () => {
        const { runDir } = runAt('emitted');
        expect(validateMain(['--run', runDir, '--root', root, '--content-only'])).toBe(0);
        expect(JSON.parse(fs.readFileSync(path.join(runDir, 'run-state.json'), 'utf8')).state).toBe('validated');
    });

    it('names each content failure and leaves the run in emitted', () => {
        const { runDir } = runAt('emitted');
        const f = path.join(root, 'road-to-x.md');
        fs.writeFileSync(f, '# x\n\n## Phase 1 — y\n\nNo anchor.\n\n- [ ] **1.1 do it.**\n');
        expect(validateMain(['--run', runDir, '--root', root, '--content-only', f])).toBe(1);
        expect(out.join('')).toContain('no verify: line');
        expect(JSON.parse(fs.readFileSync(path.join(runDir, 'run-state.json'), 'utf8')).state).toBe('emitted');
    });
});

describe('analysis_run_record main', () => {
    it('reads a valid run.json and prints its summary', () => {
        const { runDir } = runAt('validated');
        writeRunJson(runDir, buildRunJson({
            run_id: 'run-x', door: 'inbox', started_at: '2026-10-19T00:00:00Z', ended_at: '2026-10-19T00:01:00Z', final_state: 'validated',
            analysts: [], exchange: null, gain: { offered: false, band: 'low', reason: 'no-plannable-item' },
            seats: { used: [], failed: [] }, roadmaps_emitted: [], recurrence_hits: 0, ci_rounds: 0, turnaround: null,
        }));
        expect(recordMain(['--run', runDir])).toBe(0);
        expect(out.join('')).toContain('run-x · inbox · validated');
    });

    it('fails on a missing or invalid run.json', () => {
        const { runDir } = runAt('validated');
        expect(recordMain(['--run', runDir])).toBe(1);
        fs.writeFileSync(path.join(runDir, 'run.json'), '{"schema_version":"1.0"}');
        expect(recordMain(['--run', runDir])).toBe(1);
        expect(out.join('')).toContain('run_id is required');
    });
});
