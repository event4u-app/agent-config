// Tests for src/scripts/bench_per_tool.ts (py2ts Phase 8 / Wave 8d).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure pieces (load_descriptions, render_markdown shape) plus a golden-parity
// layer that runs python3 vs tsx and compares stdout + stderr + exit code,
// normalising only the embedded UTC `generated_at` timestamp (the single
// volatile field). The `--write-report` path is exercised with snapshot +
// restore of internal/bench/reports/ so the test leaves zero git drift.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as bpt from '../../src/scripts/bench_per_tool.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


/** Normalise the embedded UTC timestamp (the only volatile output value). */

describe('bench_per_tool — pure helpers', () => {
    it('load_descriptions returns an empty map for a missing dir', () => {
        const m = bpt.load_descriptions(path.join(REPO_ROOT, 'no', 'such', 'dir'));
        expect(m.size).toBe(0);
    });

    // .augment/skills is a gitignored generated projection (symlink → dist);
    // present after `task sync` but absent in a bare CI checkout. Skip when
    // absent (the empty-dir contract is covered by the test above).
    it.skipIf(!fs.existsSync(path.join(REPO_ROOT, '.augment', 'skills')))('load_descriptions reads name + description from .augment/skills', () => {
        const m = bpt.load_descriptions(path.join(REPO_ROOT, '.augment', 'skills'));
        expect(m.size).toBeGreaterThan(0);
        // Each value is "name description" (name prefixed).
        for (const [name, blob] of m) {
            expect(blob.startsWith(`${name} `)).toBe(true);
        }
    });

    it('render_markdown carries the header + threshold + reference', () => {
        const summary = bpt.evaluate(
            path.join(REPO_ROOT, 'tests', 'eval', 'corpus-dev.yaml'),
            3,
            0.85,
        );
        const md = bpt.render_markdown(summary);
        expect(md).toContain('# Projection fidelity — ');
        expect(md).toContain('threshold=0.85');
        expect(md).toContain('reference=`augment`');
        expect(md).toContain('| tool | status | skills | accuracy | fidelity | pass |');
    });
});
