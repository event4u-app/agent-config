#!/usr/bin/env tsx
/**
 * sweep_source_surfaces — the full-surface source-attribution census
 * (`road-to-source-silence` Phase 0.1).
 *
 * `check_no_external_sources` scans one surface: the CONTENT of tracked files.
 * The measurement that motivated this roadmap found leaks on four more —
 * tracked file PATHS, commit messages on the trunk, branch refs, and PR titles
 * and bodies — none of which any check has ever looked at. This sweep is the
 * inventory over all five.
 *
 * ## Why the output is encrypted and not printed
 *
 * The findings list is, by construction, the most concentrated source
 * disclosure this repository has ever held — it is every name the programme
 * exists to hide, gathered into one file. So the tracked artefact carries
 * **per-surface counts plus an `ENC1:` ciphertext** and nothing else
 * (Phase 0.2). `--json` prints plaintext and is for a maintainer at a terminal;
 * it must never be redirected into a tracked file.
 *
 * ## Surfaces
 *
 * | id | source | needs |
 * |---|---|---|
 * | `content` | tracked file bodies | git |
 * | `path` | tracked file paths | git |
 * | `commit` | `<base>` commit subjects + bodies | git, a resolvable base ref |
 * | `branch` | local + remote branch refs | git |
 * | `pr` | PR titles + bodies | `gh`, network |
 *
 * A surface that cannot be read is reported as `unavailable` with its reason —
 * never as zero. A zero that means "nobody looked" is the failure this
 * repository's own scan-scope discipline exists to prevent.
 *
 * ## Matchers
 *
 * - `denylist` — the `deny` patterns from `external_sources_denylist.json`.
 * - `shape` — the name-list-independent heuristic in `_lib/source_shape.ts`.
 *
 * Usage:
 *   sweep_source_surfaces [--json] [--census <path>] [--decrypt <path>]
 *                         [--base <ref>] [--no-remote] [--limit <n>]
 *
 * Exit codes: 0 = the sweep ran (findings are data, not a failure), 2 = usage
 * or config error. This is a census, not a gate: it never fails a build.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { decrypt, encrypt, resolve_keys } from './_lib/link_crypto.js';
import { shapeHits, shapePathHits, tierFor } from './_lib/source_shape.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CONFIG = path.join(path.dirname(_HERE), 'external_sources_denylist.json');

const SKIP_EXT = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz',
    '.woff', '.woff2', '.ttf', '.mp3', '.mp4', '.wav', '.lock',
]);

export const SURFACES = ['content', 'path', 'commit', 'branch', 'pr'] as const;
export type Surface = (typeof SURFACES)[number];

export interface Finding {
    surface: Surface;
    /** `file:line`, a ref name, or `PR #<n>`. */
    anchor: string;
    matcher: 'denylist' | 'shape';
    /** Deny pattern, or the shape class. */
    kind: string;
    tier: 'block' | 'warn';
    /** The offending text, truncated. Present only in the plaintext output. */
    excerpt: string;
}

export interface SurfaceReport {
    surface: Surface;
    status: 'scanned' | 'unavailable';
    /** Units actually read — never omitted, so a zero can be told from a blind run. */
    scanned: number;
    unit: string;
    reason?: string;
    counts: { denylist: number; shape: number; block: number; warn: number; total: number };
}

function sh(cmd: string, args: string[], cwd = ROOT): { ok: boolean; out: string; err: string } {
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf-8', maxBuffer: 512 * 1024 * 1024 });
    return { ok: r.status === 0, out: r.stdout ?? '', err: (r.stderr ?? '').trim() };
}

function loadDeny(): Array<[string, RegExp]> {
    const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf-8')) as { deny?: string[] };
    if (!cfg.deny || cfg.deny.length === 0) throw new Error('config error: empty deny list');
    return cfg.deny.map((p) => [p, new RegExp(p, 'i')] as [string, RegExp]);
}

/** Deny + shape hits on one text unit, tagged with the tier its location implies. */
function scanText(
    text: string,
    anchor: string,
    surface: Surface,
    tier: 'block' | 'warn',
    deny: ReadonlyArray<[string, RegExp]>,
    pathLike = false,
): Finding[] {
    const out: Finding[] = [];
    for (const [raw, rx] of deny) {
        if (rx.test(text)) {
            out.push({ surface, anchor, matcher: 'denylist', kind: raw, tier: 'block', excerpt: text.slice(0, 160) });
        }
    }
    for (const h of pathLike ? shapePathHits(text) : shapeHits(text)) {
        out.push({ surface, anchor, matcher: 'shape', kind: h.cls, tier, excerpt: h.value });
    }
    return out;
}

