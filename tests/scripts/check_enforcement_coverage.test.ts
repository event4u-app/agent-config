/**
 * Enforcement-coverage resolver (road-to-enforcement-proof P1.2/P1.3).
 *
 * The cases below are the ones the resolver got wrong at least once while being
 * built — a declaration-only pass rated an orphaned linter as enforced, and an
 * over-loose transitive pass rated it enforced again via a docstring mention.
 * Both directions are pinned here so neither can silently return.
 */
import { describe, expect, it } from 'vitest';

import {
    mentions_as_code,
    parse_hook_manifest,
    read_frontmatter,
    resolve_one,
    strip_comments,
    strongest,
    type Resolution,
} from '../../src/scripts/check_enforcement_coverage.js';

const ctx = (over: Partial<Parameters<typeof resolve_one>[1]> = {}) => ({
    hooks: new Map([
        ['blocking-hook', true],
        ['instrumenting-hook', false],
    ]),
    exists: (rel: string) => rel !== 'src/scripts/gone.ts' && rel !== 'tests/gone.test.ts',
    // Reachable from a WORKFLOW — the headline class.
    reachable_ci: new Set<string>(['src/scripts/check_wired.ts', 'src/scripts/sub_check.ts']),
    // Reachable from a taskfile too (a superset of CI by construction), plus one
    // script only a taskfile names.
    reachable_local: new Set<string>([
        'src/scripts/check_wired.ts',
        'src/scripts/sub_check.ts',
        'src/scripts/task_only.ts',
    ]),
    ...over,
});

describe('resolve_one — resolution beats declaration', () => {
    it('credits a validator that CI actually reaches', () => {
        expect(resolve_one('validator:src/scripts/check_wired.ts', ctx()).resolution).toBe('validator');
    });

    it('credits a sub-check reachable only through a wired umbrella', () => {
        // sub_check.ts is named by no taskfile; it runs because an umbrella calls it.
        expect(resolve_one('validator:src/scripts/sub_check.ts', ctx()).resolution).toBe('validator');
    });

    it('refuses a validator that exists but runs nowhere', () => {
        const r = resolve_one('validator:src/scripts/orphan.ts', ctx());
        expect(r.resolution).toBe('unwired');
        expect(r.note).toMatch(/runs nowhere/);
    });

    it('reports a declared validator whose file is gone', () => {
        expect(resolve_one('validator:src/scripts/gone.ts', ctx()).resolution).toBe('missing');
    });
});

describe('resolve_one — which build fails', () => {
    // The correction this split exists for. The first version treated `taskfiles/`
    // and `.github/workflows/` as one corpus, so "named in a taskfile" resolved to
    // `validator` under a headline reading "can actually fail a build" — while NO
    // workflow invokes `task ci`. The gate committed the defect it was built to catch.
    it('credits a validator a workflow actually reaches', () => {
        expect(resolve_one('validator:src/scripts/check_wired.ts', ctx()).resolution).toBe('validator');
    });

    it('demotes a taskfile-only validator and says which build it fails', () => {
        const r = resolve_one('validator:src/scripts/task_only.ts', ctx());
        expect(r.resolution).toBe('validator-local');
        expect(r.note).toMatch(/no workflow runs it/);
    });

    it('still reports a validator nothing reaches as unwired', () => {
        expect(resolve_one('validator:src/scripts/orphan.ts', ctx()).resolution).toBe('unwired');
    });

    it('ranks local-only below a real backstop but above observer', () => {
        expect(strongest(['validator-local', 'validator'] as Resolution[])).toBe('validator');
        expect(strongest(['observer', 'validator-local'] as Resolution[])).toBe('validator-local');
    });
});

