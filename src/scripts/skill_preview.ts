#!/usr/bin/env node
/**
 * Skill preview — non-destructive "what will this skill do?" summary.
 *
 * TypeScript twin of `src/scripts/skill_preview.py` (ADR-094 — Python→TS
 * migration, Phase 8 / Wave 8e). Public surface mirrors the Python module
 * exactly: `load_preview` / `render_plain` / `render_technical` / `PreviewError`,
 * the CLI flags (`name`, `--technical`, `--format text|json`), the exit codes
 * (0 success, 2 PreviewError), the stdout / stderr split, and byte-identical
 * rendered + `json.dumps(..., indent=2)` output.
 *
 * Reads a skill's declared intent (frontmatter + `## Steps` body) and renders a
 * plain-language summary BEFORE the skill runs. Read-only, no network, no
 * execution.
 *
 * NOT a sandbox: it surfaces declared intent, it does not run the skill or prove
 * side-effect-freeness (contract: docs/contracts/skill-dry-run.md). For
 * `execution: manual` skills (the default) it states "instructional only".
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/skill_preview.ts → parents[2] is the package root (mirrors the
// Python module's parent.parent.parent resolution).
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/**
 * Test seam mirroring the Python test's `monkeypatch.setattr(sp, "SKILLS_DIR", root)`.
 * The Python `SKILLS_DIR` is a module global; tests reassign it. Here it is a
 * mutable module-level value with a setter/getter for the same effect.
 */
let _SKILLS_DIR = path.join(REPO_ROOT, 'dist/agent-src', 'skills');
export function _setSkillsDirForTest(dir: string): void {
    _SKILLS_DIR = dir;
}
export function _getSkillsDirForTest(): string {
    return _SKILLS_DIR;
}

// Python: re.compile(r"`(python3?|bash|node|php|npm|task|pytest)\s+[^`]+`")
const _CMD_RE = /`(python3?|bash|node|php|npm|task|pytest)\s+[^`]+`/g;
// Python: re.compile(r"`([\w./-]+\.(?:py|sh|md|json|yml|yaml|ts|js|php))`")
// NOTE: Python's `\w` is Unicode-aware; JS `\w` is ASCII-only. Frontmatter
// paths in this corpus are ASCII, so the ASCII class matches Python in
// practice. Flagged as a divergence candidate for non-ASCII path names.
const _PATH_RE = /`([\w./-]+\.(?:py|sh|md|json|yml|yaml|ts|js|php))`/g;

export class PreviewError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PreviewError';
    }
}

type YamlValue = unknown;

interface Preview {
    name: string;
    description: string;
    domain: string;
    execution_type: string;
    handler: string;
    allowed_tools: unknown[];
    command: unknown[];
    steps: string[];
    commands_named: string[];
    paths_named: string[];
}

function _isPlainObject(v: unknown): v is Record<string, YamlValue> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Python truthiness for `(x or default)` chains. */
function _orStr(value: unknown, fallback: string): string {
    if (value === null || value === undefined || value === false || value === '' || value === 0) {
        return fallback;
    }
    return String(value);
}

function _split_frontmatter(text: string): [Record<string, YamlValue>, string] {
    if (!text.startsWith('---')) {
        throw new PreviewError('SKILL.md has no YAML frontmatter (missing leading `---`).');
    }
    const end = text.indexOf('\n---', 3);
    if (end === -1) {
        throw new PreviewError('SKILL.md frontmatter is not closed (missing terminating `---`).');
    }
    let fm: YamlValue;
    try {
        fm = parseYaml(text.slice(3, end), { version: '1.1' });
        if (fm === null || fm === undefined) {
            fm = {};
        }
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        throw new PreviewError(`SKILL.md frontmatter is not valid YAML: ${msg}`);
    }
    if (!_isPlainObject(fm)) {
        throw new PreviewError('SKILL.md frontmatter did not parse to a mapping.');
    }
    return [fm, text.slice(end + 4)];
}

function _steps(body: string): string[] {
    const out: string[] = [];
    let inSteps = false;
    for (const line of body.split('\n')) {
        if (/^##\s+Steps\b/i.test(line)) {
            inSteps = true;
            continue;
        }
        if (inSteps && /^##\s+\S/.test(line)) {
            // next top-level section
            break;
        }
        if (inSteps) {
            const m = /^###\s+(.*)/.exec(line);
            if (m) {
                out.push((m[1] ?? '').trim());
            }
        }
    }
    return out;
}

function _targets(body: string): [string[], string[]] {
    const cmdSet = new Set<string>();
    for (const m of body.matchAll(_CMD_RE)) {
        // Python: m.group(0).strip("`") — strip backticks from both ends.
        cmdSet.add(_stripChar(m[0], '`'));
    }
    const pathSet = new Set<string>();
    for (const m of body.matchAll(_PATH_RE)) {
        pathSet.add(m[1] ?? '');
    }
    const cmds = [...cmdSet].sort(_pyStrCmp);
    const paths = [...pathSet].sort(_pyStrCmp);
    return [cmds, paths];
}

