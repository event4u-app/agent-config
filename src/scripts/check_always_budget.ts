#!/usr/bin/env tsx
/**
 * Always-rule budget gate (Phases 7.1 + 7.4 of road-to-pr-34-followups,
 * extended by Phase 0.2 of road-to-structural-optimization).
 *
 * Ported from the retired Python `src/scripts/check_always_budget.py` (ADR-200 —
 * Python→TS migration, Phase 4 / Wave 4a). Mirrors the Python CLI
 * contract exactly: flags (`--quiet`, `--no-trend`), exit codes
 * (0 = pass/warn, 1 = fail, 3 = internal error), stdout/stderr split,
 * and byte-identical output.
 *
 * Enforces the budget contract under **Model (b) literal** — see
 * `docs/contracts/load-context-budget-model.md`. Effective size of a
 * `type: "always"` rule is its own char count plus the char count of
 * every context it loads (transitively, depth ≤ 2).
 *
 * Caps:
 * - Warn-at-80% / fail-at-90% global trend gate (Phase 7.1).
 * - Per-rule cap (≤ 6,000 chars per always-rule, Phase 7.4) — measured
 *   on extended size, with a transitional `KNOWN_PER_RULE_BREACHES`
 *   allowlist that Phase 2A retires.
 * - Top-3 cap (top-3 combined ≤ 50% of TOTAL_CAP, Phase 7.4) — extended.
 * - Depth-2 nesting cap on `load_context:` chains.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

import { asOf } from './_lib/as_of.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

// src/scripts/check_always_budget.ts → parents[2] is the repo root
// (mirrors the Python module's Path(__file__).resolve().parents[2]).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULES_DIR = path.join(REPO_ROOT, 'dist/agent-src', 'rules');
const SRC_PREFIX = '.agent-src.uncondensed/';
const COMP_PREFIX = 'dist/agent-src/';

/**
 * TWO BUDGETS, TWO DIMENSIONS (road-to-renewal-foundation Phase 1; council
 * 2026-08-02 option B, 2/2).
 *
 * `TOTAL_CAP` governs the **raw** dimension — the always-loaded kernel rule
 * bodies themselves. That is the dimension this cap was calibrated for and the
 * only one it ever actually enforced: until the dead-root repair in this same
 * change, `srcToCondensed()` resolved every `load_context` entry to a path that
 * could not exist, so the walker counted ZERO context files and `ext` always
 * equalled `raw`. The gate printed a confident `60.1%` of a dimension it was
 * not measuring.
 *
 * `EXT_TOTAL_CAP` governs the **extended** dimension — raw plus the transitive
 * closure of `load_context` / `load_context_eager` (depth ≤ 2). It is seeded at
 * the FIRST REAL MEASUREMENT, taken 2026-08-02 after the repair, and is a hard
 * gate (the council rejected an advisory cycle: an advisory number creates no
 * pressure and just defers the collision).
 *
 * The seed is a baseline of revealed debt, NOT a target and NOT an approval.
 * It exists so the number is visible and ratcheted; it may only move DOWN. The
 * Phase 2 token work of this roadmap is what pays it down.
 *
 * Deliberately NOT done: raising `TOTAL_CAP` to swallow the ext number. That
 * would silently redefine the kernel budget to ~2× what the maintainer approved
 * and remove exactly the pressure Phase 2 exists to apply.
 *
 * Deliberately DEFERRED: splitting lazy `load_context` from eager
 * `load_context_eager` (only the latter is unconditionally always-loaded). The
 * distinction is real and encoded in the schema, but narrowing an aggregate on
 * a semantic argument is a separate decision from repairing its measurement —
 * and it cannot claim the "live and green" protection the house discriminator
 * grants an enforced contract, because this dimension was never enforced.
 */
const TOTAL_CAP = 49_000;
const EXT_TOTAL_CAP = 60_254;
const EXT_MEASURED_AT = '2026-08-02';
const WARN_THRESHOLD = 0.8;
const FAIL_THRESHOLD = 0.9;

