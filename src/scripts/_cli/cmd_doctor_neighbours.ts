/**
 * `agent-config doctor neighbours` — render the neighbour census.
 *
 * A separate entry point rather than another branch inside `cmd_doctor.ts`,
 * which sits 2,000 lines above the source-size ceiling: a verb this size does
 * not belong in a file that already cannot grow. The census itself is
 * `_lib/neighbour_census.ts`; everything here is presentation and the one
 * summary line the full `doctor` run links to.
 *
 * Read-only by construction. Nothing in this path writes, removes, or refuses
 * anything — a label is a report, never a gate.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

import {
    census,
    gatedEventsFrom,
    type NeighbourCensus,
} from '../_lib/neighbour_census.js';
import { resolvePackageRoot } from '../_lib/package_root.js';

interface ManifestShape {
    concerns?: Record<string, { effect?: string }>;
    platforms?: Record<string, Record<string, unknown>>;
    native_event_aliases?: Record<string, Record<string, string>>;
}

/** Read the hook manifest for the events a `permission` concern of ours sits on. */
function gatedEvents(packageRoot: string): Set<string> {
    try {
        // A missing or unreadable manifest yields an empty gate set, which
        // downgrades `degraded` to `coordinated` rather than inventing a gate
        // that is not there.
        const file = path.join(packageRoot, 'src', 'scripts', 'hook_manifest.yaml');
        const doc = YAML.parse(fs.readFileSync(file, 'utf-8')) as ManifestShape;
        return gatedEventsFrom(doc, doc.native_event_aliases ?? {});
    } catch {
        return new Set<string>();
    }
}

/** This package's own skill names, for the `shadowed` warning. */
function ourSkillNames(packageRoot: string): Set<string> {
    try {
        return new Set(
            fs
                .readdirSync(path.join(packageRoot, 'src', 'skills'), { withFileTypes: true })
                .filter((e) => e.isDirectory())
                .map((e) => e.name),
        );
    } catch {
        return new Set<string>();
    }
}

export function runCensus(
    projectRoot: string,
    packageRoot: string,
    homeRoot?: string,
): NeighbourCensus {
    return census(projectRoot, {
        gatedEvents: gatedEvents(packageRoot),
        templatesRoot: path.join(packageRoot, 'src', 'agent-src', 'templates'),
        ourSkillNames: ourSkillNames(packageRoot),
        ...(homeRoot === undefined ? {} : { homeRoot }),
    });
}

/** The one line the full `doctor` run prints, linking to this verb. */
export function summaryLine(c: NeighbourCensus): string {
    const counts = [
        `${c.hook_groups.length} hook group(s)`,
        `${c.skills.length} skill(s)`,
        `${c.commands.length} command(s)`,
        `${c.agents.length} agent(s)`,
        `${c.mcp_servers.length} mcp server(s)`,
        `${c.rule_files.length} rule file(s)`,
        `${c.instruction_sections.length} instruction section(s)`,
    ].join(', ');
    const labels = c.hosts.map((h) => `${h.host}=${h.label}`).join(' ');
    return `  🏘️   neighbours: ${counts}${labels === '' ? '' : ` · ${labels}`} (run \`doctor neighbours\` for the census)`;
}

export function renderText(c: NeighbourCensus): string[] {
    const out: string[] = [];
    out.push(`  📍  project_root: ${c.project_root}`);
    out.push('');
    for (const h of c.hosts) {
        out.push(`  ${h.host}: ${h.label} — ${h.label_reason}`);
        for (const e of h.hook_groups) {
            const matcher = e.matcher === null ? '' : ` matcher=${e.matcher}`;
            const timeout = e.timeout === null ? '' : ` timeout=${e.timeout}`;
            out.push(`      ${e.event}: ${e.command_head}${matcher}${timeout} effect=${e.effect}`);
        }
    }
    const section = (title: string, rows: ReadonlyArray<{ id: string }>): void => {
        if (rows.length === 0) return;
        out.push('');
        out.push(`  ${title} (${rows.length})`);
        for (const r of rows) out.push(`      ${r.id}`);
    };
    section('skills', c.skills);
    section('commands', c.commands);
    section('agents', c.agents);
    section('mcp servers', c.mcp_servers);
    section('rule files', c.rule_files);
    section('instruction sections', c.instruction_sections);
    if (c.warnings.length > 0) {
        out.push('');
        for (const w of c.warnings) out.push(`  ⚠️   ${w.kind}: ${w.detail}`);
    }
    out.push('');
    out.push(
        '  The host owns load order. This census says what is there and what each entry would do;',
    );
    out.push('  it cannot say what ran first, and no label here refuses anything.');
    return out;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let json = false;
    let root = process.cwd();
    let home: string | undefined;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--json') json = true;
        else if (argv[i] === '--project') {
            root = argv[i + 1] ?? root;
            i += 1;
        } else if (argv[i] === '--home') {
            // Fixture-only: the user-scope half of the census is real `$HOME`
            // in production, and a test must be able to plant one.
            home = argv[i + 1];
            i += 1;
        } else if (argv[i] === 'neighbours') {
            continue;
        } else {
            process.stderr.write(`doctor neighbours: unknown argument: ${argv[i]}\n`);
            return 2;
        }
    }
    const c = runCensus(path.resolve(root), resolvePackageRoot(import.meta.url), home);
    if (json) {
        // Compact, not pretty-printed: this is the machine contract, and the
        // gate that reads it matches on adjacency rather than on indentation.
        process.stdout.write(`${JSON.stringify(c)}\n`);
    } else {
        for (const line of renderText(c)) process.stdout.write(`${line}\n`);
    }
    return 0;
}

/**
 * Same entry guard the sibling CLIs use. Without it this file imports cleanly
 * and runs nothing — the silent exit-0-with-no-output shape `cmd_doctor`'s own
 * guard comment calls out by name.
 */
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
