/**
 * The upstream delta watch — one local run that turns an upstream move into findings.
 *
 * Per source the owner switched on (`watch: true`, off by default — council O7): one
 * `git ls-remote`; if HEAD equals the newest recorded pin, stop there. Otherwise a depth-1
 * fetch of both commits into a private cache under the user-global home, then two diffs —
 * the files under the edges' locators, and the top-level listing — classified as:
 *
 *   reverify       a locator's file changed under an adopted or adapted mechanism
 *   reopen         a locator's file changed under a rejected or deferred mechanism
 *   drift          a locator's file was deleted or renamed away
 *   candidate      a new top-level entry, which no mechanism has looked at yet
 *   license-alert  a top-level license file changed
 *
 * It never runs under CI (the key and the identities are local, CI logs are not), never
 * fetches without consent, and never writes code: the output is a report and a stub.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { MechanismRecord } from '../lint_harvest_provenance.js';
import { gitEnv } from './git_env.js';
import { assertOutsideWorkTree, LineageError, PIN_UNKNOWN, readLedger, type SourceRow } from './lineage_ledger.js';
import { latestDecisions } from './lineage_query.js';
import { decrypt, encrypt } from './link_crypto.js';
import type { EnvMap } from './user_global_paths.js';

export type GitRunner = (args: string[], cwd?: string) => string;

const GIT_TIMEOUT_MS = 120_000;

export const systemGit: GitRunner = (args, cwd) =>
    execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'protocol.ext.allow=never', '-c', 'http.followRedirects=false', ...args], {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: GIT_TIMEOUT_MS,
        env: { ...gitEnv(), GIT_TERMINAL_PROMPT: '0' },
    });

export type FindingClass = 'reverify' | 'reopen' | 'drift' | 'candidate' | 'license-alert';

export interface WatchFinding {
    readonly class: FindingClass;
    /** null for a candidate or a license alert — no mechanism has looked at it. */
    readonly mechanism_id: string | null;
    /** Plaintext, local only: the locator or top-level entry. */
    readonly locator: string;
}

export interface SourceReport {
    readonly source_id: string;
    readonly identity: string;
    readonly status: 'unchanged' | 'changed' | 'unpinned' | 'not-watchable' | 'error';
    readonly pin: string | null;
    readonly head: string | null;
    readonly findings: WatchFinding[];
    /** Mechanisms the source fed, for a license alert that concerns all of them. */
    readonly mechanisms: string[];
    readonly note?: string;
}

export interface WatchOptions {
    readonly dir: string;
    readonly keys: readonly string[];
    readonly rows: readonly MechanismRecord[];
    readonly git: GitRunner;
    readonly env: EnvMap;
}

export function refuseUnderCi(env: EnvMap): void {
    if (env.CI !== undefined && env.CI !== '' && env.CI !== 'false' && env.CI !== '0') {
        throw new LineageError('the lineage watch never runs under CI — the key and the source identities are local, CI logs are not');
    }
}

const LICENSE_RE = /^(licen[cs]e|copying)(\.[a-z0-9]+)?$/i;

