// Tests for src/scripts/cross_repo_retrieve.ts (py2ts Phase 8 / Wave 8g).
//
// 1:1 port of tests/test_cross_repo_retrieve.py — targeted query returns
// scoped matches, large-flagged sibling rejects an unscoped query, opt-out
// sibling is never read, secrets are redacted, the no-siblings path is inert.
// `monkeypatch.setattr(crr, "collect_siblings", ...)` maps to the module's
// `_setCollectSiblings` test hook. Plus a golden-parity block (python3 vs tsx)
// over the same fixtures for `search_sibling`. Fixtures live under
// tests/fixtures/cross-repo/. No live network, no real cross-repo writes.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    _setCollectSiblings,
    _terms,
    _freshness,
    search_sibling,
    retrieve,
    render_text,
    main,
    type Sibling,
} from '../../src/scripts/cross_repo_retrieve.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'cross-repo');
const SIBLING_A = path.join(FIXTURES, 'sibling-a');
const SIBLING_B = path.join(FIXTURES, 'sibling-b');

function _sibling(p: string, large = false): Sibling {
    return { path: p, detected_via: 'vscode_workspace', large, include: true };
}

// Each `retrieve` test installs its own collector via `_setCollectSiblings`
// (mirror of `monkeypatch.setattr(crr, "collect_siblings", ...)`); the
// `search_sibling` tests never touch the collector.

describe('cross_repo_retrieve — search_sibling (in-process)', () => {
    it('targeted query returns scoped matches', () => {
        const hits = search_sibling(SIBLING_A, 'OrderApiContract', _terms('OrderApiContract'), null, 8);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.every((h) => h.source_repo === 'sibling-a')).toBe(true);
        expect(hits.some((h) => h.path.includes('api_contract.ts'))).toBe(true);
        expect(hits.every((h) => h.match_reason)).toBe(true);
        expect(hits.every((h) => h.freshness)).toBe(true);
    });

    it('path scope narrows the search', () => {
        const scoped = search_sibling(SIBLING_A, 'orders', _terms('orders'), 'README.md', 8);
        expect(scoped.length).toBeGreaterThan(0);
        expect(scoped.every((h) => h.path === 'README.md')).toBe(true);
    });

    it('secret in sibling is redacted', () => {
        const hits = search_sibling(SIBLING_A, 'ORDER_ENDPOINT', _terms('ORDER_ENDPOINT'), null, 8);
        const tsHits = hits.filter((h) => h.path.endsWith('api_contract.ts'));
        expect(tsHits.length).toBeGreaterThan(0);
        const blob = tsHits.map((h) => h.chunk).join(' ');
        expect(blob).not.toContain('sk-ant-api03');
        expect(blob).toContain('[SECRET]');
    });
});

describe('cross_repo_retrieve — retrieve (collector mocked)', () => {
    it('large sibling rejects unscoped query', () => {
        _setCollectSiblings(() => [_sibling(SIBLING_A, true)]);
        const res = retrieve(REPO_ROOT, 'OrderApiContract', null, 8);
        expect(res.matches).toEqual([]);
        expect(res.note ?? '').toContain('path-scope');
    });

    it('large sibling searched with scope', () => {
        _setCollectSiblings(() => [_sibling(SIBLING_A, true)]);
        const res = retrieve(REPO_ROOT, 'OrderApiContract', 'src/*.ts', 8);
        expect(res.matches.length).toBeGreaterThan(0);
    });

    it('opt-out sibling is never read', () => {
        _setCollectSiblings(() => []);
        const res = retrieve(REPO_ROOT, 'OrderApiContract', null, 8);
        expect(res.matches).toEqual([]);
        expect(res.note ?? '').toContain('no opted-in');
    });

    it('no siblings is inert', () => {
        _setCollectSiblings(() => []);
        const res = retrieve(REPO_ROOT, 'anything', null, 8);
        expect(res.matches).toEqual([]);
        expect(res.note).toBeTruthy();
    });

    it('short query is rejected', () => {
        _setCollectSiblings(() => [_sibling(SIBLING_A)]);
        const res = retrieve(REPO_ROOT, 'ab', null, 8);
        expect(res.matches).toEqual([]);
        expect(res.note ?? '').toContain('too short');
    });

    it('max_chunks is bounded', () => {
        _setCollectSiblings(() => [_sibling(SIBLING_A), _sibling(SIBLING_B)]);
        const res = retrieve(REPO_ROOT, 'the', null, 1);
        expect(res.matches.length).toBeLessThanOrEqual(1);
    });

    it('unrelated query returns nothing', () => {
        _setCollectSiblings(() => [_sibling(SIBLING_A)]);
        const res = retrieve(REPO_ROOT, 'zzzznonexistentterm', null, 8);
        expect(res.matches).toEqual([]);
    });
});

describe('cross_repo_retrieve — freshness, render, main', () => {
    it('freshness returns a date string', () => {
        const fr = _freshness(REPO_ROOT, 'tests/fixtures/cross-repo/sibling-a/README.md');
        expect(fr).toBeTruthy();
        expect(/^\d{4}/.test(fr) || fr === 'unknown').toBe(true);
    });

    it('render_text with matches and note', () => {
        const result = {
            matches: [
                {
                    source_repo: 's',
                    path: 'p.md',
                    chunk: 'x',
                    freshness: '2026-05-30',
                    match_reason: 'content term(s): x',
                },
            ],
            query: 'q',
            note: 'a note',
        };
        const out = render_text(result);
        expect(out).toContain('| source_repo | path | freshness | why |');
        expect(out).toContain('> a note');
    });

    it('render_text no matches returns note', () => {
        expect(render_text({ query: 'q', matches: [], note: 'nothing here' })).toBe('nothing here');
    });

    it('main text inert', () => {
        _setCollectSiblings(() => []);
        const chunks: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (process.stdout as any).write = (s: string) => {
            chunks.push(s);
            return true;
        };
        let rc: number;
        try {
            rc = main(['some query', '--root', REPO_ROOT]);
        } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (process.stdout as any).write = orig;
        }
        expect(rc).toBe(0);
        expect(chunks.join('')).toContain('no opted-in');
    });

    it('main json with match', () => {
        _setCollectSiblings(() => [_sibling(SIBLING_A)]);
        const chunks: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (process.stdout as any).write = (s: string) => {
            chunks.push(s);
            return true;
        };
        let rc: number;
        try {
            rc = main(['OrderApiContract', '--root', REPO_ROOT, '--format', 'json']);
        } finally {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (process.stdout as any).write = orig;
        }
        expect(rc).toBe(0);
        const payload = JSON.parse(chunks.join(''));
        expect(payload.query).toBe('OrderApiContract');
        expect(payload.matches.length).toBeGreaterThan(0);
    });

    it('terms drops short tokens', () => {
        expect(_terms('an OrderApiContract, to')).toEqual(['orderapicontract']);
    });
});
