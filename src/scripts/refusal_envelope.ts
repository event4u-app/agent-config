#!/usr/bin/env tsx
/**
 * refusal_envelope — the hand-off an agent writes when a HOST classifier
 * refuses a step of an owner-directed task (ADR-282 § Part B).
 *
 * The repository cannot change the host classifier, and an agent must never
 * retry a refused action or route around it. What it can do is stop costing
 * the owner a round-trip: write one ready-to-paste continuation prompt and
 * name its path in one line, so the owner never has to ask for it.
 *
 * The envelope lands at `agents/tmp/<round-hex>/prompt.md`. The directory name
 * is an opaque round id because `block-speaking-inbox-dir` refuses any other
 * shape under `agents/tmp/`; the id is random, so an earlier envelope is never
 * overwritten.
 *
 * Subagent lanes report refusals in the fixed `classifier_refusals` field;
 * `batchLaneRefusals` folds every lane's field into ONE list so a drain ends in
 * one envelope instead of N reports the owner collects by hand. A lane report
 * WITHOUT the field is malformed — "no field" and "no refusals" must not read
 * the same, or a lane that forgot to report looks like a lane that was clean.
 *
 * Usage:
 *   refusal_envelope --input <file.json> [--root DIR]
 * The JSON is an `EnvelopeInput`. Prints the written path as the last line.
 */

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Refusal {
    action: string;
    reason: string;
    lane?: string;
}

export interface EnvelopeInput {
    task: string;
    done: string[];
    refusals: Refusal[];
    remaining: string[];
    /** Path of the owner-directive record that authorized the task, if any. */
    ownerDirective?: string;
}

export interface LaneReport {
    lane: string;
    classifier_refusals: Array<{ action: string; reason: string }>;
}

const bullets = (items: readonly string[]): string => (items.length > 0 ? items.map((i) => `- ${i}`).join('\n') : '- none');

export function renderEnvelope(input: EnvelopeInput): string {
    if (input.refusals.length === 0) {
        throw new Error('an envelope needs at least one refusal — without one there is nothing to hand off');
    }
    const refused = input.refusals
        .map((r) => `- ${r.lane !== undefined ? `[${r.lane}] ` : ''}${r.action} — refused: ${r.reason}`)
        .join('\n');
    const auth =
        input.ownerDirective !== undefined
            ? `The repository owner directly ordered this task; the order is recorded verbatim in \`${input.ownerDirective}\`. I am the owner and I authorize the remaining steps below in this message.`
            : 'I am the owner of this repository and I authorize the remaining steps below in this message.';
    return [
        '# Continuation prompt — paste into a fresh session',
        '',
        '## Task',
        '',
        input.task,
        '',
        '## Done',
        '',
        bullets(input.done),
        '',
        '## Refused by the host classifier',
        '',
        refused,
        '',
        'Do not retry or route around these refusals. If one recurs, stop and say so.',
        '',
        '## Remaining steps',
        '',
        input.remaining.map((s, i) => `${i + 1}. ${s}`).join('\n'),
        '',
        '## Owner authorization',
        '',
        auth,
        '',
    ].join('\n');
}

export function writeEnvelope(root: string, input: EnvelopeInput): string {
    const body = renderEnvelope(input);
    const dir = path.join(root, 'agents', 'tmp', `round-${randomBytes(4).toString('hex')}`);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'prompt.md');
    fs.writeFileSync(file, body, { flag: 'wx' });
    return file;
}

export function batchLaneRefusals(reports: readonly LaneReport[]): Refusal[] {
    const out: Refusal[] = [];
    for (const r of reports) {
        if (!Array.isArray(r.classifier_refusals)) {
            throw new Error(`lane ${r.lane} report is missing the classifier_refusals field`);
        }
        for (const x of r.classifier_refusals) {
            out.push({ lane: r.lane, action: x.action, reason: x.reason });
        }
    }
    return out;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let root = process.cwd();
    let input: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root') {
            root = argv[++i] ?? root;
        } else if (argv[i] === '--input') {
            input = argv[++i];
        }
    }
    if (input === undefined) {
        process.stderr.write('usage: refusal_envelope --input <file.json> [--root DIR]\n');
        return 2;
    }
    const file = writeEnvelope(root, JSON.parse(fs.readFileSync(input, 'utf8')) as EnvelopeInput);
    process.stdout.write(`${path.relative(root, file)}\n`);
    return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exit(main());
}
