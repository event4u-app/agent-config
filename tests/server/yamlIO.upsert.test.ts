/**
 * `upsertScalar` — the write path a key the user's file does NOT yet carry.
 *
 * R2 round 2, finding 6. `replaceScalar` returns the template unchanged when
 * the path is absent and the wizard's `set` helper never appended, so the
 * `fallback.api_on_quota` toggle returned 200 and wrote nothing on every
 * `.ai-council.yml` written before that key existed. The wizard's own
 * round-trip test passed the whole time, because the SEED template carries the
 * block — the defect lives only on a pre-existing file, which is every real
 * installation.
 */
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    detectIndentWidth,
    replaceScalar,
    upsertScalar,
} from '../../src/server/io/yamlIO.js';

/** This worktree's root — two levels up from tests/server/. */
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const read = (body: string, a: string, b: string): unknown =>
    ((parseYaml(body) as Record<string, Record<string, unknown>>)[a] ?? {})[b];

describe('upsertScalar', () => {
    it('creates a missing top-level section, nested so a YAML reader sees it', () => {
        const before = 'enabled: true\ndefaults:\n  min_rounds: 2\n';
        // The pre-fix behaviour, pinned: this is what the wizard was doing.
        expect(replaceScalar(before, ['fallback', 'api_on_quota'], true)).toBe(before);

        const after = upsertScalar(before, ['fallback', 'api_on_quota'], true);
        expect(after).not.toBe(before);
        // The assertion that matters: `doc.fallback.api_on_quota`, not a
        // top-level key literally named "fallback.api_on_quota" — which is
        // what a flat append produces and what the reader would never see.
        expect(read(after, 'fallback', 'api_on_quota')).toBe(true);
        expect(Object.keys(parseYaml(after) as object)).toContain('fallback');
    });

    it('adds a key to an EXISTING section instead of appending a second one', () => {
        const before = 'fallback:\n  something_else: 1\nenabled: true\n';
        const after = upsertScalar(before, ['fallback', 'api_on_quota'], false);
        expect(read(after, 'fallback', 'api_on_quota')).toBe(false);
        expect(read(after, 'fallback', 'something_else')).toBe(1);
        // A duplicate mapping key is an error in a strict parser and a silent
        // last-wins in a lenient one, so neither is acceptable.
        expect(after.split('\n').filter((l) => l === 'fallback:')).toHaveLength(1);
    });

    it('replaces in place when the key already exists — no second line', () => {
        const before = 'fallback:\n  api_on_quota: false\n';
        const after = upsertScalar(before, ['fallback', 'api_on_quota'], true);
        expect(read(after, 'fallback', 'api_on_quota')).toBe(true);
        expect(after.split('\n').filter((l) => l.includes('api_on_quota'))).toHaveLength(1);
    });

    it('preserves comments and unrelated keys', () => {
        const before = '# LOCKED — do not reorder\nenabled: true\n# a trailing note\n';
        const after = upsertScalar(before, ['fallback', 'api_on_quota'], true);
        expect(after).toContain('# LOCKED — do not reorder');
        expect(after).toContain('# a trailing note');
        expect(read(after, 'fallback', 'api_on_quota')).toBe(true);
    });

    it('handles a file with no trailing newline', () => {
        const after = upsertScalar('enabled: true', ['fallback', 'api_on_quota'], true);
        expect(read(after, 'fallback', 'api_on_quota')).toBe(true);
    });
});

