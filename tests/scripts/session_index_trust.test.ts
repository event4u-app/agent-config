/**
 * The six trust properties of the session-start memory index (D3).
 *
 * The AI-council ruling this implements demands a test PER PROPERTY, and the
 * reason is the one this suite is built around: a trust property whose refusal
 * nobody exercises is a property nobody has checked. So every describe block
 * below drives its property to a REFUSAL on a fixture built to violate exactly
 * that one thing, and the grant case sits beside it so the refusal is not
 * passing for a reason unrelated to the property.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
    canonical,
    capRows,
    claimSessionOnce,
    isContained,
    latchPath,
    MAX_ROOT_AGE_DAYS,
    newestCuratedMtimeMs,
    orderRows,
    SESSION_INDEX_ROW_CAP,
    verifyMemoryRoot,
} from '../../src/scripts/_lib/session_index_trust.js';

const temps: string[] = [];

afterAll(() => {
    for (const d of temps) fs.rmSync(d, { recursive: true, force: true });
});

/** A workspace with a real curated memory root, which every grant case needs. */
function workspace(opts: { curated?: boolean; mtime?: Date } = {}): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sit-')));
    temps.push(root);
    const mem = path.join(root, 'agents', 'memory');
    fs.mkdirSync(mem, { recursive: true });
    if (opts.curated !== false) {
        const f = path.join(mem, 'product-rules.yml');
        fs.writeFileSync(f, 'version: 1\nentries: []\n');
        if (opts.mtime) fs.utimesSync(f, opts.mtime, opts.mtime);
    }
    return root;
}

describe('P1 — repository and worktree identity', () => {
    it('grants a memory root that lives inside the workspace it was checked against', () => {
        const root = workspace();
        const v = verifyMemoryRoot({ workspaceRoot: root });
        expect(v.ok).toBe(true);
        if (v.ok) {
            expect(v.memoryRoot).toBe(path.join(root, 'agents', 'memory'));
            expect(v.workspaceRoot).toBe(root);
        }
    });

    it('REFUSES a memory root symlinked out of the workspace — the wrong-root case', () => {
        // The threat in one fixture: two checkouts, and this one's `agents/memory`
        // points at the other one's. Every path string still looks local.
        const other = workspace();
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sit-victim-')));
        temps.push(root);
        fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
        fs.symlinkSync(path.join(other, 'agents', 'memory'), path.join(root, 'agents', 'memory'));

        const v = verifyMemoryRoot({ workspaceRoot: root });
        expect(v.ok).toBe(false);
        if (!v.ok) {
            expect(v.code).toBe('memory-root-escapes-workspace');
            expect(v.detail).toContain('another tree');
        }
    });

    it('REFUSES a relative root that climbs out with `..`', () => {
        const root = workspace();
        const v = verifyMemoryRoot({ workspaceRoot: root, relativeMemoryRoot: path.join('..', '..', 'tmp') });
        expect(v.ok).toBe(false);
        if (!v.ok) expect(v.code).toBe('memory-root-escapes-workspace');
    });

    it('REFUSES an absent memory root rather than treating it as empty', () => {
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sit-bare-')));
        temps.push(root);
        const v = verifyMemoryRoot({ workspaceRoot: root });
        expect(v.ok).toBe(false);
        if (!v.ok) expect(v.code).toBe('memory-root-absent');
    });

    it('REFUSES a workspace root that does not resolve at all', () => {
        const v = verifyMemoryRoot({ workspaceRoot: path.join(os.tmpdir(), 'sit-does-not-exist-9f3a') });
        expect(v.ok).toBe(false);
        if (!v.ok) expect(v.code).toBe('workspace-root-unresolvable');
    });
});

describe('P2 — path canonicalization', () => {
    it('containment is decided on SEGMENTS, so a shared prefix is not containment', () => {
        // The bug a string prefix test has: `/a/bc`.startsWith(`/a/b`) is true.
        expect(isContained(path.join('/a', 'bc'), path.join('/a', 'b'))).toBe(false);
        expect(isContained(path.join('/a', 'b', 'c'), path.join('/a', 'b'))).toBe(true);
        expect(isContained('/a/b', '/a/b')).toBe(true);
        expect(isContained('/a', path.join('/a', 'b'))).toBe(false);
    });

    it('canonicalizes before comparing — a symlinked WORKSPACE still grants', () => {
        // The inverse of P1's refusal, and it must not be collateral damage:
        // reaching a legitimate workspace through a symlink is normal.
        const real = workspace();
        const link = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sit-link-'))), 'ws');
        temps.push(path.dirname(link));
        fs.symlinkSync(real, link);
        const v = verifyMemoryRoot({ workspaceRoot: link });
        expect(v.ok).toBe(true);
        if (v.ok) expect(v.workspaceRoot).toBe(real);
    });

    it('canonical() returns null rather than throwing on an unresolvable path', () => {
        expect(canonical(path.join(os.tmpdir(), 'sit-nope-7b21'))).toBeNull();
        expect(canonical(os.tmpdir())).not.toBeNull();
    });
});

