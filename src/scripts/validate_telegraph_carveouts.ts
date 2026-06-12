#!/usr/bin/env tsx
/**
 * Mechanical carve-out validator for telegraph-condensed replies.
 *
 * TypeScript twin of `src/scripts/validate_telegraph_carveouts.py` (ADR-090,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — two positional
 * `pre` / `post` file args, exit codes (0 preserved, 1 drift, 2 missing
 * file), stdout/stderr split, byte-identical messages, the same carve-out
 * extractors and the same `difflib.unified_diff` rendering. No behaviour
 * changes — latent bugs replicated.
 *
 * Given a pre-condensation reply and a post-condensation reply, assert that
 * every carve-out region from `.agent-src.uncondensed/rules/telegraph-speak.md`
 * § Carve-outs survived byte-for-byte:
 *
 *   1. Triple-backtick code blocks (any language).
 *   2. Numbered-option lines.
 *   3. Backtick spans.
 *   4. Status / error marker lines.
 *   5. Triple-backtick ALL-CAPS Iron-Law literal fences.
 *
 * Exit 0 = all carve-outs preserved; exit 1 = drift detected.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Triple-backtick fenced blocks (greedy across lines). Group 1 = body.
// Mirrors `re.compile(r"```[^\n]*\n(.*?)\n```", re.DOTALL)`.
const RE_CODE_FENCE = /```[^\n]*\n([\s\S]*?)\n```/g;
// Numbered-option line.
const RE_NUMBERED = /^>?[ \t\f\v]*\d+\.[ \t\f\v\r\n].*$/gm;
// Recommendation labels (both languages).
const RE_RECOMMEND = /^\*\*(Recommendation|Empfehlung):\*\*.*$/gm;
// Backtick spans.
const RE_BACKTICK_SPAN = /`[^`\n]+`/g;
// Status / error marker lines.
const RE_STATUS_LINE = /^.*[❌⚠✅].*$/gm;
// Iron-Law ALL-CAPS fence body.
const RE_ALLCAPS_LINE = /^[A-Z0-9 ,\.\-—:'"·/()]+$/;

/**
 * Note on the regex character classes: Python's `re.MULTILINE` `.` does not
 * match `\n`, and `^`/`$` match at line boundaries. Python `\s` is Unicode but
 * the inputs use ASCII whitespace; JS `\s` is the equivalent here. The
 * numbered-option pattern's `\s` after the dot is reproduced with an explicit
 * whitespace class so `.` (which excludes `\n` in JS by default) stays aligned.
 */

function _extract_code_fences(text: string): string[] {
    return _matchAll0(text, RE_CODE_FENCE);
}

function _extract_lines(text: string, re: RegExp): string[] {
    return _matchAll0(text, re);
}

function _extract_backtick_spans(text: string): string[] {
    // Excludes triple-backtick fences (handled separately).
    const stripped = text.replace(RE_CODE_FENCE, '');
    return _matchAll0(stripped, RE_BACKTICK_SPAN);
}

function _matchAll0(text: string, re: RegExp): string[] {
    const out: string[] = [];
    for (const m of text.matchAll(re)) {
        out.push(m[0]);
    }
    return out;
}

function _is_allcaps_fence_body(body: string): boolean {
    const lines = body
        .split('\n')
        .map((ln) => ln.trim())
        .filter((ln) => ln !== '');
    if (lines.length === 0) {
        return false;
    }
    return lines.every((ln) => RE_ALLCAPS_LINE.test(ln));
}

function _extract_allcaps_fences(text: string): string[] {
    const out: string[] = [];
    for (const m of text.matchAll(RE_CODE_FENCE)) {
        if (_is_allcaps_fence_body(m[1] as string)) {
            out.push(m[0]);
        }
    }
    return out;
}

type Extractor = (t: string) => string[];

