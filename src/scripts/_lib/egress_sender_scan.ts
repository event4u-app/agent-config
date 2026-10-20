/**
 * Sender census — every module of this package that posts to a model-provider
 * endpoint, derived from the tree rather than listed by hand
 * (road-to-one-detector-and-the-senders-we-own, step 0.4; contract
 * docs/contracts/egress-placeholders-v1.md § This package's own senders).
 *
 * A row is a claim about source text, not about what leaves at runtime. Its
 * worst failure is an absent row, so anything the scanner cannot settle is a
 * row marked `unclassified` instead of silence: a provider endpoint named with
 * no recognised send shape, a send shape aimed at a host on neither list, and a
 * media adapter whose endpoint is configured rather than written down. The
 * residual — a module whose endpoint is computed and whose send shape matches
 * nothing below — is stated in the rendered table's own header.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export type SenderStatus = 'sender' | 'local' | 'unclassified';

/** `undeclared` until the module carries an `egress-content:` marker. */
export type SenderContent = 'session-content' | 'fixed-corpus' | 'undeclared';

/**
 * What the contract may publish for the module (step 3.4): `asserted` — its
 * requests pass the replacement and the final check; `fixed-corpus` — it sends
 * a corpus this package fixed, never session content; `uncovered` — it may send
 * session content unchecked, for the stated reason. `undeclared` is no answer
 * and fails the census.
 */
export type SenderCoverage = 'asserted' | 'fixed-corpus' | 'uncovered' | 'undeclared';

export interface SenderRow {
    /** Repo-relative, POSIX separators. */
    readonly module: string;
    /** Provider or other hosts the module names, sorted; `configured` when it names none. */
    readonly endpoints: readonly string[];
    readonly content: SenderContent;
    /** True when the module imports the egress engine directly (one hop). */
    readonly engine: boolean;
    readonly status: SenderStatus;
    readonly evidence: string;
    readonly coverage: SenderCoverage;
    /** Why the module has that coverage, as its marker states it; for `undeclared`, what is missing. */
    readonly reason: string;
}

export const SCAN_ROOTS: readonly string[] = ['src/scripts', 'src/cli', 'src/install', 'src/shared'];

/** Hosts that answer as a model or media-generation provider. */
export const PROVIDER_HOSTS: readonly string[] = [
    'api.anthropic.com',
    'api.openai.com',
    'generativelanguage.googleapis.com',
    'api.x.ai',
    'api.perplexity.ai',
    'api.mistral.ai',
    'openrouter.ai',
    'api.deepseek.com',
    'api.groq.com',
    'api.together.xyz',
    'api.cohere.com',
    'api.replicate.com',
    'queue.fal.run',
    'fal.run',
    'api.ideogram.ai',
    'external.api.recraft.ai',
    'api.bfl.ai',
    'api.bfl.ml',
    'platform.higgsfield.ai',
    'api.klingai.com',
    'api.sync.so',
    'api.stability.ai',
    'api.elevenlabs.io',
    'api.lumalabs.ai',
    'api.runwayml.com',
];

/** Hosts this package talks to that are not model providers; a send to one makes no row. */
export const NON_PROVIDER_HOSTS: readonly string[] = [
    'github.com',
    'api.github.com',
    'cli.github.com',
    'codeload.github.com',
    'objects.githubusercontent.com',
    'raw.githubusercontent.com',
    'registry.npmjs.org',
    'www.npmjs.com',
    'old.reddit.com',
    'www.reddit.com',
    'example.com',
    'example.org',
];

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1']);

