#!/usr/bin/env tsx
/**
 * `agent-config audit:deps` — advisories heard the same day
 * (road-to-advisories-heard-the-same-day).
 *
 * Modes:
 *   refresh [--force] [--all-projects]   Inventory → sources → findings → ledger;
 *                                        writes the project's cache. The ONLY
 *                                        mode that touches the network, and only
 *                                        hosts on the allowlist. Reuses the cache
 *                                        inside the refresh window unless --force.
 *   show [--json]                        Findings by tier, each with its evidence.
 *   accept <id> --reason=… --expires=YYYY-MM-DD
 *   notice                               The session line(s), from the cache only.
 *   gaps                                 What the project's own tooling already
 *                                        covers, and the config that would close
 *                                        the rest — offered, never written.
 *   issue-body                           Markdown for the opt-in CI schedule's
 *                                        issue, T0 only; empty when there is none.
 *
 * Network happens in this process, never in a hook: a session start reads the
 * cache file and nothing else (council 2026-10-21 Q3).
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { inventoryFingerprint, readInventory, unsupportedLockfiles } from './_lib/advisory_inventory.js';
import {
    type AdvisoriesEgress,
    type AdvisoriesKev,
    type AdvisoryState,
    describe,
    noticeLines,
    readAdvisorySettings,
    readRemediations,
    readState,
    remediationsPath,
    sessionNotice,
    statePath,
} from './_lib/advisory_notice.js';

import {
    type Fetcher,
    type KevCatalog,
    kevEnrich,
    lifecycle,
    nativeAudits,
    type OsvDetailCache,
    osvQuery,
    type RawFinding,
    type Runner,
    type SourceReport,
    vendorAnnouncements,
} from './_lib/advisory_sources.js';
import {
    type Acceptance,
    announce,
    buildFindings,
    carryForward,
    emptyLedger,
    validateAcceptance,
} from './_lib/advisory_verdicts.js';
import { event4u_root } from './_lib/user_global_paths.js';
import {
    advance,
    branchName,
    claimRemediation,
    fixPlan,
    isFixFresh,
    prBody,
    proveFixed,
    prTitle,
    releaseDraft,
    reopenMitigations,
    type Remediations,
    routeSecurityFix,
    suspiciousPaths,
    track,
} from './_lib/security_fix.js';
import { defaultExec, readRoutingContext } from './_lib/security_fix_context.js';

/** A cache younger than this is reused without a fetch (F10: one refresh per window). */
export const REFRESH_WINDOW_HOURS = 20;
function machineDir(): string {
    return path.join(event4u_root(), 'runtime', 'advisories');
}

function writeRemediations(root: string, rems: Remediations): void {
    const p = remediationsPath(root);
    if (p !== null) writeJson(p, rems);
}

function writeJson(file: string, value: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
    fs.renameSync(tmp, file);
}

function readDetailCache(dir: string): OsvDetailCache {
    try {
        const doc = JSON.parse(fs.readFileSync(path.join(dir, 'osv-details.json'), 'utf-8')) as Record<string, { modified: string; vuln: object }>;
        return new Map(Object.entries(doc)) as OsvDetailCache;
    } catch {
        return new Map();
    }
}

export interface RefreshDeps {
    now?: Date;
    fetcher?: Fetcher;
    runner?: Runner;
    force?: boolean;
    machineDir?: string;
    egress?: AdvisoriesEgress;
    kev?: AdvisoriesKev;
}

export interface RefreshResult {
    state: AdvisoryState;
    fetched: boolean;
    reason: 'refreshed' | 'cache-current' | 'refresh-in-progress' | 'egress-none';
}

/**
 * Refresh one or more projects. All projects' public packages go out in ONE
 * cross-ecosystem query, so two projects sharing a vulnerable package cost one
 * fetch and yield two findings (5.4). A machine-wide lock keeps five sessions
 * starting together from refreshing five times (F10).
 */
