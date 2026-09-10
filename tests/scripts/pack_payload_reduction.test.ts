import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { markdown, type Delta } from '../../src/scripts/report_pack_delta';

/**
 * `road-to-npm-payload-reduction` acceptance, mechanised.
 *
 * The expensive halves — packing a tarball, installing it globally, bisecting
 * `files[]` — are NOT run here: one harness invocation takes minutes, and a
 * unit suite that shells out to `npm install --global` is a suite nobody runs.
 * What is asserted here is everything a cheap check CAN see: that the
 * exclusions the harness proved safe are actually in `files[]`, that the cap is
 * DERIVED from a measurement and bounded by the value its newest dated note
 * justifies, and that the delta reporter's contract holds.
 *
 * This paragraph used to end "that the cap moved DOWN". ADR-273 reset the cap
 * upward on a reconstructed clean baseline, so that clause was false the moment
 * the block below was rewritten and is corrected here rather than left for a
 * reader to trip over.
 *
 * The behavioural evidence itself lives in
 * `agents/evidence/analysis/npm-payload-subtree-verdicts.md` and is reproducible
 * by `./scripts-run src/scripts/pack_install_smoke --sabotage <subtree>`.
 */

const manifest = (): { files: string[] } =>
    JSON.parse(fs.readFileSync('package.json', 'utf8')) as { files: string[] };

const budget = (): { budgets: { packed_size_mb: { max: number; last_measured: number } } } =>
    JSON.parse(fs.readFileSync(path.join('src', 'config', 'pack-size-budget.json'), 'utf8')) as never;

describe('the exclusions the harness proved safe are in files[]', () => {
    it('carries all three, as negations', () => {
        const files = manifest().files;
        for (const pat of [
            '!src/**/*.test.ts',
            '!src/**/*.spec.ts',
            '!dist/agent-src/skills/**/evals/**',
            '!dist/**/*.map',
        ]) {
            expect(files, `files[] must exclude ${pat}`).toContain(pat);
        }
    });

    it('does NOT exclude any subtree the harness found still ships', () => {
        // Every one of these broke a probe. Re-adding an exclusion for any of
        // them is the regression this asserts against — the ai_council row in
        // particular, which has been proposed and deferred across four cap raises.
        const files = manifest().files.join('\n');
        for (const shipped of [
            'src/scripts/ai_council',
            'src/scripts/hooks',
            'src/scripts/_cli',
            'src/scripts/mcp_server',
            'src/scripts/ai-video',
            'src/agent-src',
        ]) {
            expect(files, `${shipped} ships — see npm-payload-subtree-verdicts.md`).not.toContain(`!${shipped}`);
        }
    });
});

/**
 * SUPERSEDED IN ITS LITERALS, KEPT IN ITS DISCIPLINE — ADR-273, 2026-09-10.
 *
 * This block used to pin `max < 9.2`, a headroom band of 6-8 %, and the literal
 * strings `7.4 %` / `HEADROOM IS 7.4 %, NOT 8 %`. Those assert one historical
 * moment — the 9.2 -> 9.1 reduction — rather than an invariant, and ADR-273
 * reset the cap to 11.5 on a reconstructed clean baseline after establishing
 * that the comparator every earlier figure was set against carried 0.4058 MB of
 * stale build output. A test that pins a superseded moment fails on the change
 * that supersedes it and says nothing about whether that change was sound.
 *
 * What is asserted instead is the part that does NOT expire: the cap is
 * DERIVED, never chosen. This file's own documented formula is
 * `max = last_measured x 1.095`, and every recorded reset in its history obeys
 * it. Pinning the derivation catches the thing the old literals were really
 * guarding — a cap nudged up to clear a failing check — at every future reset
 * rather than only at this one.
 */
