#!/usr/bin/env tsx
/**
 * Audit auto-rules for the Rule-Governance pass (Phase 5.1 of
 * road-to-augment-limit-fit).
 *
 * TypeScript twin of `src/scripts/audit_auto_rules.py` (ADR-092 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the Python CLI
 * contract EXACTLY — no flags, exit codes (0 ok / 1 no source rules),
 * the stdout/stderr split, byte-identical stdout messages, and
 * byte-identical written artefacts (`json.dumps(payload, indent=2,
 * sort_keys=True)` + the Markdown renderer's exact lines/columns).
 *
 * Imports the `_lib/agent_src` twin (the SAME surface the Python
 * original imports `artefact_roots` from). No behaviour changes —
 * latent Python quirks replicated.
 *
 * Walk every artefact root's `rules/*.md`, collect per-rule
 * frontmatter (`description`, `triggers`, `routes_to`, `tier`),
 * measure body and registry-stub costs, and emit:
 *
 * - `agents/reports/auto-rules-audit.json` — deterministic, machine-readable.
 * - `agents/reports/auto-rules-audit.md`   — ranked summary for review.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { artefact_roots } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/audit_auto_rules.py → parent.parent.parent == repo root.
// This .ts twin lives at src/scripts/audit_auto_rules.ts; dirname == src/scripts,
// two dirs up == repo root.
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const REPORT_DIR = path.join(REPO_ROOT, 'agents', 'reports');
export const JSON_OUT = path.join(REPORT_DIR, 'auto-rules-audit.json');
export const MD_OUT = path.join(REPORT_DIR, 'auto-rules-audit.md');

// Stub Augment injects per auto-rule. Mirrors measure_augment_budget.STUB_TEMPLATE.
function stubTemplate(desc: string, p: string): string {
    return `If the user prompt matches the description "${desc}", read the file located in ${p}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Mirror Python len(str) — count Unicode code points, not UTF-16 units. */
function pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n++;
    }
    return n;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Pre-monorepo this was REPO_ROOT/.agent-src.uncondensed/rules. Post-move
 * (ADR-017) source rules live under packages/*\/.agent-src.uncondensed/rules.
 *
 * Mirrors `_src_rule_paths`: walk every artefact root's `rules/` dir,
 * sorted `*.md`, deduped on basename (first-win).
 */
export function _src_rule_paths(): string[] {
    const paths: string[] = [];
    const seen: Set<string> = new Set();
    for (const root of artefact_roots()) {
        const d = path.join(root, 'rules');
        if (_isDir(d)) {
            for (const p of _globSortedMd(d)) {
                const name = path.basename(p);
                if (!seen.has(name)) {
                    seen.add(name);
                    paths.push(p);
                }
            }
        }
    }
    return paths;
}

/** `sorted(d.glob("*.md"))` — non-recursive, lexically sorted abs paths. */
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

/**
 * Mirror `_split_frontmatter`: split a leading `---\n...\n---` block.
 *
 * Returns `[frontmatter_dict, body]`. `body` is the text after the closing
 * `---` with leading newlines stripped. Empty dict + full text when no
 * frontmatter. `yaml.safe_load(...) or {}` — a YAML scalar/null collapses
 * to `{}`.
 */
export function _split_frontmatter(text: string): [Record<string, Json>, string] {
    if (!text.startsWith('---\n')) {
        return [{}, text];
    }
    const end = text.indexOf('\n---', 4);
    if (end < 0) {
        return [{}, text];
    }
    let fm: Json;
    try {
        fm = parseYaml(text.slice(4, end), { version: '1.1' });
    } catch {
        fm = null;
    }
    const fmObj: Record<string, Json> =
        fm !== null && fm !== undefined && typeof fm === 'object' && !Array.isArray(fm)
            ? (fm as Record<string, Json>)
            : {};
    // body = text[end + 4 :].lstrip("\n")
    const body = text.slice(end + 4).replace(/^\n+/, '');
    return [fmObj, body];
}

