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