// --------------------------------------------------------------------------- //
// Surfaces
// --------------------------------------------------------------------------- //

function sweepTracked(
    deny: ReadonlyArray<[string, RegExp]>,
): [SurfaceReport, SurfaceReport, Finding[], Array<{ anchor: string; text: string }>] {
    const ls = sh('git', ['ls-files']);
    const empty = (s: Surface, unit: string, reason: string): SurfaceReport => ({
        surface: s, status: 'unavailable', scanned: 0, unit, reason, counts: zero(),
    });
    if (!ls.ok) {
        return [empty('content', 'file', 'git ls-files failed'), empty('path', 'file', 'git ls-files failed'), [], []];
    }
    const tracked = ls.out.split('\n').filter(Boolean);
    const findings: Finding[] = [];
    const cueTexts: Array<{ anchor: string; text: string }> = [];
    let read = 0;
    for (const rel of tracked) {
        const tier = tierFor(rel);
        findings.push(...scanText(rel, rel, 'path', tier, deny, true));
        const dot = (rel.split('/').pop() as string).lastIndexOf('.');
        const ext = dot > 0 ? (rel.split('/').pop() as string).slice(dot).toLowerCase() : '';
        if (SKIP_EXT.has(ext)) continue;
        let body: string;
        try {
            const abs = path.join(ROOT, rel);
            if (!fs.statSync(abs).isFile()) continue;
            body = fs.readFileSync(abs, 'utf-8');
        } catch {
            continue;
        }
        read += 1;
        const lines = body.split('\n');
        for (let i = 0; i < lines.length; i += 1) {
            const ln = lines[i] as string;
            const anchor = `${rel}:${String(i + 1)}`;
            findings.push(...scanText(ln, anchor, 'content', tier, deny));
            if (CUE_RE.test(ln)) cueTexts.push({ anchor, text: ln });
        }
    }
    const content = findings.filter((f) => f.surface === 'content');
    const paths = findings.filter((f) => f.surface === 'path');
    return [
        { surface: 'content', status: 'scanned', scanned: read, unit: 'text file', counts: tally(content) },
        { surface: 'path', status: 'scanned', scanned: tracked.length, unit: 'tracked path', counts: tally(paths) },
        findings,
        cueTexts,
    ];
}

function sweepCommits(deny: ReadonlyArray<[string, RegExp]>, base: string): [SurfaceReport, Finding[]] {
    const probe = sh('git', ['rev-parse', '--verify', '--quiet', base]);
    if (!probe.ok) {
        return [{ surface: 'commit', status: 'unavailable', scanned: 0, unit: 'commit', reason: `base ref ${base} not resolvable`, counts: zero() }, []];
    }
    const log = sh('git', ['log', '--format=%H%x1f%s%x1f%b%x1e', base]);
    if (!log.ok) {
        return [{ surface: 'commit', status: 'unavailable', scanned: 0, unit: 'commit', reason: 'git log failed', counts: zero() }, []];
    }
    const recs = log.out.split('\x1e').map((r) => r.trim()).filter(Boolean);
    const findings: Finding[] = [];
    for (const rec of recs) {
        const [sha, subject, body] = rec.split('\x1f');
        const anchor = `commit ${(sha ?? '').slice(0, 9)}`;
        // A commit message is not a tracked path, so `agents/**` tiering cannot
        // apply; the trunk's public record is treated as block-tier throughout.
        findings.push(...scanText(`${subject ?? ''}\n${body ?? ''}`, anchor, 'commit', 'block', deny));
    }
    return [{ surface: 'commit', status: 'scanned', scanned: recs.length, unit: 'commit', counts: tally(findings) }, findings];
}

