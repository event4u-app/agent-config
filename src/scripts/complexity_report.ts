#!/usr/bin/env tsx
/**
 * Lightweight complexity report — council-adjudicated (Phase 5 of the
 * feedback-8-11 roadmap): a REPORT-ONLY soft ratchet over five deterministic
 * proxy metrics for package complexity. No per-feature declaration duty, no
 * pass/fail gate — it prints the current numbers, the delta against the
 * previous run (if any), and a kill criterion the metric itself is subject
 * to. Exit code is ALWAYS 0.
 *
 * Metrics (each documents its own method inline in the rendered report):
 *   1. Active settings axes        — top + second-level keys in
 *                                     `src/config/agent-settings.template.yml`.
 *   2. Runtime-state surfaces      — distinct `agents/runtime/state/<x>`
 *                                     path literals referenced by `src/**​/*.ts`
 *                                     (grepped, NOT a live directory listing —
 *                                     the dir is gitignored and usually absent).
 *   3. Cross-subsystem dep edges   — edge count from the committed discovery
 *                                     graph cache if present; otherwise a
 *                                     proxy count of import edges between
 *                                     top-level `src/scripts/*.ts` modules
 *                                     (never triggers a graph rebuild — that
 *                                     would make this "lightweight" report
 *                                     spawn the full manifest builder).
 *   4. Always-loaded rule bytes    — byte sum of the rules the router marks
 *                                     `type: "always"` (the 9-rule kernel),
 *                                     read from `dist/router.json` + the
 *                                     condensed `dist/agent-src/rules/*.md`,
 *                                     falling back to `src/rules/*.md`
 *                                     frontmatter when the dist tree is
 *                                     absent (fresh checkout, pre-`task sync`).
 *   5. Mandatory gates / workflow   — case-insensitive whole-word `gate`
 *                                     mention count across the work-engine
 *                                     dispatcher directives
 *                                     (`src/agent-src/templates/scripts/work_engine/directives/`),
 *                                     averaged per directive file. A rough,
 *                                     deterministic proxy — NOT a semantic
 *                                     gate-graph analysis.
 *   6. Rule→skill coupling          — routing-target + backlink counts from
 *                                     `rule_backlinks.ts`'s `collect()` over
 *                                     `src/rules/*.md` (module reused as-is —
 *                                     no new scanning logic here).
 *
 * Soft ratchet: when the checked-in baseline
 * `internal/reports/complexity-baseline.json` exists, the report renders a
 * `## Ratchet vs baseline` section — per metric baseline vs current vs Δ,
 * with a WARN line for anything above baseline. Still report-only: the WARN
 * asks for a justification-or-rebaseline in the raising PR, it never fails
 * anything. Exit code stays ALWAYS 0.
 *
 * Every function below takes an explicit root/path argument (no hidden
 * module-level mutable state) so tests can point the counters at small
 * fixture trees and get fully deterministic output.
 *
 * Usage:
 *   ./scripts-run src/scripts/complexity_report [--root <path>] [--out <path>] [--quiet]
 *
 * CI wiring: `task complexity-report` (defined in `taskfiles/content.yml`,
 * wired into both CI task lists in `Taskfile.yml` since PR #918) — report-only,
 * exit code always 0, so it never fails the build.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

import { collect as collectRuleBacklinks } from './rule_backlinks.js';

const PROG = 'complexity_report';
const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const DEFAULT_OUT = path.join(REPO_ROOT, 'internal', 'reports', 'complexity-report.md');

export const KILL_CRITERION =
    'Kill criterion: if this report is cited by zero decisions (ADR/roadmap/PR) within 3 releases, ' +
    'delete the script and record the honest null.';

// ---------------------------------------------------------------------------
// fs helpers
// ---------------------------------------------------------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Recursively collect files under `dir` whose name matches `ext` (e.g. '.ts'). */
function _walkFiles(dir: string, ext: string, acc: string[] = []): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return acc;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            _walkFiles(p, ext, acc);
        } else if (e.isFile() && e.name.endsWith(ext)) {
            acc.push(p);
        }
    }
    return acc;
}

