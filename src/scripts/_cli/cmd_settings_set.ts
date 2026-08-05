/**
 * `agent-config settings:set <key> <value>` — the one agent-reachable settings
 * writer, and the fence around it.
 *
 * Phase 2 of `road-to-zero-ceremony-settings`. Greenfield: before this, the
 * `settings` verb family could `check`, `sync`, and `migrate`, and the only way
 * to change a value was the GUI or an editor. That is why the fence lands with
 * the writer rather than after it — the first version of an agent-writable
 * settings path is the last cheap moment to decide what it may not write.
 *
 * The contract, in four lines:
 *
 * - **C-class keys are refused.** The class comes from
 *   `docs/contracts/settings-classes.md`, parsed through the same shared module
 *   the lint and the Fastify write route use, so all three refuse the same keys
 *   for the same reason.
 * - **Fail-closed.** A missing or unparseable contract refuses EVERY write, not
 *   just the guarded ones. A fence that opens when its rulebook goes missing is
 *   not a fence.
 * - **Zod-validated** against the shipped settings schema before anything is
 *   written, so a typo cannot land a value the GUI will later reject.
 * - **Atomic** — tmp-write, `fsync`, rename, mode 0600, mirroring the server's
 *   `writeAtomic` semantics in a synchronous form the CLI can use — into the
 *   canonical global file `~/.event4u/agent-config/settings/.agent-settings.yml`,
 *   the file the wizard writes and both the server and the installer read.
 *
 * Provenance lives in a **sidecar**, `settings/.agent-settings.provenance.json`,
 * not as extra keys in the YAML. The settings file has a leaf-for-leaf parity
 * test against the zod schema whose own comment reads *"loosen it and the GUI
 * silently drifts"*; adding bookkeeping keys to that file would mean relaxing
 * it, and the roadmap's Risk 2 names exactly that trade as the thing not to
 * make. The sidecar carries `source` and `at` per dotted key and is written in
 * the same run as the value it describes.
 *
 * Exit codes: `0` written or already at that value · `1` refused (guarded key,
 * unknown key, validation failure, missing contract) · `2` usage error.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { dump as yamlDump, load as yamlLoad } from 'js-yaml';

import { z } from 'zod';

import { settingsSchema } from '../../server/schemas/settings.js';
import {
    buildSettingsClassIndex,
    getSettingsLeaf,
    parseSettingsClassRows,
    type SettingsClass,
} from '../../shared/settingsClasses.js';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');

/** Where the class contract ships. Shipped via package.json `files[]`. */
const CONTRACT_RELATIVE = 'docs/contracts/settings-classes.md';

/** How a value came to be set. Ordered least to most deliberate. */
export type ProvenanceSource = 'auto-detected' | 'jit-answer' | 'manual' | 'gui';

const PROVENANCE_SOURCES: readonly ProvenanceSource[] = ['auto-detected', 'jit-answer', 'manual', 'gui'];

export interface ProvenanceEntry {
    source: ProvenanceSource;
    /** ISO-8601 UTC, second precision — the file is read by humans. */
    at: string;
}

export interface SettingsSetOptions {
    key: string;
    /** The raw CLI token; parsed as YAML scalar so `true`/`3`/`[]` arrive typed. */
    rawValue: string;
    source: ProvenanceSource;
    /** Override the global root; the tests use it, nothing else should. */
    root: string;
    /** Resolve the class contract from here. Defaults to the package root. */
    packageRoot: string;
    now: string;
    dryRun: boolean;
}

export interface SettingsSetResult {
    code: 0 | 1 | 2;
    /** Lines for stdout — the loud echo. */
    out: string[];
    /** Lines for stderr — refusals. */
    err: string[];
}

/** `~/.event4u/agent-config` unless `EVENT4U_CONFIG_HOME` says otherwise. */
export function globalRoot(env: NodeJS.ProcessEnv = process.env): string {
    const override = env['EVENT4U_CONFIG_HOME'];
    if (override !== undefined && override.trim() !== '') {
        return path.resolve(override);
    }
    return path.join(os.homedir(), '.event4u', 'agent-config');
}

export function settingsFilePath(root: string): string {
    return path.join(root, 'settings', '.agent-settings.yml');
}

export function provenanceFilePath(root: string): string {
    return path.join(root, 'settings', '.agent-settings.provenance.json');
}

/**
 * Parse a CLI token the way YAML would, so `true`, `3`, `[]`, and `off` arrive
 * as the type the schema expects rather than as strings.
 *
 * A token that does not parse is kept verbatim as a string — the zod validation
 * downstream is what decides whether that is acceptable, and it gives a better
 * message than a YAML error would.
 */
