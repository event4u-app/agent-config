/**
 * Which of the surfaces `CONTRIBUTING.md` § Versioning policy lists as major a
 * release span touched, read mechanically from that span's diff.
 *
 * `release.ts` feeds the result to `span_bump` (ADR-300). It was written first
 * as measurement apparatus for the out-of-sample score of the
 * `impact-numbering-model` blocker, which is why the tables below carry the
 * historical roots every surface has lived at.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pendingRows } from './breaking_pending.js';

/** The triggers at `CONTRIBUTING.md` § Versioning policy that a diff can decide. */
export const MAJOR_SURFACES = [
    'installer-layout',
    'settings-keys',
    'rule-or-skill-removal',
    'command-removal',
    'pending-breaking',
] as const;
export type MajorSurface = (typeof MAJOR_SURFACES)[number];

/**
 * The fourth trigger, "breaking changes to the condensed content format", is
 * deliberately absent and is reported as a gap rather than scored as a
 * non-firing surface. A format break is a property of the emitted content; no
 * reading of statuses and paths decides it, and the obvious proxy — the
 * condenser's own filename — fires on every wording fix to that script. A
 * surface that cannot be decided is not the same as a surface that did not
 * fire, and scoring it as the latter would overstate the rule's coverage.
 */
export const UNDERIVABLE_SURFACES = ['condensed-format'] as const;

/** One `git diff --name-status` record. `status` is the raw letter: A, D, M, R, T, C. */
export interface DiffEntry {
    readonly status: string;
    readonly path: string;
}

/**
 * Paths whose creation or removal is an installer-layout change. The list is
 * historical on purpose: the installer has lived at three roots over the
 * window this is measured on, and a table naming only today's would score
 * every release before the last relocation as having touched nothing. The
 * entry-point row carries an optional `src/` prefix for the same reason — the
 * entry point moved from a Python script at the repository root to
 * `src/scripts/install.ts` (ADR-200), and the first version of this table
 * pinned only the old root. The retired path is described rather than quoted:
 * `lint_pre_migration_refs` reds on a backtick-quoted citation of it, and it
 * is right to — a shipped file naming it looks like an instruction to run it.
 *
 * `dist/install/` is deliberately absent. It is build output of
 * `src/scripts/install.*`, which is already covered, so including it would add
 * no signal and would fire the surface on a regenerated artifact.
 */
const INSTALLER_LAYOUT_PATHS: readonly RegExp[] = [
    /^src\/install\//,
    /^packages\/core\/installer\//,
    /^(src\/)?templates\//,
    /^bin\//,
    /^(src\/)?scripts\/install\.(py|sh|ts|mjs)$/,
];

/** Paths whose deletion removes a rule or a skill, in source or in either projection. */
const RULE_OR_SKILL_PATHS: readonly RegExp[] = [
    /^src\/(rules|skills)\//,
    /^\.agent-src\/(rules|skills)\//,
    /^dist\/agent-src\/(rules|skills)\//,
];

/**
 * Paths whose deletion removes a command: the per-domain source, the older
 * flat source tree, and the projection. 15.0.0 removed `/chat-history` this
 * way, which the major list did not name until ADR-300 added it.
 */
const COMMAND_PATHS: readonly RegExp[] = [
    /^src\/domains\/.+\/command\.md$/,
    /^src\/agent-src\/commands\//,
    /^\.agent-src\/commands\//,
    /^dist\/agent-src\/commands\//,
];

/**
 * Files whose removed `key:` lines are settings keys.
 *
 * Every row tolerates a leading directory because this table was wrong in its
 * first form and the measurement reported the resulting blindness as a
 * finding: the template was renamed `config/agent-settings.template.yml` ->
 * `src/config/agent-settings.template.yml` in the 6.0.0 span, and a row
 * anchored at `^config/` matched nothing from 6.0.0 onward — the whole window
 * the rule is scored on. An anchor that silently stops matching is the shape
 * this list now refuses.
 */
export const SETTINGS_KEY_FILES: readonly RegExp[] = [
    /(^|\/)config\/agent-settings\.template\.yml$/,
    /(^|\/)\.agent-settings\.yml/,
    /(^|\/)schemas\/.*settings/,
    /(^|\/)install\/.*settings/,
];

/**
 * The diff's YAML paths that are settings-key files, for the caller's
 * `git diff -- <paths>`.
 *
 * Only `.yml` / `.yaml` paths are returned. The last two rows above match on a
 * directory plus the word `settings`, which also selected TypeScript and JSON
 * files (`src/server/schemas/settings.ts`, a settings snapshot test) whose
 * deleted `enabled: true,` property `removed_setting_keys` would read as a
 * dropped settings key. Measured harmless while nothing consumed it; closed
 * when `release.ts` started numbering releases by it (ADR-300).
 */
export function settings_key_paths(entries: readonly DiffEntry[]): string[] {
    const seen = new Set<string>();
    for (const entry of entries) {
        if (/\.ya?ml$/.test(entry.path) && matches(entry.path, SETTINGS_KEY_FILES)) seen.add(entry.path);
    }
    return [...seen];
}

const YAML_KEY = /^([-+])([ \t]*)([A-Za-z_][A-Za-z0-9_]*):/;

