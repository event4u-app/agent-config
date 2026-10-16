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
    if (kind === 'commands_toplevel') {
        // Command files at the TOP LEVEL of the projected directory, not
        // recursively. The README sub-note exists to explain why the badge and
        // the linked directory disagree, so this count is the directory's own
        // listing — a recursive count here would make the sentence explain
        // nothing (`road-to-surfaces-no-gate-reads` 1.1).
        const dir = path.join(REPO_ROOT, 'dist', 'agent-src', 'commands');
        if (!_exists(dir)) return 0;
        let n = 0;
        for (const f of fs.readdirSync(dir)) {
            if (f.endsWith('.md') && f !== 'AGENTS.md') n += 1;
        }
        return n;
    }
    if (kind === 'rules_projected') {
        // Rules in the projection, which is NOT the source count: a dormant
        // rule ships in `src/rules/` and is not projected. The sub-note states
        // both and the difference is the thing it explains.
        const dir = path.join(REPO_ROOT, 'dist', 'agent-src', 'rules');
        if (!_exists(dir)) return 0;
        let n = 0;
        for (const f of fs.readdirSync(dir)) {
            if (f.endsWith('.md') && f !== 'README.md') n += 1;
        }
        return n;
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
    if (kind === 'advisors') {
        // The Advisors badge sat on the claim row with no pattern behind it,
        // while the sub-note said all six badge counts are re-derived. The
        // `personas` walk is flat, so the advisors subdirectory is its own kind.
        for (const root of artefact_roots()) {
            for (const f of _glob(path.join(root, 'personas', 'advisors'), (n) => n.endsWith('.md'))) {
                if (path.basename(f) === 'README.md') continue;
                const rel = path.relative(root, f).split(path.sep).join('/');
                if (seen.has(rel)) continue;
                seen.add(rel);
                total += 1;
            }
        }
        return total;
    }
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
            ['(/badge/Advisors-)(\\d+)(-)', 'advisors'],
            // The sub-note under the badges. The comment above used to end at
            // "Prose counts were removed from the README on purpose", and the
            // sub-note re-added four of them in `fc1bdec4f` without an owner.
            // At 2026-10-12 two had drifted — "Rules 121" against 122 source
            // rules, "projection holds 120" against 121 — while the two
            // Commands figures happened to be right, which is exactly how a
            // hand-typed number fails: silently, and only on some of them.
            // Gated rather than deleted (D1): the sentence answers a real
            // reader question about why the badge and the directory differ.
            ['(\\*\\*Commands )(\\d+)(\\*\\* counts every command file)', 'commands_active'],
            ['(holds )(\\d+)( at its top level)', 'commands_toplevel'],
            ['(\\*\\*Rules )(\\d+)(\\*\\* counts the)', 'rules'],
            ['(projection holds )(\\d+)()', 'rules_projected'],
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
    // The documentation site carried the same figures by hand and nothing read
    // them. Measured 2026-10-14 against a tree of skills 300 / rules 122 /
    // commands 205 / guidelines 121, the two "what's inside" tables were stale
    // on EVERY generated row — 278 / 105 / 190 / 101 — and seven further
    // literal `190`s sat across five files, while the README two directories up
    // said one canonical counter re-derives the figures and fails CI on a drift
    // of one. It did; its TARGETS list simply stopped at `docs/`. Gated rather
    // than deleted, the same call the README sub-note took: the numbers answer
    // a reader's question, and a generated number is a better answer than none.
    [
        'site/src/content/docs/architecture/overview.md',
        [
            ['(\\| \\*\\*Skills\\*\\* \\| )(\\d+)( \\|)', 'skills'],
            ['(\\| \\*\\*Rules\\*\\* \\| )(\\d+)( \\|)', 'rules'],
            ['(\\| \\*\\*Commands\\*\\* \\| )(\\d+)( \\|)', 'commands_active'],
            ['(\\| \\*\\*Guidelines\\*\\* \\| )(\\d+)( \\|)', 'guidelines'],
            ['(\\| \\*\\*Personas\\*\\* \\| )(\\d+)( \\()', 'personas'],
        ],
    ],
    [
        'site/src/content/docs/getting-started/introduction.md',
        [
            ['(\\| \\*\\*Skills\\*\\* \\| )(\\d+)( \\|)', 'skills'],
            ['(\\| \\*\\*Rules\\*\\* \\| )(\\d+)( \\|)', 'rules'],
            ['(\\| \\*\\*Commands\\*\\* \\| )(\\d+)( \\|)', 'commands_active'],
            ['(\\| \\*\\*Guidelines\\*\\* \\| )(\\d+)( \\|)', 'guidelines'],
            ['(\\| \\*\\*Personas\\*\\* \\| )(\\d+)( \\|)', 'personas'],
        ],
    ],
    [
        'site/src/content/docs/agent-commands/overview.md',
        [
            ['(ships \\*\\*)(\\d+)(\\*\\* agent commands)', 'commands_active'],
            ['(index of all )(\\d+)(:)', 'commands_active'],
        ],
    ],
    [
        'site/src/content/docs/agent-commands/key-commands.md',
        [['(exhaustive list of all )(\\d+)(, see)', 'commands_active']],
    ],
    [
        'site/src/content/docs/agent-commands/clusters.md',
        // The page's own `description:` frontmatter carried a second copy of
        // the figure. A meta description is not where a reader goes for a
        // count, so that one is dropped rather than generated; the body line
        // that a reader does act on stays, and is generated.
        [['(\\) lists all )(\\d+)(\\.)', 'commands_active']],
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

/**
 * Return [new_text, drifts, unapplied]. Each drift is [kind, old, new]; each
 * unapplied entry is a pattern that produced NO substitution and the reason.
 *
 * A pattern that matches nothing used to warn on stderr and continue, so
 * `--check` reported "All counts in sync" for a sentence it could no longer
 * find — a figure that drifts after its pattern stops matching it is exactly
 * the silent pass a counter exists to prevent. The caller decides what to do
 * with the list; in check mode it is a failure.
 */
export function apply_to_text(
    text: string,
    patterns: ReadonlyArray<[string, string]>,
    counts: Record<string, number>,
): [string, Array<[string, number, number]>, Array<[string, string, string]>] {
    const drifts: Array<[string, number, number]> = [];
    // [pattern, kind, reason]
    const unapplied: Array<[string, string, string]> = [];
    let new_text = text;
    for (const [pattern, kind] of patterns) {
        // Python re.compile(pattern).finditer / .sub — global, non-overlapping.
        const reFind = new RegExp(pattern, 'g');
        const matches = [...new_text.matchAll(reFind)];
        if (matches.length === 0) {
            process.stderr.write(`  ⚠️  pattern missed: /${pattern}/ (kind=${kind})\n`);
            unapplied.push([pattern, kind, 'pattern matched nothing']);
            continue;
        }
        // A kind with no count is a BUG in TARGETS or KINDS, and writing it
        // anyway puts the literal `undefined` into a published file. Measured
        // on 2026-10-12: adding two patterns without adding their kinds to
        // KINDS rewrote the README sub-note to "holds undefined at its top
        // level" and `--check` then reported "All counts in sync", because the
        // pattern no longer matched its own output. Refuse instead, loudly.
        const next = counts[kind];
        if (typeof next !== 'number' || !Number.isFinite(next)) {
            process.stderr.write(
                `  ❌  no count for kind=${kind} (pattern /${pattern}/) — ` +
                    'add it to KINDS; refusing to write `undefined` into the target\n',
            );
            unapplied.push([pattern, kind, 'no count for this kind']);
            continue;
        }
        for (const m of matches) {
            const old = Number.parseInt(m[2] as string, 10);
            if (old !== next) {
                drifts.push([kind, old, next]);
            }
        }
        const reSub = new RegExp(pattern, 'g');
        new_text = new_text.replace(reSub, (_full, g1: string, _g2: string, g3: string) => {
            return `${g1}${next}${g3}`;
        });
    }
    return [new_text, drifts, unapplied];
}

export const KINDS = [
    'skills',
    'skills_scoped',
    'rules',
    'commands',
    'commands_active',
    'commands_toplevel',
    'rules_projected',
    'guidelines',
    'personas',
    'advisors',
    'router_rules',
] as const;

export const CLAIM_ROW_MARKER = '<!-- claim:published-artifact-counts -->';

/**
 * Badges on a claim-row line that no count pattern re-derives.
 *
 * The counts are matched by URL pattern, never by position, so a badge dropped
 * onto the claim row that matches no pattern used to pass `--check` unseen
 * while the row promises every figure on it is machine-checked. The allowed
 * set is the target's own `/badge/` patterns, so adding a count adds its badge.
 * Inline, reference-style and HTML `<img>` images are all read.
 */
export function claim_row_findings(
    text: string,
    patterns: ReadonlyArray<[string, string]>,
): Array<[number, string]> {
    const badge_patterns = patterns
        .filter(([pattern]) => pattern.includes('/badge/'))
        .map(([pattern]) => new RegExp(pattern));
    const definitions = new Map<string, string>();
    for (const m of text.matchAll(/^ {0,3}\[([^\]]+)\]:\s*<?([^\s>]+)>?/gm)) {
        definitions.set((m[1] as string).trim().toLowerCase(), m[2] as string);
    }
    const findings: Array<[number, string]> = [];
    text.split('\n').forEach((line, index) => {
        if (!line.includes(CLAIM_ROW_MARKER)) return;
        const urls: string[] = [];
        for (const m of line.matchAll(/!\[([^\]]*)\](?:\(([^)\s]+)[^)]*\)|\[([^\]]*)\])?/g)) {
            if (m[2] !== undefined) {
                urls.push(m[2]);
                continue;
            }
            // Reference (`![a][ref]`), collapsed (`![a][]`) and shortcut (`![a]`)
            // forms. An unresolvable label is reported as itself, never skipped.
            const label = (m[3] || m[1] || '').trim();
            urls.push(definitions.get(label.toLowerCase()) ?? `[${label}]`);
        }
        for (const m of line.matchAll(/<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
            urls.push((m[1] ?? m[2] ?? m[3]) as string);
        }
        for (const url of urls) {
            if (!badge_patterns.some((re) => re.test(url))) {
                findings.push([index + 1, url]);
            }
        }
    });
    return findings;
}

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