export function parseScalar(raw: string): unknown {
    try {
        const parsed = yamlLoad(raw);
        return parsed === undefined ? raw : parsed;
    } catch {
        return raw;
    }
}

function _setDotted(target: Record<string, unknown>, dotted: string, value: unknown): void {
    const parts = dotted.split('.');
    let node = target;
    for (const part of parts.slice(0, -1)) {
        const next = node[part];
        if (typeof next !== 'object' || next === null || Array.isArray(next)) {
            node[part] = {};
        }
        node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1] as string] = value;
}

function _readYaml(file: string): Record<string, unknown> {
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        return {};
    }
    const parsed = yamlLoad(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {};
    }
    return parsed as Record<string, unknown>;
}

function _readProvenance(file: string): Record<string, ProvenanceEntry> {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, ProvenanceEntry>;
        }
    } catch {
        // A corrupt sidecar must not block a settings write — provenance is a
        // record ABOUT the decision, never a gate ON it. It is rebuilt from the
        // entries that survive plus the one being written now.
    }
    return {};
}

function _writeAtomicSync(target: string, contents: string, mode = 0o600): void {
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    const tmp = `${target}.${String(process.pid)}.tmp`;
    const fd = fs.openSync(tmp, 'w', mode);
    try {
        fs.writeFileSync(fd, contents, 'utf-8');
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    fs.renameSync(tmp, target);
}

/**
 * The zod schema for one dotted leaf, or `null` when the path is not in the
 * schema.
 *
 * Validating the LEAF rather than the whole tree is deliberate. `settingsSchema`
 * describes a complete settings document, so a sparse file — which is the shape
 * this roadmap is moving towards — fails it on every section it omits, and the
 * error would name `cost: Required` when the user mistyped a boolean. Walking
 * to the leaf gives the message the caller can act on, and it is the same walk
 * the template↔schema parity test performs.
 */
export function leafSchemaAt(schema: z.ZodTypeAny, dotted: string): z.ZodTypeAny | null {
    let current = _unwrap(schema);
    for (const part of dotted.split('.')) {
        if (!(current instanceof z.ZodObject)) {
            return null;
        }
        const shape = current.shape as Record<string, z.ZodTypeAny>;
        const next = shape[part];
        if (next === undefined) {
            return null;
        }
        current = _unwrap(next);
    }
    return current;
}

function _unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
    let current: z.ZodTypeAny = schema;
    while (
        current instanceof z.ZodDefault ||
        current instanceof z.ZodOptional ||
        current instanceof z.ZodNullable
    ) {
        current = (current._def as { innerType: z.ZodTypeAny }).innerType;
    }
    return current;
}

/**
 * Load the class index, or `null` when the contract is unreadable.
 *
 * `null` is the fail-closed signal, and the caller must treat it as "refuse
 * every write" rather than "no classes, so nothing is guarded".
 */
export function loadClassIndex(packageRoot: string): Map<string, SettingsClass> | null {
    let text: string;
    try {
        text = fs.readFileSync(path.join(packageRoot, CONTRACT_RELATIVE), 'utf-8');
    } catch {
        return null;
    }
    const index = buildSettingsClassIndex(parseSettingsClassRows(text));
    return index.size === 0 ? null : index;
}

