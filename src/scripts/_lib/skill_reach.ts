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
}): ReachCensus {
    const authoredNames = skillNames(opts.projectionRoot);
    const installed = new Set(skillNames(opts.hostRoot));
    const overrides = readOverrides(opts.settingsPath);
    const paths: ReachPaths = { shell: authoredNames.length > 0, mcp: opts.mcp };
    const counts = Object.fromEntries(REACH_BUCKETS.map((b) => [b, 0])) as Record<ReachBucket, number>;
    for (const name of authoredNames) {
        const text = fs.readFileSync(path.join(opts.projectionRoot, name, 'SKILL.md'), 'utf-8');
        const input: SkillReachInput = { keys: frontmatterKeys(text), installed: installed.has(name) };
        const ov = overrides[name];
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

export function renderReach(c: ReachCensus, hostRootLabel: string): string {
    return (
        `claude-code (${hostRootLabel}): installed ${c.installed} (described ${c.counts.described} · ` +
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
    const c = reachCensus({
        projectionRoot,
        hostRoot: path.join(home, '.claude', 'skills'),
        settingsPath: path.join(home, '.claude', 'settings.json'),
        hostKeys: loadHostKeys(packageRoot),
        mcp: opts.mcp ?? false,
    });
    const message = renderReach(c, '~/.claude/skills');
    if (!c.sums) {
        return { id, status: 'warn', message: `${message} — the buckets do not sum`, remedy: 'report this as a defect' };
    }
    return {
        id,
        status: 'ok',
        message,
        remedy:
            c.counts.degraded > 0
                ? 'a degraded skill is reachable as text only; the host keys it declares are not applied'
                : '',
    };
}