export async function refreshMany(allRoots: string[], deps: RefreshDeps = {}): Promise<RefreshResult[]> {
    const now = deps.now ?? new Date();
    const mdir = deps.machineDir ?? machineDir();
    // `advisories.mode: off` is off for the refresh too: such a project is not
    // queried, not cached and not written into the machine's project index (5.4).
    const roots = allRoots.filter((r) => readAdvisorySettings(r).mode !== 'off');
    const plan = roots.map((root) => {
        const prev = readState(root);
        const fingerprint = inventoryFingerprint(root);
        // A changed egress setting is a changed question: `none` → `query` must
        // not keep the egress-none unknowns until the window runs out.
        const egress = deps.egress ?? readAdvisorySettings(root).egress;
        const fresh =
            prev !== null &&
            prev.fingerprint === fingerprint &&
            (prev.egress ?? 'query') === egress &&
            now.getTime() - Date.parse(prev.at) < REFRESH_WINDOW_HOURS * 3600000;
        return { root, prev, fingerprint, fresh };
    });
    const results: RefreshResult[] = [];
    const todo = plan.filter((p) => deps.force === true || !p.fresh);
    for (const p of plan.filter((x) => !todo.includes(x))) results.push({ state: p.prev!, fetched: false, reason: 'cache-current' });
    if (todo.length === 0) return results;

    fs.mkdirSync(mdir, { recursive: true });
    const lock = path.join(mdir, 'refresh.lock');
    try {
        fs.writeFileSync(lock, `${process.pid} ${now.toISOString()}\n`, { flag: 'wx' });
    } catch {
        let stale = true;
        try {
            stale = now.getTime() - fs.statSync(lock).mtimeMs > 10 * 60000;
        } catch {
            /* vanished between the two calls: treat as stale */
        }
        let took = false;
        if (stale) {
            // Remove the stale lock, then take it with the same exclusive create:
            // of two processes that both saw it stale, only one wins.
            // Move aside only the lock that was judged stale: one another process
            // took over in between carries a new stamp and is put back.
            try {
                const judged = fs.readFileSync(lock, 'utf-8');
                const aside = `${lock}.${process.pid}.stale`;
                fs.renameSync(lock, aside);
                if (fs.readFileSync(aside, 'utf-8') === judged) fs.unlinkSync(aside);
                else fs.renameSync(aside, lock);
            } catch {
                /* the other process removed it first */
            }
            try {
                fs.writeFileSync(lock, `${process.pid} ${now.toISOString()}\n`, { flag: 'wx' });
                took = true;
            } catch {
                took = false;
            }
        }
        if (!took) {
            for (const p of todo) if (p.prev !== null) results.push({ state: p.prev, fetched: false, reason: 'refresh-in-progress' });
            return results;
        }
    }
    try {
        // Unchanged files are not read again (1.2): the cache's own inventory is
        // reused whenever the fingerprint still matches, window or `--force` alike.
        const inventories = todo.map((p) => ({
            ...p,
            inv: markOwnActionsPrivate(
                p.root,
                p.prev !== null && p.prev.fingerprint === p.fingerprint && Array.isArray(p.prev.inventory)
                    ? { entries: p.prev.inventory.map((e) => ({ ...e })), hash: '', fingerprint: p.fingerprint, files: [] }
                    : readInventory(p.root),
            ),
        }));
        // Egress is each project's own setting: one project's `query` never sends
        // another project's names (and `--all-projects` reads them all).
        const egressOf = new Map(inventories.map((p) => [p.root, deps.egress ?? readAdvisorySettings(p.root).egress]));
        const raw = new Map<string, RawFinding[]>();
        const reports = new Map<string, SourceReport[]>();
        for (const p of inventories) {
            raw.set(p.root, []);
            reports.set(p.root, []);
            const unread = unsupportedLockfiles(p.root);
            if (unread.length > 0) reports.get(p.root)!.push({ source: 'native-npm', status: 'unavailable', reason: `lockfile-unsupported: ${unread.slice(0, 3).join(', ')}` });
        }
        const online = inventories.filter((p) => egressOf.get(p.root) === 'query');
        for (const p of inventories.filter((x) => egressOf.get(x.root) === 'none')) {
            reports.get(p.root)!.push({ source: 'osv', status: 'unavailable', reason: 'egress-none' });
        }
        if (online.length > 0) {
            const cache = readDetailCache(mdir);
            const all = online.flatMap((p) => p.inv.entries.map((e) => ({ root: p.root, e })));
            const osv = await osvQuery(all.map((x) => x.e), { fetcher: deps.fetcher, cache });
            writeJson(path.join(mdir, 'osv-details.json'), Object.fromEntries(cache));
            for (const p of online) {
                // A finding belongs to a project only when that project holds the
                // same package at the same VERSION in the same file.
                const mine = p.inv.entries;
                raw.get(p.root)!.push(
                    ...osv.findings.filter((f) => mine.some((e) => e.name === f.package && e.file === f.file && e.version === f.version && !e.private)),
                );
                reports.get(p.root)!.push(osv.report);
                const native = nativeAudits(p.root, p.inv.entries, deps.runner);
                raw.get(p.root)!.push(...native.findings);
                reports.get(p.root)!.push(...native.reports);
                const life = await lifecycle(p.inv.entries, { fetcher: deps.fetcher, now });
                raw.get(p.root)!.push(...life.findings);
                reports.get(p.root)!.push(life.report);
                const vendor = await vendorAnnouncements(p.inv.entries, { fetcher: deps.fetcher, now });
                raw.get(p.root)!.push(...vendor.findings);
                reports.get(p.root)!.push(...vendor.reports);
            }
            // KEV: one download for every project that has it on, matched locally.
            const kevOn = online.filter((p) => (deps.kev ?? readAdvisorySettings(p.root).kev) === 'on');
            if (kevOn.length > 0) {
                const kevFile = path.join(mdir, 'kev.json');
                let cached: KevCatalog | null = null;
                try {
                    cached = JSON.parse(fs.readFileSync(kevFile, 'utf-8')) as KevCatalog;
                } catch {
                    cached = null;
                }
                const kev = await kevEnrich(kevOn.flatMap((p) => raw.get(p.root)!), { fetcher: deps.fetcher, cached, now });
                if (kev.catalog !== null && kev.report.status === 'ok') writeJson(kevFile, kev.catalog);
                for (const p of kevOn) reports.get(p.root)!.push(kev.report);
            }
        }
        for (const p of inventories) {
            const acceptances = p.prev?.acceptances ?? [];
            const remediations = readRemediations(p.root);
            const findings = carryForward(
                buildFindings(raw.get(p.root)!, p.inv.entries, reports.get(p.root)!, { now, acceptances }),
                p.prev?.findings ?? [],
                reports.get(p.root)!,
                p.inv.entries,
            );
            const a = announce(findings, p.prev?.ledger ?? emptyLedger(), now);
            const silent: Record<string, string> = {};
            for (const r of reports.get(p.root)!) {
                // A deliberate skip (private names, `egress: none`) is not silence (4.4).
                if (r.status !== 'ok' && r.reason !== 'private-names-present' && r.reason !== 'egress-none' && !(r.reason ?? '').startsWith('lockfile-unsupported')) {
                    silent[r.source] = p.prev?.silent_since?.[r.source] ?? now.toISOString();
                }
            }
            const state: AdvisoryState = {
                schema: 1,
                root: p.root,
                at: now.toISOString(),
                fingerprint: p.inv.fingerprint,
                egress: egressOf.get(p.root) ?? 'query',
                inventory: p.inv.entries,
                findings,
                reports: reports.get(p.root)!,
                ledger: a.ledger,
                acceptances,
                notice:
                    a.interrupt.length > 0 || a.digest.length > 0
                        ? { at: now.toISOString(), interrupt: a.interrupt.map((f) => f.key), digest: a.digest.length }
                        : carriedNotice(p.prev?.notice ?? null, findings, now),
                silent_since: silent,
            };
            reopenMitigations(remediations, findings);
            writeRemediations(p.root, remediations);
            const sp = statePath(p.root);
            if (sp !== null) writeJson(sp, state);
            const sent = egressOf.get(p.root) === 'query';
            results.push({ state, fetched: sent, reason: sent ? 'refreshed' : 'egress-none' });
        }
        recordProjects(mdir, inventories.map((p) => ({ root: p.root, fingerprint: p.inv.fingerprint })), now);
    } finally {
        try {
            fs.unlinkSync(lock);
        } catch {
            /* already gone */
        }
    }
    return results;
}