function sweepBranches(deny: ReadonlyArray<[string, RegExp]>): [SurfaceReport, Finding[]] {
    const r = sh('git', ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes']);
    if (!r.ok) {
        return [{ surface: 'branch', status: 'unavailable', scanned: 0, unit: 'ref', reason: 'git for-each-ref failed', counts: zero() }, []];
    }
    const refs = r.out.split('\n').filter(Boolean);
    const findings: Finding[] = [];
    for (const ref of refs) findings.push(...scanText(ref, ref, 'branch', 'block', deny, true));
    return [{ surface: 'branch', status: 'scanned', scanned: refs.length, unit: 'ref', counts: tally(findings) }, findings];
}

function sweepPulls(deny: ReadonlyArray<[string, RegExp]>, limit: number): [SurfaceReport, Finding[]] {
    const r = sh('gh', ['pr', 'list', '--state', 'all', '--limit', String(limit), '--json', 'number,title,body,headRefName']);
    if (!r.ok) {
        return [{ surface: 'pr', status: 'unavailable', scanned: 0, unit: 'pull request', reason: `gh pr list failed: ${r.err.slice(0, 120)}`, counts: zero() }, []];
    }
    let prs: Array<{ number: number; title: string; body: string; headRefName: string }>;
    try {
        prs = JSON.parse(r.out) as typeof prs;
    } catch {
        return [{ surface: 'pr', status: 'unavailable', scanned: 0, unit: 'pull request', reason: 'gh returned unparseable JSON', counts: zero() }, []];
    }
    const findings: Finding[] = [];
    // Dependency-bot PRs are excluded, and the reason is the one the config's
    // own `r2_review_diff_capture` skip already states: a bot's body is a
    // MECHANICAL CAPTURE of an upstream changelog, not authored attribution.
    // Measured before the carve-out: 2,434 of the PR surface's 2,449 shape hits
    // came from bot bodies linking the release notes of the packages they bump
    // (top owners 856 / 213 / 203 / 150 …), which is dependency provenance —
    // a class `provenance/borrows.jsonl` REQUIRES to name its upstream. Leaving
    // them in would have buried the 15 real hits under a 99.4 % noise floor.
    const bot = (ref: string): boolean => /^(?:dependabot|renovate)\//.test(ref);
    const authored = prs.filter((p) => !bot(p.headRefName ?? ''));
    for (const pr of authored) {
        const anchor = `PR #${String(pr.number)}`;
        findings.push(...scanText(`${pr.title}\n${pr.body ?? ''}\n${pr.headRefName}`, anchor, 'pr', 'block', deny));
    }
    return [{ surface: 'pr', status: 'scanned', scanned: authored.length, unit: 'authored pull request', counts: tally(findings) }, findings];
}

// --------------------------------------------------------------------------- //
// Candidate discovery — the half the deny set structurally cannot do
// --------------------------------------------------------------------------- //

/**
 * The deny set finds a source somebody already wrote down; the shape heuristic
 * finds three specific FORMS. Neither can find a family named as a bare word in
 * prose — which is exactly the class the roadmap's measurement table counts
 * (twelve token families, 0 of 12 in the deny array). Something has to look, or
 * Phase 0.3 ("extend the deny set from the census") has no input.
 *
 * This is that something, and it is a **review aid, not a matcher**: it lists
 * identifier-shaped tokens that co-occur with an attribution cue on the same
 * line and are not already denied. A human reads the ranked list and decides.
 * It over-reports on purpose — a candidate list that needs pruning is cheap; a
 * family nobody surfaced is the defect this roadmap exists for.
 */
const CUE_RE =
    /\b(?:inspired\s+by|harvested\s+from|harvest\s+source|borrowed\s+from|ported\s+from|adapted\s+from|derived\s+from|copied\s+from|forked\s+from|taken\s+from|lifted\s+from|modelled\s+after|modeled\s+after|reference\s+repo(?:sitory)?|external\s+reference|upstream\s+(?:is|repo|project|source))\b/i;

/** Identifier-shaped: a hyphenated lowercase token, or an `owner/repo` pair. */
const CANDIDATE_RE = /\b([a-z][a-z0-9]*(?:-[a-z0-9]+){1,4})\b/g;

/** Tokens that are this suite's own vocabulary, not a candidate source. */
const OWN_VOCAB =
    /^(?:agent-|road-to-|check-|lint-|audit-|skill-|rule-|dist-|src-|non-|pre-|post-|self-|cross-|multi-|sub-|re-|co-|user-|host-|token-|source-|third-party|read-only|write-only|end-to-end|up-to-date|opt-in|opt-out|fail-|well-|so-called)/;

export interface Candidate {
    token: string;
    hits: number;
    /** First anchor the token was seen at, for a human to open. */
    first: string;
}

export function discoverCandidates(
    findings: readonly Finding[],
    texts: ReadonlyArray<{ anchor: string; text: string }>,
    deny: ReadonlyArray<[string, RegExp]>,
): Candidate[] {
    const seen = new Map<string, Candidate>();
    for (const { anchor, text } of texts) {
        if (!CUE_RE.test(text)) continue;
        const cue = CUE_RE.exec(text);
        const cueAt = cue ? cue.index : 0;
        CANDIDATE_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = CANDIDATE_RE.exec(text)) !== null) {
            const tok = m[1] as string;
            // Proximity: a hyphenated token 200 characters away from the cue is
            // a coincidence, not the object of the attribution.
            if (Math.abs(m.index - cueAt) > 60) continue;
            if (OWN_VOCAB.test(tok)) continue;
            if (deny.some(([, rx]) => rx.test(tok))) continue;
            const prev = seen.get(tok);
            if (prev) prev.hits += 1;
            else seen.set(tok, { token: tok, hits: 1, first: anchor });
        }
    }
    void findings;
    return [...seen.values()].sort((a, b) => b.hits - a.hits || a.token.localeCompare(b.token));
}

