#!/usr/bin/env tsx
/**
 * Sync package-content counts (skills/rules/commands/guidelines) across docs.
 *
 * Ported from the retired Python `src/scripts/update_counts.py` (ADR-200). The
 * CLI contract is mirrored EXACTLY — the single `--check` flag, exit codes
 * (0 = synced / updated; 1 = stale under --check, missing target), the
 * stdout/stderr split, and byte-identical messages AND byte-identical rewritten
 * target files (the same three regex-capture-group substitutions). Exported
 * helpers keep their Python snake_case names so the ported unittest suite can
 * call them 1:1.
 *
 * Imports the `_lib/agent_src` twin (`artefact_roots`, `iter_commands`) — the
 * SAME functions the retired Python implementation imports.
 *
 * Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour.
 *
 * Source of truth: `src/`.
 *
 * Target files have explicit regex patterns for each count mention — no fuzzy
 * matching, no risk of touching unrelated numbers.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots, iter_commands } from './_lib/agent_src.js';
import { scoped_projection_stats } from './_lib/scoped_projection.js';
import { canonical_counts } from './check_command_count_messaging.js';

const _HERE = fileURLToPath(import.meta.url);
// _HERE === <repo>/src/scripts/update_counts.ts ; the retired Python implementation derives
// REPO_ROOT = <file>.parent.parent.parent — two dirs up from src/scripts.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/**
 * Recursively walk a directory, yielding files whose basename matches.
 *
 * Symlink confinement (release-truth Phase 3): a symlink — leaf or directory —
 * is honored only when its target resolves inside the walk root; external
 * targets, broken links, and cycles are ignored. Directory symlinks are
 * followed through a visited-realpath set so a self-referential link
 * terminates instead of recursing to stack exhaustion.
 */
function* _rglob(dir: string, match: (name: string) => boolean): Generator<string> {
    let rootReal: string;
    try {
        rootReal = fs.realpathSync(dir);
    } catch {
        return;
    }
    const confined = (p: string): string | null => {
        try {
            const real = fs.realpathSync(p);
            const rel = path.relative(rootReal, real);
            const inside = real === rootReal || (rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel));
            return inside ? real : null;
        } catch {
            return null; // broken symlink → explicitly not yielded
        }
    };
    const visited = new Set<string>([rootReal]);
    function* walk(current: string): Generator<string> {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        // Sort for determinism (Path.rglob order is filesystem-dependent in
        // Python; we only count, so order does not affect the result).
        entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        for (const e of entries) {
            const full = path.join(current, e.name);
            if (e.isDirectory()) {
                yield* walk(full);
            } else if (e.isSymbolicLink()) {
                const real = confined(full);
                if (real === null) {
                    continue;
                }
                let st: fs.Stats;
                try {
                    st = fs.statSync(full);
                } catch {
                    continue;
                }
                if (st.isDirectory()) {
                    if (visited.has(real)) {
                        continue;
                    }
                    visited.add(real);
                    yield* walk(full);
                } else if (st.isFile() && match(e.name)) {
                    yield full;
                }
            } else if (e.isFile() && match(e.name)) {
                yield full;
            }
        }
    }
    yield* walk(dir);
}

