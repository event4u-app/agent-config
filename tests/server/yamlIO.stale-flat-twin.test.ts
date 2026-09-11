/**
 * A dead top-level `a.b: <stale>` line left standing beside the real nested key.
 *
 * `mergeIntoTemplate` asks `findScalarLine` first; on a hit it rewrites the
 * nested scalar and moves to the next entry, so `replaceFlatDottedKey` — the
 * only code that has ever cleaned a flat line up — is never consulted. A file
 * the pre-15.0.0 writer produced therefore keeps both forms forever: the flat
 * one parses (it is a distinct top-level key, so the duplicate-key pass cannot
 * see it), never resolves (a reader of `personal.ide` walks the mapping), and
 * never changes (the merge writes the nested side). It is permanent, and it
 * tells the next human the opposite of what the file means.
 *
 * The sweep's whole safety argument is the nested twin. A flat `a.b:` with no
 * nested `a:`/`b:` above it is a key somebody may have meant — `mergeIntoTemplate`'s
 * own fallback branch writes exactly that shape — so the survival cases below
 * are not politeness, they are the boundary the deletion is allowed to reach.
 * They were green before the change and are proved by neutralising the
 * mechanism each one guards; the report records which.
 */
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { mergeIntoTemplate } from '../../src/server/io/yamlIO.js';

/** Strict parse — throws "Map keys must be unique" on a duplicate. */
const strict = (body: string): unknown => parseYaml(body, { uniqueKeys: true });

describe('stale flat twin beside a winning nested key', () => {
    it('removes a flat twin that sits AFTER the nested form', () => {
        const before = 'personal:\n  ide: a\npersonal.ide: b\n';
        const after = mergeIntoTemplate(before, { personal: { ide: 'c' } });

        expect(after).not.toMatch(/^personal\.ide:/m);
        expect(strict(after)).toEqual({ personal: { ide: 'c' } });
    });

    it('removes a flat twin that sits BEFORE the nested form', () => {
        // Order matters to the sweep, not to the probe: `NESTED_KEY_RE` cannot
        // match `personal.ide:` at all, so `findScalarLine` walks past it and
        // still binds the nested key either way. What changes is which index
        // the removal has to reach, and a sweep written as "drop the line after
        // the one I just wrote" would pass the case above and fail this one.
        const before = 'personal.ide: b\npersonal:\n  ide: a\n';
        const after = mergeIntoTemplate(before, { personal: { ide: 'c' } });

        expect(after).not.toMatch(/^personal\.ide:/m);
        expect(strict(after)).toEqual({ personal: { ide: 'c' } });
    });

    it('removes every stale twin, not just the first', () => {
        // Two copies is the state a pre-fix `mergeIntoTemplate` reached by
        // appending its fallback block on more than one save. Collapsing to one
        // survivor would leave the identical lie, one line shorter.
        const before = 'personal.ide: b\npersonal:\n  ide: a\npersonal.ide: c\n';
        const after = mergeIntoTemplate(before, { personal: { ide: 'd' } });

        expect(after).not.toMatch(/^personal\.ide:/m);
        expect(strict(after)).toEqual({ personal: { ide: 'd' } });
    });

    it('removes a twin of a three-segment path', () => {
        // The flat form is `a.b.c` however deep the nesting runs; a sweep keyed
        // on "parent.leaf" would miss everything below depth two.
        const before = 'cost:\n  budgets:\n    daily: 1\ncost.budgets.daily: 99\n';
        const after = mergeIntoTemplate(before, { cost: { budgets: { daily: 5 } } });

        expect(after).not.toMatch(/^cost\.budgets\.daily:/m);
        expect(strict(after)).toEqual({ cost: { budgets: { daily: 5 } } });
    });

    it('removes a twin whose value contradicts the nested one', () => {
        // The case that decides WHICH reader the sweep preserves. By YAML
        // semantics the nested key wins: `personal.ide` is reached through the
        // `personal` mapping, and the flat line is a separate top-level key
        // that no lookup of that path ever visits. So dropping it changes no
        // reader's answer — `phpstorm` before and after — while keeping it
        // leaves the only line a human would read as the value saying `vscode`.
        const before = 'personal:\n  ide: phpstorm\npersonal.ide: vscode\n';
        const after = mergeIntoTemplate(before, { personal: { ide: 'phpstorm' } });

        expect(after).not.toContain('vscode');
        expect(strict(after)).toEqual({ personal: { ide: 'phpstorm' } });
    });

    it('leaves the surrounding comments and unrelated keys intact', () => {
        // The sweep deletes lines, which is the one operation that can take a
        // comment with it. Nothing here is load-bearing to the twin.
        const before = [
            '# top comment',
            'personal:',
            '  # which editor',
            '  ide: a  # inline',
            'other: keep',
            'personal.ide: b',
            '',
        ].join('\n');
        const after = mergeIntoTemplate(before, { personal: { ide: 'c' } });

        expect(after).toContain('# top comment');
        expect(after).toContain('  # which editor');
        expect(after).not.toMatch(/^personal\.ide:/m);
        expect(strict(after)).toEqual({ personal: { ide: 'c' }, other: 'keep' });
    });
});

