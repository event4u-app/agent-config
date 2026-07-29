#!/usr/bin/env tsx
/**
 * Frozen labelled corpus for the text-layer encoding channels
 * (road-to-runtime-encoding-hardening Phase 2).
 *
 * Own code. The channel TAXONOMY is this package's own Phase-1 measurement
 * (`agents/evidence/reports/encoding-channel-coverage.md`); no fixture, payload,
 * or encoder is derived from any external source.
 *
 * Two properties the freeze depends on:
 *
 *   1. DETERMINISTIC. No `Math.random`, no clock. Carrier selection and channel
 *      assignment are index-derived, so the emitted corpus is byte-identical on
 *      every run and the sha256 manifest is meaningful. Re-running this script
 *      must never change the corpus without a source change.
 *
 *   2. NEUTRAL CARRIERS. Carrier sentences are ordinary engineering prose, not
 *      injection strings. The detectors under test are STRUCTURAL — they read
 *      codepoints, not meaning — so carrier semantics are irrelevant to recall,
 *      and using neutral text keeps this from becoming a reusable attack
 *      corpus. This matches the payload-free stance of
 *      `skills/judge-injection-defense/fixtures/perturbation-taxonomy.json`.
 *
 * Negatives are drawn from REAL in-repo content (rule bodies, retrieval-store
 * chunks, inter-agent message shapes) so the false-positive rate is measured
 * against realistic traffic rather than toy text.
 *
 * Usage:
 *     encoding_corpus --emit     # write the corpus + manifest
 *     encoding_corpus --check    # verify on-disk corpus matches the manifest
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(_HERE, '..', '..');
export const OUT_DIR = path.join(ROOT, 'internal', 'bench', 'corpora', 'encoding-channels');

const cp = (n: number): string => String.fromCodePoint(n);

// ---------------------------------------------------------------------------
// Channel encoders — one per in-scope TEXT-layer channel
// ---------------------------------------------------------------------------
//
// `layer` is asserted by the scope-guard test: the corpus must contain ONLY
// `text`. It exists so the corpus cannot silently drift into claiming coverage
// of file/network-layer steganography, which is out of this package's threat
// model (it governs text, not files or packets).

export type Layer = 'text';

export interface ChannelSpec {
    readonly id: string;
    readonly layer: Layer;
    /** `strip` = the floor removes it · `flag` = surfaced, text unchanged. */
    readonly disposition: 'strip' | 'flag';
    /** Splice the channel into a carrier. Must be deterministic. */
    readonly encode: (carrier: string, i: number) => string;
}

/** Insert `mark` inside the first word longer than 3 chars (stable choice). */
function _spliceIntoWord(carrier: string, mark: string): string {
    const words = carrier.split(' ');
    const idx = words.findIndex((w) => w.replace(/[^A-Za-z]/g, '').length > 3);
    const at = idx === -1 ? 0 : idx;
    const w = words[at] as string;
    const cut = Math.max(1, Math.floor(w.length / 2));
    words[at] = w.slice(0, cut) + mark + w.slice(cut);
    return words.join(' ');
}

/** Swap ASCII letters in the first eligible word for the given lookalikes. */
function _swapLookalikes(carrier: string, map: ReadonlyMap<string, string>): string {
    const words = carrier.split(' ');
    const idx = words.findIndex((w) => [...w.toLowerCase()].some((ch) => map.has(ch)));
    if (idx === -1) return carrier;
    const w = words[idx] as string;
    words[idx] = [...w].map((ch) => map.get(ch.toLowerCase()) ?? ch).join('');
    return words.join(' ');
}

const _CYRILLIC = new Map([['o', cp(0x043e)], ['e', cp(0x0435)], ['a', cp(0x0430)], ['i', cp(0x0456)]]);
const _GREEK = new Map([['o', cp(0x03bf)], ['a', cp(0x03b1)], ['p', cp(0x03c1)]]);

/** ASCII letter -> Mathematical Sans-Serif (U+1D5A0 upper / U+1D5BA lower). */
function _toMathSans(word: string): string {
    return [...word]
        .map((ch) => {
            const c = ch.codePointAt(0) as number;
            if (c >= 0x41 && c <= 0x5a) return cp(0x1d5a0 + (c - 0x41));
            if (c >= 0x61 && c <= 0x7a) return cp(0x1d5ba + (c - 0x61));
            return ch;
        })
        .join('');
}

