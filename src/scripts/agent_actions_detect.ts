#!/usr/bin/env tsx
/**
 * agent_actions_detect — list what an AI agent can DO in a project, and which
 * of those actions nobody declared or whose subject a model can choose.
 *
 * ```
 * A CLAIM IS AN INPUT, NEVER AN AUTHORIZATION.
 * A FILE THAT MENTIONS AGENT TOOLING BUT MATCHES NO KNOWN SHAPE IS `unknown`,
 * NEVER CLEAN.
 * ```
 *
 * Deterministic: no model, no network, reads files only. Recognises tool
 * registrations of known SDK shapes — MCP server `tool(` / `registerTool(`,
 * the `tool({` helper of TypeScript AI SDKs, function-tool schemas
 * (`type: "function"`) and `input_schema` tool schemas, Python `@tool` /
 * `@<server>.tool` decorators, `Dynamic(Structured)Tool` classes, and PHP
 * `#[...Tool]` attributes — and reports per registration:
 *
 *   - `undeclared`        — not in `agents/settings/contexts/agent-actions.yml`
 *   - `subject-argument`  — a write whose input names a subject
 *                           (`account`, `email`, `user_id`, …) the model fills
 *   - `unknown`           — a file with agent-tooling signals but no known shape
 *   - `invalid-inventory` — an inventory entry missing or misusing a field
 *
 * The enforcement belongs in the project's backend (ADR-123); this only finds
 * where to look. Every finding names file:line.
 *
 * Usage:
 *   ./scripts-run src/scripts/agent_actions_detect [--root <dir>] [--inventory <file>] [--json]
 *
 * Exit codes: 0 = no findings, 1 = findings (including `unknown`), 3 = internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

export const INVENTORY_REL = 'agents/settings/contexts/agent-actions.yml';

export const SUBJECT_SOURCES = ['session', 'policy', 'argument'] as const;
export const EFFECTS = ['read', 'write-reversible', 'write-identity', 'write-money', 'external-send'] as const;
export const APPROVALS = ['required', 'none'] as const;

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.php']);
const SKIP_DIRS = new Set([
    'node_modules', 'vendor', '.git', 'dist', 'build', 'out', 'coverage',
    '.venv', 'venv', '__pycache__', '.next', '.nuxt', '.turbo', '.cache',
]);
const MAX_BYTES = 512 * 1024;

const SUBJECT_KEYS = [
    'username', 'user_name', 'userName', 'email', 'e_mail', 'account', 'account_id',
    'accountId', 'user_id', 'userId', 'customer_id', 'customerId', 'customer',
];
const SUBJECT_RE = new RegExp(
    `(?:(?<![\\w.$])["']?(${SUBJECT_KEYS.join('|')})["']?\\s*[:=]|\\$(${SUBJECT_KEYS.join('|')})\\b)`,
    'g',
);
const READ_VERB_RE = /^(?:get|list|search|find|lookup|look_up|read|fetch|show|query|describe|count|check|view)(?:[_A-Z-]|$)/;

export interface Registration {
    name: string;
    file: string;
    line: number;
    shape: string;
    subjectArgs: string[];
    readOnlyHint: boolean;
}

export interface InventoryEntry {
    name: string;
    subject_source?: string | undefined;
    effect?: string | undefined;
    verifier?: string | undefined;
    human_approval?: string | undefined;
    notify_old_channel?: boolean | undefined;
    audit_log?: string | undefined;
    line: number;
}

export interface Finding {
    kind: 'undeclared' | 'subject-argument' | 'unknown' | 'invalid-inventory';
    file: string;
    line: number;
    tool?: string | undefined;
    detail: string;
}

export interface Report {
    root: string;
    inventoryPath: string;
    inventoryFound: boolean;
    inventory: InventoryEntry[];
    registrations: Registration[];
    findings: Finding[];
}

interface Shape {
    id: string;
    re: RegExp;
    name: (m: RegExpExecArray) => string | undefined;
}

const SHAPES: Shape[] = [
    {
        id: 'mcp-server',
        re: /\.(?:registerTool|tool)\s*\(\s*['"`]([A-Za-z0-9_.-]+)['"`]/g,
        name: (m) => m[1],
    },
    {
        id: 'python-decorator',
        re: /^[ \t]*@(?:[\w.]+\.)?tool\b(?:\(\s*(?:name\s*=\s*)?(?:['"]([\w.-]+)['"])?[^)]*\))?[ \t]*\r?\n(?:[ \t]*@[^\n]*\n)*[ \t]*(?:async[ \t]+)?def[ \t]+(\w+)/gm,
        name: (m) => m[1] ?? m[2],
    },
    {
        id: 'ts-tool-helper',
        re: /\b([A-Za-z_$][\w$]*)\s*[:=]\s*tool\s*\(\s*\{/g,
        name: (m) => m[1],
    },
    {
        id: 'function-schema',
        re: /["']?type["']?\s*:\s*["']function["']\s*,\s*(?:["']?function["']?\s*:\s*\{\s*)?["']?name["']?\s*:\s*["']([\w.-]+)["']/g,
        name: (m) => m[1],
    },
    {
        id: 'input-schema',
        re: /["']?name["']?\s*:\s*["']([\w.-]+)["']\s*,(?:(?!["']?name["']?\s*:)[^;]){0,600}?["']?input_?[sS]chema["']?\s*:/g,
        name: (m) => m[1],
    },
    {
        id: 'dynamic-tool-class',
        re: /new\s+Dynamic(?:Structured)?Tool\s*\(\s*\{[\s\S]{0,200}?name\s*:\s*['"`]([\w.-]+)['"`]/g,
        name: (m) => m[1],
    },
    {
        id: 'php-attribute',
        re: /#\[\s*(?:\\?\w+\\)*\w*Tool\b(\([^\]]*\))?\s*\][\s\S]{0,300}?function\s+(\w+)/g,
        name: (m) => {
            const args = m[1] ?? '';
            const named = /name\s*:\s*['"]([\w.-]+)['"]/.exec(args);
            const first = /['"]([\w.-]+)['"]/.exec(args);
            return named?.[1] ?? first?.[1] ?? m[2];
        },
    },
];

const AGENT_TOKENS = new Set(['agent', 'agents', 'mcp', 'llm', 'tool', 'tools', 'ai', 'bot', 'bots', 'assistant']);
const STRONG_SIGNAL_RE = /\b(?:tool_choice|tool_calls?|function_call|input_schema|inputSchema)\b|\btools\s*[:=]\s*\[/;
const CALL_SIGNAL_RE = /\b\w*(?:Tool|Action|tool|action)\w*\s*\(/;

function lineOf(text: string, index: number): number {
    let n = 1;
    for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
    return n;
}

function importedModules(text: string): string[] {
    const out: string[] = [];
    for (const m of text.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"]/g)) {
        out.push((m[1] ?? m[2] ?? m[3]) as string);
    }
    for (const m of text.matchAll(/^[ \t]*(?:from[ \t]+([\w.]+)[ \t]+import|import[ \t]+([\w.]+))/gm)) {
        out.push((m[1] ?? m[2]) as string);
    }
    for (const m of text.matchAll(/^[ \t]*use[ \t]+([\w\\]+)/gm)) out.push(m[1] as string);
    return out.filter((s) => !s.startsWith('.'));
}

function hasAgentSignal(text: string): boolean {
    if (STRONG_SIGNAL_RE.test(text)) return true;
    const agentImport = importedModules(text).some((spec) =>
        spec.toLowerCase().split(/[/@._\\-]+/).some((t) => AGENT_TOKENS.has(t)));
    return agentImport && CALL_SIGNAL_RE.test(text);
}

function walk(root: string, dir: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (!SKIP_DIRS.has(e.name)) walk(root, abs, out);
        } else if (e.isFile() && CODE_EXT.has(path.extname(e.name))) {
            out.push(abs);
        }
    }
}

export function scanFile(rel: string, text: string): { registrations: Registration[]; unknownLine: number | null } {
    const found: { index: number; end: number; name: string; shape: string }[] = [];
    for (const shape of SHAPES) {
        shape.re.lastIndex = 0;
        for (const m of text.matchAll(shape.re)) {
            const name = shape.name(m);
            if (name === undefined || m.index === undefined) continue;
            // `@server.tool("x")` matches two shapes on one line; one registration.
            const line = lineOf(text, m.index);
            if (found.some((f) => f.name === name && lineOf(text, f.index) === line)) continue;
            found.push({ index: m.index, end: m.index + m[0].length, name, shape: shape.id });
        }
    }
    found.sort((a, b) => a.index - b.index);
    const registrations = found.map((f, i) => {
        const next = found[i + 1]?.index ?? text.length;
        const window = text.slice(f.index, Math.min(next, f.index + 1500));
        const subjectArgs = new Set<string>();
        SUBJECT_RE.lastIndex = 0;
        for (const m of window.matchAll(SUBJECT_RE)) subjectArgs.add((m[1] ?? m[2]) as string);
        return {
            name: f.name,
            file: rel,
            line: lineOf(text, f.index),
            shape: f.shape,
            subjectArgs: [...subjectArgs],
            readOnlyHint: /readOnlyHint\s*:\s*true|read_only_hint\s*=\s*True/.test(window),
        };
    });
    let unknownLine: number | null = null;
    if (registrations.length === 0 && hasAgentSignal(text)) {
        const strong = STRONG_SIGNAL_RE.exec(text);
        const call = CALL_SIGNAL_RE.exec(text);
        unknownLine = lineOf(text, strong?.index ?? call?.index ?? 0);
    }
    return { registrations, unknownLine };
}

export function parseInventory(text: string, rel: string): { entries: InventoryEntry[]; findings: Finding[] } {
    const findings: Finding[] = [];
    const entries: InventoryEntry[] = [];
    let doc: unknown;
    try {
        doc = parseYaml(text);
    } catch (e) {
        findings.push({ kind: 'invalid-inventory', file: rel, line: 1, detail: `not valid YAML: ${(e as Error).message}` });
        return { entries, findings };
    }
    const actions = (doc as { actions?: unknown } | null)?.actions;
    if (!Array.isArray(actions)) {
        findings.push({ kind: 'invalid-inventory', file: rel, line: 1, detail: 'no `actions:` list' });
        return { entries, findings };
    }
    const lines = text.split('\n');
    for (const raw of actions) {
        const e = (raw ?? {}) as Record<string, unknown>;
        const name = typeof e['name'] === 'string' ? e['name'] : '';
        const idx = lines.findIndex((l) => new RegExp(`^\\s*-?\\s*name:\\s*["']?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']?\\s*$`).test(l));
        const line = name !== '' && idx >= 0 ? idx + 1 : 1;
        const problems: string[] = [];
        if (name === '') problems.push('`name` is missing');
        const oneOf = (key: string, allowed: readonly string[]): void => {
            const v = e[key];
            if (typeof v !== 'string' || !allowed.includes(v)) problems.push(`\`${key}\` must be one of ${allowed.join(' | ')}`);
        };
        oneOf('subject_source', SUBJECT_SOURCES);
        oneOf('effect', EFFECTS);
        oneOf('human_approval', APPROVALS);
        for (const key of ['verifier', 'audit_log']) {
            if (typeof e[key] !== 'string' || (e[key] as string).trim() === '') problems.push(`\`${key}\` must name the check or the log`);
        }
        if (typeof e['notify_old_channel'] !== 'boolean') problems.push('`notify_old_channel` must be true or false');
        if (e['subject_source'] === 'argument' && typeof e['effect'] === 'string' && e['effect'] !== 'read') {
            problems.push('`subject_source: argument` is allowed for `effect: read` only — the subject of a write comes from the authenticated principal');
        }
        for (const p of problems) findings.push({ kind: 'invalid-inventory', file: rel, line, tool: name || undefined, detail: p });
        entries.push({
            name,
            subject_source: e['subject_source'] as string | undefined,
            effect: e['effect'] as string | undefined,
            verifier: e['verifier'] as string | undefined,
            human_approval: e['human_approval'] as string | undefined,
            notify_old_channel: e['notify_old_channel'] as boolean | undefined,
            audit_log: e['audit_log'] as string | undefined,
            line,
        });
    }
    return { entries, findings };
}

function isWrite(reg: Registration, declared: InventoryEntry | undefined): boolean {
    if (declared?.effect !== undefined && (EFFECTS as readonly string[]).includes(declared.effect)) {
        return declared.effect !== 'read';
    }
    if (reg.readOnlyHint) return false;
    return !READ_VERB_RE.test(reg.name);
}

export function detect(opts: { root: string; inventoryPath?: string | undefined }): Report {
    const root = path.resolve(opts.root);
    const inventoryPath = path.resolve(opts.inventoryPath ?? path.join(root, INVENTORY_REL));
    const invRel = path.relative(root, inventoryPath).split(path.sep).join('/') || INVENTORY_REL;
    const findings: Finding[] = [];
    let inventory: InventoryEntry[] = [];
    const inventoryFound = fs.existsSync(inventoryPath);
    if (inventoryFound) {
        const parsed = parseInventory(fs.readFileSync(inventoryPath, 'utf8'), invRel);
        inventory = parsed.entries;
        findings.push(...parsed.findings);
    }
    const byName = new Map(inventory.map((e) => [e.name, e]));

    const files: string[] = [];
    walk(root, root, files);
    const registrations: Registration[] = [];
    for (const abs of files) {
        let text: string;
        try {
            if (fs.statSync(abs).size > MAX_BYTES) continue;
            text = fs.readFileSync(abs, 'utf8');
        } catch {
            continue;
        }
        const rel = path.relative(root, abs).split(path.sep).join('/');
        const { registrations: regs, unknownLine } = scanFile(rel, text);
        registrations.push(...regs);
        if (unknownLine !== null) {
            findings.push({
                kind: 'unknown',
                file: rel,
                line: unknownLine,
                detail: 'agent tooling signals, but no tool registration shape this detector knows — read it by hand; this is not clean',
            });
        }
    }

    for (const reg of registrations) {
        const declared = byName.get(reg.name);
        if (declared === undefined) {
            findings.push({
                kind: 'undeclared',
                file: reg.file,
                line: reg.line,
                tool: reg.name,
                detail: `${reg.shape} registration not declared in ${INVENTORY_REL}`,
            });
        }
        if (reg.subjectArgs.length > 0 && isWrite(reg, declared)) {
            findings.push({
                kind: 'subject-argument',
                file: reg.file,
                line: reg.line,
                tool: reg.name,
                detail: `write tool takes ${reg.subjectArgs.map((a) => `\`${a}\``).join(', ')} — a model-filled argument must never select whose record changes; take the subject from the authenticated principal`,
            });
        }
    }
    return { root, inventoryPath, inventoryFound, inventory, registrations, findings };
}

export function render(r: Report): string {
    const out: string[] = [];
    out.push(`agent actions: ${r.registrations.length} registration(s), ${r.inventory.length} declared, ${r.findings.length} finding(s)`);
    if (!r.inventoryFound) out.push(`inventory: missing — ${INVENTORY_REL} (every registration counts as undeclared)`);
    for (const f of r.findings) {
        out.push(`  ${f.kind.padEnd(18)} ${f.file}:${f.line}${f.tool ? `  ${f.tool}` : ''}  — ${f.detail}`);
    }
    if (r.findings.length === 0) {
        out.push(r.registrations.length === 0
            ? 'no agent tool registrations recognised and no unrecognised agent tooling found'
            : 'every recognised registration is declared; none takes a subject argument on a write');
    }
    return `${out.join('\n')}\n`;
}

function argValue(argv: readonly string[], name: string): string | undefined {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

export function main(argv: readonly string[]): number {
    try {
        const r = detect({ root: argValue(argv, 'root') ?? process.cwd(), inventoryPath: argValue(argv, 'inventory') });
        process.stdout.write(argv.includes('--json') ? `${JSON.stringify(r, null, 2)}\n` : render(r));
        return r.findings.length > 0 ? 1 : 0;
    } catch (e) {
        process.stderr.write(`agent_actions_detect: ${(e as Error).message}\n`);
        return 3;
    }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
