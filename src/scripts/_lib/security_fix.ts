/**
 * The decidable half of carrying a security finding to a merged, deployed fix
 * (road-to-security-fixes-carried-to-the-merge).
 *
 * Council 2026-10-21 Q5 (2/2): the package-manager mutations stay in the
 * agent's session, where a person sees them; what can be decided without
 * judgement lives here, deterministic and fixture-tested — the route, the
 * smallest fixing change, the runtime file edits, the cooldown and
 * agent-directory checks, the "fixed by the authority's own answer" comparison,
 * the PR body, the release draft, and the lifecycle up to `fixed-deployed`.
 * Nothing here merges, tags, publishes or deploys.
 */

import type { InventoryEntry } from './advisory_inventory.js';
import type { Finding } from './advisory_verdicts.js';
import { compare_versions } from './version_order.js';

// ---------------------------------------------------------------------------
// Where the fix goes (Phase 2)
// ---------------------------------------------------------------------------

export interface RoutingContext {
    /** HEAD is the trunk (or detached on it). */
    onTrunk: boolean;
    /** The working tree has no uncommitted change. */
    clean: boolean;
    /** The current branch already changes the lockfile/manifest the fix touches. */
    branchTouchesFile: boolean;
    /** The current branch introduced the vulnerable dependency. */
    branchIntroducedDependency: boolean;
    /** The user asked for the fix in the current branch. */
    userWantsCurrent: boolean;
    /** An open bot PR that already moves this package to a fixing version. */
    openBotPr: number | null;
    /** The project publishes releases (a package, not an application). */
    isLibrary: boolean;
    /** The finding is a runtime, not a package. */
    isRuntime: boolean;
}

export type Route = 'new-branch-here' | 'worktree' | 'current-branch' | 'complete-bot-pr';

export interface RoutingDecision {
    route: Route;
    /** Prepare a patch-release draft and stop before the tag (2.4). */
    releaseDraft: boolean;
    /** List what no file controls — hosting, a base image built elsewhere (1.2). */
    opsChecklist: boolean;
    /** After the fix merges, offer the feature branch a rebase onto the new trunk. */
    rebaseOfferAfterMerge: boolean;
    /** One sentence the offer shows with the route. */
    reason: string;
}

/**
 * The routing table of 2.1, first matching row wins. Security fixes travel
 * alone unless the bug lives in the current branch (D1).
 */
export function routeSecurityFix(c: RoutingContext): RoutingDecision {
    const extras = { releaseDraft: c.isLibrary, opsChecklist: c.isRuntime };
    if (c.openBotPr !== null) {
        return { route: 'complete-bot-pr', rebaseOfferAfterMerge: false, ...extras, reason: `bot PR #${c.openBotPr} already moves this dependency — complete it rather than open a second` };
    }
    if (c.userWantsCurrent || c.branchIntroducedDependency) {
        return {
            route: 'current-branch',
            rebaseOfferAfterMerge: false,
            ...extras,
            reason: c.branchIntroducedDependency
                ? 'this branch introduced the dependency — fixing it elsewhere would leave this PR shipping it'
                : 'asked for in the current branch',
        };
    }
    if (c.onTrunk && c.clean) {
        return { route: 'new-branch-here', rebaseOfferAfterMerge: false, ...extras, reason: 'on the trunk with a clean tree — nothing to isolate from' };
    }
    if (c.branchTouchesFile) {
        return { route: 'worktree', rebaseOfferAfterMerge: true, ...extras, reason: 'the feature branch changes the same file — the fix travels alone, the feature rebases onto it after the merge' };
    }
    return { route: 'worktree', rebaseOfferAfterMerge: false, ...extras, reason: 'a feature is in progress — the fix travels alone, mergeable and releasable without it' };
}

// ---------------------------------------------------------------------------
// The smallest fixing change (Phase 1)
// ---------------------------------------------------------------------------

export interface FixPlan {
    /** Shell commands the agent runs in the fix branch, in order. */
    commands: string[];
    /** Exact file edits for a runtime fix. */
    edits: Array<{ file: string; line: number; from: string; to: string }>;
    /** What no file in the repository controls. */
    opsChecklist: string[];
    /** Why this is the smallest change. */
    note: string;
}