// --------------------------------------------------------------------------- //
// Reporting
// --------------------------------------------------------------------------- //

function zero(): SurfaceReport['counts'] {
    return { denylist: 0, shape: 0, block: 0, warn: 0, total: 0 };
}

export function tally(f: readonly Finding[]): SurfaceReport['counts'] {
    return {
        denylist: f.filter((x) => x.matcher === 'denylist').length,
        shape: f.filter((x) => x.matcher === 'shape').length,
        block: f.filter((x) => x.tier === 'block').length,
        warn: f.filter((x) => x.tier === 'warn').length,
        total: f.length,
    };
}

export interface SweepResult {
    reports: SurfaceReport[];
    findings: Finding[];
    /** Ranked un-denied tokens on attribution-cue lines — Phase 0.3's input. */
    candidates: Candidate[];
}

export function runSweep(opts: { base: string; remote: boolean; limit: number }): SweepResult {
    const deny = loadDeny();
    const [content, paths, trackedFindings, cueTexts] = sweepTracked(deny);
    const [commit, commitFindings] = sweepCommits(deny, opts.base);
    const [branch, branchFindings] = sweepBranches(deny);
    const [pr, prFindings] = opts.remote
        ? sweepPulls(deny, opts.limit)
        : ([{ surface: 'pr' as const, status: 'unavailable' as const, scanned: 0, unit: 'pull request', reason: '--no-remote', counts: zero() }, [] as Finding[]] as [SurfaceReport, Finding[]]);
    const findings = [...trackedFindings, ...commitFindings, ...branchFindings, ...prFindings];
    return {
        reports: [content, paths, commit, branch, pr],
        findings,
        candidates: discoverCandidates(findings, cueTexts, deny),
    };
}

/** Per-class breakdown, names excluded — safe for a tracked artefact. */
export function classBreakdown(f: readonly Finding[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const x of f) {
        const key = x.matcher === 'denylist' ? 'denylist' : `shape:${x.kind}`;
        out[key] = (out[key] ?? 0) + 1;
    }
    return out;
}

function renderCounts(res: SweepResult): string {
    const lines: string[] = [];
    lines.push('| surface | status | scanned | denylist | shape | block | warn | total |');
    lines.push('|---|---|---:|---:|---:|---:|---:|---:|');
    for (const r of res.reports) {
        const c = r.counts;
        const st = r.status === 'scanned' ? 'scanned' : `unavailable (${r.reason ?? '?'})`;
        lines.push(
            `| \`${r.surface}\` | ${st} | ${String(r.scanned)} ${r.unit}(s) | ${String(c.denylist)} | ` +
                `${String(c.shape)} | ${String(c.block)} | ${String(c.warn)} | ${String(c.total)} |`,
        );
    }
    return lines.join('\n');
}

