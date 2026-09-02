/**
 * The equivalence-preserving pin for the metered-proposer experiment's subject.
 *
 * The experiment enumerates its corpus from `.claude/rules/`, which is a
 * GENERATED projection and is gitignored in its entirety. Two consequences,
 * both measured rather than argued: the same commit yields a different corpus
 * on two machines, and the generator SKIPS any rule already installed
 * byte-identically at user scope, so the corpus is a function of the operator's
 * home directory as well as of the commit. A recorded commit therefore does not
 * pin the subject, and a comparison against a subject nobody can reconstruct is
 * not comparable to anything.
 *
 * What this module pins instead is the whole of what decides the projection:
 * the commit, the generator's own bytes, the ordered subject inventory with
 * hashes and provenance, the included and excluded paths, every user-scope file
 * capable of causing a skip, the generator configuration and the non-secret
 * environment values it reads, the runtime and platform facts, and the produced
 * file inventory. {@link subjectDigest} folds the subject half into one value,
 * so two runs are comparable exactly when that value matches.
 *
 * The manifest is a CAPTURE, never a plan. It records the tree as it stands;
 * whether a clean checkout reproduces it is the question {@link diffManifests}
 * answers, and answering it requires actually regenerating in that checkout. A
 * module that predicted the projection instead of reading it would be asserting
 * the very equivalence it exists to test.
 *
 * PRIVACY. User-scope paths are recorded home-relative, so no account name
 * leaves the machine, and only file hashes are stored — never content. The
 * environment capture is a closed allowlist of non-secret keys rather than a
 * filtered dump, because a filter is a list of what somebody remembered to
 * exclude.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
    globalRuleLayerNames,
    globalRuleLayerPath,
    hostLayerCarries,
    toolIdForProjectRuleDir,
} from '../../install/globalRuleLayers.js';
import { isExclusivelyPackageOnly, partitionActive } from '../../install/partitionEligibility.js';
import { dedupableRules } from '../../install/ruleLayerPartition.js';

export const CORPUS_MANIFEST_VERSION = 'corpus-manifest-v1';

/** The tool directory the experiment's corpus is enumerated from. */
export const CORPUS_TOOL_DIR = '.claude/rules';

/** Where a projected rule's bytes come from, and what the dedup compares against. */
export const PROJECTION_SOURCE_DIR = path.join('dist', 'agent-src', 'rules');

/**
 * The files whose bytes decide the projection, so a manifest can say WHICH
 * generator produced it. Hashing the generator is the difference between "the
 * corpus differs" and "the corpus differs because the generator changed".
 */
export const GENERATOR_MODULES: readonly string[] = [
    path.join('src', 'scripts', 'condense.ts'),
    path.join('src', 'install', 'ruleLayerPartition.ts'),
    path.join('src', 'install', 'claudePathsPlan.ts'),
];

/**
 * Non-secret environment keys the projection actually reads.
 *
 * A closed list, and `HOME` is deliberately absent: it decides the dedup, but
 * its VALUE is an account name. The dedup evidence is carried by the
 * user-scope hash table instead, which says what was found without saying who
 * owns it.
 */
export const CAPTURED_ENV_KEYS: readonly string[] = [
    'AGENT_CONFIG_DEV_MODE',
    'AGENT_CONFIG_SCOPE',
    'AGENT_CONFIG_PROJECTION_MODE',
];

export class CorpusManifestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CorpusManifestError';
    }
}

export interface SubjectEntry {
    /** Repo-relative path of the projected file the experiment mutates. */
    readonly path: string;
    readonly sha256: string;
    readonly bytes: number;
    /** The projection source this file was emitted from, repo-relative. */
    readonly provenance: string;
    /** Hash of that source, or `null` when it is absent from this tree. */
    readonly provenance_sha256: string | null;
}

export interface ExcludedEntry {
    readonly path: string;
    readonly why: string;
}

export interface UserScopeTwin {
    /** Home-relative, never absolute: the account name is not evidence. */
    readonly path: string;
    readonly sha256: string;
    /** True when this twin is byte-identical to the source and therefore skips. */
    readonly causes_skip: boolean;
}

