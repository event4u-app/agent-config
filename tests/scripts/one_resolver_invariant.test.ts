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

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'one-resolver-'));
    seed();
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('the real tree holds the invariant', () => {
    it('reports no violations against this repository', () => {
        expect(checkOneResolver(REPO)).toEqual([]);
    });

    it('scans a non-empty set — a guard over nothing is green for the wrong reason', () => {
        // The scanner walking zero files would also return [], so the green
        // above has to be distinguished from a scanner that found nothing to
        // look at. `judgment_ladder.ts` is the file it must have read.
        const ladder = path.join(REPO, SANCTIONED_RESOLVER);
        expect(fs.existsSync(ladder)).toBe(true);
        expect(declaresRouter(fs.readFileSync(ladder, 'utf-8'))).toBe(true);
    });
});

describe('sensitivity — the guard is observed RED, not assumed', () => {
    it('goes red when a second task-side council router lands beside the ladder', () => {
        expect(checkOneResolver(tmp)).toEqual([]); // baseline: clean

        fs.writeFileSync(
            path.join(tmp, 'src', 'scripts', 'council_topology_router.ts'),
            'export class CouncilTopologyRouter {\n    route() {\n        return "council";\n    }\n}\n',
        );

        const v = checkOneResolver(tmp);
        expect(v).toHaveLength(1);
        expect(v[0]?.kind).toBe('second-resolver');
        expect(v[0]?.file).toContain('council_topology_router.ts');
    });

    it('goes red when the resolver imports the council-internal surface', () => {
        const ladder = path.join(tmp, 'src', 'scripts', '_lib', 'judgment_ladder.ts');
        fs.writeFileSync(
            ladder,
            "import { NECESSARY_TRIGGERS } from '../ai_council/necessity.js';\n" +
                'export function classifyLadder() {\n    return NECESSARY_TRIGGERS;\n}\n',
        );

        const v = checkOneResolver(tmp);
        expect(v).toHaveLength(1);
        expect(v[0]?.kind).toBe('council-import-in-resolver');
    });

    it('goes red on a second function-shaped resolver, not only a class', () => {
        fs.writeFileSync(
            path.join(tmp, 'src', 'scripts', 'alt_route.ts'),
            'export function resolveCouncilRoute() {\n    return "council";\n}\n',
        );
        expect(checkOneResolver(tmp).map((x) => x.kind)).toEqual(['second-resolver']);
    });
});

describe('polarity — the guard must also DENY, or it is a pattern that always fires', () => {
    it('stays green on a file that merely mentions the council', () => {
        fs.writeFileSync(
            path.join(tmp, 'src', 'scripts', 'council_report.ts'),
            '// Renders a council run for the operator. Routes nothing.\n' +
                'export function renderCouncilReport(rows: string[]) {\n    return rows.join("\\n");\n}\n',
        );
        expect(checkOneResolver(tmp)).toEqual([]);
    });

    it('stays green on council-INTERNAL modules, which are out of scope by design', () => {
        const dir = path.join(tmp, 'src', 'scripts', 'ai_council');
        fs.mkdirSync(dir, { recursive: true });
        // Even a literal router name here is the council's own business: the
        // invariant is about TASK-side resolvers.
        fs.writeFileSync(
            path.join(dir, 'internal_router.ts'),
            'export class CouncilTopologyRouter {\n    route() {\n        return "x";\n    }\n}\n',
        );
        expect(checkOneResolver(tmp)).toEqual([]);
    });

    it('stays green on a test file that names a router', () => {
        fs.writeFileSync(
            path.join(tmp, 'src', 'scripts', 'sample.test.ts'),
            'export class CouncilTopologyRouter {}\n',
        );
        expect(checkOneResolver(tmp)).toEqual([]);
    });

    it('does not treat an ai_council import in a NON-resolver file as a violation', () => {
        fs.writeFileSync(
            path.join(tmp, 'src', 'scripts', 'consumer.ts'),
            "import { x } from './ai_council/necessity.js';\nexport const y = x;\n",
        );
        expect(importsCouncilInternal(fs.readFileSync(path.join(tmp, 'src', 'scripts', 'consumer.ts'), 'utf-8'))).toBe(
            true,
        );
        // …but the invariant only constrains the resolver itself.
        expect(checkOneResolver(tmp)).toEqual([]);
    });
});
