// Golden-parity tests for work_engine/errors.ts vs errors.py (ADR-094 py2ts
// Phase 1). errors is a leaf module: one exception class `_CLIError` whose only
// contract is "is an Error subclass, carries its message, name is `_CLIError`".
// The Python side is loaded via a direct-file importlib loader (the work_engine
// dir + repo root are added to sys.path so the `from __future__ import
// annotations` header and any sibling imports resolve). The TS side imports the
// twin directly. No `--help` / prose surface here.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { _CLIError } from '../../../src/agent-src/templates/scripts/work_engine/errors.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

// Direct-file importlib loader: register the module in sys.modules BEFORE
// exec_module (CPython 3.9 dataclass `__module__` lookup needs it) and add the
// work_engine dir + repo root to sys.path so intra-package + dispatch_hook
// imports resolve. Shared verbatim by every work_engine parity test.
function pyLoaderPreamble(): string {
    return [
        'import importlib.util, sys, json, pathlib',
        `WE = pathlib.Path(${JSON.stringify(WE)})`,
        `REPO = pathlib.Path(${JSON.stringify(REPO_ROOT)})`,
        'sys.path.insert(0, str(WE)); sys.path.insert(0, str(REPO))',
        'def _load(name):',
        '    sp = importlib.util.spec_from_file_location("we_"+name, WE / (name + ".py"))',
        '    m = importlib.util.module_from_spec(sp)',
        '    sys.modules[sp.name] = m',
        '    sp.loader.exec_module(m)',
        '    return m',
    ].join('\n');
}

function py(body: string): string {
    const code = `${pyLoaderPreamble()}\n${body}`;
    const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr}`);
    }
    return r.stdout.trim();
}

describe('work_engine/errors — _CLIError', () => {
    it('is an Error subclass carrying its message', () => {
        const e = new _CLIError('boom');
        expect(e).toBeInstanceOf(Error);
        expect(e).toBeInstanceOf(_CLIError);
        expect(e.message).toBe('boom');
        expect(e.name).toBe('_CLIError');
    });

    it('throws and is catchable as _CLIError', () => {
        expect(() => {
            throw new _CLIError('cfg problem');
        }).toThrow(_CLIError);
    });

    it('empty message round-trips', () => {
        const e = new _CLIError();
        expect(e.message).toBe('');
        expect(e).toBeInstanceOf(_CLIError);
    });

    describe.runIf(hasPython3())('python parity', () => {
        it('name + message match CPython', () => {
            const oracle = py(
                'm=_load("errors")\n' +
                    'e=m._CLIError("cfg problem")\n' +
                    'print(json.dumps({"name": type(e).__name__, "msg": str(e), ' +
                    '"is_exc": isinstance(e, Exception)}))',
            );
            const expected = JSON.parse(oracle) as { name: string; msg: string; is_exc: boolean };
            const e = new _CLIError('cfg problem');
            expect(e.name).toBe(expected.name);
            expect(e.message).toBe(expected.msg);
            expect(e instanceof Error).toBe(expected.is_exc);
        });

        it('exports exactly _CLIError in __all__', () => {
            const oracle = py('m=_load("errors")\nprint(json.dumps(m.__all__))');
            expect(JSON.parse(oracle)).toEqual(['_CLIError']);
        });
    });
});
