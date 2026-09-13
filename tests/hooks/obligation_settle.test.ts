/**
 * obligation-settle — the turn-end reader, in shadow.
 *
 * Four properties are load-bearing and each has a named test below:
 * the touched set comes from the DIFF (so a heredoc write is seen), the
 * detector is silent while a subagent dispatch is open, it never refuses on a
 * class that could not have a discharge, and a missing set produces ONE row
 * rather than one per obligation.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    appendDelivered,
    appendDischarge,
    appendShadow,
    readShadow,
    stamp,
} from '../../src/scripts/_lib/obligations.js';
import {
    computeVerdict,
    shouldContinue,
    touchedPaths,
} from '../../src/scripts/hooks/obligation_settle_hook.js';

let root = '';

const git = (...args: string[]): void => {
    execFileSync('git', args, { cwd: root, stdio: 'pipe' });
};

/** A real git repo with a router whose rules carry path triggers. */
function makeRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settle-'));
    fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'dist', 'router.json'),
        JSON.stringify({
            kernel: [],
            tier_1: [],
            tier_2: [
                { id: 'ui-audit-gate', triggers: [{ path_prefix: 'components/' }] },
                { id: 'other-rule', triggers: [{ path_prefix: 'server/' }] },
            ],
        }),
        'utf-8',
    );
    return dir;
}

beforeEach(() => {
    root = makeRepo();
    git('init', '-q');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'T');
    git('add', '-A');
    git('commit', '-qm', 'base');
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

/** Write a file the way a shell heredoc would — no tool event carries its path. */
function heredocWrite(rel: string, body: string): void {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    execFileSync('sh', ['-c', `cat > '${full}' <<'EOF'\n${body}\nEOF`], { cwd: root });
}

/** Mark a subagent dispatch open, in the shape openRecordStats reads. */
function openDispatch(): void {
    const dir = path.join(root, 'agents', 'runtime', 'state', 'subagent-ledger', 'open');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'd1.json'),
        // The filename is the identity: a record whose `ref` disagrees with it
        // is refused, so the two must match.
        JSON.stringify({
            ref: 'd1',
            started_at: new Date().toISOString(),
            depth: 1,
            depth_basis: 'assumed-root',
        }),
        'utf-8',
    );
}

describe('the touched set comes from the diff, not from tool events', () => {
    it('sees a file created by a shell heredoc on a UI path', () => {
        // The verify for Phase 4.1. A tool event for this write carries one
        // Bash call and no path at all; only the tree knows what happened.
        heredocWrite('components/Widget.tsx', 'export const Widget = () => null;');
        expect(touchedPaths(root)).toContain('components/Widget.tsx');
    });

    it('sees a tracked file modified in place', () => {
        fs.mkdirSync(path.join(root, 'components'), { recursive: true });
        fs.writeFileSync(path.join(root, 'components', 'A.tsx'), 'v1', 'utf-8');
        git('add', '-A');
        git('commit', '-qm', 'add A');
        fs.writeFileSync(path.join(root, 'components', 'A.tsx'), 'v2', 'utf-8');
        expect(touchedPaths(root)).toContain('components/A.tsx');
    });

    it('excludes markdown, which is not a surface this detector speaks to', () => {
        heredocWrite('components/notes.md', '# notes');
        expect(touchedPaths(root)).not.toContain('components/notes.md');
    });

    it('is empty on a clean tree', () => {
        expect(touchedPaths(root)).toEqual([]);
    });
});

