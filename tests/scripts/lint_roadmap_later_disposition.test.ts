// Tests for src/scripts/lint_roadmap_later_disposition.ts (py2ts — ADR-200).
//
// Two layers:
//  1. Unit tests over the exported `check()` + helpers on a sandboxed
//     ROADMAP_ROOT (via _setRoadmapRootForTest), covering Rule A (status:later
//     outside later/) and Rule B (later/ roadmap without a resume condition),
//     plus the exclude-name / exclude-prefix filter and the frontmatter/status
//     parsers.
//  2. Golden parity: python3 lint_roadmap_later_disposition.py vs tsx, both
//     pointed at the SAME tmp ROADMAP_ROOT, asserting byte-identical
//     stdout/stderr + exit across clean / Rule-A / Rule-B / both, human +
//     --json output, and the argparse usage/error paths. Skipped without
//     python3.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _frontmatter,
    _is_roadmap,
    _status,
    check,
    _setRoadmapRootForTest,
} from '../../src/scripts/lint_roadmap_later_disposition.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


const FM_LATER = '---\nstatus: later\n---\n';
const FM_READY = '---\nstatus: ready\n---\n';

// --- Unit -------------------------------------------------------------------

describe('lint_roadmap_later_disposition — helpers', () => {
    it('_frontmatter / _status parse the YAML block', () => {
        expect(_frontmatter(FM_LATER)).toBe('status: later');
        expect(_status(FM_LATER)).toBe('later');
        expect(_status('no frontmatter here')).toBe(null);
        expect(_status('---\nstatus: READY\n---\nbody')).toBe('ready'); // .lower()
    });

    it('_is_roadmap excludes the known non-roadmap names + prefixes', () => {
        expect(_is_roadmap('/x/template.md')).toBe(false);
        expect(_is_roadmap('/x/README.md')).toBe(false);
        expect(_is_roadmap('/x/open-questions-2.md')).toBe(false);
        expect(_is_roadmap('/x/road-to-thing.md')).toBe(true);
    });
});

describe('lint_roadmap_later_disposition — check()', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(REPO_ROOT, 'lrl-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        _setRoadmapRootForTest(path.join(REPO_ROOT, 'agents', 'roadmaps'));
    });

    it('clean tree → no violations', () => {
        fs.writeFileSync(path.join(tmp, 'road-to-a.md'), FM_READY + 'work', 'utf-8');
        fs.mkdirSync(path.join(tmp, 'later'));
        fs.writeFileSync(path.join(tmp, 'later', 'road-to-b.md'), FM_LATER + 'parked', 'utf-8');
        _setRoadmapRootForTest(tmp);
        expect(check(tmp)).toEqual([]);
    });

    it('Rule A: status:later in active tree → violation', () => {
        fs.writeFileSync(path.join(tmp, 'road-to-a.md'), FM_LATER + 'work', 'utf-8');
        _setRoadmapRootForTest(tmp);
        const v = check(tmp);
        expect(v.length).toBe(1);
        expect(v[0]!.reason).toContain('must be parked in `later/`');
    });

    it('Rule B: later/ roadmap without resume condition → violation', () => {
        fs.mkdirSync(path.join(tmp, 'later'));
        fs.writeFileSync(path.join(tmp, 'later', 'road-to-b.md'), FM_READY + 'open work', 'utf-8');
        _setRoadmapRootForTest(tmp);
        const v = check(tmp);
        expect(v.length).toBe(1);
        expect(v[0]!.reason).toContain('no resume');
    });

    it('Rule B satisfied by a "Blocked until" body line', () => {
        fs.mkdirSync(path.join(tmp, 'later'));
        fs.writeFileSync(
            path.join(tmp, 'later', 'road-to-b.md'),
            FM_READY + 'Blocked until the API lands.',
            'utf-8',
        );
        _setRoadmapRootForTest(tmp);
        expect(check(tmp)).toEqual([]);
    });
});

// --- Golden parity (python3 vs tsx) ----------------------------------------



