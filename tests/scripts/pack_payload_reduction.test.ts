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
 * exclusions the harness proved safe are actually in `files[]`, that the cap
 * moved DOWN, and that the delta reporter's contract holds.
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

describe('the cap ratcheted DOWN', () => {
    it('max is below the 9.2 it was raised to', () => {
        expect(budget().budgets.packed_size_mb.max).toBeLessThan(9.2);
    });

    it('headroom over last_measured is real but is not overstated as 8%', () => {
        const { max, last_measured: measured } = budget().budgets.packed_size_mb;
        const headroom = (max - measured) / measured;
        // Both council seats required the exact figure rather than a rounded 8%.
        expect(headroom).toBeGreaterThan(0.06);
        expect(headroom).toBeLessThan(0.08);
    });

    it('the note states the headroom exactly, not as ~8%', () => {
        const raw = fs.readFileSync(path.join('src', 'config', 'pack-size-budget.json'), 'utf8');
        expect(raw).toContain('7.4 %');
        expect(raw).toContain('HEADROOM IS 7.4 %, NOT 8 %');
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
