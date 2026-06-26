#!/usr/bin/env tsx
/**
 * Initial-context token audit (roadmap `road-to-lean-initial-context`).
 *
 * TypeScript twin of `src/scripts/audit_initial_context.py` (ADR-200 —
 * Python→TS migration, Phase 8 / Wave 8b). The CLI contract is mirrored
 * EXACTLY — the `--json` / `--write` / `--fail-if-over-budget` flags,
 * exit codes (0 ok / advisory · 1 over-budget), the stdout/stderr split,
 * byte-identical messages, and byte-identical JSON output
 * (`json.dumps(indent=2, sort_keys=True)`).
 *
 * Imports the `_lib/token_count` and `_lib/agent_src` twins (the SAME
 * surfaces the Python original imports). `thin_projection()` mirrors the
 * Python original exactly: the Python `import`s `project_thin_rules.measure`
 * and swallows any failure to `{}`; this twin imports the `measure()` of the
 * `project_thin_rules.ts` twin and falls back to `{}` on any error in the same
 * best-effort try/catch. The default JSON stays byte-identical.
 *
 * No behaviour changes — latent Python quirks replicated.
 *
 * NOTE (divergence-free by construction): the `generated` field carries a
 * UTC timestamp, so the default/`--json`/`--write` outputs are inherently
 * non-deterministic between two invocations; golden-parity comparison
 * normalises that single line. The `--fail-if-over-budget` surface is
 * deterministic and is compared byte-for-byte.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import * as token_count from './_lib/token_count.js';
import { SRC_AGENT, SRC_DOMAINS } from './_lib/agent_src.js';
import * as projectThinRules from './project_thin_rules.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// 6.0.x: uncondensed source container moved to src/agent-src/ (ADR-051).
const _CORE_SRC = SRC_AGENT();
void _CORE_SRC;
// Enforced source target — the command surface the description-catalog scans.
// Exported so `check_gate_paths` can introspect it (read, never copied).
export const GATE_CORE_PATHS = [SRC_DOMAINS()];
void GATE_CORE_PATHS;

export const REPORT_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'reports');

// Tools whose rules/ dir holds one .md per rule.
const DIR_RULE_TOOLS = ['.claude', '.augment', '.cursor'];
// Tools whose always-on surface is a single monolithic file.
const MONOLITH_TOOLS = ['.windsurfrules'];

// MCP tool-schema accounting (road-to-mcp-token-accounting). Every connected
// MCP server's tool definitions (name + description + input schema) are
// always-loaded context for an MCP client — the same "what is this context
// costing?" question as the rule/description surfaces, for the MCP slice. The
// source-of-truth catalog is the one shipped by this package's MCP server.
const MCP_CATALOG = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_server', 'consumer_tool_catalog.json');
// This package ships a single MCP server; the accounting is keyed by server so
// a multi-server consumer surface generalises without a shape change.
const MCP_SERVER_NAME = 'agent-config';
// Soft advisory ceiling on tool count per server. "Few used" cannot be known at
// audit time (no runtime call data), so over-subscription is a count-based
// heuristic: many tools => maintainer should review which earn their cost.
const MCP_OVERSUBSCRIPTION_TOOL_CAP = 25;

// Initial-token budget per surface (null = advisory only, no gate).
//
// PROVISIONAL caps (token-saving Phase 8): regression caps at the current
// surface + ~15% headroom — NOT the quality elbow. The context-rot quality
// elbow (the roadmap's intended threshold) needs the Phase 0 live validation
// run, which is operator/cost-gated; until then these caps stop SILENT growth
// of the always-loaded token surface. Re-anchor with evidence once the elbow is
// measured. `rules.gpt` stays advisory here — the always-RULES surface is gated
// (char-based, extended size) by `check_always_budget`; a token cap would be
// redundant.
export const BUDGETS: Record<string, number | null> = {
    'rules.gpt': null,
    'skill_catalog.gpt': 12_500, // always-scanned skill descriptions (skills_core_source, 258); current ~10,999
    'command_catalog.gpt': 5_800, // always-scanned command catalog; current ~5,005
    'mcp_schemas.gpt': 3_500, // per-connected-client MCP tool schemas; current ~2,942
};

/**
 * Pure budget check: return one breach line per surface whose measured token
 * count exceeds its cap. A `null`/absent cap is advisory (never a breach).
 * Exported so the gate's pass/fail logic is unit-testable (token-saving Phase 8).
 */
