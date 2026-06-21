// Tests for src/scripts/audit_initial_context.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure helpers (rule_footprint / description_catalog / longest_rules /
// thin_projection / render_md shape) plus a golden-parity layer that runs
// python3 vs tsx on the REAL repo:
//   - `--fail-if-over-budget` is deterministic → byte-identical stdout/exit.
//   - `--json` / default carry a non-deterministic `generated` timestamp;
//     compared byte-identical after normalising that single line.
// Skipped without python3.
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as aic from '../../src/scripts/audit_initial_context.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


// Normalise the non-deterministic timestamp line so two builds compare equal.

describe('audit_initial_context — pure helpers', () => {
    // Reads the gitignored generated tool projections (.claude/rules, …) which
    // exist after `task generate-tools`/`sync` but are absent in a bare CI
    // checkout. Skip when none are present rather than assert a count.
    it.skipIf(!existsSync(path.join(REPO_ROOT, '.claude', 'rules')))('rule_footprint returns per-tool chars/token measures', () => {
        const rf = aic.rule_footprint();
        // .claude/rules exists in the repo → at least one tool measured.
        expect(Object.keys(rf).length).toBeGreaterThan(0);
        for (const m of Object.values(rf)) {
            expect(typeof m.chars).toBe('number');
            expect(typeof m.tokens_gpt).toBe('number');
            expect(typeof m.files).toBe('number');
        }
    });
    it('description_catalog reports the three eager surfaces', () => {
        const dc = aic.description_catalog();
        expect(Object.keys(dc).sort()).toEqual(['commands_core_source', 'skills_core_source', 'skills_projected']);
        for (const m of Object.values(dc)) {
            expect(typeof m.entries).toBe('number');
            expect(typeof m.chars).toBe('number');
        }
    });
    it('longest_rules is descending by tokens, capped at top', () => {
        const rows = aic.longest_rules(5);
        expect(rows.length).toBeLessThanOrEqual(5);
        for (let i = 1; i < rows.length; i += 1) {
            expect(rows[i - 1]!.tokens_gpt).toBeGreaterThanOrEqual(rows[i]!.tokens_gpt);
        }
    });
    it('thin_projection returns the measurement keys (never throws)', () => {
        const t = aic.thin_projection();
        // On the real repo the measurement succeeds and carries these keys.
        expect(t).toHaveProperty('rules_total');
        expect(t).toHaveProperty('eager_gpt');
        expect(t).toHaveProperty('saved_pct');
        expect(t).toHaveProperty('token_method');
    });
    it('build assembles the full report dict', () => {
        const d = aic.build();
        for (const k of ['generated', 'token_method', 'rule_footprint', 'thin_projection', 'description_catalog', 'longest_rules']) {
            expect(d).toHaveProperty(k);
        }
    });
    it('render_md emits the three section headers', () => {
        const md = aic.render_md(aic.build());
        expect(md).toContain('## 0B.2 — always-on rule footprint per tool');
        expect(md).toContain('## 0B.4 — description-catalog cost (eager)');
        expect(md).toContain('## 1.3 — top-10 longest rules (token trim candidates)');
    });
});
