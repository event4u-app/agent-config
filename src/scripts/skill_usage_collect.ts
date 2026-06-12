#!/usr/bin/env tsx
/**
 * Collect skill-activation signal from Claude Code session jsonl.
 *
 * TypeScript twin of `src/scripts/skill_usage_collect.py` (ADR-089, Phase 8 /
 * Wave 8b). Mirrors the CLI contract EXACTLY — the `--project-slug`, `--out`,
 * `--quiet` flags, exit codes, the stdout/stderr split, byte-identical
 * messages AND the byte-identical appended JSONL (`json.dumps(rec,
 * separators=(",", ":")) + "\n"`).
 *
 * Reads `~/.claude/projects/<project-slug>/*.jsonl` for the current repo,
 * parses each turn for two signals — exposure (skill appeared in a
 * skill_listing attachment) and mention (assistant text referenced the slug
 * with an anchor verb, or cited a SKILL.md path).
 *
 * Emits one JSONL record per (session, turn, slug, kind), append-only, deduped
 * on the (session_id, turn_idx, slug, kind) tuple.
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/skill_usage_collect.ts → parents[2] of the .py file is repo root.
export const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const OUT = path.join(REPO, 'agents', 'metrics', 'skill-usage.jsonl');

// LISTING_LINE_RE = re.compile(r"^-\s+([a-z0-9][a-z0-9_-]+):\s", re.MULTILINE)
const LISTING_LINE_RE = /^-\s+([a-z0-9][a-z0-9_-]+):\s/gm;
const ANCHOR_VERBS: readonly string[] = [
    'using',
    'via',
    'per',
    'route',
    'routing',
    'dispatch',
    'dispatched',
    'invoke',
    'call',
];
// PATH_RE = re.compile(r"\.(?:augment|claude|agent-src)/skills/([a-z0-9][a-z0-9_-]+)/SKILL\.md")
const PATH_RE = /\.(?:augment|claude|agent-src)\/skills\/([a-z0-9][a-z0-9_-]+)\/SKILL\.md/g;

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

interface Record_ {
    session_id: string;
    turn_idx: number;
    slug: string;
    kind: string;
    ts: string;
    prompt_excerpt_hash: string;
}

export function project_slug(repo: string): string {
    return repo.replace(/\//g, '-');
}

export function session_files(slug: string): string[] {
    const base = path.join(os.homedir(), '.claude', 'projects', slug);
    let stat: fs.Stats;
    try {
        stat = fs.statSync(base);
    } catch {
        return [];
    }
    if (!stat.isDirectory()) {
        return [];
    }
    const names = fs
        .readdirSync(base)
        .filter((n) => n.endsWith('.jsonl'))
        .map((n) => path.join(base, n));
    names.sort();
    return names;
}

function* iter_turns(jsonl: string): Generator<{ [k: string]: Json }> {
    let content: string;
    try {
        content = fs.readFileSync(jsonl, 'utf-8');
    } catch {
        return;
    }
    for (const raw of content.split('\n')) {
        const line = raw.trim();
        if (!line) {
            continue;
        }
        let parsed: Json;
        try {
            parsed = JSON.parse(line) as Json;
        } catch {
            continue;
        }
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            yield parsed;
        } else {
            // Python `json.loads` on a bare value yields a non-dict; the
            // downstream `.get()` calls would raise AttributeError. The real
            // session jsonl is always object-per-line, so this never happens
            // in practice; yield an empty dict to preserve iteration count.
            yield {};
        }
    }
}

function _asObj(v: Json | undefined): { [k: string]: Json } | null {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return v;
    }
    return null;
}

function _str(v: Json | undefined): string {
    return typeof v === 'string' ? v : '';
}

export function extract_listing(entry: { [k: string]: Json }): Set<string> {
    const att = _asObj(entry['attachment']) ?? {};
    if (att['type'] !== 'skill_listing') {
        return new Set();
    }
    const content = _str(att['content']);
    const out = new Set<string>();
    LISTING_LINE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LISTING_LINE_RE.exec(content)) !== null) {
        out.add(m[1] as string);
    }
    return out;
}

export function extract_text(entry: { [k: string]: Json }): string {
    if (entry['type'] !== 'assistant') {
        return '';
    }
    const msg = _asObj(entry['message']) ?? {};
    const content = msg['content'];
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        const parts: string[] = [];
        for (const p of content) {
            const o = _asObj(p);
            if (o && o['type'] === 'text') {
                parts.push(_str(o['text']));
            }
        }
        return parts.join('\n');
    }
    return '';
}

export function find_mentions(text: string, knownSlugs: Iterable<string>): Set<string> {
    const hits = new Set<string>();
    if (!text) {
        return hits;
    }
    PATH_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PATH_RE.exec(text)) !== null) {
        hits.add(m[1] as string);
    }
    const lower = text.toLowerCase();
    for (const slug of knownSlugs) {
        const token = `\`${slug}\``;
        if (!text.includes(token)) {
            continue;
        }
        for (const verb of ANCHOR_VERBS) {
            if (
                lower.includes(`${verb} ${token}`.toLowerCase()) ||
                lower.includes(`${verb} the ${token}`.toLowerCase())
            ) {
                hits.add(slug);
                break;
            }
        }
    }
    return hits;
}

export function hash_prompt(text: string): string {
    if (!text) {
        return '';
    }
    // Python hashes text[:200] (first 200 code points) as UTF-8 bytes.
    const first200 = Array.from(text).slice(0, 200).join('');
    return crypto
        .createHash('sha256')
        .update(Buffer.from(first200, 'utf-8'))
        .digest('hex')
        .slice(0, 16);
}

/** Mirror Python `sorted(set)` over slug strings. */
function _sorted(s: Iterable<string>): string[] {
    return [...s].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function collect_session(jsonl: string, allKnown: Set<string>): Record_[] {
    const sessionId = path.basename(jsonl, '.jsonl');
    const records: Record_[] = [];
    let lastPromptHash = '';
    let listed = new Set<string>();
    let turnIdx = -1;
    for (const entry of iter_turns(jsonl)) {
        const etype = entry['type'];
        if (etype === 'user') {
            turnIdx += 1;
            const msg = _asObj(entry['message']) ?? {};
            const content = msg['content'];
            const body = typeof content === 'string' ? content : '';
            lastPromptHash = hash_prompt(body || '');
            continue;
        }
        if (etype === 'attachment') {
            for (const v of extract_listing(entry)) {
                listed.add(v);
            }
            continue;
        }
        if (etype === 'assistant') {
            const text = extract_text(entry);
            const union = new Set<string>([...listed, ...allKnown]);
            const mentions = find_mentions(text, union);
            const ts = _str(entry['timestamp']);
            for (const slug of _sorted(listed)) {
                records.push({
                    session_id: sessionId,
                    turn_idx: turnIdx,
                    slug,
                    kind: 'exposure',
                    ts,
                    prompt_excerpt_hash: lastPromptHash,
                });
            }
            for (const slug of _sorted(mentions)) {
                records.push({
                    session_id: sessionId,
                    turn_idx: turnIdx,
                    slug,
                    kind: 'mention',
                    ts,
                    prompt_excerpt_hash: lastPromptHash,
                });
            }
            listed = new Set();
        }
    }
    return records;
}

export function load_known_slugs(repo: string): Set<string> {
    const slugs = new Set<string>();
    const roots = [
        path.join(repo, '.augment', 'skills'),
        path.join(repo, '.claude', 'skills'),
        path.join(repo, 'dist/agent-src', 'skills'),
    ];
    for (const root of roots) {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(root, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            if (!e.isDirectory()) {
                continue;
            }
            const skillMd = path.join(root, e.name, 'SKILL.md');
            try {
                if (fs.statSync(skillMd).isFile()) {
                    slugs.add(e.name);
                }
            } catch {
                // no SKILL.md — skip.
            }
        }
    }
    return slugs;
}

export function dedup_key(rec: Record_): string {
    // Tuple identity (session_id, turn_idx, slug, kind). JSON-array string
    // key so the components cannot collide regardless of their contents.
    return JSON.stringify([rec.session_id, rec.turn_idx, rec.slug, rec.kind]);
}

// --- json.dumps(separators=(",", ":")) replica (compact, ensure_ascii) -------

function _jsonDumpsCompact(obj: Record<string, Json>): string {
    const enc = (value: Json): string => {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            return '[' + value.map(enc).join(',') + ']';
        }
        const o = value as { [k: string]: Json };
        const inner = Object.keys(o).map((k) => encStr(k) + ':' + enc(o[k] as Json));
        return '{' + inner.join(',') + '}';
    };
    const encStr = (s: string): string => {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    };
    return enc(obj);
}

