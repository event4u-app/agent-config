#!/usr/bin/env node
/**
 * Tool-agnostic skill-registration probe.
 *
 * TypeScript twin of `src/scripts/probe_skill_registration.py` (ADR-090 —
 * Python→TS migration, Phase 8 / Wave 8c). Mirrors the CLI contract
 * EXACTLY: flags (`--tool`, `--scope`, `--format`, `--strict`, `--home`,
 * `--project`), exit codes (0 informational / 0 when strict & clean, 2
 * when strict & findings), byte-identical text + JSON stdout, and the same
 * dataclass field order. No behaviour changes — latent quirks replicated.
 *
 * Roadmap: road-to-clean-skill-distribution-channels.md § Phase C.
 * Contract: docs/contracts/skill-distribution-channels.md.
 *
 * Surfaces every skill registered for any of the six supported AI tools
 * across user-global, project-local, and plugin-manifest sources. Flags
 * ``DUPLICATE`` (same skill name registered in ≥ 2 sources) and ``DRIFT``
 * (same name, different description-hash or version).
 *
 * CLI:
 *
 *     probe_skill_registration
 *     probe_skill_registration --tool=claude --format=json
 *     probe_skill_registration --strict
 *
 * ``--strict`` flips the exit code: 0 if no DUPLICATE / DRIFT findings,
 * non-zero otherwise. Without ``--strict`` the script is informational
 * (always exits 0).
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TOOL_IDS = ['claude', 'augment', 'cursor', 'cline', 'windsurf', 'copilot'] as const;
export const SCOPE_IDS = ['user', 'project'] as const;

export interface Registration {
    skill_id: string;
    tool: string;
    scope: string;
    source_path: string;
    version: string;
    description_snippet: string;
    description_hash: string;
}

function reg_to_dict(r: Registration): Record<string, string> {
    // Mirror dataclasses.asdict() field order.
    return {
        skill_id: r.skill_id,
        tool: r.tool,
        scope: r.scope,
        source_path: r.source_path,
        version: r.version,
        description_snippet: r.description_snippet,
        description_hash: r.description_hash,
    };
}

export interface ProbeResult {
    registrations: Registration[];
    duplicates: Map<string, Registration[]>;
    drift: Map<string, Registration[]>;
}

export function probe_result_to_dict(result: ProbeResult): {
    registrations: Record<string, string>[];
    duplicates: Record<string, Record<string, string>[]>;
    drift: Record<string, Record<string, string>[]>;
} {
    const dup: Record<string, Record<string, string>[]> = {};
    for (const [k, v] of result.duplicates) {
        dup[k] = v.map(reg_to_dict);
    }
    const dr: Record<string, Record<string, string>[]> = {};
    for (const [k, v] of result.drift) {
        dr[k] = v.map(reg_to_dict);
    }
    return {
        registrations: result.registrations.map(reg_to_dict),
        duplicates: dup,
        drift: dr,
    };
}

// ---------------------------------------------------------------------------
// Frontmatter + version helpers
// ---------------------------------------------------------------------------

/** Minimal YAML frontmatter extractor — no YAML dependency. */
function _read_frontmatter(skill_md: string): Map<string, string> {
    let text: string;
    try {
        text = _readTextReplace(skill_md);
    } catch {
        return new Map();
    }
    if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
        return new Map();
    }
    // Python: text.split("---", 2) — split on first 2 occurrences → ≤3 parts.
    const rest = _splitMax(text, '---', 2);
    if (rest.length < 3) {
        return new Map();
    }
    const body = rest[1]!;
    const out = new Map<string, string>();
    for (const line of body.split('\n')) {
        if (!line.includes(':') || _pyLStrip(line).startsWith('#')) {
            continue;
        }
        // Python str.partition(":") — split on FIRST colon.
        const idx = line.indexOf(':');
        const key = line.slice(0, idx);
        const value = line.slice(idx + 1);
        out.set(_pyStrip(key), _pyStripChars(_pyStripChars(_pyStrip(value), '"'), "'"));
    }
    return out;
}

function _hash_desc(desc: string): string {
    return crypto.createHash('sha256').update(Buffer.from(desc, 'utf-8')).digest('hex').slice(0, 12);
}

