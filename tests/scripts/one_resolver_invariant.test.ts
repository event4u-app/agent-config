import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    checkOneResolver,
    declaresRouter,
    exportedNames,
    exportsRouterFunction,
    importsCouncilInternal,
    moduleSpecifiers,
    SANCTIONED_RESOLVER,
} from '../../src/scripts/_lib/one_resolver_invariant.js';

const REPO = path.resolve(__dirname, '..', '..');

let tmp: string;

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

    // R2 round 1, finding 1: the previous anti-vacuity test never called the
    // scanner, so one walking ZERO files passed it.
    it('actually walked files, and read the resolver among them', () => {
        const r = checkOneResolver(REPO);
        expect(r.scanned.length).toBeGreaterThan(100);
        expect(r.scanned).toContain(SANCTIONED_RESOLVER);
    });

    it('an empty tree is not reported as clean-and-scanned', () => {
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'one-resolver-empty-'));
        try {
            const r = checkOneResolver(empty);
            expect(r.scanned).toEqual([]);
            expect(r.violations.map((v) => v.kind)).toEqual(['resolver-missing']);
        } finally {
            fs.rmSync(empty, { recursive: true, force: true });
        }
    });
});

describe('sensitivity — the guard is observed RED, not assumed', () => {
    it('goes red when a second task-side council router lands beside the ladder', () => {
        expectCleanBaseline();
        write('src/scripts/council_topology_router.ts', 'export class CouncilTopologyRouter {}\n');
        const v = checkOneResolver(tmp).violations;
        expect(v.map((x) => x.kind)).toEqual(['second-resolver']);
        expect(v[0]?.file).toContain('council_topology_router.ts');
    });

    it('goes red when the resolver imports the council-internal surface', () => {
        expectCleanBaseline();
        write(
            SANCTIONED_RESOLVER,
            "import { NECESSARY_TRIGGERS } from '../ai_council/necessity.js';\n" +
                'export function classifyLadder() {\n    return NECESSARY_TRIGGERS;\n}\n',
        );
        expect(checkOneResolver(tmp).violations.map((x) => x.kind)).toEqual(['council-import-in-resolver']);
    });

    it('goes red on a second function-shaped resolver, not only a class', () => {
        expectCleanBaseline();
        write('src/scripts/alt_route.ts', 'export function resolveCouncilRoute() {\n    return "council";\n}\n');
        expect(checkOneResolver(tmp).violations.map((x) => x.kind)).toEqual(['second-resolver']);
    });

    it('goes red when the sanctioned resolver is deleted — zero is not one', () => {
        expectCleanBaseline();
        fs.rmSync(path.join(tmp, SANCTIONED_RESOLVER));
        expect(checkOneResolver(tmp).violations.map((x) => x.kind)).toEqual(['resolver-missing']);
    });
});

// ── The three killed implementations, kept as permanent regressions ───────
//
// Each case below is a reproducer a fresh R2 reviewer used to kill a previous
// text-scanning implementation. They are retained not because a parser is at
// risk from them, but because their absence is what let each round's repair
// look complete.
describe('regressions from the three text-scanning implementations this replaced', () => {
    it('round 1: a router name in a STRING is not a declaration', () => {
        expect(declaresRouter('export const NOTE = "export class CouncilTopologyRouter";')).toBe(false);
    });

    it('round 1: a router name in a COMMENT is not a declaration', () => {
        expect(declaresRouter('// export class CouncilTopologyRouter\nexport const x = 1;')).toBe(false);
    });

    it('round 2: a line comment containing a glob does not hide the code after it', () => {
        expect(declaresRouter('// Routes live under packages/*/commands/\nexport class CouncilTopologyRouter {}')).toBe(
            true,
        );
    });

    it('round 3: a BACKTICK inside a regex literal does not hide the code after it', () => {
        // `check_portability.ts:741` holds a regex of exactly this shape — the
        // trigger that cost 231 exports was ordinary, not exotic.
        const src = 'const re = /`([^`]+)`/g;\nexport class CouncilTopologyRouter {}\n';
        expect(declaresRouter(src)).toBe(true);
    });

    it('round 3: a real block comment IS still invisible', () => {
        expect(declaresRouter('/* export class CouncilTopologyRouter {} */\nexport const x = 1;')).toBe(false);
    });

    it('parsing does not lose ordinary exports the way the strippers did', () => {
        // Rounds 2 and 3 lost 12 and 54 files' worth of top-level exports.
        const src = '// glob packages/*/x\nconst re = /`a`/g;\nexport function run() {\n    return re;\n}\n';
        expect(exportedNames(src)).toContain('run');
    });
});

