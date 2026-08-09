/**
 * `agent-config settings:get <key>` — the value, and the file it came from.
 *
 * Phase 2.2 of `road-to-capability-answerability`, and the general answer to
 * five separate settings-key defects rather than five prose edits. Before this
 * verb, "what is this setting, and which file did it come from" was unanswerable
 * by any command: `settings:check` validates, `settings:sync` merges,
 * `settings:set` writes, and the one function that computes exactly
 * `[key, value, source_path]` — `iter_setting_overrides` — had a test and no
 * production caller at all. This exposes it.
 *
 * Read-only BY CONSTRUCTION, which is a design constraint and not a promise:
 * this module imports no writer, opens no file for writing, and has no flag
 * that could. The roadmap's Risk 3 names the failure it is avoiding — a read
 * verb inviting a write verb until the C-class fence in `settings:set` has a
 * general bypass beside it.
 *
 * Four things are reported, and the last two are why it is a probe:
 *
 * - **the effective value**, resolved through the same cascade the loader walks;
 * - **the winning source path**, plus every layer that set the key, so a
 *   surprising value can be traced to the file that caused it;
 * - **absent ≠ default**, for the nine carved-out keys where a reader resolves
 *   an absent key to something other than the template's default. Reporting
 *   "not set" for `quality.local_auto_run` without saying that absent DISARMS
 *   the gate the template arms would be a true statement that misleads;
 * - **the silent whitelist drop**. `load_agent_settings` filters the user-global
 *   layer through `MERGEABLE_KEYS` and discards everything else without a word.
 *   A user who sets a non-whitelisted key user-globally gets no error, no
 *   warning, and no effect. This verb says so.
 *
 * Exit codes: `0` answered (including "not set anywhere", which is an answer) ·
 * `2` usage error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { load as yamlLoad } from 'js-yaml';

import {
    iter_setting_overrides,
    load_agent_settings,
    MERGEABLE_KEYS,
    USER_GLOBAL_FILENAME,
} from '../_lib/agent_settings.js';
import { resolve_with_fallback, write_target } from '../_lib/user_global_paths.js';
import { resolvePackageRoot } from '../_lib/package_root.js';
import { SETTINGS_CARVE_OUT, type CarveOutKey } from '../../shared/settingsCarveOut.js';
import {
    buildSettingsClassIndex,
    classOfPath,
    getSettingsLeaf,
    parseSettingsClassRows,
    type SettingsClass,
} from '../../shared/settingsClasses.js';

const PACKAGE_ROOT = resolvePackageRoot(import.meta.url);

/** Where the class contract ships, relative to the package root. */
const CONTRACT_RELATIVE = 'docs/contracts/settings-classes.md';

/** Where the shipped defaults live, relative to the package root. */
const TEMPLATE_RELATIVE = path.join('src', 'config', 'agent-settings.template.yml');

/**
 * Key shapes whose VALUE is never printed, only its presence.
 *
 * A general settings reader is a general secret reader unless it is told
 * otherwise, and the settings tree really does carry credentials — the
 * user-global file on the machine this was built on holds
 * `secrets.link_encryption_key`. The roadmap does not ask for this; it is the
 * cross-cutting control the surface implies, and adding it after the verb
 * shipped would mean the leak existed first.
 *
 * Matched on the dotted path, so both `secrets.*` and any leaf named like a
 * credential are covered regardless of where they sit.
 */
const SECRET_KEY_RE = /(^|\.)(secrets?)(\.|$)|(^|\.)[a-z0-9_]*(api_key|token|password|passwd|secret|credential|private_key|encryption_key)$/i;

/** `true` when the value for this dotted key must be masked in output. */
export function isSecretKey(key: string): boolean {
    return SECRET_KEY_RE.test(key);
}

/** The value as printed: masked for credential-shaped keys, verbatim otherwise. */
export function displayValue(key: string, value: unknown): unknown {
    if (value === undefined || value === null) return value;
    return isSecretKey(key) ? '«redacted — credential-shaped key»' : value;
}

/** One layer that set the key, in cascade order (later wins). */
export interface SettingsLayer {
    value: unknown;
    file: string;
}

export interface SettingsGetOptions {
    key: string;
    cwd: string;
    packageRoot: string;
    json: boolean;
}

export interface SettingsGetResult {
    code: 0 | 2;
    out: string[];
    err: string[];
}

/**
 * Every layer that set `key`, in cascade order.
 *
 * Delegates to `iter_setting_overrides` rather than re-walking the cascade:
 * a probe that computed its own answer could disagree with the loader, and a
 * settings probe that disagrees with the loader is worse than no probe.
 */
export function layersFor(key: string, cwd: string): SettingsLayer[] {
    const layers: SettingsLayer[] = [];
    for (const [dotted, value, file] of iter_setting_overrides({ cwd })) {
        if (dotted === key) layers.push({ value, file });
    }
    return layers;
}

/** The template's shipped default for `key`, or `undefined` when it has none. */
export function templateDefault(packageRoot: string, key: string): unknown {
    let parsed: unknown;
    try {
        parsed = yamlLoad(fs.readFileSync(path.join(packageRoot, TEMPLATE_RELATIVE), 'utf-8'));
    } catch {
        return undefined;
    }
    return getSettingsLeaf(parsed, key);
}

/** The carve-out row for `key`, when absent does not mean the template default. */
export function carveOutFor(key: string): CarveOutKey | undefined {
    return SETTINGS_CARVE_OUT.find((c) => c.key === key);
}