const SEND_SHAPES: readonly RegExp[] = [
    /\bawait\s+fetch\s*\(/,
    /\bawait\s+(?:this|self|[a-z_$][\w$]*)\s*\.\s*_?fetch\s*\(/i,
    /\bhttps?\s*\.\s*request\s*\(/,
    /\b(?:spawnSync|spawn|execFileSync|execFile|execSync)\s*\(\s*\[?\s*['"`]curl['"`]/,
    /^\s*[^#\n]*\bcurl\s+-/m,
];

const URL_HOST = /https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+|localhost)(?=[:/'"`\s)]|$)/gi;
// `egress-content: fixed-corpus — <reason>`, or `egress-content: session-content
// asserted|uncovered — <reason>`. The reason is the claim a reviewer checks.
const CONTENT_MARKER =
    /(?:\/\/|#)\s*egress-content:\s*(session-content|fixed-corpus)\b(?:[ \t]+(asserted|uncovered)\b)?(?:[ \t]*(?:—|--)[ \t]*(\S[^\n]*))?/;
// `asserted` is a claim about the final check, so the module must reach it.
const FINAL_CHECK_IMPORT = /import\s*\{[^}]*\bcouncilEgress\b[^}]*\}\s*from\s+['"][^'"]*council_egress(?:\.js)?['"]/;
// Passing the engine means importing a function that detects or replaces; a
// module that reads only a table constant (a vendor key prefix) does not.
const ENGINE_IMPORT =
    /import\s*\{[^}]*\b(?:detect|findSpans|replaceSpans|replaceValues)\b[^}]*\}\s*from\s+['"][^'"]*egress_(?:token|rules)(?:\.js)?['"]/;
const ADAPTER_DIR = /^src\/scripts\/ai-(?:image|video)\/adapters\/[^/]+\.sh$/;

/** The scanner and its CLI quote every host above; a row for them would be the scanner reading itself. */
const SELF_MODULES: ReadonlySet<string> = new Set([
    'src/scripts/_lib/egress_sender_scan.ts',
    'src/scripts/egress_sender_census.ts',
]);

const EXCLUDE = /(?:^|\/)(?:__tests__|node_modules)\/|\.test\.ts$|\.d\.ts$/;

function escapeHost(h: string): string {
    return h.replace(/[.]/g, '\\.');
}

const PROVIDER_RE = new RegExp(
    `(?<![a-z0-9.-])(${[...PROVIDER_HOSTS].sort((a, b) => b.length - a.length).map(escapeHost).join('|')})(?![a-z0-9-])`,
    'gi',
);

export class SenderScanError extends Error {
    constructor(readonly dir: string, cause: unknown) {
        super(`egress_sender_scan: cannot read ${dir} — the census is incomplete, not clean (${String(cause)})`);
        this.name = 'SenderScanError';
    }
}

function walk(abs: string, repoRoot: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch (exc) {
        throw new SenderScanError(abs, exc);
    }
    for (const e of entries) {
        const child = path.join(abs, e.name);
        const rel = path.relative(repoRoot, child).split(path.sep).join('/');
        if (e.isDirectory()) {
            if (!EXCLUDE.test(`${rel}/`)) walk(child, repoRoot, out);
        } else if (e.isFile() && /\.(?:ts|sh)$/.test(rel) && !EXCLUDE.test(rel)) {
            out.push(rel);
        }
    }
}

function coverageOf(
    marker: RegExpExecArray | null,
    reachesFinalCheck: boolean,
): { coverage: SenderCoverage; reason: string } {
    if (marker === null) return { coverage: 'undeclared', reason: 'no `egress-content:` marker' };
    const reason = (marker[3] ?? '').trim();
    if (reason === '') return { coverage: 'undeclared', reason: 'the marker states no reason' };
    if (marker[1] === 'fixed-corpus') {
        return marker[2] === undefined
            ? { coverage: 'fixed-corpus', reason }
            : { coverage: 'undeclared', reason: 'a fixed corpus takes no coverage word' };
    }
    if (marker[2] === 'uncovered') return { coverage: 'uncovered', reason };
    if (marker[2] === 'asserted') {
        return reachesFinalCheck
            ? { coverage: 'asserted', reason }
            : { coverage: 'undeclared', reason: 'claims `asserted` but does not import the final check' };
    }
    return { coverage: 'undeclared', reason: 'session content without `asserted` or `uncovered`' };
}

export function classifyModule(rel: string, src: string): SenderRow | null {
    if (SELF_MODULES.has(rel)) return null;
    const providers = new Set<string>();
    for (const m of src.matchAll(PROVIDER_RE)) providers.add((m[1] as string).toLowerCase());
    const unknown = new Set<string>();
    const loopback = new Set<string>();
    for (const m of src.matchAll(URL_HOST)) {
        const host = (m[1] as string).toLowerCase();
        if (providers.has(host) || PROVIDER_HOSTS.includes(host)) continue;
        if (LOOPBACK_HOSTS.has(host)) loopback.add(host);
        else if (!NON_PROVIDER_HOSTS.includes(host)) unknown.add(host);
    }
    const adapter = ADAPTER_DIR.test(rel);
    const sends = adapter || SEND_SHAPES.some((re) => re.test(src));
    const marker = CONTENT_MARKER.exec(src);
    const content = (marker?.[1] as SenderContent | undefined) ?? 'undeclared';
    const engine = ENGINE_IMPORT.test(src);
    const { coverage, reason } = coverageOf(marker, FINAL_CHECK_IMPORT.test(src));
    const row = (endpoints: Set<string>, status: SenderStatus, evidence: string): SenderRow => ({
        module: rel,
        endpoints: endpoints.size === 0 ? ['configured'] : [...endpoints].sort(),
        content,
        engine,
        status,
        evidence,
        coverage,
        reason,
    });

    if (providers.size > 0) {
        return sends
            ? row(providers, 'sender', adapter ? 'media adapter naming a provider endpoint' : 'names a provider endpoint and carries a send shape')
            : row(providers, 'unclassified', 'names a provider endpoint with no recognised send shape — read the module');
    }
    if (sends && unknown.size > 0) {
        return row(unknown, 'unclassified', 'send shape aimed at a host on neither list — read the module');
    }
    if (adapter) {
        return loopback.size > 0
            ? row(loopback, 'local', 'media adapter whose only endpoint is loopback')
            : row(new Set(), 'unclassified', 'media adapter whose endpoint is configured, not written down');
    }
    return null;
}

export function scanSenders(repoRoot: string): SenderRow[] {
    const files: string[] = [];
    for (const root of SCAN_ROOTS) {
        const abs = path.join(repoRoot, root);
        if (fs.existsSync(abs)) walk(abs, repoRoot, files);
    }
    files.sort();
    const rows: SenderRow[] = [];
    for (const rel of files) {
        const r = classifyModule(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf-8'));
        if (r !== null) rows.push(r);
    }
    return rows;
}

/** Rows the census refuses: a sender with no answer. */
export function undeclared(rows: readonly SenderRow[]): SenderRow[] {
    return rows.filter((r) => r.coverage === 'undeclared');
}

export function tally(rows: readonly SenderRow[]): Record<SenderStatus, number> {
    const out: Record<SenderStatus, number> = { sender: 0, local: 0, unclassified: 0 };
    for (const r of rows) out[r.status] += 1;
    return out;
}

export function renderTable(rows: readonly SenderRow[]): string {
    const lines = [
        '| module | endpoint | content | engine | status | evidence | coverage | reason |',
        '|---|---|---|---|---|---|---|---|',
    ];
    for (const r of rows) {
        const endpoints = r.endpoints.map((e) => `\`${e}\``).join(', ');
        lines.push(
            `| \`${r.module}\` | ${endpoints} | ${r.content} | ${r.engine ? 'yes' : 'no'} | **${r.status}** | ${r.evidence} | ` +
                `**${r.coverage}** | ${r.reason.replace(/\|/g, '\\|')} |`,
        );
    }
    const t = tally(rows);
    lines.push('');
    const c = { asserted: 0, 'fixed-corpus': 0, uncovered: 0, undeclared: 0 };
    for (const r of rows) c[r.coverage] += 1;
    lines.push(
        `${String(rows.length)} module(s): ${String(t.sender)} sender, ${String(t.local)} local, ` +
            `${String(t.unclassified)} unclassified; coverage ${String(c.asserted)} asserted, ` +
            `${String(c['fixed-corpus'])} fixed-corpus, ${String(c.uncovered)} uncovered, ` +
            `${String(c.undeclared)} undeclared.`,
    );
    return lines.join('\n');
}