/** ASCII -> Halfwidth/Fullwidth Forms (U+FF01 offset from U+0021). */
function _toFullwidth(word: string): string {
    return [...word]
        .map((ch) => {
            const c = ch.codePointAt(0) as number;
            return c >= 0x21 && c <= 0x7e ? cp(0xff01 + (c - 0x21)) : ch;
        })
        .join('');
}

function _mapFirstLongWord(carrier: string, fn: (w: string) => string): string {
    const words = carrier.split(' ');
    const idx = words.findIndex((w) => w.replace(/[^A-Za-z]/g, '').length > 3);
    const at = idx === -1 ? 0 : idx;
    words[at] = fn(words[at] as string);
    return words.join(' ');
}

export const CHANNELS: readonly ChannelSpec[] = [
    // --- invisible / control: already stripped by the live floor -------------
    {
        id: 'zero-width',
        layer: 'text',
        disposition: 'strip',
        encode: (c, i) => _spliceIntoWord(c, cp([0x200b, 0x200c, 0x200d][i % 3] as number)),
    },
    {
        id: 'zero-width-joiner-bom',
        layer: 'text',
        disposition: 'strip',
        encode: (c, i) => _spliceIntoWord(c, cp([0xfeff, 0x2060, 0x00ad][i % 3] as number)),
    },
    {
        id: 'bidi-control',
        layer: 'text',
        disposition: 'strip',
        encode: (c, i) => {
            const open = [0x202e, 0x202d, 0x2066, 0x2067][i % 4] as number;
            return cp(open) + c + cp(0x202c);
        },
    },
    {
        id: 'invisible-tag-block',
        layer: 'text',
        disposition: 'strip',
        encode: (c, i) => _spliceIntoWord(c, cp(0xe0041 + (i % 26))),
    },
    {
        id: 'deprecated-format',
        layer: 'text',
        disposition: 'strip',
        encode: (c, i) => _spliceIntoWord(c, cp([0x206a, 0x206c, 0x206e, 0xfff9][i % 4] as number)),
    },
    {
        id: 'private-use-area',
        layer: 'text',
        disposition: 'strip',
        encode: (c, i) => _spliceIntoWord(c, cp([0xe000, 0xe123, 0xf8ff][i % 3] as number)),
    },
    {
        id: 'control-char',
        layer: 'text',
        disposition: 'strip',
        encode: (c, i) => _spliceIntoWord(c, cp([0x01, 0x0b, 0x1b, 0x7f, 0x85, 0x9b][i % 6] as number)),
    },
    // --- Phase-1 gaps: uncovered by the live floor ---------------------------
    {
        id: 'invisible-filler',
        layer: 'text',
        disposition: 'strip', // Phase-1 disposition: invisible, no legitimate use here
        encode: (c, i) => _spliceIntoWord(c, cp([0x3164, 0x115f, 0x1160][i % 3] as number)),
    },
    {
        id: 'variation-selector-run',
        layer: 'text',
        disposition: 'flag', // a RUN is the signal; a single VS is legitimate (emoji)
        encode: (c, i) => {
            const base = 0xe0100 + (i % 8);
            const run = [base, base + 1, base + 2, base + 3].slice(0, 3 + (i % 2));
            return _spliceIntoWord(c, run.map(cp).join(''));
        },
    },
    {
        id: 'confusable-cyrillic',
        layer: 'text',
        disposition: 'flag',
        encode: (c) => _swapLookalikes(c, _CYRILLIC),
    },
    {
        id: 'confusable-greek',
        layer: 'text',
        disposition: 'flag',
        encode: (c) => _swapLookalikes(c, _GREEK),
    },
    {
        id: 'math-alphanumeric',
        layer: 'text',
        disposition: 'flag',
        encode: (c) => _mapFirstLongWord(c, _toMathSans),
    },
    {
        id: 'fullwidth-forms',
        layer: 'text',
        disposition: 'flag',
        encode: (c) => _mapFirstLongWord(c, _toFullwidth),
    },
    {
        id: 'combining-mark-run',
        layer: 'text',
        disposition: 'flag',
        encode: (c, i) => _spliceIntoWord(c, cp(0x0301).repeat(8 + (i % 8))),
    },
    {
        id: 'punycode-idn',
        layer: 'text',
        disposition: 'flag',
        encode: (c, i) => `${c} see xn--${['80ak6aa92e', 'e1afmkfd', 'mgbh0fb'][i % 3]}.example for detail`,
    },
];

// ---------------------------------------------------------------------------
// Carriers — ordinary engineering prose, deliberately not injection strings
// ---------------------------------------------------------------------------

