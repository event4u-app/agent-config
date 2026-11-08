/**
 * The act-reference table: rule ids only, every one real and carrying a
 * load_context, every binding owned — the operational contract council design
 * round 2 set for option B.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const table = JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'config', 'act-references.json'), 'utf8')) as {
    bindings: Array<Record<string, unknown>>;
};

function frontmatter(rule: string): Record<string, unknown> {
    const text = fs.readFileSync(path.join(REPO, 'src', 'rules', `${rule}.md`), 'utf8');
    return parseYaml(text.slice(3, text.indexOf('\n---', 3))) as Record<string, unknown>;
}

describe('src/config/act-references.json', () => {
    it('has at least one binding', () => {
        expect(table.bindings.length).toBeGreaterThan(0);
    });
    it.each(table.bindings.map((b) => [String(b['shell_command']), b]))('%s: keys, owner, a real command', (_cmd, b) => {
        expect(Object.keys(b).sort()).toEqual(['owner', 'rules', 'shell_command']);
        expect(String(b['owner']).trim()).not.toBe('');
        expect(String(b['shell_command'])).toMatch(/^[a-z][a-z0-9-]*( [a-z][a-z0-9-]*)+$/);
    });
    it.each(table.bindings.flatMap((b) => (b['rules'] as string[]).map((r) => [String(b['shell_command']), r])))(
        '%s → %s exists and carries load_context',
        (_cmd, rule) => {
            const fm = frontmatter(rule);
            expect(Array.isArray(fm['load_context']) && (fm['load_context'] as unknown[]).length > 0).toBe(true);
        },
    );
});

describe('the bundle-side pre-check stays in step with the table', () => {
    it('every bound act contains a word ACT_WORDS matches', async () => {
        const { ACT_WORDS } = await import('../../src/scripts/hooks/reference_duty_loader.js');
        for (const b of table.bindings) expect(ACT_WORDS.test(String(b['shell_command']))).toBe(true);
    });
});