// ---------------------------------------------------------------------------
// Metric 1 — active settings axes
// ---------------------------------------------------------------------------

export interface SettingsAxesResult {
    top: number;
    second: number;
    total: number;
    method: string;
}

/**
 * Top-level key count + the sum of second-level key counts for every
 * top-level key whose value is a plain mapping (arrays/scalars contribute 0
 * at the second level). Deterministic over a YAML parse — no comment-line
 * counting, no regex.
 */
export function countSettingsAxes(templatePath: string): SettingsAxesResult {
    const method = `YAML-parsed \`${path.basename(templatePath)}\`: top-level keys + (sum of key-counts of every top-level mapping value).`;
    if (!_isFile(templatePath)) {
        return { top: 0, second: 0, total: 0, method: `${method} File not found.` };
    }
    const doc = YAML.parse(fs.readFileSync(templatePath, 'utf-8')) as Record<string, unknown> | null;
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
        return { top: 0, second: 0, total: 0, method: `${method} File did not parse to a mapping.` };
    }
    const topKeys = Object.keys(doc);
    let second = 0;
    for (const k of topKeys) {
        const v = doc[k];
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            second += Object.keys(v as Record<string, unknown>).length;
        }
    }
    return { top: topKeys.length, second, total: topKeys.length + second, method };
}

// ---------------------------------------------------------------------------
// Metric 2 — runtime-state surfaces
// ---------------------------------------------------------------------------

export interface RuntimeStateResult {
    count: number;
    names: string[];
    method: string;
}

const STATE_SLASH_RE = /agents\/runtime\/state\/([^\s'"`,)\]]+)/g;
const STATE_JOIN_RE = /['"]agents['"]\s*,\s*['"]runtime['"]\s*,\s*['"]state['"]\s*,\s*['"]([^'"]+)['"]/g;

/**
 * Distinct `agents/runtime/state/<x>` surfaces referenced by shipped
 * TypeScript source, derived by grepping the two literal shapes the
 * codebase actually uses (`'agents/runtime/state/<x>'` and
 * `path.join(..., 'agents', 'runtime', 'state', '<x>')`) — never by
 * listing a live directory, which is gitignored and normally absent on a
 * fresh checkout / in CI.
 */
export function countRuntimeStateSurfaces(srcDir: string): RuntimeStateResult {
    const method =
        `Grepped \`agents/runtime/state/<x>\` (slash literal) and ` +
        `\`'agents','runtime','state','<x>'\` (path.join literal) across every ` +
        `.ts file under \`${path.relative(REPO_ROOT, srcDir) || srcDir}\`; counts the ` +
        `distinct first path segment after \`state/\` once per name, regardless of ` +
        `call-site count. Tokens containing glob/template characters ` +
        `(\`*\`, \`<\`, \`>\`) are dropped as grep artifacts, not surfaces. ` +
        `Proxy for "surfaces the shipped code writes", not a ` +
        `runtime read/write trace.`;
    // Excludes this reporter's own source file — its docstrings quote the
    // `agents/runtime/state/<x>` literal shapes as documentation, which
    // would otherwise self-match and pollute the count with placeholder noise.
    const files = _walkFiles(srcDir, '.ts').filter((f) => path.basename(f) !== 'complexity_report.ts');
    const names = new Set<string>();
    for (const f of files) {
        const text = fs.readFileSync(f, 'utf-8');
        for (const re of [STATE_SLASH_RE, STATE_JOIN_RE]) {
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(text)) !== null) {
                const seg = (m[1] as string).split('/')[0]?.replace(/\.$/, '');
                // Requires at least one alphanumeric char — drops pure-prose
                // punctuation artifacts (e.g. a doc comment ending "state/…")
                // without trying to be clever about what counts as a "real" name.
                // Also drops glob/template placeholder tokens (`*.json`,
                // `<concern>.json`, `<id>.json`) — grep artifacts from prose,
                // patterns, and docstrings, not actual surfaces.
                if (seg && /[A-Za-z0-9]/.test(seg) && !/[*<>]/.test(seg)) names.add(seg);
            }
        }
    }
    const sorted = [...names].sort();
    return { count: sorted.length, names: sorted, method };
}

