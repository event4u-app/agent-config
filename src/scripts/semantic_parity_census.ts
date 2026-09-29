#!/usr/bin/env tsx
/**
 * The semantic-parity census — which skill frontmatter semantics survive the
 * MCP-lite carrier, and which are dropped on the way to a host.
 *
 * road-to-semantic-parity-before-off-menu, Phase 1.
 *
 * THE CARRIER THIS MEASURES
 *
 * Exactly one: `ContentEntry` in `src/cli/mcp/content.ts`. That scope is in the
 * report header on purpose. A different delivery path drops a different set, so
 * a second carrier is a second report rather than an edit to this one — merging
 * two field sets into one list would leave neither denominator recoverable, and
 * a report whose scope is not stated in the report gets quoted as general.
 *
 * THE CLASSIFICATION
 *
 * Every property the skill frontmatter schema declares falls into exactly one
 * of three columns, decided by what the carrier's builder actually reads rather
 * than by what its field comments say:
 *
 *   - `carried` — the builder reads the frontmatter key and the value reaches
 *                 `ContentEntry` whole.
 *   - `partial` — the builder reads the key but transports only part of the
 *                 value. `triggers` is the only such key: `triggerText()` keeps
 *                 `INDEXED_TRIGGER_KEYS` (`keyword`, `phrase`) and silently
 *                 drops `file_pattern`, `path_prefix`, `command` and `reason`.
 *                 Classing it `carried` would make a path-triggered skill look
 *                 portable when its routing does not travel at all.
 *   - `dropped` — the builder never reads the key, so the semantic does not
 *                 leave the disk.
 *
 * `carried` and `partial` are derived from the carrier source (the constants in
 * `_lib/body_portable.ts` mirror `buildEntry` and `triggerText`), never from
 * the schema. The
 * `dropped` column is the remainder, so the three are total and disjoint by
 * construction and a new schema property lands in `dropped` until someone
 * teaches the carrier to read it — which is the failure direction this census
 * exists to make visible.
 *
 * NOT IN THE CLASSIFICATION: `body`, `kind`, `mime_type` and `uri` are
 * `ContentEntry` fields with no frontmatter key behind them — the body is the
 * file minus its frontmatter, and the other three are derived from where the
 * file sits. They are carrier fields, not declared semantics, so counting them
 * as `carried` would inflate the numerator with things no skill declares.
 *
 * REPRODUCIBILITY
 *
 * The report pins the commit it was taken at and carries no wall-clock date, so
 * a re-run at the same commit is byte-equal. Nothing machine-dependent is
 * computed into it.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { load as yamlLoad } from 'js-yaml';

import { CARRIED_KEYS, PARTIAL_KEYS } from './_lib/body_portable.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Where the schema that declares the semantics lives. */
const SCHEMA_REL = path.join('src', 'scripts', 'schemas', 'skill.schema.json');

/** Where the corpus lives. */
const SKILLS_REL = path.join('src', 'skills');

/** Default report location. */
const DEFAULT_OUT = path.join('agents', 'evidence', 'analysis', 'semantic-parity-census.md');

/**
 * The carrier constants live with the predicate in `_lib/body_portable.ts` so
 * that the census and the eligibility check cannot drift apart: one source of
 * truth, read here and there.
 */
export { CARRIED_KEYS, PARTIAL_KEYS };

export type Column = 'carried' | 'partial' | 'dropped';

export interface FieldRow {
    readonly field: string;
    readonly column: Column;
    /** For `partial`, the sub-keys that travel. Empty otherwise. */
    readonly travels: readonly string[];
}

export interface SkillRow {
    /** Directory name under `src/skills/`. */
    readonly skill: string;
    /** Declared keys that are `dropped`. */
    readonly dropped: readonly string[];
    /** Declared keys that are `partial`. */
    readonly partial: readonly string[];
}

export interface Census {
    readonly fields: readonly FieldRow[];
    readonly skills: readonly SkillRow[];
    /** Per dropped-or-partial field: how many skills declare it. */
    readonly perField: Readonly<Record<string, number>>;
    /** Total `SKILL.md` files read. */
    readonly scanned: number;
}

