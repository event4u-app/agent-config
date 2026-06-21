// Golden-parity tests for work_engine/migration/v0_to_v1.ts vs v0_to_v1.py
// (ADR-096 py2ts Phase 1 — work_engine TOP/integration layer).
//
// `v0_to_v1.py` imports `..state` (SchemaError + the engine defaults), so the
// direct-file importlib loader is not enough — we add
// `src/agent-src/templates/scripts` to `sys.path` and
// `import work_engine.migration.v0_to_v1` as a real package member (the
// package `__init__`s pull in still-Python siblings, all present until the
// Phase-12 sweep). The TS twin runs in-process; the Python original via a
// python3 subprocess.
//
// Coverage: migrate_payload (v0 wrap, v1 idempotent deep-copy, every
// SchemaError path), migrate_file round-trip (default destination, --no-backup,
// backup rotation, refuse-overwrite, missing source, invalid JSON), and the
// CLI main() success + error exit codes. Non-determinism: temp dirs are created
// per-test and removed; on-disk bytes are compared byte-for-byte.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    BACKUP_SUFFIX,
    DEFAULT_V0_FILENAME,
    DEFAULT_V1_FILENAME,
    main,
    migrate_file,
    migrate_payload,
} from '../../../src/agent-src/templates/scripts/work_engine/migration/v0_to_v1.js';
import { SchemaError } from '../../../src/agent-src/templates/scripts/work_engine/state.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Run `migrate_payload` on python3; emit canonical JSON or `ERR:<msg>`. */
function pyMigratePayload(payloadJson: string): string {
    const code = [
        'import sys, json',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        'from work_engine.migration.v0_to_v1 import migrate_payload',
        'from work_engine.state import SchemaError',
        'payload = json.loads(sys.argv[1])',
        'try:',
        '    out = migrate_payload(payload)',
        '    sys.stdout.write(json.dumps(out, indent=2, ensure_ascii=False))',
        'except SchemaError as exc:',
        '    sys.stdout.write("ERR:" + str(exc))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code, payloadJson], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

/** TS `migrate_payload`; emit canonical JSON or `ERR:<msg>`. */
function tsMigratePayload(payloadJson: string): string {
    try {
        const out = migrate_payload(JSON.parse(payloadJson));
        return JSON.stringify(out, null, 2);
    } catch (exc) {
        if (exc instanceof SchemaError) {
            return 'ERR:' + exc.message;
        }
        throw exc;
    }
}

/**
 * Run the migration CLI on python3 in `cwd`. Emits
 * `<exit>\n<stdout>\n--STDERR--\n<stderr>`.
 */
function pyCli(cwd: string, argv: string[]): { status: number; stdout: string; stderr: string } {
    const code = [
        'import sys',
        `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
        'from work_engine.migration.v0_to_v1 import main',
        'sys.exit(main(sys.argv[1:]))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code, ...argv], { encoding: 'utf8', cwd });
    return { status: r.status ?? 0, stdout: r.stdout, stderr: r.stderr };
}

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v0to1-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

describe('migrate_payload — constants', () => {
    it('exposes the canonical filenames + suffix', () => {
        expect(DEFAULT_V0_FILENAME).toBe('.implement-ticket-state.json');
        expect(DEFAULT_V1_FILENAME).toBe('.work-state.json');
        expect(BACKUP_SUFFIX).toBe('.bak');
    });
});

const PAYLOAD_FIXTURES: Array<[string, string]> = [
    ['minimal v0', JSON.stringify({ ticket: { id: 'T-1', title: 'Do thing' } })],
    [
        'full v0',
        JSON.stringify({
            ticket: { id: 'T-9', title: 'Big' },
            persona: 'qa',
            memory: [{ a: 1 }],
            plan: 'the plan',
            changes: [{ file: 'x.ts' }],
            tests: 'ran',
            verify: 'ok',
            outcomes: { refine: 'success' },
            questions: ['q1'],
            report: 'done',
        }),
    ],
    ['v1 idempotent', JSON.stringify({ version: 1, input: { kind: 'ticket', data: { id: 'T' } }, intent: 'backend-coding', directive_set: 'backend', persona: 'senior-engineer', memory: [], plan: null, changes: [], tests: null, verify: null, outcomes: {}, questions: [], report: '' })],
    ['non-dict payload', JSON.stringify([1, 2, 3])],
    ['higher version', JSON.stringify({ version: 99, ticket: {} })],
    ['missing ticket', JSON.stringify({ persona: 'qa', plan: 'x' })],
    ['non-dict ticket', JSON.stringify({ ticket: [1, 2] })],
    ['unicode preserved', JSON.stringify({ ticket: { title: 'café ☕ é' } })],
];

describeParity('migrate_payload — golden parity', () => {
    for (const [name, fixture] of PAYLOAD_FIXTURES) {
        it(`${name} matches python3`, () => {
            expect(tsMigratePayload(fixture)).toBe(pyMigratePayload(fixture));
        });
    }
});

describe('migrate_file — round-trip', () => {
    it('writes v1 next to the source and backs up the v0 file', () => {
        const src = path.join(tmp, DEFAULT_V0_FILENAME);
        fs.writeFileSync(src, JSON.stringify({ ticket: { id: 'T-1', title: 'Do' } }), 'utf-8');
        const target = migrate_file(src);
        expect(target).toBe(path.join(tmp, DEFAULT_V1_FILENAME));
        expect(fs.existsSync(target)).toBe(true);
        expect(fs.existsSync(src)).toBe(false);
        expect(fs.existsSync(src + BACKUP_SUFFIX)).toBe(true);
        // Trailing newline contract.
        expect(fs.readFileSync(target, 'utf-8').endsWith('\n')).toBe(true);
    });

    it('--no-backup leaves the source in place', () => {
        const src = path.join(tmp, DEFAULT_V0_FILENAME);
        fs.writeFileSync(src, JSON.stringify({ ticket: { id: 'T-2' } }), 'utf-8');
        migrate_file(src, { backup: false });
        expect(fs.existsSync(src)).toBe(true);
    });

    it('rotates the backup when .bak is taken', () => {
        const src = path.join(tmp, DEFAULT_V0_FILENAME);
        fs.writeFileSync(src, JSON.stringify({ ticket: { id: 'T-3' } }), 'utf-8');
        fs.writeFileSync(src + BACKUP_SUFFIX, 'old', 'utf-8');
        migrate_file(src);
        expect(fs.existsSync(src + BACKUP_SUFFIX + '.1')).toBe(true);
    });

    it('refuses to overwrite an existing destination', () => {
        const src = path.join(tmp, DEFAULT_V0_FILENAME);
        const dst = path.join(tmp, DEFAULT_V1_FILENAME);
        fs.writeFileSync(src, JSON.stringify({ ticket: { id: 'T-4' } }), 'utf-8');
        fs.writeFileSync(dst, '{}', 'utf-8');
        expect(() => migrate_file(src)).toThrow(SchemaError);
    });

    it('raises on a missing source', () => {
        expect(() => migrate_file(path.join(tmp, 'nope.json'))).toThrow(SchemaError);
    });

    it('raises on invalid JSON', () => {
        const src = path.join(tmp, DEFAULT_V0_FILENAME);
        fs.writeFileSync(src, 'not json', 'utf-8');
        expect(() => migrate_file(src)).toThrow(SchemaError);
    });
});

describeParity('migrate_file — on-disk byte parity vs python3', () => {
    it('produces byte-identical v1 output on both engines', () => {
        const fixture = JSON.stringify({
            ticket: { id: 'T-7', title: 'Parity' },
            persona: 'qa',
            outcomes: { refine: 'success' },
        });

        // TS engine.
        const tsSrc = path.join(tmp, 'ts', DEFAULT_V0_FILENAME);
        fs.mkdirSync(path.dirname(tsSrc), { recursive: true });
        fs.writeFileSync(tsSrc, fixture, 'utf-8');
        const tsTarget = migrate_file(tsSrc);
        const tsBytes = fs.readFileSync(tsTarget, 'utf-8');

        // Python engine, separate dir.
        const pyDir = path.join(tmp, 'py');
        fs.mkdirSync(pyDir, { recursive: true });
        fs.writeFileSync(path.join(pyDir, DEFAULT_V0_FILENAME), fixture, 'utf-8');
        const r = pyCli(pyDir, [DEFAULT_V0_FILENAME]);
        expect(r.status).toBe(0);
        const pyBytes = fs.readFileSync(path.join(pyDir, DEFAULT_V1_FILENAME), 'utf-8');

        expect(tsBytes).toBe(pyBytes);
    });
});

describeParity('main — CLI exit codes', () => {
    it('exits 0 and prints the migration line on success', () => {
        const pyDir = path.join(tmp, 'pyok');
        fs.mkdirSync(pyDir, { recursive: true });
        fs.writeFileSync(path.join(pyDir, DEFAULT_V0_FILENAME), JSON.stringify({ ticket: { id: 'X' } }), 'utf-8');
        const r = pyCli(pyDir, [DEFAULT_V0_FILENAME]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('migrated');

        // TS main() in the same shape.
        const tsDir = path.join(tmp, 'tsok');
        fs.mkdirSync(tsDir, { recursive: true });
        const tsSrc = path.join(tsDir, DEFAULT_V0_FILENAME);
        fs.writeFileSync(tsSrc, JSON.stringify({ ticket: { id: 'X' } }), 'utf-8');
        const rc = main([tsSrc]);
        expect(rc).toBe(0);
    });

    it('exits 2 on a missing source', () => {
        const pyDir = path.join(tmp, 'pyerr');
        fs.mkdirSync(pyDir, { recursive: true });
        const r = pyCli(pyDir, ['nonexistent.json']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('error:');

        const rc = main([path.join(tmp, 'also-missing.json')]);
        expect(rc).toBe(2);
    });
});
