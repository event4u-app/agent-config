#!/usr/bin/env tsx
/**
 * Build `dist/mcp/registry-manifest.json` + the two rendered payloads.
 *
 * TypeScript twin of `src/scripts/build_mcp_registry_manifest.py` (ADR-092,
 * Phase 5). The CLI contract is mirrored EXACTLY — every flag (`--write`,
 * `--strict`, `--quiet`), exit codes (0 = ok; 2 = `--strict` drift without
 * `--write`; 1 = missing discovery prereq via SystemExit), the stdout/stderr
 * split, byte-identical messages, AND byte-identical generated output:
 * `registry-manifest.json` (`json.dumps(indent=2, sort_keys=True,
 * ensure_ascii=True)`), the single Markdown row, and the Cloudflare JSON entry.
 *
 * Reads three on-disk sources: `package.json`, `.github/topics.yml`,
 * `internal/workers/mcp/content.json`, and the HARD prereq
 * `dist/discovery/discovery-manifest.json`. Lifecycle state on each registry
 * (`status`, `submitted_at`, `pr_url`, `last_verified`) is preserved from the
 * previous manifest.
 *
 * No behaviour changes — latent Python quirks replicated.
 *
 * Schema: `docs/contracts/mcp-registry-manifest.schema.json`
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

type Json = unknown;
type JsonObject = Record<string, Json>;

const _HERE = fileURLToPath(import.meta.url);
// _HERE === <repo>/src/scripts/build_mcp_registry_manifest.ts ; the Python
// original derives ROOT = <file>.parents[2] — two dirs up from src/scripts.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// Path config is a mutable seam so tests can point the builder at a fixture
// tree (mirrors the Python tests' monkeypatch of module-level path constants).
interface PathConfig {
    PKG_FILE: string;
    TOPICS_FILE: string;
    CONTENT_FILE: string;
    DISCOVERY_FILE: string;
    OUT_DIR: string;
    OUT_MANIFEST: string;
    OUT_ROW_MD: string;
    OUT_CF_JSON: string;
}

function _deriveConfig(root: string): PathConfig {
    const outDir = path.join(root, 'dist', 'mcp');
    return {
        PKG_FILE: path.join(root, 'package.json'),
        TOPICS_FILE: path.join(root, '.github', 'topics.yml'),
        CONTENT_FILE: path.join(root, 'internal', 'workers', 'mcp', 'content.json'),
        DISCOVERY_FILE: path.join(root, 'dist', 'discovery', 'discovery-manifest.json'),
        OUT_DIR: outDir,
        OUT_MANIFEST: path.join(outDir, 'registry-manifest.json'),
        OUT_ROW_MD: path.join(outDir, 'awesome-mcp-servers.row.md'),
        OUT_CF_JSON: path.join(outDir, 'mcp-cloudflare-catalogue.json'),
    };
}

const _config: PathConfig = _deriveConfig(ROOT);

/**
 * Test seam mirroring the Python tests' monkeypatch of module-level path
 * constants. Pass a `root`; all paths are re-derived from it.
 */
export function _setRootForTest(root: string): void {
    Object.assign(_config, _deriveConfig(root));
}

const REGISTRIES_SEED: ReadonlyArray<JsonObject> = [
    {
        id: 'awesome-mcp-servers',
        label: 'punkpeye/awesome-mcp-servers',
        listing_format: 'markdown-row',
        submission_url: 'https://github.com/punkpeye/awesome-mcp-servers',
        rendered_payload: 'dist/mcp/awesome-mcp-servers.row.md',
    },
    {
        id: 'mcp-cloudflare-catalogue',
        label: 'Cloudflare MCP catalogue',
        listing_format: 'json-entry',
        submission_url: 'https://github.com/cloudflare/mcp-server-cloudflare',
        rendered_payload: 'dist/mcp/mcp-cloudflare-catalogue.json',
    },
];

