// P3.1 — consumer-facing agent-config security audit (road-to-security-pillar.md).
//
// TypeScript twin of `src/scripts/security_audit_config.py` (ADR-096 —
// Python→TS migration). Behaviour mirrors the Python module byte-for-byte.
//
// Points the Phase-1 detection logic at a *consumer's assembled* agent config —
// instruction files (CLAUDE.md, AGENTS.md, .cursor/rules, copilot-instructions),
// MCP configs (.mcp.json, .cursor/mcp.json, claude_desktop_config.json), settings
// + hooks (.claude/settings.json), and installed skills — and emits an A–F score
// with a per-category breakdown mapped to the OWASP Top 10 for Agentic
// Applications (ASI).
//
// Detection is the same library as the self-audit gate (so there is one source of
// truth for the patterns) under the same false-positive containment convention.
// This is decision-support, not a guarantee: detection is probabilistic.
//
// Twin note — the four Phase-1 check modules are all ported to TypeScript now;
// each `_scan` export is imported from its `.js` twin (single source of truth, no
// inline copies):
//   - p11 (hidden-unicode), p12 (instruction-smuggling),
//   - p13 (mcp-config-security), p14 (dangerous-frontmatter).
// The golden-parity test runs the Python `security_audit_config.py` (which imports
// the real p11–p14 `.py`) against this twin and asserts byte-identical output.
//
// Usage:
//   ./scripts-run src/scripts/security_audit_config [--root DIR] [--json]

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import * as sl from './_lib/security_lint.js';
import { _scan as _scanHiddenUnicode } from './lint_hidden_unicode.js';
import { _scan as _scanInstructionSmuggling } from './lint_instruction_smuggling.js';
import { _scan as _scanMcp } from './lint_mcp_config_security.js';
import { _scan as _scanFrontmatter } from './lint_skill_frontmatter_safety.js';

// Consumer config surfaces (globs relative to --root).
const SURFACES: readonly string[] = [
    'CLAUDE.md',
    'AGENTS.md',
    'GEMINI.md',
    '.clinerules',
    '.windsurfrules',
    '.github/copilot-instructions.md',
    '.cursor/rules/**/*',
    '.cursorrules',
    '.claude/skills/**/SKILL.md',
    '.claude/commands/**/*.md',
    '.claude/settings.json',
    '.claude/settings.local.json',
    '.mcp.json',
    '.cursor/mcp.json',
    'claude_desktop_config.json',
];

// check id → [category, OWASP-ASI tag]
const CATEGORY: Readonly<Record<string, readonly [string, string]>> = {
    'hidden-unicode': ['Agents/Rules', 'ASI01 Goal Hijack'],
    'instruction-smuggling': ['Agents/Rules', 'ASI01 Goal Hijack'],
    'mcp-config-security': ['MCP', 'ASI04 Supply Chain'],
    'dangerous-frontmatter': ['Permissions', 'ASI03 Privilege Abuse'],
};
const SECRET_HINT = 'secret'; // mcp finding mentioning a secret → Secrets category
const CATEGORIES: readonly string[] = ['Secrets', 'Permissions', 'Hooks', 'MCP', 'Agents/Rules'];

// Deduction per finding (full weight); weighted findings scale by their weight.
const _DEDUCT: Readonly<Record<string, number>> = { HIGH: 25.0, MED: 5.0, LOW: 2.0 };

// =====================================================================
// Audit core
// =====================================================================

function _grade(score: number): string {
    return score >= 90
        ? 'A'
        : score >= 80
          ? 'B'
          : score >= 70
            ? 'C'
            : score >= 60
              ? 'D'
              : 'F';
}

function _category(f: sl.Finding): string {
    if (f.check === 'mcp-config-security' && f.message.toLowerCase().includes(SECRET_HINT)) {
        return 'Secrets';
    }
    const entry = CATEGORY[f.check];
    return entry ? entry[0] : 'Agents/Rules';
}

/**
 * Mirror `root.glob(pattern)` (pathlib, Python 3.9) for the SURFACE patterns,
 * yielding absolute paths. Components are split on "/"; a `**` component is the
 * recursive-wildcard selector. A trailing `*` / `**` lists directory entries.
 *
 * Ordering note: pathlib's glob walks via `os.scandir`, whose order is
 * filesystem-dependent and differs from `fs.readdirSync` on some platforms. The
 * traversal *structure* (component recursion, `**` self-then-subdirs depth-first,
 * `is_file` filter, first-seen dedup) is replicated faithfully; intra-directory
 * entry order follows `fs.readdirSync`. Multi-file-per-pattern consumer trees can
 * therefore differ in finding order from the Python original on platforms where
 * scandir != readdir. The golden test pins one-file-per-pattern fixtures so the
 * order is unambiguous; the clean real-`src/` path emits no findings.
 */