describe('resolve_one — blocking is not instrumenting', () => {
    it('credits a fail_closed hook as a hook', () => {
        expect(resolve_one('hook:blocking-hook', ctx()).resolution).toBe('hook');
    });

    it('downgrades a fail_closed:false hook to observer and says why', () => {
        const r = resolve_one('hook:instrumenting-hook', ctx());
        expect(r.resolution).toBe('observer');
        expect(r.note).toMatch(/cannot block/);
    });

    it('reports a hook that is not registered at all', () => {
        expect(resolve_one('hook:ghost', ctx()).resolution).toBe('missing');
    });

    it('treats an honest `none` as a counted gap, not an error', () => {
        const r = resolve_one('none', ctx());
        expect(r.resolution).toBe('none');
        expect(r.note).toBeUndefined();
    });
});

describe('strip_comments / mentions_as_code — a prose mention is not a call', () => {
    it('does not treat a name inside a line comment as an invocation', () => {
        const src = '// lint_output_slop.ts exists but is wired nowhere\nconst x = 1;\n';
        expect(mentions_as_code(strip_comments(src), 'lint_output_slop.ts', 'lint_output_slop')).toBe(false);
    });

    it('does not treat a name inside a block comment as an invocation', () => {
        const src = '/**\n * see lint_output_slop.ts for the orphan case\n */\nconst x = 1;\n';
        expect(mentions_as_code(strip_comments(src), 'lint_output_slop.ts', 'lint_output_slop')).toBe(false);
    });

    it('does treat a quoted specifier as an invocation', () => {
        const src = 'run("src/scripts/lint_output_slop.ts");\n';
        expect(mentions_as_code(strip_comments(src), 'lint_output_slop.ts', 'lint_output_slop')).toBe(true);
    });

    it('keeps a URL intact — `//` inside a string is not a comment', () => {
        const src = 'const u = "https://example.com/sub_check.ts";\n';
        expect(mentions_as_code(strip_comments(src), 'sub_check.ts', 'sub_check')).toBe(true);
    });
});

describe('strongest — a rule is credited with its best resolving backstop', () => {
    it('prefers validator over observer', () => {
        expect(strongest(['observer', 'validator'] as Resolution[])).toBe('validator');
    });

    it('prefers a real backstop over an unwired one', () => {
        expect(strongest(['unwired', 'hook'] as Resolution[])).toBe('hook');
    });

    it('reports no declaration as `none`', () => {
        expect(strongest([])).toBe('none');
    });

    it('does not let an unwired declaration outrank a missing one into coverage', () => {
        // Neither can fail a build; the point is only that both stay out of `blocking`.
        expect(['unwired', 'missing']).toContain(strongest(['missing', 'unwired'] as Resolution[]));
    });
});

describe('read_frontmatter — list values survive', () => {
    it('reads a block list', () => {
        const fm = read_frontmatter('---\ntype: "auto"\nenforced_by:\n  - "validator:a.ts"\n  - "hook:b"\n---\nbody\n');
        expect(fm['enforced_by']).toEqual(['validator:a.ts', 'hook:b']);
        expect(fm['type']).toBe('auto');
    });

    it('reads an inline list', () => {
        const fm = read_frontmatter('---\nenforced_by: ["none"]\n---\n');
        expect(fm['enforced_by']).toEqual(['none']);
    });

    it('returns nothing for a file without frontmatter', () => {
        expect(read_frontmatter('# just a heading\n')).toEqual({});
    });
});

describe('parse_hook_manifest', () => {
    const text = [
        'schema_version: 1',
        '',
        'concerns:',
        '  alpha:',
        '    script: src/scripts/a.ts',
        '    fail_closed: false',
        '  beta:',
        '    script: src/scripts/b.ts',
        '    fail_closed: true',
        '',
        'platforms:',
        '  claude:',
        '    fail_closed: true',
    ].join('\n');

    it('reads fail_closed per concern', () => {
        const m = parse_hook_manifest(text);
        expect(m.get('alpha')).toBe(false);
        expect(m.get('beta')).toBe(true);
    });

    it('stops at the end of the concerns block', () => {
        // `claude` lives under platforms: — it is not a concern and must not leak in.
        expect(parse_hook_manifest(text).has('claude')).toBe(false);
    });
});
