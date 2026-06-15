// Golden-parity tests for work_engine/input_builders.ts vs input_builders.py
// (ADR-096 py2ts Phase 1 — work_engine TOP/integration layer).
//
// `input_builders.py` reaches across the package (cli_args, errors, intent,
// resolvers, state, state_io), so the parity rig runs it through the real
// `work_engine` package on sys.path. Each builder is driven from a temp input
// file on both engines; the resulting WorkState is serialised via
// `state.to_dict` and compared byte-for-byte (canonical json.dumps). The
// `_load_or_build` dispatch paths (existing state file → _load, mutual
// exclusion, no-input, ticket non-object) are exercised for behaviour parity.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ParsedArgs } from '../../../src/agent-src/templates/scripts/work_engine/cli_args.js';
import { _CLIError } from '../../../src/agent-src/templates/scripts/work_engine/errors.js';
import {
    _build_from_diff_file,
    _build_from_file_file,
    _build_from_prompt_file,
    _load_or_build,
} from '../../../src/agent-src/templates/scripts/work_engine/input_builders.js';
import { dump, to_dict, type WorkState } from '../../../src/agent-src/templates/scripts/work_engine/state.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ib-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

function baseArgs(over: Partial<ParsedArgs> = {}): ParsedArgs {
    return {
        state_file: path.join(tmp, '.work-state.json'),
        ticket_file: null,
        prompt_file: null,
        diff_file: null,
        file_file: null,
        persona: null,
        no_hooks: false,
        hooks_config: null,
        ...over,
    };
}

/** Canonical v1 JSON of the WorkState a TS builder produces. */
function tsCanonical(work: WorkState): string {
    return JSON.stringify(to_dict(work), null, 2);
}

/**
 * Run a builder on python3 from the same input file, returning the canonical
 * v1 JSON of the resulting WorkState (state.to_dict). `argName` is the flag
 * (ticket_file / prompt_file / diff_file / file_file) and `builder` the
 * function name in input_builders.
 */
