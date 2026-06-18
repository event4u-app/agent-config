// Pure-TS coverage for the v0 `.implement-ticket-state.json` →
// `.work-state.json` migration action of `agent-config migrate`
// (ADR-200 py2ts). The golden-parity suite in `cmd_migrate.test.ts` does NOT
// exercise the v0 state-file migration; this twin closes that gap, porting the
// state-migration assertions of tests/migrate/test_unified_migrate.py
// (`test_full_apply_sweeps_every_signal` + `test_dry_run_does_not_mutate_filesystem`).
//
// Drives the exported `main(argv, { cwd, out })` directly — no python, no
// subprocess. The v0→v1 migrator is the shipped engine under
// `dist/agent-src/templates/scripts/work_engine/migration`, resolved by the
// command relative to its own module location.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../../src/scripts/_cli/cmd_migrate.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'acmig-v0state-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** Capturing OutSink (mirrors `m.main(out=io.StringIO())`). */
function capture(): { sink: { write: (t: string) => void }; text: () => string } {
    let buf = '';
    return { sink: { write: (t: string) => (buf += t) }, text: () => buf };
}

/** Stage a v0 `.implement-ticket-state.json` (the python fixture's signal #4). */
function makeV0State(project: string): void {
    fs.writeFileSync(
        path.join(project, '.implement-ticket-state.json'),
        JSON.stringify(
            {
                ticket: {
                    id: 'PROJ-123',
                    title: 'fixture ticket',
                    body: 'fixture body',
                    acceptance_criteria: ['AC-1'],
                },
            },
            null,
            2,
        ) + '\n',
        'utf-8',
    );
}

/** Snapshot every regular file + symlink content under `root` (dry-run guard). */
function snapshot(root: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (dir: string): void => {
        for (const name of fs.readdirSync(dir).sort()) {
            const p = path.join(dir, name);
            const rel = path.relative(root, p);
            const st = fs.lstatSync(p);
            if (st.isSymbolicLink()) {
                out[rel] = `symlink:${fs.readlinkSync(p)}`;
            } else if (st.isDirectory()) {
                out[rel] = '<dir>';
                walk(p);
            } else {
                out[rel] = fs.readFileSync(p, 'utf-8');
            }
        }
    };
    walk(root);
    return out;
}

describe('cmd_migrate — v0 .implement-ticket-state.json migration', () => {
    it('apply migrates v0 state → .work-state.json, preserves .bak, removes v0', () => {
        makeV0State(tmp);
        const cap = capture();
        const rc = main([], { cwd: tmp, out: cap.sink, err: cap.sink });
        const stdout = cap.text();
        expect(rc, stdout).toBe(0);

        // v0 state migrated; .bak preserved; v0 source gone.
        const v1 = path.join(tmp, '.work-state.json');
        expect(fs.statSync(v1).isFile()).toBe(true);
        expect(fs.existsSync(path.join(tmp, '.implement-ticket-state.json.bak'))).toBe(true);
        expect(fs.existsSync(path.join(tmp, '.implement-ticket-state.json'))).toBe(false);

        // v1 payload shape: version 1, ticket wrapped under input.kind/input.data.
        const v1Payload = JSON.parse(fs.readFileSync(v1, 'utf-8'));
        expect(v1Payload.version).toBe(1);
        expect(v1Payload.input.kind).toBe('ticket');
        expect(v1Payload.input.data.id).toBe('PROJ-123');

        // Summary lists the migration action by verb.
        expect(stdout).toContain('migrated .implement-ticket-state.json');
    });

    it('dry-run describes the migration in `would …` voice and mutates nothing', () => {
        makeV0State(tmp);
        const before = snapshot(tmp);
        const cap = capture();
        const rc = main(['--dry-run'], { cwd: tmp, out: cap.sink, err: cap.sink });
        const stdout = cap.text();
        expect(rc).toBe(0);
        // Byte-for-byte identical — no migration applied, no .bak written.
        expect(snapshot(tmp)).toEqual(before);
        expect(stdout).toContain('would migrate .implement-ticket-state.json');
    });

    it('--check on a v0-state legacy repo exits 2 + reports a pending action, no writes', () => {
        makeV0State(tmp);
        const before = snapshot(tmp);
        const cap = capture();
        const rc = main(['--check'], { cwd: tmp, out: cap.sink, err: cap.sink });
        const stdout = cap.text();
        expect(rc).toBe(2);
        expect(stdout).toContain('legacy install detected');
        expect(stdout).toContain('pending action(s)');
        // Probe must not mutate the filesystem.
        expect(snapshot(tmp)).toEqual(before);
    });
});