const CHECKS: ReadonlyArray<[string, Extractor]> = [
    ['code_fences', _extract_code_fences],
    ['numbered_options', (t) => _extract_lines(t, RE_NUMBERED)],
    ['recommendation_labels', (t) => _extract_lines(t, RE_RECOMMEND)],
    ['backtick_spans', _extract_backtick_spans],
    ['status_markers', (t) => _extract_lines(t, RE_STATUS_LINE)],
    ['allcaps_iron_law_fences', _extract_allcaps_fences],
];

/** Return list of [carve_out_name, unified_diff_lines] per drifted category. */
export function validate(pre: string, post: string): Array<[string, string[]]> {
    const failures: Array<[string, string[]]> = [];
    for (const [name, extractor] of CHECKS) {
        const pre_list = extractor(pre);
        const post_list = extractor(post);
        if (_listEq(pre_list, post_list)) {
            continue;
        }
        const diff = unified_diff(
            pre_list.map((s) => s + '\n'),
            post_list.map((s) => s + '\n'),
            `pre/${name}`,
            `post/${name}`,
            '',
        );
        failures.push([name, diff]);
    }
    return failures;
}

function _listEq(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function _render(failures: ReadonlyArray<[string, string[]]>): string {
    const out = ['telegraph carve-out validator: DRIFT DETECTED', ''];
    for (const [name, diff] of failures) {
        out.push(`❌ carve-out \`${name}\` drifted:`);
        out.push(...diff);
        out.push('');
    }
    return out.join('\n');
}

interface Args {
    pre: string;
    post: string;
}

function parse_args(argv: readonly string[]): Args {
    const positional: string[] = [];
    for (const arg of argv) {
        if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: validate_telegraph_carveouts [-h] pre post\n');
            process.exit(0);
        } else if (arg.startsWith('-') && arg !== '-') {
            process.stderr.write(`validate_telegraph_carveouts: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        } else {
            positional.push(arg);
        }
    }
    if (positional.length < 2) {
        process.stderr.write('validate_telegraph_carveouts: error: the following arguments are required: pre, post\n');
        process.exit(2);
    }
    return { pre: positional[0] as string, post: positional[1] as string };
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

export function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (!_isFile(args.pre)) {
        process.stderr.write(`pre file not found: ${args.pre}\n`);
        return 2;
    }
    if (!_isFile(args.post)) {
        process.stderr.write(`post file not found: ${args.post}\n`);
        return 2;
    }
    const pre = fs.readFileSync(args.pre, 'utf-8');
    const post = fs.readFileSync(args.post, 'utf-8');
    const failures = validate(pre, post);
    if (failures.length) {
        process.stdout.write(_render(failures) + '\n');
        return 1;
    }
    process.stdout.write('telegraph carve-out validator: all carve-outs preserved ✅\n');
    return 0;
}

export { CHECKS, _render };

// --- difflib.unified_diff port ----------------------------------------------
//
// Faithful port of Python's `difflib.unified_diff` (SequenceMatcher with the
// "autojunk"-disabled-irrelevant case for these short token lists). Produces
// the same header lines, hunk headers, and ` `/`-`/`+` prefixed body lines.
// `lineterm=''` is the only mode used here, so header/hunk lines carry no
// trailing newline. Body lines already carry their own `\n` from the caller.

interface OpCode {
    tag: 'replace' | 'delete' | 'insert' | 'equal';
    i1: number;
    i2: number;
    j1: number;
    j2: number;
}

function unified_diff(
    a: readonly string[],
    b: readonly string[],
    fromfile: string,
    tofile: string,
    lineterm: string,
    n = 3,
): string[] {
    const out: string[] = [];
    let started = false;
    const sm = new SequenceMatcher(a, b);
    for (const group of sm.get_grouped_opcodes(n)) {
        if (!started) {
            started = true;
            const fromdate = '';
            const todate = '';
            out.push(`--- ${fromfile}${fromdate}${lineterm}`);
            out.push(`+++ ${tofile}${todate}${lineterm}`);
        }
        const first = group[0] as OpCode;
        const last = group[group.length - 1] as OpCode;
        const file1Range = _format_range_unified(first.i1, last.i2);
        const file2Range = _format_range_unified(first.j1, last.j2);
        out.push(`@@ -${file1Range} +${file2Range} @@${lineterm}`);
        for (const op of group) {
            if (op.tag === 'equal') {
                for (const line of a.slice(op.i1, op.i2)) {
                    out.push(' ' + line);
                }
                continue;
            }
            if (op.tag === 'replace' || op.tag === 'delete') {
                for (const line of a.slice(op.i1, op.i2)) {
                    out.push('-' + line);
                }
            }
            if (op.tag === 'replace' || op.tag === 'insert') {
                for (const line of b.slice(op.j1, op.j2)) {
                    out.push('+' + line);
                }
            }
        }
    }
    return out;
}

function _format_range_unified(start: number, stop: number): string {
    // Per Python difflib._format_range_unified.
    let beginning = start + 1; // lines start numbering with one
    const length = stop - start;
    if (length === 1) {
        return `${beginning}`;
    }
    if (length === 0) {
        beginning -= 1; // empty ranges begin at line just before the range
    }
    return `${beginning},${length}`;
}

/**
 * Minimal SequenceMatcher port sufficient for difflib.unified_diff:
 * get_opcodes + get_grouped_opcodes. Uses the longest-matching-block
 * recursion identical to CPython's algorithm (junk disabled).
 */
class SequenceMatcher {
    private a: readonly string[];
    private b: readonly string[];
    private b2j: Map<string, number[]>;

    constructor(a: readonly string[], b: readonly string[]) {
        this.a = a;
        this.b = b;
        this.b2j = new Map();
        this._chain_b();
    }

    private _chain_b(): void {
        this.b2j.clear();
        for (let i = 0; i < this.b.length; i++) {
            const elt = this.b[i] as string;
            const arr = this.b2j.get(elt);
            if (arr) {
                arr.push(i);
            } else {
                this.b2j.set(elt, [i]);
            }
        }
        // autojunk: CPython pops elements appearing > 1% when len(b) >= 200.
        const n = this.b.length;
        if (n >= 200) {
            const ntest = Math.floor(n / 100) + 1;
            for (const [elt, idxs] of [...this.b2j.entries()]) {
                if (idxs.length > ntest) {
                    this.b2j.delete(elt);
                }
            }
        }
    }

    find_longest_match(alo: number, ahi: number, blo: number, bhi: number): [number, number, number] {
        const a = this.a;
        const b2j = this.b2j;
        let besti = alo;
        let bestj = blo;
        let bestsize = 0;
        let j2len: Map<number, number> = new Map();
        for (let i = alo; i < ahi; i++) {
            const newj2len: Map<number, number> = new Map();
            const indices = b2j.get(a[i] as string) ?? [];
            for (const j of indices) {
                if (j < blo) {
                    continue;
                }
                if (j >= bhi) {
                    break;
                }
                const k = (j2len.get(j - 1) ?? 0) + 1;
                newj2len.set(j, k);
                if (k > bestsize) {
                    besti = i - k + 1;
                    bestj = j - k + 1;
                    bestsize = k;
                }
            }
            j2len = newj2len;
        }
        // Extension over junk is irrelevant (no junk); CPython also extends over
        // non-junk equal elements at the boundaries — replicate.
        while (besti > alo && bestj > blo && a[besti - 1] === this.b[bestj - 1]) {
            besti -= 1;
            bestj -= 1;
            bestsize += 1;
        }
        while (
            besti + bestsize < ahi &&
            bestj + bestsize < bhi &&
            a[besti + bestsize] === this.b[bestj + bestsize]
        ) {
            bestsize += 1;
        }
        return [besti, bestj, bestsize];
    }

    get_matching_blocks(): Array<[number, number, number]> {
        const la = this.a.length;
        const lb = this.b.length;
        const queue: Array<[number, number, number, number]> = [[0, la, 0, lb]];
        const matchingBlocks: Array<[number, number, number]> = [];
        while (queue.length) {
            const [alo, ahi, blo, bhi] = queue.pop() as [number, number, number, number];
            const [i, j, k] = this.find_longest_match(alo, ahi, blo, bhi);
            if (k) {
                matchingBlocks.push([i, j, k]);
                if (alo < i && blo < j) {
                    queue.push([alo, i, blo, j]);
                }
                if (i + k < ahi && j + k < bhi) {
                    queue.push([i + k, ahi, j + k, bhi]);
                }
            }
        }
        matchingBlocks.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
        // Collapse adjacent equal blocks.
        let i1 = 0;
        let j1 = 0;
        let k1 = 0;
        const nonAdjacent: Array<[number, number, number]> = [];
        for (const [i2, j2, k2] of matchingBlocks) {
            if (i1 + k1 === i2 && j1 + k1 === j2) {
                k1 += k2;
            } else {
                if (k1) {
                    nonAdjacent.push([i1, j1, k1]);
                }
                i1 = i2;
                j1 = j2;
                k1 = k2;
            }
        }
        if (k1) {
            nonAdjacent.push([i1, j1, k1]);
        }
        nonAdjacent.push([la, lb, 0]);
        return nonAdjacent;
    }

    get_opcodes(): OpCode[] {
        let i = 0;
        let j = 0;
        const answer: OpCode[] = [];
        for (const [ai, bj, size] of this.get_matching_blocks()) {
            let tag: OpCode['tag'] | '' = '';
            if (i < ai && j < bj) {
                tag = 'replace';
            } else if (i < ai) {
                tag = 'delete';
            } else if (j < bj) {
                tag = 'insert';
            }
            if (tag) {
                answer.push({ tag, i1: i, i2: ai, j1: j, j2: bj });
            }
            i = ai + size;
            j = bj + size;
            if (size) {
                answer.push({ tag: 'equal', i1: ai, i2: i, j1: bj, j2: j });
            }
        }
        return answer;
    }

    get_grouped_opcodes(n = 3): OpCode[][] {
        let codes = this.get_opcodes();
        if (codes.length === 0) {
            codes = [{ tag: 'equal', i1: 0, i2: 1, j1: 0, j2: 1 }];
        }
        // Fixup leading/trailing equal blocks (truncate context).
        const first = codes[0] as OpCode;
        if (first.tag === 'equal') {
            codes[0] = {
                tag: 'equal',
                i1: Math.max(first.i1, first.i2 - n),
                i2: first.i2,
                j1: Math.max(first.j1, first.j2 - n),
                j2: first.j2,
            };
        }
        const last = codes[codes.length - 1] as OpCode;
        if (last.tag === 'equal') {
            codes[codes.length - 1] = {
                tag: 'equal',
                i1: last.i1,
                i2: Math.min(last.i2, last.i1 + n),
                j1: last.j1,
                j2: Math.min(last.j2, last.j1 + n),
            };
        }
        const nn = n + n;
        const groups: OpCode[][] = [];
        let group: OpCode[] = [];
        for (const op of codes) {
            let { i1, i2, j1, j2 } = op;
            const tag = op.tag;
            if (tag === 'equal' && i2 - i1 > nn) {
                group.push({ tag, i1, i2: Math.min(i2, i1 + n), j1, j2: Math.min(j2, j1 + n) });
                groups.push(group);
                group = [];
                i1 = Math.max(i1, i2 - n);
                j1 = Math.max(j1, j2 - n);
            }
            group.push({ tag, i1, i2, j1, j2 });
        }
        if (group.length && !(group.length === 1 && (group[0] as OpCode).tag === 'equal')) {
            groups.push(group);
        }
        return groups;
    }
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
