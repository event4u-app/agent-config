#!/usr/bin/env tsx
/**
 * Anti-duplicate originality gate (road-to-competitive-borrow P1.1).
 *
 * TypeScript twin of `src/scripts/lint_skill_originality.py` (ADR-096). The CLI
 * contract is mirrored EXACTLY — the `--strict` / `--json` / `--quiet` flags
 * (argparse; `-h`/`--help` exit 0, an unrecognized arg exits 2), exit codes
 * (0 = warn-only or strict-clean, 1 = strict + same-domain violation OR no
 * skills found, 2 = allowlist over cap), the stdout/stderr split, byte-identical
 * finding text (the `  [WOULD-FAIL] …` / `  [FAIL] …` / `  [warn] …` lines with
 * `:.3f` jaccard formatting + Python list repr for `shared_packs`, the
 * `❌  lint_skill_originality: …` strict-fail line, the `✅  …` success line),
 * the `json.dumps(..., indent=2)` report (shortest-round-trip float repr), the
 * `combinations` pair order, the `round(j, 3)` jaccard, the severity sort key,
 * and the allowlist load + cap. The shared tokeniser / Jaccard / frontmatter
 * primitives are imported from the `skill_overlap` TS twin (NOT the `.py`).
 *
 * Promotes the existing structural-overlap *report* (`skill_overlap.py`) to a
 * guard-railed *gate*. Reuses that script's tokeniser / Jaccard primitives — no
 * second similarity engine — but reads the **canonical** `src/skills` tree
 * (`skill_overlap.py` still scans the dead `.agent-src.uncondensed` baseline
 * path) and adds the two things a gate needs the report does not:
 *
 *   1. **Domain awareness.** Two skills are *same-domain* when their `packs:`
 *      sets intersect. Same-domain near-duplicates are the real failure (volume
 *      ≠ capability); cross-domain overlap is usually coincidental trigger
 *      language.
 *   2. **Severity split.** Same-domain pairs ≥ `FAIL_THRESHOLD` are the
 *      would-fail class; cross-domain pairs ≥ `WARN_THRESHOLD` are advisory.
 *
 * **Warn-only by default.** `docs/contracts/adr-architectural-consensus-mechanism.md`
 * deferred promoting the ontology-collision lint from `warn-only` to
 * `fail-the-build` "until thresholds are confirmed stable across one full
 * release cycle … so the threshold has time to settle without breaking PRs on
 * borderline noise." This gate honours that deferral: it prints the would-fail
 * class and exits 0. Promotion path: run with `--strict` (exits 1 on any
 * non-allowlisted same-domain violation) once thresholds are stable.
 * Resolution of the roadmap-P1.1-vs-ADR conflict: AI council (claude-sonnet-4-5
 * + gpt-4o, design lens, deep, 2026-06-15) — both members converged warn-only.
 *
 * Allowlist: `lint_skill_originality_allowlist.json` (legitimate
 * ADR-disambiguated cluster heads). Hard-capped at 20 entries per the
 * `autonomous-execution` allowlist-growth antipattern (>20 = the linter is
 * wrong, not the content).
 *
 * Usage:
 *     node scripts/lint_skill_originality.ts            # warn-only (CI default)
 *     node scripts/lint_skill_originality.ts --strict   # exit 1 on same-domain violations
 *     node scripts/lint_skill_originality.ts --json out.json
 *     node scripts/lint_skill_originality.ts --quiet
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { jaccard, parse_frontmatter, tokenize } from './skill_overlap.js';

const _HERE = fileURLToPath(import.meta.url);
// Path(__file__).resolve().parents[2] — repo root, two dirs up from src/scripts.
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const SKILLS = path.join(REPO, 'src', 'skills');
// Path(__file__).resolve().parent / "lint_skill_originality_allowlist.json"
const ALLOWLIST = path.join(path.dirname(_HERE), 'lint_skill_originality_allowlist.json');
const ALLOWLIST_CAP = 20;

// Same calibration as skill_overlap.py: 0.6 description-token Jaccard catches
// structural carbon-copies only (skills encode distinct trigger language by
// design). Same-domain pairs at/above this are merge/supersede candidates.
const FAIL_THRESHOLD = 0.6;
// Advisory floor — faint signal, never blocking even under --strict. Calibrated
// to surface the known cluster heads (laravel↔symfony-workflow ≈ 0.44,
// blade-ui↔livewire ≈ 0.42) without dragging in the coincidental ≈0.30 tail.
const WARN_THRESHOLD = 0.4;

interface SkillRec {
    slug: string;
    tokens: Set<string>;
    packs: Set<string>;
}

interface Finding {
    skill_a: string;
    skill_b: string;
    jaccard: number;
    same_domain: boolean;
    shared_packs: string[];
    severity: string;
}

/** Marks a number as a Python float so JSON renders the trailing `.0`. */
class PyFloat {
    value: number;
    constructor(value: number) {
        this.value = value;
    }
}

