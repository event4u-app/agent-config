
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
});
