#!/usr/bin/env node
/**
 * Mine session transcripts for memory signals — Phase-1 single-host.
 *
 * TypeScript twin of `src/scripts/mine_session.py` (ADR-090 — Python→TS
 * migration, Phase 8 / Wave 8g). Mirrors the Python CLI contract EXACTLY —
 * every flag, exit code (0), the stdout/stderr split, byte-identical
 * messages, byte-identical preview Markdown, and byte-identical
 * `json.dumps(..., ensure_ascii=False)` intake JSONL lines.
 *
 * Implements the GATHER SIGNAL phase of the `memory-consolidation` skill
 * against Claude-Code-format JSONL transcripts. Default behaviour is
 * `--preview` (stdout only). `--commit-intake` appends one JSONL line per
 * fact to `agents/memory/intake/<type>.jsonl`.
 *
 * Strict gates: opt-in transcript access (`--confirm-transcript-access`
 * required per invocation), ≤ 5 normalised facts per cycle, redaction
 * applied to every yielded text. See
 * `.agent-src.uncondensed/commands/memory/mine-session.md` for the authored
 * spec.
 *
 * Auto-resolved transcript discovery (`rglob` sorted by mtime) is
 * intrinsically non-deterministic; golden parity supplies a fixed
 * `--transcript`. No behaviour changes — latent Python quirks replicated.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/mine_session.py → parent.parent.parent == repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const INTAKE_ROOT = path.join('agents', 'memory', 'intake');
export const DEFAULT_WINDOW_DAYS = 14;
export const MAX_FACTS = 5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const SIGNAL_FAMILIES: Array<[string, RegExp]> = [
    // Correction first — explicit redirects beat ambient preference matches.
    ['gotcha', /\b(actually|wrong|stop doing|don't do|that's not what|nicht so)\b/i],
    // Decision next — narrowest family.
    ['invariant', /\b(let's go with|decided|we'll use|entschieden)\b/i],
    // Preference last — widest, must not eat correction/decision turns.
    ['convention', /\b(prefer|always|never|standard|i want|ich will)\b/i],
];
const PATTERN_MIN_REPEATS = 3;
const PATTERN_WINDOW_HOURS = 24;

const NAME_REDACT = /\b(Matze|Mathias)\b/g;
const PRONOUN_STRIP = /\b(I|me|my|mein|ich)\b\s*/gi;
const PATH_TOKEN = /\b[a-zA-Z][\w/.-]*\/[\w./-]+\b/g;
const SYMBOL_TOKEN = /\b[A-Z][a-zA-Z0-9]+(?:::|\.)[a-zA-Z_][\w]*\b/g;

function _findAll(re: RegExp, text: string): RegExpExecArray[] {
    const out: RegExpExecArray[] = [];
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
        out.push(m);
        if (m.index === r.lastIndex) {
            r.lastIndex++;
        }
    }
    return out;
}

function _search(re: RegExp, text: string): RegExpMatchArray | null {
    return new RegExp(re.source, re.flags.replace('g', '')).exec(text);
}

function _redact(text: string, extraPatterns: RegExp[]): string {
    let out = text.replace(NAME_REDACT, '<user>');
    for (const p of extraPatterns) {
        out = out.replace(new RegExp(p.source, p.flags.includes('g') ? p.flags : p.flags + 'g'), '<redacted>');
    }
    return out.trim();
}

/** Strip pronouns and chrome; require a project-scoped key token. */
function _normalise(text: string, extraPatterns: RegExp[]): string | null {
    let cleaned = _redact(text, extraPatterns);
    cleaned = cleaned.replace(PRONOUN_STRIP, '').trim();
    if (!(_search(PATH_TOKEN, cleaned) || _search(SYMBOL_TOKEN, cleaned))) {
        return null; // user-scoped, drop
    }
    return cleaned.replace(/\s+/g, ' ').slice(0, 240);
}

function _keyOf(text: string): string {
    const m = _search(PATH_TOKEN, text) ?? _search(SYMBOL_TOKEN, text);
    return m ? (m[0] as string) : 'unknown';
}