/**
 * `true` when the key is present in the user-global file but is NOT whitelisted,
 * i.e. the loader read it and threw it away.
 *
 * Returns the resolved user-global path alongside so the report can name the
 * file the user actually edited — telling somebody their value was dropped
 * without telling them which file it was dropped from is half an answer.
 */
export function userGlobalDrop(key: string): { dropped: boolean; file: string } {
    const file = resolve_with_fallback(USER_GLOBAL_FILENAME) ?? write_target(USER_GLOBAL_FILENAME);
    if (MERGEABLE_KEYS.includes(key)) return { dropped: false, file };
    let raw: unknown;
    try {
        raw = yamlLoad(fs.readFileSync(file, 'utf-8'));
    } catch {
        return { dropped: false, file };
    }
    return { dropped: getSettingsLeaf(raw, key) !== undefined, file };
}

/**
 * The class governing `key`, or `null` when the contract is unreadable or has
 * no row on the path.
 *
 * `classOfPath` rather than an exact lookup: a class-C key whose value is a map
 * has children that never appear as their own rows, and reporting them as
 * unclassified would understate the fence around them.
 */
function _classFor(packageRoot: string, key: string): SettingsClass | null {
    let text: string;
    try {
        text = fs.readFileSync(path.join(packageRoot, CONTRACT_RELATIVE), 'utf-8');
    } catch {
        return null;
    }
    return classOfPath(buildSettingsClassIndex(parseSettingsClassRows(text)), key) ?? null;
}

export function runSettingsGet(opts: SettingsGetOptions): SettingsGetResult {
    const out: string[] = [];
    const err: string[] = [];

    const merged = load_agent_settings({ cwd: opts.cwd });
    const effective = getSettingsLeaf(merged, opts.key);
    const layers = layersFor(opts.key, opts.cwd);
    const winning = layers.length > 0 ? (layers[layers.length - 1] as SettingsLayer) : null;
    const cls = _classFor(opts.packageRoot, opts.key);
    const fallback = templateDefault(opts.packageRoot, opts.key);
    const carveOut = carveOutFor(opts.key);
    const drop = userGlobalDrop(opts.key);

    if (opts.json) {
        out.push(
            JSON.stringify(
                {
                    key: opts.key,
                    value: displayValue(opts.key, effective) ?? null,
                    redacted: isSecretKey(opts.key),
                    set: winning !== null,
                    source: winning?.file ?? null,
                    layers: layers.map((l) => ({ value: displayValue(opts.key, l.value), file: l.file })),
                    class: cls,
                    template_default: fallback ?? null,
                    absent_is_not_default: carveOut
                        ? { resolves_to: carveOut.absentResolvesTo, reader: carveOut.reader }
                        : null,
                    user_global_dropped: drop.dropped ? drop.file : null,
                },
                null,
                2,
            ),
        );
        return { code: 0, out, err };
    }

    if (winning !== null) {
        out.push(`${opts.key} = ${JSON.stringify(displayValue(opts.key, effective))}`);
        out.push(`  source    ${winning.file}`);
    } else {
        out.push(`${opts.key} — not set in any settings file`);
        out.push(
            `  default   ${
                fallback === undefined
                    ? '(none in the template)'
                    : JSON.stringify(displayValue(opts.key, fallback))
            }`,
        );
    }
    out.push(`  class     ${cls ?? '(unclassified — no row in the class contract)'}`);

    if (layers.length > 1) {
        out.push('  layers    (cascade order, last wins)');
        for (const layer of layers) {
            out.push(`            ${JSON.stringify(displayValue(opts.key, layer.value))}  ←  ${layer.file}`);
        }
    }

    if (winning === null && carveOut !== undefined) {
        out.push(
            '',
            '⚠️  Absent is NOT the template default for this key.',
            `    A reader resolves the absent key to: ${carveOut.absentResolvesTo}`,
            `    Reader: ${carveOut.reader}`,
            '    So "not set" and "set to the default" behave differently here.',
        );
    }

    if (drop.dropped) {
        out.push(
            '',
            '⚠️  This key IS present in your user-global file and is being discarded.',
            `    File: ${drop.file}`,
            '    Only the keys on the MERGEABLE_KEYS whitelist cascade from user-global into',
            '    a project; everything else is filtered out silently by load_agent_settings.',
            '    Set it in the project settings file, or the value has no effect anywhere.',
        );
    }

    return { code: 0, out, err };
}

interface ParsedArgv {
    ok: boolean;
    message?: string;
    key?: string;
    json?: boolean;
}

export function parseArgv(argv: readonly string[]): ParsedArgv {
    const positional: string[] = [];
    let json = false;
    for (const a of argv) {
        if (a === '--json') {
            json = true;
        } else if (a === '-h' || a === '--help') {
            return { ok: false, message: 'usage: agent-config settings:get <key> [--json]' };
        } else if (a.startsWith('--')) {
            return { ok: false, message: `unknown flag: ${a}` };
        } else {
            positional.push(a);
        }
    }
    if (positional.length !== 1) {
        return { ok: false, message: 'usage: agent-config settings:get <key> [--json]' };
    }
    return { ok: true, key: positional[0] as string, json };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const parsed = parseArgv(argv);
    if (!parsed.ok) {
        process.stderr.write(`${parsed.message ?? 'usage error'}\n`);
        return 2;
    }
    const result = runSettingsGet({
        key: parsed.key as string,
        cwd: process.cwd(),
        packageRoot: PACKAGE_ROOT,
        json: parsed.json === true,
    });
    for (const line of result.out) process.stdout.write(`${line}\n`);
    for (const line of result.err) process.stderr.write(`${line}\n`);
    return result.code;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}

export { CONTRACT_RELATIVE, PACKAGE_ROOT, TEMPLATE_RELATIVE };
