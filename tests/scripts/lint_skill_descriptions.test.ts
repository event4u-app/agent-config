/**
 * Fixture tests for `src/scripts/lint_skill_descriptions.ts`
 * (ecosystem-harvest skill-quality-gates, Phase 1).
 *
 * Must-fail: the auto-generated-skill-farm circular frontmatter (name-echo
 * description, no routing signal) — the index Reject-log specimen, used here
 * ONLY as a must-fail lint fixture. Must-pass: three shipped skills whose
 * descriptions carry real routing signal.
 *
 * Unit-level against the exported `analyseSkill` (deterministic, no model/API),
 * plus one CLI-contract assertion that the linter runs clean on the real repo.
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { analyseSkill } from '../../src/scripts/lint_skill_descriptions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const TSX = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPT = path.join(REPO, 'src', 'scripts', 'lint_skill_descriptions.ts');

const codes = (slug: string, fm: Record<string, string>) => analyseSkill(slug, fm).map((v) => v.code);

describe('lint_skill_descriptions — must-fail specimens', () => {
    it('flags the farm-generator name-echo description (desc ≡ name + no signal)', () => {
        const c = codes('data-export', { name: 'data-export', description: 'Data export' });
        expect(c).toContain('desc-equals-name');
        expect(c).toContain('no-routing-signal');
    });

    it('flags a verbatim duplicated multi-word trigger phrase', () => {
        const c = codes('foo', {
            name: 'foo',
            description: 'Export the ledger to CSV. Export the ledger to CSV.',
        });
        expect(c).toContain('duplicated-trigger');
    });

    it('flags triggers that are all substrings of the name', () => {
        const c = codes('image-resizer', { name: 'image-resizer', description: 'image resizer' });
        expect(c).toContain('triggers-are-name');
    });

    it('flags a bare topic restatement with no routing signal', () => {
        const c = codes('widgets', { name: 'widgets', description: 'Widgets stuff' });
        expect(c).toContain('no-routing-signal');
    });
});

describe('lint_skill_descriptions — must-pass specimens', () => {
    const pass: Array<[string, Record<string, string>]> = [
        ['security-audit', { name: 'security-audit', description: 'ONLY when user explicitly requests: security audit, vulnerability scan, or penetration test review. NOT for regular feature work.' }],
        ['laravel', { name: 'laravel', description: 'Writes Laravel PHP — Eloquent, Artisan controllers, FormRequests, jobs, events, policies, providers.' }],
        ['markitdown', { name: 'markitdown', description: "Convert PDF, DOCX, XLSX to Markdown via the markitdown-mcp server — 'extract this PDF', 'OCR this image'." }],
    ];
    for (const [slug, fm] of pass) {
        it(`passes the shipped skill "${slug}"`, () => {
            expect(analyseSkill(slug, fm)).toEqual([]);
        });
    }
});

describe('lint_skill_descriptions — CLI contract', () => {
    it('runs clean on the real repo (exit 0)', () => {
        const r = spawnSync(TSX, [SCRIPT, '--quiet'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        expect(r.status).toBe(0);
    });
});
