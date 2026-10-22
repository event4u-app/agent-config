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
 *
 * Every body assertion runs against the `## Enforced limits` SECTION, not the
 * whole file. Searching the file matches the frontmatter and the pre-existing
 * prose, so the case stays green when the section is deleted — which is the
 * one thing it exists to notice (R2 review 2026-10-19, findings 5 and 6).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMMAND = path.join(ROOT, 'src/domains/analysis-workbench/analyze/inbox/command.md');
const text = fs.readFileSync(COMMAND, 'utf-8');
const fmBlock = /^---\n([\s\S]*?)\n---\n/u.exec(text);
if (fmBlock === null) throw new Error(`${COMMAND}: no frontmatter block`);
const fm = parse(fmBlock[1]!) as Record<string, unknown>;
/** The body only — frontmatter stripped, so a key cannot satisfy a prose assertion. */
const body = text.slice(fmBlock[0].length);

/** One top-level section of the body, heading excluded. */
function section(heading: string): string {
    const start = body.indexOf(`\n## ${heading}\n`);
    if (start === -1) return '';
    const after = start + heading.length + 5;
    const next = body.indexOf('\n## ', after);
    return body.slice(after, next === -1 ? body.length : next);
}

describe('analyze:inbox limits', () => {
    it('pins the limit values', () => {
        expect(fm['limits']).toEqual({
            mode_default: 'plan',
            max_iterations: 3,
            hard_ceiling: 3,
            no_gain_stop: 1,
            target_metric: 'required',
        });
    });

    it('an enforced-limits section exists and names all five keys', () => {
        const s = section('Enforced limits');
        expect(s).not.toBe('');
        for (const key of [
            'mode_default: plan',
            'max_iterations: 3',
            'hard_ceiling: 3',
            'no_gain_stop: 1',
            'target_metric: required',
        ]) {
            expect(s).toContain(key);
        }
    });

    it('that section explains each key against the work the door does', () => {
        const s = section('Enforced limits');
        // mode_default: plan — the door stays local, publishes only on --publish
        // plus a this-turn confirmation naming the branch, and names its stop flags.
        expect(s).toMatch(/stays local/u);
        expect(s).toContain('`--publish`');
        expect(s).toMatch(/confirmation this turn naming that branch/u);
        expect(s).toContain('`--no-pr`');
        // max_iterations / hard_ceiling — the extraction-pass cap, and why they are equal.
        expect(s).toMatch(/capped at\s+three passes/u);
        expect(s).toMatch(/no flag raises it/u);
        // no_gain_stop — one pass that adds nothing ends the loop.
        expect(s).toMatch(/adds no row ends the loop/u);
        // target_metric — a denominator that exists before pass 1.
        expect(s).toMatch(/\*\*before\*\* the first\s+extraction/u);
    });

    it('the flow the section pins still says what the section claims', () => {
        // The pin is only worth reading while the body it points at agrees.
        expect(body).toContain('capped at three extraction passes');
        expect(body).toContain('Stop at zero added or at the cap');
        expect(body).toMatch(/enumerable structure \*\*before\*\*\s+the first\s+extraction/u);
    });

    it('links the shared analysis-loop context (step 1.3)', () => {
        expect(body).toContain('](../../contexts/execution/analysis-loop.md)');
    });
});