const CONCENTRATION_SINGLE_PCT = 0.12;
const CONCENTRATION_TOP3_PCT = 0.3;

const KNOWN_CONCENTRATION_BREACHES: Record<string, number> = {
    'language-and-tone.md': 4_174,
    'no-cheap-questions.md': 3_719,
    // Retired by the concentration-cap recalibration in the budget-SoT PR
    // (12% mis-fits a 9-rule kernel; direct-answers 12.7% < the recalibrated cap).
    'direct-answers.md': 3_600,
};
const KNOWN_TOP3_CONCENTRATION_CEILING: number | null = 11_300;

const SAFETY_FLOOR_RULES: ReadonlySet<string> = new Set([
    'non-destructive-by-default.md',
    'commit-policy.md',
    'scope-control.md',
    'verify-before-complete.md',
]);

const TREND_LOG = path.join(REPO_ROOT, '.github', 'budget-trend.jsonl');
const TREND_LOG_MAX_RECORDS = 500;
const TOLERANCE_BAND = 0.02;
const PER_RULE_CAP = 6_000;
// Top-3 is an EXT measure, so it is capped against the ext budget, not the raw
// one. Seeded 2026-08-02 at the measured 37,855 rather than the derived
// EXT_TOTAL_CAP/2 (30,127): the derived value was never met and would fail on
// day one, which is a baseline the gate cannot hold. Ratchet — moves DOWN only.
const TOP3_CAP = 37_855;
const MAX_DEPTH = 2;
const MAX_CONTEXTS_PER_RULE = 3;

const RECOVERY_BAND_ENABLED = true;
const BASELINE_FILE = path.join(REPO_ROOT, '.github', 'budget-baseline.txt');

/**
 * Per-rule EXT ceilings, reseeded 2026-08-02 at the first real measurement.
 *
 * The previous values (`non-destructive-by-default` 7,908 · `scope-control`
 * 8,550) were ~2× those rules' raw sizes, which is why they are evidence the
 * ext dimension once counted contexts — but they have been unenforceable for as
 * long as the resolver was broken, so they describe a tree that no longer
 * exists. Reseeding them to the measured values is a baseline of revealed debt,
 * not an approval: these are ratchets and may only move DOWN.
 *
 * `commit-policy` and `verify-before-complete` are new entries for the same
 * reason — they breach the 6,000 per-rule cap only now that their context
 * closures are actually counted.
 */
const KNOWN_PER_RULE_BREACHES: Record<string, number> = {
    'scope-control.md': 19_332,
    'non-destructive-by-default.md': 9_657,
    'commit-policy.md': 8_866,
    'verify-before-complete.md': 7_140,
};

const PROG = 'check_always_budget.py';

// ---------------------------------------------------------------------------
// Python parity helpers
// ---------------------------------------------------------------------------

/** Python `f"{n:,}"` — thousands separators with commas. */
function comma(n: number): string {
    const neg = n < 0;
    const digits = Math.abs(Math.trunc(n)).toString();
    const parts: string[] = [];
    for (let i = digits.length; i > 0; i -= 3) {
        parts.unshift(digits.slice(Math.max(0, i - 3), i));
    }
    return (neg ? '-' : '') + parts.join(',');
}

/** Python `format(x, ".Nf")` — round-half-to-even fixed-point. */
function fixed(x: number, n: number): string {
    if (!Number.isFinite(x)) return String(x);
    const neg = x < 0;
    const abs = Math.abs(x);
    const factor = 10 ** n;
    const scaled = abs * factor;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    let rounded: number;
    if (Math.abs(frac - 0.5) < 1e-9) {
        rounded = floor % 2 === 0 ? floor : floor + 1;
    } else {
        rounded = Math.round(scaled);
    }
    const val = rounded / factor;
    let out = val.toFixed(n);
    if (neg && Number.parseFloat(out) !== 0) out = `-${out}`;
    return out;
}