function* _globPattern(root: string, pattern: string): Generator<string> {
    const parts = pattern.split('/');
    yield* _globFrom(root, parts, 0);
}

function _listEntries(dir: string): fs.Dirent[] {
    try {
        return fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
}

function* _globFrom(base: string, parts: readonly string[], idx: number): Generator<string> {
    if (idx >= parts.length) {
        return;
    }
    const part = parts[idx] as string;
    const isLast = idx === parts.length - 1;

    if (part === '**') {
        // Recursive wildcard: yield base itself as a match-dir, then each
        // descendant directory (depth-first, scandir order), continuing the
        // remaining pattern from each. pathlib yields base first.
        for (const matchDir of _iterateDirectories(base)) {
            yield* _globFrom(matchDir, parts, idx + 1);
        }
        return;
    }

    if (part === '*') {
        for (const e of _listEntries(base)) {
            const full = path.join(base, e.name);
            if (isLast) {
                yield full;
            } else if (e.isDirectory()) {
                yield* _globFrom(full, parts, idx + 1);
            }
        }
        return;
    }

    // Literal component (the SURFACE patterns use only literals, `*`, `**`).
    const full = path.join(base, part);
    if (isLast) {
        if (fs.existsSync(full)) {
            yield full;
        }
        return;
    }
    // Descend only if it is a directory (mirrors pathlib selector chaining).
    let isDir = false;
    try {
        isDir = fs.statSync(full).isDirectory();
    } catch {
        isDir = false;
    }
    if (isDir) {
        yield* _globFrom(full, parts, idx + 1);
    }
}

/** Mirror pathlib `_RecursiveWildcardSelector._iterate_directories`. */
function* _iterateDirectories(base: string): Generator<string> {
    yield base;
    for (const e of _listEntries(base)) {
        if (e.isDirectory()) {
            yield* _iterateDirectories(path.join(base, e.name));
        }
    }
}

function* _iterTargets(root: string): Generator<string> {
    const seen = new Set<string>();
    for (const pattern of SURFACES) {
        for (const p of _globPattern(root, pattern)) {
            let isFile = false;
            try {
                isFile = fs.statSync(p).isFile();
            } catch {
                isFile = false;
            }
            if (isFile && !seen.has(p)) {
                seen.add(p);
                yield p;
            }
        }
    }
}

interface CategoryReport {
    score: sl.PyFloat;
    grade: string;
    owasp: string;
    findings: Array<{
        path: string;
        line: number;
        check: string;
        severity: string;
        message: string;
        weight: sl.PyFloat;
    }>;
}

interface AuditReport {
    root: string;
    overall_score: sl.PyFloat;
    overall_grade: string;
    categories: Record<string, CategoryReport>;
}

function audit(root: string): AuditReport {
    const findings: sl.Finding[] = [];
    for (const p of _iterTargets(root)) {
        let sf: sl.ScannedFile;
        try {
            sf = sl.scan_path(p, root);
        } catch {
            // Python catches (UnicodeDecodeError, OSError).
            continue;
        }
        for (const scan of [
            _scanHiddenUnicode,
            _scanInstructionSmuggling,
            _scanMcp,
            _scanFrontmatter,
        ]) {
            try {
                for (const f of scan(sf)) {
                    findings.push(f);
                }
            } catch {
                // Python: except Exception: pass
            }
        }
    }

    const per_cat: Record<string, number> = {};
    const cat_findings: Record<string, sl.Finding[]> = {};
    for (const c of CATEGORIES) {
        per_cat[c] = 100.0;
        cat_findings[c] = [];
    }
    for (const f of findings) {
        const cat = _category(f);
        per_cat[cat] = (per_cat[cat] as number) - (_DEDUCT[f.severity] ?? 2.0) * f.weight;
        (cat_findings[cat] as sl.Finding[]).push(f);
    }
    for (const c of CATEGORIES) {
        per_cat[c] = Math.max(0.0, per_cat[c] as number);
    }

    // round(sum(per_cat.values()) / len(CATEGORIES), 1)
    let total = 0;
    for (const c of CATEGORIES) {
        total += per_cat[c] as number;
    }
    const overall = _pyRound1(total / CATEGORIES.length);

    const categories: Record<string, CategoryReport> = {};
    for (const c of CATEGORIES) {
        const fls = cat_findings[c] as sl.Finding[];
        // next((CATEGORY[fl.check][1] for fl in cat_findings[c] if fl.check in CATEGORY), "")
        let owasp = '';
        for (const fl of fls) {
            if (CATEGORY[fl.check] !== undefined) {
                owasp = (CATEGORY[fl.check] as readonly [string, string])[1];
                break;
            }
        }
        categories[c] = {
            score: new sl.PyFloat(_pyRound1(per_cat[c] as number)),
            grade: _grade(per_cat[c] as number),
            owasp,
            findings: fls.map((fl) => ({
                path: fl.path,
                line: fl.line,
                check: fl.check,
                severity: fl.severity,
                message: fl.message,
                weight: new sl.PyFloat(fl.weight),
            })),
        };
    }

    return {
        root,
        overall_score: new sl.PyFloat(overall),
        overall_grade: _grade(overall),
        categories,
    };
}

/**
 * Mirror Python `round(x, 1)` — banker's rounding (round-half-to-even) on the
 * decimal value, matching CPython's `round()` for the 1-decimal case used here.
 */
function _pyRound1(x: number): number {
    const scaled = x * 10;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let r: number;
    const EPS = 1e-9;
    if (Math.abs(diff - 0.5) < EPS) {
        // half → round to even
        r = floor % 2 === 0 ? floor : floor + 1;
    } else {
        r = Math.round(scaled);
    }
    return r / 10;
}

/** Mirror Python `f"{x:g}"` for the weight note (0.25 → "0.25", 1 → "1"). */
function _pyG(n: number): string {
    let s = n.toPrecision(6);
    if (s.includes('.')) {
        s = s.replace(/0+$/, '').replace(/\.$/, '');
    }
    return s;
}

/**
 * Mirror Python `str(round(...))` numeric rendering for the text report.
 * `report["overall_score"]` and `cat["score"]` are floats produced by round();
 * Python's f-string `{x}` for a float renders e.g. `100.0`, `87.5`, `0.0`.
 */
function _pyFloatStr(n: number): string {
    return Number.isInteger(n) ? `${n}.0` : String(n);
}

function _print(report: AuditReport): void {
    process.stdout.write(`Agent-config security audit — ${report.root}\n`);
    process.stdout.write(
        `Overall: ${report.overall_grade} (${_pyFloatStr(report.overall_score.value)}/100)\n\n`,
    );
    for (const c of CATEGORIES) {
        const cat = report.categories[c] as CategoryReport;
        const tag = cat.owasp ? ` · ${cat.owasp}` : '';
        // f"  {cat['grade']}  {c:<12} {cat['score']:>5}/100{tag}"
        const cPad = c.padEnd(12);
        const scorePad = _pyFloatStr(cat.score.value).padStart(5);
        process.stdout.write(`  ${cat.grade}  ${cPad} ${scorePad}/100${tag}\n`);
        for (const f of cat.findings) {
            const loc = f.line ? `${f.path}:${f.line}` : f.path;
            const w = f.weight.value >= 1.0 ? '' : ` (weight ${_pyG(f.weight.value)})`;
            process.stdout.write(`        [${f.severity}] ${loc}${w}: ${f.message}\n`);
        }
    }
    process.stdout.write(
        '\n> Decision support, not a guarantee — detection is probabilistic. ' +
            'Pair with /threat-model and judge-security-auditor for a deep pass.\n',
    );
}

interface Args {
    root: string;
    json: boolean;
}

function _argError(msg: string): never {
    process.stderr.write('usage: security_audit_config [-h] [--root ROOT] [--json]\n');
    process.stderr.write(`security_audit_config: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): Args {
    const out: Args = { root: '.', json: false };
    const extra: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write('usage: security_audit_config [-h] [--root ROOT] [--json]\n');
            process.exit(0);
        } else if (a === '--json') {
            out.json = true;
        } else if (a === '--root') {
            const v = argv[i + 1];
            if (v === undefined) {
                _argError('argument --root: expected one argument');
            }
            out.root = v;
            i += 1;
        } else if (a.startsWith('--root=')) {
            out.root = a.slice('--root='.length);
        } else {
            extra.push(a);
        }
    }
    if (extra.length > 0) {
        _argError(`unrecognized arguments: ${extra.join(' ')}`);
    }
    return out;
}

export function main(argv: readonly string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const report = audit(args.root);
    if (args.json) {
        process.stdout.write(sl.py_json_dumps_indent2(report) + '\n');
    } else {
        _print(report);
    }
    // Audit is advisory: always exit 0 (it informs, it does not gate the consumer).
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
    process.exitCode = main();
}

// Exported for the golden-parity test's unit layer.
export { audit, _iterTargets };