function* _iterClaudeCodeJsonl(p: string): Generator<Record<string, Json>> {
    const text = fs.readFileSync(p, 'utf-8');
    for (let line of text.split('\n')) {
        line = line.trim();
        if (!line) {
            continue;
        }
        try {
            yield JSON.parse(line) as Record<string, Json>;
        } catch {
            continue;
        }
    }
}

function _turnText(turn: Record<string, Json>): string {
    const msg = (turn.message as Record<string, Json> | undefined) ?? {};
    const content = msg.content;
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .filter((c) => c && typeof c === 'object' && c.type === 'text')
            .map((c) => (c.text as string | undefined) ?? '')
            .join(' ');
    }
    return '';
}

function _turnTs(turn: Record<string, Json>): string {
    return (turn.timestamp as string | undefined) || (turn.ts as string | undefined) || '';
}

/**
 * Parse an ISO-8601 timestamp the way Python's
 * `datetime.fromisoformat(ts.replace("Z","+00:00"))` does, returning a UTC
 * Date and a flag for whether tzinfo was present. Returns null on failure.
 */
function _parseIso(tsStr: string): { date: Date; hadTz: boolean } | null {
    const s = tsStr.replace('Z', '+00:00');
    // fromisoformat accepts "YYYY-MM-DDTHH:MM:SS[.ffffff][+HH:MM]". JS Date
    // parses the same ISO shape; detect tz suffix presence.
    const hadTz = /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s);
    const ms = Date.parse(hadTz ? s : s + 'Z');
    // If no tz, Python treats it as naive then replaces tzinfo=utc → same as
    // appending Z. We parsed with Z appended above for the value.
    if (Number.isNaN(ms)) {
        return null;
    }
    return { date: new Date(ms), hadTz };
}

function _withinWindow(tsStr: string, since: Date): boolean {
    if (!tsStr) {
        return true;
    }
    const parsed = _parseIso(tsStr);
    if (parsed === null) {
        return true; // ValueError → True
    }
    return parsed.date.getTime() >= since.getTime();
}

/** Return [[key, observation, ts]] for paths/symbols seen ≥ 3× / 24h. */
function _detectPattern(turns: Array<Record<string, Json>>): Array<[string, string, string]> {
    const seen = new Map<string, Array<[number, string]>>();
    for (const t of turns) {
        const text = _turnText(t);
        const tsStr = _turnTs(t);
        const parsed = _parseIso(tsStr);
        if (parsed === null) {
            continue;
        }
        const tokens = [..._findAll(PATH_TOKEN, text).map((m) => m[0] as string), ..._findAll(SYMBOL_TOKEN, text).map((m) => m[0] as string)];
        for (const m of tokens) {
            if (!seen.has(m)) {
                seen.set(m, []);
            }
            seen.get(m)!.push([parsed.date.getTime(), tsStr]);
        }
    }
    const out: Array<[string, string, string]> = [];
    const windowMs = PATTERN_WINDOW_HOURS * 3600 * 1000;
    for (const [key, hits] of seen) {
        // hits.sort() — Python sorts tuples (ts, ts_str); ts is a datetime so
        // primary key is the epoch ms, secondary the string.
        hits.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
        for (let i = 0; i <= hits.length - PATTERN_MIN_REPEATS; i++) {
            if ((hits[i + PATTERN_MIN_REPEATS - 1] as [number, string])[0] - (hits[i] as [number, string])[0] <= windowMs) {
                out.push([key, `recurring reference to ${key}`, (hits[i + PATTERN_MIN_REPEATS - 1] as [number, string])[1]]);
                break;
            }
        }
    }
    return out;
}

function _sessionId(transcript: string): string {
    const resolved = path.resolve(transcript);
    return crypto.createHash('sha256').update(resolved).digest('hex').slice(0, 16);
}