export const CARRIERS: readonly string[] = [
    'The migration must remain reversible before it reaches production.',
    'Every list endpoint paginates or declares an explicit bound.',
    'Tenant scope is derived server side, never taken from the request body.',
    'Index parity is checked for each foreign key column.',
    'The dispatcher refuses to advance without recorded audit findings.',
    'Retention policy is declared for every append only table.',
    'Secrets rotate through the configured manager, not through committed files.',
    'A queue consumer retries with backoff and a dead letter path.',
    'Response shape changes require a documented deprecation window.',
    'Cache invalidation happens inside the same transaction boundary.',
    'The scheduler holds a lock so concurrent runs cannot overlap.',
    'Structured logging omits every direct identifier by construction.',
    'Feature flags default to the safe branch when the store is unreachable.',
    'Background jobs are idempotent because delivery is at least once.',
    'The health endpoint reports dependency status without leaking hostnames.',
    'Schema migrations expand first and contract in a later release.',
    'Authorization is asserted per object, not once per session.',
    'Uploads are validated server side against an allow list of types.',
    'Outbound requests carry a timeout and a bounded retry budget.',
    'Test data is generated from the schema so drift surfaces early.',
];

// ---------------------------------------------------------------------------
// Negatives — REAL in-repo content, so the FP rate is measured on real traffic
// ---------------------------------------------------------------------------

interface NegativeSource {
    readonly kind: 'rule-body' | 'retrieval-chunk' | 'inter-agent-message';
    /** Real in-repo directories. Several per kind, because one may be small. */
    readonly dirs: readonly string[];
    readonly quota: number;
}

// The three kinds the roadmap named. Each draws from real content of THAT kind —
// `agents/memory` is literally what `retrieve()` reads, and the orchestration
// prompt templates are literally what crosses the agent boundary. Multiple dirs
// per kind because `retrieval-store` alone yields only ~39 eligible lines, and
// the emitter must never pad a shortfall with invented text.
const _NEGATIVE_SOURCES: readonly NegativeSource[] = [
    { kind: 'rule-body', dirs: ['src/rules'], quota: 120 },
    {
        kind: 'retrieval-chunk',
        dirs: ['agents/memory', 'internal/bench/second-brain/retrieval-store'],
        quota: 120,
    },
    {
        kind: 'inter-agent-message',
        dirs: ['src/skills/subagent-orchestration/prompts', 'src/subagents'],
        quota: 120,
    },
];

function _listFiles(dir: string, exts: readonly string[]): string[] {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return [];
    const out: string[] = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
        }
    };
    walk(abs);
    return out.sort();
}

