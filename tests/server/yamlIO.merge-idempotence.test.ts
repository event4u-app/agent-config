/**
 * `mergeIntoTemplate` — the write path for a key with NO template entry, run
 * more than once.
 *
 * The defect, measured on a real install: the fallback branch appends a flat
 * `a.b: value` line under a "Wizard-added keys" comment, and `replaceScalar`'s
 * key pattern has no dot — so on the next save the probe cannot see the line
 * it just wrote and appends the whole block again. Two wizard saves produce a
 * file with 47 duplicate mapping keys, which a strict parser rejects outright.
 * `task sync` exits 2 on it, and `task release` dies in `release-prepare`
 * before doing any git work.
 *
 * Two independent causes had to be fixed and both are pinned here, because
 * either one alone reproduces the corruption:
 *
 *   1. The flat form was invisible to the probe.
 *   2. Presence was inferred from the write CHANGING the text, so writing a
 *      value a key already holds read as "absent" and appended a duplicate.
 *
 * Cause 2 is the subtler one and needs its own case: with only cause 1 fixed,
 * a save that changes nothing still duplicates.
 */
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { mergeIntoTemplate, replaceScalar, upsertScalar } from '../../src/server/io/yamlIO.js';

/** Strict parse — throws "Map keys must be unique" on a duplicate. */
const strict = (body: string): unknown => parseYaml(body, { uniqueKeys: true });

describe('mergeIntoTemplate idempotence', () => {
    it('does not duplicate an appended flat key on a second identical save', () => {
        const template = 'foo: 1\n';
        const values = { profile: { id: 'developer' } };

        const once = mergeIntoTemplate(template, values);
        const twice = mergeIntoTemplate(once, values);

        expect(twice).toBe(once);
        expect(() => strict(twice)).not.toThrow();
        expect((once.match(/^profile\.id:/gm) ?? []).length).toBe(1);
    });

    it('updates an appended flat key in place instead of appending a rival', () => {
        const template = 'foo: 1\n';
        const once = mergeIntoTemplate(template, { profile: { id: 'developer' } });
        const changed = mergeIntoTemplate(once, { profile: { id: 'maintainer' } });

        expect((changed.match(/^profile\.id:/gm) ?? []).length).toBe(1);
        expect(changed).toContain('profile.id: maintainer');
        expect(changed).not.toContain('profile.id: developer');
        expect(() => strict(changed)).not.toThrow();
    });

    it('treats a no-op write to an EXISTING nested key as a hit, not a miss', () => {
        // Cause 2 in isolation: the key is in the template's nested form and
        // already carries the value being written, so the write returns a
        // BYTE-IDENTICAL string. Inferring absence from that appends a flat
        // `personal.ide:` beside the real nested one.
        //
        // The value has to survive `formatScalar` unchanged for this to be a
        // real no-op — an earlier draft used `autonomy: "on"`, which comes back
        // as `'on'` (YAML 1.1 reads bare `on` as a boolean, so it is requoted).
        // The rewrite differed by two bytes, the string compare read "present",
        // and the case tested nothing. A no-op test whose write is not actually
        // a no-op is the failure mode to watch for here.
        const template = 'personal:\n  ide: phpstorm\n';
        expect(replaceScalar(template, ['personal', 'ide'], 'phpstorm')).toBe(template);

        const after = mergeIntoTemplate(template, { personal: { ide: 'phpstorm' } });

        expect(after).not.toContain('Wizard-added keys');
        expect(after).not.toMatch(/^personal\.ide:/m);
        expect(() => strict(after)).not.toThrow();
    });

    it('stays idempotent across many keys and repeated rounds', () => {
        const template = 'foo: 1\npersonal:\n  ide: phpstorm\n';
        const values = {
            profile: { id: 'developer' },
            personal: { ide: 'phpstorm', autonomy: 'on' },
            cost: { budgets: { daily: 0 } },
        };

        const once = mergeIntoTemplate(template, values);
        let body = once;
        for (let i = 0; i < 5; i++) body = mergeIntoTemplate(body, values);

        expect(body).toBe(once);
        expect(() => strict(body)).not.toThrow();
        // The nested key stays nested; only the genuinely-absent ones go flat.
        // Stability alone is not enough here: a run that appends a bogus flat
        // `personal.ide:` on round one and then merely UPDATES it on every
        // later round is stable, parses (the two are distinct top-level keys)
        // and still leaves a line no reader resolves to `personal.ide`.
        expect(body).not.toMatch(/^personal\.ide:/m);
        const doc = strict(body) as Record<string, Record<string, unknown>>;
        expect(doc['personal']?.['ide']).toBe('phpstorm');
    });
});

