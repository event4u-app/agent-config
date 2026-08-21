/**
 * check_single_delivery — assert that no artefact is delivered from both layers.
 *
 * THE INVARIANT (ADR-236, one-artefact-one-layer): every rule and every skill is
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
 * REPORT BY DEFAULT, ENFORCE ON REQUEST — and that is not timidity. A blocking
 * default would red every run on a defect a given machine may not be able to
 * fix, which teaches readers to ignore it — the exact failure this estate has
 * recorded twice already.
 *
 * The reason used to be that `road-to-single-delivery` Phase 2 was HALTED on
 * blocker `partition-current-layer-undecidable`. That is no longer true and the
 * sentence is corrected rather than left standing: the blocker reads
 * `**Status:** resolved`, its roadmap is archived, and the partition shipped
 * under ADR-236 Phase 2. What replaced the halt is a per-machine activation —
 * the partition withholds artefacts only where the host layer is verified
 * against `installed.lock`, so a machine whose install predates the fingerprint
 * keeps the full projection BY DESIGN and the overlap this gate reports there is
 * the fail-safe working, not a regression.
 *
 * WHERE THIS CHECK IS MEANINGFUL — read this before quoting one of its numbers
 * (road-to-session-closeout 3.3). It is a DEVELOPER-MACHINE check. It reads two
 * host layers off the filesystem, and in CI both are absent: a fresh checkout
 * carries no `<project>/.claude/**` (zero tracked files under `.claude/`) and no
 * `~/.claude/**` because no CI leg installs at user scope. So in CI this gate
 * finds zero layers and has nothing to compare — which is reported as `absent`
 * rather than as a pass, per the paragraph below, but is still not a statement
 * about any developer's machine.
 *
 * How large that gap is, measured on ONE tree in ONE session on 2026-08-20:
 * `check_standing_rule_delivery` read the same repository twice and reported
 * 115 781 tok with one layer installed and 209 767 tok with two — a 1.8x
 * difference produced entirely by which layers existed where. Any figure from
 * this gate or that one describes the machine it ran on. Cite it with the layer
 * counts attached, never as a repository property.
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

// ledger-exempt: this gate has no skip semantics to account for. `_lib/gate_ledger`
// exists so a gate that PASSES OVER targets says which and why; here the target set
// is four fixed artefact types, every one of them appears in the output, and a type
// whose layer is missing is printed as `absent` rather than quietly dropped — see
// the `absent` field and the `types_compared=N of 4` ledger line, which together
// already carry what a per-target ledger would. Adding one would restate the render
// in a second format, and the gate's own docstring warns that the degenerate pass
// here is a marker with no argument behind it. If a future version gains a real skip
// path — a type it declines to compare for a reason — this exemption is void and the
// ledger is the right answer.

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Artefact types the host loads from both layers. */
const TYPES = ['rules', 'skills', 'commands', 'agents'] as const;
type ArtefactType = (typeof TYPES)[number];

/**
 * What a layer's entries physically ARE — symlinks, directories, or regular files.
 *
 * R2 finding 2: without this, name-equality was reported as "delivered twice" for
 * two layers holding entirely different payload shapes. Measured on this repo:
 * project `.claude/commands/` is **40 directories** of symlinks into
 * `src/domains/**` while global `.claude/commands/` is **52 regular files**. Those
 * 40 shared names are not 40 duplicated artefacts in the sense the rules row means,
 * and a check that prints one number for both teaches the reader they are.
 */
export interface LayerShape {
    symlinks: number;
    dirs: number;
    files: number;
}

export interface TypeReading {
    type: ArtefactType;
    /** null when that layer's directory does not exist — distinct from empty. */
    globalNames: string[] | null;
    projectNames: string[] | null;
    globalShape: LayerShape | null;
    projectShape: LayerShape | null;
    /**
     * True when the two layers' dominant entry shape differs, so a shared NAME is
     * not evidence of a shared artefact. The overlap is still reported — it is
     * still a delivery collision — but it is labelled, never summed with the rest.
     */
    shapeMismatch: boolean;
    both: string[];
    globalOnly: string[];
    projectOnly: string[];
    /** Shared rules whose two copies disagree on `paths:`. Rules only. */
    scopeDefeat: string[];
}

function dominant(s: LayerShape): 'symlink' | 'dir' | 'file' | 'empty' {
    const max = Math.max(s.symlinks, s.dirs, s.files);
    if (max === 0) return 'empty';
    if (s.symlinks === max) return 'symlink';
    if (s.dirs === max) return 'dir';
    return 'file';
}

interface LayerReading {
    names: string[];
    shape: LayerShape;
}

