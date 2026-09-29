import { describe, expect, it } from 'vitest';

import { load_schema, validate } from '../../src/scripts/validate_frontmatter.js';

/**
 * The `inputs:` block is OPTIONAL on every artifact, which is the property that
 * lets it ship with zero migration — so the "no block validates unchanged" case
 * is as load-bearing as the two that constrain a present block, and is tested
 * with them rather than assumed.
 */
const SCHEMAS = ['skill', 'command'] as const;

/** A frontmatter object that already satisfies the required keys of each schema. */
function base(kind: (typeof SCHEMAS)[number]): Record<string, unknown> {
    return kind === 'skill'
        ? {
              name: 'inputs-fixture',
              description: 'A fixture exercising the inputs declaration.',
              source: 'package',
              domain: 'engineering',
          }
        : {
              name: 'inputs-fixture',
              description: 'A fixture exercising the inputs declaration.',
              'disable-model-invocation': true,
          };
}

/** Validation errors as readable strings. Warnings are not failures here. */
function errorsFor(kind: (typeof SCHEMAS)[number], inputs: unknown): string[] {
    const fm = base(kind);
    if (inputs !== undefined) fm['inputs'] = inputs;
    return validate(fm as never, load_schema(kind))
        .filter((e) => e.severity !== 'warning')
        .map((e) => e.format());
}

describe.each(SCHEMAS)('inputs: declaration — %s schema', (kind) => {
    it('an artifact with no block validates unchanged', () => {
        expect(errorsFor(kind, undefined)).toEqual([]);
    });

    it('a well-formed block validates', () => {
        expect(
            errorsFor(kind, [
                { name: 'target', type: 'string', required: true, description: 'What to act on.' },
                { name: 'mode', type: 'enum', enum: ['fast', 'thorough'], default: 'fast' },
                { name: 'dry_run', type: 'boolean', required: false },
                { name: 'out_path', type: 'path' },
                { name: 'limit', type: 'number', default: 10 },
            ]),
        ).toEqual([]);
    });

    it('an unknown input type fails', () => {
        const errs = errorsFor(kind, [{ name: 'target', type: 'regexp' }]);
        expect(errs.length).toBeGreaterThan(0);
        expect(errs.join(' ')).toMatch(/type/);
    });

    it('a declaration with no name fails', () => {
        expect(errorsFor(kind, [{ type: 'string' }]).length).toBeGreaterThan(0);
    });

    it('a declaration with no type fails', () => {
        expect(errorsFor(kind, [{ name: 'target' }]).length).toBeGreaterThan(0);
    });

    it('a name that is not snake_case fails — it must be safe as a wire key', () => {
        expect(errorsFor(kind, [{ name: 'Target-Name', type: 'string' }]).length).toBeGreaterThan(
            0,
        );
    });

    it('an unknown key inside a declaration fails rather than passing through', () => {
        expect(
            errorsFor(kind, [{ name: 'target', type: 'string', nullable: true }]).length,
        ).toBeGreaterThan(0);
    });

    it('an empty block fails — declaring nothing is not a declaration', () => {
        expect(errorsFor(kind, []).length).toBeGreaterThan(0);
    });
});