function shellArg(v: string): string {
    return /^[A-Za-z0-9@._/:+=-]+$/.test(v) ? v : `'${v.replace(/'/g, `'\\''`)}'`;
}

/**
 * Smallest fixing version inside the current constraint first; a constraint
 * change only when the fix is outside it; never `audit fix --force`, never an
 * unannounced major (1.1).
 */
export function fixPlan(f: Finding, inventory: InventoryEntry[]): FixPlan {
    if (f.ecosystem === 'runtime') return runtimePlan(f, inventory);
    if (f.fixed === null) {
        return { commands: [], edits: [], opsChecklist: [], note: 'no fixing version exists — offer a mitigation instead (1.5)' };
    }
    const major = (v: string | null): string | null => (v === null ? null : (/^(\d+)/.exec(v)?.[1] ?? null));
    const crossesMajor = major(f.version) !== null && major(f.fixed) !== null && major(f.version) !== major(f.fixed);
    const pkg = shellArg(f.package);
    const fixed = shellArg(f.fixed);
    if (f.ecosystem === 'npm') {
        const direct = inventory.some((e) => e.file.endsWith('package.json') && e.name === f.package);
        return {
            commands: direct ? [`npm install ${pkg}@^${fixed} --save-exact=false`] : [`npm update ${pkg}`, `npm ls ${pkg}`],
            edits: [],
            opsChecklist: [],
            note: crossesMajor
                ? `the fix (${f.fixed}) is a new major — state the compatibility analysis before running it`
                : direct
                  ? 'raise the direct dependency to the fixing version inside its range'
                  : `transitive: \`npm update\` within the existing ranges; if ${f.package} stays below ${f.fixed}, add an \`overrides\` entry for it, never \`npm audit fix --force\``,
        };
    }
    if (f.ecosystem === 'Packagist') {
        return {
            commands: [`composer update ${pkg} --with-dependencies`, `composer show ${pkg}`],
            edits: [],
            opsChecklist: [],
            note: crossesMajor
                ? `the fix (${f.fixed}) is a new major — change the constraint deliberately and state the compatibility analysis`
                : 'update this package and what it needs within the current constraints; change composer.json only if the fixing version is outside them',
        };
    }
    return { commands: [], edits: [], opsChecklist: [], note: `${f.ecosystem} fixes are a manual pin change to ${f.fixed}` };
}

/** Every file that pins the runtime changes in one commit; what no file controls is listed (1.2). */
function runtimePlan(f: Finding, inventory: InventoryEntry[]): FixPlan {
    const to = f.fixed;
    if (to === null) {
        return { commands: [], edits: [], opsChecklist: [], note: 'no fixed runtime release is named yet — prepare, do not invent a version' };
    }
    const pins = inventory.filter((e) => e.ecosystem === 'runtime' && e.name === f.package && e.version !== null);
    // Only pins on the fixed release's own line move: Node 18 → 22.11.1 would be
    // an unannounced major, which this plan never makes (1.1).
    const lineOf = (v: string): string | null => {
        const m = /^(\d+)(?:\.(\d+))?/.exec(v);
        if (m === null) return null;
        return f.package === 'php' ? (m[2] === undefined ? null : `${m[1]}.${m[2]}`) : m[1]!;
    };
    const target = lineOf(to);
    const sameLine = pins.filter((e) => target !== null && lineOf(e.version!) === target);
    const otherLine = pins.filter((e) => !sameLine.includes(e));
    const edits = sameLine
        .filter((e) => compare_versions(e.version, to) === -1)
        .map((e) => ({ file: e.file, line: e.line, from: e.version!, to }));
    const runtimeName = f.package === 'node' ? 'Node.js' : f.package === 'php' ? 'PHP' : f.package;
    return {
        commands: [],
        edits,
        opsChecklist: [
            `every host or managed service that runs ${runtimeName} outside these files: move it to ${to} or later`,
            'any base image built in another repository from these pins: rebuild it',
            'after the deploy: confirm the running version (`php -v` / `node -v`) on each environment',
        ],
        note:
            `${edits.length} pinning file(s) move to ${to}; a declared range that already admits ${to} is left alone` +
            (otherLine.length === 0
                ? ''
                : `; ${otherLine.length} pin(s) on another release line (${otherLine.map((e) => `${e.file}:${e.line} ${e.version}`).join(', ')}) are not changed — moving them is a major upgrade, decided separately`),
    };
}

