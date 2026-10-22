/**
 * The settings-surface reading a cut performs, and the file it reads it from.
 *
 * `docs/releases.md` § The stability surface names `.agent-settings.yml` keys
 * as part of the public contract (`SETTINGS_REMOVAL_RULE`). The bump could not see
 * that surface at all: it reads commit SUBJECTS (`release.ts` `commits_since`
 * → `infer_bump`), so a key deleted under a `feat:` subject proposes a minor
 * and names nothing. Nothing else checked either — `lint_settings_classes`
 * validates the tombstone entries that EXIST, and the loader's removal warning
 * walks `REMOVED_KEYS` only, so a key deleted from the schema with no entry in
 * either map produces no warning anywhere and the installed value simply stops
 * applying.
 *
 * Three parts, in the order a cut uses them:
 *
 * 1. {@link emitReleasedSurface} — the flattened settings surface at one
 *    version, plus the KEYS of both tombstone maps. Descriptions are dropped
 *    (prose churn is not a surface change) and there is no timestamp, so two
 *    runs at the same version produce byte-identical output.
 * 2. {@link SETTINGS_SURFACE_FIXTURE} — one committed file holding (1) as of
 *    the LAST release. `release.ts` rewrites it inside the cut, which is its
 *    only writer; `check_release_pr_shape` allows it on a release PR.
 * 3. {@link classifySettingsDelta} / {@link assert_settings_surface_delta} —
 *    the delta between the committed file and the live schema, via
 *    `computeSurfaceDelta` (D3: the consumer-side delta and its six kinds are
 *    reused rather than given a second vocabulary), classified into the four
 *    refusals and the one carried case.
 *
 * Preview semantics match the two assertions this one sits beside in
 * `release.ts`: under `--dry-run` it PRINTS what the real run will refuse and
 * returns, because `--dry-run exits 0` is a contract that file's tests pin.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { zodToJsonSchema } from 'zod-to-json-schema';

import { settingsSchema } from '../../server/schemas/settings.js';
import { computeSurfaceDelta, flattenSurface, type SettingsSurface, type SurfaceEntry } from '../../shared/settingsSurface.js';
import { REPO_ROOT } from '../release_env.js';
import { die } from '../release_publication.js';
import { MINOR_REMOVAL_PROOFS, REMOVED_KEYS } from './settings_removed_keys.js';
import { RENAMED_KEYS, SETTINGS_REMOVAL_RULE } from './settings_renamed_keys.js';

/**
 * Synchronous on purpose. `release.ts`'s `main` returns a number and is not
 * async; making the emission a promise would turn the whole CLI entry async to
 * serve one call, so the conversion runs inline — it is the same millisecond
 * cost `install.ts` pays on every install, not the ~15 s vitest collection the
 * "keep a preview fast" rule was written about.
 */
function _jsonSchema(): Parameters<typeof flattenSurface>[0] {
    return zodToJsonSchema(settingsSchema, {
        name: 'AgentSettings',
        $refStrategy: 'none',
        target: 'jsonSchema7',
    }) as Parameters<typeof flattenSurface>[0];
}

/** The one committed copy of the last release's surface. */
export const SETTINGS_SURFACE_FIXTURE = path.join(
    REPO_ROOT,
    'tests',
    'fixtures',
    'settings_surface_released.json',
);

/** Path as a release PR's shape gate sees it — repo-relative, forward slashes. */
export const SETTINGS_SURFACE_FIXTURE_REL = 'tests/fixtures/settings_surface_released.json';

export interface ReleasedSurface extends SettingsSurface {
    /** Sorted keys of `REMOVED_KEYS` at this version. */
    removedKeys: string[];
    /** Sorted `old -> new` pairs of `RENAMED_KEYS` at this version. */
    renamedKeys: Array<[string, string]>;
}

/**
 * Flatten the live schema at `version`, minus the descriptions.
 *
 * Descriptions are dropped rather than kept-and-ignored: keeping them would
 * make every reworded help string a diff on a file whose only job is to carry
 * the comparable shape, and a file that churns for prose reasons stops being
 * read. `computeSurfaceDelta` has no `description_changed` kind, so nothing
 * downstream loses a signal.
 */
