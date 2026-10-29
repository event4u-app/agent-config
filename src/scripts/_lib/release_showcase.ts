/**
 * The opt-in showcase step of `task release` (road-to-a-baseline-that-has-to-catch-up
 * step 5.2). Advisory by construction: nothing here can fail or stop a release.
 *
 * - `bench:showcase:replay` always runs. It is free — no host, no network.
 * - `bench:showcase:quick` is OFFERED once, with its budget shown, only on an
 *   interactive local run with no `--yes` and no `--ci`, and only when the
 *   owner has set a budget (`AGENT_CONFIG_SHOWCASE_MAX_USD`; spend is
 *   owner-reserved, Decision D5). Every other path records it as skipped, with
 *   the reason.
 * - The result is a section appended to the release PR body, marked advisory.
 * - A primary-grader regression (a quick verdict of `regression`, or a replay
 *   whose re-grade disagrees with its bundle) PROPOSES a release hold in the
 *   `## Release holds` grammar `release_holds.ts` evaluates. It is printed into
 *   the PR body, never written to a roadmap: committing it is the owner's act
 *   that opens the hold, so a stochastic verdict never blocks a cut by itself
 *   (kill K5).
 * - No data is `INDETERMINATE`, never green.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

import { evaluateHolds } from './release_holds.js';
import { inCi, TIERS } from './showcase_plan.js';
import { parseSweepJsonl, summarizeSweep, type ShowcaseVerdict, type SweepSummary } from './showcase_parity_stats.js';
import { replayBundles, type ReplayReport } from './showcase_replay.js';

export const BUDGET_ENV = 'AGENT_CONFIG_SHOWCASE_MAX_USD';
export const HOLD_ID = 'showcase-primary-grader-regression';

export interface ReleaseShowcaseDeps {
    env: NodeJS.ProcessEnv;
    canPrompt(): boolean;
    /** One y/N question; null when the terminal vanished. */
    ask(question: string): boolean | null;
    replay(): ReplayReport;
    /** Run the quick tier with this budget; return the sweep JSONL text, or null when it produced none. */
    runQuick(max_usd: number): { code: number; jsonl: string | null };
    log(line: string): void;
}

export interface ReleaseShowcaseResult {
    quick: 'ran' | 'declined' | 'skipped';
    quick_reason: string;
    quick_summary: SweepSummary | null;
    replay: ReplayReport;
    verdict: ShowcaseVerdict;
    hold_proposed: boolean;
    pr_section: string;
}

/** A hold declaration in rule 28's grammar; `evaluateHolds` must parse it clean. */
export function proposedHold(why: string): string {
    return [
        '## Release holds',
        '',
        `### hold: ${HOLD_ID}`,
        '',
        '- **Channel:** all',
        `- **Opened by:** showcase-regression-found`,
        `- **Cleared by:** showcase-regression-explained`,
        '- **State:** open — a primary grader no agent-config check owns scored the package arm worse',
        `- **Why not a guard:** the verdict is stochastic; kill K5 forbids an automatic block, so a human opens this hold. ${why.replace(/\d+\.\d+\.\d+|\d{4}-\d{2}-\d{2}/g, '…')}`,
        '',
        `- [x] Showcase regression found <!-- opens-hold: ${HOLD_ID} -->`,
        `- [ ] Regression explained or fixed <!-- clears-hold: ${HOLD_ID} -->`,
        '      verify: `task bench:showcase:replay` reproduces every bundle and a fresh quick run is not a regression',
        '',
    ].join('\n');
}

