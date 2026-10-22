import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseLogs } from '../../src/scripts/plan_test_shards.js';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'plan_test_shards', 'two-os.log');

describe('parseLogs — per-file seconds from a real node-tests job log', () => {
    const d = parseLogs(readFileSync(FIXTURE, 'utf-8'));

    it('reads the duration of each file line, through the terminal escapes', () => {
        expect(d.ubuntu['tests/scripts/reach_doctor.test.ts']).toBe(6.95);
        expect(d.macos['tests/scripts/skill_linter.test.ts']).toBe(1.38);
    });

    it('takes the OS from the job name in the line prefix', () => {
        expect(Object.keys(d.ubuntu)).not.toContain('tests/scripts/skill_linter.test.ts');
        expect(Object.keys(d.macos)).not.toContain('tests/scripts/reach_doctor.test.ts');
    });

    it('ignores lines that are not file results', () => {
        expect(Object.keys(d.ubuntu)).toHaveLength(1);
        expect(Object.keys(d.macos)).toHaveLength(1);
    });
});
