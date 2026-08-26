#!/usr/bin/env node
/**
 * Generate the human-readable settings reference page.
 *
 * `road-to-zero-ceremony-settings` Phase 3 step 3. The user's global settings
 * file is becoming sparse, so the long-form explanation that used to ride along
 * as template comments has to survive somewhere the user can still read it.
 *
 * The page is derived from TWO sources that already exist, and from nothing
 * else — the point is that there is no third surface to keep in sync:
 *
 *   1. the zod settings schema (`src/server/schemas/settings.ts`), flattened
 *      through the same `flattenSurface` the installer uses for its upgrade
 *      delta, so type / default / enum / description come from one place;
 *   2. the A/B/C class table (`docs/contracts/settings-classes.md`), parsed by
 *      the same `parseSettingsClassRows` the lint and the writer use, so the
 *      page cannot claim a class the fence does not enforce.
 *
 * The package VERSION is deliberately absent from the output. Rendering it
 * would make this page drift on every release bump and red `--check` for a
 * change nobody made — the page describes the schema's shape, not the release
 * that shipped it.
 *
 * Produces: docs/settings-reference.md
 *
 * Modes:
 *   --check      Regenerate to memory and diff against the committed page.
 *   (default)    Regenerate in place; exit 0 on success.
 *
 * Exit codes: 0 = ok, 1 = drift (--check), 2 = bad usage, 3 = internal.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { zodToJsonSchema } from 'zod-to-json-schema';

import { settingsSchema } from '../server/schemas/settings.js';
import {
    buildSettingsClassIndex,
    parseSettingsClassRows,
    type SettingsClass,
} from '../shared/settingsClasses.js';
import { flattenSurface, type SurfaceEntry } from '../shared/settingsSurface.js';

// ledger-exempt: single-artifact generator — renders ONE derived page from the zod schema and byte-compares it against the committed copy in --check mode; the verdict is one aggregate drift comparison over the whole page, so per-target findings do not exist.
const _HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(_HERE, '..', '..');

export const CONTRACT_REL = path.join('docs', 'contracts', 'settings-classes.md');
export const OUTPUT_REL = path.join('docs', 'settings-reference.md');

/** What each class means for the reader. Mirrors the contract's own table. */
const CLASS_BLURB: Record<SettingsClass, string> = {
    A: 'preference — the agent may set it; you are never asked',
    B: 'consent — the agent asks once, then persists your answer',
    C: 'guarded — only you (GUI or hand-edit) may change it',
};

/** A key with no row in the contract. The lint fails on these separately. */
const UNCLASSIFIED = '—';

export interface ReferenceRow {
    key: string;
    cls: SettingsClass | null;
    entry: SurfaceEntry;
}

/**
 * Group by top-level segment so the page reads like the template did.
 * Leaves with no dot (e.g. `discipline_profile`) group under `(root)`.
 */
export function groupRows(rows: readonly ReferenceRow[]): Map<string, ReferenceRow[]> {
    const groups = new Map<string, ReferenceRow[]>();
    for (const row of rows) {
        const dot = row.key.indexOf('.');
        const section = dot === -1 ? '(root)' : row.key.slice(0, dot);
        const bucket = groups.get(section);
        if (bucket === undefined) groups.set(section, [row]);
        else bucket.push(row);
    }
    return groups;
}

/** Render a value for a markdown table cell — never let it break the row. */
export function renderCell(value: unknown): string {
    if (value === undefined) return '';
    const json = JSON.stringify(value);
    if (json === undefined) return '';
    return `\`${json.replace(/\|/g, '\\|')}\``;
}

/** Descriptions are free prose; pipes and newlines would break the table. */
export function renderProse(value: string | undefined): string {
    if (value === undefined || value === '') return '';
    return value.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
}

export function buildRows(contractMarkdown: string): ReferenceRow[] {
    const jsonSchema = zodToJsonSchema(settingsSchema, {
        name: 'AgentSettings',
        $refStrategy: 'none',
        target: 'jsonSchema7',
    }) as Parameters<typeof flattenSurface>[0];
    // The version is a required parameter of the shared flattener and is
    // discarded here on purpose — see the module header.
    const surface = flattenSurface(jsonSchema, 'unversioned');
    const classIndex = buildSettingsClassIndex(parseSettingsClassRows(contractMarkdown));

    return Object.keys(surface.entries)
        .sort()
        .map((key) => ({
            key,
            cls: classIndex.get(key) ?? null,
            entry: surface.entries[key] as SurfaceEntry,
        }));
}

