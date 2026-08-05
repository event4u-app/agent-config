#!/usr/bin/env node
/**
 * Hard-Gate linter: the skill-ecosystem roadmap family may not exceed its
 * concurrency cap.
 *
 * ADR-215 § D2 states the cap is "mechanically enforced, not left to
 * discipline", and gives the reason: a guideline a single maintainer intends to
 * honour drifts under urgency. Until this file existed the record asserted an
 * enforcement that did not exist and pointed at an implementation step that was
 * never written — a claim-without-resolution in the one record governing the
 * only surviving restraint mechanism. This gate makes the claim true.
 *
 * The cap counts roadmaps in the family that sit at the TOP LEVEL of
 * `agents/roadmaps/` — i.e. active work. `archive/`, `later/`, `skipped/` and
 * `stubs/` are by definition not concurrently open and are not counted.
 *
 * Widening the cap to cover more families (see ADR-216 § D3, which records the
 * scope limitation honestly rather than pretending the cap manages total
 * capacity) is a one-line change to FAMILY_PREFIX plus a new decision record —
 * never a silent edit to CAP.
 *
 * CLI contract: exit 0 = at or under the cap, 1 = over the cap.
 * `--quiet` suppresses the green line, matching the sibling roadmap gates.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

/** Mirror the sibling gates: bare argv membership, computed at import. */
const QUIET = process.argv.slice(2).includes('--quiet');

const ROADMAP_DIR = path.join('agents', 'roadmaps');

/**
 * The capped family and its ceiling, per ADR-215 § D2 as amended by ADR-216 § D3.
 * Both are named constants so a future widening is a visible one-line diff
 * accompanied by a decision record, not an unnoticed threshold edit.
 */
const FAMILY_PREFIX = 'road-to-skill-ecosystem-';
const CAP = 2;

const _HERE = path.resolve(fileURLToPath(import.meta.url));

/** `Path.is_dir()` following symlinks, never throwing. */
function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Walk up from CWD until a dir containing `agents/roadmaps` is found. */
function _repo_root(): string {
    let cur = process.cwd();
    const chain = [cur];
    for (;;) {
        const parent = path.dirname(cur);
        if (parent === cur) break;
        chain.push(parent);
        cur = parent;
    }
    for (const candidate of chain) {
        if (_isDir(path.join(candidate, ROADMAP_DIR))) {
            return candidate;
        }
    }
    return process.cwd();
}

/**
 * Every `*.md` directly under `agents/roadmaps/` — top level only, sorted.
 * Subdirectories are deliberately NOT walked: a roadmap in `later/` or
 * `archive/` is not concurrently open, which is the whole point of the cap.
 */
export function active_roadmaps(root: string): string[] {
    const base = path.join(root, ROADMAP_DIR);
    if (!_isDir(base)) {
        return [];
    }
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((e) => !e.isDirectory() && e.name.endsWith('.md'))
        .map((e) => e.name)
        .sort();
}

/** The subset of active roadmaps belonging to the capped family. */
export function family_members(root: string): string[] {
    return active_roadmaps(root).filter((n) => n.startsWith(FAMILY_PREFIX));
}

export function main(): number {
    const root = _repo_root();

    // Anti-vacuity: this gate reports an ABSENCE (no over-cap condition), so a
    // dead scan root would print the same green line as a healthy tree. The
    // scanned unit is every ACTIVE roadmap, not just the family — a repo whose
    // top-level roadmap dir is empty or moved is a dead scope, not a pass.
    // This is the invariant road-to-skill-ecosystem-gate-integrity generalises;
    // the gate that enforces that roadmap's own cap had better honour it.
    try {
        assertScanned({
            gate: 'lint_roadmap_family_cap',
            scanned: active_roadmaps(root).length,
            units: 'active roadmap file(s)',
            roots: [ROADMAP_DIR],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const members = family_members(root);

    if (members.length <= CAP) {
        if (!QUIET) {
            process.stdout.write(
                `✅  lint-roadmap-family-cap: ${members.length}/${CAP} slot(s) used ` +
                    `(scanned ${active_roadmaps(root).length} active roadmap file(s)).\n`,
            );
        }
        return 0;
    }

    process.stdout.write(
        `❌  lint-roadmap-family-cap: ${members.length} concurrently-open ` +
            `\`${FAMILY_PREFIX}*\` roadmap(s), cap is ${CAP}:\n`,
    );
    for (const name of members) {
        process.stdout.write(`      agents/roadmaps/${name}\n`);
    }
    process.stdout.write('\n');
    process.stdout.write(
        '   The cap is a capacity mechanism, not an adoption gate — one maintainer\n',
    );
    process.stdout.write(
        '   cannot hold this many parallel workstreams (ADR-215 § D2, ADR-216 § D3).\n',
    );
    process.stdout.write('   To open another, free a slot first:\n');
    process.stdout.write(
        '     • archive a finished one — git mv it into agents/roadmaps/archive/, or\n',
    );
    process.stdout.write(
        '     • park one — git mv it into agents/roadmaps/later/ with `status: later`\n',
    );
    process.stdout.write('       and a reachable resume condition, or\n');
    process.stdout.write(
        '     • widen the cap deliberately — edit CAP in this file AND record the\n',
    );
    process.stdout.write(
        '       decision. A silent threshold edit is the failure this gate exists to stop.\n',
    );
    return 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (installed projection, or macOS /var → /private/var
    // temp dirs) makes the raw URLs differ: compare realpaths so the entry guard
    // still fires instead of silently no-opping.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exitCode = main();
}

export { CAP, FAMILY_PREFIX, QUIET };
