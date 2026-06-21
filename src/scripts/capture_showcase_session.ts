#!/usr/bin/env node
/**
 * capture_showcase_session.ts — wrap and measure showcase sessions.
 *
 * TypeScript twin of `src/scripts/capture_showcase_session.py` (ADR-200 —
 * Python→TS migration, Phase 8 / Wave 8g). Mirrors the Python CLI contract
 * EXACTLY — the `capture` / `metrics` subcommands, every flag, exit codes
 * (0 success / 1 user error / 2 metric-gate pending), the stdout/stderr
 * split, byte-identical messages, byte-identical written session files, and
 * byte-identical `json.dumps(..., indent=2)` output.
 *
 * Two subcommands:
 *   capture   Read a raw chat-log (file or stdin) and write a session under
 *             `docs/showcase/sessions/<slug>.log` with a YAML frontmatter
 *             block.
 *   metrics   Compute one or all of the four outcome metrics from a captured
 *             session file. Output as text table or JSON.
 *
 * The four metrics:
 *   (a) tool-call-count        — number of <tool_use ...> blocks in body
 *   (b) reply-chars            — mean chars of agent replies (excl. fences)
 *   (c) memory-hit-ratio       — hits / (hits + misses) from memory traces
 *   (d) verify-pass-rate       — first-try done-claims / total done-claims
 *
 * `commit_sha` (git HEAD) and `started`/`ended` (now) are non-deterministic;
 * golden parity supplies fixed timestamps via `--started`/`--ended` and
 * excludes `commit_sha`. No behaviour changes — latent Python quirks
 * replicated.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

/** Mirror Python len(str) — count Unicode code points, not UTF-16 units. */
function pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        void _;
        n++;
    }
    return n;
}
// src/scripts/capture_showcase_session.py → parent.parent.parent == repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export let SESSIONS_DIR = path.join(ROOT, 'docs', 'showcase', 'sessions');