function main(argv: readonly string[]): number {
    const asJson = argv.includes('--json');
    const remote = !argv.includes('--no-remote');
    const bi = argv.indexOf('--base');
    const base = bi >= 0 && argv[bi + 1] !== undefined ? (argv[bi + 1] as string) : 'origin/main';
    const li = argv.indexOf('--limit');
    const limit = li >= 0 && argv[li + 1] !== undefined ? Number(argv[li + 1]) : 3000;
    if (!Number.isInteger(limit) || limit <= 0) {
        process.stderr.write('usage: --limit takes a positive integer\n');
        return 2;
    }

    const dIdx = argv.indexOf('--decrypt');
    if (dIdx >= 0) {
        if (argv[dIdx + 1] === undefined) {
            process.stderr.write('usage: --decrypt <census-file>\n');
            return 2;
        }
        return decryptCensus(path.resolve(ROOT, argv[dIdx + 1] as string));
    }

    let res: SweepResult;
    try {
        res = runSweep({ base, remote, limit });
    } catch (exc) {
        process.stderr.write(`${(exc as Error).message}\n`);
        return 2;
    }

    if (asJson) {
        // PLAINTEXT — every name the programme hides. Terminal only.
        process.stdout.write(
            JSON.stringify({ reports: res.reports, findings: res.findings, candidates: res.candidates }, null, 2) + '\n',
        );
        return 0;
    }

    process.stdout.write(renderCounts(res) + '\n\n');
    process.stdout.write(`classes: ${JSON.stringify(classBreakdown(res.findings))}\n`);
    process.stdout.write(`candidates: ${String(res.candidates.length)} un-denied token(s) on attribution-cue lines\n`);
    process.stdout.write(`scanned: ${String(res.reports.reduce((a, r) => a + r.scanned, 0))}\n`);

    const ci = argv.indexOf('--census');
    if (ci >= 0 && argv[ci + 1] !== undefined) {
        const out = path.resolve(ROOT, argv[ci + 1] as string);
        const keys = resolve_keys(ROOT);
        if (keys.length === 0) {
            process.stderr.write(
                '❌  no link-encryption key resolvable — refusing to write a census.\n' +
                    '    The findings list is plaintext source attribution; writing it unencrypted\n' +
                    '    would publish exactly what this sweep exists to inventory. Set\n' +
                    '    secrets.link_encryption_key in .agent-settings.yml (project or user-global)\n' +
                    '    or EVENT4U_LINK_KEY, then re-run.\n',
            );
            return 2;
        }
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, renderCensus(res, keys[0] as string), 'utf-8');
        process.stdout.write(`census: ${path.relative(ROOT, out)}\n`);
    }
    return 0;
}

/** Print the decrypted payload of a census file. Terminal only — plaintext names. */
export function decryptCensus(file: string): number {
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        process.stderr.write(`cannot read ${file}\n`);
        return 2;
    }
    const m = /ENC1:[A-Za-z0-9+/=]+/.exec(text);
    if (!m) {
        process.stderr.write('no ENC1 token in that file\n');
        return 2;
    }
    const keys = resolve_keys(ROOT);
    if (keys.length === 0) {
        process.stderr.write('no link-encryption key resolvable\n');
        return 2;
    }
    try {
        process.stdout.write(decrypt(m[0], keys) + '\n');
    } catch (exc) {
        process.stderr.write(`${(exc as Error).message}\n`);
        return 2;
    }
    return 0;
}

/** The tracked artefact: counts in the clear, findings as one `ENC1:` line. */
export function renderCensus(res: SweepResult, key: string, now = new Date()): string {
    const cipher = encrypt(JSON.stringify({ findings: res.findings, candidates: res.candidates }), key);
    const stamp = now.toISOString().slice(0, 10);
    const residual = res.findings.filter((f) => f.surface === 'commit' || f.surface === 'pr').length;
    return `<!-- evidence-type: analysis -->
# Source-attribution census — every surface, counts only

> Generated by \`./scripts-run src/scripts/sweep_source_surfaces --census <path>\`
> on ${stamp}. Regenerate rather than hand-edit.

**This file deliberately contains no source name.** The findings list is the
most concentrated source disclosure this repository could hold, so it lives
below as a single \`ENC1:\` ciphertext (\`src/scripts/_lib/link_crypto.ts\`) and
the readable half is counts. Decrypt with:

\`\`\`bash
./scripts-run src/scripts/sweep_source_surfaces --decrypt <this file>
\`\`\`

Read it from the FILE, never by pasting the token into
\`link_crypto decrypt --value\`: the ciphertext is ~320 kB on one line and a
shell argument that size is mangled before the CLI ever sees it (reproduced —
the paste path reports \`authentication failed\`, the file path round-trips).

## Per-surface counts

${renderCounts(res)}

## Per-class counts

\`\`\`json
${JSON.stringify(classBreakdown(res.findings), null, 2)}
\`\`\`

candidates: ${String(res.candidates.length)}

The \`candidates:\` field counts un-denied identifier-shaped tokens found on
attribution-cue lines. It is Phase 0.3's **input**, not its result: a human
reads the decrypted list and decides which are real source families. It
over-reports by design — the deny set structurally cannot find a family nobody
listed, so something has to over-report or nothing looks at all.

residual: ${String(residual)}

The \`residual:\` field is the count on the two **immutable** surfaces — commit
messages already on the trunk, and PR bodies of merged pull requests. The
\`whether-history-gets-rewritten\` blocker resolved **(a) — no rewrite**, so this
number is accepted debt that is counted rather than removed. It does not shrink
to zero and is not meant to: anyone with repository access can still recover
those names from history, and no phase of this programme changes that.

## Findings (encrypted)

${cipher}
`;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}

export { main };
