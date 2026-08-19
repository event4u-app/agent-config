/**
 * check_single_delivery — assert that no artefact is delivered from both layers.
 *
 * THE INVARIANT (ADR-235, one-artefact-one-layer): every rule and every skill is
 * delivered from exactly ONE layer. Claude Code loads `~/.claude/**` AND
 * `<project>/.claude/**`, both, user layer first, with no dedup — so an artefact
 * present in both is delivered twice, in every session, forever.
 *
 * WHY THIS EXISTS AS A SEPARATE CHECK, rather than inside a producer. Two
 * producers write these layers and neither can see the other:
 *
 *   - the INSTALLER writes the global layer, and `_gate_rule_layer_overlap`
 *     (install.ts) checks the overlap at install time — rules only, Claude only,
 *     and never again afterwards;
 *   - `task generate-tools` writes the project layer, and contains zero
 *     references to that gate or to `rule_layer_overlap`.
 *
 * So the overlap is created by whichever producer runs LAST, and an install-time
 * gate cannot see a layer written afterwards. This check is deliberately outside
 * both: it reads the filesystem and does not care who wrote it.
 *
 * WHAT IT COUNTS, and why the two halves are separate:
 *
 *   1. RAW OVERLAP — names present in both layers. The token cost.
 *   2. SCOPE DEFEAT — shared rules where one copy carries `paths:` and the other
 *      does not. `report_carrier_divergence` names the mechanism: a copy that
 *      LACKS `paths:` defeats the other copy's scoping, so the rule loads
 *      unconditionally however carefully the other copy was scoped. This is a
 *      correctness fact rather than a token fact, and it needs a different
 *      remedy, so it is never folded into the overlap number.
 *
 * REPORT BY DEFAULT, ENFORCE ON REQUEST — and that is not timidity. The
 * invariant is not true yet: `road-to-single-delivery` Phase 2, which makes the
 * producers write disjoint layers, is HALTED on blocker
 * `partition-requires-global-layer`. A blocking default would therefore red every
 * run on a defect nobody can currently fix, which teaches readers to ignore it —
 * the exact failure this estate has recorded twice already. Pass `--enforce` once
 * Phase 2 lands.
 *
 * A LAYER THAT DOES NOT EXIST IS NOT A PASS. Where a layer is absent there is no
 * overlap to find, and saying "invariant holds" would be a gate reading nothing
 * and reporting green. Absent layers are named, and `--enforce` refuses rather
 * than passing when BOTH layers of every type are missing.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Artefact types the host loads from both layers. */
const TYPES = ['rules', 'skills', 'commands', 'agents'] as const;
type ArtefactType = (typeof TYPES)[number];

export interface TypeReading {
    type: ArtefactType;
    /** null when that layer's directory does not exist — distinct from empty. */
    globalNames: string[] | null;
    projectNames: string[] | null;
    both: string[];
    globalOnly: string[];
    projectOnly: string[];
    /** Shared rules whose two copies disagree on `paths:`. Rules only. */
    scopeDefeat: string[];
}

function readNames(dir: string): string[] | null {
    try {
        if (!fs.statSync(dir).isDirectory()) return null;
    } catch {
        return null;
    }
    try {
        return fs.readdirSync(dir).sort();
    } catch {
        return null;
    }
}

/**
 * Does this rule file declare a `paths:` key in its frontmatter?
 *
 * Frontmatter only, deliberately: a `paths:` mentioned in prose is not a load
 * schedule, and matching it would manufacture scope-defeat findings out of
 * documentation.
 */
export function declaresPaths(file: string): boolean {
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch {
        return false;
    }
    if (!text.startsWith('---')) return false;
    const end = text.indexOf('\n---', 3);
    if (end < 0) return false;
    return /^paths:/m.test(text.slice(3, end));
}