/** The whole command as a pure-ish function, so the tests do not shell out for every case. */
export function runSettingsSet(opts: SettingsSetOptions): SettingsSetResult {
    const out: string[] = [];
    const err: string[] = [];

    const classes = loadClassIndex(opts.packageRoot);
    if (classes === null) {
        err.push(
            `❌  settings:set refused — the class contract at ${CONTRACT_RELATIVE} is missing or has no rows.`,
            '    Every write is refused while it is unreadable. A fence that opens when its',
            '    rulebook goes missing is not a fence.',
        );
        return { code: 1, out, err };
    }

    const cls = classes.get(opts.key);
    if (cls === undefined) {
        err.push(
            `❌  settings:set refused — \`${opts.key}\` has no class in ${CONTRACT_RELATIVE}.`,
            '    An unclassified key is either a typo or a key that shipped without a fence;',
            '    both are refusals, never a silent write.',
        );
        return { code: 1, out, err };
    }
    if (cls === 'C') {
        err.push(
            `❌  settings:set refused — \`${opts.key}\` is class C (guarded).`,
            '    C-class keys govern spend, an allow/deny list, a gate, the agent\'s own',
            '    authority, what code runs, egress, a credential, or the audit trail.',
            '    Change it in the settings GUI or in the file itself — not through an agent.',
        );
        return { code: 1, out, err };
    }

    const value = parseScalar(opts.rawValue);
    const file = settingsFilePath(opts.root);
    const current = _readYaml(file);
    const before = getSettingsLeaf(current, opts.key);

    const leafSchema = leafSchemaAt(settingsSchema, opts.key);
    if (leafSchema === null) {
        err.push(
            `❌  settings:set refused — \`${opts.key}\` is classified but absent from the settings schema.`,
            '    The contract and the schema disagree; lint_settings_classes and the',
            '    template↔schema parity test are the two gates that should have caught it.',
        );
        return { code: 1, out, err };
    }
    const parsedLeaf = leafSchema.safeParse(value);
    if (!parsedLeaf.success) {
        err.push(`❌  settings:set refused — \`${opts.key}\` = ${JSON.stringify(value)} fails the settings schema.`);
        for (const issue of parsedLeaf.error.issues.slice(0, 3)) {
            err.push(`    ${issue.message}`);
        }
        return { code: 1, out, err };
    }

    const candidate: Record<string, unknown> = structuredClone(current);
    _setDotted(candidate, opts.key, value);

    if (JSON.stringify(before) === JSON.stringify(value)) {
        out.push(`✅  settings:set — \`${opts.key}\` is already ${JSON.stringify(value)}; nothing written.`);
        return { code: 0, out, err };
    }

    if (opts.dryRun) {
        out.push(
            `↪  settings:set --dry-run — would set \`${opts.key}\` = ${JSON.stringify(value)} ` +
                `(was ${JSON.stringify(before ?? null)}) in ${file}`,
        );
        return { code: 0, out, err };
    }

    const provenanceFile = provenanceFilePath(opts.root);
    const provenance = _readProvenance(provenanceFile);
    provenance[opts.key] = { source: opts.source, at: opts.now };

    _writeAtomicSync(file, yamlDump(candidate, { lineWidth: 100, noRefs: true }));
    _writeAtomicSync(provenanceFile, `${JSON.stringify(provenance, null, 4)}\n`);

    // One loud line per write. A settings change the user never saw scroll past
    // is a settings change they cannot audit, and class A/B writes are exactly
    // the ones nobody was asked about.
    out.push(
        `✅  settings:set — \`${opts.key}\` = ${JSON.stringify(value)} ` +
            `(was ${JSON.stringify(before ?? null)}) · class ${cls} · source ${opts.source} · ${file}`,
    );
    return { code: 0, out, err };
}

interface ParsedArgv {
    ok: boolean;
    message?: string;
    key?: string;
    rawValue?: string;
    source?: ProvenanceSource;
    dryRun?: boolean;
}

export function parseArgv(argv: readonly string[]): ParsedArgv {
    const positional: string[] = [];
    let source: ProvenanceSource = 'manual';
    let dryRun = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--dry-run') {
            dryRun = true;
        } else if (a === '--source') {
            const v = argv[++i];
            if (v === undefined || !(PROVENANCE_SOURCES as readonly string[]).includes(v)) {
                return { ok: false, message: `--source must be one of: ${PROVENANCE_SOURCES.join(' | ')}` };
            }
            source = v as ProvenanceSource;
        } else if (a === '-h' || a === '--help') {
            return { ok: false, message: 'usage: agent-config settings:set <key> <value> [--source auto-detected|jit-answer|manual|gui] [--dry-run]' };
        } else if (a.startsWith('--')) {
            return { ok: false, message: `unknown flag: ${a}` };
        } else {
            positional.push(a);
        }
    }
    const [key, rawValue] = positional;
    if (key === undefined || rawValue === undefined || positional.length !== 2) {
        return { ok: false, message: 'usage: agent-config settings:set <key> <value> [--source …] [--dry-run]' };
    }
    return { ok: true, key, rawValue, source, dryRun };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const parsed = parseArgv(argv);
    if (!parsed.ok) {
        process.stderr.write(`${parsed.message ?? 'usage error'}\n`);
        return 2;
    }
    const result = runSettingsSet({
        key: parsed.key as string,
        rawValue: parsed.rawValue as string,
        source: parsed.source as ProvenanceSource,
        root: globalRoot(),
        packageRoot: PACKAGE_ROOT,
        now: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        dryRun: parsed.dryRun === true,
    });
    for (const line of result.out) process.stdout.write(`${line}\n`);
    for (const line of result.err) process.stderr.write(`${line}\n`);
    return result.code;
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
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}

export { CONTRACT_RELATIVE, PACKAGE_ROOT, PROVENANCE_SOURCES };
