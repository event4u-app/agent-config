/**
 * Skill reach for `agent-config doctor --check skill-reach`.
 *
 * `road-to-skills-that-arrive-when-called` 2.2 and 2.3. Every authored skill
 * lands in exactly one of six buckets on the first host, and the six sum to the
 * authored count — a silent subset is a number that does not add up, not a
 * feeling. The partition was set by an AI council on 2026-10-18 (both seats):
 *
 *   installed, by listing state (in the host root, `~/.claude/skills`):
 *     described     listed with its description
 *     name-only     listed by name only (`skillOverrides: name-only`)
 *     unlisted      installed but kept off the model listing (`off`,
 *                   `user-invocable-only`)
 *   not installed, by the BEST available path:
 *     reachable-not-installed   a path carries every declared property the host
 *                               would have applied
 *     degraded                  a path exists, and every one drops at least one
 *     unreachable               no path exists
 *
 * `installed` is printed as the subtotal of the first three, never as a seventh
 * bucket.
 *
 * WHAT "DROPS" MEANS — 2.3, "degraded is never called reach". Two paths exist:
 *
 *   shell  `route:explain --skills` ranks the installed package's projection and
 *          the agent reads that SKILL.md as text. Everything reaches the model as
 *          text, but a key the HOST applies (allowed-tools, model, effort, context,
 *          user-invocable, ...) is not applied by anyone. A skill declaring one is
 *          degraded on this path.
 *   mcp    the MCP read carries only `CARRIED_KEYS` whole; any other declared key
 *          is dropped (`semantic-parity-census`).
 *
 * The host-applied set is the host's own documented key list
 * (`src/config/host-skill-frontmatter-keys.json`) minus the keys that only
 * describe a skill and change nothing about how it runs.
 *
 * A report, never a refusal: the check returns `warn` only when the buckets fail
 * to sum, which would be this module's defect, not the install's.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { CARRIED_KEYS } from './body_portable.js';
import { resolvePackageRoot } from './package_root.js';
import type { WiringCheck } from './runtime_wiring_checks.js';

export const REACH_BUCKETS = [
    'described',
    'name-only',
    'unlisted',
    'reachable-not-installed',
    'degraded',
    'unreachable',
] as const;
export type ReachBucket = (typeof REACH_BUCKETS)[number];

/** Host keys that describe a skill; reading them as text loses nothing. */
const DESCRIPTIVE_HOST_KEYS: ReadonlySet<string> = new Set([
    'name',
    'description',
    'when_to_use',
    'argument-hint',
    'arguments',
    'license',
    'metadata',
    'compatibility',
]);

export interface SkillReachInput {
    /** Top-level frontmatter keys the projected SKILL.md declares. */
    keys: readonly string[];
    installed: boolean;
    /** The host's `skillOverrides` value for this name, when one is set. */
    override?: string;
}

export interface ReachPaths {
    shell: boolean;
    mcp: boolean;
}

/** Keys of `keys` the host applies and a text read therefore leaves unapplied. */
export function hostAppliedKeys(keys: readonly string[], hostKeys: ReadonlySet<string>): string[] {
    return keys.filter((k) => hostKeys.has(k) && !DESCRIPTIVE_HOST_KEYS.has(k));
}

/** One skill, one bucket. Pure; the caller supplies every observation. */
export function classifySkillReach(
    s: SkillReachInput,
    paths: ReachPaths,
    hostKeys: ReadonlySet<string>,
): ReachBucket {
    if (s.installed) {
        if (s.override === 'name-only') return 'name-only';
        if (s.override === 'off' || s.override === 'user-invocable-only') return 'unlisted';
        return 'described';
    }
    if (paths.shell && hostAppliedKeys(s.keys, hostKeys).length === 0) return 'reachable-not-installed';
    if (paths.mcp && s.keys.every((k) => CARRIED_KEYS.includes(k))) return 'reachable-not-installed';
    if (paths.shell || paths.mcp) return 'degraded';
    return 'unreachable';
}

/** Top-level keys of a markdown file's frontmatter block, in order. */
export function frontmatterKeys(text: string): string[] {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (m === null) return [];
    const out: string[] = [];
    for (const line of (m[1] as string).split(/\r?\n/)) {
        const k = /^([A-Za-z_][\w-]*):/.exec(line);
        if (k !== null) out.push(k[1] as string);
    }
    return out;
}

/** The first host's documented skill keys, from the committed key list. */
export function loadHostKeys(packageRoot: string, host = 'claude-code'): Set<string> {
    const file = path.join(packageRoot, 'src', 'config', 'host-skill-frontmatter-keys.json');
    const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as { hosts: Array<{ host: string; keys: string[] }> };
    return new Set(data.hosts.find((h) => h.host === host)?.keys ?? []);
}

function skillNames(root: string): string[] {
    try {
        return fs
            .readdirSync(root)
            .filter((n) => fs.existsSync(path.join(root, n, 'SKILL.md')))
            .sort();
    } catch {
        return [];
    }
}

function readOverrides(settingsPath: string): Record<string, string> {
    try {
        const data = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
        const v = data['skillOverrides'];
        if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
        const out: Record<string, string> = {};
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
            if (typeof val === 'string') out[k] = val;
        }
        return out;
    } catch {
        return {};
    }
}

export interface ReachCensus {
    authored: number;
    counts: Record<ReachBucket, number>;
    installed: number;
    sums: boolean;
}

/**
 * Partition the projection at `projectionRoot` against the host root and the
 * host settings file. `paths.shell` is true whenever the projection is readable:
 * the shell search path ranks exactly that tree.
 */
