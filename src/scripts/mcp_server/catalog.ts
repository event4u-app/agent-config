// Consumer tool catalog — source of truth for Phase 1 discovery stubs.
//
// Loaded once at module import from `consumer_tool_catalog.json`. Both
// the stdio server (`tools.py`) and the cloud pack
// (`scripts/pack_mcp_content.py`) read from this file so the manifest
// returned by `tools/list` on either transport is byte-identical apart
// from per-tool `implemented_on` metadata.
//
// Side-effect classification (`ro` / `fs-write` / `shell`) and the
// `not_implemented` envelope contract live in
// `docs/contracts/mcp-tool-stub-envelope.md`.
//
// TS twin of catalog.py (py2ts Phase 8). Mirrors the full public surface:
//   - NOT_IMPLEMENTED_CODE, CatalogEntry, load_catalog, load_raw,
//     install_hint, not_implemented_envelope.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const _CATALOG_FILE = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'consumer_tool_catalog.json',
);

// Stable error code surfaced in the `not_implemented` envelope. The
// Worker mirrors this string verbatim — keep them in sync via the
// envelope contract.
export const NOT_IMPLEMENTED_CODE = 'not_implemented';

/**
 * One row in `consumer_tool_catalog.json`.
 *
 * `implemented_on` lists transports where a real handler is wired
 * (`stdio` / `worker`); missing transports return the
 * `not_implemented` envelope.
 *
 * Mirrors the Python frozen dataclass `CatalogEntry` (field order
 * preserved). `implemented_on` is a tuple in Python; a readonly array
 * here, populated in file order.
 */
export interface CatalogEntry {
    readonly name: string;
    readonly description: string;
    readonly side_effect: string;
    readonly implemented_on: readonly string[];
    readonly input_schema: Record<string, unknown>;
}

/** Refuse to boot on a malformed catalog. Boot-time errors only. */
function _validate(raw: Record<string, unknown>): void {
    if (raw.schema_version !== 1) {
        throw new Error(
            `catalog: unsupported schema_version=` +
                `${_pyRepr(raw.schema_version)}; expected 1`,
        );
    }
    const tools = raw.tools;
    if (!Array.isArray(tools) || tools.length === 0) {
        throw new Error("catalog: 'tools' must be a non-empty list");
    }
    const seen = new Set<string>();
    for (const entry of tools) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new Error('catalog: every tool entry must be an object');
        }
        const e = entry as Record<string, unknown>;
        for (const field of ['name', 'description', 'side_effect', 'input_schema']) {
            if (!(field in e)) {
                throw new Error(`catalog: tool missing '${field}'`);
            }
        }
        if (
            e.side_effect !== 'ro' &&
            e.side_effect !== 'fs-write' &&
            e.side_effect !== 'shell'
        ) {
            throw new Error(
                `catalog: tool ${_pyRepr(e.name)} has invalid side_effect ` +
                    `${_pyRepr(e.side_effect)} (expected ro / fs-write / shell)`,
            );
        }
        const name = e.name as string;
        if (seen.has(name)) {
            throw new Error(`catalog: duplicate tool name ${_pyRepr(name)}`);
        }
        seen.add(name);
    }
}

/** Mirror Python `repr()` for the small set of values that reach error text. */
function _pyRepr(value: unknown): string {
    if (typeof value === 'string') {
        return `'${value}'`;
    }
    if (value === null || value === undefined) {
        return 'None';
    }
    return String(value);
}

/** Parse and validate the catalog. Returns entries in file order. */
export function load_catalog(targetPath?: string): CatalogEntry[] {
    const target = targetPath ?? _CATALOG_FILE;
    const raw = JSON.parse(fs.readFileSync(target, 'utf-8')) as Record<string, unknown>;
    _validate(raw);
    const tools = raw.tools as Record<string, unknown>[];
    return tools.map((t) => ({
        name: t.name as string,
        description: t.description as string,
        side_effect: t.side_effect as string,
        implemented_on: [...((t.implemented_on as unknown[] | null | undefined) ?? [])].map(
            (v) => v as string,
        ),
        input_schema: t.input_schema as Record<string, unknown>,
    }));
}

/** Return the raw parsed JSON. Used by the cloud packer. */
export function load_raw(targetPath?: string): Record<string, unknown> {
    const target = targetPath ?? _CATALOG_FILE;
    const raw = JSON.parse(fs.readFileSync(target, 'utf-8')) as Record<string, unknown>;
    _validate(raw);
    return raw;
}

/** Stable install-hint surfaced in the envelope. */
export function install_hint(raw?: Record<string, unknown>): string {
    const data = raw !== undefined ? raw : load_raw();
    return String(data.install_hint_stdio ?? '');
}

/**
 * Wire-shape error envelope used when a stub is invoked.
 *
 * Mirrored verbatim by the Cloud Worker (`internal/workers/mcp/src/stubs.ts`).
 */
export function not_implemented_envelope(
    tool_name: string,
    options: { transport: string; install_hint_value: string },
): Record<string, unknown> {
    const { transport, install_hint_value } = options;
    return {
        code: NOT_IMPLEMENTED_CODE,
        tool: tool_name,
        transport,
        install_hint: install_hint_value,
        alternative: 'stdio',
        message:
            `Tool '${tool_name}' is in the discovery catalog but not ` +
            `implemented on the ${transport} transport. See the install ` +
            'hint to wire it up locally, or check ' +
            'docs/contracts/mcp-tool-stub-envelope.md.',
    };
}