/**
 * A refresh that announces nothing keeps the last notice for one day only, and
 * only its keys that are still findings: a digest count from last week is not
 * news, and printing it every morning teaches the reader to skip the line.
 */
function carriedNotice(prev: AdvisoryState['notice'], findings: { key: string }[], now: Date): AdvisoryState['notice'] {
    if (prev === null) return null;
    const age = now.getTime() - Date.parse(prev.at);
    if (!Number.isFinite(age) || age < 0 || age >= 24 * 3600000) return null;
    const live = new Set(findings.map((f) => f.key));
    return { ...prev, interrupt: prev.interrupt.filter((k) => live.has(k)) };
}

/**
 * Names the project's own organisation publishes may live in a private registry
 * scope or a private repository, and nothing in a lockfile says which: npm's
 * paid private packages resolve from registry.npmjs.org like any public one.
 * So everything under the project's OWN namespace is treated as private and
 * never sent — its npm scope (from package.json `name`, and the GitHub owner as
 * `@owner`), its Composer vendor (from composer.json `name`), and its GitHub
 * Actions. A private package of a THIRD namespace is the residual this cannot
 * see; `advisories.egress: none` is the setting for a project that has one.
 */
export function markOwnActionsPrivate<T extends { entries: Array<{ ecosystem: string; name: string; private: boolean }> }>(root: string, inv: T): T {
    let url = '';
    try {
        url = execFileSync('git', ['-C', root, 'remote', 'get-url', 'origin'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
    } catch {
        url = '';
    }
    const owner = /github\.com[:/]([^/]+)\//i.exec(url)?.[1]?.toLowerCase() ?? null;
    const nameOf = (file: string): string | null => {
        try {
            const n = (JSON.parse(fs.readFileSync(path.join(root, file), 'utf-8')) as { name?: unknown }).name;
            return typeof n === 'string' ? n.toLowerCase() : null;
        } catch {
            return null;
        }
    };
    const npmScopes = new Set<string>();
    const ownNpm = /^(@[^/]+)\//.exec(nameOf('package.json') ?? '')?.[1];
    if (ownNpm !== undefined) npmScopes.add(ownNpm);
    if (owner !== null) npmScopes.add(`@${owner}`);
    const vendor = /^([^/]+)\//.exec(nameOf('composer.json') ?? '')?.[1] ?? null;
    for (const e of inv.entries) {
        const n = e.name.toLowerCase();
        if (e.ecosystem === 'GitHub Actions' && owner !== null && n.split('/')[0] === owner) e.private = true;
        if (e.ecosystem === 'npm' && [...npmScopes].some((sc) => n.startsWith(`${sc}/`))) e.private = true;
        if (e.ecosystem === 'Packagist' && vendor !== null && n.startsWith(`${vendor}/`)) e.private = true;
    }
    return inv;
}

/** The user-global index of project roots — roots and fingerprints only (5.4). */
function recordProjects(mdir: string, rows: Array<{ root: string; fingerprint: string }>, now: Date): void {
    const file = path.join(mdir, 'projects.json');
    let doc: Record<string, { fingerprint: string; at: string }> = {};
    try {
        doc = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
        doc = {};
    }
    for (const r of rows) doc[r.root] = { fingerprint: r.fingerprint, at: now.toISOString() };
    writeJson(file, doc);
}

export function knownProjects(mdir: string = machineDir()): string[] {
    try {
        return Object.keys(JSON.parse(fs.readFileSync(path.join(mdir, 'projects.json'), 'utf-8'))).filter((r) => fs.existsSync(r));
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// What a person reads
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The gap report (5.2) and the CI issue body (5.3)
// ---------------------------------------------------------------------------

function read(root: string, rel: string): string | null {
    try {
        return fs.readFileSync(path.join(root, rel), 'utf-8');
    } catch {
        return null;
    }
}

export function gapReport(root: string): string[] {
    const gaps: string[] = [];
    const dependabot = read(root, '.github/dependabot.yml') ?? read(root, '.github/dependabot.yaml');
    const renovate = read(root, 'renovate.json') ?? read(root, '.github/renovate.json') ?? read(root, 'renovate.json5');
    if (dependabot === null && renovate === null) {
        gaps.push('no update bot: add `.github/dependabot.yml` with a daily schedule per ecosystem, security updates ungrouped');
    }
    if (dependabot !== null) {
        if (/applies-to:\s*security-updates/.test(dependabot)) {
            gaps.push('`.github/dependabot.yml` groups security updates — keep them ungrouped so each arrives alone');
        }
        if (!/cooldown:/.test(dependabot)) {
            gaps.push('`.github/dependabot.yml` sets no `cooldown:` — a fresh release can land before anyone has looked at it');
        }
    }
    if (renovate !== null && !/minimumReleaseAge/.test(renovate)) {
        gaps.push('renovate config sets no `minimumReleaseAge` — security fixes are exempt by default, routine bumps are not delayed');
    }
    const composer = read(root, 'composer.json');
    if (composer !== null && !/"(policy|audit)"\s*:/.test(composer)) {
        gaps.push('`composer.json` sets no `config.audit` / `config.policy` — Composer can block abandoned and vulnerable packages itself');
    }
    const workflows = (() => {
        try {
            return fs.readdirSync(path.join(root, '.github', 'workflows')).map((n) => read(root, `.github/workflows/${n}`) ?? '').join('\n');
        } catch {
            return '';
        }
    })();
    if (workflows !== '' && !/(npm|pnpm|yarn) audit|composer audit|osv-scanner|pip-audit/.test(workflows)) {
        gaps.push('no audit step in CI — `npm audit --omit=dev` / `composer audit` turns a known advisory into a red check');
    }
    if (read(root, 'package-lock.json') !== null && workflows !== '' && !/npm ci\b/.test(workflows)) {
        gaps.push('CI never runs `npm ci` — an unpinned install can resolve a version nobody audited');
    }
    return gaps;
}

export function issueBody(state: AdvisoryState | null): string {
    const t0 = (state?.findings ?? []).filter((f) => f.tier === 'T0');
    if (t0.length === 0) return '';
    return [
        '## Security advisories needing action today',
        '',
        ...t0.map((f) => `- ${describe(f)}`),
        '',
        `Checked ${state!.at} by \`agent-config audit:deps refresh\`. Run \`/audit deps fix <id>\` in a session to carry one to a PR.`,
    ].join('\n');
}


/** Changed paths of this branch against the trunk that a dependency fix must never touch (1.3). */
export function suspiciousInBranch(root: string, fixBase: string | null = null, planned: string[] = []): string[] {
    const trunk = ['origin/main', 'origin/master', 'main', 'master'].find((r) => defaultExec('git', ['rev-parse', '--verify', '--quiet', r], root) !== null);
    if (trunk === undefined && fixBase === null) return [];
    // A fix sharing the branch with a feature is judged from its own start, never
    // from the trunk — the feature's own workflow edit is not the fix's.
    const base = fixBase ?? defaultExec('git', ['merge-base', trunk!, 'HEAD'], root)?.trim();
    if (base === undefined || base === '') return [];
    const changed = (defaultExec('git', ['diff', '--name-only', base], root) ?? '').split('\n').filter((l) => l !== '');
    const scriptsOf = (file: string, rev: string | null): Record<string, string> => {
        let text: string | null;
        if (rev === null) {
            try {
                text = fs.readFileSync(path.join(root, file), 'utf-8');
            } catch {
                text = null;
            }
        } else text = defaultExec('git', ['show', `${rev}:${file}`], root);
        try {
            return (JSON.parse(text ?? '{}') as { scripts?: Record<string, string> }).scripts ?? {};
        } catch {
            return {};
        }
    };
    // Every changed package.json, at any depth: a workspace's install script runs too.
    const delta = Object.fromEntries(
        changed.filter((p) => p === 'package.json' || p.endsWith('/package.json')).map((p) => [p, { before: scriptsOf(p, base), after: scriptsOf(p, null) }]),
    );
    // A workflow the plan edits is allowed only where every changed line is a
    // version pin or an action ref; any other line in it still stops the fix.
    // Each removed pin pairs with one added pin of the SAME key and, for an
    // action, the same action: only the version or ref may move. A swapped
    // action or a new step is a workflow change, not a pin.
    const pinOnly = (file: string): boolean => {
        const diff = defaultExec('git', ['diff', '-U0', base, '--', file], root) ?? '';
        const changed = diff.split('\n').filter((l) => /^[+-](?![+-])/.test(l));
        const pin = (l: string): string | null => {
            const m = /^[+-]\s*(?:-\s*)?(node-version|php-version|uses):\s*["']?([^"'\s@]+)(?:@[^"'\s]+)?["']?\s*$/.exec(l);
            if (m === null) return null;
            return m[1] === 'uses' ? `uses:${m[2]}` : m[1]!;
        };
        const removed = changed.filter((l) => l.startsWith('-')).map(pin);
        const added = changed.filter((l) => l.startsWith('+')).map(pin);
        if (changed.length === 0 || removed.includes(null) || added.includes(null) || removed.length !== added.length) return false;
        return [...removed].sort().join('\n') === [...added].sort().join('\n');
    };
    const allowed = new Set(planned.filter((f) => changed.includes(f) && pinOnly(f)));
    return suspiciousPaths(changed.filter((p) => !allowed.has(p)), delta);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage(): number {
    process.stderr.write(
        'usage: agent-config audit:deps refresh [--force] [--all-projects] | show [--json] | ' +
            'accept <id> --reason=<text> --expires=YYYY-MM-DD | fix <id> [--here] | verify <id> | pr-body <id> [--tests=passed|failed|not-run] [--audit-ran] [--released-at=<iso>] [--release=<x.y.z>] | mitigate <id> --note=<text> | track [--deployed=<id>] | notice | gaps | issue-body\n',
    );
    return 2;
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
    const [mode, ...rest] = argv;
    const flag = (name: string): string | undefined => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
    const root = process.cwd();
    if (mode === 'refresh') {
        const roots = rest.includes('--all-projects') ? [...new Set([root, ...knownProjects()])] : [root];
        const results = await refreshMany(roots, { force: rest.includes('--force') });
        for (const r of results) {
            const t = (tier: string): number => r.state.findings.filter((f) => f.tier === tier).length;
            process.stdout.write(
                `${r.state.root}: ${r.reason} · T0 ${t('T0')} · T1 ${t('T1')} · T2 ${t('T2')} · T3 ${t('T3')} · ` +
                    `sources ${r.state.reports.map((x) => `${x.source}=${x.status}`).join(' ')}\n`,
            );
        }
        return 0;
    }
    if (mode === 'show') {
        const state = readState(root);
        if (state === null) {
            process.stdout.write('no advisory data yet — run `agent-config audit:deps refresh`\n');
            return 0;
        }
        if (rest.includes('--json')) {
            // Findings plus what the latency claims read: the ledger's
            // first_seen / announced_at and the remediation stamps.
            process.stdout.write(`${JSON.stringify({ findings: state.findings, ledger: state.ledger, remediations: readRemediations(root) }, null, 2)}\n`);
            return 0;
        }
        process.stdout.write(`advisories for ${state.root} · checked ${state.at} · ${state.inventory.length} component(s)\n`);
        for (const f of state.findings) process.stdout.write(`  ${describe(f)}\n`);
        if (state.findings.length === 0) process.stdout.write('  no known findings at the last check (this is not a statement that nothing is vulnerable)\n');
        return 0;
    }
    if (mode === 'accept') {
        const id = rest.find((a) => !a.startsWith('--'));
        const a = { id, reason: flag('reason'), expires: flag('expires') };
        const problem = validateAcceptance({ ...(id === undefined ? {} : { id }), ...(a.reason === undefined ? {} : { reason: a.reason }), ...(a.expires === undefined ? {} : { expires: a.expires }) });
        if (problem !== null) {
            process.stderr.write(`refused: ${problem}\n`);
            return 1;
        }
        const state = readState(root);
        const sp = statePath(root);
        if (state === null || sp === null) {
            process.stderr.write('no advisory data yet — run `agent-config audit:deps refresh` first\n');
            return 1;
        }
        state.acceptances = [...state.acceptances.filter((x) => x.id !== id), a as Acceptance];
        // Take effect now, not at the next refresh: the accepted finding leaves
        // the notice and the interrupt queue immediately.
        const acceptedKeys = new Set<string>();
        for (const f of state.findings) {
            if (f.id === id || f.aliases.includes(id ?? '')) {
                f.verdict = 'accepted';
                f.tier = 'T3';
                acceptedKeys.add(f.key);
            }
        }
        if (state.notice !== null) state.notice = { ...state.notice, interrupt: state.notice.interrupt.filter((k) => !acceptedKeys.has(k)) };
        writeJson(sp, state);
        process.stdout.write(`accepted ${id} until ${a.expires}\n`);
        return 0;
    }
    if (mode === 'fix' || mode === 'verify' || mode === 'pr-body' || mode === 'mitigate') {
        const id = rest.find((a) => !a.startsWith('--'));
        if (id === undefined) {
            process.stderr.write('usage: agent-config audit:deps fix|verify|pr-body|mitigate <id> — after a refresh\n');
            return 2;
        }
        const rems = readRemediations(root);
        const claimed = Object.values(rems).find((r) => r.key === id || r.key.split('|')[0] === id || (r.ids ?? []).includes(id));
        if (mode === 'verify') {
            // Verify runs where the fixed lockfile is — often a fix worktree with no
            // cache of its own yet. The claim, read from the repository-wide store,
            // carries what the proof needs: the IDs and the reporting sources.
            const before = readState(root)?.findings.find((x) => x.id === id || x.aliases.includes(id) || x.key === id) ?? null;
            const key = claimed?.key ?? before?.key;
            if (key === undefined) {
                process.stderr.write(`no claimed fix and no finding ${id} here — run \`agent-config audit:deps fix ${id}\` first\n`);
                return 1;
            }
            const [after] = await refreshMany([root], { force: true });
            if (after === undefined || after.reason === 'refresh-in-progress') {
                // A refresh held by another process returns the OLD findings; a
                // verdict on them would call a working fix failed. No verdict.
                process.stdout.write(`${id}: unverifiable — another refresh is running; re-run verify in a minute\n`);
                return 2;
            }
            const ok = after.state.reports.filter((r) => r.status === 'ok').map((r) => r.source);
            const ids = [...new Set([...(claimed?.ids ?? []), ...(before === null ? [] : [before.id, ...before.aliases])])];
            const sources = claimed?.sources ?? before?.sources ?? [];
            const proof = proveFixed(key, sources, { findings: after.state.findings, okSources: ok }, ids);
            const fresh = readRemediations(root);
            const r = fresh[key];
            // Agent-config paths or install scripts in the fix diff stop the fix (1.3),
            // judged from where THIS fix started, not from the trunk.
            const suspicious = suspiciousInBranch(root, r?.base ?? null, r?.files ?? []);
            if (r !== undefined) {
                if (suspicious.length > 0) advance(r, 'fix-failed', new Date(), { note: `touches ${suspicious.join(', ')}` });
                else if (proof === 'fixed-in-branch') advance(r, 'ready-to-merge');
                else if (proof === 'fix-failed') advance(r, 'fix-failed');
                writeRemediations(root, fresh);
            }
            if (suspicious.length > 0) {
                process.stdout.write(`${id}: stopped — the fix changes ${suspicious.join(', ')}; a dependency update never touches agent configuration or install scripts\n`);
                return 1;
            }
            process.stdout.write(`${id}: ${proof}${proof === 'fix-failed' ? ' — the reporting source still reports it; do not call this fixed' : ''}\n`);
            return proof === 'fixed-in-branch' ? 0 : 1;
        }
        const state = readState(root);
        if (state === null) {
            process.stderr.write('usage: agent-config audit:deps fix|verify|pr-body|mitigate <id> — after a refresh\n');
            return 2;
        }
        const f = state.findings.find((x) => x.id === id || x.aliases.includes(id) || x.key === id);
        if (f === undefined) {
            process.stderr.write(`no finding ${id} in the last refresh — run \`agent-config audit:deps show\`\n`);
            return 1;
        }
        if (mode === 'fix') {
            const { remediation, joined } = claimRemediation(rems, f.key, process.env['CLAUDE_CODE_SESSION_ID'] ?? `pid-${process.pid}`);
            const ctx = readRoutingContext(root, f, { userWantsCurrent: rest.includes('--here') });
            const route = routeSecurityFix(ctx);
            const plan = fixPlan(f, state.inventory);
            if (!joined) {
                remediation.ids = [f.id, ...f.aliases];
                remediation.sources = f.sources;
                // A runtime pin or an action ref in a workflow is the fix itself.
                remediation.files = [...new Set([...plan.edits.map((e) => e.file), ...(f.ecosystem === 'GitHub Actions' ? [f.file] : [])])].filter((x) => x.startsWith('.github/'));
                if (route.route === 'current-branch') {
                    // The fix shares the branch with the feature: name that branch
                    // and remember where the fix starts, so verify judges only it.
                    remediation.branch = defaultExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], root)?.trim() ?? null;
                    remediation.base = defaultExec('git', ['rev-parse', 'HEAD'], root)?.trim() ?? null;
                } else {
                    remediation.branch = branchName(f);
                    remediation.base = null;
                }
            }
            writeRemediations(root, rems);
            const out = [
                `finding  ${describe(f)}`,
                joined ? `joined   an open fix for this finding (${remediation.branch ?? 'branch unset'}) — do not start a second` : `claimed  fix-in-progress`,
                `route    ${route.route} — ${route.reason}`,
                route.route === 'worktree' || route.route === 'new-branch-here' ? `branch   ${branchName(f)}` : null,
                `title    ${prTitle(f)}`,
                ...plan.commands.map((c) => `run      ${c}`),
                ...plan.edits.map((e) => `edit     ${e.file}:${e.line}  ${e.from} → ${e.to}`),
                `note     ${plan.note}`,
                ...(route.opsChecklist ? plan.opsChecklist.map((o) => `ops      ${o}`) : []),
                route.releaseDraft ? 'release  library: prepare the patch release draft (`audit:deps pr-body` prints it); stop before the tag' : null,
                route.rebaseOfferAfterMerge ? 'after    offer the feature branch a rebase onto the trunk once this merges' : null,
                'then     agent-config audit:deps verify ' + f.id + '   # the reporting source must stop reporting it',
            ].filter((l): l is string => l !== null);
            process.stdout.write(`${out.join('\n')}\n`);
            return 0;
        }
        if (mode === 'mitigate') {
            if (f.fixed !== null) {
                process.stderr.write(`${f.id}: a fix exists (${f.fixed}) — a mitigation would be discarded at the next refresh; use \`audit:deps fix ${f.id}\`\n`);
                return 1;
            }
            const note = flag('note');
            if (note === undefined || note.trim().length < 10) {
                process.stderr.write('a mitigation names what was done, in a sentence (--note="…")\n');
                return 1;
            }
            // A regression after a deploy starts a new record; any other state the
            // lifecycle cannot leave for `mitigated` is refused, never reported done.
            const r = rems[f.key] !== undefined && rems[f.key]!.state !== 'fixed-deployed' ? rems[f.key]! : claimRemediation(rems, f.key, `pid-${process.pid}`).remediation;
            advance(r, 'mitigated', new Date(), { note });
            if (r.state !== 'mitigated') {
                process.stderr.write(`${f.id}: the open fix is ${r.state} — a mitigation does not replace it\n`);
                return 1;
            }
            writeRemediations(root, rems);
            process.stdout.write(`${f.id}: mitigated — stays open and reopens when a fix appears\n`);
            return 0;
        }
        const testsFlag = flag('tests') ?? 'not-run';
        if (testsFlag !== 'passed' && testsFlag !== 'failed' && testsFlag !== 'not-run') {
            process.stderr.write('--tests is passed, failed or not-run\n');
            return 2;
        }
        // The After field is read from what verify recorded, never from a flag.
        const recorded = rems[f.key]?.state;
        const after = recorded === 'ready-to-merge' ? 'fixed-in-branch' : recorded === 'fix-failed' ? 'fix-failed' : 'unverifiable';
        const body = prBody(f, {
            before: `${f.sources.join(', ')} reported ${f.package} ${f.version ?? '?'} as ${f.verdict}`,
            after,
            tests: testsFlag,
            cooldown: (() => {
                const released = flag('released-at') ?? null;
                const audited = rest.includes('--audit-ran');
                if (released === null) return audited ? 'post-update audit ran (dependency-upgrade steps 1–6); release age not stated' : 'release age not stated — run the post-update audit before merging';
                if (!isFixFresh(released)) return `the fixing release is older than the cooldown${audited ? '; post-update audit ran' : ''}`;
                return audited
                    ? 'the fixing release is younger than the cooldown; the post-update audit ran (dependency-upgrade steps 1–6)'
                    : 'the fixing release is younger than the cooldown — the post-update audit has NOT been recorded; run it before merging';
            })(),
            deploy: f.ecosystem === 'runtime' ? 'runtime: see the ops checklist; merged is not deployed' : 'ships with the next deploy of this project',
        });
        process.stdout.write(`${body}\n`);
        const version = flag('release');
        if (version !== undefined) {
            const draft = releaseDraft(version, [f]);
            if (draft !== null) process.stdout.write(`\n--- release draft (not tagged) ---\n${draft.changelog}\n`);
        }
        return 0;
    }
    if (mode === 'track') {
        const rems = readRemediations(root);
        for (const r of Object.values(rems)) {
            if (r.pr === null && r.branch === null) continue;
            // The PR is found by its head branch, which `fix` recorded, and its
            // number and merge commit are kept once seen.
            const view =
                r.pr !== null
                    ? defaultExec('gh', ['pr', 'view', String(r.pr), '--json', 'number,state,mergeCommit'], root)
                    : defaultExec('gh', ['pr', 'list', '--head', r.branch!, '--state', 'all', '--limit', '1', '--json', 'number,state,mergeCommit'], root);
            let mergedSha: string | null = null;
            try {
                const parsed = view === null ? null : (JSON.parse(view) as unknown);
                const v = (Array.isArray(parsed) ? parsed[0] : parsed) as { number?: number; state?: string; mergeCommit?: { oid?: string } | null } | undefined | null;
                if (typeof v?.number === 'number') r.pr = v.number;
                if (v?.state === 'MERGED') mergedSha = v.mergeCommit?.oid ?? null;
            } catch {
                mergedSha = null;
            }
            const sha = mergedSha ?? r.merge_sha;
            const tags = sha === null ? null : defaultExec('git', ['tag', '--contains', sha], root);
            const deployRuns = sha === null ? null : defaultExec('gh', ['run', 'list', '--commit', sha, '--json', 'name,conclusion'], root);
            // `--deployed=<id>` confirms ONE fix by the user's word; a bare flag confirms nothing.
            const confirmed = flag('deployed');
            let deployed = confirmed !== undefined && (r.key.split('|')[0] === confirmed || r.key === confirmed);
            try {
                const runs = deployRuns === null ? [] : (JSON.parse(deployRuns) as Array<{ name?: string; conclusion?: string }>);
                // A deploy signal is a successful run whose name says deploy — not a release drafter.
                deployed = deployed || runs.some((x) => /\bdeploy/i.test(x.name ?? '') && x.conclusion === 'success');
            } catch {
                /* no deploy signal read — never assume one */
            }
            track(r, { mergedSha: sha, releaseContains: (tags ?? '').trim() !== '', deployed });
        }
        writeRemediations(root, rems);
        for (const r of Object.values(rems)) process.stdout.write(`${r.key.split('|')[0]}  ${r.state}${r.pr === null ? '' : `  #${r.pr}`}\n`);
        return 0;
    }
    if (mode === 'notice') {
        process.stdout.write(`${noticeLines(readState(root), new Date(), readRemediations(root)).join('\n')}\n`);
        return 0;
    }
    if (mode === 'gaps') {
        const gaps = gapReport(root);
        process.stdout.write(gaps.length === 0 ? 'no gaps found in the project\'s own update and audit tooling\n' : `${gaps.map((g) => `- ${g}`).join('\n')}\n`);
        return 0;
    }
    if (mode === 'issue-body') {
        process.stdout.write(issueBody(readState(root)));
        return 0;
    }
    return usage();
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;

function isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
    }
}

if (isCliEntry()) {
    main().then(
        (code) => process.exit(code),
        (e) => {
            process.stderr.write(`Internal error: ${e instanceof Error ? e.message : String(e)}\n`);
            process.exit(3);
        },
    );
}

export { describe, noticeLines, readState, sessionNotice, statePath };
