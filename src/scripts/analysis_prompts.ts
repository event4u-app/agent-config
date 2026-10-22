// egress-content: session-content uncovered — prints prompts the user carries to sessions on other hosts; no network call here, the printed text carries no absolute local path and passes assertOutbound (_lib/outbound_text.ts) before it is printed
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

import { assertOutbound, OutboundRefusedError } from './_lib/outbound_text.js';
import type { Finding } from './analysis_emit.js';
import { EVIDENCE_TIERS } from './analysis_ledger.js';
import { RESEARCH_BRIEF } from './network_sources.js';
import { resolveAnalysisTarget, type AnalysisTarget } from './analysis_target.js';

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
            // The strongest evidence of any lane stands, and an owner or a block a
            // later lane knew about is not dropped — it decides where the finding lands.
            if (EVIDENCE_TIERS.indexOf(f.tier) < EVIDENCE_TIERS.indexOf(seen.finding.tier)) seen.finding.tier = f.tier;
            if (seen.finding.owner === undefined && f.owner !== undefined) seen.finding.owner = f.owner;
            if (seen.finding.blocked_until === undefined && f.blocked_until !== undefined) seen.finding.blocked_until = f.blocked_until;
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

/** The scope line for a prompt that leaves this host: the scope root relative to the project, never absolute. */
export function outboundScopeLine(target: AnalysisTarget): string {
    const rel = path.relative(target.project_root, target.scope_root).split(path.sep).join('/');
    return `Scope: ${target.scope_kind} ${target.scope_name} at ${rel === '' ? '.' : rel} (anchor: ${target.anchor})`;
}

/** Both prompts as printed; throws OutboundRefusedError when the text would carry a credential, a local path or a deny token. */
export function promptOutput(target: AnalysisTarget, pin: string, roundId: string): string {
    const p = emitPrompts({ scope: outboundScopeLine(target), pin, roundId });
    const out = `## Analyst prompt\n\n${p.analyst}\n\n## Exchange prompt\n\n${p.exchange}\n`;
    assertOutbound(out, 'analysis prompts');
    return out;
}

export function main(argv: string[] = process.argv.slice(2), cwd: string = process.cwd()): number {
    const pin = readFlag(argv, 'pin');
    const roundId = readFlag(argv, 'round');
    if (pin === null || roundId === null) {
        process.stderr.write('analysis_prompts: --pin <sha> and --round <round-id> are required\n');
        return 2;
    }
    const target = resolveAnalysisTarget({ cwd, project: null, scope: readFlag(argv, 'scope') });
    try {
        process.stdout.write(promptOutput(target, pin, roundId));
    } catch (err) {
        if (!(err instanceof OutboundRefusedError)) throw err;
        process.stderr.write(`analysis_prompts: ${err.message}\n`);
        return 1;
    }
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
