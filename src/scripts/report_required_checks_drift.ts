#!/usr/bin/env tsx
/**
 * Required-check drift report — compares the live ruleset to the contract.
 *
 * `print_required_checks.ts` carries the list of status contexts the `main
 * protection` ruleset requires, and it is contractually offline: it never calls
 * `gh`. So nothing compared that list to the ruleset, and it drifted — it named
 * one required context for a month after the ruleset gained a second. This
 * report is the comparison: it reads the ruleset through `gh api`, extracts the
 * required status contexts, and exits non-zero when they differ from
 * `ENFORCED_CHECKS`.
 *
 * READ-ONLY. It writes nothing and changes nothing on the ruleset. It is run by
 * hand or on a schedule and is NOT wired as a required check — a network read
 * cannot sit on the path of every pull request, and the token it needs is a
 * repository-read token, not something each PR should depend on.
 *
 * Usage:
 *   ./scripts-run src/scripts/report_required_checks_drift
 *   ./scripts-run src/scripts/report_required_checks_drift --repo <owner/name>
 *   ./scripts-run src/scripts/report_required_checks_drift --from-json <file>
 *
 * `--from-json` reads a ruleset object (the shape `gh api
 * repos/{owner}/{repo}/rulesets/{id}` returns) from a file instead of the
 * network, so the comparison itself is testable offline.
 *
 * Exit codes: 0 the lists agree · 1 they differ · 2 usage error, or the ruleset
 * could not be read or carries no required-status-checks rule.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ENFORCED_CHECKS } from './print_required_checks.js';

const _HERE = fileURLToPath(import.meta.url);

export const RULESET_NAME = 'main protection';
const DEFAULT_REPO = 'event4u-app/agent-config';

export interface Drift {
    readonly missingFromContract: readonly string[];
    readonly missingFromRuleset: readonly string[];
}

class ReadError extends Error {}

/** The required status contexts of one ruleset object, sorted. */
export function requiredContexts(ruleset: unknown): string[] {
    const rules = (ruleset as { rules?: unknown }).rules;
    if (!Array.isArray(rules)) {
        throw new ReadError('the ruleset object carries no `rules` array');
    }
    const lists = rules
        .filter(
            (r): r is { parameters?: { required_status_checks?: unknown } } =>
                typeof r === 'object' && r !== null && (r as { type?: unknown }).type === 'required_status_checks',
        )
        .map((r) => r.parameters?.required_status_checks)
        .filter((c): c is unknown[] => Array.isArray(c));
    if (lists.length === 0) {
        throw new ReadError('the ruleset has no `required_status_checks` rule');
    }
    // Every such rule counts: a context required by any of them blocks the merge.
    const contexts = new Set(
        lists
            .flat()
            .map((c) => (c as { context?: unknown }).context)
            .filter((c): c is string => typeof c === 'string'),
    );
    return [...contexts].sort();
}

/** Set difference in both directions; empty both ways means agreement. */
export function compare(live: readonly string[], contract: readonly string[]): Drift {
    const liveSet = new Set(live);
    const contractSet = new Set(contract);
    return {
        missingFromContract: live.filter((c) => !contractSet.has(c)).sort(),
        missingFromRuleset: contract.filter((c) => !liveSet.has(c)).sort(),
    };
}

function ghJson(endpoint: string, paginate = false): unknown {
    const args = paginate ? ['api', '--paginate', '--slurp', endpoint] : ['api', endpoint];
    const r = spawnSync('gh', args, { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 });
    if (r.status !== 0) {
        throw new ReadError(`gh api ${endpoint} failed: ${(r.stderr ?? '').trim() || `exit ${String(r.status)}`}`);
    }
    return JSON.parse(r.stdout) as unknown;
}

function readLiveRuleset(repo: string): unknown {
    // --paginate --slurp: one array per page, so a ruleset past the first page
    // of 30 is still found.
    const pages = ghJson(`repos/${repo}/rulesets`, true);
    if (!Array.isArray(pages) || !pages.every((p) => Array.isArray(p))) {
        throw new ReadError('the rulesets listing is not an array of pages');
    }
    const list = (pages as unknown[][]).flat();
    const hit = list.find((r) => (r as { name?: unknown }).name === RULESET_NAME) as { id?: unknown } | undefined;
    if (hit === undefined || typeof hit.id !== 'number') {
        throw new ReadError(`no ruleset named "${RULESET_NAME}" on ${repo}`);
    }
    return ghJson(`repos/${repo}/rulesets/${String(hit.id)}`);
}

interface Options {
    repo: string;
    fromJson: string | null;
}

function parseArgs(argv: readonly string[]): Options | string {
    let repo = DEFAULT_REPO;
    let fromJson: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--repo' || a === '--from-json') {
            const v = argv[i + 1];
            if (v === undefined || v.startsWith('--')) {
                return `${a} needs a value`;
            }
            if (a === '--repo') {
                repo = v;
            } else {
                fromJson = v;
            }
            i++;
        } else {
            return `unknown argument: ${a}`;
        }
    }
    return { repo, fromJson };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const opts = parseArgs(argv);
    if (typeof opts === 'string') {
        process.stderr.write(`❌  report_required_checks_drift: ${opts}\n`);
        process.stderr.write('usage: report_required_checks_drift [--repo OWNER/NAME] [--from-json FILE]\n');
        return 2;
    }
    let live: string[];
    try {
        const ruleset =
            opts.fromJson === null
                ? readLiveRuleset(opts.repo)
                : (JSON.parse(fs.readFileSync(opts.fromJson, 'utf-8')) as unknown);
        live = requiredContexts(ruleset);
    } catch (e) {
        process.stderr.write(`❌  report_required_checks_drift: ${e instanceof Error ? e.message : String(e)}\n`);
        return 2;
    }
    const drift = compare(live, ENFORCED_CHECKS);
    const source = opts.fromJson === null ? `${opts.repo} ruleset "${RULESET_NAME}"` : opts.fromJson;
    process.stdout.write(`required contexts read from ${source}: ${String(live.length)}\n`);
    for (const c of live) {
        process.stdout.write(`  - ${c}\n`);
    }
    if (drift.missingFromContract.length === 0 && drift.missingFromRuleset.length === 0) {
        process.stdout.write(
            '✅  agrees with ENFORCED_CHECKS in src/scripts/print_required_checks.ts\n',
        );
        return 0;
    }
    for (const c of drift.missingFromContract) {
        process.stdout.write(`  ❌ required by the ruleset, absent from the contract: ${c}\n`);
    }
    for (const c of drift.missingFromRuleset) {
        process.stdout.write(`  ❌ named by the contract, not required by the ruleset: ${c}\n`);
    }
    process.stdout.write(
        '❌  drift — update ENFORCED_CHECKS and docs/contracts/branch-protection-policy.md ' +
            'together, with the date the ruleset was read.\n',
    );
    return 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    if (pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
        return true;
    }
    try {
        return fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(_HERE);
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
