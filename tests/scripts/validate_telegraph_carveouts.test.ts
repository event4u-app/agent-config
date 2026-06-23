// Tests for src/scripts/validate_telegraph_carveouts.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_validate_telegraph_carveouts.py — the PASS_PAIRS /
// FAIL_PAIRS fixtures, the validate() no-drift / expected-category assertions,
// and the CLI exit-code + message checks. Plus golden parity (python3 vs tsx)
// over a representative drift pair (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { validate } from '../../src/scripts/validate_telegraph_carveouts.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'validate_telegraph_carveouts.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const PASS_PAIRS: Array<[string, string]> = [
    [
        "I will check the file now:\n```python\nprint('x')\n```\nThen I will see.",
        "Check file:\n```python\nprint('x')\n```\nThen see.",
    ],
    [
        'Which path do you want me to take?\n\n1. Option one with full context.\n2. Option two.\n\n**Recommendation:** Option 1.',
        'Pick path?\n\n1. Option one with full context.\n2. Option two.\n\n**Recommendation:** Option 1.',
    ],
    [
        'I will edit the file `scripts/foo.py` and call `bar()` there.',
        'Edit `scripts/foo.py`. Call `bar()`.',
    ],
    [
        'I ran the tests and got results:\n✅ test_a passed\n❌ test_b failed\n⚠️ test_c flaky',
        'Ran tests:\n✅ test_a passed\n❌ test_b failed\n⚠️ test_c flaky',
    ],
    [
        'Reminder of the rule:\n```\nNEVER COMMIT WITHOUT PERMISSION.\nNO EXCEPTIONS.\n```\nNow let me proceed.',
        'Rule:\n```\nNEVER COMMIT WITHOUT PERMISSION.\nNO EXCEPTIONS.\n```\nProceed.',
    ],
    [
        'Welche Variante möchtest du?\n\n1. Variante eins.\n2. Variante zwei.\n\n**Empfehlung:** Variante 1.',
        'Welche?\n\n1. Variante eins.\n2. Variante zwei.\n\n**Empfehlung:** Variante 1.',
    ],
    [
        'I will now condense this entire paragraph into telegraph grammar.',
        'Condense paragraph telegraph.',
    ],
];

const FAIL_PAIRS: Array<[string, string, string]> = [
    ["```python\nprint('x')\n```\nprose", "```python\nprint('y')\n```\nprose", 'code_fences'],
    ['1. Original option one.\n2. Option two.', '1. Mutated option one.\n2. Option two.', 'numbered_options'],
    ['Edit `scripts/foo.py` then continue.', 'Edit `scripts/bar.py` then continue.', 'backtick_spans'],
    ['✅ test_a passed\nprose', '✅ test_a now failed\nprose', 'status_markers'],
    [
        '```\nNEVER COMMIT WITHOUT PERMISSION.\n```\nprose',
        '```\nSOMETIMES COMMIT WITHOUT PERMISSION.\n```\nprose',
        'code_fences',
    ],
    ['**Recommendation:** Option 1.', '**Recommendation:** Option 2.', 'recommendation_labels'],
];

describe('validate_telegraph_carveouts — passes', () => {
    it.each(PASS_PAIRS.map((p, i) => [i, p[0], p[1]] as const))(
        'pair %i has no drift',
        (_i, pre, post) => {
            expect(validate(pre, post)).toEqual([]);
        },
    );
});

describe('validate_telegraph_carveouts — fails', () => {
    it.each(FAIL_PAIRS.map((p, i) => [i, p[0], p[1], p[2]] as const))(
        'pair %i drifts in expected category %s',
        (_i, pre, post, expectedCat) => {
            const names = validate(pre, post).map(([name]) => name);
            expect(names).toContain(expectedCat);
        },
    );
});

describe('validate_telegraph_carveouts — CLI', () => {
    function runPair(pre: string, post: string) {
        const td = fs.mkdtempSync(path.join(os.tmpdir(), 'tcc-'));
        try {
            const preP = path.join(td, 'pre.md');
            const postP = path.join(td, 'post.md');
            fs.writeFileSync(preP, pre, 'utf-8');
            fs.writeFileSync(postP, post, 'utf-8');
            return spawnSync(TSX_BIN, [TS_SCRIPT, preP, postP], { cwd: REPO_ROOT, encoding: 'utf8' });
        } finally {
            fs.rmSync(td, { recursive: true, force: true });
        }
    }

    it('exit 0 + "preserved" on pass', () => {
        const [pre, post] = PASS_PAIRS[0]!;
        const r = runPair(pre, post);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('preserved');
    });

    it('exit 1 + "DRIFT DETECTED" on fail', () => {
        const [pre, post] = FAIL_PAIRS[0]!;
        const r = runPair(pre, post);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('DRIFT DETECTED');
    });
});
