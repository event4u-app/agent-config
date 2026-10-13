#!/usr/bin/env tsx
/**
 * Show what a consumer's `## No-gos` section would become as host deny rows —
 * and, only with `--apply`, append them.
 *
 * `road-to-a-project-contract-written-down` step 2.2. `/agents:init` runs this
 * WITHOUT `--apply` first, shows the rows, asks once, and runs it again with
 * `--apply` only on a yes.
 *
 * ```
 * WITHOUT --apply THIS WRITES NOTHING. THAT IS THE DEFAULT AND THE POINT.
 * A HOST WITH NO ESTABLISHED DENY LIST GETS A REPORT, NEVER A FILE.
 * ```
 *
 * Usage:
 *   ./scripts-run src/scripts/no_go_deny_rows [AGENTS.md] [--host claude]
 *                                             [--settings .claude/settings.json]
 *                                             [--apply]
 *
 * Exit codes: 0 — shown (or applied) · 1 — the file could not be read or the
 * settings body is malformed · 2 — usage error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

import { extractNoGosSection } from '../install/noGoRules.js';
import {
    appendDenyRules,
    planDenyRows,
    renderDenyPlan,
} from '../install/noGoDenyRows.js';

const USAGE =
    'usage: no_go_deny_rows [AGENTS.md] [--host <host>] [--settings <path>] [--apply]\n\n' +
    'Without --apply nothing is written.\n';

interface Args {
    readonly agentsMd: string;
    readonly host: string;
    readonly settings: string;
    readonly apply: boolean;
}

function parse(argv: readonly string[]): Args | number {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(USAGE);
        return 0;
    }
    let host = 'claude';
    let settings = '.claude/settings.json';
    let apply = false;
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--apply') {
            apply = true;
        } else if (a === '--host' || a === '--settings') {
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write(`no_go_deny_rows: ${a} needs a value\n`);
                return 2;
            }
            if (a === '--host') host = next;
            else settings = next;
            i += 1;
        } else if (a.startsWith('-')) {
            process.stderr.write(`no_go_deny_rows: unknown argument ${a}\n${USAGE}`);
            return 2;
        } else {
            positional.push(a);
        }
    }
    return { agentsMd: positional[0] ?? 'AGENTS.md', host, settings, apply };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parse(argv);
    if (typeof args === 'number') return args;

    const mdPath = path.resolve(args.agentsMd);
    if (!fs.existsSync(mdPath)) {
        process.stderr.write(`no_go_deny_rows: ${mdPath} not found\n`);
        return 1;
    }
    const section = extractNoGosSection(fs.readFileSync(mdPath, 'utf8'));
    const plan = planDenyRows(section, args.host);
    process.stdout.write(renderDenyPlan(plan, args.host));

    if (!args.apply) {
        if (plan.rules.length > 0 && plan.enforceable) {
            process.stdout.write(
                '\nNothing was written. Re-run with --apply to append these rows.\n',
            );
        }
        return 0;
    }
    if (!plan.enforceable) {
        process.stdout.write(
            `\n--apply ignored: no deny list is established for ${args.host}.\n`,
        );
        return 0;
    }
    if (plan.rules.length === 0) return 0;

    const target = path.resolve(args.settings);
    // `{\n}\n`, not `{}`. The splice inserts after the opening brace, so an
    // inline `{}` produced a file ending `    }}` — which every consumer
    // WITHOUT a settings file would have seen, the common case for a fresh
    // repository. The "never reformat a file the consumer owns" rationale does
    // not reach a file this command creates, so the created one is given a
    // shape the splice lands in cleanly.
    const before = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '{\n}\n';
    let result;
    try {
        result = appendDenyRules(before, plan.rules);
    } catch (err) {
        process.stderr.write(
            `no_go_deny_rows: ${target} — ${err instanceof Error ? err.message : String(err)}\n`,
        );
        return 1;
    }
    if (result.added.length === 0) {
        process.stdout.write('\nEvery row was already present; the file is unchanged.\n');
        return 0;
    }

    // Verify BEFORE the file moves, not after. The settings file is the
    // consumer's; a write that lands and then turns out to have dropped an
    // entry has already cost them the file. Both checks run on the candidate
    // text, and a failure writes nothing at all.
    let roundTrip: { permissions?: { deny?: unknown } };
    try {
        roundTrip = JSON.parse(result.text) as { permissions?: { deny?: unknown } };
    } catch {
        process.stderr.write('no_go_deny_rows: the result would not parse — nothing written\n');
        return 1;
    }
    const deny = roundTrip.permissions?.deny;
    const kept = Array.isArray(deny) ? deny.filter((e): e is string => typeof e === 'string') : [];
    const lost = priorDeny(before).filter((e) => !kept.includes(e));
    if (lost.length > 0) {
        process.stderr.write(
            `no_go_deny_rows: ${String(lost.length)} existing entr(ies) would be lost — nothing written\n`,
        );
        return 1;
    }
    // The STRONG form of the module's own claim: the result is the file that
    // was there, plus text at one point.
    //
    // It is NOT what catches a duplicated key, and an earlier version of this
    // comment said it was. A second `"permissions"` inserted after the root
    // brace IS the existing file plus one contiguous insertion, so this check
    // returns true on exactly that output — measured by a reviewer. What
    // refuses it is the consented-row check below, which reads the PARSED
    // result and finds the row missing because the later duplicate won.
    //
    // Both stay. This one covers a different class: a splice that deleted or
    // moved existing content, which a parse-level check cannot see.
    if (!isSingleInsertion(before, result.text)) {
        process.stderr.write(
            'no_go_deny_rows: the result is not the existing file plus one insertion — ' +
                'nothing written\n',
        );
        return 1;
    }
    // THIS is the duplicate-key net. It reads the parsed result, so a row that
    // a later duplicate key shadowed is simply absent, whatever the text looks
    // like.
    if (!plan.rules.every((r) => kept.includes(r))) {
        process.stderr.write(
            'no_go_deny_rows: a consented row is not in the result — nothing written\n',
        );
        return 1;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    // Write beside the target and rename, so an interrupted write leaves the
    // consumer's file as it was rather than half of it.
    const tmp = `${target}.agent-config.tmp`;
    fs.writeFileSync(tmp, result.text, 'utf8');
    fs.renameSync(tmp, target);
    process.stdout.write(
        `\n${String(result.added.length)} row(s) appended to ${args.settings}.\n`,
    );
    return 0;
}

/**
 * Is `after` exactly `before` with one contiguous run of text inserted?
 *
 * Longest common prefix plus longest common suffix must account for every byte
 * of `before`. Nothing is deleted, nothing is reordered, and nothing outside
 * the insertion point moved — which is the property the splice claims and the
 * property a deny-entry comparison cannot see.
 */
function isSingleInsertion(before: string, after: string): boolean {
    if (after.length < before.length) return false;
    let head = 0;
    while (head < before.length && before[head] === after[head]) head += 1;
    let tail = 0;
    while (
        tail < before.length - head &&
        before[before.length - 1 - tail] === after[after.length - 1 - tail]
    ) {
        tail += 1;
    }
    return head + tail === before.length;
}

/** The deny entries a settings body already carried, or `[]`. */
function priorDeny(body: string): readonly string[] {
    try {
        const parsed = JSON.parse(body) as { permissions?: { deny?: unknown } };
        const deny = parsed.permissions?.deny;
        return Array.isArray(deny) ? deny.filter((e): e is string => typeof e === 'string') : [];
    } catch {
        return [];
    }
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
