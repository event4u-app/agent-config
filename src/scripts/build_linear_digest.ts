#!/usr/bin/env tsx
/**
 * build_linear_digest.ts — build the Linear AI rules digest.
 *
 * TypeScript twin of `src/scripts/build_linear_digest.py` (ADR-092 —
 * Python→TS migration, Phase 8 / Wave 8b). The CLI contract is mirrored
 * EXACTLY — the `--max-bytes` / `--out-dir` / `--strict-missing` flags,
 * exit codes (0 ok · 2 over-budget · 3 missing rule file · 4
 * strict-missing drift), the stdout/stderr split, byte-identical
 * messages, and byte-identical written file content.
 *
 * Concatenates a curated set of cloud-safe rules from `dist/agent-src/rules/`
 * into three Markdown files under `dist/linear/`.
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const SOURCE = path.join(ROOT, 'dist/agent-src', 'rules');
export const OUT_DIR = path.join(ROOT, 'dist', 'linear');

export const DEFAULT_MAX_BYTES = 100_000;

export interface RuleEntry {
    name: string;
    mode: string; // "as-is" | "degraded"
    strip_sections: string[];
}

export function RuleEntry(name: string, mode = 'as-is', strip_sections: string[] = []): RuleEntry {
    return { name, mode, strip_sections };
}

// Workspace digest — universal coding posture.
export const WORKSPACE: RuleEntry[] = [
    RuleEntry('ask-when-uncertain'),
    RuleEntry('commit-conventions'),
    RuleEntry('context-hygiene', 'degraded', ['Augment-specific: Ignored Skills Recovery']),
    RuleEntry('direct-answers'),
    RuleEntry('markdown-safe-codeblocks'),
    RuleEntry('minimal-safe-diff'),
    RuleEntry('reviewer-awareness'),
    RuleEntry('scope-control'),
    RuleEntry('security-sensitive-stop'),
    RuleEntry('think-before-action'),
    RuleEntry('verify-before-complete'),
    RuleEntry('cli-output-handling'),
    RuleEntry('downstream-changes'),
    RuleEntry('improve-before-implement'),
    RuleEntry('language-and-tone', 'degraded', ['`.md` files — ALWAYS English']),
    RuleEntry('missing-tool-handling'),
    RuleEntry('token-efficiency'),
    RuleEntry('user-interaction'),
];

// Team digest — framework-specific.
export const TEAM: RuleEntry[] = [
    RuleEntry('docker-commands'),
    RuleEntry('laravel-translations'),
    RuleEntry('php-coding'),
];

// Personal digest is empty by default — just a stub.
export const PERSONAL: RuleEntry[] = [];

// Patchable module table mirroring the Python tests' monkeypatch surface.
const _config = { WORKSPACE, TEAM, PERSONAL };

/** Test seam mirroring `monkeypatch.setattr(bld, "WORKSPACE", …)` etc. */
export function _setConfigForTest(overrides: Partial<{ WORKSPACE: RuleEntry[]; TEAM: RuleEntry[]; PERSONAL: RuleEntry[] }>): void {
    Object.assign(_config, overrides);
}

// FRONTMATTER_RE = re.compile(r"^---\n.*?\n---\n", re.DOTALL)
const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/;
// LINK_RE = re.compile(r"\[([^\]]+)\]\((?!https?://)[^)]+\)")
const LINK_RE = /\[([^\]]+)\]\((?!https?:\/\/)[^)]+\)/g;
// H1_RE = re.compile(r"^# ", re.MULTILINE)
const H1_RE = /^# /m;

export function strip_frontmatter(text: string): string {
    // re.sub(count=1) then .lstrip()
    const out = text.replace(FRONTMATTER_RE, '');
    return _lstrip(out);
}

/** Python `str.lstrip()` — strip leading whitespace (incl. \n \t \r etc.). */
function _lstrip(s: string): string {
    return s.replace(/^\s+/, '');
}

/** Python `str.rstrip()`. */
function _rstrip(s: string): string {
    return s.replace(/\s+$/, '');
}