// ---------------------------------------------------------------------------
// Cooldown and provenance (1.3)
// ---------------------------------------------------------------------------

/** A fixing release younger than this is `fix-fresh` and gets the post-update audit first. */
export const COOLDOWN_DAYS = 3;

export function isFixFresh(releasedAt: string | null, now: Date = new Date()): boolean {
    if (releasedAt === null) return false;
    const t = Date.parse(releasedAt);
    return Number.isFinite(t) && now.getTime() - t < COOLDOWN_DAYS * 86400000;
}

/**
 * Paths a dependency update must never touch: agent configuration (a 2026 worm
 * persisted through a session-start hook there) and install scripts. Any of
 * them in the fix diff stops the fix.
 */
export function suspiciousPaths(changed: string[], packageJsonScripts: { before: Record<string, string>; after: Record<string, string> } | null = null): string[] {
    const hits = changed.filter((p) => /^(\.claude|\.vscode|\.cursor|\.github\/workflows)\//.test(p));
    if (packageJsonScripts !== null) {
        for (const k of ['preinstall', 'install', 'postinstall', 'prepare']) {
            if (packageJsonScripts.before[k] !== packageJsonScripts.after[k]) hits.push(`package.json scripts.${k}`);
        }
    }
    return hits;
}

// ---------------------------------------------------------------------------
// Proof it is fixed (1.4)
// ---------------------------------------------------------------------------

export type FixProof = 'fixed-in-branch' | 'fix-failed' | 'unverifiable';

/**
 * The same authority that reported the finding must stop reporting it on the
 * changed lockfile. An authority that did not answer proves nothing either way.
 */
export function proveFixed(key: string, sourcesBefore: string[], after: { findings: Finding[]; okSources: string[] }): FixProof {
    const reporters = sourcesBefore.filter((s) => after.okSources.includes(s));
    if (reporters.length === 0) return 'unverifiable';
    const still = after.findings.find((f) => f.key === key || (f.id === key.split('|')[0] && f.package === key.split('|')[1]));
    if (still === undefined) return 'fixed-in-branch';
    return still.sources.some((s) => reporters.includes(s)) ? 'fix-failed' : 'fixed-in-branch';
}

// ---------------------------------------------------------------------------
// The PR and the release (2.3, 2.4)
// ---------------------------------------------------------------------------

export function branchName(f: Finding): string {
    const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    return `security/${slug(f.package)}-${slug(f.id)}`;
}

export function prTitle(f: Finding): string {
    const ids = [f.id, ...f.aliases].slice(0, 2).join(', ');
    return `fix(security): ${f.package} ${f.version ?? '?'} → ${f.fixed ?? '?'} (${ids})`;
}

export interface PrEvidence {
    before: string;
    after: FixProof;
    tests: 'passed' | 'failed' | 'not-run';
    cooldown: string;
    deploy: string;
}

/** The seven fields every security PR carries. */
export function prBody(f: Finding, e: PrEvidence): string {
    return [
        `## Security fix — ${f.package}`,
        '',
        `- **Finding:** ${[f.id, ...f.aliases].join(', ')}`,
        `- **Tier:** ${f.tier} (${f.verdict}${f.severity === null ? '' : `, ${f.severity}`})`,
        `- **Before:** ${e.before}`,
        `- **After:** ${e.after === 'fixed-in-branch' ? 'the reporting source no longer reports it on this branch' : e.after}`,
        `- **Tests:** ${e.tests}`,
        `- **Cooldown / provenance:** ${e.cooldown}`,
        `- **Deploy:** ${e.deploy}`,
        '',
        'Security-only: no unrelated change rides along. Merge, tag and deploy stay with the owner.',
    ].join('\n');
}

/** Next patch version and a changelog entry naming the advisory IDs (2.4). Stops before the tag. */
export function releaseDraft(currentVersion: string, fixes: Finding[]): { version: string; changelog: string } | null {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(currentVersion);
    if (m === null) return null;
    const version = `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
    const lines = fixes.map((f) => `- ${f.package} ${f.version ?? '?'} → ${f.fixed ?? '?'} (${[f.id, ...f.aliases].join(', ')})`);
    return { version, changelog: [`## ${version}`, '', '### Security', '', ...lines].join('\n') };
}

// ---------------------------------------------------------------------------
// Following the fix to production (Phase 3)
// ---------------------------------------------------------------------------

export type RemediationState =
    | 'fix-in-progress'
    | 'ready-to-merge'
    | 'fixed-in-trunk'
    | 'fixed-released'
    | 'fixed-deployed'
    | 'fix-failed'
    | 'mitigated';

export interface Remediation {
    key: string;
    state: RemediationState;
    /** One open fix per finding fingerprint; a second session joins this one (3.3). */
    owner_session: string | null;
    branch: string | null;
    pr: number | null;
    merge_sha: string | null;
    stamps: Partial<Record<RemediationState, string>>;
    /** A mitigation's note, when no fix exists (1.5). */
    note: string | null;
}

export type Remediations = Record<string, Remediation>;

/**
 * Start a fix, or join the one already open for this finding. Returns the
 * remediation the caller must work on and whether it is new.
 */
export function claimRemediation(all: Remediations, key: string, session: string, now: Date = new Date()): { remediation: Remediation; joined: boolean } {
    const open = all[key];
    if (open !== undefined && (open.state === 'fix-in-progress' || open.state === 'ready-to-merge')) {
        return { remediation: open, joined: true };
    }
    const at = now.toISOString();
    const r: Remediation = { key, state: 'fix-in-progress', owner_session: session, branch: null, pr: null, merge_sha: null, stamps: { 'fix-in-progress': at }, note: null };
    all[key] = r;
    return { remediation: r, joined: false };
}

export function advance(r: Remediation, to: RemediationState, now: Date = new Date(), extra: Partial<Pick<Remediation, 'branch' | 'pr' | 'merge_sha' | 'note'>> = {}): Remediation {
    r.state = to;
    r.stamps[to] = now.toISOString();
    Object.assign(r, extra);
    return r;
}

export interface TrackSignals {
    /** The fix PR merged, with its merge commit. */
    mergedSha: string | null;
    /** A release tag contains the merge commit. */
    releaseContains: boolean;
    /** The project exposes a deploy signal that saw the merge commit (a deploy run, an environment, or the user's word). */
    deployed: boolean;
}

/** Move a remediation forward on observed signals only; never backward, never on a guess (3.1). */
export function track(r: Remediation, s: TrackSignals, now: Date = new Date()): Remediation {
    if (r.state === 'fix-in-progress' || r.state === 'ready-to-merge') {
        if (s.mergedSha !== null) advance(r, 'fixed-in-trunk', now, { merge_sha: s.mergedSha });
    }
    if (r.state === 'fixed-in-trunk' && s.releaseContains) advance(r, 'fixed-released', now);
    if ((r.state === 'fixed-in-trunk' || r.state === 'fixed-released') && s.deployed) advance(r, 'fixed-deployed', now);
    return r;
}

/** Merged but not deployed after this long stays in the notice (3.2). */
export const UNDEPLOYED_AFTER_HOURS = 24;

export interface UndeployedFix {
    id: string;
    mergeSha: string | null;
    hours: number;
}

/** Structured rows only — the session line is rendered, and validated, by the notice module. */
export function mergedNotDeployed(all: Remediations, findings: Finding[], now: Date = new Date()): UndeployedFix[] {
    const byKey = new Map(findings.map((f) => [f.key, f]));
    const rows: UndeployedFix[] = [];
    for (const r of Object.values(all)) {
        if (r.state !== 'fixed-in-trunk' && r.state !== 'fixed-released') continue;
        const since = r.stamps['fixed-in-trunk'];
        if (since === undefined) continue;
        const hours = (now.getTime() - Date.parse(since)) / 3600000;
        if (!Number.isFinite(hours) || hours < UNDEPLOYED_AFTER_HOURS) continue;
        const f = byKey.get(r.key);
        if (f !== undefined && f.tier !== 'T0' && f.tier !== 'T1') continue;
        rows.push({ id: r.key.split('|')[0] ?? r.key, mergeSha: r.merge_sha, hours: Math.floor(hours) });
    }
    return rows;
}

/** A mitigated finding reopens the moment a refresh reports a fix for it (1.5). */
export function reopenMitigations(all: Remediations, findings: Finding[]): string[] {
    const reopened: string[] = [];
    for (const f of findings) {
        const r = all[f.key];
        if (r?.state === 'mitigated' && f.fixed !== null) {
            delete all[f.key];
            reopened.push(f.key);
        }
    }
    return reopened;
}