describe('upsertScalar — nested paths bind under the RIGHT parent', () => {
    // R2 round 3, finding 5. The scoping expression was
    // `depth === 0 ? 0 : insertAt === lines.length ? 0 : 0` — every branch
    // zero, so the comment claimed a scoped search over an expression that
    // scoped nothing. Latent, because the one live caller is depth 1; these
    // tests are the ones the next caller would have needed.
    const read2 = (body: string, a: string, b: string, c: string): unknown => {
        const doc = parseYaml(body) as Record<string, Record<string, Record<string, unknown>>>;
        return ((doc[a] ?? {})[b] ?? {})[c];
    };

    it('does not bind to a same-named section under a DIFFERENT parent', () => {
        const before = [
            'other:',
            '  members:',
            '    anthropic: 1',
            'council:',
            '  members:',
            '    openai: 2',
            '',
        ].join('\n');
        const after = upsertScalar(before, ['council', 'members', 'anthropic'], true);
        expect(read2(after, 'council', 'members', 'anthropic')).toBe(true);
        // The decisive assertion: `other.members.anthropic` keeps its value
        // rather than being the line that got rewritten.
        expect(read2(after, 'other', 'members', 'anthropic')).toBe(1);
    });

    it('creates a missing depth-2 leaf inside an existing depth-1 parent', () => {
        const before = 'council:\n  members:\n    openai: 2\n';
        const after = upsertScalar(before, ['council', 'members', 'gemini'], false);
        expect(read2(after, 'council', 'members', 'gemini')).toBe(false);
        expect(read2(after, 'council', 'members', 'openai')).toBe(2);
        expect(after.split('\n').filter((l) => l === 'council:')).toHaveLength(1);
    });

    it('creates the whole missing chain when only the root exists', () => {
        const before = 'council:\n  enabled: true\n';
        const after = upsertScalar(before, ['council', 'fallback', 'api_on_quota'], true);
        expect(read2(after, 'council', 'fallback', 'api_on_quota')).toBe(true);
        expect((parseYaml(after) as Record<string, Record<string, unknown>>)['council']?.['enabled']).toBe(true);
    });
});

describe('upsertScalar — the document\'s own indent width', () => {
    // R2 round 4, finding 7. Both halves hardcoded two spaces, so on a
    // 4-space file the depth-2 walk matched nothing at depth 1 and appended
    // the whole chain at EOF — a SECOND mapping key beside the existing one.
    // `wizard.ts` writes that without re-parsing and reports {ok: true}.
    it('adds a key to an existing 4-space section, not a duplicate one', () => {
        const before = 'council:\n    members:\n        openai: 2\n';
        const after = upsertScalar(before, ['council', 'members', 'gemini'], false);
        // Parses at all — the decisive check, since a duplicate key is what
        // the old version produced.
        const doc = parseYaml(after) as Record<string, Record<string, Record<string, unknown>>>;
        expect(doc['council']?.['members']?.['gemini']).toBe(false);
        expect(doc['council']?.['members']?.['openai']).toBe(2);
        expect(after.split('\n').filter((l) => l === 'council:')).toHaveLength(1);
        // And it matched the file's own width rather than imposing two.
        expect(after).toContain('        gemini: false');
    });

    it('a 4-space file gains a missing top-level section correctly', () => {
        const before = 'defaults:\n    min_rounds: 2\n';
        const after = upsertScalar(before, ['fallback', 'api_on_quota'], true);
        const doc = parseYaml(after) as Record<string, Record<string, unknown>>;
        expect(doc['fallback']?.['api_on_quota']).toBe(true);
        expect(doc['defaults']?.['min_rounds']).toBe(2);
    });

    it('a flat document falls back to two spaces', () => {
        const after = upsertScalar('enabled: true\n', ['fallback', 'api_on_quota'], true);
        expect(after).toContain('  api_on_quota: true');
    });
});

