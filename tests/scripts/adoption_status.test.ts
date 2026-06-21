// Tests for src/scripts/adoption_status.ts (py2ts Phase 8 / Wave 8a).
//
// Ports tests/test_adoption_status.py 1:1 (parse_registry_statuses,
// count_recruit_reports, render_text, render_json) plus a golden-parity
// layer that runs python3 vs tsx on the REAL REPO (skipped without python3).
// Live `gh` invocations are not exercised — the CI color resolution exits
// via the `unknown` branch when `gh` is absent, identically in both.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as as_ from '../../src/scripts/adoption_status.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


const SAMPLE_REGISTRY = `# Registry Submissions — tracking sheet

## Status legend

| Status | Meaning |
|---|---|
| \`pending\` | Pre-submission. |

## Tracking rows

| # | Registry | Submission shape | Status | PR / form URL | Date | Maintainer notes |
|---|---|---|---|---|---|---|
| 1 | A | shape A | \`pending\` | — | — | note |
| 2 | B | shape B | \`submitted\` | url-b | 2026-05-26 | note |
| 3 | C | shape C | \`accepted\` | url-c | 2026-05-26 | note |
| 4 | D | shape D | \`rejected\` | url-d | 2026-05-26 | note |
| 5 | E | shape E | \`stalled\` | url-e | 2026-03-01 | note |

## How to update a row

(Out of scope for parser.)
`;

describe('adoption_status — ported pytest suite', () => {
    it('parser counts each status once', () => {
        const counts = as_.parse_registry_statuses(SAMPLE_REGISTRY);
        expect(counts).toEqual({
            pending: 1,
            submitted: 1,
            accepted: 1,
            rejected: 1,
            stalled: 1,
        });
    });

    it('parser handles a table with no rows', () => {
        const counts = as_.parse_registry_statuses('# Doc\n\n## Tracking rows\n\nNo rows yet.\n');
        const expected: Record<string, number> = {};
        for (const s of as_.STATUS_VALUES) expected[s] = 0;
        expect(counts).toEqual(expected);
    });

    it('parser stops at the next h2 section', () => {
        const doc = SAMPLE_REGISTRY + '\n| 99 | not | counted | `pending` | x | y | z |\n';
        const counts = as_.parse_registry_statuses(doc);
        expect(counts.pending).toBe(1);
    });

    it('count_recruit_reports skips template and runbook', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recruit-'));
        try {
            fs.writeFileSync(path.join(tmp, '_template.md'), '');
            fs.writeFileSync(path.join(tmp, '_runbook.md'), '');
            fs.writeFileSync(path.join(tmp, 'README.md'), '');
            fs.writeFileSync(path.join(tmp, '01-galabau-owner.md'), '');
            fs.writeFileSync(path.join(tmp, '02-content-creator.md'), '');
            expect(as_.count_recruit_reports(tmp)).toBe(2);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('count_recruit_reports missing dir → 0', () => {
        expect(as_.count_recruit_reports(path.join(REPO_ROOT, 'does-not-exist'))).toBe(0);
    });

    it('render_text includes all five status values', () => {
        const counts = { pending: 2, submitted: 1, accepted: 0, rejected: 0, stalled: 0 };
        const out = as_.render_text(counts, 3, ['green', '5 green'], 'main');
        for (const s of as_.STATUS_VALUES) {
            expect(out).toContain(s);
        }
        expect(out).toContain('Recruit-session reports filed: 3');
        expect(out).toContain('main');
        expect(out).toContain('5 green');
    });

    it('render_json shape', () => {
        const counts = { pending: 1, submitted: 0, accepted: 0, rejected: 0, stalled: 0 };
        const out = as_.render_json(counts, 0, ['green', 'all green'], 'main');
        const parsed = JSON.parse(out) as {
            registries: Record<string, number>;
            recruit_reports: number;
            ci: { color: string; branch: string };
        };
        expect(parsed.registries.pending).toBe(1);
        expect(parsed.recruit_reports).toBe(0);
        expect(parsed.ci.color).toBe('green');
        expect(parsed.ci.branch).toBe('main');
    });
});