/** A locator names a path, optionally suffixed `:<line>` or `#<anchor>`. */
function locatorPath(locator: string): string {
    return locator.replace(/#.*$/, '').replace(/:\d+(-\d+)?$/, '').replace(/^\.\//, '').replace(/\/+$/, '');
}

const under = (file: string, loc: string): boolean => file === loc || file.startsWith(`${loc}/`);

function watchOne(source: SourceRow, opts: WatchOptions): SourceReport {
    const { keys, git } = opts;
    const ledger = readLedger(opts.dir);
    const edges = ledger.edges.filter((e) => e.source_id === source.source_id);
    const mechanisms = [...new Set(edges.map((e) => e.mechanism_id))];
    const identity = decrypt(source.identity, [...keys]);
    const base = { source_id: source.source_id, identity, mechanisms };
    if (source.kind !== 'repo') {
        return { ...base, status: 'not-watchable', pin: null, head: null, findings: [], note: `kind ${source.kind} has no revision to compare` };
    }
    const pinned = edges.filter((e) => e.pin !== PIN_UNKNOWN);
    if (pinned.length === 0) {
        return { ...base, status: 'unpinned', pin: null, head: null, findings: [], note: 'no edge records a pin, so there is nothing to compare against' };
    }
    const pin = decrypt((pinned[pinned.length - 1] as { pin: string }).pin, [...keys]);

    if (identity.startsWith('-')) return { ...base, status: 'error', pin, head: null, findings: [], note: 'identity is not a repository location' };
    const head = (git(['ls-remote', identity, 'HEAD']).split(/\s+/)[0] ?? '').trim();
    if (!/^[0-9a-f]{7,64}$/.test(head)) return { ...base, status: 'error', pin, head: null, findings: [], note: 'ls-remote returned no HEAD' };
    if (head === pin) return { ...base, status: 'unchanged', pin, head, findings: [] };

    const cache = path.join(opts.dir, 'cache', source.source_id);
    // The cache is a repository of its own; what must sit outside every work tree is its container.
    assertOutsideWorkTree(path.dirname(cache));
    if (!fs.existsSync(path.join(cache, '.git'))) {
        fs.mkdirSync(cache, { recursive: true, mode: 0o700 });
        git(['init', '-q'], cache);
    }
    for (const rev of [head, pin]) git(['fetch', '-q', '--depth', '1', '--no-tags', identity, rev], cache);

    const changed = new Map<string, string>();
    for (const line of git(['diff', '--name-status', '-M', pin, head], cache).split('\n')) {
        const [status, from] = line.split('\t');
        if (status && from) changed.set(from, status.charAt(0));
    }
    const listing = (rev: string): Set<string> => new Set(git(['ls-tree', '--name-only', rev], cache).split('\n').filter((x) => x !== ''));
    const before = listing(pin);
    const after = listing(head);

    const latest = latestDecisions(opts.rows);
    const findings: WatchFinding[] = [];
    for (const e of edges) {
        if (e.locator === null) continue;
        const locator = decrypt(e.locator, [...keys]);
        const loc = locatorPath(locator);
        const hits = [...changed.entries()].filter(([f]) => under(f, loc));
        if (hits.length === 0) continue;
        const gone = hits.every(([, s]) => s === 'D' || s === 'R');
        const verdict = latest.get(e.mechanism_id)?.verdict;
        const cls: FindingClass = gone ? 'drift' : verdict === 'reject' || verdict === 'deferred' ? 'reopen' : 'reverify';
        findings.push({ class: cls, mechanism_id: e.mechanism_id, locator });
    }
    for (const entry of [...after].sort()) if (!before.has(entry)) findings.push({ class: 'candidate', mechanism_id: null, locator: entry });
    for (const [f] of changed) if (!f.includes('/') && LICENSE_RE.test(f)) findings.push({ class: 'license-alert', mechanism_id: null, locator: f });
    return { ...base, status: 'changed', pin, head, findings };
}

/** One run over every watched source. Throws under CI before any git call. */
export function runWatch(opts: WatchOptions): SourceReport[] {
    refuseUnderCi(opts.env);
    return readLedger(opts.dir)
        .sources.filter((s) => s.watch === true)
        .map((s) => {
            try {
                return watchOne(s, opts);
            } catch (e) {
                if (e instanceof LineageError) throw e;
                return { source_id: s.source_id, identity: '', status: 'error' as const, pin: null, head: null, findings: [], mechanisms: [], note: (e as Error).message.split('\n')[0] };
            }
        });
}

const CLASS_ORDER: readonly FindingClass[] = ['reopen', 'drift', 'reverify', 'license-alert', 'candidate'];

/** The local report: identities in plaintext, so it is written only under the user-global home. */
export function renderWatchReport(reports: readonly SourceReport[], date: string): string {
    const out = [`# Lineage watch — ${date} (local, never shared)`, ''];
    for (const r of reports) {
        out.push(`## ${r.source_id} — ${r.identity}`, '', `status ${r.status}${r.pin ? ` · pin ${r.pin}` : ''}${r.head ? ` · head ${r.head}` : ''}${r.note ? ` · ${r.note}` : ''}`, '');
        for (const f of [...r.findings].sort((a, b) => CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class))) {
            out.push(`- ${f.class} ${f.mechanism_id ?? '(no mechanism)'} — ${f.locator}`);
        }
        out.push('');
    }
    return out.join('\n');
}

/**
 * The tracked stub: mechanism ids and freshly sealed locators, nothing else — no source id,
 * no identity, no pin. One per run, grouped by mechanism rather than by commit, so a busy
 * upstream produces one decision to make per mechanism. Null when there is nothing to plan.
 */
export function renderWatchStub(reports: readonly SourceReport[], date: string, key: string): string | null {
    const byMechanism = new Map<string, WatchFinding[]>();
    const unowned: WatchFinding[] = [];
    for (const r of reports) {
        for (const f of r.findings) {
            if (f.class === 'license-alert') {
                for (const m of r.mechanisms) byMechanism.set(m, [...(byMechanism.get(m) ?? []), f]);
            } else if (f.mechanism_id === null) unowned.push(f);
            else byMechanism.set(f.mechanism_id, [...(byMechanism.get(f.mechanism_id) ?? []), f]);
        }
    }
    if (byMechanism.size === 0 && unowned.length === 0) return null;
    const review = new Date(`${date}T00:00:00Z`);
    review.setUTCDate(review.getUTCDate() + 90);
    const line = (f: WatchFinding): string => `- ${f.class} — \`${encrypt(f.locator, key)}\``;
    const out = [
        '---',
        'complexity: lightweight',
        `review_by: ${review.toISOString().slice(0, 10)}`,
        '---',
        '',
        `# Stub: lineage delta of ${date}`,
        '',
        '> **Stub — not active work.** Written by `code-graph lineage watch`. An upstream that a',
        '> recorded mechanism was read from has moved. Nothing was implemented or merged: each',
        '> entry below is a decision for the owner. Locators are sealed (`link_crypto decrypt`);',
        '> the local report under the user-global `runtime/lineage/watch/` has the rest.',
        '',
    ];
    for (const m of [...byMechanism.keys()].sort()) {
        out.push(`## Mechanism \`${m}\``, '', ...(byMechanism.get(m) as WatchFinding[]).map(line), '');
    }
    if (unowned.length > 0) out.push('## New upstream entries no mechanism covers', '', ...unowned.map(line), '');
    out.push(
        '## Kill criteria',
        '',
        '- Every entry above is re-verified, reopened or dismissed in `provenance/mechanisms.jsonl` — then delete this stub.',
        '',
    );
    return out.join('\n');
}
