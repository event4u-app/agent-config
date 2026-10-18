/**
 * Step 6.1: the `/analyze` dispatcher names every `routes_to` entry in its
 * sub-command table, keyword table and menu, and its eval set routes one prompt
 * per entry to that entry — counted from `routes_to`, never written as a number.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const text = fs.readFileSync(path.join(ROOT, 'src/domains/analysis-workbench/analyze/command.md'), 'utf-8');
const fm = parse(/^---\n([\s\S]*?)\n---\n/u.exec(text)![1]!) as { routes_to: string[] };
const evals = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/agent-src/commands/evals/analyze.json'), 'utf-8')) as {
    cases: Array<{ prompt: string; expected: string }>;
};
const subOf = (name: string): string => name.replace(/^analyze-/u, '');

describe('/analyze router (step 6.1)', () => {
    it('every routes_to entry is a command file in the cluster', () => {
        for (const r of fm.routes_to) {
            const file = path.join(ROOT, 'src/domains/analysis-workbench/analyze', subOf(r), 'command.md');
            expect(fs.existsSync(file), r).toBe(true);
            expect(fs.readFileSync(file, 'utf-8')).toContain(`name: ${r}\n`);
        }
    });

    it('the sub-command table, the keyword table and the menu name every entry', () => {
        for (const r of fm.routes_to) {
            const sub = subOf(r);
            expect(text, `table row ${sub}`).toContain(`| \`/analyze:${sub}\` | \`analyze/${sub}/command.md\` |`);
            expect(text, `keyword row ${sub}`).toMatch(new RegExp(`\\| \`${sub}\` \\|\\n`, 'u'));
            expect(text, `menu entry ${sub}`).toMatch(new RegExp(`^> \\d+\\. \\[[a-z]+\\] .*\\(\`/analyze:${sub}\`\\)`, 'mu'));
        }
    });

    it('the escape is counted from routes_to, not written as a number', () => {
        expect(text).toContain('show every `routes_to` entry');
        expect(text).not.toMatch(/show all \w+ options unranked/u);
    });

    it('the eval set routes one prompt per routes_to entry to that entry', () => {
        for (const r of fm.routes_to) {
            expect(evals.cases.filter((c) => c.expected === r), r).toHaveLength(1);
        }
    });
});
