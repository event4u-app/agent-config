/**
 * Tests for `src/scripts/_lib/source_shape.ts` — the attribution-shape
 * heuristic (`road-to-source-silence` Phase 3.2).
 *
 * Two obligations came out of the resolved `how-loud-the-slug-heuristic-is`
 * blocker and both are asserted here rather than described:
 *
 * 1. The tier is **block inside `agents/**`, warn elsewhere**.
 * 2. The heuristic is "narrowly defined and **tested against its likely false
 *    positives** — filesystem paths, scoped package names (`@scope/name`), and
 *    Markdown links".
 *
 * The negatives are their own `describe` block, not rows appended to a positive
 * corpus. A pattern gate that is never shown the shapes it must stay silent on
 * has untested polarity, and a green suite then says nothing at all.
 *
 * Every token below is invented. Nothing in this file names a real source.
 */
import { describe, expect, it } from 'vitest';

import {
    isOpaqueRoundId,
    repoSlugHits,
    shapeHits,
    shapePathHits,
    sourceHeaderHits,
    tierFor,
    tmpQuoteHits,
} from '../../src/scripts/_lib/source_shape.js';

describe('source_shape — the three blocking fixtures from Phase 3.2', () => {
    it('fires on a speaking `> **Source:**` header', () => {
        const hits = shapeHits('> **Source:** the-external-thing we read in June');
        expect(hits.map((h) => h.cls)).toContain('source-header');
    });

    it('fires on a speaking agents/tmp quote', () => {
        const hits = shapeHits('see `agents/tmp.old/some-speaking-round/` for the intake');
        expect(hits.map((h) => h.cls)).toContain('tmp-quote');
    });

    it('fires on an un-allowlisted github.com slug', () => {
        const hits = shapeHits('https://github.com/some-unlisted-owner/some-repo');
        expect(hits.map((h) => h.cls)).toContain('repo-slug');
    });
});

describe('source_shape — what silences each class', () => {
    it('an ENC1 token is an accepted Source value', () => {
        expect(sourceHeaderHits('> **Source:** ENC1:YWJjZGVmZ2hpamtsbW5vcA==')).toEqual([]);
    });

    it('an opaque round identifier is an accepted Source value', () => {
        expect(sourceHeaderHits('> **Source:** inbox-2026-08-g')).toEqual([]);
        expect(sourceHeaderHits('> **Source:** S17')).toEqual([]);
    });

    it('an opaque round identifier is an accepted tmp directory name', () => {
        expect(tmpQuoteHits('agents/tmp/inbox-2026-08-g/notes.md')).toEqual([]);
        expect(tmpQuoteHits('agents/tmp.old/round-a1b2c3d4/notes.md')).toEqual([]);
    });

    it('an allowlisted owner is not a repo-slug hit', () => {
        expect(repoSlugHits('https://github.com/event4u-app/agent-config')).toEqual([]);
        expect(repoSlugHits('https://github.com/anthropics/claude-code')).toEqual([]);
        // GitHub's own reserved first segments are not owners at all.
        expect(repoSlugHits('https://github.com/sponsors/someone')).toEqual([]);
    });

    it('a Source header pointing at a tmp directory is judged ONCE, by the directory name', () => {
        // Otherwise one line would raise two ratchet counts and the two classes
        // would move together, which makes the numbers unreadable.
        const hits = shapeHits('> **Source:** agents/tmp.old/some-speaking-round/');
        expect(hits.map((h) => h.cls)).toEqual(['tmp-quote']);
    });

    it('isOpaqueRoundId accepts the documented forms and nothing else', () => {
        for (const ok of ['inbox-2026-08-g', 'inbox-2026-08', 'round-a1b2c3', 'set-deadbeef', 'S17', 's4']) {
            expect(isOpaqueRoundId(ok)).toBe(true);
        }
        for (const no of ['some-vendor-review', 'june-harvest', 'inbox-notes', 'round-two', '']) {
            expect(isOpaqueRoundId(no)).toBe(false);
        }
    });
});