/**
 * The boundary of the deletion — risk-register row 2 of
 * `road-to-settings-writer-residual-debt`: the sweep cannot tell a leftover
 * from a flat key somebody wrote on purpose, so it is allowed to fire ONLY on
 * the twin of a nested key this merge just resolved. Each case below pins one
 * of the three conditions that make that true.
 */
describe('flat keys the sweep must not touch', () => {
    it('keeps a flat dotted key that has no nested twin, and updates it in place', () => {
        // No nested `personal:` block, so `findScalarLine` misses and the merge
        // takes the `replaceFlatDottedKey` branch instead. That branch is the
        // one that legitimately owns this line — it is the shape the fallback
        // writes — and the sweep must never run ahead of it.
        //
        // The surviving VALUE is not enough to pin this. A sweep hoisted out of
        // the nested-hit branch deletes the line and the fallback then appends
        // the same path again, so a value check round-trips green while the
        // line has in fact been destroyed and recreated — losing its position,
        // its comments, and gaining a "Wizard-added keys" banner it never had.
        // The banner is the observable that separates an in-place update from a
        // delete-and-recreate, so it is what the assertion reads.
        const before = 'personal.ide: a\n';
        const after = mergeIntoTemplate(before, { personal: { ide: 'b' } });

        expect(after).not.toContain('Wizard-added keys');
        expect(after).toMatch(/^personal\.ide: b$/m);
        expect(strict(after)).toEqual({ 'personal.ide': 'b' });
    });

    it('keeps an INDENTED a.b: line, which belongs to another parent', () => {
        // `parent:\n  personal.ide: x` means `parent['personal.ide']` — an
        // unrelated path that merely spells like the flat form. The top-level
        // bound `replaceFlatDottedKey` already draws is the same bound here.
        const before = 'personal:\n  ide: a\nparent:\n  personal.ide: b\n';
        const after = mergeIntoTemplate(before, { personal: { ide: 'c' } });

        expect(strict(after)).toEqual({
            personal: { ide: 'c' },
            parent: { 'personal.ide': 'b' },
        });
    });

    it('keeps a top-level scalar whose own name is the path being written', () => {
        // A one-segment path joins to a name with no dot in it, so a sweep
        // without the two-segment guard would match the very line
        // `replaceScalar` has just written and delete the key it was asked to
        // set. The guard is what stops a rewrite from becoming a removal.
        const before = 'foo: 1\n';
        const after = mergeIntoTemplate(before, { foo: 2 });

        expect(strict(after)).toEqual({ foo: 2 });
    });

    it('keeps a flat twin belonging to a path this merge did not write', () => {
        // The sweep is scoped to the one path it just resolved. A file carrying
        // stale twins for several paths gets them cleaned as each is written,
        // never as a side effect of writing a neighbour.
        const before = 'personal:\n  ide: a\n  autonomy: x\npersonal.autonomy: stale\n';
        const after = mergeIntoTemplate(before, { personal: { ide: 'c' } });

        expect(after).toMatch(/^personal\.autonomy: stale$/m);
    });
});
