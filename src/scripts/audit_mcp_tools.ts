#!/usr/bin/env tsx
/**
 * MCP-tool inventory generator.
 *
 * Ported from the retired Python `src/scripts/audit_mcp_tools.py` (ADR-200 — Python→TS
 * migration, Phase 8 / Wave 8b). The CLI contract is pinned —
 * the mutually-exclusive `--check` / `--write` flags, `--quiet`, exit codes
 * (0 ok / in-sync · 1 drift), the stdout/stderr split, byte-identical
 * messages, and byte-identical written file content.
 *
 * Reads the source-of-truth catalog at
 * `src/scripts/mcp_server/consumer_tool_catalog.json` and the handler
 * registry at `src/scripts/mcp_server/tools.ts`, emits
 * `docs/contracts/mcp-tool-inventory.md` with every tool cited by
 * `<file>:<line>`.
 *
 * Historical quirks are preserved deliberately — tests and downstream consumers pin the exact behaviour.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);

// audit_mcp_tools → parent.parent.parent of the .py file = repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const CATALOG = path.join(ROOT, 'src/scripts/mcp_server/consumer_tool_catalog.json');
export const TOOLS_TS = path.join(ROOT, 'src/scripts/mcp_server/tools.ts');
export const OUT = path.join(ROOT, 'docs/contracts/mcp-tool-inventory.md');

// Match `<name>: {` entries at 4-space indent inside the TS ALLOWLIST record
// (deeper keys like `input_schema: {` sit at 8+ spaces and never match).
const HANDLER_RE = /^ {4}([a-z_]+): \{$/;
// Match `"name": "<name>",` in the catalog json (for catalog citations).
const CATALOG_NAME_RE = /^\s*"name"\s*:\s*"([a-z_]+)"\s*,?\s*$/;

interface Tool {
    name: string;
    side_effect: string;
    implemented_on: string[];
}

interface Catalog {
    tools: Tool[];
}

/** Mirror Python `str.splitlines()` for the file-line iteration here. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
     
    const BOUNDARY = /\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/g;
    const out: string[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = BOUNDARY.exec(text)) !== null) {
        out.push(text.slice(last, m.index));
        last = m.index + m[0].length;
    }
    if (last < text.length) {
        out.push(text.slice(last));
    }
    return out;
}

function _relativeToRoot(p: string): string {
    return path.relative(ROOT, p).split(path.sep).join('/');
}

function _index_handlers(): Map<string, number> {
    const out = new Map<string, number>();
    const lines = _splitlines(fs.readFileSync(TOOLS_TS, 'utf-8'));
    // Only index entries inside the `export const ALLOWLIST` block.
    let inAllowlist = false;
    for (let idx = 0; idx < lines.length; idx += 1) {
        const i = idx + 1;
        const line = lines[idx] as string;
        if (line.startsWith('export const ALLOWLIST')) {
            inAllowlist = true;
            continue;
        }
        if (inAllowlist && line.startsWith('};')) {
            inAllowlist = false;
            continue;
        }
        if (!inAllowlist) {
            continue;
        }
        const m = HANDLER_RE.exec(line);
        if (m) {
            out.set(m[1] as string, i);
        }
    }
    return out;
}

function _index_catalog_lines(): Map<string, number> {
    const out = new Map<string, number>();
    const lines = _splitlines(fs.readFileSync(CATALOG, 'utf-8'));
    for (let idx = 0; idx < lines.length; idx += 1) {
        const i = idx + 1;
        const m = CATALOG_NAME_RE.exec(lines[idx] as string);
        if (m && !out.has(m[1] as string)) {
            out.set(m[1] as string, i);
        }
    }
    return out;
}

/** `", ".join(f"{k}={v}" for k, v in sorted(obj.items()))`. */
function _joinSorted(obj: Map<string, number>): string {
    const keys = [...obj.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return keys.map((k) => `${k}=${obj.get(k)}`).join(', ');
}

function _render(catalog: Catalog, handlers: Map<string, number>, cat_lines: Map<string, number>): string {
    const tools = catalog.tools;
    const total = tools.length;
    const by_transport = new Map<string, number>();
    const by_side_effect = new Map<string, number>();
    for (const t of tools) {
        for (const tr of t.implemented_on) {
            by_transport.set(tr, (by_transport.get(tr) ?? 0) + 1);
        }
        by_side_effect.set(t.side_effect, (by_side_effect.get(t.side_effect) ?? 0) + 1);
    }
    let stub_count = 0;
    for (const t of tools) {
        if (t.implemented_on.length === 0) {
            stub_count += 1;
        }
    }
    const transport_summary = _joinSorted(by_transport) || 'none';
    const side_effect_summary = _joinSorted(by_side_effect);

    const lines: string[] = [];
    lines.push('---');
    lines.push('stability: beta');
    lines.push('keep-beta-until: 2026-08-14');
    lines.push('---');
    lines.push('');
    lines.push('# MCP tool inventory');
    lines.push('');
    lines.push('> Generated by [`audit_mcp_tools`](../../audit_mcp_tools)');
    lines.push('> from the source-of-truth catalog');
    lines.push('> [`src/scripts/mcp_server/consumer_tool_catalog.json`](../../src/scripts/mcp_server/consumer_tool_catalog.json).');
    lines.push('> Do **not** hand-edit; rerun `./scripts-run src/scripts/audit_mcp_tools --write`.');
    lines.push('>');
    lines.push('> Step-11 Phase 5 Step 3 (an internal parity roadmap (local-only)).');
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total tools:** ${total}`);
    lines.push(`- **By transport:** ${transport_summary}`);
    lines.push(`- **By side-effect:** ${side_effect_summary}`);
    lines.push(`- **Discovery-only stubs (no implementation):** ${stub_count}`);
    lines.push('');
    lines.push('## Tools');
    lines.push('');
    lines.push('| Tool | Side-effect | Transports | Catalog | Handler |');
    lines.push('|---|---|---|---|---|');
    for (const t of tools) {
        const name = t.name;
        const side = t.side_effect;
        const transports = t.implemented_on.length > 0 ? t.implemented_on.join(', ') : '_(stub)_';
        const cat_line = cat_lines.get(name);
        const cat_cite =
            cat_line !== undefined
                ? `[\`consumer_tool_catalog.json:${cat_line}\`](../../src/scripts/mcp_server/consumer_tool_catalog.json#L${cat_line})`
                : '_missing_';
        const h_line = handlers.get(name);
        const h_cite =
            h_line !== undefined
                ? `[\`tools.ts:${h_line}\`](../../src/scripts/mcp_server/tools.ts#L${h_line})`
                : '_stub-only_';
        lines.push(`| \`${name}\` | \`${side}\` | ${transports} | ${cat_cite} | ${h_cite} |`);
    }
    lines.push('');
    lines.push('## Glossary');
    lines.push('');
    lines.push('- **Side-effect** — `ro` (read-only) · `fs-write` (filesystem write) · `shell` (spawns processes).');
    lines.push('- **Transports** — `stdio` (`scripts/mcp_server/`) · `worker` (`internal/workers/mcp/`). A tool may live on both.');
    lines.push('- **Stub** — catalog-listed for discovery; returns the `not_implemented` envelope from');
    lines.push('  [`mcp-tool-stub-envelope.md`](mcp-tool-stub-envelope.md) until promoted.');
    lines.push('');
    return lines.join('\n') + '\n';
}

interface ParsedArgs {
    check: boolean;
    write: boolean;
    quiet: boolean;
}

function _argError(msg: string): never {
    process.stderr.write('usage: audit_mcp_tools [-h] [--check | --write] [--quiet]\n');
    process.stderr.write(`audit_mcp_tools: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { check: false, write: false, quiet: false };
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write('usage: audit_mcp_tools [-h] [--check | --write] [--quiet]\n');
            process.exit(0);
        } else if (a === '--check') {
            if (out.write) {
                _argError('argument --check: not allowed with argument --write');
            }
            out.check = true;
        } else if (a === '--write') {
            if (out.check) {
                _argError('argument --write: not allowed with argument --check');
            }
            out.write = true;
        } else if (a === '--quiet') {
            out.quiet = true;
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    // This generator walks no tree — it reads two named sources, and
    // `_index_handlers` / `_index_catalog_lines` swallow a read failure as an
    // empty index, so a moved `tools.ts` renders every tool `_stub-only_`
    // rather than reporting that half the input vanished.
    try {
        assertWatchlistResolves({
            gate: 'audit_mcp_tools',
            candidates: [
                path.posix.join('src', 'scripts', 'mcp_server', 'consumer_tool_catalog.json'),
                path.posix.join('src', 'scripts', 'mcp_server', 'tools.ts'),
            ],
            repoRoot: ROOT,
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            // 2 (the usage / could-not-run code) over 1, which this CLI
            // documents as "the inventory drifted from the generator".
            process.stderr.write(`❌ ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf-8')) as Catalog;
    const handlers = _index_handlers();
    const cat_lines = _index_catalog_lines();
    const rendered = _render(catalog, handlers, cat_lines);

    if (args.check) {
        let on_disk = '';
        try {
            on_disk = fs.readFileSync(OUT, 'utf-8');
        } catch {
            on_disk = '';
        }
        if (on_disk !== rendered) {
            process.stderr.write(`❌ ${_relativeToRoot(OUT)} drifted from generator.\n`);
            process.stderr.write('   Run: ./scripts-run src/scripts/audit_mcp_tools --write\n');
            return 1;
        }
        if (!args.quiet) {
            process.stdout.write(`BASELINE: ${_relativeToRoot(OUT)} is in sync · ${catalog.tools.length} tool(s)\n`);
        }
        return 0;
    }

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, rendered, 'utf-8');
    if (!args.quiet) {
        process.stdout.write(`✅ wrote ${_relativeToRoot(OUT)} · ${catalog.tools.length} tool(s)\n`);
    }
    return 0;
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

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
