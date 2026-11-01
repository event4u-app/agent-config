/**
 * road-to-docs-that-sell 6.8 — the site's CLI reference is generated from the
 * CLI's own help groups and command registry, never hand-listed.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// @ts-expect-error — plain .mjs module of the isolated site workspace, no types
import * as gen from '../../site/gen-cli-reference.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(REPO, rel), 'utf8');

describe('site/gen-cli-reference', () => {
    it('parses single- and double-quoted registry entries, synopsis optional', () => {
        const reg = gen.parseRegistry(`
            { name: 'init', disposition: 'delegate', synopsis: 'Install.' },
            { name: 'export', disposition: 'delegate', synopsis: "Eject a tool's content." },
            { name: 'bare', disposition: 'native' },
        `);
        expect(reg).toEqual([
            { name: 'init', disposition: 'delegate', synopsis: 'Install.' },
            { name: 'export', disposition: 'delegate', synopsis: "Eject a tool's content." },
            { name: 'bare', disposition: 'native', synopsis: '' },
        ]);
    });

    it('escapes table-breaking characters', () => {
        expect(gen.cell('config | rule <name>')).toBe('config \\| rule &lt;name&gt;');
    });

    it('refuses a help row that names an unregistered command', () => {
        const groups = [{ heading: 'Get started', rows: [{ name: 'ghost', text: 'x' }] }];
        expect(() => gen.render(groups, [{ name: 'init', disposition: 'delegate', synopsis: '' }])).toThrow(/ghost/);
    });

    it('lists every registered command exactly once against the committed sources', () => {
        const groups = gen.parseHelpGroups(read('src/cli/help.ts'));
        const registry = gen.parseRegistry(read('src/cli/registry.ts'));
        const page: string = gen.render(groups, registry);
        expect(groups.length).toBeGreaterThan(0);
        for (const e of registry) {
            const rows = page.split('\n').filter((l) => l.includes(`\`${e.name}\` |`));
            expect(rows, e.name).toHaveLength(1);
        }
    });
});