describe('the writer and its existence-probe agree about the format', () => {
    // R2 round 5, finding 1 — the second half of round 4's finding 7, and the
    // reviewer EXECUTED it rather than reasoning about it. Round 4 taught
    // `upsertScalar` to write at the detected width and left `replaceScalar`
    // hardcoded at two, so the second toggle of the same switch could not see
    // the line the first one wrote.
    it('a SECOND toggle on a 4-space file replaces, never duplicates', () => {
        const before = 'council:\n    enabled: true\n';
        const once = upsertScalar(before, ['fallback', 'api_on_quota'], true);
        const twice = upsertScalar(once, ['fallback', 'api_on_quota'], false);

        // The decisive assertion: it still parses. A duplicate mapping key is
        // what the defect produced, and `wizard.ts` writes without re-parsing.
        const doc = parseYaml(twice) as Record<string, Record<string, unknown>>;
        expect(doc['fallback']?.['api_on_quota']).toBe(false);
        expect(twice.split('\n').filter((l) => l.includes('api_on_quota'))).toHaveLength(1);
        expect(twice.split('\n').filter((l) => l === 'fallback:')).toHaveLength(1);
    });

    it('replaceScalar alone finds a key written at a 4-space width', () => {
        // The probe in isolation — `upsertScalar` delegates to it first, so a
        // miss here is what fell through to the duplicating insert branch.
        const body = 'fallback:\n    api_on_quota: true\n';
        const after = replaceScalar(body, ['fallback', 'api_on_quota'], false);
        expect(after).not.toBe(body);
        expect(after).toContain('    api_on_quota: false');
    });

    it('a third toggle is still stable — the loop does not accumulate', () => {
        let body = 'council:\n    enabled: true\n';
        for (const v of [true, false, true]) {
            body = upsertScalar(body, ['fallback', 'api_on_quota'], v);
        }
        expect(body.split('\n').filter((l) => l.includes('api_on_quota'))).toHaveLength(1);
        const doc = parseYaml(body) as Record<string, Record<string, unknown>>;
        expect(doc['fallback']?.['api_on_quota']).toBe(true);
    });

    it('the 2-space path is unchanged by the shared width', () => {
        const once = upsertScalar('council:\n  enabled: true\n', ['fallback', 'api_on_quota'], true);
        const twice = upsertScalar(once, ['fallback', 'api_on_quota'], false);
        expect(twice.split('\n').filter((l) => l.includes('api_on_quota'))).toHaveLength(1);
        expect(twice).toContain('  api_on_quota: false');
    });
});

describe('detectIndentWidth — the SMALLEST indent, not the first line seen', () => {
    // R2 round 6, finding 3. Reading the first indented mapping line was wrong
    // twice over, and both were reachable on files this repo ships.
    it('a dashed key does not hand the vote to a deeper line', () => {
        // The shipped template has `first-principles:`. The old key pattern
        // excluded `-`, so that line was skipped and the next, deeper one won.
        expect(detectIndentWidth(['root:', '  first-principles:', '    a: 1'])).toBe(2);
    });

    it('an unrepresentative first line does not set the width', () => {
        expect(detectIndentWidth(['root:', '      deep: 1', '  shallow: 2'])).toBe(2);
    });

    it('a list item is not a mapping line and does not vote', () => {
        // The mapping line at 2 decides. Asserting anything for a document
        // whose ONLY indented mapping sits at 4 would be asserting something
        // unknowable — there the minimum genuinely is 4.
        expect(detectIndentWidth(['root:', '  - item', '  key: 1'])).toBe(2);
    });

    it('a genuine 4-space document still reads 4', () => {
        expect(detectIndentWidth(['root:', '    key: 1', '        deeper: 2'])).toBe(4);
    });

    it('tabs, comments and flat documents fall back to 2', () => {
        expect(detectIndentWidth(['root:', '\tkey: 1'])).toBe(2);
        expect(detectIndentWidth(['root:', '  # note'])).toBe(2);
        expect(detectIndentWidth(['a: 1', 'b: 2'])).toBe(2);
        expect(detectIndentWidth([])).toBe(2);
    });

    it('the shipped council template round-trips two toggles and still parses', () => {
        // The end-to-end statement against a real file, not a fixture.
        const body = fs.readFileSync(
            path.join(REPO_ROOT, 'agents', 'templates', '.ai-council.yml.example'),
            'utf8',
        );
        let b = upsertScalar(body, ['fallback', 'api_on_quota'], true);
        b = upsertScalar(b, ['fallback', 'api_on_quota'], false);
        const doc = parseYaml(b) as Record<string, Record<string, unknown>>;
        expect(doc['fallback']?.['api_on_quota']).toBe(false);
        // One real key. The other match in this file is a comment.
        expect(b.split('\n').filter((l) => /^\s*api_on_quota:/.test(l))).toHaveLength(1);
    });
});