/** Thrown to mirror Python `raise SystemExit(2)` (int arg → exit 2, no extra msg). */
class ExitCode extends Error {
    code: number;
    constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
    }
}

/**
 * Extract the packs: list. parse_frontmatter collapses list items into one
 * space-joined string under the key (e.g. "- engineering-base - meta").
 *
 * Python: {tok.strip().lstrip("-").strip() for tok in raw.split()
 *          if tok.strip("-").strip()}
 */
function parse_packs(fm: Record<string, string>): Set<string> {
    const raw = fm['packs'] ?? '';
    const out = new Set<string>();
    for (const tok of _pySplitWhitespace(raw)) {
        if (_pyStripChar(tok, '-').trim()) {
            out.add(_pyLstripChar(tok.trim(), '-').trim());
        }
    }
    return out;
}

function load_skills(root: string): SkillRec[] {
    const skills: SkillRec[] = [];
    for (const skillMd of _sortedSkillMds(root)) {
        const [fm] = parse_frontmatter(fs.readFileSync(skillMd, 'utf-8'));
        const desc = fm['description'] ?? '';
        const trig = ['triggers', 'keywords', 'intents', 'domain']
            .map((k) => fm[k] ?? '')
            .join(' ');
        skills.push({
            slug: path.basename(path.dirname(skillMd)),
            tokens: tokenize(desc + ' ' + trig),
            packs: parse_packs(fm),
        });
    }
    return skills;
}

function load_allowlist(): Set<string> {
    if (!_isFile(ALLOWLIST)) {
        return new Set();
    }
    const data = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf-8')) as { pairs?: unknown };
    const entries = Array.isArray(data.pairs)
        ? (data.pairs as Array<{ skill_a: string; skill_b: string }>)
        : [];
    if (entries.length > ALLOWLIST_CAP) {
        process.stderr.write(
            `❌  lint_skill_originality: allowlist has ${entries.length} entries ` +
                `(> ${ALLOWLIST_CAP}). Per the autonomous-execution allowlist-growth ` +
                `antipattern, this means the linter is wrong, not the content — ` +
                `tighten the heuristic or narrow scope, do not grow the allowlist.\n`,
        );
        throw new ExitCode(2);
    }
    // {frozenset((p["skill_a"], p["skill_b"])) for p in entries} — order-independent key.
    return new Set(entries.map((p) => _frozenKey(p.skill_a, p.skill_b)));
}