describe('P3 — freshness', () => {
    it('reads the newest curated source mtime, and 0 when the root carries none', () => {
        const withFile = workspace();
        expect(newestCuratedMtimeMs(path.join(withFile, 'agents', 'memory'))).toBeGreaterThan(0);
        const bare = workspace({ curated: false });
        expect(newestCuratedMtimeMs(path.join(bare, 'agents', 'memory'))).toBe(0);
    });

    it('REFUSES a source dated in the future — clock skew or tampering', () => {
        const future = new Date(Date.now() + 86_400_000);
        const root = workspace({ mtime: future });
        const v = verifyMemoryRoot({ workspaceRoot: root });
        expect(v.ok).toBe(false);
        if (!v.ok) expect(v.code).toBe('source-mtime-in-future');
    });

    it('REFUSES a root past the abandonment bound', () => {
        const old = new Date(Date.now() - (MAX_ROOT_AGE_DAYS + 10) * 86_400_000);
        const root = workspace({ mtime: old });
        const v = verifyMemoryRoot({ workspaceRoot: root });
        expect(v.ok).toBe(false);
        if (!v.ok) {
            expect(v.code).toBe('memory-root-abandoned');
            expect(v.detail).toContain(String(MAX_ROOT_AGE_DAYS));
        }
    });

    it('GRANTS a quiet-but-not-abandoned root, so the bound catches abandonment only', () => {
        // Curated memory is deliberately long-lived; a 90-day-old stable file is
        // not stale. This is the case that would fire if the bound were tightened
        // to something that sounds prudent.
        const quiet = new Date(Date.now() - 90 * 86_400_000);
        const v = verifyMemoryRoot({ workspaceRoot: workspace({ mtime: quiet }) });
        expect(v.ok).toBe(true);
    });

    it('a bare root is "nothing to be stale about", not abandoned', () => {
        const v = verifyMemoryRoot({ workspaceRoot: workspace({ curated: false }) });
        expect(v.ok).toBe(true);
        if (v.ok) expect(v.newestSourceMs).toBe(0);
    });
});

describe('P4 — ordering', () => {
    const rows = [
        { id: 'b', title: 'B', tokens_estimate: 50 },
        { id: 'a', title: 'A', tokens_estimate: 50 },
        { id: 'c', title: 'C', tokens_estimate: 10 },
    ];

    it('orders cheapest first, so a fixed cap carries the most entries it can', () => {
        expect(orderRows(rows).map((r) => r.id)).toEqual(['c', 'a', 'b']);
    });

    it('is a TOTAL order — equal cost breaks on id, so the sort is deterministic', () => {
        // Without the tie-break, `a` and `b` are equal and an unstable sort may
        // return either, which makes the capped corpus differ between runs.
        const shuffled = [rows[1], rows[0]] as typeof rows;
        expect(orderRows(shuffled).map((r) => r.id)).toEqual(['a', 'b']);
        expect(orderRows([rows[0], rows[1]] as typeof rows).map((r) => r.id)).toEqual(['a', 'b']);
    });

    it('does not mutate its input', () => {
        const before = rows.map((r) => r.id);
        orderRows(rows);
        expect(rows.map((r) => r.id)).toEqual(before);
    });
});

describe('P5 — duplicate invocation', () => {
    it('the FIRST claim wins and the second REFUSES', () => {
        const root = workspace();
        expect(claimSessionOnce(root, 'sess-1').ok).toBe(true);
        const second = claimSessionOnce(root, 'sess-1');
        expect(second.ok).toBe(false);
        if (!second.ok) expect(second.code).toBe('already-injected-this-session');
    });

    it('latches per session, so a different session is unaffected', () => {
        const root = workspace();
        expect(claimSessionOnce(root, 'sess-a').ok).toBe(true);
        expect(claimSessionOnce(root, 'sess-b').ok).toBe(true);
    });

    it('sanitises the session id into the latch filename', () => {
        const p = latchPath('/ws', '../../etc/passwd');
        expect(path.basename(p)).not.toContain('/');
        expect(isContained(p, path.join('/ws', 'agents', 'runtime', 'state'))).toBe(true);
    });

    it('cannot latch without a session id, and says so by granting once', () => {
        expect(claimSessionOnce(workspace(), '').ok).toBe(true);
    });
});

describe('P6 — size limits', () => {
    const many = Array.from({ length: 100 }, (_, i) => i);

    it('caps at the module ceiling', () => {
        expect(capRows(many).length).toBe(SESSION_INDEX_ROW_CAP);
    });

    it('honours a smaller cap but never a larger one', () => {
        expect(capRows(many, 5).length).toBe(5);
        expect(capRows(many, 5_000).length).toBe(SESSION_INDEX_ROW_CAP);
    });

    it('falls back to the ceiling on a nonsense cap rather than emitting everything', () => {
        expect(capRows(many, 0).length).toBe(SESSION_INDEX_ROW_CAP);
        expect(capRows(many, -1).length).toBe(SESSION_INDEX_ROW_CAP);
        expect(capRows(many, Number.NaN).length).toBe(SESSION_INDEX_ROW_CAP);
    });

    it('caps AFTER ordering — the two together decide which rows survive', () => {
        const rows = [
            { id: 'expensive', title: 'x', tokens_estimate: 900 },
            { id: 'cheap', title: 'c', tokens_estimate: 1 },
        ];
        expect(capRows(orderRows(rows), 1).map((r) => r.id)).toEqual(['cheap']);
    });
});
