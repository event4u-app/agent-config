#!/usr/bin/env tsx
/**
 * `activation_receipt` — observe how far a shipped artefact climbed the
 * activation ladder, and append the receipt to the audit ledger.
 *
 * `road-to-governed-evidence-production` step 1.1's PRODUCTION CALLER. The
 * producer library (`_lib/activation_receipt_producer.ts`) holds the discipline;
 * this file holds the three real observations and the write. It exists because
 * a library nothing calls has no coverage — the same defect the roadmap kept
 * open on `assertCheapestFirst`. **Corrected 2026-09-01:** that one is now half
 * closed. `assertCheapestFirst` has two production callers in
 * `_lib/llm_candidate_proposer.ts` (`:417`, `:446`), so it no longer polices a
 * population of zero; what it still does not police is a SPENT population,
 * which is what AC-3 stays open on.
 *
 * ## What it observes, and from where
 *
 * | Rung | Source | What is read |
 * |---|---|---|
 * | `eligible`  | `source-tree`        | the authored artefact under `src/` |
 * | `selected`  | `discovery-manifest` | `dist/discovery/discovery-manifest.json`, `install.default` |
 * | `projected` | `host-projection`    | the host tree under `.claude/` |
 *
 * `delivered`, `visible` and `adhered` have no admitted source and are therefore
 * ABSENT from every receipt this writes — which the ladder reads as `unknown`
 * and keeps out of every rate's denominator. That is the honest state of
 * coverage today, not a placeholder to be filled with a guess.
 *
 * ## Costs and boundaries
 *
 * Zero model calls, no network, no subprocess: three `statSync` calls and one
 * JSON read. Admissible under the `metered-backend-park` blocker, which forbids
 * a live model harness rather than a filesystem read. Claims:
 * `docs/contracts/activation-receipt-trust-boundary.md`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
    appendActivationLine,
    buildActivationLine,
    buildActivationReceipt,
    observeProjection,
    observeSelection,
    observeSourceTree,
    type RungObservation,
} from './_lib/activation_receipt_producer.js';
import { LADDER_RUNGS, firstStall, type ActivationReceipt } from './_lib/activation_ladder.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const EXIT_OK = 0;
export const EXIT_USAGE = 2;

const USAGE = `usage: activation_receipt --rule <id> | --skill <id> [options]

  --rule ID         a rule artefact, e.g. commit-policy
  --skill ID        a skill artefact, e.g. code-review
  --host DIR        host projection root (default: .claude)
  --root DIR        repository root (default: this checkout)
  --dry-run         observe and print; do NOT append to the audit ledger

Observes the eligible / selected / projected rungs and appends one
audit-log-v1 line carrying an \`activation\` object. Zero model calls.
`;

/** Where the artefact lives, per kind, in each of the two trees. */
interface ArtefactPaths {
    readonly id: string;
    readonly sourceRel: string;
    readonly hostRel: string;
}

export function artefactPaths(kind: 'rule' | 'skill', id: string): ArtefactPaths {
    return kind === 'rule'
        ? { id, sourceRel: path.join('rules', `${id}.md`), hostRel: path.join('rules', `${id}.md`) }
        : {
              id,
              sourceRel: path.join('skills', id, 'SKILL.md'),
              hostRel: path.join('skills', id, 'SKILL.md'),
          };
}

/**
 * The ids the discovery manifest admits into the DEFAULT install.
 *
 * Returns an EMPTY set when the manifest is missing or unreadable, and
 * `observeSelection` reads an empty set as "no manifest" rather than as "the
 * manifest selected nothing" — the absent/negative split again, at the one place
 * a build artefact can legitimately be missing.
 */
export function selectedIdsFromManifest(manifestPath: string): Set<string> {
    let doc: unknown;
    try {
        doc = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
        return new Set();
    }
    const artefacts = (doc as { artefacts?: unknown }).artefacts;
    if (!Array.isArray(artefacts)) return new Set();
    const out = new Set<string>();
    for (const a of artefacts) {
        const rec = a as { path?: unknown; install?: { default?: unknown } };
        if (typeof rec.path !== 'string') continue;
        if (rec.install?.default !== true) continue;
        out.add(artefactIdFromPath(rec.path));
    }
    return out;
}

