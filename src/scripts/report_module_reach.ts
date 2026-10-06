#!/usr/bin/env tsx
/**
 * Report — which `_lib` modules does nothing in production call?
 *
 * A REPORT, not a gate: it always exits 0. Phase 3 of
 * `road-to-modules-that-something-calls.md` wires its counts into
 * `check_gate_reachability`'s own output, reported and not gated, the way
 * the estate gate already prints its draft-roadmap count.
 *
 * ```bash
 *   report_module_reach                 # human-readable, one line per module
 *   report_module_reach --markdown      # the four tables, for the evidence page
 *   report_module_reach --json
 * ```
 */
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as fs from 'node:fs';

import { analyseModuleReach, groupCounts, type ModuleFact, type ReachGroup } from './_lib/module_reach.js';
import { assertScanned, reportScanned } from './_lib/scan_scope.js';

const _FILE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_FILE), '..', '..');

const GROUP_LABEL: Record<ReachGroup, string> = {
    'contract-test': 'imported by a test under tests/contracts/',
    'open-or-deferred-step': 'named in an open or deferred step',
    'named-outside-open-step': 'named in such a roadmap outside any open step',
    'named-in-none': 'named in no live roadmap',
};

function humanLine(m: ModuleFact): string {
    const bits = [
        `${m.lines}L`,
        m.namedByProduction ? 'named-by-production' : 'UNREFERENCED',
        m.reachedByImportOrPath ? 'reached' : 'REACHED-BY-NOTHING',
        m.hasOwnEntryPoint ? 'has-entry-point' : null,
        m.registryDeclared.length > 0 ? `registry:[${m.registryDeclared.join(',')}]` : null,
        m.importingTests.length > 0 ? `tests:${String(m.importingTests.length)}` : 'tests:0',
        m.group !== null ? `group:${m.group}` : null,
    ].filter((b): b is string => b !== null);
    return `  ${m.relPath} — ${bits.join(' · ')}`;
}

export function human(modules: readonly ModuleFact[]): string {
    const unreferenced = modules.filter((m) => !m.namedByProduction);
    const unreached = modules.filter((m) => !m.reachedByImportOrPath);
    const counts = groupCounts(unreferenced);
    const lines: string[] = [];
    lines.push(
        `module reach: ${String(modules.length)} module(s) under src/scripts/_lib — ` +
            `${String(unreferenced.length)} unreferenced by name, ${String(unreached.length)} reached by nothing`,
    );
    for (const m of modules) lines.push(humanLine(m));
    lines.push('');
    lines.push('unreferenced-by-name groups:');
    for (const g of Object.keys(GROUP_LABEL) as ReachGroup[]) {
        lines.push(`  ${GROUP_LABEL[g]}: ${String(counts[g])}`);
    }
    return lines.join('\n');
}