/**
 * `opts` exists so the check-mode contract can be tested against a fixture
 * tree instead of the real one. A test that has to edit a tracked file to
 * exercise a gate is a test that cannot run, so the seam is here rather than
 * in the test.
 */
export function main(
    argv: readonly string[] = process.argv.slice(2),
    opts: { root?: string; targets?: ReadonlyArray<[string, ReadonlyArray<[string, string]>]> } = {},
): number {
    const args = parse_args(argv);
    const root = opts.root ?? REPO_ROOT;
    const targets = opts.targets ?? TARGETS;

    const counts: Record<string, number> = {};
    for (const k of KINDS) {
        counts[k] = count(k);
    }
    process.stdout.write(
        `📊  Truth: skills=${counts['skills']} skills_scoped=${counts['skills_scoped']} ` +
            `rules=${counts['rules']} commands=${counts['commands']} ` +
            `commands_active=${counts['commands_active']} ` +
            `guidelines=${counts['guidelines']} ` +
            `personas=${counts['personas']} advisors=${counts['advisors']} ` +
            `router_rules=${counts['router_rules']}\n`,
    );

    let any_drift = false;
    let any_change = false;
    let any_unapplied = false;
    let any_unguarded = false;
    for (const [rel, patterns] of targets) {
        const p = path.join(root, rel);
        if (!_exists(p)) {
            process.stderr.write(`❌  Missing target: ${rel}\n`);
            return 1;
        }
        const text = fs.readFileSync(p, 'utf-8');
        const [new_text, drifts, unapplied] = apply_to_text(text, patterns, counts);
        for (const [line, url] of claim_row_findings(text, patterns)) {
            any_unguarded = true;
            process.stderr.write(
                `  ❌  ${rel}:${line}: badge on the claim row that no count re-derives — ${url}\n`,
            );
        }
        for (const [pattern, kind, reason] of unapplied) {
            any_unapplied = true;
            process.stderr.write(`  ❌  ${rel}: ${reason} — /${pattern}/ (kind=${kind})\n`);
        }
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
        if (any_unapplied) {
            process.stderr.write(
                '\n❌  A pattern applied to nothing (named above). The figure it owns is ' +
                    'no longer generated, so a drift in it would pass unseen. Fix the pattern ' +
                    'or drop it with the figure.\n',
            );
            return 1;
        }
        if (any_unguarded) {
            process.stderr.write(
                '\n❌  A badge on the claim row is not re-derived (named above). Move it off ' +
                    'the line carrying the claim marker, or add a count that derives it.\n',
            );
            return 1;
        }
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
