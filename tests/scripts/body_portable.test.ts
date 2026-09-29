import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { load as yamlLoad } from 'js-yaml';
import { describe, expect, it } from 'vitest';

import {
    CARRIED_KEYS,
    PARTIAL_KEYS,
    classifyPortability,
    isBodyPortable,
} from '../../src/scripts/_lib/body_portable.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures', 'body-portable');

/** Read one fixture's frontmatter the way the carrier's reader would. */
function fixture(name: string): Record<string, unknown> {
    const text = fs.readFileSync(path.join(FIXTURES, name, 'SKILL.md'), 'utf8');
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    if (m === null) throw new Error(`fixture ${name} has no frontmatter`);
    return yamlLoad(m[1]!) as Record<string, unknown>;
}

describe('isBodyPortable — the fixture pair the roadmap names', () => {
    it('the portable fixture returns true', () => {
        expect(isBodyPortable(fixture('portable'))).toBe(true);
    });

    it('the non-portable fixture returns false', () => {
        expect(isBodyPortable(fixture('non-portable'))).toBe(false);
    });

    it('names the dropped keys rather than only refusing', () => {
        const v = classifyPortability(fixture('non-portable'));
        expect(v.dropped).toEqual(['execution', 'model_tier']);
        expect(v.partial).toEqual([]);
    });
});

describe('isBodyPortable — an unknown key fails closed', () => {
    it('a fixture declaring a key the schema does not know returns false, not true', () => {
        expect(isBodyPortable(fixture('unknown-key'))).toBe(false);
    });

    it('the unknown key is reported as dropped', () => {
        expect(classifyPortability(fixture('unknown-key')).dropped).toEqual([
            'some_future_semantic',
        ]);
    });
});

describe('isBodyPortable — the partial key is not portable', () => {
    it('declaring `triggers` alone is enough to fail', () => {
        const v = classifyPortability({ name: 'x', triggers: [{ keyword: 'a' }] });
        expect(v.portable).toBe(false);
        expect(v.partial).toEqual(['triggers']);
        expect(v.dropped).toEqual([]);
    });

    it('every key the carrier truncates is declared partial, none silently carried', () => {
        for (const key of Object.keys(PARTIAL_KEYS)) {
            expect(CARRIED_KEYS).not.toContain(key);
            expect(isBodyPortable({ [key]: 'anything' })).toBe(false);
        }
    });
});

describe('isBodyPortable — the carried set', () => {
    it('a skill declaring only carried keys is portable', () => {
        const fm: Record<string, unknown> = {};
        for (const key of CARRIED_KEYS) fm[key] = 'value';
        expect(isBodyPortable(fm)).toBe(true);
    });

    it('empty frontmatter is portable — nothing declared, nothing lost', () => {
        expect(isBodyPortable({})).toBe(true);
    });

    it('one dropped key is enough to fail an otherwise carried set', () => {
        const fm: Record<string, unknown> = { domain: 'engineering' };
        for (const key of CARRIED_KEYS) fm[key] = 'value';
        expect(isBodyPortable(fm)).toBe(false);
    });
});
