#!/usr/bin/env tsx
/**
 * check_reach_channels.ts — schema gate for the reach channel registry
 * (road-to-internet-reach Phase 1, Step 3).
 *
 * Validates `src/config/reach-channels.yml` against
 * `src/scripts/schemas/reach-channels.schema.json` and reports one line per
 * violation with its JSON path, the failing schema rule, and the message.
 *
 * OFFLINE AND DETERMINISTIC BY CONSTRUCTION. The gate reads two files and
 * matches strings — it never spawns a process, never resolves a binary on
 * PATH, and never touches the network. An absent backend (`yt-dlp` is not
 * installed on the authoring machine) therefore cannot fail this check:
 * whether a tool is *healthy* is the probe layer's question, whether its
 * install prescription is *pinned* is this one's.
 *
 * Scope note: the registry is standalone operator tooling. The Phase 0
 * benchmark returned `band: stop`, so nothing validated here is a routing
 * table or an agent-facing recommendation.
 *
 * No new dependency: the Draft-07 subset validator is the one already
 * exported by `validate_frontmatter.ts` (type, required, properties,
 * additionalProperties:false, items, minItems, pattern, minLength, enum) and
 * YAML parsing uses the repo's existing `yaml` package. Consequence for
 * schema authors: `$ref`, `patternProperties` and `if/then` are unavailable —
 * the schema inlines instead.
 *
 * Plus ONE cross-field rule no Draft-07 subset can express, asserted in code as
 * rule `probe_cmd-binding`: a backend's `probe_cmd` must equal its own `id`
 * (see `check_probe_cmd_binding`). Free choice of `probe_cmd` is what made the
 * registry an execution primitive — `id: curl` + `probe_cmd: sh` spawned a
 * shell and the report still printed a healthy `curl` row.
 *
 * Severity: `error`-severity findings fail the run; `warning`-severity
 * findings (minLength) are printed and do not change the exit code.
 *
 * Exit codes:
 *   0 — clean (or warnings only).
 *   1 — at least one error-severity violation.
 *   3 — internal error: target missing, unreadable, or not parseable YAML.
 *
 * Invocation (from project root):
 *   tsx src/scripts/check_reach_channels.ts [<path-to-yml>] [--quiet]
 *
 * The optional path argument is what lets the negative fixtures under
 * `tests/fixtures/reach-channels/` be validated by the same code path as the
 * real registry.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { SchemaError, validate, type YamlValue } from './validate_frontmatter.js';

const _HERE = fileURLToPath(import.meta.url);
/** Repo root — two dirs up from src/scripts. */
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const REGISTRY_PATH = path.join(ROOT, 'src', 'config', 'reach-channels.yml');
export const SCHEMA_PATH = path.join(
    ROOT,
    'src',
    'scripts',
    'schemas',
    'reach-channels.schema.json',
);

/** Thrown for the exit-3 class: unusable input, as opposed to invalid content. */
export class RegistryLoadError extends Error {}

/**
 * A parse / read failure rendered WITHOUT any of the file's bytes.
 *
 * `String(err)` on a `YAMLParseError` appends the offending source line and a
 * caret under it — so interpolating it into a message turns any reader of the
 * error stream into an arbitrary-file-read oracle: point `--registry` (or
 * `--intake`) at a secrets file and the first line comes back in the
 * diagnostic. Only the error's name and its own first message line (which
 * carries the position, never the content) survive this function.
 *
 * Cheap-oracle note: a YAML error message may still quote a single offending
 * TOKEN (`Unexpected "]"`). That is a structural character, not file content —
 * the leak this closes is the verbatim source-line echo.
 */
export function sanitizeParseError(err: unknown): string {
    const name = err instanceof Error && err.name !== '' ? err.name : 'Error';
    const raw = err instanceof Error ? err.message : String(err);
    const firstLine = (raw.split('\n')[0] ?? '').trim();
    return firstLine === '' ? name : `${name}: ${firstLine}`;
}

/** Load the registry schema. Throws RegistryLoadError when it is unusable. */
export function load_schema(schemaPath: string = SCHEMA_PATH): Record<string, YamlValue> {
    if (!fs.existsSync(schemaPath)) {
        throw new RegistryLoadError(`schema not found: ${schemaPath}`);
    }
    try {
        return JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as Record<string, YamlValue>;
    } catch (err) {
        throw new RegistryLoadError(
            `schema is not valid JSON: ${schemaPath}: ${sanitizeParseError(err)}`,
        );
    }
}

/** Parse one registry YAML file. Throws RegistryLoadError when it is unusable. */
export function load_registry(targetPath: string): YamlValue {
    if (!fs.existsSync(targetPath)) {
        throw new RegistryLoadError(`registry not found: ${targetPath}`);
    }
    let text: string;
    try {
        text = fs.readFileSync(targetPath, 'utf-8');
    } catch (err) {
        throw new RegistryLoadError(
            `registry unreadable: ${targetPath}: ${sanitizeParseError(err)}`,
        );
    }
    let data: unknown;
    try {
        data = parseYaml(text);
    } catch (err) {
        throw new RegistryLoadError(
            `registry is not parseable YAML: ${targetPath}: ${sanitizeParseError(err)}`,
        );
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new RegistryLoadError(`registry is not a YAML mapping: ${targetPath}`);
    }
    return data as YamlValue;
}