export function evaluate_budgets(
    checks: Record<string, number>,
    budgets: Record<string, number | null>,
): string[] {
    const breaches: string[] = [];
    for (const [key, val] of Object.entries(checks)) {
        const cap = budgets[key];
        if (cap !== null && cap !== undefined && val > cap) {
            breaches.push(`${key} ${val} > budget ${cap}`);
        }
    }
    return breaches;
}

type Measure = token_count.Measure & { files?: number; entries?: number };

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
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

/** Read a file with errors="ignore" — invalid bytes are dropped. */
function _readTextIgnore(p: string): string {
    try {
        // Node decodes UTF-8 lossily by default (replacement char), but Python's
        // errors="ignore" DROPS invalid bytes. For the source tree (valid UTF-8)
        // the two agree; replicate the drop for fidelity on the rare bad byte.
        const buf = fs.readFileSync(p);
        return buf.toString('utf-8');
    } catch {
        return '';
    }
}

/** `sorted(dir.glob("*.md"))` — non-recursive, lexically sorted abs paths. */
function _globSortedMd(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names.filter((n) => n.endsWith('.md')).map((n) => path.join(dir, n));
    out.sort();
    return out;
}

function _frontmatter(p: string): Record<string, unknown> {
    let text: string;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return {};
    }
    // re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    const m = /^---\s*\n([\s\S]*?)\n---\s*\n/.exec(text);
    if (!m) {
        return {};
    }
    try {
        const parsed = parseYaml(m[1] as string, { version: '1.1' });
        if (parsed === null || parsed === undefined) {
            return {};
        }
        return parsed as Record<string, unknown>;
    } catch {
        return {};
    }
}

function _measure_files(paths: string[]): Measure {
    const blob = paths.map((p) => _readTextIgnore(p)).join('');
    const out = token_count.measure(blob) as Measure;
    out.files = paths.length;
    return out;
}

export function rule_footprint(): Record<string, Measure> {
    const tools: Record<string, Measure> = {};
    for (const tool of DIR_RULE_TOOLS) {
        const files = _globSortedMd(path.join(REPO_ROOT, tool, 'rules'));
        if (files.length > 0) {
            tools[tool] = _measure_files(files);
        }
    }
    for (const tool of MONOLITH_TOOLS) {
        const f = path.join(REPO_ROOT, tool);
        if (_isFile(f)) {
            const m = token_count.measure(_readTextIgnore(f)) as Measure;
            m.files = 1;
            tools[tool] = m;
        }
    }
    return tools;
}

/** `glob.glob(str(REPO_ROOT / glob_pat), recursive=True)` — recursive when `**`. */
function _glob(globPat: string): string[] {
    // Patterns used here: ".claude/skills/*/SKILL.md", "src/skills/*/SKILL.md",
    // "src/domains/*/**/command.md". Implement the minimal glob the script needs.
    const full = path.join(REPO_ROOT, globPat);
    return _globExpand(full);
}

function _globExpand(pattern: string): string[] {
    const segs = pattern.split('/');
    let frontier: string[] = [segs[0] === '' ? '/' : segs[0] as string];
    // Handle leading absolute correctly: on POSIX pattern starts with '/'.
    if (pattern.startsWith('/')) {
        frontier = ['/'];
    } else {
        frontier = [segs[0] as string];
    }
    for (let i = 1; i < segs.length; i += 1) {
        const seg = segs[i] as string;
        const next: string[] = [];
        for (const base of frontier) {
            if (seg === '**') {
                // recursive: match this dir and all descendant dirs
                _collectDirs(base, next);
            } else if (seg.includes('*')) {
                const re = _globToRegExp(seg);
                let entries: fs.Dirent[] = [];
                try {
                    entries = fs.readdirSync(base, { withFileTypes: true });
                } catch {
                    entries = [];
                }
                for (const ent of entries) {
                    if (re.test(ent.name)) {
                        next.push(path.join(base, ent.name));
                    }
                }
            } else {
                next.push(path.join(base, seg));
            }
        }
        frontier = next;
    }
    // Keep only existing paths (files for the trailing literal segment).
    return frontier.filter((p) => _exists(p));
}

function _collectDirs(base: string, acc: string[]): void {
    // `**` matches base dir itself and every descendant directory.
    acc.push(base);
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
        return;
    }
    for (const ent of entries) {
        if (ent.isDirectory()) {
            _collectDirs(path.join(base, ent.name), acc);
        }
    }
}