interface TriggerSummary {
    path_prefixes: string[];
    keywords: string[];
    intents: string[];
}

/** Mirror `_trigger_summary`. */
export function _trigger_summary(triggers: Json): TriggerSummary {
    const paths: string[] = [];
    const keywords: string[] = [];
    const intents: string[] = [];
    const list: Json[] = Array.isArray(triggers) ? triggers : [];
    for (const entry of list) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
            continue;
        }
        const e = entry as Record<string, Json>;
        if ('path_prefix' in e) {
            paths.push(String(e['path_prefix']));
        }
        if ('keyword' in e) {
            keywords.push(String(e['keyword']));
        }
        if ('intent' in e) {
            intents.push(String(e['intent']));
        }
    }
    return { path_prefixes: paths, keywords, intents };
}

interface RuleEntry {
    name: string;
    src_path: string;
    tier: Json;
    description: string;
    description_chars: number;
    triggers: TriggerSummary;
    trigger_count: number;
    routes_to: Json[];
    body_chars: number;
    file_chars: number;
    stub_chars: number;
}

/** POSIX relative path of `child` under `root` (mirrors `relative_to().as_posix()`). */
function _relPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

export function collect(): RuleEntry[] {
    const rules: RuleEntry[] = [];
    for (const p of _src_rule_paths()) {
        const text = fs.readFileSync(p, 'utf-8');
        const [fm, body] = _split_frontmatter(text);
        if (fm['type'] !== 'auto') {
            continue;
        }
        // desc = (fm.get("description") or "").strip()
        const rawDesc = fm['description'];
        const desc = pyStrip(_pyTruthy(rawDesc) ? String(rawDesc) : '');
        const stem = path.basename(p).replace(/\.md$/, '');
        const rel_projected = `.augment/rules/${path.basename(p)}`;
        const stub = stubTemplate(desc, rel_projected);
        const triggers = _trigger_summary(_pyTruthy(fm['triggers']) ? fm['triggers'] : []);
        // routes_to = list(fm.get("routes_to") or [])
        const routesRaw = fm['routes_to'];
        const routes_to: Json[] = _pyTruthy(routesRaw) ? toList(routesRaw) : [];
        rules.push({
            name: stem,
            src_path: _relPosix(p, REPO_ROOT),
            tier: fm['tier'] === undefined ? null : fm['tier'],
            description: desc,
            description_chars: pyLen(desc),
            triggers,
            trigger_count:
                triggers.path_prefixes.length + triggers.keywords.length + triggers.intents.length,
            routes_to,
            body_chars: pyLen(body),
            file_chars: pyLen(text),
            stub_chars: pyLen(stub),
        });
    }
    return rules;
}

/** Mirror Python str.strip() — strip ASCII + Unicode whitespace. */
function pyStrip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

/** Mirror Python `bool(x)` falsiness for the values seen here (None/""/[]/{}). */
function _pyTruthy(x: Json): boolean {
    if (x === null || x === undefined || x === false) {
        return false;
    }
    if (x === '') {
        return false;
    }
    if (Array.isArray(x)) {
        return x.length > 0;
    }
    if (typeof x === 'object') {
        return Object.keys(x as Record<string, Json>).length > 0;
    }
    if (x === 0) {
        return false;
    }
    return true;
}

/** Mirror Python `list(x)` for an already-list value (used post-truthy-check). */
function toList(x: Json): Json[] {
    return Array.isArray(x) ? [...x] : [];
}

