/**
 * Which of the surfaces `CONTRIBUTING.md` § Versioning policy lists as major a
 * release span touched, read mechanically from that span's diff.
 *
 * `impact_bump` takes `touches_major_surface` and nothing in the tree supplied
 * it: step 2.2 scored the impact half alone and recorded the surface half as
 * unscored, because "the record has no surface column, and inferring one would
 * re-judge history". A diff is not the record — it is the change itself — so
 * this module reads the axis from the change rather than from prose about it.
 *
 * Nothing in `release.ts` calls this, for the same reason nothing calls
 * `impact_bump`: how releases are numbered is the owner decision the
 * `impact-numbering-model` blocker holds open. This is measurement apparatus.
 */

/** The three triggers at `CONTRIBUTING.md:331` that a diff can decide. */
export const MAJOR_SURFACES = ['installer-layout', 'settings-keys', 'rule-or-skill-removal'] as const;
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
 * The diff's paths that are settings-key files, for the caller's `git diff -- <paths>`.
 *
 * KNOWN OVER-MATCH, recorded 2026-10-21 rather than silently narrowed. The last
 * two rows above match on a directory plus the word `settings` and take no
 * extension, so they also select non-YAML files whose contents
 * `removed_setting_keys` then reads with a YAML key regex: in the scored window
 * that is `src/server/schemas/settings.ts` (seven spans) and
 * `tests/install/settings_surface_snapshot.test.ts` (one). A deleted property in
 * either would be counted as a dropped settings key.
 *
 * Measured impact in that window: NONE. All 14 spans were re-run with the paths
 * filtered to `.yml`/`.yaml`; every span's fire/no-fire outcome and every
 * removed-key set is byte-identical either way, so no row of the out-of-sample
 * measurement depends on the over-match.
 *
 * Not narrowed here on purpose. The obvious guard — require a YAML extension —
 * is a change to this exported function's contract, and a committed test
 * deliberately asserts that a `…schemas/agent-settings.schema.json` path IS
 * selected. Rewriting that contract on a latent finding, in the change that
 * merely measured it, is wider than the finding warrants. Whoever wires the
 * surface clause under blocker option (a) should apply the guard and move that
 * test with it.
 */
export function settings_key_paths(entries: readonly DiffEntry[]): string[] {
    const seen = new Set<string>();
    for (const entry of entries) {
        if (matches(entry.path, SETTINGS_KEY_FILES)) seen.add(entry.path);
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
): Set<MajorSurface> {
    const out = new Set<MajorSurface>();
    for (const entry of entries) {
        if (!is_create_or_delete(entry.status)) continue;
        if (matches(entry.path, INSTALLER_LAYOUT_PATHS)) out.add('installer-layout');
        if (entry.status === 'D' && matches(entry.path, RULE_OR_SKILL_PATHS)) out.add('rule-or-skill-removal');
    }
    if (removed_keys.length > 0) out.add('settings-keys');
    return out;
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
