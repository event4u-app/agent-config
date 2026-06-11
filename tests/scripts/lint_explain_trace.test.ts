// Tests for src/scripts/lint_explain_trace.ts (py2ts Phase 4 / Wave 4b).
//
// No tests/test_lint_explain_trace.py exists (the only Python coverage is the
// explain_last CLI builder under tests/cli/explain_last/, which does not
// exercise this linter). So this is a focused differential suite over the
// linter's subset-validator plus a golden-parity layer running python3 vs tsx
// on the REAL REPO schema (skipped without python3 / jsonschema).
//
// DOCUMENTED DIVERGENCE: on a malformed-JSON input both sides exit 2 and emit
// the same `❌  … is not valid JSON:` prefix, but the trailing parser-error
// text differs (CPython json vs V8 JSON.parse). The OK path, the validation
// messages (subset validator mirrors jsonschema wording), and all exit codes
// are byte-identical — asserted below.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as let_ from '../../src/scripts/lint_explain_trace.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_explain_trace.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'lint_explain_trace.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function hasJsonschema(): boolean {
    return spawnSync('python3', ['-c', 'import jsonschema'], { encoding: 'utf8' }).status === 0;
}

const SCHEMA = JSON.parse(
    fs.readFileSync(
        path.join(REPO_ROOT, 'docs', 'contracts', 'explain-trace.schema.json'),
        'utf-8',
    ),
) as Record<string, unknown>;

function validateLines(payload: unknown): string[] {
    const errors: { absolutePath: Array<string | number>; message: string }[] = [];
    let_._validate(payload, SCHEMA, [], errors);
    return errors.map(
        (e) => `${e.absolutePath.map((p) => String(p)).join('/') || '<root>'}: ${e.message}`,
    );
}

const VALID_TRACE = {
    version: 1,
    generated_at: '2026-06-11T00:00:00Z',
    run_id: 'run-1',
    subject: 'work',
    inputs: null,
    route: null,
    council: null,
    memory: null,
    pack: null,
    assumptions: [],
    halt: null,
    provider: null,
};

describe('lint_explain_trace._validate', () => {
    it('passes a valid v1 trace', () => {
        expect(validateLines(VALID_TRACE)).toEqual([]);
    });
    it('flags every missing required property, in schema order', () => {
        expect(validateLines({ version: 1 })).toEqual([
            "<root>: 'generated_at' is a required property",
            "<root>: 'run_id' is a required property",
            "<root>: 'subject' is a required property",
            "<root>: 'inputs' is a required property",
            "<root>: 'route' is a required property",
            "<root>: 'council' is a required property",
            "<root>: 'memory' is a required property",
            "<root>: 'pack' is a required property",
            "<root>: 'assumptions' is a required property",
            "<root>: 'halt' is a required property",
            "<root>: 'provider' is a required property",
        ]);
    });
    it('flags a wrong const', () => {
        expect(validateLines({ ...VALID_TRACE, version: 2 })).toEqual(['version: 1 was expected']);
    });
    it('flags a wrong enum', () => {
        expect(validateLines({ ...VALID_TRACE, subject: 'nope' })).toEqual([
            "subject: 'nope' is not one of ['work', 'implement-ticket', 'council', 'video', 'unknown']",
        ]);
    });
    it('flags an additional property', () => {
        expect(validateLines({ ...VALID_TRACE, extra: 1 })).toEqual([
            "<root>: Additional properties are not allowed ('extra' was unexpected)",
        ]);
    });
    it('flags an empty run_id via minLength', () => {
        expect(validateLines({ ...VALID_TRACE, run_id: '' })).toEqual([
            "run_id: '' should be non-empty",
        ]);
    });
    it('flags a single-type mismatch (type before const)', () => {
        expect(validateLines({ ...VALID_TRACE, version: 'x' })).toEqual([
            "version: 'x' is not of type 'integer'",
            'version: 1 was expected',
        ]);
    });
    it('flags an array-of-types mismatch with comma-joined types', () => {
        expect(validateLines({ ...VALID_TRACE, inputs: 5 })).toEqual([
            "inputs: 5 is not of type 'object', 'null'",
        ]);
    });
    it('recurses into array items', () => {
        expect(validateLines({ ...VALID_TRACE, assumptions: [{}] })).toEqual([
            "assumptions/0: 'id' is a required property",
            "assumptions/0: 'accepted' is a required property",
            "assumptions/0: 'source' is a required property",
        ]);
    });
});

describe('lint_explain_trace.parse_args', () => {
    it('defaults path=null, stdin=false', () => {
        expect(let_.parse_args([])).toEqual({ path: null, stdin: false });
    });
    it('reads a positional path', () => {
        expect(let_.parse_args(['a.json'])).toEqual({ path: 'a.json', stdin: false });
    });
    it('reads --stdin', () => {
        expect(let_.parse_args(['--stdin'])).toEqual({ path: null, stdin: true });
    });
});

// --- Golden parity on the REAL REPO schema ---------------------------------

const py3 = hasPython3() && hasJsonschema();

describe.skipIf(!py3)('lint_explain_trace — golden parity (python3 vs tsx)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'let-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function runPy(args: readonly string[], input?: string) {
        return spawnSync('python3', [PY_SCRIPT, ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            input,
        });
    }
    function runTs(args: readonly string[], input?: string) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            input,
        });
    }
    function same(args: readonly string[], input?: string): void {
        const py = runPy(args, input);
        const ts = runTs(args, input);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    function write(name: string, obj: unknown): string {
        const p = path.join(tmp, name);
        fs.writeFileSync(p, JSON.stringify(obj));
        return p;
    }

    it('valid trace (file) matches byte-for-byte (exit 0)', () => {
        same([write('ok.json', VALID_TRACE)]);
    });
    it('valid trace (--stdin) matches byte-for-byte (exit 0)', () => {
        same(['--stdin'], JSON.stringify(VALID_TRACE));
    });
    it('missing-required failure matches byte-for-byte (exit 1)', () => {
        same([write('bad.json', { version: 1 })]);
    });
    it('wrong-const failure matches byte-for-byte (exit 1)', () => {
        same([write('const.json', { ...VALID_TRACE, version: 2 })]);
    });
    it('wrong-enum failure matches byte-for-byte (exit 1)', () => {
        same([write('enum.json', { ...VALID_TRACE, subject: 'nope' })]);
    });
    it('additional-property failure matches byte-for-byte (exit 1)', () => {
        same([write('extra.json', { ...VALID_TRACE, extra: 1 })]);
    });
    it('minLength / nested-item failures match byte-for-byte (exit 1)', () => {
        same([write('nested.json', { ...VALID_TRACE, run_id: '', assumptions: [{}] })]);
    });
    it('no path / no --stdin invocation error matches (exit 2)', () => {
        same([]);
    });
    it('missing-file invocation error matches (exit 2)', () => {
        same([path.join(tmp, 'does-not-exist.json')]);
    });

    it('malformed JSON: exit 2 + stable prefix on both sides (DOCUMENTED DIVERGENCE on parser text)', () => {
        const py = runPy(['--stdin'], 'not json');
        const ts = runTs(['--stdin'], 'not json');
        expect(py.status).toBe(2);
        expect(ts.status).toBe(py.status);
        // The exit code + the stable prefix match; only the parser-error tail
        // diverges (CPython json vs V8 JSON.parse).
        expect(py.stderr.startsWith('❌  stdin is not valid JSON:')).toBe(true);
        expect(ts.stderr.startsWith('❌  stdin is not valid JSON:')).toBe(true);
    });
});