function analyse(skills: SkillRec[], allow: Set<string>): Finding[] {
    const findings: Finding[] = [];
    // itertools.combinations(skills, 2) — index order, i<j.
    for (let i = 0; i < skills.length; i += 1) {
        for (let k = i + 1; k < skills.length; k += 1) {
            const a = skills[i] as SkillRec;
            const b = skills[k] as SkillRec;
            const j = jaccard(a.tokens, b.tokens);
            const shared = _intersectionSorted(a.packs, b.packs);
            const sameDomain = shared.length > 0;
            let severity: string;
            if (sameDomain && j >= FAIL_THRESHOLD) {
                severity = 'would-fail';
            } else if (!sameDomain && j >= WARN_THRESHOLD) {
                severity = 'warn';
            } else if (sameDomain && j >= WARN_THRESHOLD) {
                severity = 'warn';
            } else {
                continue;
            }
            const allowed = allow.has(_frozenKey(a.slug, b.slug));
            findings.push({
                skill_a: a.slug,
                skill_b: b.slug,
                jaccard: _pyRound3(j),
                same_domain: sameDomain,
                shared_packs: shared,
                severity: allowed ? 'allowlisted' : severity,
            });
        }
    }
    // findings.sort(key=lambda f: (f["severity"] != "would-fail", -f["jaccard"]))
    // Python's sort is stable; ties keep combinations order.
    return _stableSort(findings, (f1, f2) => {
        const t1 = f1.severity !== 'would-fail' ? 1 : 0;
        const t2 = f2.severity !== 'would-fail' ? 1 : 0;
        if (t1 !== t2) {
            return t1 - t2;
        }
        const m1 = -f1.jaccard;
        const m2 = -f2.jaccard;
        return m1 < m2 ? -1 : m1 > m2 ? 1 : 0;
    });
}

interface Args {
    strict: boolean;
    json: string | null;
    quiet: boolean;
}

function parse_args(argv: readonly string[]): Args {
    const args: Args = { strict: false, json: null, quiet: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--strict') {
            args.strict = true;
        } else if (a === '--quiet') {
            args.quiet = true;
        } else if (a === '--json') {
            const v = argv[i + 1];
            if (v === undefined) {
                // argparse prog = os.path.basename(sys.argv[0]) → the .py basename.
                process.stderr.write(
                    'usage: lint_skill_originality.py [-h] [--strict] [--json JSON] [--quiet]\n' +
                        'lint_skill_originality.py: error: argument --json: expected one argument\n',
                );
                throw new ExitCode(2);
            }
            args.json = v;
            i += 1;
        } else if (a.startsWith('--json=')) {
            args.json = a.slice('--json='.length);
        } else if (a === '-h' || a === '--help') {
            // Help prose is not byte-compared (per the migration spec); the
            // usage line matches argparse so the leading line is faithful.
            process.stdout.write(
                'usage: lint_skill_originality.py [-h] [--strict] [--json JSON] [--quiet]\n',
            );
            throw new ExitCode(0);
        } else {
            process.stderr.write(
                'usage: lint_skill_originality.py [-h] [--strict] [--json JSON] [--quiet]\n' +
                    `lint_skill_originality.py: error: unrecognized arguments: ${a}\n`,
            );
            throw new ExitCode(2);
        }
    }
    return args;
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const skills = load_skills(SKILLS);
    if (skills.length === 0) {
        process.stderr.write(`no skills under ${SKILLS}\n`);
        return 1;
    }
    const allow = load_allowlist();
    const findings = analyse(skills, allow);

    const blocking = findings.filter((f) => f.severity === 'would-fail');
    const warns = findings.filter((f) => f.severity === 'warn');

    if (args.json !== null) {
        const out = path.resolve(args.json);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        // Float-tag every value that is a Python float so it serializes with a
        // decimal point even when integer-valued (round(1.0, 3) → "1.0", the
        // thresholds → "0.6" / "0.4"); `scanned` stays a bare int.
        fs.writeFileSync(
            out,
            _jsonDumps2({
                scanned: skills.length,
                fail_threshold: new PyFloat(FAIL_THRESHOLD),
                warn_threshold: new PyFloat(WARN_THRESHOLD),
                mode: args.strict ? 'strict' : 'warn-only',
                findings: findings.map((f) => ({
                    skill_a: f.skill_a,
                    skill_b: f.skill_b,
                    jaccard: new PyFloat(f.jaccard),
                    same_domain: f.same_domain,
                    shared_packs: f.shared_packs,
                    severity: f.severity,
                })),
            }) + '\n',
            'utf-8',
        );
    }

    if (!args.quiet) {
        for (const f of blocking) {
            const tag = !args.strict ? 'WOULD-FAIL' : 'FAIL';
            process.stdout.write(
                `  [${tag}] same-domain ${_fmt3(f.jaccard)}  ` +
                    `\`${f.skill_a}\` ↔ \`${f.skill_b}\`  packs=${_pyListRepr(f.shared_packs)}\n`,
            );
        }
        for (const f of warns) {
            process.stdout.write(
                `  [warn] ${_fmt3(f.jaccard)}  \`${f.skill_a}\` ↔ \`${f.skill_b}\`` +
                    `${f.same_domain ? ' (same-domain)' : ''}\n`,
            );
        }
    }

    if (args.strict && blocking.length) {
        process.stderr.write(
            `❌  lint_skill_originality: ${blocking.length} same-domain ` +
                `near-duplicate pair(s) ≥ ${_pyFloatStr(FAIL_THRESHOLD)}. Merge, supersede, ` +
                `or allowlist with an ADR rationale.\n`,
        );
        return 1;
    }

    if (!args.quiet) {
        const suffix = args.strict ? '' : ' (warn-only per ADR deferral)';
        process.stdout.write(
            `✅  lint_skill_originality: ${skills.length} skills, ` +
                `${blocking.length} would-fail / ${warns.length} warn${suffix}\n`,
        );
    }
    return 0;
}