function table(modules: readonly ModuleFact[], header: readonly string[], row: (m: ModuleFact) => string[]): string {
    const lines = [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`];
    for (const m of modules) lines.push(`| ${row(m).join(' | ')} |`);
    return lines.join('\n');
}

export function markdown(modules: readonly ModuleFact[], roadmapsAvailable: boolean): string {
    const unreferenced = modules.filter((m) => !m.namedByProduction);
    const unreached = modules.filter((m) => !m.reachedByImportOrPath);
    const byGroup = (g: ReachGroup): ModuleFact[] => unreferenced.filter((m) => m.group === g);

    const lines: string[] = [];
    lines.push('<!-- evidence-type: analysis -->');
    lines.push('# Module reach — 2026-10');
    lines.push('');
    lines.push(
        `Command: \`npx tsx src/scripts/report_module_reach.ts --markdown\`. ` +
            `${String(modules.length)} module(s) directly under \`src/scripts/_lib/\`, ` +
            `${String(unreferenced.length)} named in no file outside themselves and their own tests, ` +
            `${String(unreached.length)} reached by nothing via import edges or run-by-path.`,
    );
    lines.push('');
    if (!roadmapsAvailable) {
        lines.push('> No `agents/roadmaps/` directory in this checkout — the two roadmap-based groups below are skipped.');
        lines.push('');
    }

    lines.push('## Group 1 — imported by a contract test');
    lines.push('');
    lines.push(table(byGroup('contract-test'), ['module', 'lines', 'evidence'], (m) => [m.relPath, String(m.lines), m.groupEvidence ?? '']));
    lines.push('');

    lines.push('## Group 2 — named in an open or deferred step');
    lines.push('');
    lines.push(
        table(byGroup('open-or-deferred-step'), ['module', 'lines', 'evidence'], (m) => [
            m.relPath,
            String(m.lines),
            m.groupEvidence ?? '',
        ]),
    );
    lines.push('');

    lines.push('## Group 3 — named in such a roadmap outside any open step');
    lines.push('');
    lines.push(
        table(byGroup('named-outside-open-step'), ['module', 'lines', 'evidence'], (m) => [
            m.relPath,
            String(m.lines),
            m.groupEvidence ?? '',
        ]),
    );
    lines.push('');

    lines.push('## Group 4 — named in no live roadmap');
    lines.push('');
    lines.push(
        table(byGroup('named-in-none'), ['module', 'lines', 'importing tests'], (m) => [
            m.relPath,
            String(m.lines),
            String(m.importingTests.length),
        ]),
    );
    lines.push('');

    lines.push('## Every module under `_lib` — full facts');
    lines.push('');
    lines.push(
        table(
            modules,
            ['module', 'lines', 'importing tests', 'named by production', 'has entry point', 'registry', 'reached'],
            (m) => [
                m.relPath,
                String(m.lines),
                String(m.importingTests.length),
                m.namedByProduction ? 'yes' : 'no',
                m.hasOwnEntryPoint ? 'yes' : 'no',
                m.registryDeclared.length > 0 ? m.registryDeclared.join(', ') : '—',
                m.reachedByImportOrPath ? 'yes' : 'no',
            ],
        ),
    );
    lines.push('');

    // Phase 2.1: one `reading:` line per fourth-group module — never the
    // whole unreferenced set, which also holds groups 1-3 that Phase 2
    // explicitly leaves untouched. The content here is a placeholder; the
    // real verdict (test-carried / helper-never-connected / only-caller-is-
    // its-own-test) is a judgement call a re-run of this script cannot make,
    // and is filled in by hand after reading each module and its test.
    for (const m of byGroup('named-in-none')) {
        lines.push(`reading: ${m.relPath} — TODO: read the module and its test, then state the verdict`);
    }

    return lines.join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2), root = REPO): number {
    const { modules, roadmapsAvailable } = analyseModuleReach(root);
    // One options literal, not three (a second R2 review found it triplicated
    // across the --json, --markdown and default branches).
    const scanOpts = {
        gate: 'report_module_reach',
        scanned: modules.length,
        units: 'module(s) under src/scripts/_lib',
        roots: ['src/scripts/_lib'],
    };
    if (argv.includes('--json')) {
        // No trailing `scanned:` line here — an R2 review found that
        // `reportScanned` (which PRINTS) made this invalid as a single JSON
        // document; `check_gate_reachability.ts`'s own `--json` branch already
        // returns immediately after writing JSON for the same reason. The
        // scope is still ASSERTED (never silently printed clean from an empty
        // corpus).
        assertScanned(scanOpts);
        process.stdout.write(`${JSON.stringify({ modules, roadmapsAvailable }, null, 2)}\n`);
    } else if (argv.includes('--markdown')) {
        // The page is the artifact — no trailing `scanned:` line inside it,
        // but the scope is still asserted (never silently printed clean from
        // an empty corpus). The default human mode below is the only one that
        // still publishes the count per this family's convention.
        assertScanned(scanOpts);
        process.stdout.write(`${markdown(modules, roadmapsAvailable)}\n`);
    } else {
        process.stdout.write(`${human(modules)}\n`);
        // Emitted AFTER the format, not before: `--markdown` output is
        // redirected straight into the evidence page (Phase 1.2), and a
        // `scanned:` line prepended to a markdown document would land above
        // its `<!-- evidence-type -->` marker — moot here, but kept after for
        // consistency with the other two branches.
        reportScanned(scanOpts);
    }
    return 0;
}

function _isCliEntry(): boolean {
    const a = process.argv[1];
    if (!a) return false;
    if (a === _FILE || pathToFileURL(path.resolve(a)).href === import.meta.url) return true;
    try {
        return fs.realpathSync(a) === fs.realpathSync(_FILE);
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main());

export { REPO };