describe('source_shape — likely false positives, named by the council', () => {
    // These are the three shapes the council said the heuristic must be tested
    // against. Each is asserted SILENT, which is the polarity half.

    it('is silent on ordinary filesystem paths', () => {
        for (const line of [
            'edit src/scripts/check_no_external_sources.ts and re-run',
            'the contract lives at docs/contracts/evidence-artifact-types.md',
            'see ./agents/roadmaps/archive/ for the frozen record',
            '/Users/someone/projects/thing/file.ts is a local path',
            '../relative/path/to/file',
        ]) {
            expect(shapeHits(line)).toEqual([]);
        }
    });

    it('is silent on scoped package names', () => {
        for (const line of [
            'install @scope/name from the registry',
            'the bundle pulls @anthropic-ai/claude-code and @types/node',
            '"@vitest/coverage-v8": "^2.1.9"',
        ]) {
            expect(shapeHits(line)).toEqual([]);
        }
    });

    it('is silent on Markdown links whose target is a repo path', () => {
        for (const line of [
            'see [the gate](src/scripts/check_no_external_sources.ts) for detail',
            'per [`agents-layout`](docs/contracts/agents-layout.md) the tree is fixed',
            '[a](b/c) and [d](e/f) are both link syntax, not slugs',
        ]) {
            expect(shapeHits(line)).toEqual([]);
        }
    });

    it('is silent on ratio, enumeration and path-like prose', () => {
        // The measured top false positives of the REMOVED bare-slug class. They
        // are pinned here so a future attempt to reintroduce that class has to
        // pass them first.
        for (const line of [
            'the response is text/markdown, not text/html',
            'inspired by the origin/main workflow we adopted',
            'ported from the JS/TS split described earlier',
            'a before/after comparison of the CI/CD pipeline',
            'derived from a 403/404 distinction in the request/response cycle',
            'adapted from the skill/rule boundary and the read/write split',
        ]) {
            expect(shapeHits(line)).toEqual([]);
        }
    });

    it('is silent on a github.com URL that is not a repository', () => {
        // Bare host, and a host mention with no owner/repo pair after it.
        expect(repoSlugHits('the host is github.com and nothing else')).toEqual([]);
    });
});

describe('source_shape — enforcement tier', () => {
    it('blocks inside agents/**', () => {
        expect(tierFor('agents/roadmaps/road-to-something.md')).toBe('block');
        expect(tierFor('agents/evidence/reports/x.md')).toBe('block');
    });

    it('warns everywhere else', () => {
        expect(tierFor('src/skills/mcp/SKILL.md')).toBe('warn');
        expect(tierFor('docs/mcp.md')).toBe('warn');
        expect(tierFor('README.md')).toBe('warn');
        // A path that merely CONTAINS "agents/" deeper down is not the agents tree.
        expect(tierFor('dist/agent-src/rules/source-confidentiality.md')).toBe('warn');
    });
});

describe('source_shape — paths are judged too', () => {
    it('flags a speaking tmp directory quoted inside a path', () => {
        expect(shapePathHits('agents/tmp.old/some-speaking-round/notes.md').map((h) => h.cls)).toEqual([
            'tmp-quote',
        ]);
    });

    it('does not apply the Source-header class to a path', () => {
        // A path cannot carry a markdown header; running that class over paths
        // would only add noise.
        expect(shapePathHits('docs/Source.md')).toEqual([]);
    });
});

describe('tmp-quote — a working-set directory is not a harvest round', () => {
    // Pinned from a MEASURED false positive: four hits in the code-graph
    // irrecoverability evidence, whose probe table quotes the pinned benchmark
    // inputs by path because the path IS the reading it records. The quoted
    // filenames are already anonymised, so there is no name to protect.
    it('bench-local is allowlisted — it names the work, not a source', () => {
        expect(tmpQuoteHits('| 1 | `agents/tmp/bench-local/repo-a-questions.yaml` | **ABSENT** |')).toEqual([]);
        expect(tmpQuoteHits('`agents/tmp.old/bench-local/probes.yaml`')).toEqual([]);
    });

    it('the allowlist is narrow — a round-named directory still fires', () => {
        // Without this the entry above could be widened into a general escape.
        const hits = tmpQuoteHits('`agents/tmp.old/runtime-code-intelligence/`');
        expect(hits).toHaveLength(1);
        expect(hits[0]?.cls).toBe('tmp-quote');
    });

    it('the match is exact, not a prefix — bench-local-something still fires', () => {
        expect(tmpQuoteHits('`agents/tmp/bench-local-harvest/`')).toHaveLength(1);
    });
});