function readLayer(dir: string): LayerReading | null {
    let entries: fs.Dirent[];
    try {
        if (!fs.statSync(dir).isDirectory()) return null;
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return null;
    }
    const shape: LayerShape = { symlinks: 0, dirs: 0, files: 0 };
    for (const e of entries) {
        // isSymbolicLink() is checked FIRST and deliberately: readdir with
        // withFileTypes does not follow links, but a reader who tested isDirectory
        // first would classify a symlink-to-directory as a directory and lose the
        // distinction this whole field exists for.
        if (e.isSymbolicLink()) shape.symlinks += 1;
        else if (e.isDirectory()) shape.dirs += 1;
        else shape.files += 1;
    }
    return { names: entries.map((e) => e.name).sort(), shape };
}

/**
 * Does this rule file declare a `paths:` key in its frontmatter?
 *
 * Frontmatter only, deliberately: a `paths:` mentioned in prose is not a load
 * schedule, and matching it would manufacture scope-defeat findings out of
 * documentation.
 */
export function declaresPaths(file: string): 'yes' | 'no' | 'unreadable' {
    // Three-valued on purpose (R2 finding): a boolean collapsed "no paths: key"
    // and "could not read the file" into the same answer, so an unreadable copy
    // silently matched an unscoped one and the pair vanished from the scope-defeat
    // set — the direction that hides a finding rather than inventing one.
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch {
        return 'unreadable';
    }
    if (!text.startsWith('---')) return 'no';
    const end = text.indexOf('\n---', 3);
    if (end < 0) return 'no';
    return /^paths:/m.test(text.slice(3, end)) ? 'yes' : 'no';
}

export function readType(type: ArtefactType, globalRoot: string, projectRoot: string): TypeReading {
    const gDir = path.join(globalRoot, type);
    const pDir = path.join(projectRoot, type);
    const gLayer = readLayer(gDir);
    const pLayer = readLayer(pDir);
    const globalNames = gLayer?.names ?? null;
    const projectNames = pLayer?.names ?? null;
    const globalShape = gLayer?.shape ?? null;
    const projectShape = pLayer?.shape ?? null;
    const shapeMismatch =
        gLayer !== null && pLayer !== null && dominant(gLayer.shape) !== dominant(pLayer.shape);
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
                  .filter((n) => {
                      const g2 = declaresPaths(path.join(gDir, n));
                      const p2 = declaresPaths(path.join(pDir, n));
                      // An unreadable copy is reported as a disagreement rather
                      // than dropped: not knowing whether a rule is scoped is a
                      // finding, and the alternative silently shrinks the set.
                      if (g2 === 'unreadable' || p2 === 'unreadable') return true;
                      return g2 !== p2;
                  })
                  .sort()
            : [];

    return {
        type,
        globalNames,
        projectNames,
        globalShape,
        projectShape,
        shapeMismatch,
        both,
        globalOnly,
        projectOnly,
        scopeDefeat,
    };
}