/**
 * The evidence that decides which rules reach the corpus directory at all.
 *
 * This block exists because the byte-identity table below accounts for NONE of
 * the skips actually observed. Measured on a freshly generated tree: the
 * generator reported 101 rules skipped and the byte-identity comparison
 * returned zero, because `projection.scope_dedup` is absent on every layer this
 * repository carries and therefore off. The real mechanism is the per-host rule
 * partition, which withholds a rule when this host's GLOBAL layer is verified
 * to carry its NAME. So the field a recorded commit cannot supply is the global
 * layer's name inventory, and a manifest that pinned only byte-identical twins
 * would have missed every skip that happened.
 */
export interface ProjectionDecision {
    /** Whether the per-host partition is active at all, read from the lockfile. */
    readonly partition_active: boolean;
    readonly tool_id: string | null;
    /** The global layer directory, home-relative; `null` when this host has none. */
    readonly layer_dir: string | null;
    readonly carries: boolean;
    readonly reason: string;
    /** Names the partition would withhold that the global layer does not carry. */
    readonly missing: readonly string[];
    /**
     * Rules classified exclusively package-only, and therefore never withheld.
     *
     * Counted over every rule in the projection source, which is a SUPERSET of
     * what the generator classifies: the generator filters by workspace scope
     * and by manual type first. So this number is an explanatory input and is
     * not the produced count. Measured on one tree: 15 here against 13 files
     * actually produced. `produced` is the authoritative inventory.
     */
    readonly package_only_count: number;
    /** The global layer inventory, with hashes: names decide, hashes explain. */
    readonly layer_inventory: readonly { readonly name: string; readonly sha256: string | null }[];
    /** Folds the inventory into one comparable value. */
    readonly layer_digest: string;
}

export interface CorpusManifest {
    readonly version: typeof CORPUS_MANIFEST_VERSION;
    readonly commit: string | null;
    /** True when the working tree carries uncommitted changes at capture time. */
    readonly tree_dirty: boolean;
    readonly package_version: string | null;
    readonly generator: readonly { readonly path: string; readonly sha256: string | null }[];
    /** The enumeration rule this manifest was captured under, by id. */
    readonly enumeration_rule: string;
    readonly included: readonly SubjectEntry[];
    readonly excluded: readonly ExcludedEntry[];
    readonly user_scope: readonly UserScopeTwin[];
    readonly projection: ProjectionDecision;
    readonly generator_config: Readonly<Record<string, string | null>>;
    readonly runtime: {
        readonly node: string;
        readonly platform: string;
        readonly arch: string;
    };
    /** Every file the projection produced in the corpus directory, with hashes. */
    readonly produced: readonly { readonly path: string; readonly sha256: string }[];
    /** Folds the subject half into one comparable value. */
    readonly subject_digest: string;
}

export function sha256OfFile(abs: string): string | null {
    try {
        return createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    } catch {
        return null;
    }
}

function sha256OfString(s: string): string {
    return createHash('sha256').update(s, 'utf-8').digest('hex');
}

/** Byte-wise, locale-independent order. Never `localeCompare`. */
function byteCompare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function git(root: string, args: readonly string[]): string | null {
    const r = spawnSync('git', [...args], { cwd: root, encoding: 'utf-8' });
    if (r.status !== 0 || typeof r.stdout !== 'string') return null;
    return r.stdout.trim();
}

/**
 * The corpus enumeration, executable rather than prose.
 *
 * Until now the rule lived only in the protocol document, so nothing could
 * check that a capture had followed it. The four clauses are: every `*.md`
 * directly under the corpus directory, sorted byte-wise by filename, the first
 * `limit` of them, and the rest recorded as excluded with the reason. Reading
 * the directory here rather than predicting it is deliberate: what the
 * experiment mutates is what is on disk.
 */
export function enumerateCorpus(
    repoRoot: string,
    limit: number,
): { included: string[]; excluded: ExcludedEntry[] } {
    const dir = path.join(repoRoot, CORPUS_TOOL_DIR);
    let names: string[];
    try {
        names = fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isFile() || d.isSymbolicLink())
            .map((d) => d.name)
            .filter((n) => n.endsWith('.md'));
    } catch {
        throw new CorpusManifestError(
            `${CORPUS_TOOL_DIR} does not exist in ${repoRoot} — the corpus is a generated ` +
                'projection, so a capture before generation would pin an empty subject and ' +
                'read as a successful pin of nothing',
        );
    }
    names.sort(byteCompare);
    const included = names.slice(0, limit);
    const excluded = names.slice(limit).map((n) => ({
        path: path.posix.join(CORPUS_TOOL_DIR, n),
        why: `beyond the first ${String(limit)} in byte order`,
    }));
    return { included: included.map((n) => path.posix.join(CORPUS_TOOL_DIR, n)), excluded };
}

