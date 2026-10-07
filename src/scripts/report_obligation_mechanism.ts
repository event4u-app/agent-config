#!/usr/bin/env node
/**
 * Per rule: is the obligation already carried by a mechanism, and is there a
 * slot that could carry it?
 *
 * Step 1.5 of `road-to-rule-triggers-and-links-that-hold`. It joins three
 * instruments that already exist and had never been read together:
 *
 *   · `check_enforcement_coverage --json` — the only place `enforced_by` and
 *     `obligation_frequency` are already resolved per rule, including what the
 *     declaration resolves TO (a wired validator, a bound hook, nothing).
 *   · `report_obligation_carriers` — how many artifacts restate the same
 *     obligation, which is a different question from whether one enforces it.
 *   · `src/config/rule-obligations.json` — the stable obligation ids per rule
 *     (road-to-enforcement-per-obligation). It replaced the hand-kept
 *     `# obligation: line N` frontmatter marker this report was the only
 *     reader of, and whose line numbers had drifted out of the law section on
 *     half the rules that carried one.
 *
 * **Two columns, and conflating them would be the error worth avoiding.**
 * `carried` is measured: a gate either refuses or it does not.
 * `slot_exists` is NECESSARY, NEVER SUFFICIENT — it says a host event fires at
 * the obligation's own frequency, so a carrier could at least be bound. It
 * does not say the obligation is decidable from what that event sees, which is
 * the actual question and is not answerable by a join. A rule whose body says
 * `instruction-only` has usually already answered it in the other direction,
 * and that answer is reproduced rather than overridden.
 *
 * Report only. Moving an obligation out of prose is a per-rule change with its
 * own review, which this roadmap's scope section says in as many words.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadRuleObligations, RULE_OBLIGATIONS_PATH } from './_lib/rule_obligations.js';

// ledger-exempt: a REPORTER, not a gate. Its only non-zero exit says an input
// instrument could not be run, which is a statement about the walk.

const _HERE = fileURLToPath(import.meta.url);

/** Frequencies a host event is known to fire at — the `slot_exists` test. */
const EVENT_BOUND_FREQUENCIES: ReadonlySet<string> = new Set([
    'per-edit',
    'per-file-write',
    'per-commit',
    'per-turn',
    'per-session',
    'per-event',
    'per-task',
]);

/** Resolutions where something can actually refuse. */
const REFUSING: ReadonlySet<string> = new Set(['validator', 'validator-local', 'test', 'hook']);

export interface MechanismRow {
    rule: string;
    tier: string;
    /** Obligation ids this rule declares, `null` when it declares none (the kernel). */
    obligations: number | null;
    frequency: string;
    declared: number;
    effective: string;
    /** `gate` · `observer` · `declared-gap` · `undeclared`. */
    carried: string;
    /** A host event is known to fire at this frequency. Necessary, not sufficient. */
    slot_exists: boolean;
    /** Artifacts restating this rule's obligations, per the carrier census. */
    restatements: number;
}

function run(root: string, script: string, args: readonly string[]): string {
    return execFileSync(path.join(root, 'scripts-run'), [script, ...args], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
    });
}

interface CoverageRule {
    id: string;
    tier?: string;
    declared?: string[];
    effective?: string;
    obligation_frequency?: string | null;
}

