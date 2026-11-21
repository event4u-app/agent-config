// The goal record — ratification round 11 (2026-11-21). A stop saved between a
// goal beat's read and its write must win on that very turn, not only on the
// next one: the beat renders what a fresh read shows after its write.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as FsAtomic from '../../src/scripts/_lib/fs_atomic.js';

const hook = vi.hoisted(() => ({ beforeWrite: null as (() => void) | null }));

vi.mock('../../src/scripts/_lib/fs_atomic.js', async (importOriginal) => {
    const orig = await importOriginal<typeof FsAtomic>();
    return {
        ...orig,
        write_atomic: (...args: Parameters<typeof orig.write_atomic>) => {
            const run = hook.beforeWrite;
            hook.beforeWrite = null;
            run?.();
            return orig.write_atomic(...args);
        },
    };
});

const { goal_mandate_block } = await import('../../src/scripts/_lib/goal_mandate.js');
const { goal_mandate_for_subagent } = await import('../../src/scripts/_lib/goal_mandate_store.js');

const T0 = new Date('2026-11-21T09:15:00Z');
const T1 = new Date('2026-11-21T10:40:00Z');

let root = '';
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-mandate-race-'));
    execFileSync('git', ['init', '-q', root]);
});
afterEach(() => {
    hook.beforeWrite = null;
    fs.rmSync(root, { recursive: true, force: true });
});

describe('goal beat racing a stop', () => {
    it.each([
        ['an equal stamp', T1],
        ['a later stamp', new Date('2026-11-21T11:00:00Z')],
    ])('a stop with %s saved between the read and the write suppresses the goal on the racing turn', (_label, stopAt) => {
        const dir = path.join(root, '.git', 'agent-session-mandates');
        hook.beforeWrite = () => {
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `s1.json.stop-${String(stopAt.getTime()).padStart(13, '0')}`), 'stop');
        };
        expect(goal_mandate_block(root, 's1', 'mach weiter bis zum merge', T1)).toBeNull();
        expect(goal_mandate_for_subagent(root, 's1')).toBeNull();
    });

    it('without a racing stop the goal renders on its own turn', () => {
        expect(goal_mandate_block(root, 's1', 'mach weiter bis zum merge', T0)).toContain('"mach weiter bis zum merge"');
    });
});