/** Python `str.strip(chars)` — strip the given char from both ends. */
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

function _pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

export function load_preview(name: string): Preview {
    const skillDir = path.join(_SKILLS_DIR, name);
    const sk = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(sk) || !fs.statSync(sk).isFile()) {
        // Python: try `sk.relative_to(REPO_ROOT)`, else the absolute path.
        let shown = sk;
        const rel = path.relative(REPO_ROOT, sk);
        if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
            shown = rel;
        }
        throw new PreviewError(`no skill named ${_pyRepr(name)} (looked for ${shown}).`);
    }
    const text = _readTextReplace(sk);
    const [fm, body] = _split_frontmatter(text);
    let execution = fm['execution'];
    if (
        execution === null ||
        execution === undefined ||
        execution === false ||
        execution === '' ||
        execution === 0
    ) {
        execution = {};
    }
    if (!_isPlainObject(execution)) {
        execution = {};
    }
    const exec = execution as Record<string, YamlValue>;
    const [cmds, paths] = _targets(body);
    const allowedTools = _orList(exec['allowed_tools']);
    const command = _orList(exec['command']);
    const description = _orStr(fm['description'], '').trim();
    return {
        name: _orStr(fm['name'], name),
        description,
        domain: _orStr(fm['domain'], ''),
        execution_type: _orStr(exec['type'], 'manual'),
        handler: _orStr(exec['handler'], 'none'),
        allowed_tools: allowedTools,
        command,
        steps: _steps(body),
        commands_named: cmds,
        paths_named: paths,
    };
}

/** Python `(x or [])` — falsy → empty list. */
function _orList(value: unknown): unknown[] {
    if (Array.isArray(value)) {
        return value;
    }
    if (value === null || value === undefined || value === false || value === '' || value === 0) {
        return [];
    }
    // A non-empty non-list truthy value: Python would return it as-is. The
    // schema constrains these to lists, so this path is effectively unused;
    // wrap defensively to keep the type a list.
    return [value];
}

/** Python `repr(str)` — single-quoted, escapes inner single quotes / backslashes. */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '\\') {
            out += '\\\\';
        } else if (ch === quote) {
            out += '\\' + ch;
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (code < 0x20 || code === 0x7f) {
            out += `\\x${code.toString(16).padStart(2, '0')}`;
        } else {
            out += ch;
        }
    }
    return out + quote;
}

function _readTextReplace(p: string): string {
    // Python `read_text(encoding="utf-8", errors="replace")` — invalid bytes
    // become U+FFFD. Node's utf-8 decode does the same replacement.
    return fs.readFileSync(p).toString('utf-8');
}

export function render_plain(p: Preview): string {
    const lines: string[] = [`# Preview — \`${p.name}\``, ''];
    if (p.description) {
        lines.push(p.description, '');
    }
    const etype = p.execution_type;
    if (etype === 'manual') {
        lines.push(
            '**Execution: instructional only.** This skill does not run anything ' +
                'automatically — it guides the agent step by step.',
        );
    } else if (etype === 'assisted') {
        lines.push(
            `**Execution: assisted** (handler \`${p.handler}\`). It will *propose* actions ` +
                'for you to approve — it never executes silently.',
        );
    } else {
        lines.push(
            `**Execution: ${etype}** (handler \`${p.handler}\`). It can run actions; review the ` +
                'declared tools and commands below before allowing it.',
        );
    }
    lines.push('');
    if (p.steps.length > 0) {
        lines.push('This skill will walk these steps:');
        for (const s of p.steps) {
            lines.push(`- ${s}`);
        }
        lines.push('');
    }
    if (p.allowed_tools.length > 0) {
        lines.push(`Declared tools: ${p.allowed_tools.map((t) => _pyJoinStr(t)).join(', ')}`);
    }
    if (p.command.length > 0) {
        lines.push(`Declared command: \`${p.command.map((c) => String(c)).join(' ')}\``);
    }
    if (p.commands_named.length > 0) {
        lines.push('Commands it may run:');
        for (const c of p.commands_named) {
            lines.push(`- \`${c}\``);
        }
    }
    if (p.paths_named.length > 0) {
        lines.push('Files / scripts it references:');
        for (const f of p.paths_named) {
            lines.push(`- \`${f}\``);
        }
    }
    if (
        !(
            p.allowed_tools.length > 0 ||
            p.command.length > 0 ||
            p.commands_named.length > 0 ||
            p.paths_named.length > 0
        )
    ) {
        lines.push('_No tools, commands, or file targets declared — pure guidance._');
    }
    lines.push('');
    lines.push(
        '> Preview shows declared intent only — it does not run the skill or guarantee ' +
            'side-effect-freeness. Contract: docs/contracts/skill-dry-run.md',
    );
    return lines.join('\n');
}