function quickBudget(env: NodeJS.ProcessEnv): number | null {
    const raw = env[BUDGET_ENV];
    if (raw === undefined || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
}

export function releaseShowcaseStep(opts: { yes: boolean; ci: boolean }, deps: ReleaseShowcaseDeps): ReleaseShowcaseResult {
    const replay = deps.replay();
    deps.log(`showcase replay (0 USD): ${replay.verdict} — ${replay.regraded} run(s) re-graded, ${replay.mismatches} mismatch(es)`);

    const q = TIERS.quick;
    const shape = `${q.tasks === 'all' ? 'every' : q.tasks.length} task(s) × ${q.arms.length} arms × k=${q.seeds}`;
    let quick: ReleaseShowcaseResult['quick'] = 'skipped';
    let quick_reason: string;
    let quick_summary: SweepSummary | null = null;
    const budget = quickBudget(deps.env);
    if (opts.ci || inCi(deps.env)) quick_reason = 'CI run — the paid quick tier is never offered there';
    else if (opts.yes) quick_reason = '--yes — no prompt is shown, so the quick tier was not offered';
    else if (!deps.canPrompt()) quick_reason = 'no terminal — the quick tier is only offered interactively';
    else if (budget === null) quick_reason = `no budget set — export ${BUDGET_ENV}=<usd> to be offered the quick tier`;
    else {
        const answer = deps.ask(`Run bench:showcase:quick (${shape}) with a budget of $${budget}? Advisory only, never blocks the release.`);
        if (answer !== true) {
            quick = 'declined';
            quick_reason = answer === null ? 'terminal unavailable at the prompt' : 'declined at the prompt';
        } else {
            quick = 'ran';
            const r = deps.runQuick(budget);
            const parsed = r.jsonl === null ? null : parseSweepJsonl(r.jsonl);
            quick_summary = parsed === null ? null : summarizeSweep(parsed.lines);
            quick_reason = `budget $${budget}, harness exit ${r.code}${parsed && parsed.problems.length > 0 ? `, ${parsed.problems.length} unreadable line(s)` : ''}`;
        }
    }
    deps.log(`showcase quick: ${quick} — ${quick_reason}`);

    const quickVerdict: ShowcaseVerdict = quick_summary?.verdict ?? 'INDETERMINATE';
    const regression = quickVerdict === 'regression' || replay.verdict === 'mismatch';
    const verdict: ShowcaseVerdict = regression ? 'regression' : quickVerdict;
    const why =
        quickVerdict === 'regression'
            ? `Quick run: ${quick_summary?.reason ?? ''}.`
            : replay.verdict === 'mismatch'
              ? `Replay: ${replay.mismatches} re-grade(s) disagree with their bundle.`
              : '';
    const hold = regression ? proposedHold(why) : null;
    if (hold !== null) {
        const parsed = evaluateHolds(hold, 'proposed-hold');
        if (parsed.length !== 1 || parsed[0]?.malformed.length !== 0) throw new Error(`proposed hold does not parse: ${JSON.stringify(parsed)}`);
        deps.log(`showcase: regression on a primary grader — a release hold is PROPOSED in the PR body; the release is not blocked`);
    }

    const L: string[] = [];
    L.push('');
    L.push('## Showcase (advisory — never blocks this release)');
    L.push('');
    L.push(`- Verdict: \`${verdict}\`${verdict === 'INDETERMINATE' ? ' — no data, which is not a pass' : ''}`);
    L.push(`- Replay (0 USD): \`${replay.verdict}\` — ${replay.regraded} run(s) re-graded, ${replay.mismatches} mismatch(es), ${replay.bundles.length} bundle(s)`);
    L.push(`- Quick tier (${shape}): ${quick} — ${quick_reason}`);
    for (const t of quick_summary?.tasks ?? []) {
        const arms = Object.entries(t.arms)
            .map(([a, p]) => `${a} reached ${p.reached}, censored ${p.censored}, tokens to target ${p.tokens_to_target_total ?? 'unknown'}`)
            .join('; ');
        L.push(`  - \`${t.task}\`: \`${t.verdict}\` — ${arms}`);
    }
    if (hold !== null) {
        L.push('');
        L.push('A primary grader regressed. The hold below is **proposed, not opened**: committing it to a roadmap opens it; until then this release is not blocked.');
        L.push('');
        L.push('~~~markdown');
        L.push(hold.trimEnd());
        L.push('~~~');
    }
    L.push('');
    return { quick, quick_reason, quick_summary, replay, verdict, hold_proposed: hold !== null, pr_section: L.join('\n') };
}

/** The real dependencies, for `release.ts`. Never throws: a broken step degrades to INDETERMINATE. */
export function runReleaseShowcase(opts: {
    yes: boolean;
    ci: boolean;
    root: string;
    canPrompt: () => boolean;
    ask: (q: string) => boolean | null;
}): ReleaseShowcaseResult | { pr_section: string } {
    const reports = path.join(opts.root, 'internal', 'bench', 'reports', 'ab-v2');
    const deps: ReleaseShowcaseDeps = {
        env: process.env,
        canPrompt: opts.canPrompt,
        ask: opts.ask,
        log: (l) => process.stdout.write(`${l}\n`),
        replay: () =>
            replayBundles({
                bundles: path.join(opts.root, 'internal', 'bench', 'showcase'),
                corpus: path.join(opts.root, 'internal', 'bench', 'corpora', 'ab-artifact-v2.yaml'),
                allowFixture: false,
            }),
        runQuick: (max_usd) => {
            const before = new Set(fs.existsSync(reports) ? fs.readdirSync(reports) : []);
            const r = spawnSync(path.join(opts.root, 'scripts-run'), ['src/scripts/showcase_run', '--tier', 'quick', '--max-usd', String(max_usd)], {
                cwd: opts.root,
                stdio: 'inherit',
            });
            const fresh = (fs.existsSync(reports) ? fs.readdirSync(reports) : []).filter((f) => /^artifact-.*\.jsonl$/.test(f) && !before.has(f)).sort();
            const last = fresh[fresh.length - 1];
            return { code: r.status ?? 2, jsonl: last === undefined ? null : fs.readFileSync(path.join(reports, last), 'utf-8') };
        },
    };
    try {
        return releaseShowcaseStep({ yes: opts.yes, ci: opts.ci }, deps);
    } catch (e) {
        process.stdout.write(`showcase step failed (${(e as Error).message}) — advisory, the release continues\n`);
        return { pr_section: `\n## Showcase (advisory — never blocks this release)\n\n- Verdict: \`INDETERMINATE\` — the step failed: ${(e as Error).message}\n` };
    }
}
