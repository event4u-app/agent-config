// Tests for src/scripts/ai_council/modes.ts (py2ts Phase 1).
//
// Pure resolver — no I/O, no env. Golden-parity against the Python twin via a
// direct-file import (the package `__init__.py` pulls in networked client
// deps, so we exec the single module file with the name registered in
// sys.modules so its dataclass / `X | None` annotations resolve).
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
    DEFAULT_MODE,
    InvalidModeError,
    VALID_MODES,
    resolve_mode,
    resolve_modes,
} from '../../../src/scripts/ai_council/modes.js';

const PY_MOD = 'src/scripts/ai_council/modes.py';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Run a python snippet with `modes` loaded as the direct-file twin. */
function py(snippet: string): string {
    const code = [
        'import importlib.util, sys, json',
        `spec = importlib.util.spec_from_file_location("modes", ${JSON.stringify(PY_MOD)})`,
        'm = importlib.util.module_from_spec(spec)',
        'sys.modules["modes"] = m',
        'spec.loader.exec_module(m)',
        snippet,
    ].join('\n');
    const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr}`);
    }
    return r.stdout.trim();
}

describe('modes — constants', () => {
    it('VALID_MODES and DEFAULT_MODE match the Python contract', () => {
        expect(Array.from(VALID_MODES).sort()).toEqual(['api', 'cli', 'manual']);
        expect(DEFAULT_MODE).toBe('manual');
    });
});

describe('modes — resolve_mode precedence', () => {
    it('invocation flag wins (normalised + lowercased)', () => {
        expect(resolve_mode('anthropic', { invocationMode: '  API ' })).toBe('api');
    });

    it('per-member setting beats global', () => {
        expect(
            resolve_mode('openai', { memberSettings: { mode: 'CLI' }, globalMode: 'api' }),
        ).toBe('cli');
    });

    it('global used when no flag / member', () => {
        expect(resolve_mode('openai', { globalMode: 'manual' })).toBe('manual');
    });

    it('default manual when nothing set', () => {
        expect(resolve_mode('openai')).toBe('manual');
    });

    it('empty / whitespace / non-string layers normalise to null', () => {
        expect(resolve_mode('m', { invocationMode: '   ', memberSettings: { mode: '' } })).toBe(
            'manual',
        );
        expect(resolve_mode('m', { memberSettings: { mode: null }, globalMode: 'cli' })).toBe(
            'cli',
        );
    });

    it('invalid mode throws InvalidModeError with the Python message', () => {
        expect(() => resolve_mode('x', { invocationMode: 'bogus' })).toThrow(InvalidModeError);
        try {
            resolve_mode('x', { invocationMode: 'bogus' });
        } catch (e) {
            expect((e as Error).message).toBe(
                "/council mode= for 'x' requested mode='bogus'; expected one of: ['api', 'cli', 'manual']",
            );
        }
    });

    it('earliest layer validated first; later invalid layers not reached', () => {
        // invocation valid → member ignored even if it would be invalid.
        expect(resolve_mode('m', { invocationMode: 'api', memberSettings: { mode: 'nope' } })).toBe(
            'api',
        );
    });

    it('member-setting error message names the member path', () => {
        try {
            resolve_mode('openai', { memberSettings: { mode: 'nope' } });
        } catch (e) {
            expect((e as Error).message).toBe(
                "ai_council.members.openai.mode requested mode='nope'; expected one of: ['api', 'cli', 'manual']",
            );
        }
    });
});

describe('modes — resolve_modes batch', () => {
    it('forwards each member sub-dict', () => {
        expect(
            resolve_modes(['a', 'b', 'c'], {
                membersSettings: { a: { mode: 'cli' }, b: {} },
                globalMode: 'api',
            }),
        ).toEqual({ a: 'cli', b: 'api', c: 'api' });
    });

    it('empty members list → empty object', () => {
        expect(resolve_modes([])).toEqual({});
    });
});

describe.runIf(hasPython3())('modes — golden parity vs CPython twin', () => {
    const cases: Array<{ desc: string; tsCall: () => unknown; pyExpr: string }> = [
        {
            desc: 'invocation flag normalised',
            tsCall: () => resolve_mode('anthropic', { invocationMode: '  API ' }),
            pyExpr: "m.resolve_mode('anthropic', invocation_mode='  API ')",
        },
        {
            desc: 'member beats global',
            tsCall: () => resolve_mode('o', { memberSettings: { mode: 'CLI' }, globalMode: 'api' }),
            pyExpr: "m.resolve_mode('o', member_settings={'mode':'CLI'}, global_mode='api')",
        },
        {
            desc: 'default fallthrough',
            tsCall: () => resolve_mode('o'),
            pyExpr: "m.resolve_mode('o')",
        },
        {
            desc: 'batch resolve',
            tsCall: () =>
                resolve_modes(['a', 'b', 'c'], {
                    membersSettings: { a: { mode: 'cli' }, b: {} },
                    globalMode: 'api',
                }),
            pyExpr:
                "m.resolve_modes(['a','b','c'], members_settings={'a':{'mode':'cli'},'b':{}}, global_mode='api')",
        },
    ];

    it.each(cases)('$desc', ({ tsCall, pyExpr }) => {
        const expected = py(`print(json.dumps(${pyExpr}))`);
        expect(tsCall()).toEqual(JSON.parse(expected));
    });

    it('invalid-mode error message matches CPython', () => {
        const expected = py(
            "import traceback\n" +
                "try:\n" +
                "    m.resolve_mode('x', invocation_mode='bogus')\n" +
                "except m.InvalidModeError as e:\n" +
                "    print(str(e))",
        );
        try {
            resolve_mode('x', { invocationMode: 'bogus' });
            throw new Error('expected throw');
        } catch (e) {
            expect((e as Error).message).toBe(expected);
        }
    });
});