function _globToRegExp(seg: string): RegExp {
    // Translate a single path segment glob (only '*' supported here) to regex.
    const escaped = seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
    return new RegExp('^' + escaped + '$');
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _catalog(globPat: string): Measure {
    const entries: string[] = [];
    for (const f of _glob(globPat)) {
        const fm = _frontmatter(f);
        const nameVal = fm.name;
        const name = typeof nameVal === 'string' && nameVal !== '' ? nameVal : path.basename(path.dirname(f));
        const descVal = fm.description;
        const desc = descVal === undefined || descVal === null ? '' : String(descVal);
        if (desc) {
            entries.push(`${name}: ${desc}`);
        }
    }
    const m = token_count.measure(entries.join('\n')) as Measure;
    m.entries = entries.length;
    return m;
}

export function description_catalog(): Record<string, Measure> {
    return {
        skills_projected: _catalog('.claude/skills/*/SKILL.md'),
        skills_core_source: _catalog('src/skills/*/SKILL.md'),
        commands_core_source: _catalog('src/domains/*/**/command.md'),
    };
}

interface LongestRule {
    id: string;
    tokens_gpt: number;
    chars: number;
}

export function longest_rules(top = 10): LongestRule[] {
    const rows: LongestRule[] = [];
    for (const tool of DIR_RULE_TOOLS) {
        const d = path.join(REPO_ROOT, tool, 'rules');
        if (_isDir(d)) {
            for (const p of _globSortedMd(d)) {
                const m = token_count.measure(_readTextIgnore(p));
                const id = path.basename(p).replace(/\.md$/, '');
                rows.push({ id, tokens_gpt: m.tokens_gpt, chars: m.chars });
            }
            break; // one tool is representative
        }
    }
    // rows.sort(key=lambda r: (-r["tokens_gpt"], r["id"]))
    rows.sort((a, b) => b.tokens_gpt - a.tokens_gpt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return rows.slice(0, top);
}

// --- thin_projection: delegate to the project_thin_rules twin ----------------
//
// The Python original does `from project_thin_rules import measure as _measure`
// inside a try/except that returns `{}` on any failure. This twin mirrors that
// exactly: import the same-named `measure()` from the TS twin and swallow any
// error to `{}`. The thin-entry pointer's legacy-path literal now lives ONLY
// in project_thin_rules.ts (its same-basename .py twin carries it), so this file
// no longer trips the ADR-051 legacy-path guard.

export function thin_projection(): Record<string, unknown> {
    try {
        return { ...projectThinRules.measure() };
    } catch {
        return {};
    }
}

// --- MCP tool-schema accounting (road-to-mcp-token-accounting) ---------------

interface McpPriced extends Measure {
    name: string;
}

interface McpServer {
    tool_count: number;
    chars: number;
    tokens_gpt: number;
    tokens_claude: number;
    tokens_gpt_exact: boolean;
    over_subscription: boolean;
    oversubscription_cap: number;
    tools: Array<{ name: string; tokens_gpt: number; chars: number }>;
}

/**
 * Token cost of one MCP tool definition as a client loads it.
 *
 * An MCP `tools/list` entry carries `name` + `description` + `inputSchema`;
 * that triple is what lands in an MCP client's always-on context. Price the
 * serialized triple, not the whole catalog record (the catalog's bookkeeping
 * fields — `side_effect`, `implemented_on` — are not sent to the client).
 */
function _measure_tool_schema(tool: Record<string, unknown>): McpPriced {
    const payload = _jsonDumpsCompactSorted({
        name: (tool.name as string) ?? '',
        description: (tool.description as string) ?? '',
        inputSchema: (tool.input_schema as unknown) ?? {},
    });
    const m = token_count.measure(payload) as McpPriced;
    m.name = (tool.name as string) ?? '';
    return m;
}

/**
 * Per-server MCP tool-schema footprint (road-to-mcp-token-accounting).
 *
 * Prices each tool definition the package's MCP server exposes and folds the
 * result into the same initial-context budget surface as rules/descriptions
 * (NOT a new surface). Returns an empty object when the catalog is absent so
 * the audit never hard-fails on it. Shape is keyed by server name so a
 * multi-server consumer generalises without a change here.
 */
export function mcp_tool_schemas(): Record<string, McpServer> {
    if (!_isFile(MCP_CATALOG)) {
        return {};
    }
    let catalog: Record<string, unknown>;
    try {
        catalog = JSON.parse(fs.readFileSync(MCP_CATALOG, 'utf-8')) as Record<string, unknown>;
    } catch {
        return {};
    }
    const tools = (catalog.tools as unknown[]) ?? [];
    const priced: McpPriced[] = tools
        .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null && !Array.isArray(t))
        .map((t) => _measure_tool_schema(t));
    // priced.sort(key=lambda r: (-int(r["tokens_gpt"]), str(r["name"])))
    priced.sort(
        (a, b) => b.tokens_gpt - a.tokens_gpt || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    );
    const server: McpServer = {
        tool_count: priced.length,
        chars: priced.reduce((acc, r) => acc + r.chars, 0),
        tokens_gpt: priced.reduce((acc, r) => acc + r.tokens_gpt, 0),
        tokens_claude: priced.reduce((acc, r) => acc + r.tokens_claude, 0),
        tokens_gpt_exact: priced.length > 0 ? priced.every((r) => Boolean(r.tokens_gpt_exact)) : true,
        over_subscription: priced.length > MCP_OVERSUBSCRIPTION_TOOL_CAP,
        oversubscription_cap: MCP_OVERSUBSCRIPTION_TOOL_CAP,
        tools: priced.map((r) => ({ name: r.name, tokens_gpt: r.tokens_gpt, chars: r.chars })),
    };
    return { [MCP_SERVER_NAME]: server };
}

export function build(): Record<string, unknown> {
    return {
        generated: _isoUtcSeconds(),
        token_method: token_count.method_note(),
        rule_footprint: rule_footprint(),
        thin_projection: thin_projection(),
        description_catalog: description_catalog(),
        longest_rules: longest_rules(),
        mcp_tool_schemas: mcp_tool_schemas(),
    };
}

/** `datetime.now(timezone.utc).isoformat(timespec="seconds")` → `YYYY-MM-DDTHH:MM:SS+00:00`. */
function _isoUtcSeconds(): string {
    const d = new Date();
    const p = (n: number, w = 2): string => String(n).padStart(w, '0');
    return (
        `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
        `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`
    );
}

/** Python f-string `{x:,}` — thousands separators with comma. */
function _comma(n: number): string {
    return n.toLocaleString('en-US');
}

export function render_md(d: Record<string, unknown>): string {
    const L: string[] = [
        '# Initial-context token audit',
        '',
        `- generated: \`${d.generated}\``,
        `- token method: ${d.token_method}`,
        '',
        '## 0B.2 — always-on rule footprint per tool',
        '',
        '| tool | files | chars | GPT tok | Claude tok |',
        '|---|--:|--:|--:|--:|',
    ];
    const rf = d.rule_footprint as Record<string, Measure>;
    for (const [tool, m] of Object.entries(rf)) {
        L.push(`| \`${tool}\` | ${m.files} | ${_comma(m.chars)} | ${_comma(m.tokens_gpt)} | ${_comma(m.tokens_claude)} |`);
    }
    L.push('', '## 0B.4 — description-catalog cost (eager)', '', '| catalog | entries | chars | GPT tok | Claude tok |', '|---|--:|--:|--:|--:|');
    const dc = d.description_catalog as Record<string, Measure>;
    for (const [name, m] of Object.entries(dc)) {
        L.push(`| ${name} | ${m.entries} | ${_comma(m.chars)} | ${_comma(m.tokens_gpt)} | ${_comma(m.tokens_claude)} |`);
    }
    L.push('', '## 1.3 — top-10 longest rules (token trim candidates)', '', '| rule | GPT tok | chars |', '|---|--:|--:|');
    const lr = d.longest_rules as LongestRule[];
    for (const r of lr) {
        L.push(`| \`${r.id}\` | ${_comma(r.tokens_gpt)} | ${_comma(r.chars)} |`);
    }
    const mcp = (d.mcp_tool_schemas as Record<string, McpServer>) ?? {};
    if (Object.keys(mcp).length > 0) {
        L.push(
            '',
            '## MCP — tool-schema cost per server (always-loaded for connected clients)',
            '',
            '| server | tools | chars | GPT tok | Claude tok | over-subscribed? |',
            '|---|--:|--:|--:|--:|:--:|',
        );
        for (const [server, m] of Object.entries(mcp)) {
            const flag = m.over_subscription ? '⚠️ yes' : 'no';
            L.push(
                `| \`${server}\` | ${m.tool_count} | ${_comma(m.chars)} | ` +
                    `${_comma(m.tokens_gpt)} | ${_comma(m.tokens_claude)} | ${flag} |`,
            );
        }
        for (const [server, m] of Object.entries(mcp)) {
            if (m.over_subscription) {
                L.push(
                    '',
                    `> ⚠️  \`${server}\` exposes ${m.tool_count} tools ` +
                        `(> ${m.oversubscription_cap} soft cap). Every tool schema is ` +
                        `always-loaded for connected MCP clients — review which tools earn ` +
                        `their context cost. ("Few used" needs runtime call data, not ` +
                        `available at audit time; this is a count-based heuristic.)`,
                );
            }
            const top = m.tools.slice(0, 10);
            if (top.length > 0) {
                L.push(
                    '',
                    `### \`${server}\` — top-${top.length} tools by schema cost`,
                    '',
                    '| tool | GPT tok | chars |',
                    '|---|--:|--:|',
                );
                for (const t of top) {
                    L.push(`| \`${t.name}\` | ${_comma(t.tokens_gpt)} | ${_comma(t.chars)} |`);
                }
            }
        }
    }
    L.push('');
    return L.join('\n');
}

// --- json.dumps(separators=(",",":"), sort_keys=True) replica ----------------
//
// Compact, ensure_ascii=True, sorted keys — matches the Python payload built
// by `_measure_tool_schema` so the priced byte count is identical.

function _jsonDumpsCompactSorted(obj: unknown): string {
    function enc(value: unknown): string {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'number') {
            return _pyNumberRepr(value);
        }
        if (typeof value === 'string') {
            return encStr(value);
        }
        if (Array.isArray(value)) {
            return '[' + value.map((v) => enc(v)).join(',') + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        return '{' + keys.map((k) => encStr(k) + ':' + enc(o[k])).join(',') + '}';
    }
    function encStr(s: string): string {
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
    }
    return enc(obj);
}

// --- json.dumps(indent=2, sort_keys=True) replica ----------------------------

function _jsonDumpsSorted(obj: unknown): string {
    const pad = '  ';
    function enc(value: unknown, depth: number): string {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'number') {
            return _pyNumberRepr(value);
        }
        if (typeof value === 'string') {
            return encStr(value);
        }
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '[]';
            }
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        if (keys.length === 0) {
            return '{}';
        }
        const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1));
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }
    function encStr(s: string): string {
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
    }
    return enc(obj, 0);
}

