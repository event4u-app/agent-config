/**
 * Pins the `limits:` block of `analyze/inbox/command.md` against its flow text.
 *
 * `analyze:inbox` is the fourth door of ADR-288 and the only one that was
 * shipping its caps in prose alone: the three-pass extraction cap, the
 * zero-added stop, the census taken before the first extraction and the
 * publish default lived in the body with no machine-readable pin, so nothing
 * failed when flow and contract drifted. AC-2 of
 * `road-to-an-analysis-family-that-deepens-itself` asks for a numeric cap in a
 * `limits:` block on EVERY door; the three siblings already carry one.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMMAND = path.join(ROOT, 'src/domains/analysis-workbench/analyze/inbox/command.md');
const text = fs.readFileSync(COMMAND, 'utf-8');
const fm = parse(/^---\n([\s\S]*?)\n---\n/u.exec(text)![1]!) as Record<string, unknown>;

describe('analyze:inbox limits', () => {
    it('pins the limit values', () => {
        expect(fm['limits']).toEqual({
            mode_default: 'execute',
            max_iterations: 3,
            hard_ceiling: 3,
            no_gain_stop: 1,
            target_metric: 'required',
        });
    });

    it('the body restates each limit', () => {
        // max_iterations / hard_ceiling — the extraction-pass cap.
        expect(text).toContain('capped at three extraction passes');
        // no_gain_stop — one pass that adds nothing ends the loop.
        expect(text).toContain('Stop at zero added or at the cap');
        // target_metric — a denominator measured before the first extraction.
        expect(text).toMatch(/enumerable structure \*\*before\*\*\s+the first\s+extraction/u);
        // mode_default: execute — the run publishes unless told otherwise.
        expect(text).toContain('`--no-pr`');
    });

    it('names the five keys in an enforced-limits section', () => {
        for (const key of [
            'mode_default: execute',
            'max_iterations: 3',
            'hard_ceiling: 3',
            'no_gain_stop: 1',
            'target_metric: required',
        ]) {
            expect(text).toContain(key);
        }
    });

    it('links the shared analysis-loop context (step 1.3)', () => {
        expect(text).toContain('](../../contexts/execution/analysis-loop.md)');
    });
});