/** Override for tests (mirrors monkeypatch.setattr(css, "SESSIONS_DIR", ...)). */
export function _setSessionsDir(p: string): void {
    SESSIONS_DIR = p;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

// Tool-call markers across host agents (Augment, Claude Code, Cursor, …).
const TOOL_USE_PATTERNS: RegExp[] = [/<tool_use[\s>]/g, /<function_calls>/g, /<invoke\b/g];

// Memory-retrieve trace shape, per memory-visibility-v1.md (Phase 4.1).
const MEMORY_HIT_RE = /memory_retrieve\b[\s\S]*?hits=(\d+)/gi;
const MEMORY_MISS_RE = /memory_retrieve\b[\s\S]*?(misses=(\d+)|hits=0)/gi;
const MEMORY_CALL_RE = /\bmemory_retrieve(?:_\w+)?\b/g;

// Done-claim markers — agent says work is complete.
const DONE_CLAIM_PATTERNS: RegExp[] = [
    /\b(done|complete|ready for review|fertig|abgeschlossen)\b/i,
    /^\s*(✅|✓)/m,
];

// Correction phrasings.
const CORRECTION_PHRASES: string[] = [
    'das passt nicht',
    'das stimmt nicht',
    'passt so nicht',
    "that's wrong",
    'this is wrong',
    'missing',
    'fehlt',
    "didn't work",
    "doesn't work",
    'geht nicht',
    'broken',
    'you missed',
    'du hast',
    'das ist falsch',
];

interface Turn {
    role: string;
    text: string;
}

class SessionMetrics {
    tool_call_count: number | null = null;
    reply_chars_mean: number | null = null;
    memory_hit_ratio: number | null = null;
    verify_pass_rate: number | null = null;
    notes: string[] | null = null;

    /** Mirror to_dict: drop `notes` when empty so frontmatter stays compact. */
    to_dict(): Record<string, Json> {
        const d: Record<string, Json> = {
            tool_call_count: this.tool_call_count,
            reply_chars_mean: this.reply_chars_mean === null ? null : new FloatTag(this.reply_chars_mean),
            memory_hit_ratio: this.memory_hit_ratio === null ? null : new FloatTag(this.memory_hit_ratio),
            verify_pass_rate: this.verify_pass_rate === null ? null : new FloatTag(this.verify_pass_rate),
            notes: this.notes,
        };
        if (!this.notes || this.notes.length === 0) {
            delete d.notes;
        }
        return d;
    }
}

/** Marker so the JSON serializer emits a Python-float repr (".0" for wholes). */
class FloatTag {
    constructor(public readonly value: number) {}
}

function _gitSha(): string {
    const out = spawnSync('git', ['rev-parse', 'HEAD'], {
        cwd: ROOT,
        encoding: 'utf-8',
    });
    if (out.status !== 0 || out.error) {
        return 'unknown';
    }
    return (out.stdout ?? '').trim();
}

function _nowIso(): string {
    // datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Remove fenced code blocks so they don't pollute char counts. */
function _stripFences(text: string): string {
    return text.replace(/```[\s\S]*?```/g, '');
}

/** Strip a leading YAML frontmatter block if present. */
export function _splitBody(content: string): string {
    if (content.startsWith('---\n')) {
        const end = content.indexOf('\n---\n', 4);
        if (end !== -1) {
            return content.slice(end + 5);
        }
    }
    return content;
}

function _readSession(p: string): string {
    if (p === '-') {
        return fs.readFileSync(0, 'utf-8');
    }
    if (!_isFile(p)) {
        // raise SystemExit(f"❌  session file not found: {path}")
        process.stderr.write(`❌  session file not found: ${p}\n`);
        process.exit(1);
    }
    return fs.readFileSync(p, 'utf-8');
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

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

/**
 * Heuristic turn split — `## User` / `## Agent` headings, falls back to
 * whole-body as a single agent turn when no markers exist.
 */
export function _splitTurns(body: string): Turn[] {
    const turnRe = /^##\s+(User|Agent|Assistant|Matze|Du)\b.*?$/gim;
    const matches = _findAll(turnRe, body);
    if (matches.length === 0) {
        return [{ role: 'agent', text: body }];
    }
    const turns: Turn[] = [];
    for (let i = 0; i < matches.length; i++) {
        const m = matches[i] as RegExpExecArray;
        const roleRaw = (m[1] as string).toLowerCase();
        const role = roleRaw === 'user' || roleRaw === 'matze' || roleRaw === 'du' ? 'user' : 'agent';
        const start = m.index + m[0].length;
        const end = i + 1 < matches.length ? (matches[i + 1] as RegExpExecArray).index : body.length;
        turns.push({ role, text: body.slice(start, end).trim() });
    }
    return turns;
}

function _metricToolCallCount(body: string): number {
    let total = 0;
    for (const p of TOOL_USE_PATTERNS) {
        total += _findAll(p, body).length;
    }
    return total;
}

function _metricReplyChars(body: string): number | null {
    const turns = _splitTurns(body);
    const agentTurns = turns.filter((t) => t.role === 'agent').map((t) => t.text);
    if (agentTurns.length === 0) {
        return null;
    }
    const lengths = agentTurns.map((t) => pyLen(_stripFences(t).trim()));
    const sum = lengths.reduce((a, b) => a + b, 0);
    return _round1(sum / lengths.length);
}

function _metricMemoryHitRatio(body: string): [number | null, string[]] {
    const notes: string[] = [];
    let hitsTotal = 0;
    for (const m of _findAll(MEMORY_HIT_RE, body)) {
        hitsTotal += parseInt(m[1] as string, 10);
    }
    const missBlocks = _findAll(MEMORY_MISS_RE, body);
    let missTotal = 0;
    for (const m of missBlocks) {
        const count = m[2]; // group 2 = (\d+) inside `misses=(\d+)`
        if (count) {
            missTotal += parseInt(count, 10);
        } else {
            missTotal += 1; // `hits=0` case
        }
    }
    const calls = _findAll(MEMORY_CALL_RE, body).length;
    if (calls === 0) {
        return [null, ['no memory_retrieve calls found']];
    }
    if (hitsTotal + missTotal === 0) {
        notes.push('memory-visibility-v1 trace not present; counted calls only (Phase 4.1 pending)');
        return [null, notes];
    }
    return [_round3(hitsTotal / (hitsTotal + missTotal)), notes];
}

function _metricVerifyPassRate(body: string): [number | null, string[]] {
    const turns = _splitTurns(body);
    if (turns.length < 2) {
        return [null, ['session has no user/agent split — cannot measure']];
    }
    let totalClaims = 0;
    let failedClaims = 0;
    for (let i = 0; i < turns.length; i++) {
        const turn = turns[i] as Turn;
        if (turn.role !== 'agent') {
            continue;
        }
        if (!DONE_CLAIM_PATTERNS.some((p) => new RegExp(p.source, p.flags).test(turn.text))) {
            continue;
        }
        totalClaims += 1;
        const nextUser = turns.slice(i + 1).find((t) => t.role === 'user');
        if (nextUser === undefined) {
            continue; // claim accepted (session ended on the claim)
        }
        const lower = nextUser.text.toLowerCase();
        if (CORRECTION_PHRASES.some((phrase) => lower.includes(phrase))) {
            failedClaims += 1;
        }
    }
    if (totalClaims === 0) {
        return [null, ['no done-claims found in session']];
    }
    return [_round3((totalClaims - failedClaims) / totalClaims), []];
}

function _computeMetrics(body: string): SessionMetrics {
    const notes: string[] = [];
    const [mhr, mhrNotes] = _metricMemoryHitRatio(body);
    notes.push(...mhrNotes);
    const [vpr, vprNotes] = _metricVerifyPassRate(body);
    notes.push(...vprNotes);
    const m = new SessionMetrics();
    m.tool_call_count = _metricToolCallCount(body);
    m.reply_chars_mean = _metricReplyChars(body);
    m.memory_hit_ratio = mhr;
    m.verify_pass_rate = vpr;
    m.notes = notes.length > 0 ? notes : null;
    return m;
}

/**
 * Minimal YAML emitter — mirror `_render_frontmatter`. dict + scalar + list
 * of strings; nested dict one level deep (for `metrics`).
 */
function _renderFrontmatter(meta: Record<string, Json>): string {
    const fmtScalar = (v: Json): string => {
        if (v === null || v === undefined) {
            return 'null';
        }
        if (v instanceof FloatTag) {
            return _floatStr(v.value);
        }
        if (typeof v === 'boolean') {
            return v ? 'true' : 'false';
        }
        if (typeof v === 'number') {
            return String(v);
        }
        // json.dumps(v, ensure_ascii=False) — used for strings here.
        return _pyJsonStrUnicode(v as string);
    };

    const lines: string[] = ['---'];
    for (const [k, v] of Object.entries(meta)) {
        if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof FloatTag)) {
            lines.push(`${k}:`);
            for (const [kk, vv] of Object.entries(v as Record<string, Json>)) {
                lines.push(`  ${kk}: ${fmtScalar(vv)}`);
            }
        } else if (Array.isArray(v)) {
            lines.push(`${k}:`);
            for (const item of v) {
                lines.push(`  - ${fmtScalar(item)}`);
            }
        } else {
            lines.push(`${k}: ${fmtScalar(v)}`);
        }
    }
    lines.push('---');
    return lines.join('\n') + '\n';
}

// --- json.dumps emulation -------------------------------------------------

/** json.dumps(s, ensure_ascii=False) for a string — keeps unicode literal. */
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
            out += ch; // ensure_ascii=False → keep as-is
        }
    }
    return out + '"';
}

