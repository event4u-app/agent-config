import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    checkOneResolver,
    declaresRouter,
    importsCouncilInternal,
    SANCTIONED_RESOLVER,
} from '../../src/scripts/_lib/one_resolver_invariant.js';

const REPO = path.resolve(__dirname, '..', '..');

let tmp: string;

/** Build a synthetic tree with a `judgment_ladder.ts` that satisfies the guard. */
function seed(): void {
    const libDir = path.join(tmp, 'src', 'scripts', '_lib');
    fs.mkdirSync(libDir, { recursive: true });
    fs.writeFileSync(
        path.join(libDir, 'judgment_ladder.ts'),
        "import { classifyTask } from './auto_dispatch.js';\n" +
            'export function classifyLadder(x: unknown) {\n    return classifyTask(x as never);\n}\n',
    );
}

function write(rel: string, body: string): void {
    const abs = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
}

/** Assert the synthetic tree is clean AND was actually walked. */
function expectCleanBaseline(): void {
    const r = checkOneResolver(tmp);
    expect(r.violations).toEqual([]);
    expect(r.scanned.length).toBeGreaterThan(0);
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'one-resolver-'));
    seed();
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('the real tree holds the invariant', () => {
    it('reports no violations against this repository', () => {
        expect(checkOneResolver(REPO).violations).toEqual([]);
    });

    // R2 finding 1. The previous version of this test called `fs.existsSync`
    // and `declaresRouter` directly and never invoked the scanner, so a
    // scanner walking ZERO files passed it — the reviewer proved it by
    // mutating the scan root to a typo. Anti-vacuity has to be asserted on
    // the scanner's OWN report of what it read, or it asserts nothing.
    it('actually walked files, and read the resolver among them', () => {
        const r = checkOneResolver(REPO);
        expect(r.scanned.length).toBeGreaterThan(100);
        expect(r.scanned).toContain(SANCTIONED_RESOLVER);
    });

    it('a scan root that resolves to nothing is NOT reported as clean-and-scanned', () => {
        // The discriminator itself, exercised: an empty tree yields an empty
        // `scanned`, so `violations.length === 0` alone is never sufficient.
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'one-resolver-empty-'));
        try {
            const r = checkOneResolver(empty);
            expect(r.scanned).toEqual([]);
            // …and it is not silently green either: the resolver is missing.
            expect(r.violations.map((v) => v.kind)).toEqual(['resolver-missing']);
        } finally {
            fs.rmSync(empty, { recursive: true, force: true });
        }
    });
});

describe('sensitivity — the guard is observed RED, not assumed', () => {
    it('goes red when a second task-side council router lands beside the ladder', () => {
        expectCleanBaseline();
        write(
            'src/scripts/council_topology_router.ts',
            'export class CouncilTopologyRouter {\n    route() {\n        return "council";\n    }\n}\n',
        );
        const v = checkOneResolver(tmp).violations;
        expect(v).toHaveLength(1);
        expect(v[0]?.kind).toBe('second-resolver');
        expect(v[0]?.file).toContain('council_topology_router.ts');
    });

    it('goes red when the resolver imports the council-internal surface', () => {
        expectCleanBaseline();
        write(
            SANCTIONED_RESOLVER,
            "import { NECESSARY_TRIGGERS } from '../ai_council/necessity.js';\n" +
                'export function classifyLadder() {\n    return NECESSARY_TRIGGERS;\n}\n',
        );
        const v = checkOneResolver(tmp).violations;
        expect(v).toHaveLength(1);
        expect(v[0]?.kind).toBe('council-import-in-resolver');
    });

    it('goes red on a second function-shaped resolver, not only a class', () => {
        expectCleanBaseline();
        write('src/scripts/alt_route.ts', 'export function resolveCouncilRoute() {\n    return "council";\n}\n');
        expect(checkOneResolver(tmp).violations.map((x) => x.kind)).toEqual(['second-resolver']);
    });

    // R2 finding 4.
    it('goes red when the sanctioned resolver is deleted — zero is not one', () => {
        expectCleanBaseline();
        fs.rmSync(path.join(tmp, SANCTIONED_RESOLVER));
        expect(checkOneResolver(tmp).violations.map((x) => x.kind)).toEqual(['resolver-missing']);
    });
});