/** Python f-string `{x:>n}` — right-justify, pad left with spaces. */
function padLeft(s: string | number, width: number): string {
    const str = String(s);
    return str.length >= width ? str : ' '.repeat(width - str.length) + str;
}

// ---------------------------------------------------------------------------
// File / frontmatter helpers
// ---------------------------------------------------------------------------

function loadBaseline(): number | null {
    if (!fs.existsSync(BASELINE_FILE)) return null;
    const text = fs.readFileSync(BASELINE_FILE, 'utf-8');
    for (let raw of splitlines(text)) {
        raw = raw.trim();
        if (!raw || raw.startsWith('#')) continue;
        const v = parsePyInt(raw);
        return v; // first non-comment line decides (None if malformed)
    }
    return null;
}

/** Python `int(str)` — strict base-10 integer or None semantics. Returns
 * null for malformed (the caller treats null as ValueError). */
function parsePyInt(s: string): number | null {
    const t = s.trim();
    if (!/^[+-]?\d+$/.test(t)) return null;
    return Number.parseInt(t, 10);
}

function splitlines(text: string): string[] {
    if (text === '') return [];
    const lines: string[] = [];
    let current = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i] as string;
        if (ch === '\r') {
            lines.push(current);
            current = '';
            if (text[i + 1] === '\n') i += 1;
            continue;
        }
        if (ch === '\n') {
            lines.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    if (current !== '') lines.push(current);
    return lines;
}

type Frontmatter = Record<string, unknown>;

function frontmatter(filePath: string): Frontmatter {
    const text = fs.readFileSync(filePath, 'utf-8');
    if (!text.startsWith('---\n')) return {};
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) return {};
    try {
        const parsed = YAML.parse(text.slice(4, end));
        if (parsed && typeof parsed === 'object') return parsed as Frontmatter;
        return {};
    } catch {
        return {};
    }
}

function isAlways(filePath: string): boolean {
    return frontmatter(filePath)['type'] === 'always';
}

function loadContextPaths(filePath: string): string[] {
    const fm = frontmatter(filePath);
    const out: string[] = [];
    for (const key of ['load_context', 'load_context_eager']) {
        const list = fm[key];
        if (Array.isArray(list)) {
            for (const entry of list) out.push(String(entry));
        }
    }
    return out;
}

/**
 * Resolve one `load_context` entry to the projected file it names.
 *
 * DEAD-ROOT REPAIR (road-to-renewal-foundation Phase 1). This used to be:
 *
 *     if (entry.startsWith(<retired authoring root>)) → dist/agent-src/<rest>
 *     else                                             → REPO_ROOT/<entry>
 *
 * The retired authoring root was deleted by ADR-051, so the first branch was
 * unreachable. The second branch was wrong for every real entry: `load_context`
 * values are relative to the file that declares them
 * (`../contexts/execution/autonomy-mechanics.md` from a rule in
 * `dist/agent-src/rules/`), never repo-root-relative. Joining them to the repo
 * root produced `<repo>/contexts/…`, which never exists — and `walkContexts`
 * silently `continue`s on a missing path.
 *
 * Net effect: the transitive-context dimension of this budget counted ZERO
 * files while the gate printed a confident percentage. It reported ~60% of a
 * cap it was not measuring, and would have reported the same had every rule
 * pulled in a megabyte of context.
 *
 * `skill:` / `guideline:` entries are scheme references, not paths — they have
 * no file to size and are skipped explicitly rather than by accidental
 * existsSync failure.
 *
 * @param entry the raw frontmatter value
 * @param fromFile absolute path of the file that declared it
 * @returns absolute path, or `null` when the entry names no file
 */