export function readType(type: ArtefactType, globalRoot: string, projectRoot: string): TypeReading {
    const gDir = path.join(globalRoot, type);
    const pDir = path.join(projectRoot, type);
    const globalNames = readNames(gDir);
    const projectNames = readNames(pDir);
    const g = new Set(globalNames ?? []);
    const p = new Set(projectNames ?? []);

    const both = [...g].filter((n) => p.has(n)).sort();
    const globalOnly = [...g].filter((n) => !p.has(n)).sort();
    const projectOnly = [...p].filter((n) => !g.has(n)).sort();

    // Scope defeat is a rules-only property: `paths:` is the one frontmatter key
    // this host reads as a load schedule.
    const scopeDefeat =
        type === 'rules'
            ? both
                  .filter((n) => n.endsWith('.md'))
                  .filter(
                      (n) =>
                          declaresPaths(path.join(gDir, n)) !== declaresPaths(path.join(pDir, n)),
                  )
                  .sort()
            : [];

    return { type, globalNames, projectNames, both, globalOnly, projectOnly, scopeDefeat };
}

export interface Verdict {
    readings: TypeReading[];
    /** Total names delivered twice, across every type. */
    duplicated: number;
    /** Shared rules whose copies disagree on `paths:`. */
    defeated: number;
    /** Types where at least one layer's directory is missing. */
    absent: string[];
    /**
     * Types where BOTH layers were present, i.e. where a comparison actually
     * happened. Carried explicitly rather than derived as
     * `readings.length - absent.length`: `absent` counts LAYERS (up to two per
     * type) while readings counts TYPES, so that subtraction goes negative. It
     * printed `types_compared=-2` before this field existed.
     */
    typesCompared: number;
    /**
     * Entry names read across every present layer — the gate's dead-scope unit.
     *
     * Deliberately NOT `typesCompared`: a machine with only one layer is a normal
     * consumer state, and crashing the gate there would punish the topology this
     * roadmap is trying to reach. Zero names read, on the other hand, means every
     * directory the gate knows about is gone, which is blindness rather than
     * cleanliness — so it has no `allowEmpty` reason and `reportScanned` throws.
     */
    namesRead: number;
    /** True when no type had BOTH layers present — nothing was actually compared. */
    readNothing: boolean;
}

export function evaluate(globalRoot: string, projectRoot: string): Verdict {
    const readings = TYPES.map((t) => readType(t, globalRoot, projectRoot));
    const absent: string[] = [];
    let compared = 0;
    for (const r of readings) {
        if (r.globalNames === null) absent.push(`${r.type} (global)`);
        if (r.projectNames === null) absent.push(`${r.type} (project)`);
        if (r.globalNames !== null && r.projectNames !== null) compared += 1;
    }
    return {
        readings,
        duplicated: readings.reduce((n, r) => n + r.both.length, 0),
        defeated: readings.reduce((n, r) => n + r.scopeDefeat.length, 0),
        absent,
        typesCompared: compared,
        namesRead: readings.reduce(
            (n, r) => n + (r.globalNames?.length ?? 0) + (r.projectNames?.length ?? 0),
            0,
        ),
        readNothing: compared === 0,
    };
}