/** Classify every schema property into exactly one column. */
export function classify(schemaProperties: readonly string[]): FieldRow[] {
    const rows: FieldRow[] = [];
    for (const field of [...schemaProperties].sort()) {
        if (CARRIED_KEYS.includes(field)) {
            rows.push({ field, column: 'carried', travels: [] });
            continue;
        }
        const travels = PARTIAL_KEYS[field];
        if (travels !== undefined) {
            rows.push({ field, column: 'partial', travels });
            continue;
        }
        rows.push({ field, column: 'dropped', travels: [] });
    }
    return rows;
}

/** Top-level frontmatter keys of one `SKILL.md`, or `[]` when it carries none. */
export function frontmatterKeys(text: string): string[] {
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    if (m === null) return [];
    let doc: unknown;
    try {
        doc = yamlLoad(m[1]!);
    } catch {
        return [];
    }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return [];
    return Object.keys(doc as Record<string, unknown>);
}

export function census(root: string): Census {
    const schemaPath = path.join(root, SCHEMA_REL);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
        properties?: Record<string, unknown>;
    };
    const fields = classify(Object.keys(schema.properties ?? {}));

    const byColumn = new Map<string, Column>(fields.map((r) => [r.field, r.column]));

    const skillsDir = path.join(root, SKILLS_REL);
    const dirs = fs.existsSync(skillsDir)
        ? fs
              .readdirSync(skillsDir, { withFileTypes: true })
              .filter((d) => d.isDirectory())
              .map((d) => d.name)
              .sort()
        : [];

    const skills: SkillRow[] = [];
    const perField: Record<string, number> = {};
    let scanned = 0;

    for (const dir of dirs) {
        const file = path.join(skillsDir, dir, 'SKILL.md');
        if (!fs.existsSync(file)) continue;
        scanned += 1;
        const keys = frontmatterKeys(fs.readFileSync(file, 'utf8'));
        const dropped: string[] = [];
        const partial: string[] = [];
        for (const key of keys) {
            const col = byColumn.get(key);
            if (col === 'dropped') dropped.push(key);
            else if (col === 'partial') partial.push(key);
            else continue;
            perField[key] = (perField[key] ?? 0) + 1;
        }
        skills.push({ skill: dir, dropped: dropped.sort(), partial: partial.sort() });
    }

    return { fields, skills, perField, scanned };
}

function pin(root: string): { sha: string; date: string } {
    const git = (args: string[]): string =>
        execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    try {
        return { sha: git(['rev-parse', 'HEAD']), date: git(['show', '-s', '--format=%cI', 'HEAD']) };
    } catch {
        return { sha: 'unknown', date: 'unknown' };
    }
}

