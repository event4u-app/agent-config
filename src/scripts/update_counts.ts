#!/usr/bin/env tsx
/**
 * Sync package-content counts (skills/rules/commands/guidelines) across docs.
 *
 * TypeScript twin of `src/scripts/update_counts.py` (ADR-096, Phase 5). The
 * CLI contract is mirrored EXACTLY — the single `--check` flag, exit codes
 * (0 = synced / updated; 1 = stale under --check, missing target), the
 * stdout/stderr split, and byte-identical messages AND byte-identical rewritten
 * target files (the same three regex-capture-group substitutions). Exported
 * helpers keep their Python snake_case names so the ported unittest suite can
 * call them 1:1.
 *
 * Imports the `_lib/agent_src` twin (`artefact_roots`, `iter_commands`) — the
 * SAME functions the Python original imports.
 *
 * No behaviour changes — latent Python quirks replicated.
 *
 * Source of truth: `.agent-src.uncondensed/`.
 *
 * Target files have explicit regex patterns for each count mention — no fuzzy
 * matching, no risk of touching unrelated numbers.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { artefact_roots, iter_commands } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
// _HERE === <repo>/src/scripts/update_counts.ts ; the Python original derives
// REPO_ROOT = <file>.parent.parent.parent — two dirs up from src/scripts.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Recursively walk a directory, yielding files whose basename matches. */
function* _rglob(dir: string, match: (name: string) => boolean): Generator<string> {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    // Sort for determinism (Path.rglob order is filesystem-dependent in
    // Python; we only count, so order does not affect the result).
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            yield* _rglob(full, match);
        } else if (match(e.name)) {
            yield full;
        }
    }
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

export function count(kind: string): number {
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
    for (const root of artefact_roots()) {
        const subdir = path.join(root, kind);
        if (!_exists(subdir)) {
            continue;
        }
        if (kind === 'skills') {
            for (const f of _rglob(subdir, (n) => n === 'SKILL.md')) {
                const rel = path.relative(root, f).split(path.sep).join('/');
                if (seen.has(rel)) continue;
                seen.add(rel);
                total += 1;
            }
        } else if (kind === 'personas') {
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
            // Browse-content line: `… [all NNN commands](…)`. Raw file
            // count (the hero `Commands-N` badge carries the *active*
            // count and is owned by check_command_count_messaging.py).
            ['(\\[all )(\\d+)( commands\\])', 'commands'],
            // Hero badges: shields.io URLs `Skills-NNN-<color>` etc.
            ['(/badge/Skills-)(\\d+)(-)', 'skills'],
            ['(/badge/Rules-)(\\d+)(-)', 'rules'],
            ['(/badge/Guidelines-)(\\d+)(-)', 'guidelines'],
            ['(/badge/Personas-)(\\d+)(-)', 'personas'],
        ],
    ],
    [
        'docs/getting-started.md',
        [
            ['(automatically by )(\\d+)( rules)', 'rules'],
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

const KINDS = ['skills', 'rules', 'commands', 'guidelines', 'personas'] as const;

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
        `📊  Truth: skills=${counts['skills']} rules=${counts['rules']} ` +
            `commands=${counts['commands']} guidelines=${counts['guidelines']} ` +
            `personas=${counts['personas']}\n`,
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

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}
