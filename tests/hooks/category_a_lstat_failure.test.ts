/**
 * A resolution failure in category A must withhold the allow, never throw.
 *
 * Council review 2026-10-21, round 6: `lstatSync` ran outside any `try`, so a
 * filesystem error between `realpathSync` reporting `ENOENT` and the probe (a
 * race, a permission change) escaped the classifier. An uncaught throw ends the
 * dispatcher with exit 1, which Claude Code does not read as a block, so a
 * `deny` another concern already voted would be lost with it.
 *
 * Round 7 asked for the failure paths end to end through `_permission_for`:
 * the candidate's `ENOENT` followed by an `lstat` error, a direct `ELOOP`, and a
 * root that cannot be resolved. The filesystem is mocked because none of the
 * three can be produced deterministically on a real one.
 */
import { describe, expect, it, vi } from 'vitest';

const BAD_ROOT = '/category-a-unresolvable-root';

vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>();
    const fail = (code: string) => {
        throw Object.assign(new Error(code), { code });
    };
    return {
        ...actual,
        realpathSync: (p: string) => {
            const s = String(p);
            if (s.endsWith('racy')) return fail('ENOENT');
            if (s.endsWith('loopy')) return fail('ELOOP');
            if (s === BAD_ROOT) return fail('EACCES');
            if (s.startsWith(`${BAD_ROOT}/`)) return s;
            return actual.realpathSync(p);
        },
        lstatSync: (p: string, opts?: unknown) => {
            if (String(p).endsWith('racy')) return fail('EACCES');
            return actual.lstatSync(p, opts as never);
        },
    };
});

const { isCategoryA } = await import('../../src/scripts/hooks/category_a.js');
const { _permission_for } = await import('../../src/scripts/hooks/permission_gate.js');

function allowOf(command: string, cwd: string) {
    return _permission_for(
        'pre_tool_use',
        { payload: { tool_name: 'Bash', tool_input: { command }, cwd }, workspace_root: cwd },
        0,
        ['allow'],
    );
}

describe('category A resolution failures withhold the allow', () => {
    it('lstat-failure-withholds: an lstat error after ENOENT is not inside, and does not throw', () => {
        expect(() => isCategoryA('Bash', { command: 'cat racy' }, process.cwd())).not.toThrow();
        expect(isCategoryA('Bash', { command: 'cat racy' }, process.cwd())).toBe(false);
        expect(allowOf('cat racy', process.cwd())).toBeNull();
        expect(allowOf('sort -o racy package.json', process.cwd())).toBeNull();
    });

    it('eloop-withholds: a candidate that loops is not inside', () => {
        expect(allowOf('cat loopy', process.cwd())).toBeNull();
    });

    it('root-failure-withholds: a root that cannot be resolved confines nothing', () => {
        expect(allowOf('cat src/x.ts', BAD_ROOT)).toBeNull();
    });

    it('control: the same shapes on a resolvable path keep the allow', () => {
        expect(allowOf('cat package.json', process.cwd())?.decision).toBe('allow');
    });
});
