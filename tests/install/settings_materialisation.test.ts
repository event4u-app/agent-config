/**
 * Settings materialisation — the file a fresh install writes
 * (`road-to-zero-ceremony-settings` Phase 3).
 *
 * The blocker `absent-is-not-default-for-projection-mode` resolves when a test
 * pins "a fresh install whose file is sparse AND whose resolved rule scope is
 * unchanged". Both halves are asserted here, against the REAL template.
 *
 * The sparse half alone would pass on an emitter that wrote an empty file and
 * broke every consumer, so the scope half is the load-bearing one.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { describe, expect, it } from 'vitest';

import { renderSparseSettings } from '../../src/server/io/yamlIO.js';
import { sparseSettingsValues } from '../../src/server/routes/wizard.js';
import { carveOutKeys } from '../../src/shared/settingsCarveOut.js';
import { ruleScopeFromSettings } from '../../src/install/rule_scope.js';

const ROOT = join(__dirname, '..', '..');
const TEMPLATE = readFileSync(
    join(ROOT, 'src', 'config', 'agent-settings.template.yml'),
    'utf8',
);

function parse(body: string): Record<string, unknown> {
    return (yamlLoad(body) ?? {}) as Record<string, unknown>;
}

function leafCount(value: unknown): number {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return 1;
    return Object.values(value as Record<string, unknown>).reduce<number>(
        (sum, v) => sum + leafCount(v),
        0,
    );
}

describe('fresh install writes a sparse settings file', () => {
    it('is a small fraction of the template it replaces', () => {
        const body = renderSparseSettings(sparseSettingsValues(TEMPLATE, {}));
        const templateLeaves = leafCount(parse(TEMPLATE));
        const sparseLeaves = leafCount(parse(body));

        // The point of the change: the user's file stops being a copy of the
        // defaults. A ratio assertion rather than a magic number, so adding a
        // template key does not red this test for the wrong reason.
        expect(sparseLeaves).toBeLessThan(templateLeaves / 5);
        expect(body.split('\n').length).toBeLessThan(TEMPLATE.split('\n').length / 5);
    });

    it('substitutes every template placeholder — no `__TOKEN__` reaches the file', () => {
        // Caught by looking at the real output, NOT by the assertion below:
        // comparing template against file passes on a placeholder, because the
        // token is present in both.
        const body = renderSparseSettings(sparseSettingsValues(TEMPLATE, {}));
        expect(body).not.toMatch(/__[A-Z_]+__/);
        expect(parse(body)['discipline_profile']).toBe('auto');
        expect((parse(body)['chat_history'] as Record<string, unknown>)['frequency'])
            .toBe('per_turn');
    });

    it('still carries every carved-out key, with its template value', () => {
        const template = parse(TEMPLATE);
        const written = parse(renderSparseSettings(sparseSettingsValues(TEMPLATE, {})));
        for (const key of carveOutKeys()) {
            const segments = key.split('.');
            let fromTemplate: unknown = template;
            let fromWritten: unknown = written;
            for (const segment of segments) {
                fromTemplate = (fromTemplate as Record<string, unknown>)[segment];
                fromWritten = (fromWritten as Record<string, unknown>)?.[segment];
            }
            if (typeof fromTemplate === 'string' && /^__[A-Z_]+__$/.test(fromTemplate)) {
                // Placeholder rows are covered by the substitution test above.
                continue;
            }
            expect(fromWritten, key).toEqual(fromTemplate);
        }
    });

    it('resolves the SAME rule scope as the full template did', () => {
        // The regression the blocker exists to prevent: dropping
        // `projection.*` flips every consumer from scoped to legacy-all.
        const fromTemplate = ruleScopeFromSettings(parse(TEMPLATE));
        const fromSparse = ruleScopeFromSettings(
            parse(renderSparseSettings(sparseSettingsValues(TEMPLATE, {}))),
        );
        expect(fromSparse).toEqual(fromTemplate);
        expect(fromSparse.workspaces).not.toBeNull();
    });

    it('lets a wizard answer outrank the carved-out default for the same key', () => {
        const body = renderSparseSettings(
            sparseSettingsValues(TEMPLATE, { discipline_profile: 'off' }),
        );
        expect(parse(body)['discipline_profile']).toBe('off');
    });

    it('writes no key the install did not decide', () => {
        const written = parse(renderSparseSettings(sparseSettingsValues(TEMPLATE, {})));
        const top = Object.keys(written).sort();
        // Every top-level section present traces to a carve-out key.
        const allowed = new Set(carveOutKeys().map((k) => k.split('.')[0]));
        expect(top.filter((k) => !allowed.has(k))).toEqual([]);
    });
});

describe('an existing populated file is honoured as-is', () => {
    it('keeps user entries the wizard never asked about', async () => {
        // The existing-file path patches answers into the USER's document via
        // mergeIntoTemplate, rather than rebuilding from the template — which
        // is what used to discard hand-edits on a wizard re-run.
        const { mergeIntoTemplate } = await import('../../src/server/io/yamlIO.js');
        const existing = [
            'personal:',
            '  autonomy: "on"',
            '  canary_name: "Ada"',
            'discipline_profile: full',
            '',
        ].join('\n');

        const merged = parse(mergeIntoTemplate(existing, { discipline_profile: 'off' }));
        const personal = merged['personal'] as Record<string, unknown>;

        expect(merged['discipline_profile']).toBe('off');   // the answer applied
        expect(personal['canary_name']).toBe('Ada');        // the hand-edit survived
        expect(personal['autonomy']).toBe('on');
    });
});