/** Return up to MAX_FACTS normalised facts (preview shape). */
export function mine(transcript: string, since: Date, extraPatterns: RegExp[]): Array<Record<string, Json>> {
    const turnsInWindow = [..._iterClaudeCodeJsonl(transcript)].filter((t) => _withinWindow(_turnTs(t), since));
    const facts: Array<Record<string, Json>> = [];
    const sessionId = _sessionId(transcript);
    for (const turn of turnsInWindow) {
        const text = _turnText(turn);
        if (!text) {
            continue;
        }
        for (const [tag, family] of SIGNAL_FAMILIES) {
            if (!_search(family, text)) {
                continue;
            }
            const obs = _normalise(text, extraPatterns);
            if (obs === null) {
                continue;
            }
            facts.push({
                ts: _turnTs(turn) || _nowIsoSeconds(),
                type: tag,
                key: _keyOf(text),
                observation: obs,
                source: 'agent',
                session_id: sessionId,
                tags: [tag],
            });
            break;
        }
    }
    for (const [key, obs, ts] of _detectPattern(turnsInWindow)) {
        facts.push({
            ts,
            type: 'pattern',
            key,
            observation: obs,
            source: 'agent',
            session_id: sessionId,
            tags: ['pattern'],
        });
    }
    return facts.slice(0, MAX_FACTS);
}

/** datetime.now(timezone.utc).isoformat(timespec="seconds") → "...+00:00". */
function _nowIsoSeconds(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

export function renderPreview(
    facts: Array<Record<string, Json>>,
    project: string,
    window: string,
    host: string,
): string {
    if (facts.length === 0) {
        return (
            `## Mining preview — ${project} · ${window} · host=${host}\n\n` +
            '_No signals matched. Tighten patterns or widen --since._\n'
        );
    }
    const lines: string[] = [
        `## Mining preview — ${project} · ${window} · host=${host}`,
        '',
        '| # | Tag | Key | Observation | Source turn |',
        '|---|---|---|---|---|',
    ];
    facts.forEach((f, idx) => {
        lines.push(`| ${idx + 1} | ${f.type} | ${f.key} | ${f.observation} | ${f.ts} |`);
    });
    // sorted({f["type"] for f in facts})
    const schemas = [...new Set(facts.map((f) => f.type as string))].sort();
    lines.push('');
    lines.push(`Schemas touched: ${schemas.join(', ')}`);
    return lines.join('\n') + '\n';
}

export function commitIntake(facts: Array<Record<string, Json>>, intakeRoot: string): number {
    fs.mkdirSync(intakeRoot, { recursive: true });
    let written = 0;
    for (const f of facts) {
        const dest = path.join(intakeRoot, `${f.type}.jsonl`);
        fs.appendFileSync(dest, _jsonDumpsUnicode(f) + '\n', 'utf-8');
        written += 1;
    }
    return written;
}

function _resolveTranscript(host: string, override: string | null): string | null {
    if (override) {
        return override;
    }
    if (host !== 'claude-code') {
        return null;
    }
    const home = path.join(os.homedir(), '.claude', 'projects');
    if (!_isDir(home)) {
        return null;
    }
    // sorted(home.rglob("*.jsonl"), key=mtime, reverse=True)[0]
    const candidates: Array<[string, number]> = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full);
            } else if (e.isFile() && e.name.endsWith('.jsonl')) {
                candidates.push([full, fs.statSync(full).mtimeMs]);
            }
        }
    };
    walk(home);
    if (candidates.length === 0) {
        return null;
    }
    candidates.sort((a, b) => b[1] - a[1]);
    return candidates[0]![0];
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _exists(p: string): boolean {
    return fs.existsSync(p);
}

// --- json.dumps(ensure_ascii=False) for an intake fact --------------------

function _pyJsonStrUnicode(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            out += ch; // ensure_ascii=False → keep unicode literal
        }
    }
    return out + '"';
}