function _snippet(desc: string, n = 80): string {
    const stripped = _pyStrip(desc);
    const arr = Array.from(stripped);
    return arr.length <= n ? stripped : arr.slice(0, n - 1).join('') + '…';
}

/** Read a 'this install's version' value from package.json / plugin.json. */
function _version_at(root: string): string {
    const candidates = [
        path.join(root, 'package.json'),
        path.join(root, '.augment-plugin', 'plugin.json'),
    ];
    for (const candidate of candidates) {
        if (!_isFile(candidate)) {
            continue;
        }
        try {
            const data = JSON.parse(fs.readFileSync(candidate, 'utf-8')) as Record<string, unknown>;
            const v = data['version'];
            if (typeof v === 'string' && v) {
                return v;
            }
        } catch {
            continue;
        }
    }
    return 'unknown';
}

// ---------------------------------------------------------------------------
// Per-tool readers
// ---------------------------------------------------------------------------

function* _iter_skill_md(skills_root: string): Generator<string> {
    if (!_isDir(skills_root)) {
        return;
    }
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(skills_root, { withFileTypes: true });
    } catch {
        return;
    }
    // Python: sorted(skills_root.iterdir()) — path-component order.
    const sortedEntries = entries
        .map((e) => path.join(skills_root, e.name))
        .sort(_pyPathCmp);
    for (const entry of sortedEntries) {
        if (!_isDir(entry)) {
            continue;
        }
        const skill_md = path.join(entry, 'SKILL.md');
        if (_isFile(skill_md)) {
            yield skill_md;
        }
    }
}

function* _read_claude(scope: string, root: string): Generator<Registration> {
    const skills = path.join(root, '.claude', 'skills');
    for (const skill_md of _iter_skill_md(skills)) {
        const fm = _read_frontmatter(skill_md);
        const name = fm.get('name') || path.basename(path.dirname(skill_md));
        const desc = fm.get('description') ?? '';
        yield {
            skill_id: name,
            tool: 'claude',
            scope,
            source_path: skill_md,
            version: _version_at(root),
            description_snippet: _snippet(desc),
            description_hash: _hash_desc(desc),
        };
    }
    // Plugin manifest at the same scope.
    const manifest = path.join(root, '.claude-plugin', 'marketplace.json');
    if (_isFile(manifest)) {
        try {
            const data = JSON.parse(fs.readFileSync(manifest, 'utf-8')) as {
                plugins?: { skills?: string[] }[];
            };
            const plugins = data.plugins ?? [];
            const entries: string[] = [];
            for (const plug of plugins) {
                entries.push(...(plug.skills ?? []));
            }
            for (const entry of entries) {
                const tail = path.basename(entry);
                yield {
                    skill_id: tail,
                    tool: 'claude',
                    scope: `${scope}-plugin`,
                    source_path: manifest,
                    version: _version_at(root),
                    description_snippet: '(plugin manifest entry)',
                    description_hash: 'manifest',
                };
            }
        } catch {
            // pass
        }
    }
}

function* _read_augment(scope: string, root: string): Generator<Registration> {
    const skills = path.join(root, '.augment', 'skills');
    for (const skill_md of _iter_skill_md(skills)) {
        const fm = _read_frontmatter(skill_md);
        const name = fm.get('name') || path.basename(path.dirname(skill_md));
        const desc = fm.get('description') ?? '';
        yield {
            skill_id: name,
            tool: 'augment',
            scope,
            source_path: skill_md,
            version: _version_at(root),
            description_snippet: _snippet(desc),
            description_hash: _hash_desc(desc),
        };
    }
}

function* _glob_sorted(dir: string, ext: string): Generator<string> {
    if (!_isDir(dir)) {
        return;
    }
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    // Python: sorted(rules.glob("*.mdc")) — non-recursive, name match.
    const matched = entries
        .filter((e) => e.name.endsWith(ext))
        .map((e) => path.join(dir, e.name))
        .sort(_pyPathCmp);
    for (const m of matched) {
        yield m;
    }
}

