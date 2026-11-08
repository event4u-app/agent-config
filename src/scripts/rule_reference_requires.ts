/**
 * The requires table — which references an act needs in context, derived from
 * rule frontmatter alone.
 *
 * An act is a trigger that names something the agent does rather than something
 * it says: `path_prefix`, `file_pattern`, `command`, or a `shell_command` bound in
 * `src/config/act-references.json`. A keyword or phrase trigger
 * names a prompt, so a rule whose references hang only on those is reachable by
 * no act and is listed under `no_act` instead of being dropped.
 *
 * Marking is read from the rule, not judged: a `consequence_class` makes the
 * reference `required` (ADR-293 never thins those), `type: manual` makes it
 * `informational`, anything else is `conditional`.
 *
 * A reference larger than the inject budget is `omitted-budget` — delivering it
 * through a hook would be cut to a preview — and a reference whose file does not
 * exist is `missing`. Rule text is never copied into the table.
 *
 * Usage: rule_reference_requires [--json] [--rules <dir>] [--contexts <dir>]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import actReferences from '../config/act-references.json';
import { parseFrontmatter } from './preamble_byte_census.js';

/** Mirrors `COMPOSED_CHARS` in `hooks/rule_inject_hook.ts`; a test holds them equal. */
export const INJECT_BUDGET_CHARS = 8000;

const ACT_KINDS = ['path_prefix', 'file_pattern', 'command', 'shell_command'] as const;
type ActKind = (typeof ACT_KINDS)[number];

export interface Reference {
    path: string;
    chars: number;
    status: 'fits' | 'omitted-budget' | 'missing';
}
export interface RequiresRow {
    rule: string;
    act: { kind: ActKind; value: string };
    marking: 'required' | 'conditional' | 'informational';
    references: Reference[];
}
export interface RequiresTable {
    rows: RequiresRow[];
    no_act: string[];
    summary: {
        rules_with_references: number;
        acts_by_kind: Partial<Record<ActKind, number>>;
        references_missing: number;
        references_over_budget: number;
    };
}

function reference(rel: string, contextsRoot: string): Reference {
    let chars: number;
    try {
        chars = fs.readFileSync(path.join(contextsRoot, rel), 'utf8').length;
    } catch {
        return { path: rel, chars: 0, status: 'missing' };
    }
    return { path: rel, chars, status: chars > INJECT_BUDGET_CHARS ? 'omitted-budget' : 'fits' };
}

export interface ActBinding {
    shell_command: string;
    rules: string[];
}

/**
 * The requires table. `shell_command` rows come from `src/config/act-references.json`,
 * which binds a shell act to rule ids (kernel rules included — it is not a router
 * trigger); the references themselves are still each rule's own `load_context`.
 */
export function buildRequiresTable(
    rulesDir: string,
    contextsRoot: string,
    bindings: readonly ActBinding[] = actReferences.bindings,
): RequiresTable {
    const rows: RequiresRow[] = [];
    const no_act: string[] = [];
    const acts_by_kind: Partial<Record<ActKind, number>> = {};
    let withRefs = 0;
    let missing = 0;
    let over = 0;
    for (const file of fs.readdirSync(rulesDir).filter((n) => n.endsWith('.md')).sort()) {
        const fm = parseFrontmatter(fs.readFileSync(path.join(rulesDir, file), 'utf8')) as Record<string, unknown>;
        const refs = Array.isArray(fm['load_context']) ? (fm['load_context'] as unknown[]).filter((x): x is string => typeof x === 'string') : [];
        if (refs.length === 0) continue;
        withRefs += 1;
        const rule = file.slice(0, -3);
        const references = refs.map((r) => reference(r, contextsRoot));
        missing += references.filter((r) => r.status === 'missing').length;
        over += references.filter((r) => r.status === 'omitted-budget').length;
        const marking: RequiresRow['marking'] = typeof fm['consequence_class'] === 'string' ? 'required' : fm['type'] === 'manual' ? 'informational' : 'conditional';
        const triggers = Array.isArray(fm['triggers']) ? (fm['triggers'] as unknown[]) : [];
        let acts = 0;
        for (const b of bindings) {
            if (!b.rules.includes(rule)) continue;
            rows.push({ rule, act: { kind: 'shell_command', value: b.shell_command }, marking, references });
            acts_by_kind.shell_command = (acts_by_kind.shell_command ?? 0) + 1;
            acts += 1;
        }
        for (const t of triggers) {
            if (typeof t !== 'object' || t === null) continue;
            for (const kind of ACT_KINDS) {
                const value = (t as Record<string, unknown>)[kind];
                if (typeof value !== 'string') continue;
                rows.push({ rule, act: { kind, value }, marking, references });
                acts_by_kind[kind] = (acts_by_kind[kind] ?? 0) + 1;
                acts += 1;
            }
        }
        if (acts === 0) no_act.push(rule);
    }
    return { rows, no_act, summary: { rules_with_references: withRefs, acts_by_kind, references_missing: missing, references_over_budget: over } };
}

export function renderRequiresTable(t: RequiresTable): string {
    const s = t.summary;
    const kinds = ACT_KINDS.map((k) => `${k} ${String(s.acts_by_kind[k] ?? 0)}`).join(' · ');
    return [
        `Requires table — ${String(s.rules_with_references)} rule(s) with load_context, ${String(t.rows.length)} act row(s) (${kinds})`,
        `References: ${String(s.references_over_budget)} over the ${String(INJECT_BUDGET_CHARS)}-char inject budget, ${String(s.references_missing)} missing`,
        `Reachable by no act (keyword/phrase only): ${t.no_act.length === 0 ? 'none' : t.no_act.join(', ')}`,
        '',
        ...t.rows.map((r) => `  ${r.marking.padEnd(13)} ${`${r.act.kind}:${r.act.value}`.padEnd(40)} ${r.rule} → ${r.references.map((x) => `${x.path} (${x.status})`).join(', ')}`),
    ].join('\n');
}

function main(argv: readonly string[]): number {
    const arg = (flag: string, fallback: string): string => {
        const i = argv.indexOf(flag);
        return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : fallback;
    };
    const table = buildRequiresTable(arg('--rules', 'src/rules'), arg('--contexts', 'src/agent-src'));
    process.stdout.write(argv.includes('--json') ? `${JSON.stringify(table, null, 2)}\n` : `${renderRequiresTable(table)}\n`);
    return 0;
}

function isCliEntry(): boolean {
    const entry = process.argv[1];
    if (entry === undefined) return false;
    return pathToFileURL(path.resolve(entry)).href === pathToFileURL(fileURLToPath(import.meta.url)).href;
}

if (isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