/** Sentence-ish slices of real content, long enough to be realistic traffic. */
function _realSnippets(dir: string, limit: number): string[] {
    const files = _listFiles(dir, ['.md', '.yml', '.yaml']);
    const out: string[] = [];
    for (const f of files) {
        const text = fs.readFileSync(f, 'utf-8');
        for (const raw of text.split('\n')) {
            const line = raw.trim();
            // Skip structure so negatives are prose/values, not markdown scaffold.
            if (line.length < 60 || line.length > 400) continue;
            if (/^[#>|\-*`+\[\]{}]/.test(line)) continue;
            if (line.includes('](')) continue;
            out.push(line);
            if (out.length >= limit) return out;
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Corpus construction
// ---------------------------------------------------------------------------

export interface CorpusEntry {
    readonly id: string;
    readonly label: 'positive' | 'negative';
    /** Channel id for positives; the source kind for negatives. */
    readonly channel: string;
    readonly layer: Layer;
    readonly disposition: 'strip' | 'flag' | 'none';
    readonly text: string;
}

export const MIN_POSITIVES = 300;
export const MIN_NEGATIVES = 300;

export function buildPositives(): CorpusEntry[] {
    const out: CorpusEntry[] = [];
    // Round-robin so the channel histogram is balanced by construction rather
    // than by luck: every channel gets the same count, over varied carriers.
    const perChannel = Math.ceil(MIN_POSITIVES / CHANNELS.length);
    for (const [ci, ch] of CHANNELS.entries()) {
        for (let k = 0; k < perChannel; k++) {
            const carrier = CARRIERS[(ci * perChannel + k) % CARRIERS.length] as string;
            out.push({
                id: `pos-${ch.id}-${String(k).padStart(3, '0')}`,
                label: 'positive',
                channel: ch.id,
                layer: ch.layer,
                disposition: ch.disposition,
                text: ch.encode(carrier, k),
            });
        }
    }
    return out;
}

export function buildNegatives(): CorpusEntry[] {
    const out: CorpusEntry[] = [];
    for (const src of _NEGATIVE_SOURCES) {
        const seen = new Set<string>();
        const collected: string[] = [];
        for (const dir of src.dirs) {
            for (const text of _realSnippets(dir, src.quota)) {
                if (collected.length >= src.quota) break;
                if (seen.has(text)) continue; // the same line can recur across files
                seen.add(text);
                collected.push(text);
            }
            if (collected.length >= src.quota) break;
        }
        for (const [k, text] of collected.entries()) {
            out.push({
                id: `neg-${src.kind}-${String(k).padStart(3, '0')}`,
                label: 'negative',
                channel: src.kind,
                layer: 'text',
                disposition: 'none',
                text,
            });
        }
    }
    return out;
}

function _jsonl(entries: readonly CorpusEntry[]): string {
    return entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
}

function _sha256(s: string): string {
    return crypto.createHash('sha256').update(s, 'utf-8').digest('hex');
}

export interface Manifest {
    readonly corpus_version: number;
    readonly note: string;
    readonly counts: { positives: number; negatives: number; channels: number };
    readonly channel_histogram: Record<string, number>;
    readonly sha256: Record<string, string>;
}

export function buildManifest(pos: readonly CorpusEntry[], neg: readonly CorpusEntry[]): Manifest {
    const hist: Record<string, number> = {};
    for (const e of pos) hist[e.channel] = (hist[e.channel] ?? 0) + 1;
    return {
        corpus_version: 1,
        note:
            'Frozen labelled corpus for text-layer encoding channels. Regenerate ONLY via ' +
            'encoding_corpus --emit after a deliberate source change; the sha256 entries are the ' +
            'freeze. Detectors are never tuned against this corpus (golden-set-freeze).',
        counts: { positives: pos.length, negatives: neg.length, channels: CHANNELS.length },
        channel_histogram: hist,
        sha256: { 'positives.jsonl': _sha256(_jsonl(pos)), 'negatives.jsonl': _sha256(_jsonl(neg)) },
    };
}

function _emit(): number {
    const pos = buildPositives();
    const neg = buildNegatives();
    if (pos.length < MIN_POSITIVES) {
        process.stderr.write(`error: ${pos.length} positives < required ${MIN_POSITIVES}\n`);
        return 1;
    }
    if (neg.length < MIN_NEGATIVES) {
        process.stderr.write(
            `error: ${neg.length} negatives < required ${MIN_NEGATIVES} — real-content sources ` +
                'did not yield enough snippets; widen the sources, never pad with toy text\n',
        );
        return 1;
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'positives.jsonl'), _jsonl(pos), 'utf-8');
    fs.writeFileSync(path.join(OUT_DIR, 'negatives.jsonl'), _jsonl(neg), 'utf-8');
    const manifest = buildManifest(pos, neg);
    fs.writeFileSync(
        path.join(OUT_DIR, 'manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n',
        'utf-8',
    );
    process.stdout.write(
        `✅  encoding corpus: ${pos.length} positives across ${CHANNELS.length} channels, ` +
            `${neg.length} negatives from real content\n`,
    );
    return 0;
}

function _check(): number {
    const manifestPath = path.join(OUT_DIR, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        process.stderr.write('error: manifest.json missing — run encoding_corpus --emit\n');
        return 1;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest;
    let bad = 0;
    for (const [name, want] of Object.entries(manifest.sha256)) {
        const got = _sha256(fs.readFileSync(path.join(OUT_DIR, name), 'utf-8'));
        if (got !== want) {
            process.stderr.write(`❌  ${name}: sha256 drift\n    manifest ${want}\n    on disk  ${got}\n`);
            bad += 1;
        }
    }
    if (bad > 0) {
        process.stderr.write(
            'The corpus is FROZEN. A drift means either an accidental edit (restore it) or a ' +
                'deliberate change (re-emit, and say so — a detector must never be tuned against it).\n',
        );
        return 1;
    }
    process.stdout.write(`✅  encoding corpus matches its frozen manifest (${Object.keys(manifest.sha256).length} files)\n`);
    return 0;
}

export function main(argv: readonly string[] | null = null): number {
    const args = argv ?? process.argv.slice(2);
    if (args.includes('-h') || args.includes('--help')) {
        process.stdout.write('usage: encoding_corpus [--emit | --check]\n');
        return 0;
    }
    if (args.includes('--emit')) return _emit();
    if (args.includes('--check')) return _check();
    process.stderr.write('usage: encoding_corpus [--emit | --check]\n');
    return 2;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
