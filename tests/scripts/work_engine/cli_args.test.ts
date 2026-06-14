// Golden-parity tests for work_engine/cli_args.ts vs cli_args.py (ADR-094 py2ts
// Phase 1). The Python source exposes `_build_parser()` returning an argparse
// parser; the TS twin exposes `parse_args(argv)` mirroring argparse's runtime
// behaviour for the declared flags. We compare the parsed NAMESPACE (paths as
// strings, snake_case dests) and the EXIT CODE on every path — but NOT the
// --help / error prose (ADR-094 explicitly excludes argparse help/usage text
// from byte-comparison; the contract is exit-code + namespace parity).
//
// argparse surfaces exercised: long-option prefix abbreviation (unambiguous →
// expand; ambiguous → exit 2; --help in the candidate set), `--flag=value` /
// `--flag value`, store_true flags, explicit-value-on-store_true → exit 2,
// missing value → exit 2, unknown flag → exit 2, -h/--help → exit 0.
//
// Python runs via a child process that catches SystemExit and prints either the
// namespace JSON (success) or `EXIT <code>`; the work_engine module is loaded
// with the shared direct-file importlib loader.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    ArgparseExit,
    DEFAULT_STATE_FILE,
    LEGACY_STATE_FILE,
    _FMT_V0,
    _FMT_V1,
    parse_args,
    type ParsedArgs,
} from '../../../src/agent-src/templates/scripts/work_engine/cli_args.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Run the Python parser on `argv`; return the namespace dict or the exit code. */
function pyParse(argv: string[]): { ok: true; ns: Record<string, unknown> } | { ok: false; code: number } {
    const code = [
        'import importlib.util, sys, json, pathlib',
        `WE = pathlib.Path(${JSON.stringify(WE)})`,
        `REPO = pathlib.Path(${JSON.stringify(REPO_ROOT)})`,
        'sys.path.insert(0, str(WE)); sys.path.insert(0, str(REPO))',
        'sp = importlib.util.spec_from_file_location("we_cli_args", WE / "cli_args.py")',
        'm = importlib.util.module_from_spec(sp); sys.modules[sp.name] = m; sp.loader.exec_module(m)',
        'argv = json.loads(sys.argv[1])',
        'p = m._build_parser()',
        'import io, contextlib',
        // Suppress argparse's --help / usage / error prose (NOT a parity
        // surface, ADR-094) so only our OK/EXIT marker reaches the captured
        // stdout. The marker is written to the real stdout fd after the
        // redirect block exits.
        'marker = None',
        'try:',
        '    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):',
        '        ns = p.parse_args(argv)',
        '    d = {k: (str(v) if isinstance(v, pathlib.Path) else v) for k, v in vars(ns).items()}',
        '    marker = "OK\\t" + json.dumps(d)',
        'except SystemExit as e:',
        '    marker = "EXIT\\t" + str(int(e.code or 0))',
        'print(marker)',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code, JSON.stringify(argv)], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 crashed (status ${r.status}): ${r.stderr}`);
    }
    const out = r.stdout.trim();
    if (out.startsWith('OK\t')) {
        return { ok: true, ns: JSON.parse(out.slice(3)) as Record<string, unknown> };
    }
    return { ok: false, code: parseInt(out.slice(5), 10) };
}

/** Run the TS parser on `argv`; return the namespace or the exit code. */
function tsParse(argv: string[]): { ok: true; ns: ParsedArgs } | { ok: false; code: number } {
    const prev = process.exitCode;
    process.exitCode = undefined;
    try {
        const ns = parse_args(argv);
        return { ok: true, ns };
    } catch (e) {
        if (e instanceof ArgparseExit) {
            return { ok: false, code: e.code };
        }
        throw e;
    } finally {
        process.exitCode = prev;
    }
}

describe('work_engine/cli_args', () => {
    afterEach(() => {
        process.exitCode = undefined;
    });

    it('constants match the contract', () => {
        expect(DEFAULT_STATE_FILE).toBe('.work-state.json');
        expect(LEGACY_STATE_FILE).toBe('.implement-ticket-state.json');
        expect(_FMT_V0).toBe('v0');
        expect(_FMT_V1).toBe('v1');
    });

    it('no args → all defaults', () => {
        const r = tsParse([]);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.ns).toEqual({
                state_file: '.work-state.json',
                ticket_file: null,
                prompt_file: null,
                diff_file: null,
                file_file: null,
                persona: null,
                no_hooks: false,
                hooks_config: null,
            });
        }
    });

    it('store_true flag + value flag (space form)', () => {
        const r = tsParse(['--no-hooks', '--state-file', 'x.json']);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.ns.no_hooks).toBe(true);
            expect(r.ns.state_file).toBe('x.json');
        }
    });

    it('--flag=value form', () => {
        const r = tsParse(['--ticket-file=t.json', '--persona=qa']);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.ns.ticket_file).toBe('t.json');
            expect(r.ns.persona).toBe('qa');
        }
    });

    it('unambiguous prefix abbreviation expands', () => {
        const r = tsParse(['--state', 'a.json', '--no']);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.ns.state_file).toBe('a.json');
            expect(r.ns.no_hooks).toBe(true);
        }
    });

    it('ambiguous prefix → exit 2', () => {
        // --p matches --prompt-file / --persona.
        const r = tsParse(['--p', 'x']);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.code).toBe(2);
        }
    });

    it('unknown flag → exit 2', () => {
        const r = tsParse(['--bogus']);
        expect(r).toEqual({ ok: false, code: 2 });
    });

    it('missing value → exit 2', () => {
        const r = tsParse(['--state-file']);
        expect(r).toEqual({ ok: false, code: 2 });
    });

    it('explicit value on store_true → exit 2', () => {
        const r = tsParse(['--no-hooks=x']);
        expect(r).toEqual({ ok: false, code: 2 });
    });

    it('-h / --help → exit 0', () => {
        expect(tsParse(['-h'])).toEqual({ ok: false, code: 0 });
        expect(tsParse(['--help'])).toEqual({ ok: false, code: 0 });
    });

    describe.runIf(hasPython3())('python parity', () => {
        // Cases that should parse cleanly. Compare the whole namespace.
        const okCases: string[][] = [
            [],
            ['--no-hooks'],
            ['--state-file', 'x.json'],
            ['--state-file=y.json'],
            ['--ticket-file', 't.json', '--persona', 'qa'],
            ['--prompt-file', 'p.txt'],
            ['--diff-file', 'd.patch'],
            ['--file-file', 'f.txt'],
            ['--hooks-config', '.agent-settings.yml', '--no-hooks'],
            ['--state', 'abbrev.json'], // unambiguous prefix
            ['--no'], // unambiguous prefix → --no-hooks
            ['--pr', 'q.txt'], // --pr → --prompt-file (unambiguous)
        ];

        it.each(okCases.map((c) => [JSON.stringify(c), c] as [string, string[]]))(
            'namespace parity for argv=%s',
            (_label, argv) => {
                const expected = pyParse(argv);
                const got = tsParse(argv);
                expect(expected.ok).toBe(true);
                expect(got.ok).toBe(true);
                if (expected.ok && got.ok) {
                    expect(got.ns).toEqual(expected.ns);
                }
            },
        );

        // Cases that should exit 2. Compare the exit code only (not prose).
        const exit2Cases: string[][] = [
            ['--bogus'],
            ['--state-file'], // missing value
            ['--no-hooks=x'], // explicit value on store_true
            ['--p', 'x'], // ambiguous abbreviation
            ['extra-positional'],
            ['--ticket-file'], // missing value
            ['-x'], // unknown short
        ];

        it.each(exit2Cases.map((c) => [JSON.stringify(c), c] as [string, string[]]))(
            'exit-2 parity for argv=%s',
            (_label, argv) => {
                const expected = pyParse(argv);
                const got = tsParse(argv);
                expect(expected.ok).toBe(false);
                expect(got.ok).toBe(false);
                if (!expected.ok && !got.ok) {
                    expect(got.code).toBe(expected.code);
                    expect(got.code).toBe(2);
                }
            },
        );

        const helpCases: string[][] = [['-h'], ['--help']];
        it.each(helpCases.map((c) => [JSON.stringify(c), c] as [string, string[]]))(
            'help exit-0 parity for argv=%s',
            (_label, argv) => {
                const expected = pyParse(argv);
                const got = tsParse(argv);
                expect(expected.ok).toBe(false);
                expect(got.ok).toBe(false);
                if (!expected.ok && !got.ok) {
                    expect(got.code).toBe(expected.code);
                    expect(got.code).toBe(0);
                }
            },
        );
    });
});
