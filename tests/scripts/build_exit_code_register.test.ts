/**
 * The exit-code register is generated, so its drift check is this file: the
 * committed `docs/contracts/exit-code-register.md` must equal what the generator
 * produces from the code right now, and the generator must refuse when the scan
 * and the declared meanings disagree in either direction.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    OUT_REL,
    PAIRS,
    build,
    checkPairs,
    main,
    render,
    scanCodes,
    type CommandSpec,
    type Row,
    type SurfacePair,
} from '../../src/scripts/build_exit_code_register.js';

const ROOT = path.resolve(__dirname, '..', '..');
const made: string[] = [];

function tree(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'exit-register-'));
    made.push(root);
    for (const [rel, body] of Object.entries(files)) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body);
    }
    return root;
}

afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
    vi.restoreAllMocks();
});

describe('exit-code register — drift', () => {
    it('the committed register is what the generator produces from the code', () => {
        const reg = build(ROOT);
        expect(reg.errors).toEqual([]);
        expect(fs.readFileSync(path.join(ROOT, OUT_REL), 'utf8')).toBe(render(reg));
    });

    it('records the installer`s 3 and its forwarding through sync', () => {
        const reg = build(ROOT);
        expect(reg.rows.get('init')?.map((r) => r.code)).toContain(3);
        expect(reg.rows.get('sync')?.find((r) => r.code === 3)?.emittedIn).toEqual(['via init']);
    });
});

describe('exit-code register — pairs that must agree', () => {
    it('publishes the installer/doctor pair against the real tree', () => {
        const reg = build(ROOT);
        expect(reg.errors).toEqual([]);
        const pair = reg.pairs.find((p) => p.surfaces.some((s) => s.verb === 'init' && s.code === 3));
        expect(pair?.surfaces.map((s) => `${s.verb}:${s.code}`)).toEqual(['init:3', 'doctor:1']);
        expect(fs.existsSync(path.join(ROOT, pair?.assertedIn ?? ''))).toBe(true);
        expect(render(reg)).toContain('## Pairs that must agree');
    });

    const rows = (spec: Record<string, number[]>): ReadonlyMap<string, readonly Row[]> =>
        new Map(
            Object.entries(spec).map(([verb, codes]) => [
                verb,
                codes.map((code) => ({ code, meaning: '', emittedIn: [] })),
            ]),
        );

    const pair: SurfacePair = {
        state: 'one state',
        surfaces: [
            { verb: 'init', code: 3 },
            { verb: 'doctor', code: 1 },
        ],
        assertedIn: 'the.test.ts',
        assertions: ['expect(a.status).toBe(3)', 'expect(b.status).toBe(1)'],
    };
    const asserting = 'expect(a.status).toBe(3);\nexpect(b.status).toBe(1);\n';

    it('fails when ONE side stops returning its code, and names which', () => {
        const root = tree({ 'the.test.ts': asserting });
        expect(checkPairs(root, rows({ init: [0, 3], doctor: [0, 1] }), [pair])).toEqual([]);
        expect(checkPairs(root, rows({ init: [0], doctor: [0, 1] }), [pair])).toEqual([
            'pair "one state": `init` no longer returns 3',
        ]);
        expect(checkPairs(root, rows({ init: [0, 3], doctor: [0] }), [pair])).toEqual([
            'pair "one state": `doctor` no longer returns 1',
        ]);
    });

    it('fails per surface when its assertion is deleted, naming the verb', () => {
        const noDoctor = tree({ 'the.test.ts': 'expect(a.status).toBe(3);\n' });
        expect(checkPairs(noDoctor, rows({ init: [3], doctor: [1] }), [pair])).toEqual([
            'pair "one state": the.test.ts no longer asserts the `doctor` side — ' +
                '`expect(b.status).toBe(1)` is gone',
        ]);
        const gone = tree({ 'other.ts': '' });
        expect(checkPairs(gone, rows({ init: [3], doctor: [1] }), [pair])).toEqual([
            'pair "one state": asserted in the.test.ts, which does not exist',
        ]);
    });

    it('does not accept an assertion that survives only inside a comment', () => {
        const commented = tree({
            'the.test.ts': 'expect(a.status).toBe(3);\n// expect(b.status).toBe(1);\n',
        });
        expect(checkPairs(commented, rows({ init: [3], doctor: [1] }), [pair])).toEqual([
            'pair "one state": the.test.ts no longer asserts the `doctor` side — ' +
                '`expect(b.status).toBe(1)` is gone',
        ]);
        const blockCommented = tree({
            'the.test.ts': 'expect(a.status).toBe(3);\n/* expect(b.status).toBe(1); */\n',
        });
        expect(checkPairs(blockCommented, rows({ init: [3], doctor: [1] }), [pair])).toHaveLength(1);
    });

    it('fails on a pair naming a verb the register does not cover', () => {
        const root = tree({ 'the.test.ts': asserting });
        expect(checkPairs(root, rows({ init: [3] }), [pair])).toEqual([
            'pair "one state": names `doctor`, which the register does not cover',
        ]);
    });

    it('every shipped pair asserts each surface`s exact code in a live test', () => {
        for (const p of PAIRS) {
            const abs = path.join(ROOT, p.assertedIn);
            expect(fs.existsSync(abs), p.assertedIn).toBe(true);
            const body = fs.readFileSync(abs, 'utf8');
            p.assertions.forEach((assertion, i) => {
                expect(body, `${p.assertedIn} :: ${p.surfaces[i]?.verb}`).toContain(assertion);
                // The assertion must name the code the register publishes.
                expect(assertion).toContain(String(p.surfaces[i]?.code));
            });
        }
    });

    it('a fixture command set does not inherit the production pairs', () => {
        const root = tree({ 'a.ts': 'return 0;\n' });
        const only = [{ verb: 'a', sources: ['a.ts'], meanings: { 0: 'ok' } }];
        expect(build(root, only).errors).toEqual([]);
        expect(build(root, only).pairs).toEqual([]);
    });
});