/** Yield immediate child files of dir matching `match`. */
function* _glob(dir: string, match: (name: string) => boolean): Generator<string> {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        if (e.isFile() && match(e.name)) {
            yield path.join(dir, e.name);
        }
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/**
 * Every `SKILL.md` the canonical `count('skills')` counts, as absolute paths.
 *
 * Exported so `count_scoped_projection.ts` partitions the SAME file set the
 * ledger's total is derived from. That is what makes the published pair
 * ("N of M skills") coherent by construction: `projected + pruned === M`
 * cannot drift, because there is one walk, not two.
 */
export function* iter_skills(): Generator<string> {
    const seen = new Set<string>();
    for (const root of artefact_roots()) {
        const subdir = path.join(root, 'skills');
        if (!_exists(subdir)) {
            continue;
        }
        for (const f of _rglob(subdir, (n) => n === 'SKILL.md')) {
            const rel = path.relative(root, f).split(path.sep).join('/');
            if (seen.has(rel)) continue;
            seen.add(rel);
            yield f;
        }
    }
}

export function count(kind: string): number {
    if (kind === 'commands_active') {
        // Commands MINUS deprecation shims — the number the hero badge and the
        // "Browse all N active commands" line carry, and the one prose
        // mentions resolve to. Distinct from `commands` (raw file count):
        // they are equal only while the shim set is empty, so anchoring an
        // active-count position to `commands` would rewrite it to the wrong
        // number the moment a command is superseded.
        const [, , active] = canonical_counts();
        return active;
    }
    if (kind === 'skills_scoped') {
        // Skills a DEFAULT `projection.mode: scoped` install deploys. Derived
        // by the installer's own prune predicate over the same walk the
        // canonical `skills` total uses, so the published pair
        // ("N of M skills") cannot drift apart. See count_scoped_projection.ts.
        return scoped_projection_stats(REPO_ROOT, iter_skills()).projected;
    }
    if (kind === 'router_rules') {
        // Routed rule entries in the compiled router (kernel + tier_1 +
        // tier_2). Read from dist/router.json — the artifact hosts consume —
        // so prose citing "the router routes N rules" tracks the compiled
        // truth, not a hand-typed snapshot.
        const routerPath = path.join(REPO_ROOT, 'dist', 'router.json');
        const router = JSON.parse(fs.readFileSync(routerPath, 'utf-8')) as {
            kernel?: unknown[];
            tier_1?: unknown[];
            tier_2?: unknown[];
        };
        return (
            (router.kernel?.length ?? 0) +
            (router.tier_1?.length ?? 0) +
            (router.tier_2?.length ?? 0)
        );
    }
    if (kind === 'guidelines') {
        // Guidelines live under docs/guidelines/{topic}/ — they are reference
        // material, not packaged artefacts. Recursive walk to count every .md.
        let total = 0;
        for (const _ of _rglob(path.join(REPO_ROOT, 'docs', 'guidelines'), (n) => n.endsWith('.md'))) {
            total += 1;
        }
        return total;
    }
    let total = 0;
    const seen = new Set<string>();
    if (kind === 'commands') {
        // Commands live under packages/*/commands/ AND the 6.0.0-D
        // src/domains/<pack>/<subpath>/command.md homes; iter_commands()
        // covers both (artefact_roots()/commands cannot see src/domains).
        // Skip the AGENTS.md reference orchestrator.
        for (const f of iter_commands()) {
            if (path.basename(f) === 'AGENTS.md') {
                continue;
            }
            total += 1;
        }
        return total;
    }
    if (kind === 'skills') {
        // Single walk, shared with count_scoped_projection.ts — see iter_skills.
        for (const _ of iter_skills()) {
            total += 1;
        }
        return total;
    }
    for (const root of artefact_roots()) {
        const subdir = path.join(root, kind);
        if (!_exists(subdir)) {
            continue;
        }
        if (kind === 'personas') {
            // personas live as flat .md files, README excluded
            for (const f of _glob(subdir, (n) => n.endsWith('.md'))) {
                if (path.basename(f) === 'README.md') continue;
                const rel = path.relative(root, f).split(path.sep).join('/');
                if (seen.has(rel)) continue;
                seen.add(rel);
                total += 1;
            }
        } else {
            for (const f of _glob(subdir, (n) => n.endsWith('.md'))) {
                const rel = path.relative(root, f).split(path.sep).join('/');
                if (seen.has(rel)) continue;
                seen.add(rel);
                total += 1;
            }
        }
    }
    return total;
}

// file → list of [regex, kind]
// Each regex MUST use three capture groups: (prefix)(number)(suffix).
export const TARGETS: ReadonlyArray<[string, ReadonlyArray<[string, string]>]> = [
    [
        'README.md',
        [
            // Counts live only in the hero badges — shields.io URLs
            // `Skills-NNN-<color>` etc. Prose counts were removed from the
            // README on purpose (the badges carry the numbers); the Commands
            // badge is owned by check_command_count_messaging.
            ['(/badge/Skills-)(\\d+)(-)', 'skills'],
            ['(/badge/Rules-)(\\d+)(-)', 'rules'],
            // The Commands badge WAS left to check_command_count_messaging
            // alone ("avoids double-ownership"). Nothing generated it, so it
            // drifted to 191 against a canonical 192 and only the checker
            // noticed — the exact gap this roadmap closes. Generator writes,
            // checker verifies: that IS the ownership split, not a conflict.
            ['(/badge/Commands-)(\\d+)(-)', 'commands_active'],
            ['(/badge/Guidelines-)(\\d+)(-)', 'guidelines'],
            ['(/badge/Personas-)(\\d+)(-)', 'personas'],
        ],
    ],
    [
        'docs/CLAIMS.md',
        [
            // The three count claims — their numbers are generated from the
            // same source the gate checks, closing the ledger's own
            // "count-source binding" debt (B1.2).
            ['(- claim: )(\\d+)( skills\\.)', 'skills'],
            ['(- claim: )(\\d+)( commands\\.)', 'commands'],
            ['(- claim: )(\\d+)( governed rules\\.)', 'rules'],
            // The scoped-projection claim: BOTH halves of "N of M skills".
            // `M` was scanner-checked but generator-blind (a maintainer
            // hand-edited it on every skill addition); `N` was guarded by
            // nothing at all and had drifted 2 from the benchmark doc the
            // claim names as its own method.
            ['(installs ships )(\\d+)( of )', 'skills_scoped'],
            ['( of )(\\d+)( skills \\(untagged core)', 'skills'],
            // The "N of M governed rules" position was retired on 2026-08-23:
            // the `enforcement-coverage-resolved` entry no longer restates any
            // enforcement figure, because five hand-written numbers for one
            // property is the defect `check_enforcement_denominator` now reds
            // on. The denominator lives in ONE place — the resolver's own output,
            // projected into docs/proof.md § 4b — so there is no longer a
            // literal here for a generator to keep in sync.
        ],
    ],
    [
        'docs/command-flows.md',
        [['(\\*\\*)(\\d+)( commands\\*\\*)', 'commands_active']],
    ],
    [
        'docs/getting-started-by-role.md',
        [
            ['(ships )(\\d+)( skills, )', 'skills'],
            ['( skills, )(\\d+)( governed rules, and )', 'rules'],
            ['( governed rules, and )(\\d+)( commands\\.)', 'commands'],
        ],
    ],
    [
        'docs/featured-skills.md',
        [
            ['(subset of the )(\\d+)( skills)', 'skills'],
            ['(Browse all )(\\d+)( skills)', 'skills'],
            ['(all )(\\d+)( commands: \\[)', 'commands'],
        ],
    ],
    [
        'docs/governance-advantage.md',
        [
            ['(load all )(\\d+)( skills)', 'skills'],
            ['(\\()(\\d+)( routed rules,)', 'router_rules'],
        ],
    ],
    [
        'docs/getting-started.md',
        [
            ['(automatically by )(\\d+)( rules)', 'rules'],
            // Was deliberately unsynced to avoid double-ownership with
            // check_command_count_messaging; it drifted to 191 as a result.
            // Now generated from `commands_active` — the SAME canonical the
            // checker compares against, so the two cannot disagree.
            ['(Browse all )(\\d+)( active commands)', 'commands_active'],
            // NOTE: the "Browse all N active commands" line here carries the
            // *active* command count and is owned by
            // check_command_count_messaging.py — intentionally not synced
            // from this raw-file-count script (avoids double-ownership).
        ],
    ],
    [
        'docs/architecture.md',
        [
            ['(\\| \\*\\*Skills\\*\\* \\| )(\\d+)( \\|)', 'skills'],
            ['(\\| \\*\\*Rules\\*\\* \\| )(\\d+)( \\|)', 'rules'],
            ['(\\| \\*\\*Commands\\*\\* \\| )(\\d+)( \\|)', 'commands'],
            ['(\\| \\*\\*Guidelines\\*\\* \\| )(\\d+)( \\|)', 'guidelines'],
        ],
    ],
];

/** Return [new_text, drifts]. Each drift is [kind, old, new]. */
export function apply_to_text(
    text: string,
    patterns: ReadonlyArray<[string, string]>,
    counts: Record<string, number>,
): [string, Array<[string, number, number]>] {
    const drifts: Array<[string, number, number]> = [];
    let new_text = text;
    for (const [pattern, kind] of patterns) {
        // Python re.compile(pattern).finditer / .sub — global, non-overlapping.
        const reFind = new RegExp(pattern, 'g');
        const matches = [...new_text.matchAll(reFind)];
        if (matches.length === 0) {
            process.stderr.write(`  ⚠️  pattern missed: /${pattern}/ (kind=${kind})\n`);
            continue;
        }
        for (const m of matches) {
            const old = Number.parseInt(m[2] as string, 10);
            const next = counts[kind] as number;
            if (old !== next) {
                drifts.push([kind, old, next]);
            }
        }
        const reSub = new RegExp(pattern, 'g');
        new_text = new_text.replace(reSub, (_full, g1: string, _g2: string, g3: string) => {
            return `${g1}${counts[kind] as number}${g3}`;
        });
    }
    return [new_text, drifts];
}

const KINDS = [
    'skills',
    'skills_scoped',
    'rules',
    'commands',
    'commands_active',
    'guidelines',
    'personas',
    'router_rules',
] as const;

function parse_args(argv: readonly string[]): { check: boolean } {
    const args = { check: false };
    const usage = 'usage: update_counts.py [-h] [--check]\n';
    for (const arg of argv) {
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(usage);
            process.exit(0);
        } else if (arg === '--check') {
            args.check = true;
        } else {
            process.stderr.write(usage);
            process.stderr.write(`update_counts.py: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
    }
    return args;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);

    const counts: Record<string, number> = {};
    for (const k of KINDS) {
        counts[k] = count(k);
    }
    process.stdout.write(
        `📊  Truth: skills=${counts['skills']} skills_scoped=${counts['skills_scoped']} ` +
            `rules=${counts['rules']} commands=${counts['commands']} ` +
            `commands_active=${counts['commands_active']} ` +
            `guidelines=${counts['guidelines']} ` +
            `personas=${counts['personas']} router_rules=${counts['router_rules']}\n`,
    );

    let any_drift = false;
    let any_change = false;
    for (const [rel, patterns] of TARGETS) {
        const p = path.join(REPO_ROOT, rel);
        if (!_exists(p)) {
            process.stderr.write(`❌  Missing target: ${rel}\n`);
            return 1;
        }
        const text = fs.readFileSync(p, 'utf-8');
        const [new_text, drifts] = apply_to_text(text, patterns, counts);
        if (drifts.length > 0) {
            any_drift = true;
            for (const [kind, old, next] of drifts) {
                process.stdout.write(`  ${args.check ? '🔴' : '🔧'}  ${rel}: ${kind} ${old} → ${next}\n`);
            }
        }
        if (new_text !== text && !args.check) {
            fs.writeFileSync(p, new_text, 'utf-8');
            any_change = true;
        }
    }

    if (args.check) {
        if (any_drift) {
            process.stderr.write('\n❌  Stale counts detected. Run `task counts-update` to fix.\n');
            return 1;
        }
        process.stdout.write('✅  All counts in sync.\n');
        return 0;
    }

    if (any_change) {
        process.stdout.write('✅  Counts updated.\n');
    } else {
        process.stdout.write('✅  Counts already in sync.\n');
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}