/**
 * Cross-field rule the Draft-07 subset cannot express: a backend's `probe_cmd`
 * MUST be its own `id`.
 *
 * Two holes close at once. (1) Free choice of `probe_cmd` made the registry an
 * execution primitive by name — `id: curl` + `probe_cmd: sh` spawned a shell.
 * (2) Even with harmless args, a row labelled `curl` reported the health of
 * whatever binary `probe_cmd` named, so the report mislabelled the executed
 * file. Binding the two fields makes the label and the executed binary the same
 * string by construction, and it keeps holding as backends are added — an enum
 * of today's four would need editing for every new one.
 *
 * Deliberately tolerant of shape: entries this cannot read are the schema's
 * business, so anything not-a-mapping is skipped rather than double-reported.
 */
export function check_probe_cmd_binding(registry: unknown): SchemaError[] {
    const findings: SchemaError[] = [];
    const root =
        registry !== null && typeof registry === 'object' && !Array.isArray(registry)
            ? (registry as Record<string, unknown>)
            : null;
    const channels = Array.isArray(root?.['channels']) ? (root['channels'] as unknown[]) : [];
    channels.forEach((rawChannel, channelIndex) => {
        if (rawChannel === null || typeof rawChannel !== 'object' || Array.isArray(rawChannel)) {
            return;
        }
        const channel = rawChannel as Record<string, unknown>;
        const backends = Array.isArray(channel['backends'])
            ? (channel['backends'] as unknown[])
            : [];
        backends.forEach((rawBackend, backendIndex) => {
            if (rawBackend === null || typeof rawBackend !== 'object' || Array.isArray(rawBackend)) {
                return;
            }
            const backend = rawBackend as Record<string, unknown>;
            const id = backend['id'];
            const probeCmd = backend['probe_cmd'];
            if (typeof id !== 'string' || typeof probeCmd !== 'string') {
                return; // `required` already reports the missing field.
            }
            if (id !== probeCmd) {
                findings.push(
                    new SchemaError(
                        `$.channels[${channelIndex}].backends[${backendIndex}].probe_cmd`,
                        'probe_cmd-binding',
                        `probe_cmd '${probeCmd}' must equal the backend id '${id}' — a backend ` +
                            `probes its own binary, and a row labelled '${id}' may never report ` +
                            `the health of a different executable`,
                    ),
                );
            }
        });
    });
    return findings;
}

/**
 * Validate one registry file against the schema.
 *
 * Returns every finding in schema order (errors and warnings alike); the
 * caller decides which severities are fatal. Throws RegistryLoadError for the
 * exit-3 class so an unusable file is never reported as "0 violations".
 */
export function validate_file(
    targetPath: string,
    schemaPath: string = SCHEMA_PATH,
): SchemaError[] {
    const registry = load_registry(targetPath);
    return [
        ...validate(registry, load_schema(schemaPath)),
        ...check_probe_cmd_binding(registry),
    ];
}

/** `<path>: <rule>: <message>` — one line per finding, stable across runs. */
export function format_finding(finding: SchemaError): string {
    return `${finding.path}: ${finding.rule}: ${finding.message}`;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const quiet = argv.includes('--quiet');
    const positional = argv.filter((arg) => !arg.startsWith('-'));
    if (positional.length > 1) {
        process.stderr.write('check_reach_channels: at most one path argument is accepted\n');
        return 3;
    }
    const targetPath = positional[0] ? path.resolve(positional[0]) : REGISTRY_PATH;
    const relTarget = path.relative(ROOT, targetPath) || targetPath;

    let findings: SchemaError[];
    try {
        findings = validate_file(targetPath);
    } catch (err) {
        if (err instanceof RegistryLoadError) {
            process.stderr.write(`❌  check_reach_channels: ${err.message}\n`);
            return 3;
        }
        throw err;
    }

    const errors = findings.filter((finding) => finding.severity === 'error');
    const warnings = findings.filter((finding) => finding.severity !== 'error');

    for (const warning of warnings) {
        process.stdout.write(`⚠️  ${relTarget}: ${format_finding(warning)}\n`);
    }

    if (errors.length > 0) {
        process.stdout.write(`❌  ${relTarget}: ${errors.length} schema violation(s):\n`);
        for (const error of errors) {
            process.stdout.write(`  - ${format_finding(error)}\n`);
        }
        return 1;
    }

    if (!quiet) {
        process.stdout.write(`✅  ${relTarget}: schema-valid (reach channel registry).\n`);
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (!process.argv[1]) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation makes the raw URLs differ (import.meta.url is the
    // resolved real path while argv[1] keeps the symlink path) — compare
    // realpaths so the CLI still fires when run through a projection symlink.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