// --- helpers --------------------------------------------------------------

// sorted(root.glob("*/SKILL.md")) — by full POSIX path string.
function _sortedSkillMds(root: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(root);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const name of names) {
        const md = path.join(root, name, 'SKILL.md');
        if (_isFile(md)) {
            out.push(md);
        }
    }
    out.sort(_pyStrCmp);
    return out;
}

/** frozenset((a, b)) — order-independent membership key. */
function _frozenKey(a: string, b: string): string {
    return a <= b ? `${a} ${b}` : `${b} ${a}`;
}

/** sorted(a & b) — codepoint-sorted intersection. */
function _intersectionSorted(a: Set<string>, b: Set<string>): string[] {
    const out: string[] = [];
    for (const x of a) {
        if (b.has(x)) {
            out.push(x);
        }
    }
    out.sort(_pyStrCmp);
    return out;
}

/** Python `round(x, 3)` — half-to-even on the exact IEEE-754 value. */
function _pyRound3(value: number): number {
    if (!Number.isFinite(value) || value === 0) {
        return value;
    }
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    const str = abs.toPrecision(17);
    if (str.includes('e') || str.includes('E')) {
        return Math.round(value * 1000) / 1000;
    }
    const [intPart, fracPartRaw = ''] = str.split('.');
    const frac = fracPartRaw.padEnd(4, '0');
    const keep = frac.slice(0, 3);
    const nextDigit = frac.charCodeAt(3) - 48;
    const rest = frac.slice(4).replace(/0+$/, '');
    let base = Number(`${intPart}.${keep}`);
    let roundUp = false;
    if (nextDigit > 5) {
        roundUp = true;
    } else if (nextDigit === 5) {
        if (rest.length > 0) {
            roundUp = true;
        } else {
            // exact half → round to even
            const lastKept = keep.charCodeAt(2) - 48;
            roundUp = lastKept % 2 === 1;
        }
    }
    if (roundUp) {
        base = Number((base + 0.001).toFixed(3));
    }
    return sign * base;
}

/** Python f"{x:.3f}" — fixed 3 decimals, half-to-even. */
function _fmt3(value: number): string {
    // The value is already round(x,3); toFixed(3) is exact on a 3-decimal value.
    return _pyRound3(value).toFixed(3);
}

/** Python str(float) for a threshold — shortest round-trip repr. */
function _pyFloatStr(value: number): string {
    if (Number.isInteger(value)) {
        return `${value}.0`;
    }
    return String(value);
}

