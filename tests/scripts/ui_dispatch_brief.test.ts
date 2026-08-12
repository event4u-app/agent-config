/**
 * `ui_dispatch_brief` — the dispatch-prompt contract for UI-shaped slices.
 *
 * What this can and cannot check, stated up front because the difference is
 * the finding: an orchestration record carries `ts`, `spawn_count`,
 * `token_delta`, `tier_chosen` and `task_class` and has no field able to hold
 * a prompt. So no test can join a real dispatch prompt against its record and
 * assert the design context travelled. That data does not exist by design.
 *
 * What IS checkable is that the contract is written down where the
 * orchestrator reads it, names both artefacts, and requires the absence case
 * to be stated rather than omitted — which is the half that kept getting lost.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PROMPTS_DIR = path.join(REPO_ROOT, 'src', 'skills', 'subagent-orchestration', 'prompts');
const README = fs.readFileSync(path.join(PROMPTS_DIR, 'README.md'), 'utf-8');
const RECORD_SRC = fs.readFileSync(
    path.join(REPO_ROOT, 'src', 'scripts', 'orchestration_record.ts'),
    'utf-8',
);

describe('dispatch-prompt contract', () => {
    it('requires the audit findings on a UI-shaped slice', () => {
        expect(README).toMatch(/audit findings/i);
        expect(README).toMatch(/existing-ui-audit/);
    });

    it('requires the design brief with all five keys named', () => {
        for (const key of ['layout', 'components', 'states', 'microcopy', 'a11y']) {
            expect(README).toContain(`\`${key}\``);
        }
    });

    it('requires the absence case to be stated, not silently omitted', () => {
        expect(README).toMatch(/no audit findings available/i);
    });

    it('states the enforcement boundary instead of implying a gate', () => {
        expect(README).toMatch(/model-carried/i);
        expect(README).toMatch(/no lint can join/i);
    });
});

describe('the boundary the contract rests on', () => {
    it('the orchestration record really has no prompt-bearing field', () => {
        // If a future change adds one, this test fails and the README's
        // "no lint can join" sentence becomes false — which is exactly when
        // it should be revisited rather than quietly left standing.
        const canonicalBlock = /JSON\.stringify\(\{([\s\S]*?)\}\)/.exec(RECORD_SRC)?.[1] ?? '';

        expect(canonicalBlock).not.toMatch(/prompt|text|body|content|message/i);
        for (const field of ['ts', 'spawn_count', 'token_delta', 'tier_chosen', 'task_class']) {
            expect(canonicalBlock).toContain(field);
        }
    });
});

describe('prompt templates', () => {
    it('every mode file listed in the README exists', () => {
        const linked = [...README.matchAll(/\]\((([a-z0-9-]+)\.md)\)/g)].map((m) => m[1]!);
        const unique = [...new Set(linked)];

        expect(unique.length).toBeGreaterThan(0);
        for (const file of unique) {
            expect(fs.existsSync(path.join(PROMPTS_DIR, file)), file).toBe(true);
        }
    });
});
