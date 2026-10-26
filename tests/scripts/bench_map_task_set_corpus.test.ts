// Task set T: every hidden check must be red on the untouched fixture and on
// the naive change the prompt literally asks for, and green on the reference
// change. A check that is never red measures nothing; a check that is never
// green makes every arm look equally wrong.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import {
    MAP_AREAS,
    MAP_FIXTURES_ROOT,
    apply_reference,
    evaluate_hidden_check,
    load_map_tasks,
    type MapTask,
} from '../../src/scripts/_lib/bench_map_metrics.js';

const tasks = load_map_tasks();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'map-task-set-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function copyFixture(task: MapTask, label: string): string {
    const dest = path.join(tmp, `${task.id}-${label}`);
    fs.cpSync(path.join(MAP_FIXTURES_ROOT, task.fixture), dest, { recursive: true });
    return dest;
}

describe('map task set — shape', () => {
    it('holds 20–30 tasks with unique ids', () => {
        expect(tasks.length).toBeGreaterThanOrEqual(20);
        expect(tasks.length).toBeLessThanOrEqual(30);
        expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
    });

    it('covers every area with at least three tasks', () => {
        for (const area of MAP_AREAS) {
            expect(tasks.filter((t) => t.area === area).length, area).toBeGreaterThanOrEqual(3);
        }
        expect(tasks.every((t) => (MAP_AREAS as readonly string[]).includes(t.area))).toBe(true);
    });

    it('names every protected place in the affected set', () => {
        for (const t of tasks) {
            const ids = new Set(t.affected.map((a) => a.id));
            for (const a of t.hidden_check) {
                if (a.protects !== undefined) expect(ids.has(a.protects), `${t.id}: ${a.protects}`).toBe(true);
            }
        }
    });

    it('plants at least one dependent beyond the place the prompt names', () => {
        for (const t of tasks) {
            const files = t.affected.filter((a) => a.kind === 'file').map((a) => a.id);
            expect(files.filter((f) => !t.primary.includes(f)).length, t.id).toBeGreaterThanOrEqual(1);
        }
    });

    it('keeps the hidden check and the reference out of the agent working copy', () => {
        for (const t of tasks) {
            expect(path.dirname(t.fixture), t.id).toBe(path.dirname(t.reference));
            expect(t.fixture.endsWith('/repo') && t.reference.endsWith('/solution'), t.id).toBe(true);
        }
    });
});

describe.each(tasks.map((t) => [t.id, t] as const))('hidden check — %s', (_id, task) => {
    it('fails on the unmodified fixture', () => {
        const r = evaluate_hidden_check(task, copyFixture(task, 'pristine'));
        expect(r.pass).toBe(false);
        expect(r.failures.length).toBeGreaterThan(0);
    });

    it('fails on the naive change and names a broken dependent', () => {
        const root = copyFixture(task, 'naive');
        apply_reference(task, MAP_FIXTURES_ROOT, root, task.primary);
        const r = evaluate_hidden_check(task, root);
        expect(r.pass).toBe(false);
        expect(r.broken_dependents.some((d) => !task.primary.includes(d))).toBe(true);
    });

    it('passes on the reference change', () => {
        const root = copyFixture(task, 'reference');
        apply_reference(task, MAP_FIXTURES_ROOT, root);
        const r = evaluate_hidden_check(task, root);
        expect(r.failures).toEqual([]);
        expect(r.pass).toBe(true);
    });
});