/**
 * The same defect in `upsertScalar`, which is the LIVE one.
 *
 * `mergeIntoTemplate` was fixed first and this path was left inferring
 * presence from the write changing the string — so the fix covered the
 * instance that was reported and not the instance that was reachable. The
 * wizard's council page calls `upsertScalar` on save: pressing Save twice
 * without moving a toggle wrote a second `api_on_quota:` into the same block,
 * over two `{ok: true}` responses, leaving `.ai-council.yml` rejected by a
 * strict parser. One found instance of a defect is a sample, not the
 * population.
 */
describe('upsertScalar idempotence', () => {
    it('a same-value save does not append a rival key beside the real one', () => {
        const before = 'fallback:\n  api_on_quota: true\n';
        const after = upsertScalar(before, ['fallback', 'api_on_quota'], true);

        expect(after).toBe(before);
        expect(() => strict(after)).not.toThrow();
        expect((after.match(/api_on_quota:/g) ?? []).length).toBe(1);
    });

    it('stays a fixed point across alternating and repeated saves', () => {
        // Alternating values already passed before the fix — the existing
        // suite only ever alternates — so the repeat is the half that matters.
        let body = 'fallback:\n  api_on_quota: true\n';
        for (const v of [false, false, true, true, false]) {
            body = upsertScalar(body, ['fallback', 'api_on_quota'], v);
            expect(() => strict(body)).not.toThrow();
        }
        expect((body.match(/api_on_quota:/g) ?? []).length).toBe(1);
        expect(strict(body)).toEqual({ fallback: { api_on_quota: false } });
    });

    it('still creates the nesting when the key is genuinely absent', () => {
        // The behaviour the presence probe must not cost: an absent path is
        // created as real nesting, never as a flat `a.b:` line.
        const after = upsertScalar('enabled: true\n', ['fallback', 'api_on_quota'], true);
        expect(strict(after)).toEqual({ enabled: true, fallback: { api_on_quota: true } });
    });
});

/**
 * Dashed nested keys — ordinary YAML the probe could not see.
 *
 * `detectIndentWidth` accepted `-` in a key; the presence probe did not. A
 * dashed nested key was therefore never found, and the two writers failed
 * differently: `mergeIntoTemplate` wrote a bogus top-level flat twin and left
 * the real nested value untouched (a save that silently did nothing), while
 * `upsertScalar` appended another child line on every single call.
 *
 * Three shapes rather than one parameterised case, because widening a key
 * pattern is not only "does it match" — it is "does it REPLACE correctly
 * wherever such a key can legally sit".
 */
describe('dashed nested keys', () => {
    it('replaces a plain dashed key in place', () => {
        const before = 'personas:\n  first-principles: false\n';
        const after = mergeIntoTemplate(before, { personas: { 'first-principles': true } });

        expect(after).not.toContain('Wizard-added keys');
        expect(after).not.toMatch(/^personas\.first-principles:/m);
        expect(strict(after)).toEqual({ personas: { 'first-principles': true } });
    });

    it('replaces a dashed key carrying an inline comment', () => {
        const before = 'personas:\n  retry-count: 3  # production\n';
        const after = mergeIntoTemplate(before, { personas: { 'retry-count': 5 } });

        expect(strict(after)).toEqual({ personas: { 'retry-count': 5 } });
        expect((after.match(/retry-count:/g) ?? []).length).toBe(1);
    });

    it('leaves a dashed key inside flow syntax alone rather than half-editing it', () => {
        // `personas: {dry-run: true}` is one line, and the probe walks lines.
        // The requirement is not that it edits this — it is that it does not
        // produce a second `personas` key while trying.
        const before = 'personas: {dry-run: true}\n';
        const after = mergeIntoTemplate(before, { personas: { 'dry-run': false } });

        expect(() => strict(after)).not.toThrow();
        expect((after.match(/^personas:/gm) ?? []).length).toBe(1);
    });

    it('upsertScalar no longer grows without bound on a dashed leaf', () => {
        // The worst half: the append path used the same pattern and never
        // collapses, so three calls produced three sibling lines.
        let body = 'personas:\n  first-principles: true\n';
        for (let i = 0; i < 3; i++) {
            body = upsertScalar(body, ['personas', 'first-principles'], true);
        }
        expect((body.match(/first-principles:/g) ?? []).length).toBe(1);
        expect(() => strict(body)).not.toThrow();
    });
});