/**
 * Every user-scope file that can suppress a rule at project scope, with hashes.
 *
 * This is the field a recorded commit cannot supply and the one that made the
 * subject irreproducible. `causes_skip` replays the generator's own comparison
 * — byte-identity against the projection source — rather than re-implementing
 * a judgement about it, so a manifest and a generation cannot disagree about
 * what a skip is.
 */
export function captureUserScope(repoRoot: string, userHome: string): UserScopeTwin[] {
    const sourceDir = path.join(repoRoot, PROJECTION_SOURCE_DIR);
    let names: string[] = [];
    try {
        names = fs
            .readdirSync(sourceDir)
            .filter((n) => n.endsWith('.md'))
            .sort(byteCompare);
    } catch {
        return [];
    }
    const skip = dedupableRules({
        toolDir: CORPUS_TOOL_DIR,
        rules: names,
        userHome,
        rulesSource: sourceDir,
    });
    const out: UserScopeTwin[] = [];
    for (const n of names) {
        const rel = path.posix.join('.claude', 'rules', n);
        const hash = sha256OfFile(path.join(userHome, '.claude', 'rules', n));
        if (hash === null) continue;
        out.push({ path: rel, sha256: hash, causes_skip: skip.has(n) });
    }
    return out;
}

/**
 * Capture the partition evidence, reading the same predicates the generator
 * reads rather than a re-implementation of them.
 *
 * `hostLayerCarries` decides on NAME presence, not on content, so the names are
 * what pin the corpus and the hashes are recorded alongside only to explain a
 * difference. Recording the hashes without the names would have been the wrong
 * half: two layers holding the same names with different bytes produce the same
 * corpus.
 */
export function captureProjectionDecision(repoRoot: string, userHome: string): ProjectionDecision {
    const sourceDir = path.join(repoRoot, PROJECTION_SOURCE_DIR);
    let names: string[] = [];
    try {
        names = fs
            .readdirSync(sourceDir)
            .filter((n) => n.endsWith('.md'))
            .sort(byteCompare);
    } catch {
        names = [];
    }
    const toolId = toolIdForProjectRuleDir(CORPUS_TOOL_DIR);
    const packageOnly = names.filter((n) => isExclusivelyPackageOnly(path.join(sourceDir, n)));
    const keep = new Set(packageOnly);
    const withheld = names.filter((n) => !keep.has(n));
    const verdict =
        toolId === null
            ? { carries: false, layerPath: null, missing: withheld, reason: 'no-layer-for-host' }
            : hostLayerCarries(toolId, withheld, userHome);
    const layerNames = toolId === null ? null : globalRuleLayerNames(toolId, userHome);
    const layerPath = toolId === null ? null : globalRuleLayerPath(toolId, userHome);
    const inventory = (layerNames ?? [])
        .slice()
        .sort(byteCompare)
        .map((n) => ({
            name: n,
            sha256: layerPath === null ? null : sha256OfFile(path.join(layerPath, n)),
        }));
    return {
        partition_active: partitionActive(repoRoot),
        tool_id: toolId,
        layer_dir: layerPath === null ? null : homeRelative(layerPath, userHome),
        carries: verdict.carries,
        reason: verdict.reason,
        missing: [...verdict.missing].sort(byteCompare),
        package_only_count: packageOnly.length,
        layer_inventory: inventory,
        layer_digest: sha256OfString(inventory.map((e) => `${e.name} ${String(e.sha256)}`).join('\n')),
    };
}

/**
 * A path with the home prefix replaced, so no account name is captured.
 *
 * Falls back to the basename rather than to the absolute path when the prefix
 * does not match: a fallback that leaked the full path would defeat the whole
 * point on exactly the machines where the home layout is unusual.
 */
export function homeRelative(abs: string, userHome: string): string {
    const rel = path.relative(userHome, abs);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        return path.basename(abs);
    }
    return rel.split(path.sep).join('/');
}

/**
 * The one value two runs compare on.
 *
 * Folds the ordered subject inventory and the enumeration rule, and nothing
 * else. The commit, the runtime and the user-scope table are all EXPLANATIONS
 * of a difference and must not be inside the value that detects one — a digest
 * that changed when the node version changed would report a subject change on
 * every upgrade, and a reader would stop believing it.
 */
