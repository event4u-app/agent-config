import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const DIR = path.join(ROOT, 'src/agent-src/templates/github-workflows');
const MAJOR = String(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version).split('.')[0];

/** Lines that run the package (npx / npm install), never a comment mentioning it. */
function invocations(): Array<{ file: string; line: number; text: string }> {
    const out: Array<{ file: string; line: number; text: string }> = [];
    for (const f of fs.readdirSync(DIR).filter((n) => /\.ya?ml$/.test(n))) {
        fs.readFileSync(path.join(DIR, f), 'utf8')
            .split('\n')
            .forEach((text, i) => {
                if (/^\s*#/.test(text)) return;
                if (/\b(?:npx|npm\s+(?:install|i|exec))\b[^\n]*@event4u\/agent-config/.test(text)) out.push({ file: f, line: i + 1, text });
            });
    }
    return out;
}

describe('shipped workflow templates pin the package major', () => {
    it('finds invocations to check', () => {
        expect(invocations().length).toBeGreaterThan(0);
    });

    it('every invocation carries @<current major>, so release_env bumps it with the rest', () => {
        const unpinned = invocations()
            .filter((i) => !new RegExp(`@event4u/agent-config@${MAJOR}(?![\\w.-])`).test(i.text))
            .map((i) => `${i.file}:${i.line}`);
        expect(unpinned).toEqual([]);
    });
});