// R2 rounds 2 and 3: every export syntax that evaded a pattern matrix.
describe('export syntax — every shape three review rounds found evading', () => {
    const shapes: ReadonlyArray<readonly [string, string]> = [
        ['plain class', 'export class CouncilTopologyRouter {}'],
        ['default-exported class', 'export default class CouncilTopologyRouter {}'],
        ['abstract class', 'export abstract class CouncilTopologyRouter {}'],
        ['declare class', 'export declare class CouncilTopologyRouter {}'],
        ['enum', 'export enum CouncilTopologyRouter { a }'],
        ['generator function', 'export function* resolveCouncilRoute() {}'],
        ['const class expression', 'export const CouncilTopologyRouter = class {};'],
        ['arrow const', 'export const resolveCouncilRoute = () => "council";'],
        ['separate export statement', 'class CouncilTopologyRouter {}\nexport { CouncilTopologyRouter };'],
        ['aliased export', 'class Inner {}\nexport { Inner as CouncilTopologyRouter };'],
        ['re-export', "export { CouncilTopologyRouter } from './x.js';"],
        ['type-only re-export', "export type { CouncilTopologyRouter } from './impl.js';"],
        ['namespace re-export', "export * as CouncilTopologyRouter from './impl.js';"],
        ['destructured const', 'export const { CouncilTopologyRouter } = mod;'],
        ['type alias', 'export type CouncilTopologyRouter = () => string;'],
        ['async function', 'export async function resolveCouncilRoute() {\n    return "council";\n}'],
    ];

    for (const [label, body] of shapes) {
        it(`detects a router declared as a ${label}`, () => {
            expect(declaresRouter(body)).toBe(true);
        });
    }

    it('a NON-exported router declaration is not a violation', () => {
        expect(declaresRouter('class CouncilTopologyRouter {}')).toBe(false);
    });

    it('a tree carrying three differently-exported routers reports three', () => {
        expectCleanBaseline();
        write('src/scripts/a.ts', 'export default class CouncilTopologyRouter {}\n');
        write('src/scripts/b.ts', "export type { CouncilTopologyRouter } from './impl.js';\n");
        write('src/scripts/c.ts', 'export const { resolveCouncilRoute } = mod;\n');
        expect(checkOneResolver(tmp).violations).toHaveLength(3);
    });
});

