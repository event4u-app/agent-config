#!/usr/bin/env node
/**
 * Phase 0 baseline harness for road-to-trim-frugality-canon.
 *
 * TypeScript twin of `src/scripts/measure_frugality_savings.py` (ADR-090,
 * Phase 8 Wave 8a). Mirrors the Python CLI contract EXACTLY — exit code 0,
 * byte-identical stdout (`json.dumps(record, indent=2, ensure_ascii=False)`
 * + the `appended → …` line), and the byte-identical JSONL baseline row
 * (`json.dumps(record, ensure_ascii=False)`).
 *
 * Measures the *current state* of the frugality canon along four
 * deterministic axes. Output: JSONL baseline appended to
 * agents/runtime/frugality/baseline.jsonl (gitignored).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { pyRound } from './_lib/value_ladder.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const _DEFAULT_ROOT = path.resolve(_HERE, '..', '..');

export const CANON_RULES: ReadonlyArray<[string, string]> = [
    ['direct-answers', 'kernel'],
    ['no-cheap-questions', 'kernel'],
    ['ask-when-uncertain', 'kernel'],
    ['user-interaction', 'tier_1'],
    ['telegraph-speak', 'tier_1'],
    ['token-efficiency', 'tier_2'],
];
export const CHARTER = 'frugality-charter';

const FILLER_PATTERNS: readonly string[] = [
    String.raw`\bgreat question\b`,
    String.raw`\bfascinating\b`,
    String.raw`\bexcellent point\b`,
    String.raw`\blet me\s+(check|look|find|verify|investigate|see)\b`,
    String.raw`\bnow\s+(i'll|i will|let's)\b`,
    String.raw`\bgoing to\s+(check|run|use|call|invoke)\b`,
    String.raw`\bperfect\b!?`,
    String.raw`\bawesome\b!?`,
    String.raw`\bhere's what i\b`,
    String.raw`\bfound it\b`,
    String.raw`^\s*(ok|okay|alright)[!,.]\s`,
];
// re.compile("|".join(...), re.IGNORECASE | re.MULTILINE)
const FILLER_RE = new RegExp(FILLER_PATTERNS.join('|'), 'gim');

// re.compile(r"^##\s+(Interactions|See also|Related)\s*$", re.MULTILINE)
const XREF_HEADERS = /^##\s+(Interactions|See also|Related)\s*$/gm;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
type Dict = Record<string, Json>;

function _read(p: string): string {
    try {
        return fs.readFileSync(p, 'utf-8');
    } catch {
        return '';
    }
}

/** Mirror Python len(str) — count Unicode code points, not UTF-16 units. */
function pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n++;
    }
    return n;
}

/** Mirror Python str.splitlines() — split on line boundaries, no trailing empty. */
function _splitlines(s: string): string[] {
    if (s === '') {
        return [];
    }
    // Python splits on \n, \r, \r\n (and other Unicode line boundaries; the
    // corpus is JSONL so only \n / \r\n appear). No trailing empty element.
    const parts = s.split(/\r\n|\r|\n/);
    if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/** Mirror Python `len(re.findall(pattern, text))` for a global regex. */
function _countMatches(re: RegExp, text: string): number {
    re.lastIndex = 0;
    let count = 0;
    while (re.exec(text) !== null) {
        count++;
        // Guard against zero-width matches (none of our patterns are, but safe).
        if (re.lastIndex === 0) {
            re.lastIndex++;
        }
    }
    return count;
}

export function metric_a_footprint(root: string): Dict {
    const rows: Dict[] = [];
    let kernel_total = 0;
    let tier1_total = 0;
    let tier2_total = 0;
    for (const [name, tier] of CANON_RULES) {
        const condensed = path.join(root, 'dist/agent-src', 'rules', `${name}.md`);
        const chars = pyLen(_read(condensed));
        const tokens = Math.floor(chars / 4); // rough 4-char/token approximation
        rows.push({ rule: name, tier, chars, tokens_approx: tokens });
        if (tier === 'kernel') {
            kernel_total += chars;
        } else if (tier === 'tier_1') {
            tier1_total += chars;
        } else if (tier === 'tier_2') {
            tier2_total += chars;
        }
    }
    const charter_chars = pyLen(
        _read(path.join(root, 'dist/agent-src', 'contexts', 'contracts', `${CHARTER}.md`)),
    );
    return {
        rules: rows,
        kernel_total_chars: kernel_total,
        tier_1_total_chars: tier1_total,
        tier_2_total_chars: tier2_total,
        charter_chars,
        kernel_budget_chars: 26000,
        kernel_pct: pyRound(100 * (kernel_total / 26000), 2),
    };
}

export function metric_b_fillers(corpus: string): Dict {
    if (!_existsFile(corpus)) {
        return { corpus_present: false };
    }
    const lines = _splitlines(_read(corpus));
    let agent_turns = 0;
    let filler_hits = 0;
    let total_chars = 0;
    for (const ln of lines.slice(1)) {
        let d: Json;
        try {
            d = JSON.parse(ln);
        } catch {
            continue;
        }
        if (d === null || typeof d !== 'object' || Array.isArray(d)) {
            // Python: d.get(...) would raise AttributeError for non-dict; but
            // json.loads of a JSON scalar yields a non-dict. The original code
            // assumes object rows; a scalar row would crash. Replicate by only
            // proceeding on objects (a scalar `.get` would AttributeError —
            // but corpus rows are always objects, so this branch never fires
            // on real input).
            continue;
        }
        if (d['t'] !== 'agent') {
            continue;
        }
        const text = (d['text'] ?? '') as string;
        agent_turns += 1;
        total_chars += pyLen(text);
        filler_hits += _countMatches(FILLER_RE, text);
    }
    return {
        corpus_present: true,
        agent_turns,
        filler_hits_total: filler_hits,
        filler_hits_per_turn: pyRound(filler_hits / Math.max(agent_turns, 1), 3),
        agent_chars_total: total_chars,
        patterns_count: FILLER_PATTERNS.length,
        note: 'chat-history texts are digests, not full transcripts; signal not output volume',
    };
}

function _existsFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile() || fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

export function metric_c_condensation(root: string): Dict {
    const rows: Dict[] = [];
    for (const [name] of CANON_RULES) {
        const un = pyLen(_read(path.join(root, '.agent-src.uncondensed', 'rules', `${name}.md`)));
        const co = pyLen(_read(path.join(root, 'dist/agent-src', 'rules', `${name}.md`)));
        const delta = un - co;
        const ratio = un ? pyRound(co / un, 3) : 0;
        rows.push({ rule: name, uncondensed_chars: un, condensed_chars: co, delta, ratio });
    }
    return { rules: rows };
}

export function metric_d_redundancy(root: string): Dict {
    const rows: Dict[] = [];
    for (const [name] of CANON_RULES) {
        const p = path.join(root, '.agent-src.uncondensed', 'rules', `${name}.md`);
        const text = _read(p);
        const xref_count = _countMatches(XREF_HEADERS, text);
        // naive: chars after last xref header to EOF. Python uses code-point
        // offsets (re over a str); compute the tail as code-point length of the
        // substring from the last match's UTF-16 index to EOF.
        const matchIdx: number[] = [];
        XREF_HEADERS.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = XREF_HEADERS.exec(text)) !== null) {
            matchIdx.push(m.index);
            if (XREF_HEADERS.lastIndex === m.index) {
                XREF_HEADERS.lastIndex++;
            }
        }
        const xref_block_chars =
            matchIdx.length > 0
                ? pyLen(text.slice(matchIdx[matchIdx.length - 1] as number))
                : 0;
        rows.push({ rule: name, xref_sections: xref_count, xref_block_chars });
    }
    let total = 0;
    for (const r of rows) {
        total += r['xref_block_chars'] as number;
    }
    return { rules: rows, total_xref_chars: total };
}

