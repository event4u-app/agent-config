// The two comment-strippers must agree.
//
// `stripComments` (TypeScript, `src/scripts/consumer_matrix.ts`) and
// `stripCommentsMjs` (`src/scripts/_lib/strip_comments.mjs`, consumed by
// `prepack-check.mjs`) are the same lexer written twice, because the second
// consumer is run directly by node with no build step and cannot import a
// TypeScript module.
//
// They are duplicated deliberately, and this file is the price of the
// duplication: the identical defect — a doc comment carrying a relative
// specifier read as a real import — failed FIVE CI jobs across the two
// scanners on 2026-08-30, and fixing one while the other stayed broken is
// fixing an instance rather than the defect. A divergence is now a named test
// failure instead of one gate going red while its twin stays green.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { stripCommentsMjs } from '../../src/scripts/_lib/strip_comments.mjs';
import { stripComments } from '../../src/scripts/consumer_matrix.js';

const CASES: Array<[string, string]> = [
    ['a doc comment carrying a specifier', "/** `export { X } from './X'` */\nimport a from './real.js';"],
    ['a line comment carrying one', "// import b from './B'\nimport c from './c.js';"],
    ['an apostrophe in comment prose', "/** a module's body */\n/** `from './X'` */\nimport d from './d.js';"],
    ['a URL in a string is not a comment', "const u = 'https://x.dev/a';\nimport e from './e.js';"],
    ['an escaped quote inside a string', "const q = 'it\\'s fine';\nimport f from './f.js';"],
    ['a block comment spanning lines', '/*\n * from "./G"\n */\nimport g from "./g.js";'],
    ['a template literal', 'const t = `a ${1} b`;\nimport h from "./h.js";'],
    ['an unterminated block comment', "/* from './I'\nimport i from './i.js';"],
];

describe('the two comment-strippers', () => {
    it.each(CASES)('agree on: %s', (_name, source) => {
        expect(stripCommentsMjs(source)).toBe(stripComments(source));
    });

    it('agree on the real file that made both scanners go red', () => {
        // A synthetic corpus can agree while the file that failed still
        // diverges. This is that file.
        const real = readFileSync(
            join(process.cwd(), 'src', 'cli', 'commands', 'uiAudit.ts'),
            'utf8',
        );
        expect(stripCommentsMjs(real)).toBe(stripComments(real));
        expect(stripComments(real)).not.toContain("'./X'");
    });

    // removing_this_constraint_reds_it: change either implementation's newline
    // handling (e.g. carry `quote` across lines in one of them) — the
    // apostrophe case and the real-file case both name the divergence.
});