export function demote_h1(text: string): string {
    // H1_RE.sub("## ", text, count=1) — only the first "^# ".
    return text.replace(H1_RE, '## ');
}

export function normalize_links(text: string): string {
    return text.replace(LINK_RE, '$1');
}

/** Escape a string for use inside a RegExp (mirrors re.escape). */
function _reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function strip_section(text: string, section_title: string): [string, boolean] {
    // re.compile(rf"^(#{{2,3}})\s+{re.escape(title)}\s*\n.*?(?=^#{{1,3}}\s|\Z)",
    //            re.DOTALL | re.MULTILINE)
    // JS: DOTALL via [\s\S]; \Z → end-of-string $ (no trailing newline anchor).
    const pattern = new RegExp(
        '^(#{2,3})\\s+' + _reEscape(section_title) + '\\s*\\n[\\s\\S]*?(?=^#{1,3}\\s|$(?![\\s\\S]))',
        'gm',
    );
    let count = 0;
    const new_text = text.replace(pattern, () => {
        count += 1;
        return '';
    });
    return [new_text, count > 0];
}

export function render_rule(entry: RuleEntry): [string, string[]] {
    const p = path.join(SOURCE, `${entry.name}.md`);
    if (!_isFile(p)) {
        const err = new Error(`Rule source missing: ${p}`) as Error & { _fileNotFound?: boolean };
        err._fileNotFound = true;
        throw err;
    }

    let text = fs.readFileSync(p, 'utf-8');
    text = strip_frontmatter(text);
    text = demote_h1(text);
    text = normalize_links(text);

    const missing: string[] = [];
    if (entry.mode === 'degraded') {
        for (const section of entry.strip_sections) {
            const [t, found] = strip_section(text, section);
            text = t;
            if (!found) {
                missing.push(section);
            }
        }
    }

    // Collapse any double-blank-lines created by stripping.
    text = _rstrip(text.replace(/\n{3,}/g, '\n\n')) + '\n';
    return [text, missing];
}

interface DigestSummary {
    layer: string;
    rules: number;
    missing: Record<string, string[]>;
}

export function render_digest(layer: string, entries: RuleEntry[]): [string, DigestSummary] {
    const parts: string[] = [];
    parts.push(`# event4u/agent-config — Linear AI ${_title(layer)} Digest\n`);
    parts.push(
        '> Auto-generated by `scripts/build_linear_digest.py` from ' +
            '`dist/agent-src/rules/` (condensed source) plus the inclusion list ' +
            'at `docs/contracts/linear-ai-rules-inclusion.md`. Do not edit ' +
            'this file by hand — re-run `task build-linear-digest` to ' +
            'regenerate.\n',
    );
    if (layer === 'personal') {
        parts.push(
            '\nPersonal guidance is intentionally empty — paste your own ' +
                'preferences (response language overrides, IDE shortcuts, naming ' +
                'conventions) below this line.\n',
        );
        return [parts.join(''), { layer, rules: 0, missing: {} }];
    }

    if (entries.length === 0) {
        parts.push('\n_No rules in this digest._\n');
        return [parts.join(''), { layer, rules: 0, missing: {} }];
    }

    parts.push(`\n_${entries.length} rules included. Order matches the inclusion ` + 'list._\n\n---\n\n');

    const missing_per_rule: Record<string, string[]> = {};
    for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i] as RuleEntry;
        const [body, missing] = render_rule(entry);
        if (missing.length > 0) {
            missing_per_rule[entry.name] = missing;
        }
        parts.push(body);
        if (i < entries.length - 1) {
            parts.push('\n---\n\n');
        }
    }

    return [parts.join(''), { layer, rules: entries.length, missing: missing_per_rule }];
}