/** Python repr of a list of strings: ['a', 'b']. */
function _pyListRepr(items: readonly string[]): string {
    return `[${items.map((s) => _pyStrRepr(s)).join(', ')}]`;
}

/** Python repr() of a string (single-quote preference). */
function _pyStrRepr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Mirror `json.dumps(obj, indent=2)` (ensure_ascii=True, key order preserved). */
function _jsonDumps2(obj: unknown): string {
    return _pyJson(obj, 2, 0);
}

function _pyJson(v: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const padEnd = ' '.repeat(indent * depth);
    if (v === null) {
        return 'null';
    }
    if (v instanceof PyFloat) {
        // Python float repr: integer-valued floats keep a ".0"; otherwise the
        // shortest round-trip (String matches Python float.__repr__ here).
        return Number.isInteger(v.value) ? `${v.value}.0` : String(v.value);
    }
    if (typeof v === 'boolean') {
        return v ? 'true' : 'false';
    }
    if (typeof v === 'number') {
        // The only integer-valued number reaching JSON is `scanned` (a Python
        // int → bare). Every float field is `round(j,3)` ≥ WARN_THRESHOLD (0.4)
        // or a threshold constant (0.6 / 0.4) — all non-integer-valued, so the
        // shortest round-trip repr (`String(n)`, matching Python float.__repr__:
        // 0.6 → "0.6", 0.444 → "0.444") never needs a forced ".0".
        return String(v);
    }
    if (typeof v === 'string') {
        return _pyJsonStr(v);
    }
    if (Array.isArray(v)) {
        if (v.length === 0) {
            return '[]';
        }
        const items = v.map((it) => pad + _pyJson(it, indent, depth + 1));
        return '[\n' + items.join(',\n') + '\n' + padEnd + ']';
    }
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) {
        return '{}';
    }
    const items = entries.map(
        ([k, val]) => `${pad}${_pyJsonStr(k)}: ${_pyJson(val, indent, depth + 1)}`,
    );
    return '{\n' + items.join(',\n') + '\n' + padEnd + '}';
}

/** Python `str.split()` (no args) — split on runs of whitespace, drop empties. */
function _pySplitWhitespace(s: string): string[] {
    return s.split(/\s+/u).filter((t) => t.length > 0);
}

/** Python `str.strip(ch)` — strip leading+trailing runs of a single char. */
function _pyStripChar(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) start += 1;
    while (end > start && s[end - 1] === ch) end -= 1;
    return s.slice(start, end);
}

/** Python `str.lstrip(ch)` — strip leading run of a single char. */
function _pyLstripChar(s: string, ch: string): string {
    let start = 0;
    while (start < s.length && s[start] === ch) start += 1;
    return s.slice(start);
}

/** Python-string ordering (codepoint), for `sorted(...)` parity. */
function _pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function _stableSort<T>(arr: T[], cmp: (a: T, b: T) => number): T[] {
    return arr
        .map((v, i) => [v, i] as [T, number])
        .sort((p, q) => cmp(p[0], q[0]) || p[1] - q[1])
        .map((p) => p[0]);
}

/** Mirror Python json string encoding with ensure_ascii=True (\uXXXX escapes). */
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
        } else if (code < 0x20 || code > 0x7e) {
            if (code > 0xffff) {
                const c = code - 0x10000;
                const hi = 0xd800 + (c >> 10);
                const lo = 0xdc00 + (c & 0x3ff);
                out +=
                    '\\u' +
                    hi.toString(16).padStart(4, '0') +
                    '\\u' +
                    lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + code.toString(16).padStart(4, '0');
            }
        } else {
            out += ch;
        }
    }
    return out + '"';
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        if (exc instanceof ExitCode) {
            process.exit(exc.code);
        }
        throw exc;
    }
}

export {
    REPO,
    SKILLS,
    ALLOWLIST,
    ALLOWLIST_CAP,
    FAIL_THRESHOLD,
    WARN_THRESHOLD,
    main,
    parse_args,
    parse_packs,
    load_skills,
    load_allowlist,
    analyse,
    ExitCode,
};