function* _read_cursor(scope: string, root: string): Generator<Registration> {
    const rules = path.join(root, '.cursor', 'rules');
    if (!_isDir(rules)) {
        return;
    }
    for (const rule of _glob_sorted(rules, '.mdc')) {
        const fm = _read_frontmatter(rule);
        const name = fm.get('name') || _stem(rule);
        const desc = fm.get('description') ?? '';
        yield {
            skill_id: name,
            tool: 'cursor',
            scope,
            source_path: rule,
            version: _version_at(root),
            description_snippet: _snippet(desc),
            description_hash: _hash_desc(desc),
        };
    }
}

function* _read_cline(scope: string, root: string): Generator<Registration> {
    const rules = path.join(root, '.clinerules');
    if (!_isDir(rules)) {
        return;
    }
    for (const rule of _glob_sorted(rules, '.md')) {
        const fm = _read_frontmatter(rule);
        const name = fm.get('name') || _stem(rule);
        const desc = fm.get('description') ?? '';
        yield {
            skill_id: name,
            tool: 'cline',
            scope,
            source_path: rule,
            version: _version_at(root),
            description_snippet: _snippet(desc),
            description_hash: _hash_desc(desc),
        };
    }
}

function* _read_windsurf(scope: string, root: string): Generator<Registration> {
    const rules = path.join(root, '.windsurf', 'rules');
    if (!_isDir(rules)) {
        return;
    }
    for (const rule of _glob_sorted(rules, '.md')) {
        const fm = _read_frontmatter(rule);
        const name = fm.get('name') || _stem(rule);
        const desc = fm.get('description') ?? '';
        yield {
            skill_id: name,
            tool: 'windsurf',
            scope,
            source_path: rule,
            version: _version_at(root),
            description_snippet: _snippet(desc),
            description_hash: _hash_desc(desc),
        };
    }
}

function* _read_copilot(scope: string, root: string): Generator<Registration> {
    const candidates = [
        path.join(root, '.github', 'copilot-instructions.md'),
        path.join(root, 'copilot-instructions.md'),
    ];
    for (const candidate of candidates) {
        if (!_isFile(candidate)) {
            continue;
        }
        let text: string;
        try {
            text = _readTextReplace(candidate);
        } catch {
            continue;
        }
        // Python: text.split("\n", 1)[0] if text else ""
        const firstLine = text ? text.split('\n', 1)[0]! : '';
        const snippet = _snippet(firstLine);
        yield {
            skill_id: 'copilot-instructions',
            tool: 'copilot',
            scope,
            source_path: candidate,
            version: _version_at(root),
            description_snippet: snippet,
            description_hash: _hash_desc(text),
        };
    }
}

type Reader = (scope: string, root: string) => Generator<Registration>;

const TOOL_READERS: Record<string, Reader> = {
    claude: _read_claude,
    augment: _read_augment,
    cursor: _read_cursor,
    cline: _read_cline,
    windsurf: _read_windsurf,
    copilot: _read_copilot,
};

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