/** Raised to mirror `sys.exit("ERROR: …")` — message to stderr, exit 1. */
export class ExitError extends Error {}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _repo_url(pkg: JsonObject): string {
    const repo = (pkg['repository'] as JsonObject | undefined) ?? {};
    const raw = (repo['url'] as string | undefined) ?? '';
    return raw.replace(/^git\+/, '').replace(/\.git$/, '');
}

function _build(nowUtcYmd: string): JsonObject {
    const pkg = JSON.parse(fs.readFileSync(_config.PKG_FILE, 'utf-8')) as JsonObject;
    const topics_doc =
        (parseYaml(fs.readFileSync(_config.TOPICS_FILE, 'utf-8'), { version: '1.1' }) as JsonObject | null) ?? {};
    const content = JSON.parse(fs.readFileSync(_config.CONTENT_FILE, 'utf-8')) as JsonObject;
    if (!_isFile(_config.DISCOVERY_FILE)) {
        throw new ExitError(
            'ERROR: dist/discovery/discovery-manifest.json missing. R3 (discovery) ' +
                'is a hard prerequisite per the AI-Council external review. ' +
                'Run `npm run build:discovery` first.',
        );
    }
    const discovery = JSON.parse(fs.readFileSync(_config.DISCOVERY_FILE, 'utf-8')) as JsonObject;

    const tc = content['tool_catalog'] as JsonObject;
    const prior: JsonObject = _isFile(_config.OUT_MANIFEST)
        ? (JSON.parse(fs.readFileSync(_config.OUT_MANIFEST, 'utf-8')) as JsonObject)
        : {};
    const prior_reg = new Map<string, JsonObject>();
    for (const r of ((prior['registries'] as JsonObject[] | null | undefined) ?? [])) {
        prior_reg.set(r['id'] as string, r);
    }

    const registries: JsonObject[] = [];
    for (const seed of REGISTRIES_SEED) {
        const prev = prior_reg.get(seed['id'] as string) ?? {};
        registries.push({
            ...seed,
            status: prev['status'] ?? 'pending',
            submitted_at: prev['submitted_at'] ?? null,
            pr_url: prev['pr_url'] ?? null,
            last_verified: prev['last_verified'] ?? null,
        });
    }

    return {
        version: 1,
        generated_at: nowUtcYmd,
        package: {
            name: pkg['name'],
            version: pkg['version'],
            description: pkg['description'],
            homepage: pkg['homepage'],
            repository: _repo_url(pkg),
        },
        server: {
            name: 'agent-config-mcp',
            transports: ['stdio', 'worker'],
            tools_count: (tc['tools'] as unknown[]).length,
            install_hint_stdio: tc['install_hint_stdio'],
        },
        topics: ((topics_doc['topics'] as string[] | null | undefined) ?? [])
            .slice()
            .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
        discovery: {
            artefact_count: (discovery['artefacts'] as unknown[]).length,
            scanner_version: discovery['scanner_version'],
        },
        registries,
    };
}

function _render_row_md(m: JsonObject): string {
    const pkg = m['package'] as JsonObject;
    const srv = m['server'] as JsonObject;
    const transports = (srv['transports'] as string[]).join(', ');
    return (
        `| [${pkg['name']}](${pkg['homepage']}) ` +
        `| ${pkg['description']} ` +
        `| ${srv['tools_count']} tools (${transports}) ` +
        `| \`${srv['install_hint_stdio']}\` |\n`
    );
}

function _render_cf_json(m: JsonObject): string {
    const pkg = m['package'] as JsonObject;
    const srv = m['server'] as JsonObject;
    const payload: JsonObject = {
        name: srv['name'],
        description: pkg['description'],
        homepage: pkg['homepage'],
        repository: pkg['repository'],
        transports: srv['transports'],
        tools_count: srv['tools_count'],
        install_hint_stdio: srv['install_hint_stdio'],
        topics: m['topics'],
    };
    return pyJsonDumps(payload, { indent: 2, sortKeys: true }) + '\n';
}

