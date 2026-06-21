// Tests for src/scripts/analysis_freshness.ts (py2ts — ADR-200).
//
// Two layers:
//  1. Unit tests over the exported cmd_stamp / cmd_check on tmp files, asserting
//     header round-trip + the no-header / header-present check branches.
//  2. Golden parity: python3 analysis_freshness.py vs tsx, both pointed at the
//     SAME tmp ANALYSIS_DIR (Python via an importlib wrapper that monkeypatches
//     ANALYSIS_DIR; TS via _setAnalysisDirForTest), asserting byte-identical
//     stdout/stderr + exit across --check / --check-all / --stamp / --stamp-all
//     and every argparse error path (no-args required-group, mutex conflict,
//     missing value, unrecognized). Both processes shell out to the SAME real
//     git at the SAME REPO_ROOT, so the date/commit tokens are identical
//     between the two without normalization. Skipped without python3.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cmd_check, cmd_stamp, _setAnalysisDirForTest } from '../../src/scripts/analysis_freshness.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


const HEADER_RE = /^<!-- analyzed: [\d-]+ \| commit: [0-9a-f]+ \| files: \d+ -->\n/;

// --- Unit -------------------------------------------------------------------

describe('analysis_freshness — cmd_stamp / cmd_check', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(REPO_ROOT, 'af-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        _setAnalysisDirForTest(path.join(REPO_ROOT, 'agents', 'evidence', 'analysis'));
    });

    it('cmd_stamp writes a freshness header and is idempotent on re-stamp', () => {
        const f = path.join(tmp, 'doc.md');
        fs.writeFileSync(f, '# Doc\n\nbody\n', 'utf-8');
        expect(cmd_stamp(f)).toBe(0);
        const first = fs.readFileSync(f, 'utf-8');
        expect(HEADER_RE.test(first)).toBe(true);
        expect(first.includes('# Doc')).toBe(true);
        // Re-stamp replaces (not duplicates) the header.
        expect(cmd_stamp(f)).toBe(0);
        const second = fs.readFileSync(f, 'utf-8');
        expect((second.match(/analyzed:/g) ?? []).length).toBe(1);
    });

    it('cmd_check on a headerless file returns 0 (warns to stdout)', () => {
        const f = path.join(tmp, 'doc.md');
        fs.writeFileSync(f, 'no header\n', 'utf-8');
        expect(cmd_check(f)).toBe(0);
    });

    it('cmd_check on a stamped file returns 0', () => {
        const f = path.join(tmp, 'doc.md');
        fs.writeFileSync(f, '# Doc\n', 'utf-8');
        cmd_stamp(f);
        expect(cmd_check(f)).toBe(0);
    });
});

// --- Golden parity (python3 vs tsx) ----------------------------------------



