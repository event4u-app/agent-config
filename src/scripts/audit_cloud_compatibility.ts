#!/usr/bin/env tsx
/**
 * audit_cloud_compatibility.ts — tier each artefact for cloud distribution.
 *
 * TypeScript twin of `src/scripts/audit_cloud_compatibility.py` (ADR-096,
 * Phase 8 / Wave 8a). The CLI contract is mirrored EXACTLY — the flags
 * `--details` / `--tier` / `--cloud-action` / `--format` / `--iron-law`,
 * exit codes, the stdout/stderr split, byte-identical messages, AND
 * byte-identical JSON output (`json.dumps(indent=2)` — insertion-order keys,
 * 2-space indent, `(", ", ": ")` separators, `ensure_ascii=True`).
 *
 * Classifies every .md under `.agent-src.uncondensed/{skills,rules,commands,
 * guidelines}` into a tier (T1 / T2 / T3-S / T3-H), honouring the
 * `<!-- cloud_safe: noop|degrade -->` markers, and emits a JSON summary
 * (or `--details` rows, or the `--iron-law` bypass scan).
 *
 * No behaviour changes — latent Python quirks replicated (including the
 * Counter.most_common tie-ordering and the regex-findall set dedup).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

type Json = unknown;
type JsonObject = Record<string, Json>;

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/audit_cloud_compatibility.ts → parents[2] of the .py file = repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const SOURCE = path.join(ROOT, '.agent-src.uncondensed');
export const SCAN_DIRS = ['skills', 'rules', 'commands', 'guidelines'];

// --- patterns (global so findall returns every non-overlapping match) ---------
const SCRIPT_RE = /scripts\/[a-z_]+\.(?:py|sh)|python3\s+scripts\/|bash\s+scripts\/|\.\/scripts\//g;
const TASK_RE = /`task\s+[a-z][a-z0-9-]+`/g;
const HARD_RE = new RegExp(
    '(?:MUST\\s+(?:run|invoke|call)|' +
        '^\\s*[*-]?\\s*(?:Run|Invoke|Call)\\s+`?(?:python3\\s+)?scripts/|' +
        'first\\s+tool\\s+call.*scripts/|' +
        'runs?\\s+silently\\s+before|' +
        'automatically\\s+(?:invokes?|runs?)\\s+`?scripts/)',
    'im',
);
const FS_RE =
    /dist\/agent-src(?:\.uncondensed)?\/|\.augment\/|\.claude\/|\.cursor\/|\.clinerules\/|agents\/|\.agent-settings\.yml|\.agent-chat-history/g;
const CLOUD_MARKER_RE = /<!--\s*cloud_safe:\s*(noop|degrade)\s*-->/i;

const AGENT_EDIT_RE = new RegExp(
    '(?:' +
        '\\b(?:edit|write|update|modify|patch|append\\s+to|set)\\s+' +
        '(?:the\\s+|a\\s+|this\\s+|that\\s+|your\\s+)?' +
        '`?\\.(?:agent-settings\\.yml|gitignore|augmentignore|' +
        'agent-chat-history|env|claude/|cursor/|clinerules|windsurfrules)' +
        '|' +
        '\\b(?:str-replace-editor|save-file|remove-files)\\b' +
        ')',
    'i',
);
const AGENT_RUN_RE = new RegExp(
    '(?:' +
        'MUST\\s+(?:run|invoke|call|execute)\\s+`?(?:task|python3|bash|' +
        'src/scripts/|\\.augment/scripts/|\\.augment/scripts)' +
        '|' +
        'first\\s+tool\\s+call\\s+(?:is|must\\s+be)\\b' +
        '|' +
        'automatically\\s+(?:invokes?|runs?)\\s+`?(?:task|scripts/|' +
        '\\.augment/scripts/)' +
        '|' +
        'runs?\\s+silently\\s+before' +
        '|' +
        '^\\s*[*-]\\s*(?:Run|Invoke|Call|Execute)\\s+`(?:task|python3|' +
        'bash\\s+scripts|scripts/|\\.augment/scripts/)' +
        ')',
    'im',
);
const AGENT_READ_RE = new RegExp(
    '\\b(?:MUST\\s+read|first\\s+(?:reads?|inspects?))\\s+' +
        '(?:the\\s+|a\\s+)?(?:file|frontmatter|`\\.)',
    'i',
);

// step-9 P11 · U3 — Iron-Law bypass scan.
const _IRON_LAW_YAML_LOAD_RE = /yaml\.(?:safe_load|load|full_load|unsafe_load)\s*\(/;
const _IRON_LAW_AI_COUNCIL_REF_RE = /['"]\.ai-council\.yml['"]|ai-council\.yml/;
const _IRON_LAW_ALLOWLIST = [
    'src/scripts/ai_council/config.py',
    'tests/',
    'src/scripts/audit_cloud_compatibility.py',
];

// --- filesystem helpers -------------------------------------------------------

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _relativeToPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

/** `sorted(base.rglob("*.md"))` — recursive, lexically sorted abs paths. */
function _rglobSorted(root: string, suffix: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.name.endsWith(suffix)) {
                out.push(full);
            }
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort();
    return out;
}