// R2 round 3, finding 2: the previous check tested the NAME, so a stub that
// kept the name passed while round 2's reproducer that dropped it failed.
describe('the resolver must be CALLABLE, not merely named', () => {
    it('goes red when the resolver is gutted to a string of the same name', () => {
        expectCleanBaseline();
        write(SANCTIONED_RESOLVER, 'export const classifyLadder = "moved";\n');
        expect(checkOneResolver(tmp).violations.map((x) => x.kind)).toEqual(['resolver-is-not-a-resolver']);
    });

    it('goes red when the resolver is gutted to an unrelated const', () => {
        expectCleanBaseline();
        write(SANCTIONED_RESOLVER, 'export const NOTE = "moved";\n');
        expect(checkOneResolver(tmp).violations.map((x) => x.kind)).toEqual(['resolver-is-not-a-resolver']);
    });

    it('goes red when the resolver only re-exports the name from elsewhere', () => {
        expectCleanBaseline();
        write(SANCTIONED_RESOLVER, "export { classifyLadder } from './moved_elsewhere.js';\n");
        expect(checkOneResolver(tmp).violations.map((x) => x.kind)).toEqual(['resolver-is-not-a-resolver']);
    });

    for (const [label, body] of [
        ['function declaration', 'export function classifyLadder() {\n    return 1;\n}'],
        ['arrow const', 'export const classifyLadder = () => 1;'],
        ['class', 'export class CouncilTopologyRouter {}'],
    ] as const) {
        it(`accepts a resolver declared as a ${label}`, () => {
            expect(exportsRouterFunction(body)).toBe(true);
        });
    }

    it('the real resolver satisfies it', () => {
        expect(checkOneResolver(REPO).violations.map((v) => v.kind)).not.toContain('resolver-is-not-a-resolver');
    });
});

describe('module specifiers — every import form three rounds found missing', () => {
    for (const [label, body] of [
        ['static from', "import { x } from '../ai_council/necessity.js';"],
        ['side-effect import', "import '../ai_council/necessity.js';"],
        ['index form, no trailing slash', "import { x } from '../ai_council';"],
        ['type-only import', "import type { X } from '../ai_council/necessity.js';"],
        ['dynamic import()', "const m = await import('../ai_council/necessity.js');"],
        ['dynamic import() with a template specifier', 'const m = await import(`../ai_council/necessity.js`);'],
        ['require()', "const m = require('../ai_council/necessity.js');"],
        ['re-export from', "export { x } from '../ai_council/necessity.js';"],
    ] as const) {
        it(`detects ${label}`, () => {
            expect(importsCouncilInternal(body)).toBe(true);
        });
    }

    it('does NOT fire on a comment mentioning the path', () => {
        expect(
            importsCouncilInternal("// we do not import from '../ai_council/necessity.js'\nexport const x = 1;"),
        ).toBe(false);
    });

    it('does NOT fire on a plain string containing the path — R1 finding 5 moved here in round 3', () => {
        expect(importsCouncilInternal('export const S = "../ai_council/necessity.js";')).toBe(false);
    });

    it('does NOT fire on a similarly-named neighbour directory', () => {
        expect(importsCouncilInternal("import { x } from '../ai_councilish/y.js';")).toBe(false);
    });

    it('collects specifiers without inventing them', () => {
        expect(moduleSpecifiers("import 'a';\nconst b = require('c');")).toEqual(['a', 'c']);
    });
});

