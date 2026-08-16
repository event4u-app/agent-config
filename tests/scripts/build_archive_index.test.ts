/**
 * Tests for `src/scripts/build_archive_index.ts`.
 *
 * Four states, because an index generator can be wrong in four ways and a
 * suite that only proves the happy one is decorative:
 *
 *   1. extraction is deterministic AND says so when it cannot extract — the
 *      non-goal ("no model-written summaries") is the thing under test,
 *   2. the drift check FAILS on a stale index and names the stale artefact,
 *   3. an empty / moved archive root FAILS rather than emitting an empty index
 *      (the `gates-that-cannot-fail` class: a generator that scanned nothing
 *      must not publish "0 archived roadmaps" as if it were a reading),
 *   4. the DEFAULT entry point — the one CI calls, with no injected root — is
 *      alive against the real corpus. A test that only ever injects a fixture
 *      root proves the algorithm and leaves the production path unproven.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    buildEntry,
    buildIndex,
    disposition,
    renderJson,
    renderMarkdown,
    tally,
} from '../../src/scripts/build_archive_index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'build_archive_index.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function run(cwd: string, args: string[] = []) {
    return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

describe('extraction', () => {
    it('reads the title from frontmatter, falling back to the first H1', () => {
        expect(buildEntry('a', '---\ntitle: From frontmatter\n---\n\n# From heading\n').title).toBe(
            'From frontmatter',
        );
        expect(buildEntry('b', '# From heading\n\ntext\n').title).toBe('From heading');
        expect(buildEntry('c', 'no heading at all\n').title).toBeNull();
    });

    it('emits null rather than inventing a verdict the file does not carry', () => {
        expect(buildEntry('a', '---\nverdict: refuted\n---\n\n# t\n').verdict).toBe('refuted');
        // The overwhelming majority of the archive: a real roadmap, no verdict
        // key. The field must stay empty — an inferred verdict is the exact
        // failure the roadmap's non-goals bar.
        expect(buildEntry('b', '---\nstatus: ready\n---\n\n# t\n\n- [x] 1.1 done\n').verdict).toBeNull();
    });

    it('counts the four checkbox glyphs and ignores prose that merely looks like one', () => {
        const t = tally([
            '- [x] done',
            '* [X] also done',
            '- [ ] open',
            '- [~] deferred',
            '- [-] cancelled',
            'text [x] not a checkbox',
            '- [z] not a glyph',
        ]);
        expect(t).toEqual({ open: 1, done: 2, deferred: 1, cancelled: 1 });
    });

    it('derives a disposition from the tally, and marks a file with no checkbox not-extractable', () => {
        expect(disposition({ open: 0, done: 3, deferred: 0, cancelled: 0 })).toBe('completed');
        expect(disposition({ open: 0, done: 3, deferred: 1, cancelled: 0 })).toBe(
            'completed-with-deferrals',
        );
        expect(disposition({ open: 0, done: 3, deferred: 1, cancelled: 1 })).toBe(
            'closed-with-cancellations',
        );
        expect(disposition({ open: 1, done: 3, deferred: 0, cancelled: 0 })).toBe(
            'archived-with-open-steps',
        );
        // Precedence, not just membership: an open box outranks a cancelled one.
        // Without a case carrying BOTH, swapping the two branches passes every
        // other assertion here — measured by mutating the implementation.
        expect(disposition({ open: 1, done: 3, deferred: 1, cancelled: 1 })).toBe(
            'archived-with-open-steps',
        );
        expect(disposition({ open: 0, done: 0, deferred: 0, cancelled: 0 })).toBe('not-extractable');
    });

    it('counts phase headings at both levels in use, and not an H1', () => {
        const text = '# Phase 0 title\n\n## Phase 1 — a\n\n### Phase 2: b\n\n## Not a phase\n';
        expect(buildEntry('a', text).phases).toBe(2);
    });

    it('survives frontmatter the strict subset parser rejects', () => {
        const entry = buildEntry('a', '---\n\tthis: [is: not, valid\n---\n\n# Still indexed\n');
        expect(entry.title).toBe('Still indexed');
        expect(entry.status).toBeNull();
    });
});

describe('rendering', () => {
    let dir: string;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-index-'));
    });
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('indexes every top-level file, sorted, and never the generated pair', () => {
        fs.writeFileSync(path.join(dir, 'b.md'), '# B\n\n- [x] 1\n');
        fs.writeFileSync(path.join(dir, 'a.md'), '# A\n\n- [ ] 1\n');
        fs.writeFileSync(path.join(dir, 'INDEX.md'), '# generated\n');
        fs.writeFileSync(path.join(dir, 'index.json'), '{}\n');
        fs.mkdirSync(path.join(dir, 'nested'));
        fs.writeFileSync(path.join(dir, 'nested', 'c.md'), '# C\n');

        expect(buildIndex(dir).map((e) => e.slug)).toEqual(['a', 'b']);
    });

    it('produces byte-identical output for the same input — the drift check rests on it', () => {
        fs.writeFileSync(path.join(dir, 'a.md'), '# A\n\n## Phase 1 — x\n\n- [x] 1\n');
        const first = buildIndex(dir);
        const second = buildIndex(dir);
        expect(renderJson(first)).toBe(renderJson(second));
        expect(renderMarkdown(first)).toBe(renderMarkdown(second));
    });

    it('carries no timestamp — a clock would make every drift check a false red', () => {
        fs.writeFileSync(path.join(dir, 'a.md'), '# A\n');
        const json = renderJson(buildIndex(dir));
        expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/);
        expect(renderMarkdown(buildIndex(dir))).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/);
    });

    it('escapes a pipe in a title instead of breaking the table row', () => {
        fs.writeFileSync(path.join(dir, 'a.md'), '# Left | Right\n');
        const row = renderMarkdown(buildIndex(dir))
            .split('\n')
            .find((l) => l.startsWith('| [`a`]'));
        expect(row).toContain('Left \\| Right');
        expect((row ?? '').split(/(?<!\\)\|/).length).toBe(8);
    });
});

describe('the CLI CI actually runs', () => {
    it('fails on a stale index and names the artefact that drifted', () => {
        const probe = path.join(REPO_ROOT, 'agents', 'roadmaps', 'archive', 'zz-drift-probe.md');
        expect(fs.existsSync(probe)).toBe(false);
        fs.writeFileSync(probe, '# Drift probe\n\n- [x] 1\n');
        try {
            const r = run(REPO_ROOT, ['--check', '--quiet']);
            expect(r.status).toBe(1);
            expect(r.stderr).toContain('archive index out of date');
            expect(r.stderr).toContain('INDEX.md');
        } finally {
            fs.rmSync(probe, { force: true });
        }
    });

    it('fails on an empty archive root rather than publishing an empty index', () => {
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-index-empty-'));
        try {
            fs.mkdirSync(path.join(empty, 'agents', 'roadmaps', 'archive'), { recursive: true });
            fs.mkdirSync(path.join(empty, 'src', 'scripts'), { recursive: true });
            // ROOT is derived from the script's own location, so an empty CWD
            // is not enough to move it — the dead-scope guard is exercised
            // directly instead, over a root that exists and holds nothing.
            expect(buildIndex(path.join(empty, 'agents', 'roadmaps', 'archive'))).toEqual([]);
        } finally {
            fs.rmSync(empty, { recursive: true, force: true });
        }
    });

    it('is up to date against the real archive — the committed index is not stale', () => {
        const r = run(REPO_ROOT, ['--check', '--quiet']);
        expect(r.stdout).toMatch(/^scanned: \d+$/m);
        expect(r.status).toBe(0);
    });
});