/** Mirror Python `f"{n:,}"` thousands grouping for a non-negative int. */
function _comma(n: number): string {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function render_markdown(rules: RuleEntry[]): string {
    const total_stub = rules.reduce((s, r) => s + r.stub_chars, 0);
    const total_body = rules.reduce((s, r) => s + r.body_chars, 0);
    const total_desc = rules.reduce((s, r) => s + r.description_chars, 0);
    const lines: string[] = [
        '# Auto-Rule Audit',
        '',
        'Generated by `scripts/audit_auto_rules.py` for Phase 5 of',
        '`agents/roadmaps/archive/road-to-augment-limit-fit.md`. Re-run after',
        'any rule add/merge/deprecate to refresh the baseline.',
        '',
        '## Totals',
        '',
        `- auto-rules: **${rules.length}**`,
        `- registry-stub cost (counts against 49,512 cap): **${_comma(total_stub)}** chars`,
        `- description chars (subset of stub cost): **${_comma(total_desc)}** chars`,
        `- body chars (informational, NOT in budget): **${_comma(total_body)}** chars`,
        '',
        '## Ranked by registry-stub cost',
        '',
        '| # | Rule | Tier | Desc | Stub | Body | Triggers | Routes |',
        '|---|------|------|------|------|------|----------|--------|',
    ];
    // sorted(rules, key=lambda x: -x["stub_chars"]) — Python stable sort.
    const ranked = [...rules].sort((a, b) => -a.stub_chars - -b.stub_chars);
    let i = 1;
    for (const r of ranked) {
        const triggers =
            `${r.triggers.path_prefixes.length}p / ` +
            `${r.triggers.keywords.length}k / ` +
            `${r.triggers.intents.length}i`;
        const routes = r.routes_to.map((x) => String(x)).join(', ') || '—';
        lines.push(
            `| ${i} | \`${r.name}\` | ${_pyTruthy(r.tier) ? String(r.tier) : '—'} | ` +
                `${r.description_chars} | ${r.stub_chars} | ` +
                `${r.body_chars} | ${triggers} | ${routes} |`,
        );
        i++;
    }
    lines.push('');
    lines.push('Trigger key: `Np` = path-prefix, `Nk` = keyword, `Ni` = intent.');
    lines.push('');
    return lines.join('\n');
}

// --- json.dumps(indent=2, sort_keys=True) emulation -------------------------

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

function pyJsonDumps(obj: Json, sortKeys: boolean, level = 0): string {
    if (obj === null || obj === undefined) {
        return 'null';
    }
    if (typeof obj === 'number') {
        return String(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const pad = ' '.repeat(2 * (level + 1));
        const closePad = ' '.repeat(2 * level);
        return `[\n${obj.map((v) => pad + pyJsonDumps(v, sortKeys, level + 1)).join(',\n')}\n${closePad}]`;
    }
    let keys = Object.keys(obj as Record<string, Json>);
    if (sortKeys) {
        keys = keys.sort();
    }
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map(
        (k) =>
            `${pad}${_pyJsonStr(k)}: ${pyJsonDumps((obj as Record<string, Json>)[k], sortKeys, level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

function _ruleToJson(r: RuleEntry): Record<string, Json> {
    return {
        name: r.name,
        src_path: r.src_path,
        tier: r.tier,
        description: r.description,
        description_chars: r.description_chars,
        triggers: {
            path_prefixes: r.triggers.path_prefixes,
            keywords: r.triggers.keywords,
            intents: r.triggers.intents,
        },
        trigger_count: r.trigger_count,
        routes_to: r.routes_to,
        body_chars: r.body_chars,
        file_chars: r.file_chars,
        stub_chars: r.stub_chars,
    };
}

export function main(): number {
    if (_src_rule_paths().length === 0) {
        process.stderr.write("❌  No source rules found under any artefact root's rules/\n");
        return 1;
    }
    const rules = collect();
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    const payload = { rule_count: rules.length, rules: rules.map(_ruleToJson) };
    fs.writeFileSync(JSON_OUT, pyJsonDumps(payload, true), 'utf-8');
    fs.writeFileSync(MD_OUT, render_markdown(rules), 'utf-8');
    process.stdout.write(`✅  Audited ${rules.length} auto-rules.\n`);
    process.stdout.write(`   JSON: ${_relPosix(JSON_OUT, REPO_ROOT)}\n`);
    process.stdout.write(`   MD:   ${_relPosix(MD_OUT, REPO_ROOT)}\n`);
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main();
}