// ---------------------------------------------------------------------------
// Metric 3 — cross-subsystem dependency edges
// ---------------------------------------------------------------------------

export interface DependencyEdgesResult {
    count: number;
    source: 'graph-cache' | 'import-proxy';
    method: string;
}

/**
 * Prefer the committed discovery-graph cache (`agents/runtime/state/discovery-graph-v1.json`,
 * written by `discovery_graph.ts build`) when it exists and parses — its edge
 * count is the real cross-subsystem relation graph. When absent (the common
 * case: the cache is gitignored and this report never triggers a rebuild,
 * which would spawn `build_discovery_manifest.ts` and stop being
 * "lightweight"), fall back to a proxy: import edges between top-level
 * `src/scripts/*.ts` modules (direct children only — `_lib/`, `_cli/`, and
 * other subdirectories are excluded, since those are intra-module helpers,
 * not cross-subsystem edges).
 */
export function countDependencyEdges(root: string): DependencyEdgesResult {
    const graphCache = path.join(root, 'agents', 'runtime', 'state', 'discovery-graph-v1.json');
    if (_isFile(graphCache)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(graphCache, 'utf-8')) as { edges?: unknown[] };
            if (Array.isArray(parsed.edges)) {
                return {
                    count: parsed.edges.length,
                    source: 'graph-cache',
                    method: `Read \`edges.length\` from the committed discovery-graph cache at ` + `\`${path.relative(root, graphCache)}\`.`,
                };
            }
        } catch {
            // fall through to the proxy below
        }
    }
    const scriptsDir = path.join(root, 'src', 'scripts');
    let entries: fs.Dirent[] = [];
    try {
        entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
    } catch {
        // scriptsDir doesn't exist in this tree (e.g. a fixture root) — 0 edges.
    }
    const topFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.ts')).map((e) => e.name);
    const known = new Set(topFiles.map((f) => f.replace(/\.ts$/, '')));
    // Matches both from-imports and bare side-effect imports of a sibling
    // `.js` specifier — both are real edges between top-level modules.
    // (Wording avoids literal import-shaped strings: prepack-check's
    // shipped-import scanner reads comments too.)
    const importRe = /(?:from|import)\s+['"]\.\/([A-Za-z0-9_-]+)\.js['"]/g;
    let edges = 0;
    for (const f of topFiles) {
        const mod = f.replace(/\.ts$/, '');
        const text = fs.readFileSync(path.join(scriptsDir, f), 'utf-8');
        importRe.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = importRe.exec(text)) !== null) {
            const target = m[1] as string;
            if (target !== mod && known.has(target)) edges += 1;
        }
    }
    return {
        count: edges,
        source: 'import-proxy',
        method:
            'No usable discovery-graph cache found at `agents/runtime/state/discovery-graph-v1.json` ' +
            '(gitignored, rebuilding it here would spawn the full manifest builder) — counted ' +
            'relative sibling-`.js` import edges between top-level ' +
            '`src/scripts/*.ts` files instead (subdirectories like `_lib/`, `_cli/` excluded).',
    };
}

// ---------------------------------------------------------------------------
// Metric 4 — always-loaded rule bytes
// ---------------------------------------------------------------------------

export interface AlwaysRuleBytesResult {
    count: number;
    bytes: number;
    ids: string[];
    method: string;
}

const ALWAYS_TYPE_RE = /^type:\s*"?always"?\s*$/m;