/** Python `', '.join(p['allowed_tools'])` — items must be str; coerce defensively. */
function _pyJoinStr(v: unknown): string {
    return String(v);
}

export function render_technical(p: Preview): string {
    const lines: string[] = [
        `# Preview (technical) — ${p.name}`,
        '',
        '## Frontmatter (execution)',
        '```yaml',
    ];
    lines.push(`execution_type: ${p.execution_type}`);
    lines.push(`handler: ${p.handler}`);
    lines.push(`allowed_tools: ${_pyListRepr(p.allowed_tools)}`);
    if (p.command.length > 0) {
        lines.push(`command: ${_pyListRepr(p.command)}`);
    }
    lines.push('```', '', '## Declared steps');
    const stepLines = p.steps.map((s, i) => `${i + 1}. ${s}`);
    if (stepLines.length > 0) {
        lines.push(...stepLines);
    } else {
        lines.push('(none)');
    }
    if (p.commands_named.length > 0) {
        lines.push('', '## Commands named in body');
        for (const c of p.commands_named) {
            lines.push(`- \`${c}\``);
        }
    }
    if (p.paths_named.length > 0) {
        lines.push('', '## Paths named in body');
        for (const f of p.paths_named) {
            lines.push(`- \`${f}\``);
        }
    }
    return lines.join('\n');
}

/**
 * Python `str(list)` / f-string of a list — e.g. `['a', 'b']` or `[]`.
 * Items are rendered with Python `repr`.
 */
function _pyListRepr(items: unknown[]): string {
    return `[${items.map((it) => (typeof it === 'string' ? _pyRepr(it) : String(it))).join(', ')}]`;
}

// --- json.dumps(indent=2) emulation ----------------------------------------

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

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function pyJsonDumps(obj: Json, level = 0): string {
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
        return `[\n${obj.map((v) => pad + pyJsonDumps(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>);
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map(
        (k) => `${pad}${_pyJsonStr(k)}: ${pyJsonDumps((obj as Record<string, Json>)[k]!, level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

function _previewToJson(p: Preview): Json {
    return {
        name: p.name,
        description: p.description,
        domain: p.domain,
        execution_type: p.execution_type,
        handler: p.handler,
        allowed_tools: p.allowed_tools as Json[],
        command: p.command as Json[],
        steps: p.steps,
        commands_named: p.commands_named,
        paths_named: p.paths_named,
    };
}

interface Args {
    name: string | null;
    technical: boolean;
    format: 'text' | 'json';
}

function parse_args(argv: string[]): Args {
    const out: Args = { name: null, technical: false, format: 'text' };
    const positionals: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i]!;
        if (a === '--technical') {
            out.technical = true;
        } else if (a === '--format' || a.startsWith('--format=')) {
            let v: string;
            const eq = a.indexOf('=');
            if (eq !== -1) {
                v = a.slice(eq + 1);
            } else {
                i += 1;
                const nv = argv[i];
                if (nv === undefined) {
                    process.stderr.write('error: argument --format: expected one argument\n');
                    process.exit(2);
                }
                v = nv;
            }
            if (v !== 'text' && v !== 'json') {
                process.stderr.write(
                    `error: argument --format: invalid choice: '${v}' (choose from 'text', 'json')\n`,
                );
                process.exit(2);
            }
            out.format = v;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: skill_preview [-h] [--technical] [--format {text,json}] name\n',
            );
            process.exit(0);
        } else {
            positionals.push(a);
        }
    }
    if (positionals.length === 0) {
        process.stderr.write('error: the following arguments are required: name\n');
        process.exit(2);
    }
    out.name = positionals[0]!;
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const name = args.name as string;

    let preview: Preview;
    try {
        preview = load_preview(name);
    } catch (exc) {
        if (exc instanceof PreviewError) {
            if (args.format === 'json') {
                process.stdout.write(
                    pyJsonDumps({ error: exc.message, name }) + '\n',
                );
            } else {
                process.stderr.write(`❌  Cannot preview ${_pyRepr(name)}: ${exc.message}\n`);
            }
            return 2;
        }
        throw exc;
    }

    if (args.format === 'json') {
        process.stdout.write(pyJsonDumps(_previewToJson(preview)) + '\n');
    } else if (args.technical) {
        process.stdout.write(render_technical(preview) + '\n');
    } else {
        process.stdout.write(render_plain(preview) + '\n');
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
    process.exit(main());
}
