#!/usr/bin/env tsx
/**
 * compaction_census — what the host's own transcripts say about compaction.
 *
 * Two questions the tree had parked behind "needs a live session and a human":
 *
 *   1. IDENTITY. `rule-inject` (`armRestore`) and `language-mirror`
 *      (`pinLostMarker`) write state at `pre_compact` under the session id and
 *      read it back at `session_start(compact)` under the session id. Both are
 *      sound only if the host keeps the id across the compaction. The council
 *      record `compact-resume-2026-10` names this "not measured".
 *   2. PRESENCE. The compaction-survival census stub waits on a manual
 *      compaction. The host already writes every compaction — automatic ones
 *      included — into the session JSONL: a `compact_boundary` system record,
 *      then a user record flagged `isCompactSummary` that carries the summary
 *      the model continues from. Whether a probe is still in that text is a
 *      deterministic question about a file that already exists.
 *
 * Output is aggregate counts only. No path, no session id, no summary text
 * leaves this process: the corpus is a user's private transcripts.
 *
 * PRESENCE IS A LOWER BOUND ON NOTHING BUT PRESENCE. A rule named in a summary
 * is not a rule followed; whether it is followed stays eval work in the stub.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface Probe {
    readonly label: string;
    readonly pattern: RegExp;
}

export interface CompactionCensus {
    files: number;
    boundaries: number;
    triggers: Record<string, number>;
    identity: { same: number; changed: number; unobserved: number };
    summaries: number;
    presence: Record<string, number>;
    tokens: { pre_median: number | null; post_median: number | null };
    host_versions: { min: string | null; max: string | null };
}

type Rec = Record<string, unknown>;

function textOf(rec: Rec): string {
    const msg = rec['message'];
    if (!msg || typeof msg !== 'object') return '';
    const content = (msg as Rec)['content'];
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
        .map((part) => (part && typeof part === 'object' && typeof (part as Rec)['text'] === 'string' ? ((part as Rec)['text'] as string) : ''))
        .join('');
}

function median(xs: number[]): number | null {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

function versionKey(v: string): number[] {
    return v.split('.').map((p) => Number.parseInt(p, 10) || 0);
}

function cmpVersion(a: string, b: string): number {
    const ka = versionKey(a);
    const kb = versionKey(b);
    for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
        const d = (ka[i] ?? 0) - (kb[i] ?? 0);
        if (d !== 0) return d;
    }
    return 0;
}

/** Census over transcript JSONL texts. Pure: the caller does all file I/O. */
export function censusTexts(texts: readonly string[], probes: readonly Probe[]): CompactionCensus {
    const out: CompactionCensus = {
        files: 0,
        boundaries: 0,
        triggers: {},
        identity: { same: 0, changed: 0, unobserved: 0 },
        summaries: 0,
        presence: Object.fromEntries(probes.map((p) => [p.label, 0])),
        tokens: { pre_median: null, post_median: null },
        host_versions: { min: null, max: null },
    };
    const pre: number[] = [];
    const post: number[] = [];
    for (const text of texts) {
        let sawBoundary = false;
        let last: string | null = null;
        let open: { before: string | null; summarised: boolean } | null = null;
        for (const line of text.split('\n')) {
            if (!line.trim()) continue;
            let rec: Rec;
            try {
                rec = JSON.parse(line) as Rec;
            } catch {
                continue;
            }
            if (rec['type'] === 'system' && rec['subtype'] === 'compact_boundary') {
                if (open && open.before !== null) out.identity.unobserved++;
                sawBoundary = true;
                out.boundaries++;
                const meta = (rec['compactMetadata'] ?? {}) as Rec;
                const trigger = typeof meta['trigger'] === 'string' ? (meta['trigger'] as string) : 'unknown';
                out.triggers[trigger] = (out.triggers[trigger] ?? 0) + 1;
                if (typeof meta['preTokens'] === 'number') pre.push(meta['preTokens'] as number);
                if (typeof meta['postTokens'] === 'number') post.push(meta['postTokens'] as number);
                const before: string | null = typeof rec['sessionId'] === 'string' ? (rec['sessionId'] as string) : last;
                open = { before, summarised: false };
                const v = rec['version'];
                if (typeof v === 'string') {
                    if (out.host_versions.min === null || cmpVersion(v, out.host_versions.min) < 0) out.host_versions.min = v;
                    if (out.host_versions.max === null || cmpVersion(v, out.host_versions.max) > 0) out.host_versions.max = v;
                }
                continue;
            }
            if (open && !open.summarised && rec['isCompactSummary'] === true) {
                open.summarised = true;
                out.summaries++;
                const summary = textOf(rec);
                for (const p of probes) if (p.pattern.test(summary)) out.presence[p.label]!++;
            }
            const sid = typeof rec['sessionId'] === 'string' ? (rec['sessionId'] as string) : null;
            if (sid !== null) {
                if (open && open.before !== null && rec['isCompactSummary'] !== undefined) {
                    if (sid === open.before) out.identity.same++;
                    else out.identity.changed++;
                    open.before = null;
                }
                last = sid;
            }
        }
        if (open && open.before !== null) out.identity.unobserved++;
        if (sawBoundary) out.files++;
    }
    out.tokens = { pre_median: median(pre), post_median: median(post) };
    return out;
}