describe('the cap is derived from a measurement, never chosen', () => {
    // The absolute anchor. The derivation check below is satisfied by raising
    // `max` and `last_measured` together, which is precisely the move the block
    // exists to catch — so a ceiling on the literal value has to sit beside it.
    // This IS a moment pin and is meant to be: it is updated at each recorded
    // reset, in the same diff as the `baseline_note_<date>` that justifies it.
    it('max is at or below the value ADR-273 reset it to', () => {
        expect(budget().budgets.packed_size_mb.max).toBeLessThanOrEqual(11.5);
    });

    it('max never exceeds last_measured x 1.095', () => {
        const { max, last_measured: measured } = budget().budgets.packed_size_mb;
        expect(max).toBeLessThanOrEqual(measured * 1.095);
    });

    it('max leaves real headroom — a cap at or under the measurement reds on day one', () => {
        const { max, last_measured: measured } = budget().budgets.packed_size_mb;
        expect(max).toBeGreaterThan(measured);
    });

    it('the newest baseline note states the headroom exactly, and it matches the numbers', () => {
        const raw = fs.readFileSync(path.join('src', 'config', 'pack-size-budget.json'), 'utf8');
        const { max, last_measured: measured } = budget().budgets.packed_size_mb;
        // COMPUTED, not pinned. An earlier revision of this block asserted the
        // literal `HEADROOM IS 7.4 %, NOT 8 %` and had to be hand-edited by the
        // reset that superseded it; replacing one literal with the next would
        // have reproduced that cost. Deriving the string means the assertion
        // survives every future reset and still catches a rounded figure.
        const pct = (((max - measured) / measured) * 100).toFixed(2);
        expect(raw).toContain(`HEADROOM IS ${pct} %`);
    });

    it('the newest baseline note names the cap value it justifies', () => {
        const raw = fs.readFileSync(path.join('src', 'config', 'pack-size-budget.json'), 'utf8');
        const { max } = budget().budgets.packed_size_mb;
        const dates = [...raw.matchAll(/"(baseline_note_\d{4}_\d{2}_\d{2})"/g)].map((m) => m[1] as string);
        // Counting notes proves nothing: the count only grows and is tied to no
        // cap value. What a raise landing without justification actually breaks
        // is that the NEWEST note stops mentioning the number in force.
        expect(dates.length).toBeGreaterThan(0);
        const newest = dates.sort().at(-1) as string;
        const note = (JSON.parse(raw) as Record<string, never>)['budgets']['packed_size_mb'][newest] as unknown;
        expect(typeof note, `${newest} must live under budgets.packed_size_mb`).toBe('string');
        expect(note as string).toContain(String(max));
    });
});

describe('the delta reporter is a report, not a gate', () => {
    const side = (packed: number, entries: number, ref: string) => ({
        ref,
        packedBytes: packed,
        unpackedBytes: packed * 3,
        entries,
    });

    it('renders a growth as +KB and names the cap headroom', () => {
        const d: Delta = {
            base: side(8_400_000, 2700, 'origin/main'),
            head: side(8_450_000, 2710, 'HEAD'),
            packedDeltaBytes: 50_000,
            entryDelta: 10,
            capMb: 9.1,
            headroomBytes: 650_000,
        };
        const md = markdown(d);
        expect(md).toContain('grew');
        expect(md).toContain('+48.8 KB');
        expect(md).toContain('Cap 9.1 MB');
        // The reason the line exists at all must travel with it, or a future
        // reader deletes it as noise.
        expect(md).toContain('MERGE artifact');
    });

    it('renders a reduction as a shrink, with a minus sign', () => {
        const d: Delta = {
            base: side(8_500_000, 2775, 'origin/main'),
            head: side(8_410_000, 2609, 'HEAD'),
            packedDeltaBytes: -90_000,
            entryDelta: -166,
            capMb: 9.1,
            headroomBytes: 690_000,
        };
        const md = markdown(d);
        expect(md).toContain('shrank');
        expect(md).toMatch(/−87\.9 KB/);
    });

    it('renders an unchanged payload in the form the CI step greps for', () => {
        const d: Delta = {
            base: side(8_500_000, 2775, 'origin/main'),
            head: side(8_500_000, 2775, 'HEAD'),
            packedDeltaBytes: 0,
            entryDelta: 0,
            capMb: 9.1,
            headroomBytes: 600_000,
        };
        // AC-4: absent on a PR that adds no payload. The workflow decides that by
        // grepping this exact string, so the two must not drift apart.
        expect(markdown(d)).toContain('unchanged: +0.0 KB');
    });

    it('the CI step greps for the same string the renderer emits', () => {
        const wf = fs.readFileSync(path.join('.github', 'workflows', 'consistency.yml'), 'utf8');
        expect(wf).toContain("grep -q 'unchanged: +0.0 KB'");
        // A reporter that can red the build is a second cap with no derivation.
        expect(wf).toContain('continue-on-error: true');
    });
});

describe('the harness records its own limits', () => {
    const evidence = fs.readFileSync(
        path.join('agents', 'evidence', 'analysis', 'npm-payload-subtree-verdicts.md'),
        'utf8',
    );

    it('scopes GREEN to the probe matrix rather than claiming safety', () => {
        expect(evidence).toContain('never "semantically\nequivalent"');
    });

    it('records the two verdicts that flipped when the probe set widened', () => {
        expect(evidence).toContain('first read GREEN');
        expect(evidence).toContain('mcp:setup');
    });

    it('names the source-map trade-off rather than presenting it as free', () => {
        expect(evidence).toContain('Accepted trade-off');
        expect(evidence).toContain('stack traces show compiled names');
    });

    it('quantifies the duplication and says why exclusion does not follow', () => {
        expect(evidence).toContain('94.2 %');
        expect(evidence).toContain('2,144,870');
        expect(evidence).toContain('source-of-truth.md');
    });
});