export function subjectDigest(
    enumerationRule: string,
    included: readonly SubjectEntry[],
): string {
    const body = [enumerationRule, ...included.map((e) => `${e.path} ${e.sha256}`)].join('\n');
    return sha256OfString(body);
}

export interface CaptureOptions {
    readonly repoRoot: string;
    readonly userHome: string;
    readonly limit: number;
    readonly enumerationRule: string;
    readonly env?: Readonly<Record<string, string | undefined>> | undefined;
}

export function captureManifest(opts: CaptureOptions): CorpusManifest {
    const { repoRoot, userHome, limit, enumerationRule } = opts;
    const env = opts.env ?? process.env;
    const { included: paths, excluded } = enumerateCorpus(repoRoot, limit);

    const included: SubjectEntry[] = paths.map((rel) => {
        const abs = path.join(repoRoot, rel);
        const hash = sha256OfFile(abs);
        if (hash === null) {
            throw new CorpusManifestError(`corpus member '${rel}' vanished between listing and read`);
        }
        const base = path.basename(rel);
        const provenance = path.posix.join('dist', 'agent-src', 'rules', base);
        return {
            path: rel,
            sha256: hash,
            bytes: fs.statSync(abs).size,
            provenance,
            provenance_sha256: sha256OfFile(path.join(repoRoot, provenance)),
        };
    });

    let produced: { path: string; sha256: string }[] = [];
    try {
        produced = fs
            .readdirSync(path.join(repoRoot, CORPUS_TOOL_DIR))
            .filter((n) => n.endsWith('.md'))
            .sort(byteCompare)
            .map((n) => ({
                path: path.posix.join(CORPUS_TOOL_DIR, n),
                sha256: sha256OfFile(path.join(repoRoot, CORPUS_TOOL_DIR, n)) ?? '',
            }));
    } catch {
        produced = [];
    }

    const generatorConfig: Record<string, string | null> = {};
    for (const k of CAPTURED_ENV_KEYS) {
        generatorConfig[k] = env[k] ?? null;
    }
    generatorConfig['projection.scope_dedup'] = readScopeDedup(repoRoot);

    let packageVersion: string | null = null;
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8')) as {
            version?: unknown;
        };
        packageVersion = typeof pkg.version === 'string' ? pkg.version : null;
    } catch {
        packageVersion = null;
    }

    const status = git(repoRoot, ['status', '--porcelain']);

    return {
        version: CORPUS_MANIFEST_VERSION,
        commit: git(repoRoot, ['rev-parse', 'HEAD']),
        tree_dirty: status === null ? true : status !== '',
        package_version: packageVersion,
        generator: GENERATOR_MODULES.map((rel) => ({
            path: rel,
            sha256: sha256OfFile(path.join(repoRoot, rel)),
        })),
        enumeration_rule: enumerationRule,
        included,
        excluded,
        user_scope: captureUserScope(repoRoot, userHome),
        projection: captureProjectionDecision(repoRoot, userHome),
        generator_config: generatorConfig,
        runtime: { node: process.version, platform: os.platform(), arch: os.arch() },
        produced,
        subject_digest: subjectDigest(enumerationRule, included),
    };
}

/**
 * The generator setting that decides whether user-scope dedup runs at all.
 *
 * Read as raw text rather than through the settings resolver, because a
 * manifest must record what the file SAID at capture time; a resolver applies a
 * cascade whose upper layers are not in this repository and would silently
 * substitute one machine's answer for another's.
 */
export function readScopeDedup(repoRoot: string): string | null {
    for (const rel of ['.agent-settings.yml', path.join('src', 'config', 'agent-settings.template.yml')]) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(repoRoot, rel), 'utf-8');
        } catch {
            continue;
        }
        const m = /^\s*scope_dedup:\s*(\S+)/m.exec(text);
        if (m) return `${rel}:${m[1] as string}`;
    }
    // Not `null`: absent is a value here, and the reader has to be able to tell
    // it from a read that failed. Absent means the byte-identity dedup is off,
    // which is what makes the partition the only live skip mechanism.
    return 'absent:default-off';
}

export interface ManifestDifference {
    readonly field: string;
    readonly expected: string;
    readonly actual: string;
}