export function rows(root: string): MechanismRow[] {
    const coverage = JSON.parse(run(root, 'src/scripts/check_enforcement_coverage', ['--json'])) as {
        rules: CoverageRule[];
    };

    run(root, 'src/scripts/report_obligation_carriers', ['--top', '1']);
    const carriersPath = path.join(root, 'agents', 'runtime', 'reports', 'obligation-carriers.json');
    const restatements = new Map<string, number>();
    if (!fs.existsSync(carriersPath)) {
        // Not a degradation to absorb: `agents/runtime/` is gitignored, so a
        // fresh checkout reaches this, and a silent fallback would publish a
        // uniformly-zero Restatements column with nothing saying it is empty.
        // Every other input failure in this script exits 1; so does this one.
        throw new Error(
            `report_obligation_carriers wrote no census at ${carriersPath} — the ` +
                'Restatements column would read 0 for every rule without saying so',
        );
    }
    {
        const census = JSON.parse(fs.readFileSync(carriersPath, 'utf8')) as {
            rows: { carriers: { path: string; cls: string }[] }[];
        };
        for (const r of census.rows) {
            // A row is one obligation; it counts for every RULE that carries it.
            for (const c of r.carriers) {
                if (c.cls !== 'rule') continue;
                const id = path.basename(c.path, '.md');
                restatements.set(id, (restatements.get(id) ?? 0) + r.carriers.length - 1);
            }
        }
    }

    const inventory = fs.existsSync(path.join(root, RULE_OBLIGATIONS_PATH))
        ? loadRuleObligations(root).rules
        : {};
    const out: MechanismRow[] = [];
    for (const r of coverage.rules) {
        const declared = r.declared ?? [];
        const effective = r.effective ?? 'none';
        const frequency = r.obligation_frequency ?? '—';

        let carried: string;
        if (REFUSING.has(effective)) carried = 'gate';
        else if (effective === 'observer') carried = 'observer';
        else if (declared.length > 0) carried = 'declared-gap';
        else carried = 'undeclared';

        out.push({
            rule: r.id,
            tier: r.tier ?? '—',
            obligations: inventory[r.id]?.obligations.length ?? null,
            frequency,
            declared: declared.length,
            effective,
            carried,
            slot_exists: EVENT_BOUND_FREQUENCIES.has(frequency),
            restatements: restatements.get(r.id) ?? 0,
        });
    }
    out.sort((a, b) => a.rule.localeCompare(b.rule));
    return out;
}

export function renderTable(data: readonly MechanismRow[]): string[] {
    const L: string[] = [];
    L.push('| Rule | Tier | Obligations | Frequency | `enforced_by` | Resolves to | Carried | Slot exists | Restatements |');
    L.push('|---|---|---:|---|---:|---|---|---|---:|');
    for (const r of data) {
        L.push(
            `| \`${r.rule}\` | ${r.tier} | ${r.obligations === null ? '—' : String(r.obligations)} | ` +
                `${r.frequency} | ${String(r.declared)} | \`${r.effective}\` | ${r.carried} | ` +
                `${r.slot_exists ? 'yes' : 'no'} | ${String(r.restatements)} |`,
        );
    }
    return L;
}

const USAGE = 'usage: report_obligation_mechanism [--root DIR] [--json | --table]\n';

export function main(): number {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(USAGE);
        return 0;
    }
    for (const a of argv) {
        if (a.startsWith('-') && !['--root', '--json', '--table'].includes(a)) {
            process.stderr.write(`unknown argument: ${a}\n${USAGE}`);
            return 2;
        }
    }
    const i = argv.indexOf('--root');
    const root = i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : process.cwd();

    let data: MechanismRow[];
    try {
        data = rows(root);
    } catch (e) {
        process.stderr.write(`could not read an input instrument: ${String(e)}\n`);
        return 1;
    }

    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
        return 0;
    }
    if (argv.includes('--table')) {
        process.stdout.write(`${renderTable(data).join('\n')}\n`);
        return 0;
    }

    const by = (k: string): number => data.filter((r) => r.carried === k).length;
    const slotNoGate = data.filter((r) => r.carried !== 'gate' && r.slot_exists).length;
    process.stdout.write(
        `${String(data.length)} rule(s)\n` +
            `  carried by a gate that can refuse: ${String(by('gate'))}\n` +
            `  carried by an observer (fires, never refuses): ${String(by('observer'))}\n` +
            `  declared gap (the rule says instruction-only / none): ${String(by('declared-gap'))}\n` +
            `  no enforcement declaration at all: ${String(by('undeclared'))}\n` +
            `  not gated, but a host event fires at the obligation's frequency: ${String(slotNoGate)}\n` +
            `  declare no obligation ids: ${String(data.filter((r) => r.obligations === null).length)}\n`,
    );
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
