/**
 * Cost-of-parity metrics, replay, tier planning and the release step
 * (road-to-a-baseline-that-has-to-catch-up steps 4.3, 5.1 and 5.2). No host
 * runs: the release runner is a stub and replay re-grades committed files.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { evaluateHolds } from '../../src/scripts/_lib/release_holds.js';
import { BUDGET_ENV, HOLD_ID, releaseShowcaseStep, type ReleaseShowcaseDeps } from '../../src/scripts/_lib/release_showcase.js';
import { loadBundle } from '../../src/scripts/_lib/showcase_bundle.js';
import { aggregateParityArm, parityMetricRows, renderParity, summarizeSweep, type ParityRunLine } from '../../src/scripts/_lib/showcase_parity_stats.js';
import { planShowcase } from '../../src/scripts/_lib/showcase_plan.js';
import { replayBundles, type ReplayReport } from '../../src/scripts/_lib/showcase_replay.js';
import { main as replayMain } from '../../src/scripts/showcase_replay.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURE_ROOT = path.join(REPO, 'tests', 'fixtures', 'showcase');
const FIXTURE = path.join(FIXTURE_ROOT, '20261028T000000Z-art-svg-prompt-01');
const CORPUS = path.join(REPO, 'internal', 'bench', 'corpora', 'ab-artifact-v2.yaml');

const tmp: string[] = [];
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const copyFixture = (): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-replay-'));
    tmp.push(root);
    fs.cpSync(FIXTURE, path.join(root, path.basename(FIXTURE)), { recursive: true });
    return root;
};

const run = (over: Partial<ParityRunLine>): ParityRunLine => ({
    task: 'art-svg-prompt-01',
    arm: 'package',
    ladder: 'naive',
    parity_bar: 1,
    cap_k: 5,
    outcome: 'reached',
    prompts_to_parity: 1,
    first_shot_score: 1,
    tokens_total: 100,
    turns_total: 2,
    usd_total: 0.01,
    seed: 0,
    ...over,
});

describe('4.3 parity metrics', () => {
    it('folds runs: medians over reached runs, censored counted, total tokens over reached + censored', () => {
        const p = aggregateParityArm([
            run({ prompts_to_parity: 1, tokens_total: 100, turns_total: 2, usd_total: 0.01 }),
            run({ prompts_to_parity: 3, tokens_total: 400, turns_total: 6, usd_total: 0.04 }),
            run({ outcome: 'censored', prompts_to_parity: null, tokens_total: 900, turns_total: 12, usd_total: 0.09 }),
            run({ outcome: 'errored', prompts_to_parity: null, tokens_total: null }),
        ]);
        expect(p).toEqual({ reached: 2, censored: 1, prompts: 1, turns: 2, tokens: 100, usd_to_parity: 0.01, tokens_to_target_total: 1400 });
    });

    it('never imputes: total tokens to target is unknown when a counted run lacks telemetry', () => {
        expect(aggregateParityArm([run({}), run({ outcome: 'censored', tokens_total: null })]).tokens_to_target_total).toBeNull();
        expect(aggregateParityArm([run({ outcome: 'censored', prompts_to_parity: null })]).prompts).toBeNull();
    });

    it('renders every metric for the fixture bundle', () => {
        const { bundle } = loadBundle(FIXTURE);
        const s = bundle!.summary;
        const text = renderParity(s).join('\n');
        for (const h of ['Reached', 'Censored', 'Not reached by K', 'Prompts to parity', 'Turns to parity', 'Tokens to parity', 'USD to parity', 'Total tokens to target']) {
            expect(text).toContain(h);
        }
        expect(text).toContain('| Parity bar | With-agent-config first-shot median |');
        expect(text).toContain('| 1 | 1 |');
        expect(text).toContain('| with agent-config | 3 | 0 | 0 % | 1 | 4 | 11400 | 0.013 | 36800 |');
        expect(text).toContain('| without agent-config | 1 | 1 | 33.3 % | 3 | 6 | 2900 | 0.011 | 7300 |');
        expect(parityMetricRows(s).map((r) => r.share_not_reached)).toEqual([0, 1 / 3]);
    });

    it('decides a sweep verdict with the paired_verdict vocabulary, INDETERMINATE on no data', () => {
        expect(summarizeSweep([]).verdict).toBe('INDETERMINATE');
        const lines: ParityRunLine[] = [];
        for (let seed = 0; seed < 3; seed += 1) {
            for (const ladder of ['naive', 'informed']) {
                lines.push(run({ seed, ladder, arm: 'package', first_shot_score: 0, outcome: 'censored', prompts_to_parity: null }));
                lines.push(run({ seed, ladder, arm: 'vanilla', first_shot_score: 1 }));
            }
        }
        const s = summarizeSweep(lines);
        expect(s.verdict).toBe('regression');
        expect(s.tasks[0]?.arms['package']?.censored).toBe(6);
        expect(summarizeSweep(lines.slice(0, 4)).verdict).toBe('underpowered');
    });
});

describe('5.1 replay', () => {
    it('re-grades the fixture bundle at 0 USD and reproduces every kept SVG', () => {
        const r = replayBundles({ bundles: FIXTURE_ROOT, corpus: CORPUS, allowFixture: true });
        expect(r.problems).toEqual([]);
        expect(r).toMatchObject({ verdict: 'reproduced', regraded: 5, mismatches: 0 });
        expect(r.bundles[0]?.runs.find((x) => x.status === 'infra-error')).toMatchObject({ arm: 'vanilla', run: 3 });
        expect(replayMain(['--bundles', FIXTURE_ROOT, '--allow-fixture'])).toBe(0);
    });

    it('is red when a recorded score disagrees with the re-grade', () => {
        const root = copyFixture();
        const p = path.join(root, path.basename(FIXTURE), 'summary.json');
        const s = JSON.parse(fs.readFileSync(p, 'utf-8'));
        s.arms[1].runs[1].score = 0.5;
        s.arms[1].runs[1].passed = false;
        fs.writeFileSync(p, JSON.stringify(s));
        const r = replayBundles({ bundles: root, corpus: CORPUS, allowFixture: true });
        expect(r).toMatchObject({ verdict: 'mismatch', mismatches: 1 });
        expect(replayMain(['--bundles', root, '--allow-fixture'])).toBe(1);
    });

    it('refuses a fixture outside a fixture root, and says INDETERMINATE when there is nothing to re-grade', () => {
        expect(replayBundles({ bundles: FIXTURE_ROOT, corpus: CORPUS, allowFixture: false }).problems.join('\n')).toMatch(/fixture bundle in the evidence tree/);
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-empty-'));
        tmp.push(empty);
        expect(replayBundles({ bundles: empty, corpus: CORPUS, allowFixture: false }).verdict).toBe('INDETERMINATE');
    });
});

describe('5.1 tier planning', () => {
    const all = ['art-svg-prompt-01', 'art-landing-01', 'art-login-framework-01', 'art-form-01'];
    it('refuses a paid tier without --max-usd and in CI, and sizes the per-call cap under the budget', () => {
        expect(planShowcase({ tier: 'quick', max_usd: null, all_tasks: all, model: 'm', env: {} })).toMatchObject({ ok: false });
        expect(planShowcase({ tier: 'quick', max_usd: 50, all_tasks: all, model: 'm', env: { CI: 'true' } })).toMatchObject({ ok: false });
        const r = planShowcase({ tier: 'quick', max_usd: 50, all_tasks: all, model: 'm', env: {} });
        if (!r.ok) throw new Error(r.reason);
        expect(r.plan.tasks).toEqual(['art-svg-prompt-01', 'art-landing-01', 'art-login-framework-01']);
        expect(r.plan.calls * r.plan.call_budget_usd).toBeLessThanOrEqual(50);
        expect(r.plan.argv).toEqual(expect.arrayContaining(['--corpus', 'artifact', '--seeds', '3', '--max-usd', '50']));
        const dry = planShowcase({ tier: 'full', max_usd: null, all_tasks: all, model: 'm', env: { CI: '1' }, dry_run: true });
        expect(dry.ok && dry.plan.argv).toEqual(expect.arrayContaining(['--mode', 'dry-run']));
    });
});

describe('5.2 release step', () => {
    const replayOk: ReplayReport = { bundles: [], problems: [], regraded: 0, mismatches: 0, verdict: 'INDETERMINATE' };
    const regressionJsonl = (): string => {
        const out: string[] = [];
        for (let seed = 0; seed < 3; seed += 1) {
            for (const ladder of ['naive', 'informed']) {
                out.push(JSON.stringify(run({ seed, ladder, arm: 'package', first_shot_score: 0, outcome: 'censored', prompts_to_parity: null })));
                out.push(JSON.stringify(run({ seed, ladder, arm: 'vanilla', first_shot_score: 1 })));
            }
        }
        return out.join('\n');
    };
    const deps = (over: Partial<ReleaseShowcaseDeps> = {}): ReleaseShowcaseDeps & { asked: string[]; ran: number[]; replays: number } => {
        const d = {
            asked: [] as string[],
            ran: [] as number[],
            replays: 0,
            env: { [BUDGET_ENV]: '15' } as NodeJS.ProcessEnv,
            canPrompt: () => true,
            ask(q: string) {
                d.asked.push(q);
                return true;
            },
            replay() {
                d.replays += 1;
                return replayOk;
            },
            runQuick(usd: number) {
                d.ran.push(usd);
                return { code: 0, jsonl: regressionJsonl() };
            },
            log: () => undefined,
            ...over,
        };
        return d;
    };

    it('offers the quick tier once with the budget shown, runs it, and proposes a hold on a regression without blocking', () => {
        const d = deps();
        const r = releaseShowcaseStep({ yes: false, ci: false }, d);
        expect(d.asked).toHaveLength(1);
        expect(d.asked[0]).toContain('$15');
        expect(d.ran).toEqual([15]);
        expect(d.replays).toBe(1);
        expect(r).toMatchObject({ quick: 'ran', verdict: 'regression', hold_proposed: true });
        expect(r.pr_section).toContain('advisory — never blocks this release');
        expect(r.pr_section).toContain('proposed, not opened');
        const hold = /~~~markdown\n([\s\S]*?)~~~/.exec(r.pr_section)?.[1] as string;
        const parsed = evaluateHolds(hold, 'proposal');
        expect(parsed).toHaveLength(1);
        expect(parsed[0]).toMatchObject({ id: HOLD_ID, state: 'open', malformed: [] });
    });

    it('always replays, and never offers the quick tier in CI, with --yes, without a terminal or without a budget', () => {
        const cases: Array<[{ yes: boolean; ci: boolean }, Partial<ReleaseShowcaseDeps>, RegExp]> = [
            [{ yes: true, ci: true }, {}, /CI run/],
            [{ yes: false, ci: false }, { env: { CI: 'true', [BUDGET_ENV]: '15' } }, /CI run/],
            [{ yes: true, ci: false }, {}, /--yes/],
            [{ yes: false, ci: false }, { canPrompt: () => false }, /no terminal/],
            [{ yes: false, ci: false }, { env: {} }, /no budget set/],
        ];
        for (const [opts, over, reason] of cases) {
            const d = deps(over);
            const r = releaseShowcaseStep(opts, d);
            expect(d.asked).toEqual([]);
            expect(d.ran).toEqual([]);
            expect(d.replays).toBe(1);
            expect(r.quick).toBe('skipped');
            expect(r.quick_reason).toMatch(reason);
            expect(r.verdict).toBe('INDETERMINATE');
            expect(r.pr_section).toContain('no data, which is not a pass');
            expect(r.hold_proposed).toBe(false);
        }
    });

    it('a declined offer runs nothing; a replay mismatch alone proposes the hold', () => {
        const declined = deps({ ask: () => false });
        expect(releaseShowcaseStep({ yes: false, ci: false }, declined)).toMatchObject({ quick: 'declined', verdict: 'INDETERMINATE' });
        expect(declined.ran).toEqual([]);
        const mismatch = deps({ env: {}, replay: () => ({ ...replayOk, regraded: 2, mismatches: 1, verdict: 'mismatch' }) });
        expect(releaseShowcaseStep({ yes: true, ci: false }, mismatch)).toMatchObject({ verdict: 'regression', hold_proposed: true, quick: 'skipped' });
    });
});