// R2 finding 2. The same NAME evaded via ordinary export SYNTAX; nine of
// eleven measured shapes passed the first version. Each is asserted here so a
// future narrowing of the patterns cannot pass silently.
describe('evasion by export syntax — every shape the reviewer measured', () => {
    const shapes: ReadonlyArray<readonly [string, string]> = [
        ['default-exported class', 'export default class CouncilTopologyRouter {}\n'],
        ['abstract class', 'export abstract class CouncilTopologyRouter {}\n'],
        ['const class expression', 'export const CouncilTopologyRouter = class {};\n'],
        ['arrow const', 'export const resolveCouncilRoute = () => "council";\n'],
        ['separate export statement', 'class CouncilTopologyRouter {}\nexport { CouncilTopologyRouter };\n'],
        ['aliased export', 'class Inner {}\nexport { Inner as CouncilTopologyRouter };\n'],
        ['re-export', "export { CouncilTopologyRouter } from './x.js';\n"],
        ['async function', 'export async function resolveCouncilRoute() {\n    return "council";\n}\n'],
        ['exported type alias', 'export type CouncilTopologyRouter = () => string;\n'],
    ];

    for (const [label, body] of shapes) {
        it(`detects a router declared as a ${label}`, () => {
            expect(declaresRouter(body)).toBe(true);
        });
    }

    it('a tree carrying three differently-exported routers is not green', () => {
        expectCleanBaseline();
        write('src/scripts/a.ts', 'export default class CouncilTopologyRouter {}\n');
        write('src/scripts/b.ts', 'export abstract class CouncilTopologyRouter {}\n');
        write('src/scripts/c.ts', 'export const resolveCouncilRoute = () => "council";\n');
        expect(checkOneResolver(tmp).violations).toHaveLength(3);
    });
});

// R2 finding 3.
describe('scan scope — a second resolver outside src/scripts is still a second resolver', () => {
    for (const dir of ['src/cli', 'src/shared', 'src/server', 'src/agent-src/templates/scripts/work_engine']) {
        it(`sees a router placed in ${dir}`, () => {
            expectCleanBaseline();
            write(`${dir}/router.ts`, 'export class CouncilTopologyRouter {}\n');
            expect(checkOneResolver(tmp).violations.map((v) => v.kind)).toEqual(['second-resolver']);
        });
    }
});

// R2 finding 5.
describe('the council-import check covers every import form, and only real ones', () => {
    for (const [label, body] of [
        ['static from', "import { x } from '../ai_council/necessity.js';\n"],
        ['index form, no trailing slash', "import { x } from '../ai_council';\n"],
        ['dynamic import()', "const m = await import('../ai_council/necessity.js');\n"],
        ['require()', "const m = require('../ai_council/necessity.js');\n"],
    ] as const) {
        it(`detects ${label}`, () => {
            expect(importsCouncilInternal(body)).toBe(true);
        });
    }

    it('does NOT fire on a comment mentioning the path — a docstring reword must not red the gate', () => {
        expect(
            importsCouncilInternal(
                "// Deliberately independent: we do not import from '../ai_council/necessity.js'.\n" +
                    'export function classifyLadder() {\n    return 1;\n}\n',
            ),
        ).toBe(false);
    });

    it('does NOT fire on a block comment mentioning the path', () => {
        expect(
            importsCouncilInternal("/**\n * See `from '../ai_council/necessity.js'` — we do not.\n */\nexport const x = 1;\n"),
        ).toBe(false);
    });
});

describe('polarity — the guard must also DENY, or it is a pattern that always fires', () => {
    it('stays green on a file that merely mentions the council', () => {
        expectCleanBaseline();
        write(
            'src/scripts/council_report.ts',
            '// Renders a council run for the operator. Routes nothing.\n' +
                'export function renderCouncilReport(rows: string[]) {\n    return rows.join("\\n");\n}\n',
        );
        expect(checkOneResolver(tmp).violations).toEqual([]);
    });

    it('stays green on council-INTERNAL modules, which are out of scope by design', () => {
        expectCleanBaseline();
        write('src/scripts/ai_council/internal_router.ts', 'export class CouncilTopologyRouter {}\n');
        expect(checkOneResolver(tmp).violations).toEqual([]);
    });

    it('stays green on a test file that names a router', () => {
        expectCleanBaseline();
        write('src/scripts/sample.test.ts', 'export class CouncilTopologyRouter {}\n');
        expect(checkOneResolver(tmp).violations).toEqual([]);
    });

    it('stays green on a router name inside a comment or a string', () => {
        expectCleanBaseline();
        write(
            'src/scripts/prose.ts',
            '// A second `export class CouncilTopologyRouter` would be a violation.\n' +
                'export const NOTE = "export class CouncilTopologyRouter";\n',
        );
        expect(checkOneResolver(tmp).violations).toEqual([]);
    });

    it('does not treat an ai_council import in a NON-resolver file as a violation', () => {
        expectCleanBaseline();
        write('src/scripts/consumer.ts', "import { x } from './ai_council/necessity.js';\nexport const y = x;\n");
        // The import itself is detectable…
        expect(importsCouncilInternal(fs.readFileSync(path.join(tmp, 'src/scripts/consumer.ts'), 'utf-8'))).toBe(true);
        // …but the invariant only constrains the resolver.
        expect(checkOneResolver(tmp).violations).toEqual([]);
    });
});