/** Python `str.title()` — title-cases each word. Used only on simple slugs here. */
function _title(s: string): string {
    return s.replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _utf8ByteLen(s: string): number {
    return Buffer.byteLength(s, 'utf-8');
}

interface ParsedArgs {
    max_bytes: number;
    out_dir: string;
    strict_missing: boolean;
}

function _argError(msg: string): never {
    process.stderr.write('usage: build_linear_digest [-h] [--max-bytes MAX_BYTES] [--out-dir OUT_DIR] [--strict-missing]\n');
    process.stderr.write(`build_linear_digest: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { max_bytes: DEFAULT_MAX_BYTES, out_dir: OUT_DIR, strict_missing: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const value = (flag: string): string => {
            const eq = a.indexOf('=');
            if (eq !== -1 && a.startsWith('--')) {
                return a.slice(eq + 1);
            }
            const next = argv[i + 1];
            if (next === undefined) {
                _argError(`argument ${flag}: expected one argument`);
            }
            i += 1;
            return next;
        };
        if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: build_linear_digest [-h] [--max-bytes MAX_BYTES] [--out-dir OUT_DIR] [--strict-missing]\n',
            );
            process.exit(0);
        } else if (a === '--strict-missing') {
            out.strict_missing = true;
        } else if (a === '--max-bytes' || a.startsWith('--max-bytes=')) {
            const v = value('--max-bytes');
            const n = Number.parseInt(v, 10);
            if (!Number.isInteger(n) || `${n}` !== v.trim()) {
                _argError(`argument --max-bytes: invalid int value: '${v}'`);
            }
            out.max_bytes = n;
        } else if (a === '--out-dir' || a.startsWith('--out-dir=')) {
            out.out_dir = value('--out-dir');
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    fs.mkdirSync(args.out_dir, { recursive: true });

    const layers: Array<[string, RuleEntry[]]> = [
        ['workspace', _config.WORKSPACE],
        ['team', _config.TEAM],
        ['personal', _config.PERSONAL],
    ];
    let over_budget = false;
    let drift = false;

    for (const [layer, entries] of layers) {
        let digest: string;
        let summary: DigestSummary;
        try {
            [digest, summary] = render_digest(layer, entries);
        } catch (exc) {
            const e = exc as Error & { _fileNotFound?: boolean };
            if (e._fileNotFound) {
                process.stderr.write(`❌  ${e.message}\n`);
                return 3;
            }
            throw exc;
        }

        const out_path = path.join(args.out_dir, `${layer}.md`);
        fs.writeFileSync(out_path, digest, 'utf-8');
        const size = _utf8ByteLen(digest);
        const flag = size > args.max_bytes ? '⚠️ ' : '  ';
        const display_path = _relativeToRootOr(out_path);
        // f"{flag}{layer:<10} {summary['rules']:>2} rules  {size:>6} bytes  {display_path}"
        process.stdout.write(
            `${flag}${_ljust(layer, 10)} ${_rjust(String(summary.rules), 2)} rules  ` +
                `${_rjust(String(size), 6)} bytes  ${display_path}\n`,
        );
        if (size > args.max_bytes) {
            over_budget = true;
        }
        if (Object.keys(summary.missing).length > 0) {
            drift = true;
            for (const [name, sections] of Object.entries(summary.missing)) {
                process.stderr.write(`   ⚠️  ${name}: unmatched strip_sections: ${_pyListRepr(sections)}\n`);
            }
        }
    }

    if (over_budget) {
        process.stderr.write(`❌  one or more digests exceed --max-bytes=${args.max_bytes}\n`);
        return 2;
    }
    if (drift && args.strict_missing) {
        process.stderr.write(
            '❌  --strict-missing: at least one strip_sections title did ' +
                'not match (digest config drifted from rule source)\n',
        );
        return 4;
    }
    return 0;
}

/** Python `out_path.relative_to(ROOT)` with ValueError → out_path fallback. */
function _relativeToRootOr(p: string): string {
    const rel = path.relative(ROOT, p);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        return p;
    }
    return rel.split(path.sep).join('/');
}

/** Python f-string `{x:<n}` (left-justify, space pad). */
function _ljust(s: string, n: number): string {
    return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

/** Python f-string `{x:>n}` (right-justify, space pad). */
function _rjust(s: string, n: number): string {
    return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

/** Python `repr(list[str])` — e.g. `['a', 'b']`. */
function _pyListRepr(items: string[]): string {
    return '[' + items.map((s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'").join(', ') + ']';
}

const _isCliEntry =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
