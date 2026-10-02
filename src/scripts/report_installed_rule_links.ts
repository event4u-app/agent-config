#!/usr/bin/env node
/**
 * Which links inside an installed rule file do NOT resolve, per host.
 *
 * A rule body is authored against the package tree, where every sibling
 * directory is present. The installer copies a subset
 * (`GLOBAL_DEPLOY_SOURCES`), and nothing joined the two, so a rule could ship
 * a link into a directory no consumer has.
 *
 * This reporter reads the real deploy plan and the real rule bodies, so its
 * numbers are the installer's rather than a restatement of it. It also prices
 * the two repairs step 1.2 of `road-to-rule-triggers-and-links-that-hold`
 * weighs against each other:
 *
 *   · **deploy** — add the directory to the host's plan. Nothing is written
 *     into a rule body, so the standing text a host loads as instructions does
 *     not move; the cost is files on disk.
 *   · **rewrite** — leave the plan alone and make each link an absolute
 *     package path. Every character lands INSIDE a rule body, which is exactly
 *     the text the host loads.
 *
 * The rewrite price depends on the installed package root's own length, which
 * is a property of the machine, so `--prefix-chars` is explicit and the report
 * states the value it used.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    type LinkAuditReport,
    auditInstalledRuleLinks,
    deployPlanFrom,
    rewriteOptionCost,
} from '../install/installedRuleLinks.js';
import { GLOBAL_DEPLOY_SOURCES } from './install.js';

// ledger-exempt: a REPORTER, not a gate. It has no verdict for a per-target
// ledger to account for; it prints what the deploy plan and the rule bodies
// already say.

const _HERE = fileURLToPath(import.meta.url);

/** Hosts whose plan carries a rules directory — the only ones with an answer. */
function ruleHosts(): [string, ReadonlyArray<readonly [string, string]>][] {
    return Object.entries(GLOBAL_DEPLOY_SOURCES).filter(([, pairs]) =>
        pairs.some(([source]) => source.endsWith('/rules')),
    );
}

export interface HostLinkReading {
    host: string;
    links: number;
    resolved: number;
    unresolved: number;
    rewrite_cost_chars: number;
    by_directory: LinkAuditReport['by_directory'];
}

export function readings(packageRoot: string, prefixChars: number): HostLinkReading[] {
    const out: HostLinkReading[] = [];
    for (const [host, pairs] of ruleHosts()) {
        const report = auditInstalledRuleLinks(deployPlanFrom(pairs), packageRoot);
        out.push({
            host,
            links: report.audits.length,
            resolved: report.counts.resolved,
            unresolved: report.audits.length - report.counts.resolved,
            rewrite_cost_chars: rewriteOptionCost(report, prefixChars),
            by_directory: report.by_directory,
        });
    }
    return out;
}

function flagValue(flag: string): string | null {
    const argv = process.argv.slice(2);
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
}

const USAGE =
    'usage: report_installed_rule_links [--root DIR] [--prefix-chars N] [--json]\n' +
    '  --root          package checkout the installer copies FROM (default: cwd)\n' +
    '  --prefix-chars  length of the installed package root, for the rewrite price\n' +
    '                  (default 48, a typical `~/.claude/agent-config` expansion)\n' +
    '  --json          machine-readable readings\n';

export function main(): number {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(USAGE);
        return 0;
    }
    for (const a of argv) {
        if (a.startsWith('-') && !['--root', '--prefix-chars', '--json'].includes(a)) {
            process.stderr.write(`unknown argument: ${a}\n${USAGE}`);
            return 2;
        }
    }

    const root = flagValue('--root') ?? process.cwd();
    const rawPrefix = flagValue('--prefix-chars');
    const prefixChars = rawPrefix === null ? 48 : Number.parseInt(rawPrefix, 10);
    if (!Number.isInteger(prefixChars) || prefixChars <= 0) {
        process.stderr.write(`--prefix-chars must be a positive integer\n`);
        return 2;
    }
    if (!fs.existsSync(path.join(root, 'dist', 'agent-src', 'rules'))) {
        process.stderr.write(`no dist/agent-src/rules under ${root} — nothing to read\n`);
        return 1;
    }

    const rows = readings(root, prefixChars);

    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ prefix_chars: prefixChars, hosts: rows }, null, 2)}\n`);
        return 0;
    }

    process.stdout.write(`installed rule links, per host (rewrite priced at ${String(prefixChars)} prefix chars)\n\n`);
    for (const r of rows) {
        process.stdout.write(
            `  ${r.host}: ${String(r.links)} link(s), ${String(r.resolved)} resolved, ${String(r.unresolved)} unresolved\n`,
        );
        if (r.unresolved > 0) {
            process.stdout.write(`      rewrite option: +${String(r.rewrite_cost_chars)} standing characters\n`);
            for (const d of r.by_directory) {
                process.stdout.write(`      ${String(d.count).padStart(4)}  ${d.directory}  (${d.verdict})\n`);
            }
        }
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