/** json.dumps(obj, ensure_ascii=False) — compact, separators (", ", ": "). */
function _jsonDumpsUnicode(obj: Json): string {
    if (obj === null || obj === undefined) {
        return 'null';
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (typeof obj === 'number') {
        return String(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStrUnicode(obj);
    }
    if (Array.isArray(obj)) {
        return `[${obj.map((v) => _jsonDumpsUnicode(v)).join(', ')}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>);
    return `{${keys.map((k) => `${_pyJsonStrUnicode(k)}: ${_jsonDumpsUnicode((obj as Record<string, Json>)[k])}`).join(', ')}}`;
}

interface Args {
    since: string | null;
    confirm_transcript_access: boolean;
    preview: boolean;
    commit_intake: boolean;
    host: string;
    transcript: string | null;
    intake_root: string;
    project: string;
}

export function parseArgs(argv: string[]): Args {
    const args: Args = {
        since: null,
        confirm_transcript_access: false,
        preview: true,
        commit_intake: false,
        host: 'claude-code',
        transcript: null,
        intake_root: INTAKE_ROOT,
        project: path.basename(process.cwd()),
    };
    const take = (i: { v: number }, name: string): string => {
        const v = argv[++i.v];
        if (v === undefined) {
            process.stderr.write(`argument ${name}: expected one argument\n`);
            process.exit(2);
        }
        return v;
    };
    const ix = { v: 0 };
    for (ix.v = 0; ix.v < argv.length; ix.v++) {
        const a = argv[ix.v] as string;
        if (a === '--since') {
            args.since = take(ix, '--since');
        } else if (a.startsWith('--since=')) {
            args.since = a.slice('--since='.length);
        } else if (a === '--confirm-transcript-access') {
            args.confirm_transcript_access = true;
        } else if (a === '--preview') {
            args.preview = true;
        } else if (a === '--commit-intake') {
            args.commit_intake = true;
        } else if (a === '--host') {
            args.host = take(ix, '--host');
        } else if (a.startsWith('--host=')) {
            args.host = a.slice('--host='.length);
        } else if (a === '--transcript') {
            args.transcript = take(ix, '--transcript');
        } else if (a.startsWith('--transcript=')) {
            args.transcript = a.slice('--transcript='.length);
        } else if (a === '--intake-root') {
            args.intake_root = take(ix, '--intake-root');
        } else if (a.startsWith('--intake-root=')) {
            args.intake_root = a.slice('--intake-root='.length);
        } else if (a === '--project') {
            args.project = take(ix, '--project');
        } else if (a.startsWith('--project=')) {
            args.project = a.slice('--project='.length);
        } else {
            process.stderr.write(`unrecognized arguments: ${a}\n`);
            process.exit(2);
        }
    }
    return args;
}

export function main(argv: string[] | null = null): number {
    const ns = parseArgs(argv ?? process.argv.slice(2));

    if (ns.commit_intake && !ns.preview) {
        ns.preview = false;
    }
    if (ns.commit_intake && ns.preview) {
        ns.preview = false; // commit-intake wins
    }

    if (!ns.confirm_transcript_access) {
        process.stdout.write(
            '> Mining reads your session transcript files. Re-run with\n' +
                '> --confirm-transcript-access to proceed. The flag is per-invocation\n' +
                '> and not persisted.\n',
        );
        return 0;
    }

    if (ns.host !== 'claude-code') {
        process.stdout.write(
            `> No TranscriptAdapter for host=${ns.host}. Phase 1 supports: claude-code.\n` +
                '> Use /memory propose to record signals manually.\n',
        );
        return 0;
    }

    const transcript = _resolveTranscript(ns.host, ns.transcript);
    if (transcript === null || !_exists(transcript)) {
        process.stdout.write('> No transcript found for host=claude-code. Use /memory propose.\n');
        return 0;
    }

    let since: Date;
    if (ns.since) {
        // datetime.fromisoformat(ns.since).replace(tzinfo=utc) — a bare date
        // like "2026-05-01" parses to midnight, then is tagged UTC.
        const parsed = _parseIso(ns.since);
        // fromisoformat on a date-only string yields midnight; tagged UTC.
        since = parsed ? new Date(Date.parse(ns.since.includes('T') ? ns.since + 'Z' : ns.since + 'T00:00:00Z')) : new Date(NaN);
    } else {
        since = new Date(Date.now() - DEFAULT_WINDOW_DAYS * 24 * 3600 * 1000);
    }
    const facts = mine(transcript, since, []);
    const window = `since ${_dateIso(since)}`;

    if (!ns.commit_intake) {
        process.stdout.write(renderPreview(facts, ns.project, window, ns.host));
        return 0;
    }

    const written = commitIntake(facts, ns.intake_root);
    const filesTouched = new Set(facts.map((f) => f.type as string)).size;
    process.stdout.write(
        `✅ Appended ${written} intake lines across ${filesTouched} files.\n` +
            '   Next: /memory promote to lift validated lines into curated YAML.\n',
    );
    return 0;
}

/** since.date().isoformat() — the UTC calendar date. */
function _dateIso(d: Date): string {
    return d.toISOString().slice(0, 10);
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}
