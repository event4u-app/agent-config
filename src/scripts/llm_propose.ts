#!/usr/bin/env tsx
/**
 * `llm_propose` — the metered arm's entry point, dry by default.
 *
 * `road-to-governed-evidence-production` step 2.1's executable surface. The
 * deterministic twin is `evolution_lab propose`; this writes records with the
 * SAME serialiser and the SAME filename function, so its `--out DIR` is drop-in
 * comparable with that verb's.
 *
 * ## Why a separate CLI and not a verb on `evolution_lab`
 *
 * `verbPropose` (`src/scripts/evolution_lab.ts:645`) is synchronous, and so is
 * `main`'s whole dispatch. A metered arm is asynchronous by nature, so adding it
 * as a verb means making a shared entry point async — a refactor of every verb
 * to ship one. A separate file leaves the deterministic path byte-identical,
 * which also keeps it a clean control arm.
 *
 * ## Dry by default, and the default is the point
 *
 * With no `--confirm` this sends nothing: it prints the ladder plan, the pinned
 * model per tier, the exact request body that WOULD go out for the first
 * observation, and a cost estimate. `--confirm` is the only path that spends.
 * The shape mirrors `src/scripts/rdp_gate_classify.ts`, which is this
 * repository's own precedent for a metered script.
 *
 * **No live call has been made through this file.** The commit that adds it
 * exercised the dry path only; the park's un-park procedure requires an
 * independent session to freeze the protocol before any capture, and freezing
 * plus capturing in one session is not a discharge.
 *
 * ## The guards it inherits rather than reimplements
 *
 * GUARD 0.5 (`assertWithinBudget`) and GUARD 0.4 (`discloseObservations`, the
 * holdout-disclosure abort) run here exactly as they do on the deterministic
 * verb, and against the same observations document. An arm that skipped them
 * would not be the same experiment.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    discloseObservations,
    loadRunBudget,
    parseObservationDocument,
} from './evolution_lab.js';
import {
    candidateRecordFilename,
    parseObservations,
    serialiseCandidateRecord,
    type DefectObservation,
} from './_lib/candidate_proposer.js';
import {
    SYSTEM_PROMPT,
    buildPrompt,
    plannedAttempts,
    proposeCandidatesWithModel,
} from './_lib/llm_candidate_proposer.js';
import {
    TIER_MODEL,
    anthropicGenerator,
    describeRequest,
    estimateTokens,
} from './_lib/llm_proposer_transport.js';
import { assertWithinBudget, type RunPlan } from './_lib/harness_evolution_guards.js';
import type { DisclosureRecord } from './_lib/harness_evolution_guards.js';

const _HERE = fileURLToPath(import.meta.url);
/**
 * Resolved here rather than imported from `evolution_lab.ts`, whose `REPO_ROOT`
 * is module-private. Exporting it would widen a shared module's surface to save
 * one line in this one.
 */
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_USAGE = 2;

const USAGE = `usage: llm_propose --observations FILE --out DIR [--confirm] [--force]

  --observations FILE   the same document evolution_lab propose consumes
  --out DIR             where candidate records are written
  --confirm             ACTUALLY SPEND. Without it nothing is sent.
  --force               overwrite an existing record with different bytes

Dry by default. The dry path prints the ladder plan, the pinned model per
tier, the exact request body for the first observation, and a cost estimate.
`;

interface Parsed {
    observations?: string;
    out?: string;
    confirm: boolean;
    force: boolean;
}

export function parseArgs(argv: readonly string[]): Parsed | string {
    const p: Parsed = { confirm: false, force: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--confirm') {
            p.confirm = true;
            continue;
        }
        if (a === '--force') {
            p.force = true;
            continue;
        }
        const v = argv[i + 1];
        if (v === undefined || v.startsWith('--')) return `${a} requires a value`;
        i += 1;
        if (a === '--observations') p.observations = v;
        else if (a === '--out') p.out = v;
        else return `unknown option '${a}'`;
    }
    return p;
}

/** Load, disclose and validate the observations. Same path as the deterministic verb. */
export function loadObservations(file: string, emit: (s: string) => void): DefectObservation[] {
    const doc = parseObservationDocument(JSON.parse(fs.readFileSync(file, 'utf-8')));
    const plan: RunPlan = {
        candidates: doc.observations.length,
        trialsPerCandidate: 1,
        estimatedSpendCents: 0,
    };
    assertWithinBudget(plan, loadRunBudget());
    const log: DisclosureRecord[] = [];
    return parseObservations(discloseObservations(doc, log, emit));
}