export function renderPage(rows: readonly ReferenceRow[]): string {
    const out: string[] = [];
    out.push('# Settings reference — every key, its class, and its default');
    out.push('');
    out.push('> **Generated** by `generate_settings_reference` — do NOT');
    out.push('> hand-edit. Derived from the zod settings schema plus the A/B/C class');
    out.push('> table in [`settings-classes`](contracts/settings-classes.md).');
    out.push('> Drift-checked in CI (`--check`).');
    out.push('');
    out.push('Your global settings file is **sparse**: it records the decisions you');
    out.push('actually made, not every key that exists. A key absent from the file');
    out.push('resolves to the default listed here. This page is where the long-form');
    out.push('explanation lives now that the file no longer carries it as comments.');
    out.push('');
    out.push('**Class** answers one question — *who may write this key.*');
    out.push('');
    for (const cls of ['A', 'B', 'C'] as const) {
        out.push(`- **${cls}** — ${CLASS_BLURB[cls]}`);
    }
    out.push('');

    const groups = groupRows(rows);
    for (const section of [...groups.keys()].sort()) {
        const bucket = groups.get(section) as ReferenceRow[];
        out.push(`## ${section}`);
        out.push('');
        out.push('| Key | Class | Type | Default | Allowed values | What it does |');
        out.push('|---|---|---|---|---|---|');
        for (const row of bucket) {
            const allowed = row.entry.enum === undefined
                ? ''
                : row.entry.enum.map((v) => `\`${String(v)}\``).join(' · ');
            out.push(
                `| \`${row.key}\` | ${row.cls ?? UNCLASSIFIED} | ${row.entry.type} | `
                + `${renderCell(row.entry.default)} | ${allowed} | ${renderProse(row.entry.description)} |`,
            );
        }
        out.push('');
    }

    out.push('## See also');
    out.push('');
    out.push('- [`settings-classes`](contracts/settings-classes.md) — the class contract this page reads.');
    out.push('- [`settings-api`](contracts/settings-api.md) — the read/write surface.');
    out.push('');
    return out.join('\n');
}

export function generate(root: string): string {
    const contract = fs.readFileSync(path.join(root, CONTRACT_REL), 'utf-8');
    return renderPage(buildRows(contract));
}

interface Args {
    check: boolean;
}

export function parse_args(argv: readonly string[]): Args {
    const args: Args = { check: false };
    for (const a of argv) {
        if (a === '--check') {
            args.check = true;
            continue;
        }
        process.stderr.write(`generate_settings_reference: unknown argument: ${a}\n`);
        process.exit(2);
    }
    return args;
}

export function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    const out_path = path.join(ROOT, OUTPUT_REL);

    let rendered: string;
    try {
        rendered = generate(ROOT);
    } catch (err) {
        process.stderr.write(`generate_settings_reference: ${String(err)}\n`);
        return 3;
    }

    if (args.check) {
        let committed: string | null = null;
        try {
            committed = fs.readFileSync(out_path, 'utf-8');
        } catch {
            committed = null;
        }
        if (committed !== rendered) {
            process.stderr.write(
                `❌  ${OUTPUT_REL} is out of date.\n`
                + '    Regenerate: ./scripts-run src/scripts/generate_settings_reference\n',
            );
            return 1;
        }
        process.stdout.write(`✅  ${OUTPUT_REL} is up to date.\n`);
        return 0;
    }

    fs.mkdirSync(path.dirname(out_path), { recursive: true });
    fs.writeFileSync(out_path, rendered, 'utf-8');
    process.stdout.write(`✅  wrote ${OUTPUT_REL}\n`);
    return 0;
}

function _invoked_directly(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    return import.meta.url === argvUrl;
}

if (_invoked_directly()) {
    process.exitCode = main();
}