export function render(v: Verdict, globalRoot: string, projectRoot: string): string {
    const out: string[] = [];
    out.push('check_single_delivery · invariant: one artefact, one layer (ADR-235)');
    out.push(`  global:  ${globalRoot}`);
    out.push(`  project: ${projectRoot}`);
    out.push('');
    for (const r of v.readings) {
        const g = r.globalNames === null ? 'absent' : String(r.globalNames.length);
        const p = r.projectNames === null ? 'absent' : String(r.projectNames.length);
        out.push(
            `  ${r.type.padEnd(9)} global ${g.padStart(6)} · project ${p.padStart(6)}` +
                ` · BOTH ${String(r.both.length).padStart(4)}` +
                ` · global-only ${String(r.globalOnly.length).padStart(4)}` +
                ` · project-only ${String(r.projectOnly.length).padStart(4)}`,
        );
        if (r.scopeDefeat.length > 0) {
            out.push(
                `             scope defeat: ${r.scopeDefeat.length} shared rule(s) where one copy` +
                    ' carries `paths:` and the other does not —',
            );
            out.push(
                '             the unscoped copy DEFEATS the other copy\'s scoping, so the rule' +
                    ' loads unconditionally:',
            );
            for (const n of r.scopeDefeat) out.push(`               - ${n}`);
        }
    }
    if (v.absent.length > 0) {
        out.push('');
        out.push(`  layers not present (nothing to compare there): ${v.absent.join(', ')}`);
    }
    out.push('');
    out.push(
        `check_single_delivery ledger: duplicated=${v.duplicated} scope_defeat=${v.defeated}` +
            ` types_compared=${v.typesCompared} of ${v.readings.length}` +
            ` names_read=${v.namesRead}`,
    );
    return out.join('\n');
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let globalRoot = path.join(os.homedir(), '.claude');
    let projectRoot = path.join(REPO_ROOT, '.claude');
    let enforce = false;

    const value = (i: number): string | null => {
        const v = args[i + 1];
        return v === undefined || v.startsWith('-') ? null : v;
    };
    for (let i = 0; i < args.length; i += 1) {
        const a = args[i];
        if (a === '--global' || a === '--project') {
            const v = value(i);
            if (v === null) {
                process.stderr.write(`check_single_delivery: ${a} needs a directory\n`);
                return 1;
            }
            if (a === '--global') globalRoot = path.resolve(v);
            else projectRoot = path.resolve(v);
            i += 1;
        } else if (a === '--enforce') {
            enforce = true;
        } else if (a === '--help' || a === '-h') {
            process.stdout.write(
                'usage: check_single_delivery [--global DIR] [--project DIR] [--enforce]\n' +
                    '\n' +
                    'Reports by default and exits 0: the invariant is not true yet, because\n' +
                    'road-to-single-delivery Phase 2 is halted on partition-requires-global-layer.\n' +
                    '--enforce exits 1 on any overlap, and is what to register once Phase 2 lands.\n',
            );
            return 0;
        } else if (a !== undefined && a.startsWith('--')) {
            process.stderr.write(`check_single_delivery: unknown flag ${a}\n`);
            return 1;
        }
    }

    const v = evaluate(globalRoot, projectRoot);
    process.stdout.write(`${render(v, globalRoot, projectRoot)}\n`);
    // Dead-scope assertion via the shared primitive rather than a hand-rolled
    // `scanned:` line: `check_gate_coverage`'s hardening ratchet accepts an
    // emitted line only from a gate registered in the enforced manifest, and this
    // one is deliberately unregistered while step 4.3's binding surface is an open
    // blocker. No `allowEmpty` reason — see the `namesRead` docstring for why zero
    // is blindness here rather than a valid empty corpus.
    //
    // Caught rather than allowed to propagate: an uncaught `DeadScopeError` prints
    // a Node stack trace, which is the correct exit code wearing an unusable
    // message. The error carries the gate name and the roots, so printing it plus
    // the repoint hint gives the reader what the trace was burying.
    try {
        reportScanned({
            gate: 'check_single_delivery',
            scanned: v.namesRead,
            units: 'artefact name(s) across both layers',
            roots: [globalRoot, projectRoot],
        });
    } catch (err) {
        process.stdout.write(
            // No gate-name prefix here: the DeadScopeError message already opens
            // with it, and prefixing printed it twice.
            `❌  ${err instanceof Error ? err.message : String(err)}\n` +
                '    Neither layer holds any artefact, so nothing was read. This is NOT a pass —\n' +
                '    repoint with --global/--project, or check that the install and the projection ran.\n',
        );
        return 1;
    }

    if (v.readNothing) {
        // Never a pass. A gate that compared nothing has not verified anything,
        // and saying "invariant holds" here is the false-green shape this repo
        // has recorded from other gates.
        process.stdout.write(
            '⚠️  check_single_delivery: no artefact type had BOTH layers present, so nothing was' +
                ' compared. This is NOT a pass — repoint with --global/--project.\n',
        );
        return enforce ? 1 : 0;
    }

    if (v.duplicated === 0 && v.defeated === 0) {
        process.stdout.write('✅  check_single_delivery: one artefact, one layer — no overlap.\n');
        return 0;
    }

    const detail =
        `${v.duplicated} name(s) delivered twice` +
        (v.defeated > 0 ? `, and ${v.defeated} shared rule(s) with defeated \`paths:\` scoping` : '');
    if (enforce) {
        process.stdout.write(`❌  check_single_delivery: ${detail}. Invariant ADR-235 violated.\n`);
        return 1;
    }
    process.stdout.write(
        `⚠️  check_single_delivery: ${detail}. Reported, not enforced — ` +
            'road-to-single-delivery Phase 2 is halted on `partition-requires-global-layer`, ' +
            'so this is a known-open defect rather than a regression. Re-run with --enforce ' +
            'once the partition ships.\n',
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
