#!/usr/bin/env tsx
/**
 * `consumer_tool_catalog.json` generator — Phase 3 of road-to-credible-install
 * (MCP hygiene: generated truth, honest stubs).
 *
 * The catalog used to be hand-maintained: every tool's name / description /
 * input_schema had to be kept in sync BY HAND across the JSON file AND its
 * real handler registration in `mcp_server/tools.ts`. This script derives
 * the JSON from the actual registries instead of a third hand-edited copy:
 *
 *   - implemented tools — `ALLOWLIST` in `mcp_server/tools.ts`. Name,
 *     description, input_schema, and side_effect all come straight off the
 *     handler registration.
 *   - stub-only tools    — `STUB_TOOLS` in `mcp_server/tool_catalog_source.ts`.
 *     Catalog-listed discovery placeholders with no wired handler.
 *
 * Every stub entry's description is prefixed with the literal marker
 * `[stub — implemented on demand] ` so a client can tell a discovery
 * placeholder from a real tool without cross-checking `implemented_on`.
 * Every implemented entry additionally carries an `annotations.readOnlyHint`
 * derived from its `side_effect`.
 *
 * CLI contract (same `--write` / `--strict` shape as
 * `build_discovery_manifest.ts`):
 *   --write   regenerate and persist the catalog deterministically (tools
 *             sorted by name, stable key order, 2-space indent).
 *   --strict  quality gate on the freshly-built content (no duplicate name
 *             across the two registries, non-empty tool list); when NOT
 *             combined with --write, ALSO diffs the fresh content against
 *             the committed file and fails on any drift — the CI gate that
 *             catches a hand-edit or a registry change nobody regenerated
 *             the catalog for.
 *   --quiet   suppress the stdout summary line.
 * Bare invocation (no flags) prints the freshly-built JSON to stdout,
 * mirroring `build_discovery_manifest.ts`'s non-write default.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ALLOWLIST, type ToolSideEffect } from './mcp_server/tools.js';
import { CATALOG_DESCRIPTION, STUB_TOOLS } from './mcp_server/tool_catalog_source.js';

const _HERE = fileURLToPath(import.meta.url);
const _PROG = 'build_mcp_catalog';

// src/scripts/build_mcp_catalog.ts → repo root is two dirs up.
const _DEFAULT_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

interface ModuleConfig {
    ROOT: string;
    CATALOG_PATH: string;
    PACKAGE_JSON: string;
}

function _deriveConfig(root: string): ModuleConfig {
    return {
        ROOT: root,
        CATALOG_PATH: path.join(root, 'src', 'scripts', 'mcp_server', 'consumer_tool_catalog.json'),
        PACKAGE_JSON: path.join(root, 'package.json'),
    };
}

const _config: ModuleConfig = _deriveConfig(_DEFAULT_ROOT);

/** Test seam — mirrors `build_discovery_manifest.ts`'s `_setConfigForTest`. */
export function _setConfigForTest(overrides: Partial<ModuleConfig>): void {
    Object.assign(_config, overrides);
}

export function _getConfigForTest(): ModuleConfig {
    return { ..._config };
}

export const ROOT = (): string => _config.ROOT;
export const CATALOG_PATH = (): string => _config.CATALOG_PATH;

/** Literal marker every stub-only description starts with. */
export const STUB_MARKER = '[stub — implemented on demand] ';

interface CatalogEntryOut {
    name: string;
    description: string;
    side_effect: ToolSideEffect;
    implemented_on: string[];
    input_schema: Record<string, unknown>;
    annotations?: { readOnlyHint: boolean };
}

function _packageName(): string {
    try {
        const pkg = JSON.parse(fs.readFileSync(_config.PACKAGE_JSON, 'utf-8')) as { name?: unknown };
        return typeof pkg.name === 'string' && pkg.name !== '' ? pkg.name : '@event4u/agent-config';
    } catch {
        return '@event4u/agent-config';
    }
}

