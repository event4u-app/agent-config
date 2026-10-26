// road-to-tells-a-near-miss-can-refute 6.1/6.2: a PRODUCT.md in another
// dialect is read, never rewritten.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { captureMayRewrite, classifyProductMd } from '../../src/scripts/product_md_dialect.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIX = path.join(REPO, 'tests', 'fixtures', 'product-md');
const read = (name: string) => fs.readFileSync(path.join(FIX, name), 'utf8');

/** The template block in the skill, the file a first capture writes. */
function template(): string {
    const skill = fs.readFileSync(path.join(REPO, 'src', 'skills', 'design-system-capture', 'SKILL.md'), 'utf8');
    const m = /### `PRODUCT\.md`[\s\S]*?```markdown\n([\s\S]*?)\n```/.exec(skill);
    return m?.[1] ?? '';
}

describe('classifyProductMd', () => {
    it.each([
        ['ac-interaction.md', 'ac-interaction'],
        ['product-truth.md', 'product-truth'],
        ['unknown.md', 'unknown'],
    ])('%s → %s', (file, dialect) => {
        expect(classifyProductMd(read(file))).toBe(dialect);
    });

    it('the skill template is the superset, and owned', () => {
        expect(template()).not.toBe('');
        expect(classifyProductMd(template())).toBe('superset');
    });
});

describe('a capture rewrites only what it owns', () => {
    it('owned: absent, the older template, the superset', () => {
        expect(captureMayRewrite(null)).toBe(true);
        expect(captureMayRewrite(read('ac-interaction.md'))).toBe(true);
        expect(captureMayRewrite(template())).toBe(true);
    });

    it('not owned: the other dialect and an unknown file', () => {
        expect(captureMayRewrite(read('product-truth.md'))).toBe(false);
        expect(captureMayRewrite(read('unknown.md'))).toBe(false);
    });

    it('the CLI leaves a foreign file byte-identical', () => {
        const file = path.join(FIX, 'product-truth.md');
        const before = fs.readFileSync(file);
        const r = spawnSync('npx', ['tsx', path.join(REPO, 'src/scripts/product_md_dialect.ts'), file], { encoding: 'utf8', cwd: REPO });
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('product-truth — not owned');
        expect(fs.readFileSync(file).equals(before)).toBe(true);
    }, 60_000);
});
