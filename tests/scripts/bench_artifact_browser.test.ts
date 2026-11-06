/**
 * The browser-acceptance grader and the art-dnd-01 task. The
 * browser run itself is proven by `bench_artifact_selftest` (good separates from
 * bad, `--swap` goes red); these cases need no Chromium.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { load_artifact_corpus } from '../../src/scripts/_lib/bench_artifact_corpus.js';
import { AB_ROOT, REPO_ROOT, grade_primary } from '../../src/scripts/_lib/bench_artifact_graders.js';

const tmps: string[] = [];
afterEach(() => {
    for (const t of tmps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});
const task = () => load_artifact_corpus(path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-artifact-v2.yaml')).find((t) => t.id === 'art-dnd-01');

describe('art-dnd-01 and the browser-acceptance grader', () => {
    it('is graded by browser-acceptance against a held-back spec that exists', () => {
        const t = task();
        const primary = t?.graders.find((g) => g.role === 'primary');
        expect(primary?.id).toBe('browser-acceptance');
        expect(fs.existsSync(path.join(AB_ROOT, String(primary?.args?.['spec'])))).toBe(true);
    });
    it('the held-back spec covers mouse, touch, keyboard, the switch and both breakpoints', () => {
        const spec = JSON.parse(fs.readFileSync(path.join(AB_ROOT, 'hidden-artifact', 'art-dnd-01', 'acceptance.json'), 'utf-8')) as { tests: { steps: Record<string, unknown>[] }[] };
        const steps = spec.tests.flatMap((t) => t.steps);
        expect(steps.filter((s) => s['do'] === 'drag').map((s) => s['pointer']).sort()).toEqual(['mouse', 'touch']);
        expect(steps.some((s) => s['do'] === 'press' && s['key'] === 'Escape')).toBe(true);
        expect(steps.filter((s) => s['expect'] === 'layout').map((s) => s['relation']).sort()).toEqual(['below', 'right-of']);
        expect(steps.some((s) => s['expect'] === 'no-overflow')).toBe(true);
    });
    it('the untouched fixture fails on the missing deliverable without starting a browser', async () => {
        const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-test-'));
        tmps.push(ws);
        fs.cpSync(path.join(AB_ROOT, 'fixtures-artifact', 'art-dnd-01'), ws, { recursive: true });
        const r = await grade_primary(ws, task() as never);
        expect(r.status).toBe('fail');
        expect(r.checks).toEqual([{ id: 'deliverable-exists', status: 'fail', detail: 'out/index.html' }]);
    });
});