/**
 * The artefact id a manifest path names.
 *
 * `src/rules/commit-policy.md` -> `commit-policy`;
 * `src/skills/code-review/SKILL.md` -> `code-review`. Any other path yields its
 * basename without extension, which is not an id anything will match — a
 * deliberate non-match rather than a guess.
 */
export function artefactIdFromPath(p: string): string {
    const parts = p.split('/');
    const last = parts[parts.length - 1] ?? '';
    if (last === 'SKILL.md') return parts[parts.length - 2] ?? '';
    return last.replace(/\.md$/, '');
}

export interface ObserveResult {
    readonly receipt: ActivationReceipt | null;
    readonly errors: readonly string[];
    readonly observations: readonly RungObservation[];
}

/** The three observations, in ladder order. Pure apart from the reads. */
export function observeArtefact(
    root: string,
    hostRoot: string,
    kind: 'rule' | 'skill',
    id: string,
): ObserveResult {
    const p = artefactPaths(kind, id);
    const observations: RungObservation[] = [];
    const eligible = observeSourceTree(path.join(root, 'src'), p.sourceRel);
    if (eligible !== undefined) observations.push(eligible);
    const selected = observeSelection(
        selectedIdsFromManifest(path.join(root, 'dist', 'discovery', 'discovery-manifest.json')),
        id,
    );
    if (selected !== undefined) observations.push(selected);
    const projected = observeProjection(hostRoot, p.hostRel);
    if (projected !== undefined) observations.push(projected);

    const { receipt, errors } = buildActivationReceipt(id, observations);
    return { receipt, errors, observations };
}

interface Flags {
    kind?: 'rule' | 'skill';
    id?: string;
    host?: string;
    root?: string;
    dryRun: boolean;
}

function parse(argv: readonly string[]): Flags | string {
    const f: Flags = { dryRun: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--dry-run') {
            f.dryRun = true;
            continue;
        }
        const v = argv[i + 1];
        if (v === undefined || v.startsWith('--')) return `${a} requires a value`;
        i += 1;
        if (a === '--rule') {
            f.kind = 'rule';
            f.id = v;
        } else if (a === '--skill') {
            f.kind = 'skill';
            f.id = v;
        } else if (a === '--host') {
            f.host = v;
        } else if (a === '--root') {
            f.root = v;
        } else {
            return `unknown option '${a}'`;
        }
    }
    return f;
}

export function main(argv?: string[]): number {
    const args = argv ?? process.argv.slice(2);
    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        process.stdout.write(USAGE);
        return args.length === 0 ? EXIT_USAGE : EXIT_OK;
    }
    const parsed = parse(args);
    if (typeof parsed === 'string') {
        process.stderr.write(`activation_receipt: error: ${parsed}\n${USAGE}`);
        return EXIT_USAGE;
    }
    if (parsed.kind === undefined || parsed.id === undefined || parsed.id === '') {
        process.stderr.write(`activation_receipt: error: one of --rule or --skill is required\n${USAGE}`);
        return EXIT_USAGE;
    }
    const root = parsed.root ?? REPO_ROOT;
    const hostRoot = parsed.host ?? path.join(root, '.claude');

    const { receipt, errors } = observeArtefact(root, hostRoot, parsed.kind, parsed.id);
    if (receipt === null) {
        for (const e of errors) process.stderr.write(`activation_receipt: refused — ${e}\n`);
        return 1;
    }

    const stall = firstStall(receipt);
    const observedCount = Object.keys(receipt.rungs).length;
    process.stdout.write(
        `activation_receipt · ${receipt.artefact} · observed ${observedCount}/${LADDER_RUNGS.length} rung(s) · ` +
            (stall === null
                ? 'climbed every observed rung · family=none\n'
                : `stalled at ${stall.stage} · family=${stall.family}\n`),
    );

    const ts = new Date().toISOString();
    const { line, errors: lineErrors } = buildActivationLine({
        artefact: receipt.artefact,
        rungs: receipt.rungs,
        ts,
        id: crypto.randomUUID(),
    });
    if (line === null) {
        for (const e of lineErrors) process.stderr.write(`activation_receipt: refused — ${e}\n`);
        return 1;
    }
    if (parsed.dryRun) {
        process.stdout.write(`${JSON.stringify(line)}\n`);
        return EXIT_OK;
    }
    const file = appendActivationLine(root, line, ts);
    process.stdout.write(`activation_receipt · appended to ${path.relative(root, file)}\n`);
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
    process.exit(main());
}
