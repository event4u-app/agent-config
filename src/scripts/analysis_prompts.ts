/**
 * analysis_prompts.ts — two halves of step 4.4 (ADR-288): several sources fold
 * so one gap is one roadmap phase, and `--emit-prompts` prints the analyst and
 * exchange prompts for sessions outside this host, with the `handoff-v1` shape
 * embedded so what comes back parses (`analysis_analysts.ts#parseHandoff`).
 *
 * A gap is identified by the tree anchor it sits at: two sources pointing at
 * the same place in this project describe one gap, however they word it.
 *
 *   ./scripts-run src/scripts/analysis_prompts --pin <sha> --round <round-id> [--scope <path>]
 */
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Finding } from './analysis_emit.js';
import { RESEARCH_BRIEF } from './network_sources.js';
import { resolveAnalysisTarget, scopeLine } from './analysis_target.js';

export const LENS_QUESTIONS = {
    coverage: 'What is actually there? Read the code, not the README, and name everything your draft wrongly marks as missing.',
    adversary:
        'For every item you kept: is it already present, does it contradict a recorded decision, is it only different, what does it cost, what is its license? Record each test, including the ones that kill nothing.',
    'overbuild-sequencing': 'What is the smallest rung that delivers each item, which items are duplicates to fold, and in what order must they land?',
} as const;

export interface Lane {
    /** Coded source id (S1, S2, …) — never the source's name. */
    source: string;
    findings: Finding[];
}

/** Folds lanes so one tree anchor is one finding; steps are unioned in lane order, identical texts once. */
export function foldLanes(lanes: readonly Lane[]): Finding[] {
    const byAnchor = new Map<string, { finding: Finding; sources: string[] }>();
    for (const lane of lanes) {
        for (const f of lane.findings) {
            const seen = byAnchor.get(f.anchor);
            if (seen === undefined) {
                byAnchor.set(f.anchor, { finding: { ...f, steps: [...f.steps] }, sources: [lane.source] });
                continue;
            }
            if (!seen.sources.includes(lane.source)) seen.sources.push(lane.source);
            for (const step of f.steps) {
                if (!seen.finding.steps.some((s) => s.text === step.text)) seen.finding.steps.push(step);
            }
        }
    }
    return [...byAnchor.values()].map(({ finding, sources }) =>
        sources.length > 1 ? { ...finding, claim: `${finding.claim} Reported by ${sources.join(', ')}.` } : finding,
    );
}

function frontmatter(phase: 'seed' | 'exchange', loop: number, pin: string): string {
    return ['```yaml', '---', 'handoff: v1', `phase: ${phase}`, `loop: ${String(loop)}`, `pin: ${pin}`, 'consolidates: []', '---', '```'].join(
        '\n',
    );
}

const SECTIONS = 'Sections, in this order: Findings vs tree · Kills · Decisions · Steps with `verify:` · Loop log.';

export function emitPrompts(input: { scope: string; pin: string; roundId: string }): { analyst: string; exchange: string } {
    const drop = `agents/tmp/${input.roundId}/`;
    const shared = [
        `You analyse one project at commit \`${input.pin}\`. ${input.scope}.`,
        'Every claim carries an anchor (file:line, command and output, or URL) and a tier: executed, read, claimed or inferred. Only executed and read count as verified.',
        'Name no outside source in this file; if a source must be named, put it in a sibling `*.annex.md`.',
    ];
    const analyst = [
        ...shared,
        '',
        `Research: ${RESEARCH_BRIEF}`,
        '',
        'Write an analysis and a roadmap, then deepen both three times, one lens per loop:',
        '',
        `1. Coverage — ${LENS_QUESTIONS.coverage}`,
        `2. Adversary — ${LENS_QUESTIONS.adversary}`,
        `3. Overbuild and sequencing — ${LENS_QUESTIONS['overbuild-sequencing']}`,
        '',
        'A loop that changes no conclusion on executed or read evidence does not count; say so in the loop log.',
        `Return one Markdown file per loop for \`${drop}\`, starting with this frontmatter (raise \`loop\` per file):`,
        '',
        frontmatter('seed', 0, input.pin),
        '',
        SECTIONS,
    ].join('\n');
    const exchange = [
        ...shared,
        '',
        'You now receive the other analysts’ final analysis and roadmap, labelled A, B and C. Run three reconcile loops:',
        '',
        '1. inventory — check every foreign claim at the pin: still-true, never-true or unverifiable, with its tier.',
        '2. cross-exam — for each disputed claim, quote it verbatim and test it against the tree.',
        '3. converge — revise your own roadmap and keep a disagreement ledger. Facts are settled by the tree, never by majority; a minority finding is accepted or rejected with a reason, never dropped.',
        '',
        `Return the result for \`${drop}\` with this frontmatter:`,
        '',
        frontmatter('exchange', 1, input.pin),
        '',
        SECTIONS,
    ].join('\n');
    return { analyst, exchange };
}

function readFlag(argv: string[], name: string): string | null {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : (argv[i + 1] ?? null);
}

export function main(argv: string[] = process.argv.slice(2), cwd: string = process.cwd()): number {
    const pin = readFlag(argv, 'pin');
    const roundId = readFlag(argv, 'round');
    if (pin === null || roundId === null) {
        process.stderr.write('analysis_prompts: --pin <sha> and --round <round-id> are required\n');
        return 2;
    }
    const target = resolveAnalysisTarget({ cwd, project: null, scope: readFlag(argv, 'scope') });
    const p = emitPrompts({ scope: scopeLine(target), pin, roundId });
    process.stdout.write(`## Analyst prompt\n\n${p.analyst}\n\n## Exchange prompt\n\n${p.exchange}\n`);
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