/** Mirror Python `str.__lt__` (code-point ordering — matches ASCII tool names). */
function _cmpStr(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/** Build the deterministic, name-sorted tool-entry list. Throws on a name collision. */
export function _buildEntries(): CatalogEntryOut[] {
    const seen = new Set<string>();
    const entries: CatalogEntryOut[] = [];

    for (const tool of Object.values(ALLOWLIST)) {
        if (seen.has(tool.name)) {
            throw new Error(`build_mcp_catalog: duplicate tool name in ALLOWLIST: ${tool.name}`);
        }
        seen.add(tool.name);
        entries.push({
            name: tool.name,
            description: tool.description,
            side_effect: tool.side_effect,
            implemented_on: ['stdio'],
            input_schema: tool.input_schema,
            annotations: { readOnlyHint: tool.side_effect === 'ro' },
        });
    }

    for (const stub of STUB_TOOLS) {
        if (seen.has(stub.name)) {
            throw new Error(
                `build_mcp_catalog: '${stub.name}' is registered both in ALLOWLIST ` +
                    'and STUB_TOOLS — a tool is implemented or a stub, never both.',
            );
        }
        seen.add(stub.name);
        entries.push({
            name: stub.name,
            description: STUB_MARKER + stub.description,
            side_effect: stub.side_effect,
            implemented_on: [],
            // A stub ships an EMPTY schema on purpose. `input_schema` exists to
            // tell a client how to CALL the tool, and no transport permits that
            // for a stub: the Worker answers with the not_implemented envelope
            // and stdio never registers it (`REGISTRY` in mcp_server/tools.ts).
            // A populated schema is therefore always-loaded context that can
            // never be acted on — 665 GPT tok across the 12 stubs, measured
            // 2026-08-02. `stub.input_schema` stays in STUB_TOOLS as the design
            // record for the day the tool is wired; it is simply not shipped
            // until then. The stub-envelope contract's "byte-identical apart
            // from implemented_on" promise still holds — both transports read
            // this same file.
            input_schema: {},
        });
    }

    entries.sort((a, b) => _cmpStr(a.name, b.name));
    return entries;
}

/** Build the full catalog document (unserialized). */
export function _buildCatalog(): Record<string, unknown> {
    const entries = _buildEntries();
    if (entries.length === 0) {
        throw new Error('build_mcp_catalog: computed zero tool entries — refusing an empty catalog');
    }
    return {
        schema_version: 1,
        description: CATALOG_DESCRIPTION,
        install_hint_stdio: `npx -y ${_packageName()} mcp-server`,
        tools: entries,
    };
}

/** Deterministic JSON: 2-space indent, trailing newline. Key order = insertion order above. */
export function _serialize(catalog: Record<string, unknown>): string {
    return JSON.stringify(catalog, null, 2) + '\n';
}

/** Freshly-computed catalog file content — the single function both --write and --strict trust. */
export function _computeFreshContent(): string {
    return _serialize(_buildCatalog());
}

function _relativeToRoot(p: string): string {
    return path.relative(_config.ROOT, p).split(path.sep).join('/');
}

interface ParsedArgs {
    write: boolean;
    strict: boolean;
    quiet: boolean;
}

function _argError(msg: string): never {
    process.stderr.write(`usage: ${_PROG} [-h] [--write] [--strict] [--quiet]\n`);
    process.stderr.write(`${_PROG}: error: ${msg}\n`);
    process.exit(2);
}

export function parse_args(argv: readonly string[]): ParsedArgs {
    const out: ParsedArgs = { write: false, strict: false, quiet: false };
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(`usage: ${_PROG} [-h] [--write] [--strict] [--quiet]\n`);
            process.exit(0);
        } else if (a === '--write') {
            out.write = true;
        } else if (a === '--strict') {
            out.strict = true;
        } else if (a === '--quiet') {
            out.quiet = true;
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

export function main(argv: readonly string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    let fresh: string;
    try {
        fresh = _computeFreshContent();
    } catch (exc) {
        process.stderr.write(`${_PROG}: ${(exc as Error).message}\n`);
        return 1;
    }

    if (args.write) {
        fs.mkdirSync(path.dirname(_config.CATALOG_PATH), { recursive: true });
        fs.writeFileSync(_config.CATALOG_PATH, fresh, 'utf-8');
        if (!args.quiet) {
            const toolCount = (JSON.parse(fresh) as { tools: unknown[] }).tools.length;
            process.stdout.write(
                `wrote ${_relativeToRoot(_config.CATALOG_PATH)} (${toolCount} tool(s))\n`,
            );
        }
        return 0;
    }

    if (args.strict) {
        let onDisk: string | null;
        try {
            onDisk = fs.readFileSync(_config.CATALOG_PATH, 'utf-8');
        } catch {
            onDisk = null;
        }
        if (onDisk !== fresh) {
            process.stderr.write(
                `❌ ${_relativeToRoot(_config.CATALOG_PATH)} has drifted from the tool registry ` +
                    '(ALLOWLIST in mcp_server/tools.ts + STUB_TOOLS in ' +
                    'mcp_server/tool_catalog_source.ts).\n',
            );
            process.stderr.write(`   Run: ./scripts-run src/scripts/${_PROG} --write\n`);
            return 1;
        }
        if (!args.quiet) {
            process.stdout.write(`${_relativeToRoot(_config.CATALOG_PATH)} is in sync with the tool registry\n`);
        }
        return 0;
    }

    // Bare invocation: print the freshly-built JSON to stdout (dry compute,
    // no write) — mirrors build_discovery_manifest.ts's non-write default.
    process.stdout.write(fresh);
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