function resolveContextEntry(entry: string, fromFile: string): string | null {
    const trimmed = entry.trim();
    if (trimmed === '' || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
        // `skill:foo`, `guideline:bar/baz`, or any other scheme reference.
        return null;
    }
    if (trimmed.startsWith(SRC_PREFIX)) {
        // Legacy authoring-root form, kept so a stale entry still resolves to
        // its projected twin instead of silently counting zero.
        return path.join(REPO_ROOT, COMP_PREFIX + trimmed.slice(SRC_PREFIX.length));
    }
    if (trimmed.startsWith(COMP_PREFIX) || path.isAbsolute(trimmed)) {
        return path.resolve(REPO_ROOT, trimmed);
    }
    // The real shape: relative to the declaring file's directory.
    return path.resolve(path.dirname(fromFile), trimmed);
}

/** Return [set of context files counted, list of depth-violation chains]. */
function walkContexts(rule: string): [Set<string>, Array<[string, string]>] {
    const seen = new Set<string>();
    const violations: Array<[string, string]> = [];
    const ruleName = path.basename(rule);
    const stack: Array<[string, number, string]> = [[rule, 0, ruleName]];
    while (stack.length > 0) {
        const [node, depth, chain] = stack.pop() as [string, number, string];
        for (const entry of loadContextPaths(node)) {
            const comp = resolveContextEntry(entry, node);
            const newChain = `${chain} → ${entry}`;
            if (comp === null) continue;
            if (depth + 1 > MAX_DEPTH) {
                violations.push([ruleName, newChain]);
                continue;
            }
            if (!fs.existsSync(comp)) continue;
            if (seen.has(comp)) continue;
            seen.add(comp);
            stack.push([comp, depth + 1, newChain]);
        }
    }
    return [seen, violations];
}

function statSize(filePath: string): number {
    return fs.statSync(filePath).size;
}

