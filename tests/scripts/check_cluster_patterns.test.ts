// Tests for src/scripts/check_cluster_patterns.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (load_cluster_table, parse_frontmatter, check_dispatcher,
// build_slug_map) plus a golden-parity layer (python3 vs tsx) on the REAL
// REPO (skipped without python3).
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    build_slug_map,
    check_completeness,
    check_dispatcher,
    load_cluster_table,
    names_sub,
    parse_frontmatter,
    parse_routes_to,
} from '../../src/scripts/check_cluster_patterns.js';


describe('check_cluster_patterns — parse_frontmatter', () => {
    it('parses top-level keys only (skips indented)', () => {
        const [fm, body] = parse_frontmatter(
            '---\nname: fix\ncluster: fix\n  nested: skip\n---\n# /fix\n',
        );
        expect(fm['name']).toBe('fix');
        expect(fm['cluster']).toBe('fix');
        expect(fm['nested']).toBeUndefined();
        expect(body).toBe('# /fix\n');
    });

    it('returns empty fm + original text when no frontmatter', () => {
        const [fm, body] = parse_frontmatter('# /fix\n');
        expect(fm).toEqual({});
        expect(body).toBe('# /fix\n');
    });
});

describe('check_cluster_patterns — table + slug map', () => {
    it('load_cluster_table returns dispatch/flag rows from the real contract', () => {
        const rows = load_cluster_table();
        expect(rows.length).toBeGreaterThan(0);
        for (const [, kind] of rows) {
            expect(['dispatch', 'flag']).toContain(kind);
        }
    });

    it('build_slug_map returns physical paths keyed by canonical slug', () => {
        const m = build_slug_map();
        // Every value is a real command.md path.
        for (const p of m.values()) {
            expect(p.endsWith(path.join('command.md'))).toBe(true);
        }
    });

    it('check_dispatcher reports a missing dispatcher for an unknown slug', () => {
        const rep = check_dispatcher('definitely-not-a-cluster', new Map());
        expect(rep.errors.some((e) => e.startsWith('dispatcher file missing:'))).toBe(true);
    });
});


// --- Filesystem-enumeration completeness (road-to-renewal-leverage, 2026-08-02)
//
// The pre-existing checks all read the contract and ask "does what it names
// exist?". These cover the inverse direction — "does what exists get named?" —
// which is the class that let `/roadmap:materialize` and
// `/memory:learn-low-impact` sit on disk unnamed by their own hubs.

describe('check_cluster_patterns — parse_routes_to', () => {
    it('parses a list, trimming quotes and whitespace', () => {
        expect(parse_routes_to("[a, 'b' , \"c\"]")).toEqual(['a', 'b', 'c']);
    });

    it('returns [] for an absent, empty, or non-list value', () => {
        expect(parse_routes_to(undefined)).toEqual([]);
        expect(parse_routes_to('[]')).toEqual([]);
        expect(parse_routes_to('not-a-list')).toEqual([]);
    });
});

describe('check_cluster_patterns — names_sub', () => {
    it('accepts the colon form and the space form (both contract-legal)', () => {
        expect(names_sub('| `/roadmap:create` | x |', 'roadmap', 'create')).toBe(true);
        expect(names_sub('| `/memory add` | x |', 'memory', 'add')).toBe(true);
    });

    it('accepts a decorated row that keeps the name inside the backticks', () => {
        expect(names_sub('| `/team review [--background]` | x |', 'team', 'review')).toBe(true);
    });

    it('does not match a longer sub-command that merely starts with the name', () => {
        expect(names_sub('| `/tests:e2e-plan` |', 'tests', 'e2e')).toBe(false);
        expect(names_sub('| `/roadmap:process-full` |', 'roadmap', 'process')).toBe(false);
    });

    it('does not match a different cluster', () => {
        expect(names_sub('| `/other:create` |', 'module', 'create')).toBe(false);
    });
});

describe('check_cluster_patterns — check_completeness', () => {
    // The real `/roadmap` dispatcher is the fixture: it has 6 sub-command
    // directories on disk, so a hub body/frontmatter that omits one must fail.
    const roadmap = path.join(
        build_slug_map().get('roadmap') ?? '',
    );

    it('is a no-op for a non-orchestrator dispatcher', () => {
        expect(check_completeness('roadmap', roadmap, { type: 'command' }, '')).toEqual([]);
    });

    it('flags a sub-command that exists on disk but is named nowhere', () => {
        const errors = check_completeness('roadmap', roadmap, { type: 'orchestrator' }, '');
        expect(errors.some((e) => e.includes('`materialize`') && e.includes('## Sub-commands'))).toBe(true);
        expect(errors.some((e) => e.includes('`materialize`') && e.includes('routes_to'))).toBe(true);
    });

    it('accepts a hub that names every on-disk sub in both places', () => {
        const subs = ['ai-council', 'create', 'materialize', 'process-full', 'process-phase', 'process-step'];
        const body = subs.map((s) => `| \`/roadmap:${s}\` | x | y |`).join('\n');
        const fm = {
            type: 'orchestrator',
            routes_to: `[${subs.map((s) => `roadmap-${s}`).join(', ')}]`,
        };
        expect(check_completeness('roadmap', roadmap, fm, body)).toEqual([]);
    });

    it('accepts a bare sub name in routes_to as well as the prefixed slug', () => {
        const subs = ['ai-council', 'create', 'materialize', 'process-full', 'process-phase', 'process-step'];
        const body = subs.map((s) => `| \`/roadmap ${s}\` | x | y |`).join('\n');
        const fm = { type: 'orchestrator', routes_to: `[${subs.join(', ')}]` };
        expect(check_completeness('roadmap', roadmap, fm, body)).toEqual([]);
    });
});

// Deliberately NOT here: a repo-wide "every orchestrator is complete" witness.
// `check_cluster_patterns` is already a CI gate over exactly that fact, and a
// second assertion on the same shared state only makes one drift red twice, in
// two pipelines, on changes unrelated to this file.