/**
 * Byte sum of the rules the discovery layer marks as always-loaded — the
 * kernel. Prefers `dist/router.json`'s `kernel` array (the built router the
 * agent actually consults) resolved against the condensed
 * `dist/agent-src/rules/<id>.md` files; falls back to scanning
 * `src/rules/*.md` frontmatter for `type: "always"` when `dist/` hasn't been
 * generated yet (fresh checkout, pre-`task sync`).
 */
export function countAlwaysRuleBytes(root: string): AlwaysRuleBytesResult {
    const routerPath = path.join(root, 'dist', 'router.json');
    if (_isFile(routerPath)) {
        try {
            const router = JSON.parse(fs.readFileSync(routerPath, 'utf-8')) as { kernel?: unknown };
            if (Array.isArray(router.kernel)) {
                const ids = (router.kernel as unknown[]).filter((x): x is string => typeof x === 'string').sort();
                let bytes = 0;
                const found: string[] = [];
                for (const id of ids) {
                    const p = path.join(root, 'dist', 'agent-src', 'rules', `${id}.md`);
                    if (_isFile(p)) {
                        bytes += Buffer.byteLength(fs.readFileSync(p, 'utf-8'), 'utf-8');
                        found.push(id);
                    }
                }
                if (found.length > 0) {
                    return {
                        count: found.length,
                        bytes,
                        ids: found,
                        method:
                            "Byte sum of `dist/agent-src/rules/<id>.md` for every id in `dist/router.json`'s " +
                            '`kernel` array (the always-loaded rule set the router ships).',
                    };
                }
            }
        } catch {
            // fall through to the frontmatter scan below
        }
    }
    const rulesDir = path.join(root, 'src', 'rules');
    let bytes = 0;
    const ids: string[] = [];
    let files: string[] = [];
    try {
        files = fs
            .readdirSync(rulesDir, { withFileTypes: true })
            .filter((e) => e.isFile() && e.name.endsWith('.md'))
            .map((e) => e.name);
    } catch {
        files = [];
    }
    for (const name of files.sort()) {
        const p = path.join(rulesDir, name);
        const text = fs.readFileSync(p, 'utf-8');
        const fmEnd = text.indexOf('\n---', 4);
        const frontmatter = text.startsWith('---') && fmEnd > -1 ? text.slice(0, fmEnd) : '';
        if (ALWAYS_TYPE_RE.test(frontmatter)) {
            bytes += Buffer.byteLength(text, 'utf-8');
            ids.push(name.replace(/\.md$/, ''));
        }
    }
    return {
        count: ids.length,
        bytes,
        ids,
        method:
            '`dist/router.json` / `dist/agent-src/rules/` unavailable — byte sum of `src/rules/*.md` ' +
            'files whose frontmatter has `type: "always"` instead.',
    };
}

// ---------------------------------------------------------------------------
// Metric 5 — mandatory gates per core workflow (proxy)
// ---------------------------------------------------------------------------

export interface GateMentionsResult {
    total: number;
    files: number;
    perFile: number;
    method: string;
}

const GATE_RE = /\bgate\b/gi;

/**
 * Total case-insensitive whole-word `gate` mentions across the work-engine
 * dispatcher directives, averaged per directive file. A static text-mention
 * count, NOT a semantic count of enforced preconditions — documented as
 * such in the rendered report.
 */
export function countGateMentions(directivesDir: string): GateMentionsResult {
    const method =
        `Case-insensitive whole-word \`gate\` mention count across every .ts file under ` +
        `\`${path.relative(REPO_ROOT, directivesDir) || directivesDir}\`, divided by the file count. ` +
        'A static text-mention proxy (docstrings + code both count), not a semantic gate-graph analysis.';
    const files = _walkFiles(directivesDir, '.ts');
    let total = 0;
    for (const f of files) {
        const text = fs.readFileSync(f, 'utf-8');
        GATE_RE.lastIndex = 0;
        const matches = text.match(GATE_RE);
        total += matches ? matches.length : 0;
    }
    const perFile = files.length > 0 ? Math.round((total / files.length) * 100) / 100 : 0;
    return { total, files: files.length, perFile, method };
}