/**
 * Mirror Python `Path.relative_to(REPO)` — throws when `p` is not under REPO
 * (Python `relative_to` raises ValueError → exit 1; the traceback prose is
 * Python-version-dependent and not matched).
 */
function _relToRepoPosix(p: string): string {
    const rel = path.relative(REPO, p);
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
        throw new Error(`'${p}' is not in the subpath of '${REPO}'`);
    }
    return rel.split(path.sep).join('/');
}

interface ParsedArgs {
    project_slug: string | null;
    out: string;
    quiet: boolean;
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { project_slug: null, out: OUT, quiet: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const takeValue = (flag: string): string => {
            const eq = a.indexOf('=');
            if (eq !== -1) {
                return a.slice(eq + 1);
            }
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write(
                    `skill_usage_collect: error: argument ${flag}: expected one argument\n`,
                );
                process.exit(2);
            }
            i += 1;
            return next;
        };
        if (a === '--project-slug' || a.startsWith('--project-slug=')) {
            out.project_slug = takeValue('--project-slug');
        } else if (a === '--out' || a.startsWith('--out=')) {
            out.out = takeValue('--out');
        } else if (a === '--quiet') {
            out.quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: skill_usage_collect [-h] [--project-slug PROJECT_SLUG] [--out OUT] [--quiet]\n',
            );
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const slug = args.project_slug || project_slug(REPO);
    const files = session_files(slug);
    if (files.length === 0) {
        if (!args.quiet) {
            process.stderr.write(`no session files for slug ${slug}\n`);
        }
        return 0;
    }
    const known = load_known_slugs(REPO);
    const seen = new Set<string>();
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    if (fs.existsSync(args.out)) {
        const text = fs.readFileSync(args.out, 'utf-8');
        for (const line of text.split('\n')) {
            if (!line) {
                continue;
            }
            try {
                const rec = JSON.parse(line) as Partial<Record_>;
                if (
                    rec.session_id === undefined ||
                    rec.turn_idx === undefined ||
                    rec.slug === undefined ||
                    rec.kind === undefined
                ) {
                    continue;
                }
                seen.add(dedup_key(rec as Record_));
            } catch {
                continue;
            }
        }
    }
    let appended = 0;
    const fh = fs.openSync(args.out, 'a');
    try {
        for (const jsonl of files) {
            for (const rec of collect_session(jsonl, known)) {
                const k = dedup_key(rec);
                if (seen.has(k)) {
                    continue;
                }
                seen.add(k);
                fs.writeSync(
                    fh,
                    _jsonDumpsCompact(rec as unknown as Record<string, Json>) + '\n',
                );
                appended += 1;
            }
        }
    } finally {
        fs.closeSync(fh);
    }
    if (!args.quiet) {
        process.stdout.write(
            `✅  Wrote ${appended} new record(s) to ${_relToRepoPosix(path.resolve(args.out))} (${seen.size} total)\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
