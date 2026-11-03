#!/usr/bin/env tsx
/**
 * Which owned skills keep their description in the host listing — today's
 * alphabetical fill against the stated priority order, side by side.
 *
 * `road-to-a-resident-set-chosen-on-purpose` step 1.2. A REPORT, never a gate:
 * exit 0 always, and a `report_` prefix so the gate population classifies it
 * out. It changes nothing the installer writes; switching `computeOverrides`
 * to the priority order waits on a measured listing-arm baseline.
 *
 * The alphabetical arm is computed over the same catalogue reader
 * `computeOverrides` uses, and the test fails if the two stop agreeing — a
 * report whose baseline is not the installer's output would compare against
 * nothing.
 *
 * Usage: `./scripts-run src/scripts/report_resident_set [--json]`
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    type CatalogueEntry,
    type HostListingModelInput,
    modelListingBudget,
    residentPriorityOrder,
} from './_lib/host_listing_model.js';
import { loadResidentPriorityInputs, type ResidentPriorityInputs } from './_lib/resident_priority_inputs.js';
import { ownedCatalogue } from './_lib/skill_listing_overrides.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const WINDOWS = [200_000, 1_000_000] as const;

export interface Split {
    described: string[];
    bare: string[];
}

export interface WindowReport {
    contextWindowTokens: number;
    alphabetical: Split;
    priority: Split;
}

export type Status = 'described' | 'name-only';

export interface RoutedRow {
    name: string;
    /** Rules whose `routes_to:` names this skill. */
    rules: number;
    status:
        | { contextWindowTokens: number; alphabetical: Status; priority: Status }[]
        | 'not-in-catalogue';
}

export interface ResidentSetReport {
    catalogue: CatalogueEntry[];
    windows: WindowReport[];
    routed: RoutedRow[];
}

type ModelOptions = Omit<HostListingModelInput, 'contextWindowTokens' | 'usageOrder'>;

export function buildResidentSetReport(
    catalogue: readonly CatalogueEntry[],
    inputs: ResidentPriorityInputs,
    options: ModelOptions = {},
): ResidentSetReport {
    const order = residentPriorityOrder(catalogue, inputs.routesTo, inputs.packMembers);
    const windows: WindowReport[] = WINDOWS.map((contextWindowTokens) => {
        const alpha = modelListingBudget(catalogue, { ...options, contextWindowTokens });
        const prio = modelListingBudget(catalogue, { ...options, contextWindowTokens, usageOrder: order });
        return {
            contextWindowTokens,
            alphabetical: { described: alpha.surviving, bare: alpha.bare },
            priority: { described: prio.surviving, bare: prio.bare },
        };
    });
    const names = new Set(catalogue.map((e) => e.name));
    const routedNames = [...inputs.routesTo.entries()]
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const statusOf = (split: Split, n: string): Status => (split.described.includes(n) ? 'described' : 'name-only');
    const routed: RoutedRow[] = routedNames.map(([name, rules]) => ({
        name,
        rules,
        status: names.has(name)
            ? windows.map((w) => ({
                  contextWindowTokens: w.contextWindowTokens,
                  alphabetical: statusOf(w.alphabetical, name),
                  priority: statusOf(w.priority, name),
              }))
            : 'not-in-catalogue',
    }));
    return { catalogue: [...catalogue], windows, routed };
}

/** The report over this repository's own `src/skills` and `src/rules`. */
export function repoReport(root: string = REPO_ROOT): ResidentSetReport {
    const skillsDir = path.join(root, 'src', 'skills');
    const owned = fs
        .readdirSync(skillsDir)
        .filter((slug) => fs.existsSync(path.join(skillsDir, slug, 'SKILL.md')))
        .sort();
    const inputs = loadResidentPriorityInputs(path.join(root, 'src', 'rules'), skillsDir);
    return buildResidentSetReport(ownedCatalogue(skillsDir, owned), inputs);
}

function render(r: ResidentSetReport): string {
    const L: string[] = [`owned skills: ${String(r.catalogue.length)}`, ''];
    L.push('| window | arm | described | name-only |', '|---|---|---|---|');
    for (const w of r.windows) {
        for (const [arm, s] of [['alphabetical', w.alphabetical], ['priority', w.priority]] as const) {
            L.push(`| ${String(w.contextWindowTokens)} | ${arm} | ${String(s.described.length)} | ${String(s.bare.length)} |`);
        }
    }
    L.push('', `routes_to targets: ${String(r.routed.length)}`, '');
    L.push(`| skill | rules | ${r.windows.map((w) => `${String(w.contextWindowTokens)} alpha / prio`).join(' | ')} |`);
    L.push(`|---|---|${r.windows.map(() => '---').join('|')}|`);
    for (const row of r.routed) {
        const cells =
            row.status === 'not-in-catalogue'
                ? r.windows.map(() => 'not in catalogue')
                : row.status.map((s) => `${s.alphabetical} / ${s.priority}`);
        L.push(`| ${row.name} | ${String(row.rules)} | ${cells.join(' | ')} |`);
    }
    return `${L.join('\n')}\n`;
}

export function main(argv: readonly string[]): number {
    const report = repoReport();
    if (argv.includes('--json')) {
        const { catalogue, ...rest } = report;
        process.stdout.write(`${JSON.stringify({ owned: catalogue.length, ...rest }, null, 2)}\n`);
    } else {
        process.stdout.write(render(report));
    }
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main(process.argv.slice(2)));
}