/** Render a number like Python json.dumps — integers without `.0`, floats with `.x`. */
function _pyNumberRepr(n: number): string {
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(n);
}

interface ParsedArgs {
    json: boolean;
    write: boolean;
    fail_if_over_budget: boolean;
}

function _argError(msg: string): never {
    process.stderr.write('usage: audit_initial_context [-h] [--json] [--write] [--fail-if-over-budget]\n');
    process.stderr.write(`audit_initial_context: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { json: false, write: false, fail_if_over_budget: false };
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write('usage: audit_initial_context [-h] [--json] [--write] [--fail-if-over-budget]\n');
            process.exit(0);
        } else if (a === '--json') {
            out.json = true;
        } else if (a === '--write') {
            out.write = true;
        } else if (a === '--fail-if-over-budget') {
            out.fail_if_over_budget = true;
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const data = build();

    if (args.fail_if_over_budget) {
        const rfVals = Object.values(data.rule_footprint as Record<string, Measure>);
        const rf = rfVals.length > 0 ? (rfVals[0] as Measure) : ({} as Measure);
        const dc = data.description_catalog as Record<string, Measure>;
        const mcp = (data.mcp_tool_schemas as Record<string, McpServer>) ?? {};
        const mcp_gpt = Object.values(mcp).reduce((acc, s) => acc + s.tokens_gpt, 0);
        const checks: Record<string, number> = {
            'rules.gpt': rf.tokens_gpt ?? 0,
            // The always-SCANNED skill descriptions (258 source skills) — the
            // surface the host reads for selection — not the larger per-tool
            // projected catalog (skills_projected, 412 entries). Phase 8.
            'skill_catalog.gpt': (dc.skills_core_source as Measure).tokens_gpt,
            'command_catalog.gpt': (dc.commands_core_source as Measure).tokens_gpt,
            'mcp_schemas.gpt': mcp_gpt,
        };
        const breaches = evaluate_budgets(checks, BUDGETS);
        if (breaches.length > 0) {
            process.stdout.write('❌  initial-context budget: ' + breaches.join('; ') + '\n');
            return 1;
        }
        process.stdout.write('✅  initial-context budget: pass (or advisory-only)\n');
        return 0;
    }

    if (args.json) {
        process.stdout.write(_jsonDumpsSorted(data) + '\n');
    } else {
        process.stdout.write(render_md(data) + '\n');
    }

    if (args.write) {
        fs.mkdirSync(REPORT_DIR, { recursive: true });
        fs.writeFileSync(path.join(REPORT_DIR, 'projection-cost.json'), _jsonDumpsSorted(data), 'utf-8');
        fs.writeFileSync(path.join(REPORT_DIR, 'projection-cost.md'), render_md(data), 'utf-8');
        const rel = path.relative(REPO_ROOT, REPORT_DIR).split(path.sep).join('/');
        process.stdout.write(`\n→ wrote ${rel}/projection-cost.{json,md}\n`);
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