// --- json.dumps(ensure_ascii=False) emulation -------------------------------

function _pyJsonStrNoAscii(s: string): string {
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
            // ensure_ascii=False → emit the character verbatim.
            out += ch;
        }
    }
    return out + '"';
}

function _pyNum(n: number): string {
    return String(n);
}

/**
 * Mirror `json.dumps(obj, ensure_ascii=False)` with optional 2-space indent
 * and sort_keys=False (insertion order preserved).
 */
function pyJsonDumps(obj: Json, indent: number | null, level = 0): string {
    if (obj === null) {
        return 'null';
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (typeof obj === 'number') {
        return _pyNum(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStrNoAscii(obj);
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        if (indent === null) {
            return `[${obj.map((v) => pyJsonDumps(v, null)).join(', ')}]`;
        }
        const pad = ' '.repeat(indent * (level + 1));
        const closePad = ' '.repeat(indent * level);
        return `[\n${obj.map((v) => pad + pyJsonDumps(v, indent, level + 1)).join(',\n')}\n${closePad}]`;
    }
    if (typeof obj === 'object') {
        const keys = Object.keys(obj as Dict);
        if (keys.length === 0) {
            return '{}';
        }
        if (indent === null) {
            return `{${keys.map((k) => `${_pyJsonStrNoAscii(k)}: ${pyJsonDumps((obj as Dict)[k], null)}`).join(', ')}}`;
        }
        const pad = ' '.repeat(indent * (level + 1));
        const closePad = ' '.repeat(indent * level);
        const parts = keys.map(
            (k) => `${pad}${_pyJsonStrNoAscii(k)}: ${pyJsonDumps((obj as Dict)[k], indent, level + 1)}`,
        );
        return `{\n${parts.join(',\n')}\n${closePad}}`;
    }
    return 'null';
}

/** Mirror datetime.now(tz=utc).isoformat(timespec="seconds") → ...+00:00. */
function _iso_seconds_utc(): string {
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
    );
}

export function buildRecord(root: string): Dict {
    const corpus = path.join(root, 'agents', 'runtime', '.agent-chat-history');
    return {
        schema_version: 1,
        ts: _iso_seconds_utc(),
        phase: 'phase_0_baseline',
        metric_a_footprint: metric_a_footprint(root),
        metric_b_fillers: metric_b_fillers(corpus),
        metric_c_condensation: metric_c_condensation(root),
        metric_d_redundancy: metric_d_redundancy(root),
    };
}

export function main(): number {
    const root = _DEFAULT_ROOT;
    const record = buildRecord(root);

    const out = path.join(root, 'agents', 'runtime', 'frugality', 'baseline.jsonl');
    // with out.open("a") — does NOT mkdir parents; mirror that (will throw if
    // the directory is missing, exactly like the Python original).
    fs.appendFileSync(out, pyJsonDumps(record, null) + '\n');
    process.stdout.write(pyJsonDumps(record, 2) + '\n');
    const rel = path.relative(root, out).split(path.sep).join('/');
    process.stdout.write(`\nappended → ${rel}\n`);
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    // Set exitCode rather than process.exit() so the large JSON stdout write
    // (the full record, indent=2) fully drains to the pipe before exit.
    process.exitCode = main();
}