// ---------------------------------------------------------------------------
// Metric 6 — rule→skill coupling
// ---------------------------------------------------------------------------

export interface RuleSkillCouplingResult {
    targets: number;
    backlinks: number;
    method: string;
}

/**
 * Distinct routing targets + total rule→target backlinks, computed by
 * reusing `rule_backlinks.ts`'s `collect()` (frontmatter `routes_to:` +
 * "Body migrated to" prose over `src/rules/*.md`) — no new scanning logic
 * lives here. A target is a skill / guideline / context / contract a rule
 * routes into; the backlink total is how many rule→target routes exist.
 */
export function countRuleSkillCoupling(rulesDir: string): RuleSkillCouplingResult {
    const byTarget = collectRuleBacklinks(rulesDir);
    let backlinks = 0;
    for (const links of byTarget.values()) backlinks += links.length;
    return {
        targets: byTarget.size,
        backlinks,
        method:
            "Reused `rule_backlinks.ts`'s `collect()` over `src/rules/*.md` — distinct routing " +
            'targets (frontmatter `routes_to:` + "Body migrated to" prose) and total ' +
            'rule→target backlinks. No new scanning logic.',
    };
}

// ---------------------------------------------------------------------------
// Soft-ratchet baseline
// ---------------------------------------------------------------------------

export interface BaselineMetrics {
    settings_axes_total: number;
    runtime_state_surfaces: number;
    dependency_edges: number;
    always_rule_bytes: number;
    gate_mentions_total: number;
    rule_skill_coupling_backlinks: number;
}

export interface Baseline {
    schema_version: 1;
    baselined_at: string;
    reason: string;
    metrics: BaselineMetrics;
}

export const BASELINE_RELPATH = path.join('internal', 'reports', 'complexity-baseline.json');

/**
 * Read the checked-in soft-ratchet baseline. Returns null when the file is
 * absent or unparseable — the report then skips the ratchet section instead
 * of failing (report-only, exit 0 always).
 */
export function loadBaseline(baselinePath: string): Baseline | null {
    if (!_isFile(baselinePath)) return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(baselinePath, 'utf-8')) as Baseline;
        if (parsed === null || typeof parsed !== 'object' || typeof parsed.metrics !== 'object' || parsed.metrics === null) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Snapshot assembly + rendering
// ---------------------------------------------------------------------------

export interface Snapshot {
    schema_version: 1;
    generated_at: string;
    settings_axes: SettingsAxesResult;
    runtime_state: RuntimeStateResult;
    dependency_edges: DependencyEdgesResult;
    always_rule_bytes: AlwaysRuleBytesResult;
    gate_mentions: GateMentionsResult;
    rule_skill_coupling: RuleSkillCouplingResult;
}

export interface Roots {
    root: string;
    settingsTemplate: string;
    srcDir: string;
    directivesDir: string;
    rulesDir: string;
}

export function defaultRoots(root: string): Roots {
    return {
        root,
        settingsTemplate: path.join(root, 'src', 'config', 'agent-settings.template.yml'),
        srcDir: path.join(root, 'src'),
        directivesDir: path.join(root, 'src', 'agent-src', 'templates', 'scripts', 'work_engine', 'directives'),
        rulesDir: path.join(root, 'src', 'rules'),
    };
}

export function collectSnapshot(roots: Roots, now: Date): Snapshot {
    return {
        schema_version: 1,
        generated_at: now.toISOString().slice(0, 10),
        settings_axes: countSettingsAxes(roots.settingsTemplate),
        runtime_state: countRuntimeStateSurfaces(roots.srcDir),
        dependency_edges: countDependencyEdges(roots.root),
        always_rule_bytes: countAlwaysRuleBytes(roots.root),
        gate_mentions: countGateMentions(roots.directivesDir),
        rule_skill_coupling: countRuleSkillCoupling(roots.rulesDir),
    };
}

