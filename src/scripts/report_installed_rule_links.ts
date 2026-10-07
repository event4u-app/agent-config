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
    auditInstalledKindLinks,
    auditInstalledRuleLinks,
    deployPlanFrom,
    rewriteOptionCost,
} from '../install/installedRuleLinks.js';
import { loadBaselines } from './_lib/gate_baseline.js';
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

/** Installed artefact kinds `--kinds` can select, in print order. */
export const LINK_KINDS = ['rules', 'skills', 'commands', 'contexts', 'guidelines'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export interface KindLinkReading {
    kind: LinkKind | 'non-projected';
    /** False when the host's plan does not deploy this kind at all. */
    installed: boolean;
    links: number;
    unresolved: number;
}

/**
 * One reading per selected kind for one host, plus a final `non-projected` row.
 *
 * A link into `docs/` (the ADRs live there) is dead in every install by
 * construction, so it is taken OUT of its kind's deployable count and summed
 * into its own row instead — mixing it in would make a kind's number move for a
 * reason no deploy change can address.
 */
export function kindReadings(
    packageRoot: string,
    pairs: ReadonlyArray<readonly [string, string]>,
    kinds: ReadonlyArray<LinkKind>,
): KindLinkReading[] {
    const plan = deployPlanFrom(pairs);
    const out: KindLinkReading[] = [];
    let npLinks = 0;
    let npUnresolved = 0;
    for (const kind of kinds) {
        const report = auditInstalledKindLinks(plan, packageRoot, `dist/agent-src/${kind}`);
        if (report === null) {
            out.push({ kind, installed: false, links: 0, unresolved: 0 });
            continue;
        }
        out.push({
            kind,
            installed: true,
            links: report.audits.length,
            unresolved: report.audits.length - report.counts.resolved,
        });
        npLinks += report.non_projected.length;
        npUnresolved += report.non_projected.filter((a) => a.verdict !== 'resolved').length;
    }
    out.push({ kind: 'non-projected', installed: true, links: npLinks, unresolved: npUnresolved });
    return out;
}

/** Key of a kind's recorded count in `src/config/gate-violation-baselines.json`. */
export function kindBaselineKey(host: string, kind: KindLinkReading['kind']): string {
    return `report_installed_rule_links:kinds:${host}:${kind}`;
}

/**
 * The recorded count for each row, or null where none is recorded.
 *
 * Read, never written: the baseline only moves by a reviewed commit, so a new
 * dead link shows as a live count above it rather than as a quietly raised
 * number. Nothing here fails on the comparison (D2 — report, never fail).
 */
export function recordedBaselines(packageRoot: string, host: string, rows: KindLinkReading[]): (number | null)[] {
    const { gates } = loadBaselines(packageRoot);
    return rows.map((r) => gates[kindBaselineKey(host, r.kind)]?.count ?? null);
}

/** `kind: <name> unresolved <n> of <m>` — the line form the roadmap fixed. */
export function formatKindLine(r: KindLinkReading, host: string, baseline: number | null = null): string {
    const name = r.kind === 'non-projected' ? 'non-projected (adr, docs/)' : r.kind;
    const tail = r.installed ? '' : ` (not installed for ${host})`;
    const base =
        baseline === null
            ? ''
            : ` [baseline ${String(baseline)}${r.unresolved > baseline ? `, ${String(r.unresolved - baseline)} above it` : ''}]`;
    return `kind: ${name} unresolved ${String(r.unresolved)} of ${String(r.links)}${tail}${base}`;
}

function parseKinds(raw: string): LinkKind[] | null {
    if (raw === 'all') return [...LINK_KINDS];
    const picked = raw.split(',').map((k) => k.trim());
    if (picked.length === 0 || picked.some((k) => !(LINK_KINDS as readonly string[]).includes(k))) return null;
    return LINK_KINDS.filter((k) => picked.includes(k));
}

function flagValue(flag: string): string | null {
    const argv = process.argv.slice(2);
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
}

const USAGE =
    'usage: report_installed_rule_links [--root DIR] [--prefix-chars N] [--json]\n' +
    '                                   [--kinds all|K[,K...]] [--host HOST]\n' +
    '  --root          package checkout the installer copies FROM (default: cwd)\n' +
    '  --prefix-chars  length of the installed package root, for the rewrite price\n' +
    '                  (default 48, a typical `~/.claude/agent-config` expansion)\n' +
    '  --kinds         one unresolved count per installed kind instead of the rule\n' +
    `                  reading: ${LINK_KINDS.join(', ')}, or all; docs/ and ADR\n` +
    '                  targets are printed as their own row. Reports, never fails.\n' +
    '  --host          host whose deploy plan --kinds reads (default claude-code)\n' +
    '  --json          machine-readable readings\n';

export function main(): number {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(USAGE);
        return 0;
    }
    for (const a of argv) {
        if (a.startsWith('-') && !['--root', '--prefix-chars', '--json', '--kinds', '--host'].includes(a)) {
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

    const rawKinds = flagValue('--kinds');
    if (rawKinds !== null || argv.includes('--kinds')) {
        const kinds = rawKinds === null ? null : parseKinds(rawKinds);
        if (kinds === null) {
            process.stderr.write(`--kinds takes all or a comma list of: ${LINK_KINDS.join(', ')}\n`);
            return 2;
        }
        const host = flagValue('--host') ?? 'claude-code';
        const pairs = GLOBAL_DEPLOY_SOURCES[host];
        if (pairs === undefined) {
            process.stderr.write(`unknown --host ${host}; known: ${Object.keys(GLOBAL_DEPLOY_SOURCES).join(', ')}\n`);
            return 2;
        }
        const kindRows = kindReadings(root, pairs, kinds);
        const baselines = recordedBaselines(root, host, kindRows);
        if (argv.includes('--json')) {
            const rows = kindRows.map((r, i) => ({ ...r, baseline: baselines[i] }));
            process.stdout.write(`${JSON.stringify({ host, kinds: rows }, null, 2)}\n`);
            return 0;
        }
        process.stdout.write(`installed links per kind, host ${host} (report only; counted since 2026-10-06)\n\n`);
        kindRows.forEach((r, i) => {
            process.stdout.write(`  ${formatKindLine(r, host, baselines[i] ?? null)}\n`);
        });
        return 0;
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
            // Priced over EVERY unresolved link, including the ones a rewrite
            // to an absolute package path cannot reach either (a target the
            // projection does not ship). Comparing it against a deploy option
            // that repairs only a subset overstates the rewrite; the caveat is
            // printed rather than left for the reader to rediscover.
            process.stdout.write(
                `      rewrite option: +${String(r.rewrite_cost_chars)} standing characters ` +
                    `(all ${String(r.unresolved)} unresolved; a like-for-like figure prices only ` +
                    `the subset the option being compared against repairs)\n`,
            );
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