export function emitReleasedSurface(version: string): ReleasedSurface {
    const surface = flattenSurface(_jsonSchema(), version);
    const entries: Record<string, SurfaceEntry> = {};
    for (const key of Object.keys(surface.entries).sort()) {
        const { description: _drop, ...rest } = surface.entries[key] as SurfaceEntry;
        entries[key] = rest;
    }
    return {
        version,
        entries,
        removedKeys: [...REMOVED_KEYS.keys()].sort(),
        renamedKeys: [...RENAMED_KEYS.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    };
}

/** Serialize exactly as the committed file is written — one trailing newline. */
export function serializeReleasedSurface(s: ReleasedSurface): string {
    return `${JSON.stringify(s, null, 2)}\n`;
}

/** Rewrite the committed file. Called by `release.ts` inside the cut, nowhere else. */
export function writeReleasedSurface(version: string, target = SETTINGS_SURFACE_FIXTURE): void {
    fs.writeFileSync(target, serializeReleasedSurface(emitReleasedSurface(version)), 'utf8');
}

/** Read the committed file. Throws when it is missing — a cut cannot proceed blind. */
export function readReleasedSurface(target = SETTINGS_SURFACE_FIXTURE): ReleasedSurface {
    return JSON.parse(fs.readFileSync(target, 'utf8')) as ReleasedSurface;
}

/** The shape `install.ts` persists to `state/settings-delta.json` on an upgrade. */
export interface InstallerDelta {
    oldVersion: string;
    newVersion: string;
    changes: Array<{ kind: string; key: string; values?: Array<string | number> }>;
}

export interface SettingsDeltaFindings {
    /** Removed, and in NEITHER tombstone map. Refuses under either owner answer (D4). */
    untombstoned_removals: string[];
    /** Removed, but carried by `REMOVED_KEYS` or `RENAMED_KEYS`. */
    carried_removals: Array<{ key: string; via: 'removed' | 'renamed'; to?: string }>;
    /** A key whose JSON-schema type changed. */
    type_changed: string[];
    /** A key that lost one or more vocabulary values. */
    enum_removed: Array<{ key: string; values: Array<string | number> }>;
    /** A key that arrived with no default — nothing tells an existing install what it now does. */
    added_without_default: string[];
}

/**
 * Classify the delta between a released surface and the live one.
 *
 * Tombstone membership is read from the NEW surface, not the old one: a
 * removal and its tombstone land in the SAME change, so checking the old
 * side's maps would refuse every correctly-annotated removal.
 *
 * A rename contributes a removal AND an addition. The removal is `carried`
 * via `renamed`; the addition is excluded from `added_without_default`,
 * because the old value is what arrives there and a default would never be
 * consulted.
 */
export function classifySettingsDelta(oldS: ReleasedSurface, newS: ReleasedSurface): SettingsDeltaFindings {
    const delta = computeSurfaceDelta(oldS, newS);
    const removedMap = new Set(newS.removedKeys);
    const renamedMap = new Map(newS.renamedKeys);
    const renameTargets = new Set(newS.renamedKeys.map(([, to]) => to));

    const findings: SettingsDeltaFindings = {
        untombstoned_removals: [],
        carried_removals: [],
        type_changed: [],
        enum_removed: [],
        added_without_default: [],
    };
    for (const c of delta.changes) {
        if (c.kind === 'removed') {
            const to = renamedMap.get(c.key);
            if (to !== undefined) findings.carried_removals.push({ key: c.key, via: 'renamed', to });
            else if (removedMap.has(c.key)) findings.carried_removals.push({ key: c.key, via: 'removed' });
            else findings.untombstoned_removals.push(c.key);
        } else if (c.kind === 'type_changed') {
            findings.type_changed.push(c.key);
        } else if (c.kind === 'enum_removed') {
            findings.enum_removed.push({ key: c.key, values: c.values ?? [] });
        } else if (c.kind === 'added') {
            if (c.new?.default === undefined && !renameTargets.has(c.key)) {
                findings.added_without_default.push(c.key);
            }
        }
    }
    return findings;
}

/** The four refusing classes, as `label: keys` lines. Empty when the cut is clean. */
export function refusalLines(f: SettingsDeltaFindings): string[] {
    const out: string[] = [];
    if (f.untombstoned_removals.length > 0) {
        out.push(
            `removed with no entry in REMOVED_KEYS or RENAMED_KEYS: ${f.untombstoned_removals.join(', ')}`,
        );
    }
    if (f.type_changed.length > 0) out.push(`type changed: ${f.type_changed.join(', ')}`);
    if (f.enum_removed.length > 0) {
        out.push(
            `vocabulary value removed: ${f.enum_removed
                .map((e) => `${e.key} (${e.values.join(', ')})`)
                .join(', ')}`,
        );
    }
    if (f.added_without_default.length > 0) {
        out.push(`added with no default: ${f.added_without_default.join(', ')}`);
    }
    return out;
}

/** The non-refusing line a cut still reports, so a carried removal is never silent. */
export function carriedLine(f: SettingsDeltaFindings): string | null {
    if (f.carried_removals.length === 0) return null;
    return `carried removals (annotated, not refused): ${f.carried_removals
        .map((r) => (r.to === undefined ? r.key : `${r.key} -> ${r.to}`))
        .join(', ')}`;
}

/** True when `target` raises the major component of `from`. */
export function isMajorBump(from: string, target: string): boolean {
    const major = (v: string): number => Number.parseInt(v.replace(/^v/, '').split('.')[0] ?? '', 10);
    return major(target) > major(from);
}

/**
 * Does a `<test file>::<it title>` proof name a test this tree contains?
 * The file must hold an `it(` or `test(` whose quoted title starts with the one
 * named — not the string in a comment, and not a `.skip` or `.todo` test.
 * Whether that test PASSES is not checked: a cut does not run the suite, and
 * the test itself is what carries the claim.
 */
export function proofHolds(proof: string | undefined, root: string = REPO_ROOT): boolean {
    if (proof === undefined) return false;
    const sep = proof.indexOf('::');
    if (sep <= 0) return false;
    const file = path.join(root, proof.slice(0, sep));
    const title = proof.slice(sep + 2).trim();
    if (title === '' || !fs.existsSync(file)) return false;
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![.\\w])(?:it|test)\\s*\\(\\s*['"\`]${escaped}`).test(fs.readFileSync(file, 'utf8'));
}

/**
 * The owner's answer to blocker `what-a-minor-may-remove`, option (c), applied
 * at the cut: {@link SETTINGS_REMOVAL_RULE}. Below a major this refuses a
 * carried removal or rename whose key has no proof that holds in
 * `MINOR_REMOVAL_PROOFS`, and an alias dropped from `RENAMED_KEYS`. At a major
 * it returns nothing — a carried removal is still reported by
 * {@link carriedLine}, never silent.
 */
export function belowMajorRefusalLines(
    released: ReleasedSurface,
    live: ReleasedSurface,
    f: SettingsDeltaFindings,
    target: string,
    proofs: ReadonlyMap<string, string> = MINOR_REMOVAL_PROOFS,
    root: string = REPO_ROOT,
): string[] {
    if (isMajorBump(released.version, target)) return [];
    const out: string[] = [];
    const unproven = f.carried_removals.map((r) => r.key).filter((k) => !proofHolds(proofs.get(k), root));
    if (unproven.length > 0) {
        out.push(`removed or renamed below a major with no consumer-neutral proof: ${unproven.join(', ')}`);
    }
    const kept = new Set(live.renamedKeys.map(([from]) => from));
    const dropped = released.renamedKeys.map(([from]) => from).filter((k) => !kept.has(k));
    if (dropped.length > 0) out.push(`rename alias dropped below a major: ${dropped.join(', ')}`);
    return out;
}

/**
 * The third assertion beside `assert_scheduled_deprecations_clear` and
 * `assert_major_migration_section`: refuse a cut whose settings surface moved
 * in a way no consumer was told about.
 *
 * @param emit Seam for the live surface. Production passes nothing; tests
 * inject a planted surface, because the alternative — reaching the refusal
 * only by editing the tracked zod schema — would make every refusal branch
 * testable exclusively through a tracked-file edit.
 */
export function assert_settings_surface_delta(
    target: string,
    opts: {
        previewOnly?: boolean;
        emit?: (version: string) => ReleasedSurface;
        read?: () => ReleasedSurface;
        write?: (line: string) => void;
        proofs?: ReadonlyMap<string, string>;
    } = {},
): SettingsDeltaFindings | null {
    const write = opts.write ?? ((line: string): void => void process.stderr.write(line));
    let released: ReleasedSurface;
    try {
        released = (opts.read ?? readReleasedSurface)();
    } catch (e) {
        // A missing or unreadable file is an environment failure, not a
        // finding: diagnosing it as "a key was removed" sends the releaser to
        // edit a schema that is not the problem.
        die(
            `refusing the ${target} cut: ${SETTINGS_SURFACE_FIXTURE_REL} could not be read ` +
                `(${e instanceof Error ? e.message : String(e)}). That is an environment failure, not a ` +
                'settings change — restore the file from the last release, then re-run.',
        );
        return null;
    }
    const live = (opts.emit ?? emitReleasedSurface)(target);
    const findings = classifySettingsDelta(released, live);

    const carried = carriedLine(findings);
    if (carried !== null) write(`settings surface ${released.version} → ${target}: ${carried}\n`);

    const lines = [
        ...refusalLines(findings),
        ...belowMajorRefusalLines(released, live, findings, target, opts.proofs ?? MINOR_REMOVAL_PROOFS),
    ];
    if (lines.length === 0) return findings;

    write(`settings surface ${released.version} → ${target}:\n`);
    for (const l of lines) write(`  - ${l}\n`);
    if (opts.previewOnly === true) {
        write(
            `\n(dry-run) the ${target} cut WOULD BE REFUSED for the reason above. ` +
                'Previewing only; exit code unchanged.\n',
        );
        return findings;
    }
    die(
        `refusing the ${target} cut: the settings surface changed in a way no consumer is told ` +
            'about. Act on each line above — add the key to REMOVED_KEYS or RENAMED_KEYS, revert the ' +
            'type or vocabulary change, or give the new key a default; below a major, name the proving ' +
            `test in MINOR_REMOVAL_PROOFS or cut a major — then re-run. ${SETTINGS_REMOVAL_RULE}`,
    );
    return findings;
}

/**
 * Disagreements between the delta an installed upgrade WROTE and the one the
 * release COMPUTES for the same version pair. Empty means they agree.
 *
 * Three kinds only — `removed`, `type_changed`, `enum_removed`. The other
 * three are deliberately out: `added` and `default_changed` are the review
 * form's business and neither refuses a cut, and `enum_added` widens a
 * vocabulary, which no installed value can be invalid under.
 *
 * The comparison is the point of the leg: the release reads a COMMITTED file
 * and the installer recomputes the surface from SHIPPED bytes, so an
 * agreement is evidence the committed file describes what was actually
 * published, and a disagreement means it does not.
 */
export function compareInstallerDelta(
    installer: InstallerDelta,
    release: SettingsDeltaFindings,
): string[] {
    const out: string[] = [];
    const seen = (kind: string): string[] =>
        installer.changes
            .filter((c) => c.kind === kind)
            .map((c) => c.key)
            .sort();

    const releaseRemoved = [
        ...release.untombstoned_removals,
        ...release.carried_removals.map((r) => r.key),
    ].sort();
    const pairs: Array<[string, string[], string[]]> = [
        ['removed', seen('removed'), releaseRemoved],
        ['type_changed', seen('type_changed'), [...release.type_changed].sort()],
        ['enum_removed', seen('enum_removed'), release.enum_removed.map((e) => e.key).sort()],
    ];
    for (const [kind, installed, computed] of pairs) {
        if (installed.join('\u0000') === computed.join('\u0000')) continue;
        out.push(
            `${kind}: installer wrote [${installed.join(', ')}], the release computes ` +
                `[${computed.join(', ')}]`,
        );
    }
    // Per-key values for the one kind that carries them: a vocabulary that
    // lost DIFFERENT values on the two sides is the same disagreement as one
    // that lost them on only one side.
    const installedVals = new Map(
        installer.changes
            .filter((c) => c.kind === 'enum_removed')
            .map((c) => [c.key, [...(c.values ?? [])].sort()] as const),
    );
    for (const e of release.enum_removed) {
        const theirs = installedVals.get(e.key);
        if (theirs === undefined) continue;
        const ours = [...e.values].sort();
        if (theirs.join('\u0000') === ours.join('\u0000')) continue;
        out.push(
            `enum_removed ${e.key}: installer wrote [${theirs.join(', ')}], the release computes ` +
                `[${ours.join(', ')}]`,
        );
    }
    return out;
}