/**
 * The reconstruction check, and it reports EVERY difference rather than the
 * first.
 *
 * Stopping at the first mismatch would let an operator fix one hash, re-run,
 * and meet the next one — a check that reveals its findings one per cycle
 * trains the reader to believe the last one was the last one. The subject
 * differences are listed first because they are the ones that invalidate a
 * comparison; the rest explain why they happened.
 */
export function diffManifests(expected: CorpusManifest, actual: CorpusManifest): ManifestDifference[] {
    const out: ManifestDifference[] = [];
    const push = (field: string, e: unknown, a: unknown): void => {
        if (String(e) !== String(a)) out.push({ field, expected: String(e), actual: String(a) });
    };

    push('subject_digest', expected.subject_digest, actual.subject_digest);
    push('enumeration_rule', expected.enumeration_rule, actual.enumeration_rule);
    push('included.length', expected.included.length, actual.included.length);

    const actualByPath = new Map(actual.included.map((e) => [e.path, e]));
    for (const e of expected.included) {
        const a = actualByPath.get(e.path);
        if (a === undefined) {
            out.push({ field: `included:${e.path}`, expected: e.sha256, actual: 'ABSENT' });
            continue;
        }
        push(`included:${e.path}`, e.sha256, a.sha256);
    }
    const expectedPaths = new Set(expected.included.map((e) => e.path));
    for (const a of actual.included) {
        if (!expectedPaths.has(a.path)) {
            out.push({ field: `included:${a.path}`, expected: 'ABSENT', actual: a.sha256 });
        }
    }

    push('commit', expected.commit, actual.commit);
    push('produced.length', expected.produced.length, actual.produced.length);
    for (const g of expected.generator) {
        const a = actual.generator.find((x) => x.path === g.path);
        // `NO-ROW` rather than a nullish fallback: a generator module absent
        // from the tree hashes to `null`, and folding the two states together
        // reported a difference between two captures that had both recorded the
        // same absence. The states are three, not two, and the third is common.
        push(`generator:${g.path}`, g.sha256, a === undefined ? 'NO-ROW' : a.sha256);
    }
    const expectedSkips = expected.user_scope.filter((t) => t.causes_skip).map((t) => t.path).sort(byteCompare);
    const actualSkips = actual.user_scope.filter((t) => t.causes_skip).map((t) => t.path).sort(byteCompare);
    push('user_scope.skipping', expectedSkips.join(','), actualSkips.join(','));
    // The partition half, which is where the observed skips actually came from.
    // Diffed by digest rather than by name list because the inventory runs to
    // three figures and a diff nobody reads is a diff that does not exist.
    push('projection.partition_active', expected.projection.partition_active, actual.projection.partition_active);
    push('projection.carries', expected.projection.carries, actual.projection.carries);
    push('projection.reason', expected.projection.reason, actual.projection.reason);
    push('projection.layer_digest', expected.projection.layer_digest, actual.projection.layer_digest);
    push(
        'projection.layer_names',
        expected.projection.layer_inventory.map((e) => e.name).join(','),
        actual.projection.layer_inventory.map((e) => e.name).join(','),
    );
    return out;
}

/** Two manifests describe the same experimental subject. Nothing weaker. */
export function subjectsEquivalent(expected: CorpusManifest, actual: CorpusManifest): boolean {
    return (
        expected.subject_digest === actual.subject_digest &&
        expected.enumeration_rule === actual.enumeration_rule
    );
}

export function serialiseManifest(m: CorpusManifest): string {
    return `${JSON.stringify(m, null, 2)}\n`;
}

export function parseManifest(raw: unknown): CorpusManifest {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new CorpusManifestError('a manifest must be a JSON object');
    }
    const o = raw as Record<string, unknown>;
    if (o['version'] !== CORPUS_MANIFEST_VERSION) {
        throw new CorpusManifestError(
            `manifest version ${JSON.stringify(o['version'])} is not ${CORPUS_MANIFEST_VERSION} — ` +
                'a manifest of another shape cannot be compared field-for-field, and comparing it ' +
                'partially would report equivalence from the fields that happened to survive',
        );
    }
    if (typeof o['subject_digest'] !== 'string' || !Array.isArray(o['included'])) {
        throw new CorpusManifestError('manifest is missing subject_digest or included');
    }
    return raw as CorpusManifest;
}