/**
 * Keys a unified patch removes and does not put back.
 *
 * A `-` line alone is not a removal: a reindent, a reorder or a move between
 * files deletes the line and adds it again, and counting that as a dropped
 * settings key would fire the surface on every reformat. A key is removed only
 * when no `+` line in the same patch declares it. Indentation is ignored on
 * purpose — a key that moved under a different parent still exists, and this
 * function is asked whether the key is gone, not where it lives.
 *
 * WHAT IT CANNOT SEE, corrected 2026-10-21 after the R2 round-2 review read
 * the paragraph above as a promise the code does not keep. This reads the
 * PATCH, so "no `+` line declares it" is a statement about the diff, not about
 * the file: a key name that survives unchanged elsewhere in the same file
 * produces no `+` line at all and is therefore reported as removed. Measured
 * in the scored window — the 10.0.0 span reports `enabled` removed while that
 * template still carries 11 `enabled:` keys, and 11.0.0 reports `mode` while
 * two remain. Deciding it properly needs the file at both ends, not the patch,
 * which is a different function with a different cost; the name list is
 * therefore an UPPER BOUND on what was removed.
 *
 * It does not bias the surface: `classify_surfaces` asks only whether the list
 * is non-empty, and in both spans above the list is non-empty for a removal
 * that is real anyway. A caller that reports the names themselves — as the
 * out-of-sample measurement does — must say they are an upper bound.
 */
export function removed_setting_keys(patch: string): string[] {
    const removed = new Set<string>();
    const added = new Set<string>();
    for (const line of patch.split('\n')) {
        if (line.startsWith('---') || line.startsWith('+++')) continue;
        const m = YAML_KEY.exec(line);
        if (m === null) continue;
        (m[1] === '-' ? removed : added).add(m[3] as string);
    }
    return [...removed].filter((k) => !added.has(k)).sort();
}

function matches(path: string, patterns: readonly RegExp[]): boolean {
    return patterns.some((p) => p.test(path));
}

/** True for a status letter that creates or destroys a path, which is what the two file surfaces turn on. */
function is_create_or_delete(status: string): boolean {
    return status === 'A' || status === 'D';
}

/**
 * The surfaces a span touched.
 *
 * A rename (`R`) counts as neither a creation nor a removal. That is the
 * conservative reading and it can only under-report: a renamed rule still
 * exists, and treating every move as a removal would fire this surface on
 * every span in a tree that reorganises as often as this one. Under-reporting
 * the surface axis cannot produce a false negative on a consumer-visible
 * break, because the impact axis decides those on its own — the surface clause
 * only ever adds a major.
 *
 * `removed_setting_keys` is supplied by the caller because deciding it needs
 * the patch text, not the name-status list; passing it in keeps this pure.
 */
export function classify_surfaces(
    entries: readonly DiffEntry[],
    removed_keys: readonly string[] = [],
    unshipped_pending = 0,
): Set<MajorSurface> {
    const out = new Set<MajorSurface>();
    for (const entry of entries) {
        if (!is_create_or_delete(entry.status)) continue;
        if (matches(entry.path, INSTALLER_LAYOUT_PATHS)) out.add('installer-layout');
        if (entry.status === 'D' && matches(entry.path, RULE_OR_SKILL_PATHS)) out.add('rule-or-skill-removal');
        if (entry.status === 'D' && matches(entry.path, COMMAND_PATHS)) out.add('command-removal');
    }
    if (removed_keys.length > 0) out.add('settings-keys');
    if (unshipped_pending > 0) out.add('pending-breaking');
    return out;
}

/**
 * Rows of `BREAKING_CHANGES.md` § Pending that this span ships: a row whose
 * `Landed` commit is in `<tag>..HEAD`, or that cites none. The index files them
 * as breaking and states that a minor never breaks, so a span carrying one is a
 * major whatever its trailers say — no commit subject carries the row's wording.
 */
export function unshipped_pending_rows(index: string, span_shas: readonly string[]): number {
    return pendingRows(index).filter((r) => r.commit === null || span_shas.some((sha) => sha.startsWith(r.commit!)))
        .length;
}

function read_breaking_index(): string {
    try {
        return fs.readFileSync(path.join(process.cwd(), 'BREAKING_CHANGES.md'), 'utf-8');
    } catch {
        return '';
    }
}

/** `git diff --name-status` output into entries; a rename record keeps its new path. */
export function parse_name_status(raw: string): DiffEntry[] {
    const out: DiffEntry[] = [];
    for (const line of raw.split('\n')) {
        if (line.trim() === '') continue;
        const parts = line.split('\t');
        if (parts.length < 2) continue;
        const status = (parts[0] as string).charAt(0);
        const path = parts[parts.length - 1] as string;
        out.push({ status, path });
    }
    return out;
}

/** The surfaces the span `<tag>..HEAD` touched; `git` runs one git command and returns its stdout. */
export function span_surfaces(
    tag: string | null,
    git: (args: string[]) => string,
    read_index: () => string = read_breaking_index,
): Set<MajorSurface> {
    if (!tag) return new Set();
    const entries = parse_name_status(git(['diff', '--name-status', `${tag}..HEAD`]));
    const paths = settings_key_paths(entries);
    const patch = paths.length > 0 ? git(['diff', `${tag}..HEAD`, '--', ...paths]) : '';
    const index = read_index();
    const shas = pendingRows(index).length > 0 ? git(['log', '--format=%H', `${tag}..HEAD`]).split('\n') : [];
    return classify_surfaces(entries, removed_setting_keys(patch), unshipped_pending_rows(index, shas));
}