/** sorted(p for p in RULES_DIR.glob("*.md") if _is_always(p)) — alpha by path. */
function allwaysRules(): string[] {
    return glob(RULES_DIR)
        .filter((p) => isAlways(p))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function allRules(): string[] {
    return glob(RULES_DIR).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Non-recursive *.md glob in a directory (Path.glob("*.md")). */
function glob(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    return entries
        .filter((e) => e.isFile() && e.name.endsWith('.md'))
        .map((e) => path.join(dir, e.name));
}

function contextCount(rule: string): number {
    const fm = frontmatter(rule);
    const lazy = fm['load_context'];
    const eager = fm['load_context_eager'];
    return (
        (Array.isArray(lazy) ? lazy.length : 0) + (Array.isArray(eager) ? eager.length : 0)
    );
}

function perRuleCountBreaches(): Array<[string, number]> {
    const out: Array<[string, number]> = [];
    for (const rule of allRules()) {
        const n = contextCount(rule);
        if (n > MAX_CONTEXTS_PER_RULE) out.push([path.basename(rule), n]);
    }
    return out;
}

function extendedSize(rule: string): [number, Array<[string, string]>] {
    const raw = statSize(rule);
    const [contexts, violations] = walkContexts(rule);
    let ext = raw;
    for (const c of contexts) ext += statSize(c);
    return [ext, violations];
}

interface ConcentrationResult {
    singleBreaches: Array<[string, number, number]>;
    top3Breach: [number, number] | null;
}

function concentrationCheck(
    sizes: Array<[string, number, number]>,
    totalExt: number,
): ConcentrationResult {
    const nonFloor = sizes.filter(([name]) => !SAFETY_FLOOR_RULES.has(name));
    const singleCap = totalExt * CONCENTRATION_SINGLE_PCT;
    const top3Cap = totalExt * CONCENTRATION_TOP3_PCT;

    const singleBreaches: Array<[string, number, number]> = [];
    for (const [name, , ext] of nonFloor) {
        if (ext <= singleCap) continue;
        const ceiling = KNOWN_CONCENTRATION_BREACHES[name];
        if (ceiling !== undefined && ext <= ceiling) continue;
        singleBreaches.push([name, ext, ext / totalExt]);
    }

    let top3Sum = 0;
    for (const [, , ext] of nonFloor.slice(0, 3)) top3Sum += ext;
    let effectiveTop3Cap = top3Cap;
    if (KNOWN_TOP3_CONCENTRATION_CEILING !== null) {
        effectiveTop3Cap = Math.max(top3Cap, KNOWN_TOP3_CONCENTRATION_CEILING);
    }
    const top3Breach: [number, number] | null =
        top3Sum > effectiveTop3Cap ? [top3Sum, top3Sum / totalExt] : null;
    return { singleBreaches, top3Breach };
}

function recordTrend(totalExt: number, sizes: Array<[string, number, number]>): void {
    fs.mkdirSync(path.dirname(TREND_LOG), { recursive: true });
    const rules: Record<string, number> = {};
    for (const [name, , ext] of sizes) rules[name] = ext;
    const record = {
        ts: isoSeconds(),
        total: totalExt,
        rules,
    };
    let lines: string[] = [];
    if (fs.existsSync(TREND_LOG)) {
        lines = splitlines(fs.readFileSync(TREND_LOG, 'utf-8'));
    }
    lines.push(jsonCompact(record));
    if (lines.length > TREND_LOG_MAX_RECORDS) {
        lines = lines.slice(lines.length - TREND_LOG_MAX_RECORDS);
    }
    fs.writeFileSync(TREND_LOG, `${lines.join('\n')}\n`, 'utf-8');
}

/** datetime.now(timezone.utc).isoformat(timespec="seconds") → ...+00:00. */
function isoSeconds(): string {
    const d = asOf();
    const pad = (v: number): string => String(v).padStart(2, '0');
    return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00:00`
    );
}

/** json.dumps(record, separators=(",", ":")) — compact, key order preserved. */
function jsonCompact(record: { ts: string; total: number; rules: Record<string, number> }): string {
    const rulesEntries = Object.entries(record.rules)
        .map(([k, v]) => `${JSON.stringify(k)}:${v}`)
        .join(',');
    return `{"ts":${JSON.stringify(record.ts)},"total":${record.total},"rules":{${rulesEntries}}}`;
}

interface TrendRecord {
    total?: unknown;
    rules?: unknown;
    ts?: unknown;
}

function lastTrend(): TrendRecord | null {
    if (!fs.existsSync(TREND_LOG)) return null;
    const lines = splitlines(fs.readFileSync(TREND_LOG, 'utf-8')).filter((l) => l.trim());
    if (lines.length === 0) return null;
    try {
        return JSON.parse(lines[lines.length - 1] as string) as TrendRecord;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

interface ParsedArgs {
    quiet: boolean;
    noTrend: boolean;
}

class ArgError extends Error {}

function parseArgs(argv: readonly string[]): ParsedArgs {
    const parsed: ParsedArgs = { quiet: false, noTrend: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i] as string;
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(usageText());
            process.exit(0);
        } else if (arg === '--quiet') {
            parsed.quiet = true;
        } else if (arg === '--no-trend') {
            parsed.noTrend = true;
        } else {
            throw new ArgError(`unrecognized arguments: ${arg}`);
        }
    }
    return parsed;
}

function usageLine(): string {
    return `usage: ${PROG} [-h] [--quiet] [--no-trend]\n`;
}

function usageText(): string {
    return (
        usageLine() +
        '\n' +
        // argparse renders the module docstring as the description; the
        // current toolchain (Python 3.9) collapses internal whitespace.
        descriptionBlock() +
        '\n' +
        'optional arguments:\n' +
        '  -h, --help  show this help message and exit\n' +
        '  --quiet     suppress the per-rule breakdown unless threshold is crossed\n' +
        '  --no-trend  skip writing to .github/budget-trend.jsonl (Phase 5.3)\n'
    );
}

function descriptionBlock(): string {
    // argparse word-wraps the docstring to the terminal width; reference-only
    // surface (CI never calls --help). See divergence note in the report.
    return (
        'Always-rule budget gate (Phases 7.1 + 7.4 of road-to-pr-34-followups,\n' +
        'extended by Phase 0.2 of road-to-structural-optimization). Enforces the\n' +
        'budget contract under **Model (b) literal** — see\n' +
        '`docs/contracts/load-context-budget-model.md`. Effective size of a `type:\n' +
        '"always"` rule is its own char count plus the char count of every context\n' +
        'it loads (transitively, depth ≤ 2). Caps: - Warn-at-80% / fail-at-90%\n' +
        'global trend gate (Phase 7.1). - Per-rule cap (≤ 6,000 chars per\n' +
        'always-rule, Phase 7.4) — measured on extended size, with a transitional\n' +
        '`KNOWN_PER_RULE_BREACHES` allowlist that Phase 2A retires. - Top-3 cap\n' +
        '(top-3 combined ≤ 50% of TOTAL_CAP, Phase 7.4) — extended. - Depth-2\n' +
        'nesting cap on `load_context:` chains. Exit codes: 0 = pass (or warn), 1 =\n' +
        'fail (≥ 90% utilization, per-rule breach above ceiling, top-3 breach, or\n' +
        'depth violation), 3 = internal error.\n'
    );
}

function main(): number {
    let args: ParsedArgs;
    try {
        args = parseArgs(process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgError) {
            process.stderr.write(usageLine());
            process.stderr.write(`${PROG}: error: ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    if (!isDir(RULES_DIR)) {
        process.stderr.write(`❌  rules dir missing: ${RULES_DIR}\n`);
        return 3;
    }

    // The scanned unit is every projected rule, not the `type: always` subset the
    // budget is measured over: `isDir` above catches a MISSING projection, but a
    // present-and-empty one (a sync that produced no rules) reaches here, and
    // "no always-rules" cannot distinguish that from a tree whose rules are all
    // `type: auto`. Exit 3 stays — this file's documented internal-error code,
    // already used for the empty case, and the Taskfile fails on any non-zero, so
    // this was never a silent green.
    try {
        assertScanned({
            gate: 'check_always_budget',
            scanned: allRules().length,
            units: 'projected rule file(s)',
            roots: [path.relative(REPO_ROOT, RULES_DIR)],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 3;
        }
        throw exc;
    }

    const rules = allwaysRules();
    if (rules.length === 0) {
        process.stderr.write(`❌  no always-rules found under ${RULES_DIR}\n`);
        return 3;
    }

    const sizes: Array<[string, number, number]> = [];
    const allViolations: Array<[string, string]> = [];
    for (const rule of rules) {
        const [ext, violations] = extendedSize(rule);
        sizes.push([path.basename(rule), statSize(rule), ext]);
        for (const v of violations) allViolations.push(v);
    }

    // sizes.sort(key=lambda x: -x[2]) — stable descending by ext.
    sizes.sort((a, b) => b[2] - a[2]);
    let totalExt = 0;
    let totalRaw = 0;
    for (const s of sizes) {
        totalRaw += s[1];
        totalExt += s[2];
    }
    // TOTAL_CAP is the RAW budget (see the two-budgets note at the top); the
    // extended dimension has its own seeded cap.
    const pct = totalRaw / TOTAL_CAP;
    const extPct = totalExt / EXT_TOTAL_CAP;
    const extBreach = totalExt > EXT_TOTAL_CAP;
    let top3 = 0;
    for (const s of sizes.slice(0, 3)) top3 += s[2];
    const top3Breach = top3 > TOP3_CAP;

    const overPerRule: Array<[string, number]> = [];
    const grewOverCeiling: Array<[string, number, number]> = [];
    for (const [name, , ext] of sizes) {
        if (ext <= PER_RULE_CAP) continue;
        const ceiling = KNOWN_PER_RULE_BREACHES[name];
        if (ceiling === undefined) {
            overPerRule.push([name, ext]);
        } else if (ext > ceiling) {
            grewOverCeiling.push([name, ext, ceiling]);
        }
    }

    const inTolerance = pct >= 1.0 && pct <= 1.0 + TOLERANCE_BAND;
    const baseline = RECOVERY_BAND_ENABLED ? loadBaseline() : null;
    const inRecoveryBand =
        baseline !== null && pct >= FAIL_THRESHOLD && pct < 1.0 && totalExt < baseline;
    const { singleBreaches, top3Breach: top3ConcentrationBreach } = concentrationCheck(
        sizes,
        totalExt,
    );
    const countBreaches = perRuleCountBreaches();
    const failing =
        (pct >= FAIL_THRESHOLD && !inTolerance && !inRecoveryBand && pct < 1.0) ||
        pct > 1.0 + TOLERANCE_BAND ||
        extBreach ||
        overPerRule.length > 0 ||
        grewOverCeiling.length > 0 ||
        top3Breach ||
        allViolations.length > 0 ||
        singleBreaches.length > 0 ||
        top3ConcentrationBreach !== null ||
        countBreaches.length > 0;

    let status: string;
    let rc: number;
    if (failing) {
        status = '❌  FAIL';
        rc = 1;
    } else if (inTolerance) {
        status = '⚠️  WARN (G3 tolerance band)';
        rc = 0;
    } else if (inRecoveryBand) {
        status = `⚠️  WARN (recovery band, baseline ${comma(baseline as number)})`;
        rc = 0;
    } else if (pct >= WARN_THRESHOLD) {
        status = '⚠️  WARN';
        rc = 0;
    } else {
        status = '✅  OK';
        rc = 0;
    }

    const out: string[] = [];
    out.push(
        `${status}  always-rule raw budget: ${comma(totalRaw)} / ` +
            `${comma(TOTAL_CAP)} chars (${fixed(pct * 100, 1)}%) across ${rules.length} rule(s)`,
    );
    out.push(
        `      extended (raw + load_context closure): ${comma(totalExt)} / ` +
            `${comma(EXT_TOTAL_CAP)} chars (${fixed(extPct * 100, 1)}%)` +
            `${extBreach ? '  ❌ over the seeded ext cap' : ''}` +
            `  — ratchet seeded at the first real measurement ${EXT_MEASURED_AT}; may only move DOWN`,
    );
    out.push(
        `      thresholds: warn ${fixed(WARN_THRESHOLD * 100, 0)}% · ` +
            `fail ${fixed(FAIL_THRESHOLD * 100, 0)}% · ` +
            `per-rule ≤ ${comma(PER_RULE_CAP)} (ext) · top-3 ≤ ${comma(TOP3_CAP)} (ext) · ` +
            `depth ≤ ${MAX_DEPTH}`,
    );

    if (rc !== 0 || pct >= WARN_THRESHOLD || !args.quiet) {
        out.push('');
        out.push(`      breakdown (largest extended first; top-3 sum = ${comma(top3)}):`);
        for (let i = 0; i < sizes.length; i++) {
            const [name, raw, ext] = sizes[i] as [string, number, number];
            const tag = i < 3 ? ' (top-3)' : '';
            const ceiling = KNOWN_PER_RULE_BREACHES[name];
            let marker: string;
            if (ceiling !== undefined) {
                marker = `  ⚠️  allowlisted ≤ ${comma(ceiling)}`;
            } else if (ext > PER_RULE_CAP) {
                marker = '  ❌  per-rule breach';
            } else {
                marker = '';
            }
            out.push(`        ext=${padLeft(ext, 5)}  raw=${padLeft(raw, 5)}  ${name}${tag}${marker}`);
        }
    }

    if (overPerRule.length > 0) {
        const names = overPerRule.map(([n, s]) => `${n}=${comma(s)}`).join(', ');
        out.push('');
        out.push(`      Per-rule cap breach (> ${comma(PER_RULE_CAP)} chars, not allowlisted): ${names}`);
    }

    if (grewOverCeiling.length > 0) {
        const details = grewOverCeiling
            .map(([n, ext, ceiling]) => `${n}=${comma(ext)} > ceiling ${comma(ceiling)}`)
            .join(', ');
        out.push('');
        out.push(`      Allowlisted-breach growth (regression): ${details}`);
    }

    if (top3Breach) {
        out.push('');
        out.push(
            `      Top-3 cap breach: ${comma(top3)} > ${comma(TOP3_CAP)} chars ` +
                `(top-3 must stay ≤ 50% of ${comma(TOTAL_CAP)} total budget).`,
        );
    }

    if (allViolations.length > 0) {
        out.push('');
        out.push(`      Depth-${MAX_DEPTH} nesting cap violations:`);
        for (const [ruleName, chain] of allViolations) {
            out.push(`        ${ruleName}: ${chain}`);
        }
    }

    if (singleBreaches.length > 0) {
        const details = singleBreaches
            .map(([n, ext, frac]) => `${n}=${comma(ext)} (${fixed(frac * 100, 1)}%)`)
            .join(', ');
        out.push('');
        out.push(
            `      Concentration breach (single rule > ` +
                `${fixed(CONCENTRATION_SINGLE_PCT * 100, 0)}% of used budget, ` +
                `non-allowlisted): ${details}`,
        );
    }

    if (top3ConcentrationBreach !== null) {
        const [sum_, frac] = top3ConcentrationBreach;
        out.push('');
        out.push(
            `      Concentration breach (top-3 non-allowlisted > ` +
                `${fixed(CONCENTRATION_TOP3_PCT * 100, 0)}% of used budget): ` +
                `${comma(sum_)} (${fixed(frac * 100, 1)}%)`,
        );
    }

    if (countBreaches.length > 0) {
        const details = countBreaches.map(([n, c]) => `${n}=${c}`).join(', ');
        out.push('');
        out.push(
            `      Per-rule context-count cap breach ` +
                `(> ${MAX_CONTEXTS_PER_RULE} declared contexts, Q2 ` +
                `road-to-context-layer-maturity Phase 1.3): ${details}`,
        );
    }

    // Phase 5.3 — per-rule trend delta vs. previous run.
    const prev = lastTrend();
    if (prev !== null && !args.quiet) {
        const prevTotal = prev.total;
        const prevRules = (prev.rules ?? {}) as Record<string, unknown>;
        if (typeof prevTotal === 'number' && Number.isInteger(prevTotal)) {
            const deltaTotal = totalExt - prevTotal;
            const sign = deltaTotal >= 0 ? '+' : '';
            out.push('');
            out.push(
                `      Trend vs. previous run ` +
                    `(${prev.ts ?? '?'}): total ${sign}${comma(deltaTotal)} chars`,
            );
            const deltas: Array<[string, number, number]> = [];
            for (const [name, , ext] of sizes) {
                const old = prevRules[name];
                if (typeof old === 'number' && Number.isInteger(old) && old !== ext) {
                    deltas.push([name, ext - old, ext]);
                }
            }
            if (deltas.length > 0) {
                deltas.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
                for (const [name, d, ext] of deltas.slice(0, 5)) {
                    const s = d >= 0 ? '+' : '';
                    out.push(`        ${name}: ${s}${comma(d)} (now ${comma(ext)})`);
                }
            }
        }
    }

    if (!args.noTrend) {
        recordTrend(totalExt, sizes);
    }

    if (rc === 1) {
        out.push('');
        out.push(
            `      Action: trim the offending rule(s) via load_context: ` +
                `extraction (see contexts/execution + contexts/authority) ` +
                `until utilization drops below ${fixed(FAIL_THRESHOLD * 100, 0)}% ` +
                `and all per-rule / top-3 / depth caps hold. See ` +
                `docs/contracts/load-context-budget-model.md.`,
        );
    }

    process.stdout.write(`${out.join('\n')}\n`);
    return rc;
}

function isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const isMain =
    _isCliEntry();

if (isMain) {
    process.exit(main());
}

export {
    concentrationCheck,
    extendedSize,
    loadBaseline,
    perRuleCountBreaches,
    walkContexts,
};