export function render(c: Census, p: { sha: string; date: string }): string {
    const lines: string[] = [];
    lines.push('<!-- evidence-type: analysis -->');
    lines.push(`<!-- semantic-parity-census: v1 | commit: ${p.sha} | commit-date: ${p.date} -->`);
    lines.push('');
    lines.push('# Semantic-parity census — MCP-lite `ContentEntry`');
    lines.push('');
    lines.push(
        'Emitted by `src/scripts/semantic_parity_census.ts`. **Carrier measured: `ContentEntry`**',
    );
    lines.push(
        'in `src/cli/mcp/content.ts` — one delivery path, MCP-lite. A different path drops a',
    );
    lines.push(
        'different set; a second carrier is a second report, never an edit to this one. Read the',
    );
    lines.push("script's module header for the classification before reading a number here.");
    lines.push('');
    lines.push('This report states coverage only. It marks no skill, excludes none, and is not a');
    lines.push('verdict about which skills matter.');
    lines.push('');
    lines.push(`- **Commit pin:** \`${p.sha}\` (${p.date})`);
    lines.push(`- **Schema:** \`${SCHEMA_REL}\``);
    lines.push(`- **Corpus:** \`${SKILLS_REL}/*/SKILL.md\` — ${String(c.scanned)} file(s)`);
    lines.push('');

    const counts: Record<Column, number> = { carried: 0, partial: 0, dropped: 0 };
    for (const r of c.fields) counts[r.column] += 1;

    lines.push('## Field coverage');
    lines.push('');
    lines.push(
        `${String(c.fields.length)} declared propert${c.fields.length === 1 ? 'y' : 'ies'}, each in exactly one column: ` +
            `${String(counts.carried)} carried, ${String(counts.partial)} partial, ${String(counts.dropped)} dropped.`,
    );
    lines.push('');
    lines.push('| field | carried | partial | dropped | travels |');
    lines.push('|---|---|---|---|---|');
    for (const r of c.fields) {
        const mark = (col: Column): string => (r.column === col ? 'x' : '');
        const travels = r.travels.length ? r.travels.map((t) => `\`${t}\``).join(', ') : '';
        lines.push(
            `| \`${r.field}\` | ${mark('carried')} | ${mark('partial')} | ${mark('dropped')} | ${travels} |`,
        );
    }
    lines.push('');

    lines.push('## Corpus declarations against the uncarried set');
    lines.push('');
    lines.push(
        'How many skills declare each field the carrier drops or truncates. A field absent from',
    );
    lines.push('this table is declared by no skill today — the gap for it is theoretical.');
    lines.push('');
    const declared = c.fields
        .filter((r) => r.column !== 'carried')
        .map((r) => ({ field: r.field, column: r.column, n: c.perField[r.field] ?? 0 }))
        .filter((r) => r.n > 0)
        .sort((a, b) => b.n - a.n || a.field.localeCompare(b.field));
    lines.push('| field | column | skills declaring |');
    lines.push('|---|---|---|');
    for (const r of declared) {
        lines.push(`| \`${r.field}\` | ${r.column} | ${String(r.n)} |`);
    }
    lines.push('');

    const nonPortable = c.skills.filter((s) => s.dropped.length > 0 || s.partial.length > 0);
    lines.push(
        `**${String(nonPortable.length)} of ${String(c.scanned)} skills declare at least one semantic the carrier does not transport whole.**`,
    );
    lines.push('');

    lines.push('## Per skill');
    lines.push('');
    lines.push('| skill | dropped | partial |');
    lines.push('|---|---|---|');
    for (const s of c.skills) {
        const d = s.dropped.length ? s.dropped.map((k) => `\`${k}\``).join(', ') : '—';
        const pa = s.partial.length ? s.partial.map((k) => `\`${k}\``).join(', ') : '—';
        lines.push(`| \`${s.skill}\` | ${d} | ${pa} |`);
    }
    lines.push('');
    return lines.join('\n');
}

export function main(argv: readonly string[]): number {
    const write = argv.includes('--write');
    const json = argv.includes('--json');
    const outIdx = argv.indexOf('--out');
    const out = outIdx >= 0 ? argv[outIdx + 1] : undefined;

    const c = census(REPO_ROOT);

    if (json) {
        process.stdout.write(`${JSON.stringify(c, null, 2)}\n`);
        return 0;
    }
    if (write) {
        const target = path.join(REPO_ROOT, out ?? DEFAULT_OUT);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, render(c, pin(REPO_ROOT)), 'utf8');
        process.stdout.write(
            `semantic_parity_census: wrote ${path.relative(REPO_ROOT, target)}\n`,
        );
        return 0;
    }

    const counts: Record<Column, number> = { carried: 0, partial: 0, dropped: 0 };
    for (const r of c.fields) counts[r.column] += 1;
    process.stdout.write(
        `semantic_parity_census · ${String(c.fields.length)} schema field(s): ` +
            `${String(counts.carried)} carried, ${String(counts.partial)} partial, ${String(counts.dropped)} dropped\n`,
    );
    process.stdout.write(`  corpus: ${String(c.scanned)} SKILL.md file(s)\n`);
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