describe('exit-code register — the scan', () => {
    it('reads literal, ternary, argparse, bash and named-constant exits, not comments', () => {
        const constants = new Map([['EXIT_SEVEN', 7]]);
        const src =
            'return 0;\nreturn ok ? 1 : 4;\nthrow new ArgparseExit(2);\n  exit 5\n' +
            'return x === 0 ? EXIT_SEVEN : x;\n// return 9;\n/* exit 8 */\n';
        expect([...scanCodes(src, constants)].sort()).toEqual([0, 1, 2, 4, 5, 7]);
    });

    const spec = (meanings: Record<number, string>, inherits?: CommandSpec['inherits']): CommandSpec[] => [
        { verb: 'a', sources: ['a.ts'], meanings: { 0: 'ok', 4: 'four' } },
        { verb: 'b', sources: ['b.ts'], meanings, ...(inherits ? { inherits } : {}) },
    ];

    it('fails on a code the scan finds with no meaning', () => {
        const root = tree({ 'a.ts': 'return 0;\nreturn 4;\n', 'b.ts': 'return 0;\nreturn 6;\n' });
        expect(build(root, spec({ 0: 'ok' })).errors).toEqual([
            'b: returns 6 (b.ts) but the register gives it no meaning',
        ]);
    });

    it('fails on a meaning for a code nothing returns', () => {
        const root = tree({ 'a.ts': 'return 0;\nreturn 4;\n', 'b.ts': 'return 0;\n' });
        expect(build(root, spec({ 0: 'ok', 9: 'nine' })).errors).toEqual([
            'b: the register documents 9, which no scanned source returns',
        ]);
    });

    it('unions an inherited command`s codes only while the forwarding line exists', () => {
        const inherits = [{ from: 'a', file: 'b.ts', fragment: 'return rc;' }];
        const forwarding = tree({ 'a.ts': 'return 0;\nreturn 4;\n', 'b.ts': 'return 0;\nreturn rc;\n' });
        expect(build(forwarding, spec({ 0: 'ok', 4: 'forwarded' }, inherits)).errors).toEqual([]);
        const gone = tree({ 'a.ts': 'return 0;\nreturn 4;\n', 'b.ts': 'return 0;\n' });
        expect(build(gone, spec({ 0: 'ok', 4: 'forwarded' }, inherits)).errors).toContain(
            'b: inherits a through `return rc;` in b.ts, which is no longer there',
        );
    });

    it('--check fails on a stale register and leaves it untouched', () => {
        const root = tree({
            'src/scripts/install': 'exit 0\nexit 1\nexit 2\n',
            'src/scripts/install.ts': '',
            'src/install/conflictTracker.ts': 'return rc === 0 ? EXIT_COMPLETED_WITH_CONFLICTS : rc;\n',
            'src/install/preserve.ts': 'export const EXIT_COMPLETED_WITH_CONFLICTS = 3;\n',
            'src/scripts/_cli/cmd_sync.ts': 'return 0;\nreturn 1;\nArgparseExit(2)\nreturn rc;\n',
            'src/scripts/_cli/cmd_doctor.ts': 'return 0;\nreturn 1;\nreturn 2;\n',
            'src/scripts/_cli/_doctor_strict.ts': '',
            'src/scripts/_cli/cmd_uninstall.ts': 'return 0;\nreturn 1;\nArgparseExit(2)\n',
            // The pair's asserting test is part of the shape `main` checks, so
            // the fixture tree carries it too — with the two assertion literals
            // the real one carries. Otherwise this case would be measuring a
            // missing file rather than register drift.
            'tests/install/ownership_ledger_real_install.test.ts':
                'expect(second.status, second.out).toBe(3);\nexpect(after.status).toBe(1);\n',
            [OUT_REL]: 'stale\n',
        });
        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        expect(main(['--check'], root)).toBe(1);
        expect(fs.readFileSync(path.join(root, OUT_REL), 'utf8')).toBe('stale\n');
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        expect(main([], root)).toBe(0);
        expect(main(['--check'], root)).toBe(0);
    });
});