function dryRun(observations: readonly DefectObservation[], read: (s: string) => string): number {
    // The ladder plan, validated by the SAME `assertCheapestFirst` call the live
    // walk makes. A dry run is not a run, but this population is real: it is
    // derived from the real observations by the real ladder code.
    const attempts = plannedAttempts(observations);
    process.stdout.write(`llm_propose: DRY RUN — nothing sent, nothing spent.\n`);
    for (const [tier, model] of Object.entries(TIER_MODEL)) {
        process.stdout.write(
            `llm_propose: tier ${tier} -> ${model ?? 'UNPINNED (refused until a dated id is pinned)'}\n`,
        );
    }
    for (const a of attempts) {
        process.stdout.write(
            `llm_propose: planned attempt ${String(a.sequence)} · class=${a.defect_class} · tier=${a.tier}\n`,
        );
    }
    const first = observations[0];
    if (first !== undefined) {
        const req = describeRequest({
            tier: attempts[0]?.tier ?? 'lite',
            system: SYSTEM_PROMPT,
            prompt: buildPrompt(first, read(first.subject)),
        });
        process.stdout.write(`llm_propose: request body for ${first.subject}:\n`);
        process.stdout.write(`${JSON.stringify(req.body, null, 2)}\n`);
        const inTok = estimateTokens(`${String(req.body['system'])}${JSON.stringify(req.body['messages'])}`);
        // Tokens, and DELIBERATELY no dollar figure. `ai_council/pricing.ts`'s
        // `estimate_cost` needs a loaded price table from a runtime file that a
        // fresh checkout does not have, and a price invented here would read as
        // authoritative. The spend ceiling belongs to the protocol document,
        // which states it once for the whole run.
        process.stdout.write(
            `llm_propose: ~${String(inTok)} input tokens for this one call ` +
                `(ESTIMATE: characters over four, not a tokenizer; no price is computed here — ` +
                `the run budget is in docs/contracts/metered-proposer-protocol.md)\n`,
        );
    }
    process.stdout.write('llm_propose: re-run with --confirm to spend.\n');
    return EXIT_OK;
}

export async function main(argv?: string[]): Promise<number> {
    const args = argv ?? process.argv.slice(2);
    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        process.stdout.write(USAGE);
        return args.length === 0 ? EXIT_USAGE : EXIT_OK;
    }
    const parsed = parseArgs(args);
    if (typeof parsed === 'string') {
        process.stderr.write(`llm_propose: error: ${parsed}\n${USAGE}`);
        return EXIT_USAGE;
    }
    if (parsed.observations === undefined || parsed.out === undefined) {
        process.stderr.write(`llm_propose: error: --observations FILE and --out DIR are required\n${USAGE}`);
        return EXIT_USAGE;
    }

    const read = (subject: string): string =>
        fs.readFileSync(path.join(REPO_ROOT, subject), 'utf-8');

    let observations: DefectObservation[];
    try {
        observations = loadObservations(parsed.observations, (line) => process.stderr.write(`${line}\n`));
    } catch (e) {
        process.stderr.write(`llm_propose: observations rejected — ${(e as Error).message}\n`);
        return EXIT_ERROR;
    }

    if (!parsed.confirm) {
        try {
            return dryRun(observations, read);
        } catch (e) {
            process.stderr.write(`llm_propose: dry run refused — ${(e as Error).message}\n`);
            return EXIT_ERROR;
        }
    }

    let proposal;
    try {
        proposal = await proposeCandidatesWithModel(observations, read, anthropicGenerator());
    } catch (e) {
        process.stderr.write(`llm_propose: proposal failed — ${(e as Error).message}\n`);
        return EXIT_ERROR;
    }

    fs.mkdirSync(parsed.out, { recursive: true });
    for (const r of proposal.records) {
        const dest = path.join(parsed.out, candidateRecordFilename(r));
        const bytes = serialiseCandidateRecord(r);
        if (fs.existsSync(dest) && !parsed.force) {
            if (fs.readFileSync(dest, 'utf-8') === bytes) {
                process.stdout.write(`llm_propose: ${dest} already identical\n`);
                continue;
            }
            process.stderr.write(`llm_propose: ${dest} exists with different bytes — pass --force\n`);
            return EXIT_ERROR;
        }
        fs.writeFileSync(dest, bytes, 'utf-8');
        process.stdout.write(`llm_propose: wrote ${dest} (model ${proposal.models[r.id] ?? 'unknown'})\n`);
    }
    for (const a of proposal.attempts) {
        process.stdout.write(
            `llm_propose: attempt ${String(a.sequence)} · class=${a.defect_class} · tier=${a.tier}\n`,
        );
    }
    process.stdout.write(
        `llm_propose: ${String(proposal.records.length)} candidate(s) from ` +
            `${String(proposal.attempts.length)} metered attempt(s)\n`,
    );
    return EXIT_OK;
}

function _isCliEntry(): boolean {
    try {
        if (process.argv[1] === undefined) return false;
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    void main().then((code) => process.exit(code));
}
