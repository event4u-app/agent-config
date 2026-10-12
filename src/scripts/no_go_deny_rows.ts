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
    const before = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '{}\n';
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
