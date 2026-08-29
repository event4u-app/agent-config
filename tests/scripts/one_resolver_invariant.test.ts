import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    checkOneResolver,
    declaresRouter,
    importsCouncilInternal,
    SANCTIONED_RESOLVER,
    segment,
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

// ── R2 ROUND 2 ────────────────────────────────────────────────────────────
// Round 1's repair of the comment false-positive introduced a wider false
// NEGATIVE: comments were stripped by ordered regexes, block-first, with an
// unbounded lazy match. Any `//` comment containing the two characters `/*` —
// an ordinary glob path — opened a spurious block comment that ran to the next
// `*` `/` anywhere in the file and deleted the real code between. Measured on
// the live tree at the time: 34 non-test files under `src/` carried such a
// comment and 12 of them lost top-level `export` declarations.
describe('the comment scanner is single-pass, so a glob in a line comment cannot swallow code', () => {
    const GLOB_COMMENT = '// Routes live under packages/*/commands/\n';

    it('still detects a router declared after a line comment containing a glob', () => {
        expect(declaresRouter(GLOB_COMMENT + 'export class CouncilTopologyRouter {}\n')).toBe(true);
    });

    it('still detects a council import after a line comment containing a glob', () => {
        expect(importsCouncilInternal(GLOB_COMMENT + "import { x } from '../ai_council/necessity.js';\n")).toBe(true);
    });

    it('end-to-end: a second resolver hidden behind such a comment is NOT green', () => {
        expectCleanBaseline();
        write('src/scripts/hidden.ts', GLOB_COMMENT + 'export class CouncilTopologyRouter {}\n');
        const r = checkOneResolver(tmp);
        expect(r.violations.map((v) => v.kind)).toEqual(['second-resolver']);
        // The file WAS scanned — which is why anti-vacuity could not catch this.
        expect(r.scanned.some((f) => f.endsWith('hidden.ts'))).toBe(true);
    });

    it('does not lose code that follows a line comment containing a glob', () => {
        const src = GLOB_COMMENT + 'export function run() {\n    return 1;\n}\n';
        expect(segment(src).codeOnly).toContain('export function run');
    });

    it('a real block comment IS still removed', () => {
        expect(segment('/* export class CouncilTopologyRouter {} */\nexport const x = 1;\n').codeOnly).not.toContain(
            'CouncilTopologyRouter',
        );
    });

    it('an apostrophe in a line comment does not open a string that eats the file', () => {
        const src = "// the council's own gate\nexport class CouncilTopologyRouter {}\n";
        expect(declaresRouter(src)).toBe(true);
    });
});

describe('export forms that evaded round 1s repair', () => {
    for (const [label, body] of [
        ['export declare class', 'export declare class CouncilTopologyRouter {}\n'],
        ['export enum', 'export enum CouncilTopologyRouter { a }\n'],
        ['export generator function', 'export function* resolveCouncilRoute() {}\n'],
    ] as const) {
        it(`detects a router declared as ${label}`, () => {
            expect(declaresRouter(body)).toBe(true);
        });
    }
});

describe('the side-effect import form, missed under a test titled "every import form"', () => {
    it('detects a bare side-effect import of the council internals', () => {
        expect(importsCouncilInternal("import '../ai_council/necessity.js';\n")).toBe(true);
    });

    it('detects the side-effect index form with no trailing slash', () => {
        expect(importsCouncilInternal("import '../ai_council';\n")).toBe(true);
    });
});

describe('the sanctioned path must BE a resolver, not merely exist', () => {
    it('goes red when the resolver is gutted to a stub', () => {
        expectCleanBaseline();
        write(SANCTIONED_RESOLVER, 'export const NOTE = "moved";\n');
        const v = checkOneResolver(tmp).violations;
        expect(v.map((x) => x.kind)).toEqual(['resolver-is-not-a-resolver']);
    });

    it('the real resolver satisfies it', () => {
        expect(checkOneResolver(REPO).violations.map((v) => v.kind)).not.toContain('resolver-is-not-a-resolver');
    });
});