describe('polarity — the guard must also DENY, or it is a pattern that always fires', () => {
    it('stays green on a file that merely mentions the council', () => {
        expectCleanBaseline();
        write(
            'src/scripts/council_report.ts',
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

    it('does not treat an ai_council import in a NON-resolver file as a violation', () => {
        expectCleanBaseline();
        write('src/scripts/consumer.ts', "import { x } from './ai_council/necessity.js';\nexport const y = x;\n");
        expect(importsCouncilInternal(fs.readFileSync(path.join(tmp, 'src/scripts/consumer.ts'), 'utf-8'))).toBe(true);
        expect(checkOneResolver(tmp).violations).toEqual([]);
    });
});

// R2 round 2, finding 3.
describe('scan scope — a second resolver outside src/scripts is still a second resolver', () => {
    for (const dir of ['src/cli', 'src/shared', 'src/server', 'src/agent-src/templates/scripts/work_engine']) {
        it(`sees a router placed in ${dir}`, () => {
            expectCleanBaseline();
            write(`${dir}/router.ts`, 'export class CouncilTopologyRouter {}\n');
            expect(checkOneResolver(tmp).violations.map((v) => v.kind)).toEqual(['second-resolver']);
        });
    }
});

// The frozen claim's own limit, asserted so nobody reads the guard as wider.
describe('the frozen claim — what this guard deliberately does NOT see', () => {
    it('does not follow a router exported under an unrelated name', () => {
        expect(declaresRouter('export class Dispatcher {}\n')).toBe(false);
    });

    it('does not resolve a specifier built by interpolation', () => {
        expect(importsCouncilInternal('const m = await import(`../${dir}/necessity.js`);')).toBe(false);
    });
});

// ── R2 ROUND 4 ────────────────────────────────────────────────────────────
describe('round 4: the resolver check must not RED on conforming code', () => {
    // The previous version recognised a router only when declared inline, so
    // five behaviour-preserving spellings of the SAME resolver were reported as
    // `resolver-is-not-a-resolver` — a false positive against the sanctioned
    // file, and internally inconsistent, since `declaresRouter` accepted the
    // identical syntax for every other file.
    for (const [label, body] of [
        ['export statement after a function declaration', 'function classifyLadder(x) { return x; }\nexport { classifyLadder };'],
        ['export default of a local identifier', 'function classifyLadder(x) { return x; }\nexport default classifyLadder;'],
        ['an as-cast arrow', 'export const classifyLadder = ((x) => x) as (x: unknown) => unknown;'],
        ['a satisfies-annotated arrow', 'export const classifyLadder = ((x) => x) satisfies unknown;'],
        ['an aliased local export', 'function inner(x) { return x; }\nexport { inner as classifyLadder };'],
    ] as const) {
        it(`accepts a resolver spelled as ${label}`, () => {
            expect(exportsRouterFunction(body)).toBe(true);
        });
    }

    it('still refuses a re-export that resolves to another module', () => {
        expect(exportsRouterFunction("export { classifyLadder } from './moved.js';")).toBe(false);
    });

    it('still refuses a same-named string stub', () => {
        expect(exportsRouterFunction('export const classifyLadder = "moved";')).toBe(false);
    });
});

describe('round 4: file discovery covers every module extension', () => {
    for (const rel of ['src/ui/Router.tsx', 'src/scripts/r.mts', 'src/scripts/r.cts']) {
        it(`sees a router in ${path.extname(rel)}`, () => {
            expectCleanBaseline();
            write(rel, 'export class CouncilTopologyRouter {}\n');
            expect(checkOneResolver(tmp).violations.map((v) => v.kind)).toEqual(['second-resolver']);
        });
    }

    it('still skips the test files of every extension', () => {
        expectCleanBaseline();
        write('src/ui/Router.test.tsx', 'export class CouncilTopologyRouter {}\n');
        expect(checkOneResolver(tmp).violations).toEqual([]);
    });
});

describe('round 4: namespace and ambient-module bodies are walked', () => {
    it('sees a router declared inside an exported namespace', () => {
        expect(declaresRouter('export namespace Dispatch { export class CouncilTopologyRouter {} }')).toBe(true);
    });

    it('sees a router declared inside an ambient module block', () => {
        expect(declaresRouter('declare module "d" { export class CouncilTopologyRouter {} }')).toBe(true);
    });

    it('still sees the enclosing form itself', () => {
        expect(declaresRouter('export namespace CouncilTopologyRouter {}')).toBe(true);
    });
});

// R2 round 4, finding 4: the retention claim was wider than the file. These are
// the two false-POSITIVE reproducers from round 3 that had no pin.
describe('round 4: the round-3 false-positive reproducers, now actually retained', () => {
    it('a template literal in the resolver holding an import statement is not an import', () => {
        expect(
            importsCouncilInternal("export const T = `import { x } from '../ai_council/y.js';`;\n"),
        ).toBe(false);
    });

    it('a regex with a backtick plus a string carrying the router name is not a declaration', () => {
        expect(declaresRouter('const re = /`a`/g;\nexport const S = "class CouncilTopologyRouter";\n')).toBe(false);
    });
});
