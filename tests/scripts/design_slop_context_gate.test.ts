// road-to-tells-a-near-miss-can-refute 0.1/0.2: a DESIGN.md silences a rule
// only by DECLARING intent — never by mentioning a word.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadDesignContext, scanFile } from '../../src/scripts/lint_design_slop.js';

let dir = '';
afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

function findingsWith(designMd: string, css: string, file = 'app.css'): string[] {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-gate-'));
    fs.writeFileSync(path.join(dir, 'DESIGN.md'), designMd);
    return scanFile(css, file, loadDesignContext(dir)).map((f) => f.rule);
}

const INTER = 'body { font-family: Inter, sans-serif; }\n';
const CREAM = 'body { background: #fbf8f1; color: #b08947; }\n';
const GLOW = '.hero { background: #0b0b10; box-shadow: 0 0 40px #a855f7; color: #fff; }\n';

describe('negation never declares intent', () => {
    it('"We never use Inter" does not silence T7', () => {
        expect(findingsWith('# Design\n\nWe never use Inter. Thousands of users read this.\n', INTER)).toContain(
            'slop-t7-default-fonts',
        );
    });
});

describe('a substring is not a word', () => {
    it('"thousands" does not declare "sand", "glowing" does not declare "glow"', () => {
        const md = '# Design\n\nThousands of glowing reviews.\n';
        const control = findingsWith('# Design\n', CREAM + GLOW);
        // The control must fire, or the comparison below is vacuous.
        expect(control).toEqual(expect.arrayContaining(['slop-c5-cream-palette', 'slop-c3-dark-glow']));
        const withMd = findingsWith(md, CREAM + GLOW);
        expect(withMd.sort()).toEqual(control.sort());
    });
});

describe('scope: an avoid-list is not a declaration', () => {
    it('Inter under "What we avoid" does not silence T7', () => {
        expect(findingsWith('# Design\n\n## What we avoid\n\n- Inter as the body face\n', INTER)).toContain(
            'slop-t7-default-fonts',
        );
    });
});

describe('a real declaration still suppresses', () => {
    it('frontmatter intent silences the rule it names', () => {
        expect(findingsWith('---\nintent: [inter]\n---\n# Design\n', INTER)).not.toContain('slop-t7-default-fonts');
    });

    it('an ## Intentional section silences the rule it names', () => {
        expect(findingsWith('# Design\n\n## Intentional\n\n- Inter is our product face.\n', INTER)).not.toContain(
            'slop-t7-default-fonts',
        );
    });
});
