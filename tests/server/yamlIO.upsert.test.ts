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

import { replaceScalar, upsertScalar } from '../../src/server/io/yamlIO.js';

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