const RAW_BLOCK_RE = /<!-- complexity-report-raw\n([\s\S]*?)\n-->/;

/** Extract the embedded machine-parseable snapshot from a previously rendered report. */
export function parsePreviousSnapshot(text: string): Snapshot | null {
    const m = RAW_BLOCK_RE.exec(text);
    if (!m) return null;
    try {
        return JSON.parse(m[1] as string) as Snapshot;
    } catch {
        return null;
    }
}

function _fmt(n: number): string {
    return n.toLocaleString('en-US');
}

function _deltaCell(curr: number, prev: number | undefined): string {
    if (prev === undefined) return '—';
    const d = curr - prev;
    if (d === 0) return '0';
    return d > 0 ? `+${_fmt(d)}` : _fmt(d);
}

const RATCHET_INSTRUCTION =
    'justify in the PR that raises it, or re-baseline deliberately ' +
    '(update complexity-baseline.json in the same PR with a one-line reason field).';

/**
 * The soft-ratchet section: per metric, checked-in baseline vs current vs Δ.
 * Metrics above baseline get a WARN line (justify-or-rebaseline instruction);
 * metrics below baseline render as improvements. Never fails anything —
 * the caller still always exits 0.
 */
function _renderRatchetSection(current: Snapshot, baseline: Baseline | null): string[] {
    const lines: string[] = [];
    lines.push('## Ratchet vs baseline');
    lines.push('');
    if (baseline === null) {
        lines.push(`No baseline file found at \`${BASELINE_RELPATH}\` — ratchet comparison skipped.`);
        return lines;
    }
    lines.push(`Baseline: \`${BASELINE_RELPATH}\` (baselined ${baseline.baselined_at} — "${baseline.reason}").`);
    lines.push('');
    const rows: Array<{ label: string; base: number; curr: number }> = [
        { label: 'Active settings axes', base: baseline.metrics.settings_axes_total, curr: current.settings_axes.total },
        { label: 'Runtime-state surfaces', base: baseline.metrics.runtime_state_surfaces, curr: current.runtime_state.count },
        { label: 'Cross-subsystem dependency edges', base: baseline.metrics.dependency_edges, curr: current.dependency_edges.count },
        { label: 'Always-loaded rule bytes', base: baseline.metrics.always_rule_bytes, curr: current.always_rule_bytes.bytes },
        { label: 'Gate mentions (total)', base: baseline.metrics.gate_mentions_total, curr: current.gate_mentions.total },
        {
            label: 'Rule→skill coupling (backlinks)',
            base: baseline.metrics.rule_skill_coupling_backlinks,
            curr: current.rule_skill_coupling.backlinks,
        },
    ];
    lines.push('| Metric | Baseline | Current | Δ |');
    lines.push('|---|---|---|---|');
    for (const r of rows) {
        lines.push(`| ${r.label} | ${_fmt(r.base)} | ${_fmt(r.curr)} | ${_deltaCell(r.curr, r.base)} |`);
    }
    lines.push('');
    const above = rows.filter((r) => r.curr > r.base);
    const below = rows.filter((r) => r.curr < r.base);
    for (const r of above) {
        lines.push(`WARN: ${r.label} is above baseline (${_fmt(r.base)} → ${_fmt(r.curr)}, +${_fmt(r.curr - r.base)}) — ${RATCHET_INSTRUCTION}`);
    }
    for (const r of below) {
        lines.push(`Improved: ${r.label} is below baseline (${_fmt(r.base)} → ${_fmt(r.curr)}, ${_fmt(r.curr - r.base)}).`);
    }
    if (above.length === 0 && below.length === 0) {
        lines.push('All metrics at baseline.');
    }
    return lines;
}

