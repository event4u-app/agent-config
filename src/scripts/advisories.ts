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

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { inventoryFingerprint, readInventory } from './_lib/advisory_inventory.js';
import {
    type AdvisoriesEgress,
    type AdvisoryState,
    describe,
    noticeLines,
    readAdvisorySettings,
    readState,
    sessionNotice,
    statePath,
} from './_lib/advisory_notice.js';

import {
    type Fetcher,
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
    routeSecurityFix,
    track,
} from './_lib/security_fix.js';
import { defaultExec, readRoutingContext } from './_lib/security_fix_context.js';

/** A cache younger than this is reused without a fetch (F10: one refresh per window). */
export const REFRESH_WINDOW_HOURS = 20;
function machineDir(): string {
    return path.join(event4u_root(), 'runtime', 'advisories');
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
export async function refreshMany(roots: string[], deps: RefreshDeps = {}): Promise<RefreshResult[]> {
    const now = deps.now ?? new Date();
    const mdir = deps.machineDir ?? machineDir();
    const plan = roots.map((root) => {
        const prev = readState(root);
        const fingerprint = inventoryFingerprint(root);
        const fresh =
            prev !== null &&
            prev.fingerprint === fingerprint &&
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
        if (!stale) {
            for (const p of todo) if (p.prev !== null) results.push({ state: p.prev, fetched: false, reason: 'refresh-in-progress' });
            return results;
        }
        fs.writeFileSync(lock, `${process.pid} ${now.toISOString()}\n`);
    }
    try {
        const inventories = todo.map((p) => ({ ...p, inv: readInventory(p.root) }));
        const egress = deps.egress ?? readAdvisorySettings(todo[0]!.root).egress;
        const raw = new Map<string, RawFinding[]>();
        const reports = new Map<string, SourceReport[]>();
        for (const p of inventories) {
            raw.set(p.root, []);
            reports.set(p.root, []);
        }
        if (egress === 'none') {
            for (const p of inventories) reports.get(p.root)!.push({ source: 'osv', status: 'unavailable', reason: 'egress-none' });
        } else {
            const cache = readDetailCache(mdir);
            const all = inventories.flatMap((p) => p.inv.entries.map((e) => ({ root: p.root, e })));
            const osv = await osvQuery(all.map((x) => x.e), { fetcher: deps.fetcher, cache });
            writeJson(path.join(mdir, 'osv-details.json'), Object.fromEntries(cache));
            for (const p of inventories) {
                const mine = new Set(p.inv.entries);
                raw.get(p.root)!.push(...osv.findings.filter((f) => all.some((x) => x.root === p.root && mine.has(x.e) && x.e.name === f.package && x.e.file === f.file)));
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
        }
        for (const p of inventories) {
            const acceptances = p.prev?.acceptances ?? [];
            const remediations = { ...(p.prev?.remediations ?? {}) };
            const findings = buildFindings(raw.get(p.root)!, p.inv.entries, reports.get(p.root)!, { now, acceptances });
            const a = announce(findings, p.prev?.ledger ?? emptyLedger(), now);
            const silent: Record<string, string> = {};
            for (const r of reports.get(p.root)!) {
                if (r.status !== 'ok' && r.reason !== 'private-names-present') silent[r.source] = p.prev?.silent_since?.[r.source] ?? now.toISOString();
            }
            const state: AdvisoryState = {
                schema: 1,
                root: p.root,
                at: now.toISOString(),
                fingerprint: p.inv.fingerprint,
                inventory: p.inv.entries,
                findings,
                reports: reports.get(p.root)!,
                ledger: a.ledger,
                acceptances,
                notice:
                    a.interrupt.length > 0 || a.digest.length > 0
                        ? { at: now.toISOString(), interrupt: a.interrupt.map((f) => f.key), digest: a.digest.length }
                        : (p.prev?.notice ?? null),
                silent_since: silent,
                remediations,
            };
            reopenMitigations(remediations, findings);
            const sp = statePath(p.root);
            if (sp !== null) writeJson(sp, state);
            results.push({ state, fetched: egress !== 'none', reason: egress === 'none' ? 'egress-none' : 'refreshed' });
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

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage(): number {
    process.stderr.write(
        'usage: agent-config audit:deps refresh [--force] [--all-projects] | show [--json] | ' +
            'accept <id> --reason=<text> --expires=YYYY-MM-DD | fix <id> [--here] | verify <id> | pr-body <id> [--verified] [--tests=passed] [--release=<x.y.z>] | mitigate <id> --note=<text> | track [--deployed] | notice | gaps | issue-body\n',
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
            process.stdout.write(`${JSON.stringify(state.findings, null, 2)}\n`);
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
        writeJson(sp, state);
        process.stdout.write(`accepted ${id} until ${a.expires}\n`);
        return 0;
    }
    if (mode === 'fix' || mode === 'verify' || mode === 'pr-body' || mode === 'mitigate') {
        const id = rest.find((a) => !a.startsWith('--'));
        const state = readState(root);
        const sp = statePath(root);
        if (state === null || sp === null || id === undefined) {
            process.stderr.write('usage: agent-config audit:deps fix|verify|pr-body|mitigate <id> — after a refresh\n');
            return 2;
        }
        const f = state.findings.find((x) => x.id === id || x.aliases.includes(id) || x.key === id);
        if (f === undefined) {
            process.stderr.write(`no finding ${id} in the last refresh — run \`agent-config audit:deps show\`\n`);
            return 1;
        }
        state.remediations = state.remediations ?? {};
        if (mode === 'fix') {
            const { remediation, joined } = claimRemediation(state.remediations, f.key, process.env['CLAUDE_CODE_SESSION_ID'] ?? `pid-${process.pid}`);
            const ctx = readRoutingContext(root, f, { userWantsCurrent: rest.includes('--here') });
            const route = routeSecurityFix(ctx);
            const plan = fixPlan(f, state.inventory);
            remediation.branch = route.route === 'current-branch' ? remediation.branch : branchName(f);
            writeJson(sp, state);
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
        if (mode === 'verify') {
            const [after] = await refreshMany([root], { force: true });
            const ok = after!.state.reports.filter((r) => r.status === 'ok').map((r) => r.source);
            const proof = proveFixed(f.key, f.sources, { findings: after!.state.findings, okSources: ok });
            const fresh = after!.state;
            fresh.remediations = { ...(state.remediations ?? {}) };
            const r = fresh.remediations[f.key];
            if (r !== undefined) advance(r, proof === 'fixed-in-branch' ? 'ready-to-merge' : proof === 'fix-failed' ? 'fix-failed' : r.state);
            writeJson(sp, fresh);
            process.stdout.write(`${f.id}: ${proof}${proof === 'fix-failed' ? ' — the reporting source still reports it; do not call this fixed' : ''}\n`);
            return proof === 'fixed-in-branch' ? 0 : 1;
        }
        if (mode === 'mitigate') {
            const note = flag('note');
            if (note === undefined || note.trim().length < 10) {
                process.stderr.write('a mitigation names what was done, in a sentence (--note="…")\n');
                return 1;
            }
            const r = state.remediations[f.key] ?? claimRemediation(state.remediations, f.key, `pid-${process.pid}`).remediation;
            advance(r, 'mitigated', new Date(), { note });
            writeJson(sp, state);
            process.stdout.write(`${f.id}: mitigated — stays open and reopens when a fix appears\n`);
            return 0;
        }
        const tests = (flag('tests') ?? 'not-run') as 'passed' | 'failed' | 'not-run';
        const body = prBody(f, {
            before: `${f.sources.join(', ')} reported ${f.package} ${f.version ?? '?'} as ${f.verdict}`,
            after: rest.includes('--verified') ? 'fixed-in-branch' : 'unverifiable',
            tests,
            cooldown: isFixFresh(flag('released-at') ?? null) ? `the fixing release is younger than the cooldown — the post-update audit ran` : 'outside the cooldown window',
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
        const state = readState(root);
        const sp = statePath(root);
        if (state === null || sp === null) return 0;
        for (const r of Object.values(state.remediations ?? {})) {
            if (r.pr === null && r.branch === null) continue;
            const view = r.pr !== null ? defaultExec('gh', ['pr', 'view', String(r.pr), '--json', 'state,mergeCommit'], root) : null;
            let mergedSha: string | null = null;
            try {
                const v = view === null ? null : (JSON.parse(view) as { state?: string; mergeCommit?: { oid?: string } | null });
                if (v?.state === 'MERGED') mergedSha = v.mergeCommit?.oid ?? null;
            } catch {
                mergedSha = null;
            }
            const sha = mergedSha ?? r.merge_sha;
            const tags = sha === null ? null : defaultExec('git', ['tag', '--contains', sha], root);
            const deployRuns = sha === null ? null : defaultExec('gh', ['run', 'list', '--commit', sha, '--json', 'name,conclusion'], root);
            let deployed = rest.includes('--deployed');
            try {
                const runs = deployRuns === null ? [] : (JSON.parse(deployRuns) as Array<{ name?: string; conclusion?: string }>);
                deployed = deployed || runs.some((x) => /deploy|release/i.test(x.name ?? '') && x.conclusion === 'success');
            } catch {
                /* no deploy signal read — never assume one */
            }
            track(r, { mergedSha: sha, releaseContains: (tags ?? '').trim() !== '', deployed });
        }
        writeJson(sp, state);
        for (const r of Object.values(state.remediations ?? {})) process.stdout.write(`${r.key.split('|')[0]}  ${r.state}\n`);
        return 0;
    }
    if (mode === 'notice') {
        process.stdout.write(`${noticeLines(readState(root)).join('\n')}\n`);
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
