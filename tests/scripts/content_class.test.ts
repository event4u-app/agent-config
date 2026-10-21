/**
 * `_lib/content_class.ts` is the one classifier the selection report and the
 * future result store share (road-to-tool-results-that-leave-a-handle D16).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as lib from '../../src/scripts/_lib/content_class.js';
import * as report from '../../src/scripts/report_reducible_classes.js';

const MODULE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/scripts/_lib/content_class.ts');

describe('content_class', () => {
    it('imports nothing, so a hook chunk can bundle it without pulling in the report', () => {
        const source = fs.readFileSync(MODULE, 'utf-8');
        expect(source).not.toMatch(/^\s*import\s/m);
        expect(source).not.toMatch(/\brequire\(/);
    });

    it('is the classifier the report re-exports, not a copy', () => {
        expect(report.classifyResult).toBe(lib.classifyResult);
        expect(report.pipelineStages).toBe(lib.pipelineStages);
        expect(report.CONTENT_CLASSES).toBe(lib.CONTENT_CLASSES);
    });

    it('classes the three PREREG classes and nothing else as content', () => {
        expect(lib.classifyResult('Read', null)).toBe('Read:text');
        expect(lib.classifyResult('Bash', 'cat src/a.ts')).toBe('Bash:file-print');
        expect(lib.classifyResult('Bash', 'git diff HEAD~1')).toBe('Bash:vcs-content');
        expect(lib.CONTENT_CLASSES).toEqual(['Read:text', 'Bash:file-print', 'Bash:vcs-content']);
    });
});