/** Rule slugs from `src/rules/*.md`, so a probe can ask "does the summary name any rule". */
export function ruleSlugs(repoRoot: string): string[] {
    const dir = path.join(repoRoot, 'src', 'rules');
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.slice(0, -3))
        .filter((s) => s.includes('-'));
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function defaultProbes(repoRoot: string): Probe[] {
    const slugs = ruleSlugs(repoRoot);
    const probes: Probe[] = [
        { label: 'roadmap_path', pattern: /agents\/roadmaps\/[\w./-]+\.md/ },
        { label: 'iron_law', pattern: /\bIron Law\b/ },
    ];
    if (slugs.length > 0) {
        probes.push({ label: 'rule_slug_any', pattern: new RegExp(`\\b(?:${slugs.map(escapeRe).join('|')})\\b`) });
    }
    return probes;
}

function walk(dir: string, acc: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, acc);
        else if (e.isFile() && e.name.endsWith('.jsonl')) acc.push(p);
    }
}

export function defaultRoots(env: NodeJS.ProcessEnv = process.env): string[] {
    const roots = [path.join(os.homedir(), '.claude', 'projects')];
    if (env['CLAUDE_CONFIG_DIR']) roots.push(path.join(env['CLAUDE_CONFIG_DIR'], 'projects'));
    return [...new Set(roots)];
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const roots: string[] = [];
    const probes: Probe[] = [];
    let noDefaults = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--root' && argv[i + 1]) roots.push(argv[++i]!);
        else if (a === '--canary' && argv[i + 1]) probes.push({ label: 'canary_name', pattern: new RegExp(`\\b${escapeRe(argv[++i]!)}\\b`) });
        else if (a === '--no-default-probes') noDefaults = true;
        else if (a === '--help' || a === '-h') {
            process.stdout.write(
                'compaction_census [--root <projects-dir>]... [--canary <name>] [--no-default-probes]\n' +
                    'Aggregate counts only: compaction triggers, session-id identity across the boundary,\n' +
                    'and presence of probes in the host-written compact summary (a lower bound).\n',
            );
            return 0;
        }
    }
    const repoRoot = process.cwd();
    if (!noDefaults) probes.unshift(...defaultProbes(repoRoot));
    const files: string[] = [];
    for (const r of roots.length > 0 ? roots : defaultRoots()) walk(r, files);
    // Overlapping roots (a host config dir passed twice, or symlinked into
    // another) would count one transcript twice, inflating every figure.
    const unique = new Set<string>();
    for (const f of files) {
        try {
            unique.add(fs.realpathSync(f));
        } catch {
            continue;
        }
    }
    const texts: string[] = [];
    for (const f of unique) {
        let t: string;
        try {
            t = fs.readFileSync(f, 'utf8');
        } catch {
            continue;
        }
        if (t.includes('"compact_boundary"')) texts.push(t);
    }
    if (texts.length === 0) {
        process.stderr.write('compaction_census: no transcript with a compact_boundary under the given roots\n');
        return 2;
    }
    process.stdout.write(`${JSON.stringify(censusTexts(texts, probes), null, 2)}\n`);
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = main();
}
