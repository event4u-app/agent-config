/**
 * H.1 — one bug record, local only. Synthetic tracker JSON only: no real
 * issue id, title or message appears in this file.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bugsPath, buildStore, fromQueryTime, importSnapshot, normalizeSentryIssue, parseSnapshot, readStore } from '../../src/scripts/code_graph/bugs.js';

const frame = (filename: string, lineNo: number, fn: string, inApp = true) => ({ filename, lineNo, function: fn, inApp });

const issue = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    title: 'SyntheticError: planted title text',
    culprit: 'planted culprit',
    status: 'resolved',
    count: '42',
    firstSeen: '2026-09-01T10:00:00Z',
    lastSeen: '2026-09-20T10:00:00Z',
    firstRelease: { version: 'app@1.2.0' },
    project: { slug: 'web' },
    tags: [{ key: 'environment', topValues: [{ value: 'production' }] }],
    events: [
        {
            environment: 'staging',
            user: { id: 'u-1', email: 'someone@example.com', ip_address: '10.0.0.1' },
            request: { cookies: 'session=planted', data: { password: 'planted' } },
            breadcrumbs: { values: [{ message: 'planted breadcrumb' }] },
            entries: [
                {
                    type: 'exception',
                    data: { values: [{ stacktrace: { frames: [frame('node_modules/lib.js', 1, 'vendor', false), frame('src/app/total.ts', 12, 'sumLines'), frame('src/app/cart.ts', 40, 'checkout')] } }] },
                },
            ],
        },
    ],
    ...extra,
});

let dir: string;
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bugs-import-'));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('normalizeSentryIssue', () => {
    it('builds a qualified id and keeps only allowlisted fields', () => {
        const r = normalizeSentryIssue(issue('1001'), 'acme');
        expect(r?.id).toBe('sentry:acme/web/1001');
        expect(r?.count).toBe(42);
        expect(r?.first_release).toBe('app@1.2.0');
        expect(r?.environments).toEqual(['production', 'staging']);
        const text = JSON.stringify(r);
        for (const leaked of ['planted', 'example.com', '10.0.0.1', 'u-1', 'cookies', 'breadcrumb', 'title']) expect(text).not.toContain(leaked);
    });

    it('keeps in-app frames only, innermost first', () => {
        const r = normalizeSentryIssue(issue('1002'), 'acme');
        expect(r?.frames).toEqual([
            { file: 'src/app/cart.ts', line: 40, function: 'checkout' },
            { file: 'src/app/total.ts', line: 12, function: 'sumLines' },
        ]);
    });

    it('splits a regressing issue into episodes, each with its own fix', () => {
        const r = normalizeSentryIssue(
            issue('1003', {
                status: 'unresolved',
                activity: [
                    { type: 'set_resolved_in_commit', dateCreated: '2026-09-05T00:00:00Z', data: { commit: { id: 'abcdef1234567' } } },
                    { type: 'set_regression', dateCreated: '2026-09-10T00:00:00Z', data: {} },
                    { type: 'set_resolved_in_release', dateCreated: '2026-09-15T00:00:00Z', data: { version: 'app@1.3.0' } },
                    { type: 'set_regression', dateCreated: '2026-09-18T00:00:00Z', data: {} },
                ],
            }),
            'acme',
        );
        expect(r?.episodes.map((e) => [e.opened.slice(0, 10), e.closed?.slice(0, 10) ?? null, e.resolved_in_commit, e.resolved_in_release])).toEqual([
            ['2026-09-01', '2026-09-05', 'abcdef1234567', null],
            ['2026-09-10', '2026-09-15', null, 'app@1.3.0'],
            ['2026-09-18', null, null, null],
        ]);
    });

    it('treats provider text as untrusted: control characters are stripped and an odd id is refused', () => {
        const r = normalizeSentryIssue(issue('1004', { project: { slug: 'we‮b\u0007' } }), 'acme');
        expect(r?.project).toBe('we b');
        expect(normalizeSentryIssue(issue('../../etc'), 'acme')).toBeNull();
    });
});

describe('store', () => {
    it('one fix closing several issues is indexed by commit', () => {
        const a = normalizeSentryIssue(issue('2001', { statusDetails: { inCommit: { commit: 'feedbeef0001' } } }), 'acme');
        const b = normalizeSentryIssue(issue('2002', { statusDetails: { inCommit: { commit: 'feedbeef0001' } } }), 'acme');
        const store = buildStore([b!, a!], 'snapshot-import', new Date('2026-10-01T00:00:00Z'));
        expect(store.fixes['feedbeef0001']).toEqual(['sentry:acme/web/2001', 'sentry:acme/web/2002']);
    });

    it('import writes 0600 under .build/bugs with a retrieval date and TTL; an expired store reads as absent', () => {
        const snap = path.join(dir, 'snap.json');
        fs.writeFileSync(snap, JSON.stringify({ provider: 'sentry', org: 'acme', issues: [issue('3001')] }));
        const build = path.join(dir, '.build');
        const store = importSnapshot(snap, build, { now: new Date('2026-10-01T00:00:00Z'), ttlDays: 7 });
        expect(store.bugs).toHaveLength(1);
        expect(fs.statSync(bugsPath(build)).mode & 0o777).toBe(0o600);
        expect(readStore(build, new Date('2026-10-05T00:00:00Z'))?.retrieved_at).toBe('2026-10-01T00:00:00.000Z');
        expect(readStore(build, new Date('2026-10-20T00:00:00Z'))).toBeNull();
    });

    it('refuses a provider it has no mapping for', () => {
        expect(() => parseSnapshot(JSON.stringify({ provider: 'other', issues: [] }))).toThrow(/no mapping/);
    });

    it('the query-time path normalises what the user-supplied fetcher returns and persists nothing by default', async () => {
        const store = await fromQueryTime(async () => [issue('4001')], 'acme', { now: new Date('2026-10-01T00:00:00Z') });
        expect(store.source).toBe('query-time');
        expect(store.bugs[0]?.id).toBe('sentry:acme/web/4001');
        expect(fs.readdirSync(dir)).toEqual([]);
    });
});
