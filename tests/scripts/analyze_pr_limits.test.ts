/**
 * Pins the `limits:` block of `analyze/pr/command.md` against its flow text
 * (step 5.2/5.3), and both against the code the flow names, so the frontmatter
 * pin, the body and `analysis_pr_optimize.ts` cannot drift apart.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { MAX_OPTIMIZE_ROUNDS } from '../../src/scripts/analysis_pr_optimize.js';
import { DEFAULT_CONFIDENCE_THRESHOLD } from '../../src/scripts/analysis_pr_review.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMMAND = path.join(ROOT, 'src/domains/analysis-workbench/analyze/pr/command.md');
const text = fs.readFileSync(COMMAND, 'utf-8');
const fm = parse(/^---\n([\s\S]*?)\n---\n/u.exec(text)![1]!) as Record<string, unknown>;

describe('analyze:pr limits', () => {
    it('pins the limit values and matches the code', () => {
        expect(fm['limits']).toEqual({ mode_default: 'plan', max_iterations: 3, hard_ceiling: 3, no_gain_stop: 1, target_metric: 'required' });
        expect(MAX_OPTIMIZE_ROUNDS).toBe(3);
        expect(text).toContain(`Default \`${DEFAULT_CONFIDENCE_THRESHOLD}\``);
    });

    it('the body restates each limit', () => {
        expect(text).toContain('`--optimize` must be\n**explicitly present in the invocation**');
        expect(text).toContain('At most **three** fix rounds');
        expect(text).toMatch(/One review that finds\s+nothing new above the threshold stops the run/u);
        expect(text).toContain('findings with a diff anchor');
    });

    it('feedback is read-only and the door never merges', () => {
        expect(text).toContain('makes no `gh` write call');
        expect(text).toContain('Never merges, never approves its own changes');
    });

    it('links the shared analysis-loop context (step 1.3)', () => {
        expect(text).toContain('](../../contexts/execution/analysis-loop.md)');
    });
});