interface ParsedArgs {
    write: boolean;
    strict: boolean;
    quiet: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = { write: false, strict: false, quiet: false };
    const usage = 'usage: build_mcp_registry_manifest.py [-h] [--write] [--strict] [--quiet]\n';
    for (const arg of argv) {
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(usage);
            process.exit(0);
        } else if (arg === '--write') {
            args.write = true;
        } else if (arg === '--strict') {
            args.strict = true;
        } else if (arg === '--quiet') {
            args.quiet = true;
        } else {
            process.stderr.write(usage);
            process.stderr.write(`build_mcp_registry_manifest.py: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
    }
    return args;
}

export function main(argv: readonly string[]): number {
    const args = parse_args(argv);

    // datetime.now(timezone.utc).strftime("%Y-%m-%d") — UTC calendar date.
    const now = new Date();
    const nowUtcYmd = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(
        now.getUTCDate(),
    ).padStart(2, '0')}`;

    const manifest = _build(nowUtcYmd);
    const manifest_text = pyJsonDumps(manifest, { indent: 2, sortKeys: true }) + '\n';
    const row_md = _render_row_md(manifest);
    const cf_json = _render_cf_json(manifest);

    const outputs: Array<[string, string]> = [
        [_config.OUT_MANIFEST, manifest_text],
        [_config.OUT_ROW_MD, row_md],
        [_config.OUT_CF_JSON, cf_json],
    ];
    const changed = outputs.filter(
        ([p, t]) => !_isFile(p) || fs.readFileSync(p, 'utf-8') !== t,
    );

    if (args.write) {
        fs.mkdirSync(_config.OUT_DIR, { recursive: true });
        for (const [p, t] of outputs) {
            fs.writeFileSync(p, t, 'utf-8');
        }
        if (!args.quiet) {
            const verb = changed.length > 0 ? 'wrote' : 'unchanged';
            process.stdout.write(`✅  ${verb} ${outputs.length} file(s) under dist/mcp/\n`);
        }
    } else {
        if (!args.quiet) {
            process.stdout.write(manifest_text);
        }
    }

    return args.strict && changed.length > 0 && !args.write ? 2 : 0;
}

// --- Python-faithful JSON serialization -------------------------------------

/**
 * Mirror `json.dumps(obj, indent=indent, sort_keys=sortKeys)` with the Python
 * default `ensure_ascii=True` — escapes every non-ASCII codepoint as `\uXXXX`
 * (surrogate pairs for astral planes), and uses Python's `(",", ": ")`
 * separators under `indent`.
 */
export function pyJsonDumps(obj: Json, opts: { indent: number; sortKeys: boolean }): string {
    const { indent, sortKeys } = opts;
    const pad = ' '.repeat(indent);

    function enc(value: Json, depth: number): string {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') {
            // Python json renders ints without decimals; JS numbers that are
            // integers stringify the same. Floats: rely on default; manifest
            // here is int-only.
            return String(value);
        }
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        // object
        const o = value as JsonObject;
        let keys = Object.keys(o);
        if (sortKeys) keys = keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        if (keys.length === 0) return '{}';
        const inner = keys.map(
            (k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1),
        );
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
            else {
                // ensure_ascii: escape every non-ASCII codepoint. Astral planes
                // are emitted as UTF-16 surrogate pairs, matching CPython.
                if (cp > 0xffff) {
                    const v = cp - 0x10000;
                    const hi = 0xd800 + (v >> 10);
                    const lo = 0xdc00 + (v & 0x3ff);
                    out += '\\u' + hi.toString(16).padStart(4, '0');
                    out += '\\u' + lo.toString(16).padStart(4, '0');
                } else {
                    out += '\\u' + cp.toString(16).padStart(4, '0');
                }
            }
        }
        return out + '"';
    }

    return enc(obj, 0);
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (exc) {
        if (exc instanceof ExitError) {
            process.stderr.write(`${exc.message}\n`);
            process.exit(1);
        }
        throw exc;
    }
}
