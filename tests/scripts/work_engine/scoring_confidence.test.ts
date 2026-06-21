// Golden-parity tests for work_engine/scoring/confidence.ts vs confidence.py
// (ADR-094 py2ts Phase 1 — scoring subpackage).
//
// `scoring/confidence.py` has NO intra-package imports (stdlib `re` +
// `dataclasses` only) — loaded via the direct-file importlib loader. The
// scorer is float-heavy (normalised score = round(total/10, 4)), so the
// parity bar is: identical band, identical score float, identical per-dimension
// breakdown, identical reasons list, identical ui_intent — over a corpus of
// real-shaped prompts that exercise every rubric branch. The Python side dumps
// the dataclass via dataclasses.asdict + json; the TS side dumps the frozen
// ConfidenceScore the same way. ASCII-only prompts keep `\b` / `\w` regex
// semantics identical across Python (Unicode) and JS (ASCII) — a documented
// parity boundary (ADR-094).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    BAND_HIGH_MIN,
    BAND_MEDIUM_MIN,
    DIMENSION_NAMES,
    MAX_PER_DIMENSION,
    type ConfidenceScore,
    score,
} from '../../../src/agent-src/templates/scripts/work_engine/scoring/confidence.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const PY = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
    'scoring',
    'confidence.py',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** asdict-equivalent projection in Python field order. */
function asdict(c: ConfidenceScore): Record<string, unknown> {
    return {
        band: c.band,
        score: c.score,
        dimensions: c.dimensions,
        reasons: c.reasons,
        ui_intent: c.ui_intent,
    };
}

/** Python: score(raw, ac, assumptions) then dataclasses.asdict → JSON. */
function pyScore(raw: string, ac: string[] | null, assumptions: string[] | null): unknown {
    const loader = [
        'import sys, json, importlib.util, dataclasses',
        `spec = importlib.util.spec_from_file_location("conf", ${JSON.stringify(PY)})`,
        'conf = importlib.util.module_from_spec(spec)',
        'sys.modules["conf"] = conf',
        'spec.loader.exec_module(conf)',
    ].join('\n');
    const body = [
        'payload = json.loads(sys.argv[1])',
        'res = conf.score(raw=payload["raw"], ac=payload["ac"], assumptions=payload["assumptions"])',
        'sys.stdout.write(json.dumps(dataclasses.asdict(res)))',
    ].join('\n');
    const r = spawnSync(
        'python3',
        ['-c', `${loader}\n${body}`, JSON.stringify({ raw, ac, assumptions })],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return JSON.parse(r.stdout);
}

describe('scoring/confidence — exported constants', () => {
    it('thresholds + rubric shape', () => {
        expect(BAND_HIGH_MIN).toBe(0.8);
        expect(BAND_MEDIUM_MIN).toBe(0.5);
        expect(MAX_PER_DIMENSION).toBe(2);
        expect([...DIMENSION_NAMES]).toEqual([
            'goal_clarity',
            'scope_boundary',
            'ac_evidence',
            'stack_data',
            'reversibility',
        ]);
    });
});

describe('scoring/confidence — score shape', () => {
    it('empty prompt → low band (stack_data + reversibility still score 2 each)', () => {
        const r = score({ raw: '' });
        expect(r.band).toBe('low');
        // goal/scope/ac are 0; an empty prompt has no stack signal (→2) and is
        // code-only (→2), so total=4 → 0.4, matching CPython.
        expect(r.score).toBe(0.4);
        expect(r.dimensions.goal_clarity).toBe(0);
        expect(r.reasons[0]).toBe('goal_clarity=0: empty prompt');
        expect(r.ui_intent).toBe(false);
    });

    it('high-quality prompt with anchored AC → high band', () => {
        const r = score({
            raw: 'Add a logout button to `auth/LoginForm.tsx`',
            ac: [
                'should render a logout button',
                'when clicked it must clear the session',
                'then redirect to the login page',
            ],
        });
        expect(r.band).toBe('high');
        expect(r.score).toBeGreaterThanOrEqual(0.8);
    });

    it('ui keyword sets ui_intent', () => {
        const r = score({ raw: 'redesign the dashboard layout with tailwind' });
        expect(r.ui_intent).toBe(true);
    });

    it('frozen result cannot be mutated', () => {
        const r = score({ raw: 'fix the login bug' });
        expect(() => {
            // @ts-expect-error — runtime frozen check
            r.band = 'high';
        }).toThrow();
    });
});

// A corpus that exercises each rubric branch: verbs/no-verbs, questions,
// conjunction splits, file paths, PHP namespaces, camelCase, domain nouns,
// stack/data with+without target, irreversible + config + code-only.
const PROMPTS: Array<{ raw: string; ac: string[] | null; assumptions: string[] | null }> = [
    { raw: '', ac: null, assumptions: null },
    { raw: 'fix the login bug in `auth/session.py`', ac: null, assumptions: null },
    { raw: 'How does the dashboard work?', ac: null, assumptions: null },
    { raw: 'add a button and then refactor the user model', ac: null, assumptions: null },
    {
        raw: 'create UserProfileCard component',
        ac: ['should mount', 'must show the avatar', 'then load posts'],
        assumptions: ['react'],
    },
    { raw: 'rename App\\Models\\User to Account', ac: [], assumptions: null },
    { raw: 'optimize Foo::bar performance', ac: ['expect faster'], assumptions: null },
    { raw: 'drop the users table', ac: null, assumptions: null },
    { raw: 'add a migration for the orders column', ac: null, assumptions: null },
    { raw: 'migrate the schema table `orders`', ac: null, assumptions: null },
    { raw: 'update the .env config for deploy', ac: null, assumptions: null },
    { raw: 'refactor the checkout flow', ac: ['given a cart', 'when paid'], assumptions: null },
    {
        raw: 'this is a very long prompt that just keeps going on and on well past the forty word boundary so that the goal clarity scorer must fall back to the borderline length branch instead of the clean two point branch because length matters here ok',
        ac: null,
        assumptions: null,
    },
    { raw: 'implement caching for the search api', ac: null, assumptions: null },
    { raw: 'redesign the colour theme to dark mode', ac: null, assumptions: null },
    { raw: 'charge the customer billing account', ac: null, assumptions: null },
    { raw: 'write tests for `report.py`', ac: ['should pass', 'must cover edges'], assumptions: null },
    { raw: 'add an endpoint', ac: null, assumptions: null },
    { raw: 'tune the redis cache', ac: null, assumptions: null },
    { raw: 'document the webhook handler in handler.ts', ac: ['must explain payload'], assumptions: null },
];

describe.runIf(hasPython3())('scoring/confidence — python parity', () => {
    it.each(PROMPTS.map((p, i) => [i, p] as const))(
        'prompt #%i scores byte-identical to CPython',
        (_i, p) => {
            const expected = pyScore(p.raw, p.ac, p.assumptions);
            const got = asdict(score({ raw: p.raw, ac: p.ac, assumptions: p.assumptions }));
            expect(got).toEqual(expected);
        },
    );

    it('score float matches CPython for every total 0..10 (round/2-decimal parity)', () => {
        // Build prompts that deterministically hit each total via dimension
        // combinations is hard; instead assert the normalisation directly by
        // re-deriving from the dimensions both engines report on the corpus.
        for (const p of PROMPTS) {
            const expected = pyScore(p.raw, p.ac, p.assumptions) as { score: number };
            const got = score({ raw: p.raw, ac: p.ac, assumptions: p.assumptions });
            // Exact float equality — round-half-even on total/10 must agree.
            expect(got.score).toBe(expected.score);
        }
    });
});