export interface Verdict {
    readings: TypeReading[];
    /**
     * Shared names in types where BOTH layers hold the same dominant shape — the
     * number that means "this artefact is delivered twice".
     */
    duplicated: number;
    /**
     * Shared names in types whose layers hold DIFFERENT shapes. Still a delivery
     * collision on the same name, but not the same claim, so it is reported on its
     * own line and never summed into `duplicated` (R2 finding 2).
     */
    nameOverlapDifferentShape: number;
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
        duplicated: readings.reduce((n, r) => n + (r.shapeMismatch ? 0 : r.both.length), 0),
        nameOverlapDifferentShape: readings.reduce(
            (n, r) => n + (r.shapeMismatch ? r.both.length : 0),
            0,
        ),
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
    out.push('check_single_delivery · invariant: one artefact, one layer (ADR-236)');
    out.push(`  global:  ${globalRoot}`);
    out.push(`  project: ${projectRoot}`);
    out.push('');
    const shapeOf = (s: LayerShape | null): string =>
        s === null ? 'absent' : `${dominant(s)} (l${s.symlinks}/d${s.dirs}/f${s.files})`;
    for (const r of v.readings) {
        const g = r.globalNames === null ? 'absent' : String(r.globalNames.length);
        const p = r.projectNames === null ? 'absent' : String(r.projectNames.length);
        out.push(
            `  ${r.type.padEnd(9)} global ${g.padStart(6)} · project ${p.padStart(6)}` +
                ` · BOTH ${String(r.both.length).padStart(4)}` +
                ` · global-only ${String(r.globalOnly.length).padStart(4)}` +
                ` · project-only ${String(r.projectOnly.length).padStart(4)}`,
        );
        out.push(`             shape: global ${shapeOf(r.globalShape)} · project ${shapeOf(r.projectShape)}`);
        if (r.shapeMismatch && r.both.length > 0) {
            out.push(
                `             ⚠️  SHAPE MISMATCH — this check cannot establish that the` +
                    ` ${r.both.length} shared name(s) are the same artefact.`,
            );
            out.push(
                '             It does not establish that they differ either: a project symlink into' +
                    ' dist/ and a real',
            );
            out.push(
                '             directory installed globally can hold identical content reached two' +
                    ' ways. Counted on its own',
            );
            out.push(
                '             line rather than as duplication, because only the same-shape rows' +
                    ' support that claim.',
            );
        }
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
        `check_single_delivery ledger: duplicated=${v.duplicated}` +
            ` name_overlap_different_shape=${v.nameOverlapDifferentShape}` +
            ` scope_defeat=${v.defeated}` +
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
    let quiet = false;

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
        } else if (a === '--quiet') {
            // R2 finding: the full per-type table is ~30 lines, and preflight is a
            // `silent: true` task. A gate that floods a quiet chain is a gate people
            // learn to scroll past, which is the same end state as an unbound one.
            quiet = true;
        } else if (a === '--help' || a === '-h') {
            process.stdout.write(
                'usage: check_single_delivery [--global DIR] [--project DIR] [--enforce] [--quiet]\n' +
                    '\n' +
                    'Reports by default and exits 0: the partition SHIPPED (ADR-236, Phase 2)\n' +
                    'but activates per machine — only where a verified host layer exists, so a\n' +
                    'checkout without one keeps the full projection BY DESIGN and reports overlap.\n' +
                    '--enforce exits 1 on any overlap; registering it would fail every machine\n' +
                    'that has not re-run `agent-config install`, which is why it stays opt-in.\n',
            );
            return 0;
        } else if (a !== undefined) {
            // R2 finding: this used to reject only `--`-prefixed tokens, so
            // `-enforce` (one dash) and a bare positional both fell through
            // SILENTLY — the gate then reported without enforcing while the caller
            // believed it had asked for enforcement. A typo that turns a blocking
            // gate advisory is worse than a crash, so anything unrecognised is an
            // error, dash or not.
            process.stderr.write(
                `check_single_delivery: unexpected argument ${a}` +
                    ' (did you mean --enforce, --global DIR or --project DIR?)\n',
            );
            return 1;
        }
    }

    const v = evaluate(globalRoot, projectRoot);
    if (!quiet) process.stdout.write(`${render(v, globalRoot, projectRoot)}\n`);
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
    reportScanned({
        gate: 'check_single_delivery',
        scanned: v.namesRead,
        units: 'artefact name(s) across both layers',
        roots: [globalRoot, projectRoot],
        // R2 finding 1: without this reason the gate returned 1 UNCONDITIONALLY
        // wherever it is meant to be bound. `.claude/` is gitignored and no CI leg
        // installs at user scope, so `namesRead` is 0 there, the DeadScopeError
        // fired before both the `readNothing` branch and `--enforce`, and the
        // gate contradicted its own `--help` ("Reports by default and exits 0").
        //
        // OPTIONAL_SURFACE is the correct one of the three prefixes: these two
        // directories are an INSTALL-TIME surface, not a corpus this repo owns.
        // Applying the doc's operational test — if the scan root were deleted,
        // would the reason still make sense? — yes: no layers installed means
        // there is no delivery to duplicate, which is a true answer rather than
        // blindness. The blindness case is narrower and is still refused below:
        // layers that exist but never pair up (`readNothing`).
        allowEmpty:
            'OPTIONAL_SURFACE: both host layers are install-time surfaces, absent by' +
            ' construction in CI (.claude/ is gitignored) and on any machine that has' +
            ' not installed. Zero names means nothing is delivered, so nothing can be' +
            ' delivered twice — a true verdict, not a dead scope. The unverifiable' +
            ' case (layers present but never paired) is refused separately.',
    });

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

    if (v.duplicated === 0 && v.defeated === 0 && v.nameOverlapDifferentShape === 0) {
        process.stdout.write('✅  check_single_delivery: one artefact, one layer — no overlap.\n');
        return 0;
    }

    const parts: string[] = [];
    if (v.duplicated > 0) parts.push(`${v.duplicated} artefact(s) delivered twice`);
    if (v.nameOverlapDifferentShape > 0) {
        parts.push(
            `${v.nameOverlapDifferentShape} name collision(s) across layers of DIFFERENT shape` +
                ' (a delivery collision, not a duplicated artefact)',
        );
    }
    if (v.defeated > 0) {
        parts.push(`${v.defeated} shared rule(s) with defeated \`paths:\` scoping`);
    }
    const detail = parts.join(', and ');
    if (enforce) {
        process.stdout.write(`❌  check_single_delivery: ${detail}. Invariant ADR-236 violated.\n`);
        return 1;
    }
    process.stdout.write(
        `⚠️  check_single_delivery: ${detail}. Reported, not enforced — ` +
            'the partition shipped (ADR-236 Phase 2) but activates per machine: it withholds ' +
            'artefacts only where the host layer is verified against `installed.lock`, so a ' +
            'machine whose install predates the fingerprint keeps the full projection BY DESIGN ' +
            'and this overlap is the fail-safe working. Run `agent-config install` to enable it ' +
            'here; use --enforce where every machine is known to be verified.\n',
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