/** json.dumps(s) ensure_ascii=True. */
function _pyJsonStr(s: string): string {
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
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

function _floatStr(n: number): string {
    if (Number.isInteger(n)) {
        return `${n}.0`;
    }
    return String(n);
}

/** json.dumps(obj, indent=2) (ensure_ascii=True, NO sort_keys), FloatTag aware. */
function _dumps(obj: Json, level = 0): string {
    if (obj instanceof FloatTag) {
        return _floatStr(obj.value);
    }
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
        return _pyJsonStr(obj);
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const pad = ' '.repeat(2 * (level + 1));
        const closePad = ' '.repeat(2 * level);
        return `[\n${obj.map((v) => pad + _dumps(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>);
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map((k) => `${pad}${_pyJsonStr(k)}: ${_dumps((obj as Record<string, Json>)[k], level + 1)}`);
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

/** Python round(x, 1) round-half-to-even. */
function _round1(x: number): number {
    return _roundEven(x, 1);
}
function _round3(x: number): number {
    return _roundEven(x, 3);
}
function _roundEven(x: number, ndigits: number): number {
    const f = Math.pow(10, ndigits);
    const scaled = x * f;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let r: number;
    const eps = 1e-9;
    if (diff > 0.5 + eps) {
        r = floor + 1;
    } else if (diff < 0.5 - eps) {
        r = floor;
    } else {
        r = floor % 2 === 0 ? floor : floor + 1;
    }
    return r / f;
}

// --- subcommands ----------------------------------------------------------

interface CaptureArgs {
    input: string;
    slug: string;
    task_class: string;
    host: string;
    model: string;
    started: string | null;
    ended: string | null;
    force: boolean;
    format: string;
}

function cmdCapture(a: CaptureArgs): number {
    const raw = _readSession(a.input);
    const body = _splitBody(raw);
    const metrics = _computeMetrics(body);
    const started = a.started ?? _nowIso();
    const ended = a.ended ?? _nowIso();
    const meta: Record<string, Json> = {
        slug: a.slug,
        task_class: a.task_class,
        host_agent: a.host,
        model: a.model,
        commit_sha: _gitSha(),
        started,
        ended,
        metrics: metrics.to_dict(),
    };
    const frontmatter = _renderFrontmatter(meta);
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    const outPath = path.join(SESSIONS_DIR, `${a.slug}.log`);
    if (_isFile(outPath) && !a.force) {
        process.stderr.write(`❌  refusing to overwrite ${outPath} — pass --force\n`);
        return 1;
    }
    fs.writeFileSync(outPath, frontmatter + body, 'utf-8');
    let display: string;
    const rel = path.relative(ROOT, outPath);
    display = rel.startsWith('..') ? outPath : rel.split(path.sep).join('/');
    process.stdout.write(`✅  wrote ${display}\n`);
    if (a.format === 'json') {
        process.stdout.write(_dumps(metrics.to_dict()) + '\n');
    }
    return 0;
}

interface MetricsArgs {
    session: string;
    metric: string;
    format: string;
}

function cmdMetrics(a: MetricsArgs): number {
    const raw = _readSession(a.session);
    const body = _splitBody(raw);
    const metrics = _computeMetrics(body);
    const selected = a.metric;
    // available preserves insertion order matching the Python dict.
    const available: Array<[string, number | null]> = [
        ['tool-call-count', metrics.tool_call_count],
        ['reply-chars', metrics.reply_chars_mean],
        ['memory-hit-ratio', metrics.memory_hit_ratio],
        ['verify-pass-rate', metrics.verify_pass_rate],
    ];
    const availMap = new Map(available);
    if (selected !== 'all' && !availMap.has(selected)) {
        process.stderr.write(`❌  unknown metric: ${selected}\n`);
        return 1;
    }
    if (a.format === 'json') {
        if (selected === 'all') {
            process.stdout.write(_dumps(metrics.to_dict()) + '\n');
        } else {
            const v = availMap.get(selected) ?? null;
            process.stdout.write(_dumps({ [selected]: v === null ? null : new FloatTag(v) }) + '\n');
        }
        return 0;
    }
    // tool-call-count is a Python int → str(int); the other three are floats
    // from round() → str(float) keeps the ".0" for whole values.
    const isFloatMetric = (n: string): boolean => n !== 'tool-call-count';
    const items: Array<[string, number | null]> =
        selected === 'all' ? available : [[selected, availMap.get(selected) ?? null]];
    for (const [name, value] of items) {
        const rendered = value === null ? 'n/a' : isFloatMetric(name) ? _floatStr(value) : String(value);
        process.stdout.write(`  ${_ljust(name, 22)} ${rendered}\n`);
    }
    if (metrics.notes && metrics.notes.length > 0) {
        process.stdout.write('\n');
        for (const note of metrics.notes) {
            process.stdout.write(`  ℹ️   ${note}\n`);
        }
    }
    return 0;
}

function _ljust(s: string, width: number): string {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function _takeValue(argv: string[], i: { v: number }, name: string): string {
    const v = argv[++i.v];
    if (v === undefined) {
        process.stderr.write(`argument ${name}: expected one argument\n`);
        process.exit(2);
    }
    return v;
}

export function main(argv: string[] | null = null): number {
    const args = argv ?? process.argv.slice(2);
    const command = args[0];
    if (command === undefined) {
        process.stderr.write('the following arguments are required: command\n');
        process.exit(2);
    }
    const rest = args.slice(1);

    if (command === 'capture') {
        const a: CaptureArgs = {
            input: '',
            slug: '',
            task_class: 'implement-ticket',
            host: 'unknown',
            model: 'unknown',
            started: null,
            ended: null,
            force: false,
            format: 'text',
        };
        let haveInput = false;
        let haveSlug = false;
        const ix = { v: -1 };
        const arr = rest;
        for (ix.v = 0; ix.v < arr.length; ix.v++) {
            const t = arr[ix.v] as string;
            if (t === '--input') {
                a.input = _takeValue(arr, ix, '--input');
                haveInput = true;
            } else if (t.startsWith('--input=')) {
                a.input = t.slice(8);
                haveInput = true;
            } else if (t === '--slug') {
                a.slug = _takeValue(arr, ix, '--slug');
                haveSlug = true;
            } else if (t.startsWith('--slug=')) {
                a.slug = t.slice(7);
                haveSlug = true;
            } else if (t === '--task-class') {
                a.task_class = _checkChoice(_takeValue(arr, ix, '--task-class'), [
                    'implement-ticket',
                    'work',
                    'review-changes',
                    'qa',
                ], '--task-class');
            } else if (t.startsWith('--task-class=')) {
                a.task_class = _checkChoice(t.slice(13), ['implement-ticket', 'work', 'review-changes', 'qa'], '--task-class');
            } else if (t === '--host') {
                a.host = _takeValue(arr, ix, '--host');
            } else if (t.startsWith('--host=')) {
                a.host = t.slice(7);
            } else if (t === '--model') {
                a.model = _takeValue(arr, ix, '--model');
            } else if (t.startsWith('--model=')) {
                a.model = t.slice(8);
            } else if (t === '--started') {
                a.started = _takeValue(arr, ix, '--started');
            } else if (t.startsWith('--started=')) {
                a.started = t.slice(10);
            } else if (t === '--ended') {
                a.ended = _takeValue(arr, ix, '--ended');
            } else if (t.startsWith('--ended=')) {
                a.ended = t.slice(8);
            } else if (t === '--force') {
                a.force = true;
            } else if (t === '--format') {
                a.format = _checkChoice(_takeValue(arr, ix, '--format'), ['text', 'json'], '--format');
            } else if (t.startsWith('--format=')) {
                a.format = _checkChoice(t.slice(9), ['text', 'json'], '--format');
            } else {
                process.stderr.write(`unrecognized arguments: ${t}\n`);
                process.exit(2);
            }
        }
        if (!haveInput) {
            process.stderr.write('the following arguments are required: --input\n');
            process.exit(2);
        }
        if (!haveSlug) {
            process.stderr.write('the following arguments are required: --slug\n');
            process.exit(2);
        }
        return cmdCapture(a);
    }

    if (command === 'metrics') {
        const a: MetricsArgs = { session: '', metric: 'all', format: 'text' };
        let haveSession = false;
        const ix = { v: -1 };
        for (ix.v = 0; ix.v < rest.length; ix.v++) {
            const t = rest[ix.v] as string;
            if (t === '--session') {
                a.session = _takeValue(rest, ix, '--session');
                haveSession = true;
            } else if (t.startsWith('--session=')) {
                a.session = t.slice(10);
                haveSession = true;
            } else if (t === '--metric') {
                a.metric = _checkChoice(_takeValue(rest, ix, '--metric'), ['all', 'tool-call-count', 'reply-chars', 'memory-hit-ratio', 'verify-pass-rate'], '--metric');
            } else if (t.startsWith('--metric=')) {
                a.metric = _checkChoice(t.slice(9), ['all', 'tool-call-count', 'reply-chars', 'memory-hit-ratio', 'verify-pass-rate'], '--metric');
            } else if (t === '--format') {
                a.format = _checkChoice(_takeValue(rest, ix, '--format'), ['text', 'json'], '--format');
            } else if (t.startsWith('--format=')) {
                a.format = _checkChoice(t.slice(9), ['text', 'json'], '--format');
            } else {
                process.stderr.write(`unrecognized arguments: ${t}\n`);
                process.exit(2);
            }
        }
        if (!haveSession) {
            process.stderr.write('the following arguments are required: --session\n');
            process.exit(2);
        }
        return cmdMetrics(a);
    }

    process.stderr.write(`argument command: invalid choice: '${command}'\n`);
    process.exit(2);
}

function _checkChoice(v: string, choices: string[], name: string): string {
    if (!choices.includes(v)) {
        process.stderr.write(
            `argument ${name}: invalid choice: '${v}' (choose from ${choices.map((c) => `'${c}'`).join(', ')})\n`,
        );
        process.exit(2);
    }
    return v;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}

export {
    _computeMetrics,
    _metricMemoryHitRatio,
    _metricReplyChars,
    _metricToolCallCount,
    _metricVerifyPassRate,
    _renderFrontmatter,
    SessionMetrics,
    FloatTag,
};