export function renderReport(current: Snapshot, previous: Snapshot | null, baseline: Baseline | null = null): string {
    const lines: string[] = [];
    lines.push('# Complexity Report');
    lines.push('');
    lines.push(`Generated: ${current.generated_at} · generator: \`src/scripts/complexity_report.ts\` (report-only, always exits 0).`);
    lines.push('');
    lines.push(`> ${KILL_CRITERION}`);
    lines.push('');
    lines.push(
        'This is a soft ratchet, not a gate: no feature carries a per-change ' +
            'declaration duty against these numbers, and the script never fails CI. ' +
            'It exists to make complexity growth *visible* over time.',
    );
    lines.push('');
    lines.push(
        '**Wired into CI as `task complexity-report`** (report-only, exit 0 always — ' +
            'it never fails the build). Regenerate manually with ' +
            '`npx tsx src/scripts/complexity_report.ts` or `task complexity-report`.',
    );
    lines.push('');
    lines.push('## Metrics');
    lines.push('');
    lines.push('| # | Metric | Value | Method |');
    lines.push('|---|---|---|---|');
    lines.push(
        `| 1 | Active settings axes | ${_fmt(current.settings_axes.total)} ` +
            `(${current.settings_axes.top} top + ${current.settings_axes.second} second-level) | ${current.settings_axes.method} |`,
    );
    lines.push(`| 2 | Runtime-state surfaces (PROXY) | ${_fmt(current.runtime_state.count)} | ${current.runtime_state.method} |`);
    const edgesProxy = current.dependency_edges.source === 'import-proxy' ? ' (PROXY)' : '';
    lines.push(
        `| 3 | Cross-subsystem dependency edges${edgesProxy} | ${_fmt(current.dependency_edges.count)} (source: ${current.dependency_edges.source}) | ` +
            `${current.dependency_edges.method} |`,
    );
    lines.push(
        `| 4 | Always-loaded rule bytes | ${_fmt(current.always_rule_bytes.bytes)} bytes across ${current.always_rule_bytes.count} rule(s) | ` +
            `${current.always_rule_bytes.method} |`,
    );
    lines.push(
        `| 5 | Mandatory gates per core workflow (PROXY) | ${current.gate_mentions.perFile.toFixed(2)} avg/file ` +
            `(${current.gate_mentions.total} mentions across ${current.gate_mentions.files} files) | ${current.gate_mentions.method} |`,
    );
    lines.push(
        `| 6 | Rule→skill coupling | ${_fmt(current.rule_skill_coupling.targets)} targets, ` +
            `${_fmt(current.rule_skill_coupling.backlinks)} backlinks | ${current.rule_skill_coupling.method} |`,
    );
    lines.push('');
    lines.push(`**Runtime-state surfaces found:** ${current.runtime_state.names.map((n) => `\`${n}\``).join(', ') || '—'}`);
    lines.push('');
    lines.push(`**Always-loaded rule ids:** ${current.always_rule_bytes.ids.map((n) => `\`${n}\``).join(', ') || '—'}`);
    lines.push('');

    lines.push('## Delta vs previous report');
    lines.push('');
    if (previous === null) {
        lines.push('No previous report found — this is the baseline run.');
    } else {
        lines.push(`Previous report generated: ${previous.generated_at}.`);
        lines.push('');
        lines.push('| Metric | Previous | Current | Δ |');
        lines.push('|---|---|---|---|');
        lines.push(
            `| Active settings axes | ${_fmt(previous.settings_axes.total)} | ${_fmt(current.settings_axes.total)} | ` +
                `${_deltaCell(current.settings_axes.total, previous.settings_axes.total)} |`,
        );
        lines.push(
            `| Runtime-state surfaces | ${_fmt(previous.runtime_state.count)} | ${_fmt(current.runtime_state.count)} | ` +
                `${_deltaCell(current.runtime_state.count, previous.runtime_state.count)} |`,
        );
        lines.push(
            `| Cross-subsystem dependency edges | ${_fmt(previous.dependency_edges.count)} | ${_fmt(current.dependency_edges.count)} | ` +
                `${_deltaCell(current.dependency_edges.count, previous.dependency_edges.count)} |`,
        );
        lines.push(
            `| Always-loaded rule bytes | ${_fmt(previous.always_rule_bytes.bytes)} | ${_fmt(current.always_rule_bytes.bytes)} | ` +
                `${_deltaCell(current.always_rule_bytes.bytes, previous.always_rule_bytes.bytes)} |`,
        );
        lines.push(
            `| Gate mentions (total) | ${_fmt(previous.gate_mentions.total)} | ${_fmt(current.gate_mentions.total)} | ` +
                `${_deltaCell(current.gate_mentions.total, previous.gate_mentions.total)} |`,
        );
        // Reports rendered before metric 6 existed have no rule_skill_coupling
        // in their embedded snapshot — degrade to an em-dash previous cell.
        const prevCoupling = previous.rule_skill_coupling as RuleSkillCouplingResult | undefined;
        lines.push(
            `| Rule→skill coupling (backlinks) | ${prevCoupling ? _fmt(prevCoupling.backlinks) : '—'} | ` +
                `${_fmt(current.rule_skill_coupling.backlinks)} | ` +
                `${_deltaCell(current.rule_skill_coupling.backlinks, prevCoupling?.backlinks)} |`,
        );
    }
    lines.push('');
    lines.push(..._renderRatchetSection(current, baseline));
    lines.push('');
    lines.push('## Raw metrics (machine-parseable — do not hand-edit)');
    lines.push('');
    lines.push('The delta section above is computed by parsing this block out of the previous report.');
    lines.push('');
    lines.push('<!-- complexity-report-raw');
    lines.push(JSON.stringify(current, null, 2));
    lines.push('-->');
    lines.push('');
    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface ParsedArgs {
    root: string;
    out: string;
    quiet: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { root: REPO_ROOT, out: DEFAULT_OUT, quiet: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--root') {
            out.root = path.resolve(argv[++i] ?? out.root);
        } else if (a.startsWith('--root=')) {
            out.root = path.resolve(a.slice('--root='.length));
        } else if (a === '--out') {
            out.out = path.resolve(argv[++i] ?? out.out);
        } else if (a.startsWith('--out=')) {
            out.out = path.resolve(a.slice('--out='.length));
        } else if (a === '--quiet') {
            out.quiet = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${PROG} [--root PATH] [--out PATH] [--quiet]\n`);
            process.exit(0);
        }
        // Unrecognized args are ignored, not fatal — this is a report-only
        // soft ratchet; exit code is always 0 (see module docstring).
    }
    if (out.out === DEFAULT_OUT && out.root !== REPO_ROOT) {
        out.out = path.join(out.root, 'internal', 'reports', 'complexity-report.md');
    }
    return out;
}

/** Always returns 0 — report-only soft ratchet, per the roadmap spec. */
export function main(argv?: string[]): number {
    try {
        const args = parseArgs(argv ?? process.argv.slice(2));
        const roots = defaultRoots(args.root);
        const snapshot = collectSnapshot(roots, new Date());
        const previousText = _exists(args.out) ? fs.readFileSync(args.out, 'utf-8') : null;
        const previous = previousText ? parsePreviousSnapshot(previousText) : null;
        const baseline = loadBaseline(path.join(args.root, BASELINE_RELPATH));
        const report = renderReport(snapshot, previous, baseline);
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, report, 'utf-8');
        if (!args.quiet) {
            process.stdout.write(`${PROG}: wrote ${path.relative(args.root, args.out)}\n`);
        }
    } catch (exc) {
        // Report-only: never fail the caller. Surface the error for
        // diagnosis, still exit 0.
        process.stderr.write(`${PROG}: error (non-fatal, report may be incomplete): ${String(exc)}\n`);
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1] as string));
        return here === argv;
    } catch {
        return false;
    }
}
if (_isCliEntry()) {
    process.exitCode = main();
}
