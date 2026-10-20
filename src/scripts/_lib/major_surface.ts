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
 * every release before the last relocation as having touched nothing.
 */
const INSTALLER_LAYOUT_PATHS: readonly RegExp[] = [
    /^src\/install\//,
    /^packages\/core\/installer\//,
    /^templates\//,
    /^bin\//,
    /^scripts\/install\.(py|sh|ts|mjs)$/,
];

/** Paths whose deletion removes a rule or a skill, in source or in either projection. */
const RULE_OR_SKILL_PATHS: readonly RegExp[] = [
    /^src\/(rules|skills)\//,
    /^\.agent-src\/(rules|skills)\//,
    /^dist\/agent-src\/(rules|skills)\//,
];

/** Files whose removed `key:` lines are settings keys. Read by the caller, not here. */
export const SETTINGS_KEY_FILES: readonly RegExp[] = [
    /^config\/agent-settings\.template\.yml$/,
    /^templates\/\.agent-settings\.yml/,
    /^src\/scripts\/schemas\/.*settings/,
    /^src\/install\/.*settings/,
];

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
    removed_setting_keys: readonly string[] = [],
): Set<MajorSurface> {
    const out = new Set<MajorSurface>();
    for (const entry of entries) {
        if (!is_create_or_delete(entry.status)) continue;
        if (matches(entry.path, INSTALLER_LAYOUT_PATHS)) out.add('installer-layout');
        if (entry.status === 'D' && matches(entry.path, RULE_OR_SKILL_PATHS)) out.add('rule-or-skill-removal');
    }
    if (removed_setting_keys.length > 0) out.add('settings-keys');
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