export function run_probe(opts?: {
    tool_filter?: string;
    scope_filter?: string;
    home?: string | null;
    project?: string | null;
}): ProbeResult {
    const tool_filter = opts?.tool_filter ?? 'all';
    const scope_filter = opts?.scope_filter ?? 'all';
    const home = opts?.home ?? process.env['HOME'] ?? '/tmp';
    const project = opts?.project ?? process.cwd();

    const scopes: [string, string][] = [];
    if (scope_filter === 'all' || scope_filter === 'user') {
        scopes.push(['user', home]);
    }
    if (scope_filter === 'all' || scope_filter === 'project') {
        scopes.push(['project', project]);
    }

    const tools: readonly string[] = tool_filter === 'all' ? TOOL_IDS : [tool_filter];

    const result: ProbeResult = {
        registrations: [],
        duplicates: new Map(),
        drift: new Map(),
    };

    for (const [scope, root] of scopes) {
        for (const tool of tools) {
            const reader = TOOL_READERS[tool];
            if (reader === undefined) {
                continue;
            }
            for (const reg of reader(scope, root)) {
                result.registrations.push(reg);
            }
        }
    }

    // Group by (tool, skill_id). ≥ 2 entries → DUPLICATE.
    const by_key = new Map<string, Registration[]>();
    for (const reg of result.registrations) {
        const k = `${reg.tool} ${reg.skill_id}`;
        const arr = by_key.get(k) ?? [];
        arr.push(reg);
        by_key.set(k, arr);
    }

    for (const [composite, regs] of by_key) {
        if (regs.length < 2) {
            continue;
        }
        const [tool, skill_id] = composite.split(' ');
        const key = `${tool}:${skill_id}`;
        result.duplicates.set(key, regs);
        const hashes = new Set<string>();
        for (const r of regs) {
            if (r.description_hash !== 'manifest') {
                hashes.add(r.description_hash);
            }
        }
        const versions = new Set<string>();
        for (const r of regs) {
            if (r.version !== 'unknown') {
                versions.add(r.version);
            }
        }
        if (hashes.size > 1 || versions.size > 1) {
            result.drift.set(key, regs);
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function render_text(result: ProbeResult): string {
    const lines: string[] = [];
    lines.push('Skill-registration probe');
    lines.push('='.repeat(64));
    lines.push('');
    if (result.registrations.length === 0) {
        lines.push('(no registrations found)');
        return lines.join('\n');
    }

    lines.push(`${_ljust('TOOL', 10)} ${_ljust('SCOPE', 14)} ${_ljust('SKILL', 32)} ${_ljust('VER', 10)} SOURCE`);
    lines.push('-'.repeat(100));
    for (const reg of result.registrations) {
        lines.push(
            `${_ljust(reg.tool, 10)} ${_ljust(reg.scope, 14)} ${_ljust(_sliceCp(reg.skill_id, 32), 32)} ` +
                `${_ljust(reg.version, 10)} ${reg.source_path}`,
        );
    }

    if (result.duplicates.size > 0) {
        lines.push('');
        lines.push('DUPLICATE — same skill registered in ≥ 2 sources');
        lines.push('-'.repeat(64));
        for (const [key, regs] of result.duplicates) {
            lines.push(`  ${key}`);
            for (const r of regs) {
                lines.push(`    - [${r.scope}/${r.version}] ${r.source_path}`);
            }
        }
    }
    if (result.drift.size > 0) {
        lines.push('');
        lines.push('DRIFT — same skill registered with DIFFERENT description / version');
        lines.push('-'.repeat(64));
        for (const [key, regs] of result.drift) {
            lines.push(`  ${key}`);
            for (const r of regs) {
                lines.push(
                    `    - [${r.scope}/${r.version}] hash=${r.description_hash} desc=${_pyRepr(r.description_snippet)}`,
                );
                lines.push(`      source: ${r.source_path}`);
            }
        }
    }

    return lines.join('\n');
}

export function render_json(result: ProbeResult): string {
    return _jsonDumpsIndent2(probe_result_to_dict(result) as unknown as Json);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface Args {
    tool: string;
    scope: string;
    format: string;
    strict: boolean;
    home: string | null;
    project: string | null;
}

class ArgError extends Error {}

function parse_args(argv: string[]): Args {
    const args: Args = {
        tool: 'all',
        scope: 'all',
        format: 'text',
        strict: false,
        home: null,
        project: null,
    };
    const toolChoices = new Set<string>(['all', ...TOOL_IDS]);
    const scopeChoices = new Set<string>(['all', ...SCOPE_IDS]);
    const fmtChoices = new Set<string>(['text', 'json']);

    let i = 0;
    const takeValue = (flag: string, inline: string | null): string => {
        if (inline !== null) {
            return inline;
        }
        i += 1;
        if (i >= argv.length) {
            throw new ArgError(`argument ${flag}: expected one argument`);
        }
        return argv[i]!;
    };

    while (i < argv.length) {
        const raw = argv[i]!;
        let flag = raw;
        let inline: string | null = null;
        const eq = raw.indexOf('=');
        if (raw.startsWith('--') && eq !== -1) {
            flag = raw.slice(0, eq);
            inline = raw.slice(eq + 1);
        }
        if (flag === '--tool') {
            const v = takeValue(flag, inline);
            if (!toolChoices.has(v)) {
                throw new ArgError(`argument --tool: invalid choice: '${v}'`);
            }
            args.tool = v;
        } else if (flag === '--scope') {
            const v = takeValue(flag, inline);
            if (!scopeChoices.has(v)) {
                throw new ArgError(`argument --scope: invalid choice: '${v}'`);
            }
            args.scope = v;
        } else if (flag === '--format') {
            const v = takeValue(flag, inline);
            if (!fmtChoices.has(v)) {
                throw new ArgError(`argument --format: invalid choice: '${v}'`);
            }
            args.format = v;
        } else if (flag === '--strict') {
            if (inline !== null) {
                throw new ArgError('argument --strict: ignored explicit argument');
            }
            args.strict = true;
        } else if (flag === '--home') {
            args.home = takeValue(flag, inline);
        } else if (flag === '--project') {
            args.project = takeValue(flag, inline);
        } else {
            throw new ArgError(`unrecognized arguments: ${raw}`);
        }
        i += 1;
    }
    return args;
}

export function main(argv: string[] | null = null): number {
    const rawArgv = argv ?? process.argv.slice(2);
    let args: Args;
    try {
        args = parse_args(rawArgv);
    } catch (e) {
        if (e instanceof ArgError) {
            // argparse writes usage + error to stderr and exits 2.
            process.stderr.write(`probe_skill_registration: error: ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    const result = run_probe({
        tool_filter: args.tool,
        scope_filter: args.scope,
        home: args.home,
        project: args.project,
    });

    const out = args.format === 'json' ? render_json(result) : render_text(result);
    process.stdout.write(out + '\n');

    if (args.strict && (result.duplicates.size > 0 || result.drift.size > 0)) {
        return 2;
    }
    return 0;
}

// --- Python helpers ----------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function _jsonDumpsIndent2(obj: Json): string {
    const pad = '  ';
    function enc(value: Json, depth: number): string {
        if (value === null) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as { [k: string]: Json };
        const keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k]!, depth + 1));
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

/** Mirror Python repr() for a str — used by the `desc={...!r}` rendering. */
function _pyRepr(s: string): string {
    // Python prefers single quotes unless the string contains a single quote
    // but no double quote, in which case it uses double quotes.
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        const cp = ch.codePointAt(0) as number;
        if (ch === '\\') out += '\\\\';
        else if (ch === quote) out += '\\' + quote;
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (cp < 0x20 || cp === 0x7f) out += '\\x' + cp.toString(16).padStart(2, '0');
        else out += ch;
    }
    return out + quote;
}

function _ljust(s: string, width: number): string {
    const len = Array.from(s).length;
    return len >= width ? s : s + ' '.repeat(width - len);
}

function _sliceCp(s: string, n: number): string {
    return Array.from(s).slice(0, n).join('');
}

function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}

function _readTextReplace(p: string): string {
    // Python read_text(errors="replace") — decode with U+FFFD on bad bytes.
    const buf = fs.readFileSync(p);
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}

function _splitMax(s: string, sep: string, maxsplit: number): string[] {
    const parts: string[] = [];
    let rest = s;
    let count = 0;
    while (count < maxsplit) {
        const idx = rest.indexOf(sep);
        if (idx === -1) {
            break;
        }
        parts.push(rest.slice(0, idx));
        rest = rest.slice(idx + sep.length);
        count += 1;
    }
    parts.push(rest);
    return parts;
}

function _pyStrip(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

function _pyLStrip(s: string): string {
    return s.replace(/^\s+/u, '');
}

function _pyStripChars(s: string, chars: string): string {
    const set = new Set(Array.from(chars));
    const arr = Array.from(s);
    let start = 0;
    let end = arr.length;
    while (start < end && set.has(arr[start]!)) start += 1;
    while (end > start && set.has(arr[end - 1]!)) end -= 1;
    return arr.slice(start, end).join('');
}

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

function _pyPathCmp(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const x = pa[i]!;
        const y = pb[i]!;
        const ca = Array.from(x);
        const cb = Array.from(y);
        const m = Math.min(ca.length, cb.length);
        for (let j = 0; j < m; j++) {
            const cx = ca[j]!.codePointAt(0)!;
            const cy = cb[j]!.codePointAt(0)!;
            if (cx !== cy) return cx - cy;
        }
        if (ca.length !== cb.length) return ca.length - cb.length;
    }
    return pa.length - pb.length;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exitCode = main();
}