describe('computeVerdict', () => {
    it('flags a delivered, path-matched, refusable obligation with no discharge', () => {
        appendDelivered(root, 's1', [{ rule: 'ui-audit-gate', cls: 'hook', at: stamp() }]);
        heredocWrite('components/Widget.tsx', 'x');
        const v = computeVerdict(root, 's1');
        expect(v.candidates).toEqual(['ui-audit-gate']);
        expect(v.missing).toEqual(['ui-audit-gate']);
    });

    it('is clear once the discharge is recorded', () => {
        appendDelivered(root, 's1', [{ rule: 'ui-audit-gate', cls: 'hook', at: stamp() }]);
        appendDischarge(root, 's1', [{ rule: 'ui-audit-gate', by: 'design-pass', at: stamp() }]);
        heredocWrite('components/Widget.tsx', 'x');
        expect(computeVerdict(root, 's1').missing).toEqual([]);
    });

    it('NEVER flags a class that could not have a discharge', () => {
        // 69 of 97 delivered rules on the frozen corpus are class `none`.
        // Refusing on them would demand evidence nobody can produce.
        for (const cls of ['none', 'observer', 'instruction-only'] as const) {
            const session = `s-${cls}`;
            appendDelivered(root, session, [{ rule: 'ui-audit-gate', cls, at: stamp() }]);
            heredocWrite('components/Widget.tsx', 'x');
            expect(computeVerdict(root, session).missing, cls).toEqual([]);
        }
    });

    it('flags each refusable class', () => {
        for (const cls of ['hook', 'validator', 'test'] as const) {
            const session = `s-${cls}`;
            appendDelivered(root, session, [{ rule: 'ui-audit-gate', cls, at: stamp() }]);
            heredocWrite('components/Widget.tsx', 'x');
            expect(computeVerdict(root, session).missing, cls).toEqual(['ui-audit-gate']);
        }
    });

    it('ignores a delivered rule whose triggers match nothing this turn touched', () => {
        appendDelivered(root, 's1', [{ rule: 'other-rule', cls: 'hook', at: stamp() }]);
        heredocWrite('components/Widget.tsx', 'x');
        expect(computeVerdict(root, 's1').missing).toEqual([]);
    });

    it('is empty on a clean tree even with obligations delivered', () => {
        appendDelivered(root, 's1', [{ rule: 'ui-audit-gate', cls: 'hook', at: stamp() }]);
        expect(computeVerdict(root, 's1').missing).toEqual([]);
    });

    it('is empty when nothing was delivered', () => {
        heredocWrite('components/Widget.tsx', 'x');
        expect(computeVerdict(root, 's1').missing).toEqual([]);
    });
});

describe('an open subagent dispatch silences the detector', () => {
    it('reports dispatchOpen so the caller stays quiet', () => {
        // Phase 6.2's fixture. A subagent writing UI files is the canonical
        // case where the files are not the main session's to answer for.
        appendDelivered(root, 's1', [{ rule: 'ui-audit-gate', cls: 'hook', at: stamp() }]);
        heredocWrite('components/Widget.tsx', 'x');
        openDispatch();
        expect(computeVerdict(root, 's1').dispatchOpen).toBe(true);
    });

    it('reports dispatchOpen false when no dispatch is open', () => {
        heredocWrite('components/Widget.tsx', 'x');
        expect(computeVerdict(root, 's1').dispatchOpen).toBe(false);
    });
});

describe('continuation is one aggregate per missing set, and exhaustion leaves it open', () => {
    it('writes ONE row for five missing obligations, not five', () => {
        const missing = ['a', 'b', 'c', 'd', 'e'];
        expect(appendShadowRow(missing)).toBe(1);
        const rows = readShadow(root, 's1');
        expect(rows).toHaveLength(1);
        expect(rows[0]?.missing).toHaveLength(5);
    });

    it('increments the attempt when the SAME set is seen again', () => {
        expect(appendShadowRow(['a', 'b'])).toBe(1);
        expect(appendShadowRow(['a', 'b'])).toBe(2);
    });

    it('treats a set as the same regardless of order', () => {
        expect(appendShadowRow(['a', 'b'])).toBe(1);
        expect(appendShadowRow(['b', 'a'])).toBe(2);
    });

    it('starts a fresh count for a different set', () => {
        expect(appendShadowRow(['a', 'b'])).toBe(1);
        expect(appendShadowRow(['a', 'c'])).toBe(1);
    });

    it('stops forcing continuation once the set is unchanged', () => {
        expect(shouldContinue(1)).toBe(true);
        expect(shouldContinue(2)).toBe(false);
        expect(shouldContinue(3)).toBe(false);
    });

    it('NEVER writes a waived state — the obligations stay open', () => {
        appendShadowRow(['a']);
        appendShadowRow(['a']);
        appendShadowRow(['a']);
        const rows = readShadow(root, 's1');
        // Exhaustion is a fact about the budget. Every row still says the
        // obligation was missing; none says it was satisfied or waived.
        expect(rows).toHaveLength(3);
        for (const r of rows) expect(r.would_refuse).toBe(true);
        expect(JSON.stringify(rows)).not.toContain('waiv');
        expect(JSON.stringify(rows)).not.toContain('satisf');
    });

    function appendShadowRow(missing: string[]): number {
        return appendShadow(root, 's1', missing);
    }
});
