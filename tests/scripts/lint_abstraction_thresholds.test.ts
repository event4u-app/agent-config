// Tests for src/scripts/lint_abstraction_thresholds.ts (ADR-213 drift gate).
//
// Three layers:
//   1. The real tree passes — every numeric extraction threshold cites the
//      canon and every pin holds (run against the repo root resolved from
//      this file's location, never process.cwd()).
//   2. Synthetic corpora in os.tmpdir() exercise the citation rule in both
//      directions (bare threshold → finding; cited threshold → clean).
//   3. The bidirectional pins: CANON_ROWS all match the canon file and every
//      SITES regex matches its file — so neither side can move alone.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CANON_FILE,
    CANON_ROWS,
    SITES,
    check_pins,
    is_threshold_statement,
    scan_citations,
    scan_content,
    split_blocks,
} from '../../src/scripts/lint_abstraction_thresholds.js';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('the real tree', () => {
    it('has zero citation findings and a plausible scan count', () => {
        const { findings, scanned } = scan_citations(REPO_ROOT);
        expect(findings).toEqual([]);
        // gate-coverage floor is 400; 533 at baseline.
        expect(scanned).toBeGreaterThanOrEqual(400);
    });

    it('has zero pin findings', () => {
        expect(check_pins(REPO_ROOT)).toEqual([]);
    });
});

describe('citation rule on synthetic corpora (tmp dir — never a tracked path)', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lat-'));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(rel: string, body: string): void {
        const p = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body, 'utf-8');
    }

    it('a bare threshold paragraph is a finding', () => {
        write('docs/guidelines/foo.md', '# Foo\n\nExtract the helper when used 7+ times.\n');
        const { findings, scanned } = scan_citations(tmp);
        expect(scanned).toBe(1);
        expect(findings).toHaveLength(1);
        expect(findings[0]!.file).toBe('docs/guidelines/foo.md');
        expect(findings[0]!.line).toBe(3);
        expect(findings[0]!.message).toContain('bare threshold');
    });

    it('a threshold paragraph citing the canon is clean', () => {
        write(
            'docs/guidelines/foo.md',
            '# Foo\n\nExtract the helper at 3+ uses — per-class canon:\n[`abstraction-thresholds`](abstraction-thresholds.md).\n',
        );
        expect(scan_citations(tmp).findings).toEqual([]);
    });

    it('a threshold-stating heading is satisfied by the citing block directly below', () => {
        write(
            'src/skills/foo/SKILL.md',
            '## Extract only when duplicated ≥ 3 times\n\nPer the canon, [`abstraction-thresholds`](x.md).\n',
        );
        expect(scan_citations(tmp).findings).toEqual([]);
    });

    it('a threshold-stating heading with no citation anywhere near it is a finding', () => {
        write(
            'src/skills/foo/SKILL.md',
            '## Extract only when duplicated ≥ 3 times\n\nJust do it.\n',
        );
        expect(scan_citations(tmp).findings).toHaveLength(1);
    });

    it('qualitative prose without a numeric bar is not a threshold statement', () => {
        // The tuned exclusions: ordinal caller/use/strategy and non-adjacent counts.
        expect(is_threshold_statement('No second caller, no second strategy → no abstraction.')).toBe(false);
        expect(is_threshold_statement('keep utilities inline until the third use earns extraction')).toBe(false);
        expect(is_threshold_statement('Extract to a variable when used 2 or more times.')).toBe(false);
        // …and the shapes that must fire:
        expect(is_threshold_statement('two real repetitions before you extract an abstraction')).toBe(true);
        expect(is_threshold_statement('Extract a props-only UI shell when used 3+ times')).toBe(true);
        expect(is_threshold_statement('Componentize at ≥4 repeats')).toBe(true);
    });
});

describe('split_blocks', () => {
    it('headings are their own block; table rows stay with their block', () => {
        const blocks = split_blocks('# H\n\npara one\nstill para one\n\n| a | b |\n|---|---|\n| 1 | 2 |\n');
        expect(blocks).toHaveLength(3);
        expect(blocks[0]).toMatchObject({ startLine: 1, heading: true });
        expect(blocks[1]).toMatchObject({ startLine: 3, heading: false });
        expect(blocks[2]!.text.split('\n')).toHaveLength(3);
    });

    it('scan_content reports the block start line', () => {
        const findings = scan_content('x.md', 'clean\n\nExtract when used 9+ times.\n');
        expect(findings).toEqual([
            expect.objectContaining({ file: 'x.md', line: 3 }),
        ]);
    });
});

describe('bidirectional pins (the canon and its sites move together)', () => {
    it('all four CANON_ROWS match the canon file', () => {
        const canon = fs.readFileSync(path.join(REPO_ROOT, CANON_FILE), 'utf-8');
        for (const { row, why } of CANON_ROWS) {
            expect(row.test(canon), `canon row: ${why} (/${row.source}/)`).toBe(true);
        }
    });

    it('every SITES regex matches its file', () => {
        for (const { file, mustMatch, why } of SITES) {
            const body = fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');
            expect(mustMatch.test(body), `${file}: ${why} (/${mustMatch.source}/)`).toBe(true);
        }
    });

    it('check_pins fails when the canon is absent (collapse is loud, not green)', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lat-pins-'));
        try {
            const findings = check_pins(tmp);
            expect(findings.some((f) => f.message === 'canon file missing')).toBe(true);
            // every site is reported missing too
            expect(findings.length).toBe(1 + SITES.length);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