export function reachCensus(opts: {
    projectionRoot: string;
    hostRoot: string;
    settingsPath: string;
    hostKeys: ReadonlySet<string>;
    mcp: boolean;
    /**
     * The host's listing override for one name, when the host does not keep it
     * in a settings file.
     *
     * The first host writes `skillOverrides` into its settings; the second host
     * has no such setting and a skill leaves its listing by carrying a policy
     * file instead (4.1). Same bucket, different place to look — so the LOOKUP
     * is the seam, not a second census.
     */
    overrideOf?: (name: string) => string | undefined;
}): ReachCensus {
    const authoredNames = skillNames(opts.projectionRoot);
    const installed = new Set(skillNames(opts.hostRoot));
    const overrides = opts.overrideOf ? {} : readOverrides(opts.settingsPath);
    const paths: ReachPaths = { shell: authoredNames.length > 0, mcp: opts.mcp };
    const counts = Object.fromEntries(REACH_BUCKETS.map((b) => [b, 0])) as Record<ReachBucket, number>;
    for (const name of authoredNames) {
        const text = fs.readFileSync(path.join(opts.projectionRoot, name, 'SKILL.md'), 'utf-8');
        const input: SkillReachInput = { keys: frontmatterKeys(text), installed: installed.has(name) };
        const ov = opts.overrideOf ? opts.overrideOf(name) : overrides[name];
        if (ov !== undefined) input.override = ov;
        counts[classifySkillReach(input, paths, opts.hostKeys)] += 1;
    }
    const total = REACH_BUCKETS.reduce((n, b) => n + counts[b], 0);
    return {
        authored: authoredNames.length,
        counts,
        installed: counts.described + counts['name-only'] + counts.unlisted,
        sums: total === authoredNames.length,
    };
}

export function renderReach(c: ReachCensus, hostRootLabel: string, host = 'claude-code'): string {
    return (
        `${host} (${hostRootLabel}): installed ${c.installed} (described ${c.counts.described} · ` +
        `name-only ${c.counts['name-only']} · unlisted ${c.counts.unlisted}) · ` +
        `reachable-not-installed ${c.counts['reachable-not-installed']} · degraded ${c.counts.degraded} · ` +
        `unreachable ${c.counts.unreachable} — of ${c.authored} authored`
    );
}

/** The doctor check. `home` and `packageRoot` are seams for tests. */
export function checkSkillReach(
    opts: { home?: string; packageRoot?: string; mcp?: boolean } = {},
): WiringCheck {
    const id = 'skill-reach';
    const packageRoot = opts.packageRoot ?? resolvePackageRoot(import.meta.url);
    const home = opts.home ?? os.homedir();
    const projectionRoot = path.join(packageRoot, 'dist', 'agent-src', 'skills');
    if (skillNames(projectionRoot).length === 0) {
        return { id, status: 'skipped', message: `no skill projection at ${projectionRoot}`, remedy: '' };
    }
    const hostKeys = loadHostKeys(packageRoot);
    const mcp = opts.mcp ?? false;

    // AC-1 reads "every host with native skills", so the check reports a row
    // per such host rather than one row for the first one. The second host
    // appears only once something is installed there: a row of zeros for a host
    // nobody installed would read as a finding.
    const rows: Array<{ host: string; label: string; c: ReachCensus }> = [];
    rows.push({
        host: 'claude-code',
        label: '~/.claude/skills',
        c: reachCensus({
            projectionRoot,
            hostRoot: path.join(home, '.claude', 'skills'),
            settingsPath: path.join(home, '.claude', 'settings.json'),
            hostKeys,
            mcp,
        }),
    });
    const codexRoot = path.join(home, '.codex', 'skills');
    if (skillNames(codexRoot).length > 0) {
        rows.push({
            host: 'codex',
            label: '~/.codex/skills',
            c: reachCensus({
                projectionRoot,
                hostRoot: codexRoot,
                settingsPath: '',
                hostKeys,
                mcp,
                // 4.1: a skill outside the resident set carries a policy file
                // that takes it out of the listing. `off` is the bucket's own
                // vocabulary — installed and not listed.
                //
                // `unlisted` is the GENEROUS reading here and it is not
                // settled: 5.2's S3 asked a session to invoke a non-resident
                // skill by name and got `UNAVAILABLE` with no tool call, and
                // the control that would separate "the host refuses" from "the
                // model never saw it and did not try" was lost to a rate limit.
                // Open as `second-host-unlisted-reachability`. Counting these
                // `unreachable` on a one-armed reading would be over-claiming
                // in the other direction, so the bucket stays and says so.
                overrideOf: (name) =>
                    fs.existsSync(path.join(codexRoot, name, 'agents', 'openai.yaml')) ? 'off' : undefined,
            }),
        });
    }

    const message = rows.map((r) => renderReach(r.c, r.label, r.host)).join('; ');
    const notSumming = rows.filter((r) => !r.c.sums).map((r) => r.host);
    if (notSumming.length > 0) {
        return {
            id,
            status: 'warn',
            message: `${message} — the buckets do not sum for ${notSumming.join(', ')}`,
            remedy: 'report this as a defect',
        };
    }
    // AC-1's own condition, as a verdict rather than as a number a reader has
    // to notice: a skill no path reaches on a host that has native skills is
    // the defect this whole roadmap is about.
    const unreachable = rows.filter((r) => r.c.counts.unreachable > 0).map((r) => r.host);
    if (unreachable.length > 0) {
        return {
            id,
            status: 'warn',
            message: `${message} — unreachable skills on ${unreachable.join(', ')}`,
            remedy: 'install the skill, or give the host a retrieval path that carries its declared keys',
        };
    }
    return {
        id,
        status: 'ok',
        message,
        remedy: rows.some((r) => r.c.counts.degraded > 0)
            ? 'a degraded skill is reachable as text only; the host keys it declares are not applied'
            : '',
    };
}