function pyBuild(builder: string, argName: string, inputPath: string, persona: string | null): string {
    const code = [
        'import sys, json, argparse, pathlib',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        'from work_engine import input_builders as ib',
        'from work_engine import state as st',
        'ns = argparse.Namespace(state_file=None, ticket_file=None, prompt_file=None, diff_file=None, file_file=None, persona=None, no_hooks=False, hooks_config=None)',
        `setattr(ns, ${JSON.stringify(argName)}, pathlib.Path(sys.argv[1]))`,
        'ns.persona = json.loads(sys.argv[2])',
        `work = getattr(ib, ${JSON.stringify(builder)})(ns)`,
        'sys.stdout.write(json.dumps(st.to_dict(work), indent=2, ensure_ascii=False))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code, inputPath, JSON.stringify(persona)], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

describeParity('builders — byte parity vs python3', () => {
    it('ticket file → v0 WorkState (via _load_or_build)', () => {
        const tf = path.join(tmp, 'ticket.json');
        fs.writeFileSync(tf, JSON.stringify({ id: 'T-1', title: 'Add CSV export' }), 'utf-8');
        const [work] = _load_or_build(baseArgs().state_file, baseArgs({ ticket_file: tf }));

        // Python via _load_or_build too (state file absent).
        const code = [
            'import sys, json, argparse, pathlib',
            `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
            'from work_engine import input_builders as ib',
            'from work_engine import state as st',
            'ns = argparse.Namespace(state_file=pathlib.Path(sys.argv[2]), ticket_file=pathlib.Path(sys.argv[1]), prompt_file=None, diff_file=None, file_file=None, persona=None, no_hooks=False, hooks_config=None)',
            'work, fmt = ib._load_or_build(pathlib.Path(sys.argv[2]), ns)',
            'sys.stdout.write(json.dumps({"fmt": fmt, "state": st.to_dict(work)}, indent=2, ensure_ascii=False))',
        ].join('\n');
        const r = spawnSync('python3', ['-c', code, tf, path.join(tmp, 'absent-state.json')], { encoding: 'utf8' });
        expect(r.status).toBe(0);
        const pyOut = JSON.parse(r.stdout) as { fmt: string; state: unknown };
        expect(pyOut.fmt).toBe('v0');
        expect(tsCanonical(work)).toBe(JSON.stringify(pyOut.state, null, 2));
    });

    it('prompt file → prompt envelope', () => {
        const pf = path.join(tmp, 'prompt.txt');
        fs.writeFileSync(pf, 'Build a settings page with a dark-mode toggle', 'utf-8');
        const work = _build_from_prompt_file(baseArgs({ prompt_file: pf }));
        expect(tsCanonical(work)).toBe(pyBuild('_build_from_prompt_file', 'prompt_file', pf, null));
    });

    it('diff file → diff envelope', () => {
        const df = path.join(tmp, 'change.diff');
        fs.writeFileSync(df, '--- a/x.tsx\n+++ b/x.tsx\n@@ -1 +1 @@\n-old\n+new\n', 'utf-8');
        const work = _build_from_diff_file(baseArgs({ diff_file: df }));
        expect(tsCanonical(work)).toBe(pyBuild('_build_from_diff_file', 'diff_file', df, null));
    });

    it('file file → file envelope (first line only)', () => {
        const ff = path.join(tmp, 'ref.txt');
        fs.writeFileSync(ff, 'src/components/Button.tsx\nignored second line\n', 'utf-8');
        const work = _build_from_file_file(baseArgs({ file_file: ff }));
        expect(tsCanonical(work)).toBe(pyBuild('_build_from_file_file', 'file_file', ff, null));
    });

    it('persona override flows into the WorkState', () => {
        const pf = path.join(tmp, 'p2.txt');
        fs.writeFileSync(pf, 'A prompt', 'utf-8');
        const work = _build_from_prompt_file(baseArgs({ prompt_file: pf, persona: 'qa' }));
        expect(work.persona).toBe('qa');
        expect(tsCanonical(work)).toBe(pyBuild('_build_from_prompt_file', 'prompt_file', pf, 'qa'));
    });
});

describe('_load_or_build — dispatch behaviour', () => {
    it('loads an existing state file (format-preserving)', () => {
        // Build a v0 ticket state first, then re-load it.
        const tf = path.join(tmp, 't.json');
        fs.writeFileSync(tf, JSON.stringify({ id: 'T', title: 'x' }), 'utf-8');
        const sf = path.join(tmp, '.work-state.json');
        const [built, fmt] = _load_or_build(sf, baseArgs({ state_file: sf, ticket_file: tf }));
        expect(fmt).toBe('v0');
        dump(built, sf);
        const [loaded, fmt2] = _load_or_build(sf, baseArgs({ state_file: sf }));
        // Round-trip: a v0 file persisted via dump becomes v1 (dump always
        // writes the v1 envelope); _load re-reads it as v1.
        expect(fmt2).toBe('v1');
        expect(loaded.input.kind).toBe('ticket');
    });

    it('rejects two input flags as mutually exclusive', () => {
        const a = path.join(tmp, 'a.json');
        const b = path.join(tmp, 'b.txt');
        fs.writeFileSync(a, '{}', 'utf-8');
        fs.writeFileSync(b, 'p', 'utf-8');
        expect(() =>
            _load_or_build(path.join(tmp, 'none.json'), baseArgs({ ticket_file: a, prompt_file: b })),
        ).toThrow(_CLIError);
    });

    it('rejects no input when no state file exists', () => {
        expect(() => _load_or_build(path.join(tmp, 'none.json'), baseArgs())).toThrow(_CLIError);
    });

    it('rejects a non-object ticket file', () => {
        const tf = path.join(tmp, 'arr.json');
        fs.writeFileSync(tf, '[1, 2, 3]', 'utf-8');
        expect(() =>
            _load_or_build(path.join(tmp, 'none.json'), baseArgs({ ticket_file: tf })),
        ).toThrow(_CLIError);
    });
});