// --- regex findall + sorted-set helpers ---------------------------------------

/** Mirror `re.findall` for a global regex with no capture group → full matches. */
function _findall(re: RegExp, text: string): string[] {
    const out: string[] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        out.push(m[0]);
        if (m.index === re.lastIndex) {
            re.lastIndex += 1; // avoid an infinite loop on zero-width matches
        }
    }
    return out;
}

/** `sorted(set(iterable))` — unique, lexically sorted. */
function _sortedSet(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// --- Counter -----------------------------------------------------------------

/**
 * Minimal Counter replica preserving Python's `most_common` tie-ordering:
 * elements are sorted by count descending, and ties retain first-insertion
 * order (CPython's `most_common` is stable on insertion order for equal counts).
 */
class Counter {
    private map = new Map<string, number>();

    add(key: string): void {
        this.map.set(key, (this.map.get(key) ?? 0) + 1);
    }

    /** `dict(Counter)` — insertion order. */
    toObject(): Record<string, number> {
        const out: Record<string, number> = {};
        for (const [k, v] of this.map) {
            out[k] = v;
        }
        return out;
    }

    /** Mirror `Counter.most_common(n)` → array of `[key, count]`. */
    most_common(n?: number): [string, number][] {
        const entries = [...this.map.entries()].map(([k, v], idx) => ({ k, v, idx }));
        entries.sort((a, b) => (b.v - a.v) || (a.idx - b.idx));
        const ordered: [string, number][] = entries.map((e) => [e.k, e.v]);
        return n === undefined ? ordered : ordered.slice(0, n);
    }
}

// --- json.dumps(indent=2) replica (insertion-order keys, ensure_ascii) -------

function _jsonDumpsIndent2(obj: Json): string {
    const pad = '  ';

    function enc(value: Json, depth: number): string {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'number') {
            return String(value);
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
        const o = value as JsonObject;
        const keys = Object.keys(o); // insertion order (no sort_keys)
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

// --- classification -----------------------------------------------------------

export function detect_cloud_marker(text: string): string | null {
    const m = CLOUD_MARKER_RE.exec(text);
    return m ? (m[1] as string).toLowerCase() : null;
}

export function classify_cloud_action(text: string): string {
    const has_edit = AGENT_EDIT_RE.test(text);
    const has_run = AGENT_RUN_RE.test(text);
    const has_read = AGENT_READ_RE.test(text);

    const active = [has_edit, has_run, has_read].filter(Boolean).length;
    if (active === 0) {
        return 'none';
    }
    if (active >= 2) {
        return 'mixed';
    }
    if (has_edit) {
        return 'edits';
    }
    if (has_run) {
        return 'runs-task';
    }
    return 'reads-only';
}

export interface ClassifyEvidence {
    scripts: string[];
    tasks: string[];
    fs_refs_sample: string[];
    has_hard_dep_marker: boolean;
    raw_tier: string;
    cloud_marker: string | null;
    cloud_action: string;
}

export function classify(text: string): [string, ClassifyEvidence] {
    const scripts = _sortedSet(_findall(SCRIPT_RE, text));
    // sorted(set(m.strip("`") for m in TASK_RE.findall(text)))
    const tasks = _sortedSet(_findall(TASK_RE, text).map((m) => _stripChar(m, '`')));
    const fs_refs = _sortedSet(_findall(FS_RE, text));
    const has_hard = HARD_RE.test(text);
    const cloud_marker = detect_cloud_marker(text);

    const has_script = scripts.length > 0 || tasks.length > 0;
    const has_fs = fs_refs.length > 0;

    let raw_tier: string;
    if (has_script && has_hard) {
        raw_tier = 'T3-H';
    } else if (has_script) {
        raw_tier = 'T3-S';
    } else if (has_fs) {
        raw_tier = 'T2';
    } else {
        raw_tier = 'T1';
    }

    let tier: string;
    if (cloud_marker === 'noop') {
        tier = 'T1';
    } else if (cloud_marker === 'degrade') {
        tier = raw_tier === 'T3-H' ? 'T3-S' : raw_tier;
    } else {
        tier = raw_tier;
    }

    let cloud_action: string;
    if (tier === 'T1' || tier === 'T2' || tier === 'T3-S') {
        cloud_action = classify_cloud_action(text);
    } else {
        cloud_action = 'blocked';
    }

    return [
        tier,
        {
            scripts,
            tasks,
            fs_refs_sample: fs_refs.slice(0, 3),
            has_hard_dep_marker: has_hard,
            raw_tier,
            cloud_marker,
            cloud_action,
        },
    ];
}

/** Mirror Python `str.strip(ch)`. */
function _stripChar(s: string, ch: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && s[start] === ch) {
        start += 1;
    }
    while (end > start && s[end - 1] === ch) {
        end -= 1;
    }
    return s.slice(start, end);
}

interface Row extends ClassifyEvidence {
    path: string;
    kind: string;
    tier: string;
}

export function scan(): Row[] {
    const rows: Row[] = [];
    for (const sub of SCAN_DIRS) {
        const base = path.join(SOURCE, sub);
        if (!_isDir(base)) {
            continue;
        }
        for (const md of _rglobSorted(base, '.md')) {
            if (path.basename(md).toLowerCase() === 'readme.md') {
                continue;
            }
            const text = fs.readFileSync(md, 'utf-8');
            const [tier, evidence] = classify(text);
            rows.push({
                path: _relativeToPosix(md, ROOT),
                kind: sub,
                tier,
                ...evidence,
            });
        }
    }
    return rows;
}

interface IronLawFinding {
    path: string;
    lines: number[];
    reason: string;
}

function _iron_law_bypass_scan(): IronLawFinding[] {
    const findings: IronLawFinding[] = [];
    const scriptsDir = path.join(ROOT, 'src', 'scripts');
    if (!_isDir(scriptsDir)) {
        return findings;
    }
    for (const py of _rglobSorted(scriptsDir, '.py')) {
        const rel = _relativeToPosix(py, ROOT);
        if (_IRON_LAW_ALLOWLIST.some((p) => rel.startsWith(p))) {
            continue;
        }
        let text: string;
        try {
            text = fs.readFileSync(py, 'utf-8');
        } catch {
            continue;
        }
        const lines = text.split('\n');
        const offending: number[] = [];
        // enumerate(lines, start=1)
        for (let idx = 0; idx < lines.length; idx += 1) {
            const i = idx + 1;
            const line = lines[idx] as string;
            if (!_IRON_LAW_YAML_LOAD_RE.test(line)) {
                continue;
            }
            if (line.includes('iron-law-ok')) {
                continue;
            }
            // window = "\n".join(lines[max(0, i - 4):i])
            const window = lines.slice(Math.max(0, i - 4), i).join('\n');
            if (_IRON_LAW_AI_COUNCIL_REF_RE.test(window)) {
                offending.push(i);
            }
        }
        if (offending.length > 0) {
            findings.push({
                path: rel,
                lines: offending,
                reason:
                    'raw YAML load on ai-council.yml — bypasses ' +
                    '_reject_top_level_locked_dispatch',
            });
        }
    }
    return findings;
}

export function summarize(rows: Row[]): JsonObject {
    const by_tier = new Counter();
    const by_kind_tier: Record<string, Counter> = {};
    for (const r of rows) {
        by_tier.add(r.tier);
        (by_kind_tier[r.kind] ??= new Counter()).add(r.tier);
    }
    const script_freq = new Counter();
    const task_freq = new Counter();
    const cloud_action_freq = new Counter();
    const cloud_action_by_tier: Record<string, Counter> = {};
    for (const r of rows) {
        for (const s of r.scripts) {
            script_freq.add(s);
        }
        for (const t of r.tasks) {
            task_freq.add(t);
        }
        const ca = r.cloud_action;
        if (ca) {
            cloud_action_freq.add(ca);
            (cloud_action_by_tier[r.tier] ??= new Counter()).add(ca);
        }
    }
    // by_tier: dict(by_tier.most_common()) — count-desc order
    const byTierObj: Record<string, number> = {};
    for (const [k, v] of by_tier.most_common()) {
        byTierObj[k] = v;
    }
    const byKindTierObj: JsonObject = {};
    for (const [k, v] of Object.entries(by_kind_tier)) {
        byKindTierObj[k] = v.toObject();
    }
    const byCloudActionObj: Record<string, number> = {};
    for (const [k, v] of cloud_action_freq.most_common()) {
        byCloudActionObj[k] = v;
    }
    const cloudActionByTierObj: JsonObject = {};
    for (const [k, v] of Object.entries(cloud_action_by_tier)) {
        cloudActionByTierObj[k] = v.toObject();
    }
    return {
        total: rows.length,
        by_tier: byTierObj,
        by_kind_tier: byKindTierObj,
        by_cloud_action: byCloudActionObj,
        cloud_action_by_tier: cloudActionByTierObj,
        top_scripts: script_freq.most_common(15),
        top_tasks: task_freq.most_common(10),
    };
}

interface ParsedArgs {
    details: boolean;
    tier: string | null;
    cloud_action: string | null;
    format: string;
    iron_law: boolean;
}

const _TIER_CHOICES = ['T1', 'T2', 'T3-S', 'T3-H'];
const _CLOUD_ACTION_CHOICES = ['reads-only', 'edits', 'runs-task', 'mixed', 'none', 'blocked'];
const _FORMAT_CHOICES = ['json', 'md'];

function _choiceError(flag: string, value: string, choices: string[]): never {
    const opts = choices.map((c) => `'${c}'`).join(', ');
    process.stderr.write(`audit_cloud_compatibility: error: argument ${flag}: invalid choice: '${value}' (choose from ${opts})\n`);
    process.exit(2);
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = {
        details: false,
        tier: null,
        cloud_action: null,
        format: 'json',
        iron_law: false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const value = (flag: string): string => {
            const eq = a.indexOf('=');
            if (eq !== -1) {
                return a.slice(eq + 1);
            }
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write(`audit_cloud_compatibility: error: argument ${flag}: expected one argument\n`);
                process.exit(2);
            }
            i += 1;
            return next;
        };
        if (a === '--details') {
            out.details = true;
        } else if (a === '--iron-law') {
            out.iron_law = true;
        } else if (a === '--tier' || a.startsWith('--tier=')) {
            const v = value('--tier');
            if (!_TIER_CHOICES.includes(v)) {
                _choiceError('--tier', v, _TIER_CHOICES);
            }
            out.tier = v;
        } else if (a === '--cloud-action' || a.startsWith('--cloud-action=')) {
            const v = value('--cloud-action');
            if (!_CLOUD_ACTION_CHOICES.includes(v)) {
                _choiceError('--cloud-action', v, _CLOUD_ACTION_CHOICES);
            }
            out.cloud_action = v;
        } else if (a === '--format' || a.startsWith('--format=')) {
            const v = value('--format');
            if (!_FORMAT_CHOICES.includes(v)) {
                _choiceError('--format', v, _FORMAT_CHOICES);
            }
            out.format = v;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: audit_cloud_compatibility [-h] [--details] [--tier {T1,T2,T3-S,T3-H}]\n');
            process.exit(0);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    if (args.iron_law) {
        const findings = _iron_law_bypass_scan();
        process.stdout.write(_jsonDumpsIndent2({ iron_law_bypass_findings: findings }) + '\n');
        return findings.length > 0 ? 1 : 0;
    }

    const rows = scan();
    const summary = summarize(rows);

    if (args.details) {
        const filtered = rows.filter(
            (r) =>
                (!args.tier || r.tier === args.tier) &&
                (!args.cloud_action || r.cloud_action === args.cloud_action),
        );
        if (args.format === 'json') {
            process.stdout.write(_jsonDumpsIndent2({ summary, rows: filtered }) + '\n');
        } else {
            process.stdout.write(
                `# Cloud-compat audit — tier filter: ${args.tier || 'all'}` +
                    ` · cloud-action: ${args.cloud_action || 'all'}\n\n`,
            );
            process.stdout.write(`Total in scope: ${filtered.length}\n\n`);
            for (const r of filtered) {
                const marker = r.has_hard_dep_marker ? ' 🔴' : '';
                const action = r.cloud_action || '—';
                process.stdout.write(`- \`${r.path}\` — **${r.tier}** · ` + `action: \`${action}\`${marker}\n`);
                if (r.scripts.length > 0) {
                    process.stdout.write(`  - scripts: \`${r.scripts.join('`, `')}\`\n`);
                }
                if (r.tasks.length > 0) {
                    process.stdout.write(`  - tasks: \`${r.tasks.join('`, `')}\`\n`);
                }
            }
        }
        return 0;
    }

    process.stdout.write(_jsonDumpsIndent2(summary) + '\n');
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
