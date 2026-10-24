/**
 * Step 7.2 of road-to-authority-routing-mechanism: the live-tree check
 * classification is implemented by holding every invocation of the 16 checks to
 * src/config/live-tree-check-classes.json. An invariant stays blocking where it
 * runs; an observation-only invocation stays non-blocking; an invariant that
 * does not block carries a recorded demotion and reason; and no invocation can
 * appear, disappear or change its blocking silently.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { type Invocation, taskfileInvocations, workflowInvocations } from '../../src/scripts/_lib/gate_invocations.js';

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/live-tree-check-classes.json'), 'utf8')) as {
    provisional: boolean;
    revisable: string;
    invocations: (Invocation & { check: string; aspects: Record<string, string>; demoted?: string[]; demotion_reason?: string })[];
};
const WORKFLOWS = ['.github/workflows/standing-payload-delta.yml', '.github/workflows/rule-backstops.yml', '.github/workflows/tests.yml'];
const TASKFILES = ['taskfiles/ci-fast.yml', 'taskfiles/content.yml', 'taskfiles/engine.yml'];
const CHECKS = [...new Set(CONFIG.invocations.map((e) => e.check))];
const key = (i: { file: string; where: string; flags: string[] }): string => `${i.file} :: ${i.where} :: ${i.flags.join(' ')}`;

function actual(root: string): Map<string, Invocation & { check: string }> {
    const out = new Map<string, Invocation & { check: string }>();
    for (const check of CHECKS) {
        for (const i of [...WORKFLOWS.flatMap((f) => workflowInvocations(root, f, check)), ...TASKFILES.flatMap((f) => taskfileInvocations(root, f, check))]) {
            out.set(`${check} @ ${key(i)}`, { ...i, check });
        }
    }
    return out;
}

describe('7.2 — live-tree check classification is implemented and cannot drift silently', () => {
    const found = actual(ROOT);

    it('the classification is marked provisional and revisable', () => {
        expect(CONFIG.provisional).toBe(true);
        expect(CONFIG.revisable.length).toBeGreaterThan(40);
        expect(CHECKS).toHaveLength(16);
    });

    it('every invocation in the workflows and taskfiles is classified, and every classified one exists', () => {
        const declared = new Set(CONFIG.invocations.map((e) => `${e.check} @ ${key(e)}`));
        expect([...found.keys()].filter((k) => !declared.has(k))).toEqual([]);
        expect([...declared].filter((k) => !found.has(k))).toEqual([]);
    });

    it('each invocation blocks exactly as classified', () => {
        for (const e of CONFIG.invocations) {
            expect({ at: `${e.check} @ ${key(e)}`, blocking: found.get(`${e.check} @ ${key(e)}`)?.blocking }).toEqual({ at: `${e.check} @ ${key(e)}`, blocking: e.blocking });
        }
    });

    it('an invariant aspect is never non-blocking without a recorded demotion and reason', () => {
        for (const e of CONFIG.invocations) {
            const invariants = Object.entries(e.aspects).filter(([, c]) => c === 'invariant').map(([id]) => id);
            if (e.blocking) continue;
            expect({ at: key(e), demoted: e.demoted ?? [] }).toEqual({ at: key(e), demoted: invariants });
            if (invariants.length > 0) expect((e.demotion_reason ?? '').length).toBeGreaterThan(60);
        }
    });

    it('an invocation whose active aspects are all observations is non-blocking', () => {
        for (const e of CONFIG.invocations) {
            const classes = Object.values(e.aspects);
            if (classes.length > 0 && classes.every((c) => c === 'observation')) expect({ at: key(e), blocking: e.blocking }).toEqual({ at: key(e), blocking: false });
        }
    });

    it('a step that becomes continue-on-error is detected as a silent weakening', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cls-'));
        try {
            for (const f of [...WORKFLOWS, ...TASKFILES]) {
                fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
                fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
            }
            const wf = path.join(tmp, '.github/workflows/standing-payload-delta.yml');
            const text = fs.readFileSync(wf, 'utf8');
            const step = '- name: Drain 3.2c — auto-rule description cap';
            expect(text.includes(step)).toBe(true);
            fs.writeFileSync(wf, text.replace(step, `${step}\n        continue-on-error: true`));
            const weakened = actual(tmp).get('check_augment_description_cap @ .github/workflows/standing-payload-delta.yml :: Drain 3.2c — auto-rule description cap :: ');
            expect(weakened?.blocking).toBe(false);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
