/**
 * Is the payload census still measuring everything payload-shaped?
 *
 * WHY THIS EXISTS — prerequisite 4c of the measured-ceiling verdict
 * -----------------------------------------------------------------
 * An AI council (2/2, 2026-09-10) named a gap neither earlier round had: *"a
 * pull request can move payload into a location the measurement does not
 * enumerate, and no ceiling formula sees that."* Both seats were equally clear
 * that this is NOT a reason to prefer a stored ceiling — the same move defeats
 * a stored number exactly as it defeats a measured one — so it is an
 * independent defect with its own mitigation: *"an exhaustiveness check that
 * fails when a payload-shaped file sits outside every known bucket."*
 *
 * TWO WAYS PAYLOAD ESCAPES THE CENSUS, AND BOTH ARE CHECKED
 * ----------------------------------------------------------
 * 1. A NEW PROJECTED TREE. Something lands under `dist/agent-src/` that a host
 *    loads into standing context, and no bucket covers it. Every directory
 *    there is therefore either a declared prefix-stable surface or carries an
 *    explicit on-demand classification WITH its reason. A tree that is neither
 *    reds until a human classifies it. "Unclassified" is the state this check
 *    exists to make loud; guessing on its behalf is what produced the gap.
 *
 * 2. A RULE BODY OUTSIDE THE RULES BUCKET. A file with rule frontmatter is
 *    standing payload by construction — the router delivers it — so one
 *    sitting outside `dist/agent-src/rules` is measured by nothing while
 *    behaving exactly like the thing that is measured.
 *
 * WHY THE ON-DEMAND LIST IS HERE AND NOT IN THE BUDGET JSON
 * ----------------------------------------------------------
 * Under prerequisite 3 the gate runs with the code as it exists at the BASE
 * ref, so anything that lives in code pins with it and a pull request cannot
 * widen its own enumeration. A classification kept in the config would be
 * head-side and editable by the change being measured, which is the trust
 * boundary the same verdict spent its sharpest finding on. The measured
 * evidence behind each reason stays in `preamble-payload-budget.json` →
 * `metric.excluded_buckets`, which is where a reader looks for the numbers;
 * this list carries the classification, not the measurement.
 *
 * WHAT IT DOES NOT CLAIM. It sees `dist/agent-src/`. A host that began loading
 * some other tree standing would not appear here at all, and no check in this
 * repository would notice. That reopen condition is the registry's own, stated
 * in `prefix_stable_surfaces.ts`, and this module does not pretend to cover it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { PREFIX_STABLE_SURFACES } from './prefix_stable_surfaces.js';

/** The root every projected tree lands under. */
export const PROJECTION_ROOT = 'dist/agent-src';

export interface OnDemandTree {
    /** Directory name directly under `dist/agent-src/`. */
    dir: string;
    /** Why it costs no standing tokens. A classification, not a measurement. */
    why: string;
}

/**
 * Trees that are projected but NOT standing payload.
 *
 * Each reason states the mechanism that keeps it off the preamble, because
 * "it is not standing" with no mechanism behind it is the assumption this
 * whole check exists to stop being made silently.
 */
export const ON_DEMAND_TREES: readonly OnDemandTree[] = [
    { dir: 'commands', why: 'a command body is read when its slash command is invoked, never preloaded' },
    { dir: 'contexts', why: 'loaded through load_context on demand; no rule declares load_context_eager' },
    { dir: 'ghostwriter', why: 'persona corpora read by the ghostwriter surface when it runs' },
    { dir: 'guidelines', why: 'reference material a skill or rule links to; fetched when followed' },
    { dir: 'packs', why: 'pack manifests read by the installer, not delivered into a session' },
    { dir: 'personas', why: 'measured at zero standing cost 2026-08-22 — written by generators, read by no host contract' },
    { dir: 'presets', why: 'installer input, not session content' },
    { dir: 'profiles', why: 'installer input, not session content' },
    { dir: 'scripts', why: 'executable support code; never rendered into a prompt' },
    { dir: 'templates', why: 'scaffolding copied on demand by authoring flows' },
    { dir: 'user-types', why: 'installer input, not session content' },
];

/** Files under a non-rules tree that legitimately carry rule frontmatter. */
const RULE_SHAPED_EXEMPT: readonly string[] = [
    // The rule scaffold a new rule is copied FROM. It is frontmatter by
    // definition and is delivered to nobody.
    'dist/agent-src/templates/rule.md',
];

const RULE_TYPE_LINE = /^type:\s*"?(always|auto|manual)"?\s*$/m;

function normalise(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

/** Directory names directly under the projection root that a surface covers. */
function declaredTopLevelDirs(): Set<string> {
    const out = new Set<string>();
    const prefix = PROJECTION_ROOT + '/';
    for (const s of PREFIX_STABLE_SURFACES) {
        const root = normalise(s.root);
        if (!root.startsWith(prefix)) continue;
        const rest = root.slice(prefix.length);
        const first = rest.split('/')[0];
        if (first !== undefined && first !== '') out.add(first);
    }
    return out;
}

function walkMarkdown(dir: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) walkMarkdown(abs, out);
        else if (e.isFile() && e.name.endsWith('.md')) out.push(abs);
    }
}

export interface CatalogueAudit {
    /** Empty when every projected tree is accounted for. */
    findings: string[];
    /** Top-level trees inspected — a zero here means the root moved. */
    treesSeen: number;
    /** Markdown files scanned for rule frontmatter outside the rules bucket. */
    filesScanned: number;
}

/**
 * Audit the projection for payload the census does not enumerate.
 *
 * Pure over the filesystem, and returns findings rather than throwing: the
 * caller decides whether an unclassified tree is a refusal or a report, and
 * the tests need to inspect the findings themselves.
 */
export function auditCatalogue(repoRoot: string): CatalogueAudit {
    const rootAbs = path.join(repoRoot, PROJECTION_ROOT);
    const findings: string[] = [];
    const declared = declaredTopLevelDirs();
    const onDemand = new Set(ON_DEMAND_TREES.map((t) => t.dir));

    let dirs: fs.Dirent[];
    try {
        dirs = fs.readdirSync(rootAbs, { withFileTypes: true });
    } catch {
        return {
            findings: [
                `${PROJECTION_ROOT} could not be read. The payload catalogue cannot be audited against a ` +
                    'projection root that is not there — regenerate it (`task sync`) before trusting a ' +
                    'green from this gate.',
            ],
            treesSeen: 0,
            filesScanned: 0,
        };
    }

    let treesSeen = 0;
    for (const d of dirs) {
        if (!d.isDirectory()) continue;
        treesSeen += 1;
        if (declared.has(d.name) || onDemand.has(d.name)) continue;
        findings.push(
            `${PROJECTION_ROOT}/${d.name}/ is projected but classified by nothing. It is neither a declared ` +
                'prefix-stable surface nor on the on-demand list, so the standing-payload census does not ' +
                'measure it and no ceiling can see what it costs. Classify it: add it to ' +
                'PREFIX_STABLE_SURFACES if a host loads it into standing context, or to ON_DEMAND_TREES ' +
                'with the mechanism that keeps it out. Do not leave it unclassified — the whole point of ' +
                'this check is that unclassified is the state nobody notices.',
        );
    }

    // Rule-shaped payload outside the rules bucket.
    const exempt = new Set(RULE_SHAPED_EXEMPT.map(normalise));
    let filesScanned = 0;
    for (const d of dirs) {
        if (!d.isDirectory() || declared.has(d.name)) continue;
        const files: string[] = [];
        walkMarkdown(path.join(rootAbs, d.name), files);
        for (const abs of files) {
            const rel = normalise(path.relative(repoRoot, abs));
            if (exempt.has(rel)) continue;
            filesScanned += 1;
            let head: string;
            try {
                // Frontmatter only — reading whole bodies over ~1,800 files is
                // the difference between a gate people run and one they skip.
                const fd = fs.openSync(abs, 'r');
                const buf = Buffer.alloc(2048);
                const n = fs.readSync(fd, buf, 0, 2048, 0);
                fs.closeSync(fd);
                head = buf.subarray(0, n).toString('utf-8');
            } catch {
                continue;
            }
            if (!head.startsWith('---')) continue;
            const end = head.indexOf('\n---', 3);
            const frontmatter = end === -1 ? head : head.slice(0, end);
            if (RULE_TYPE_LINE.test(frontmatter)) {
                findings.push(
                    `${rel} carries rule frontmatter but sits outside the measured rules bucket. A file the ` +
                        'router can deliver is standing payload whatever directory it is in, so this one costs ' +
                        'tokens the ceiling never sees. Move it under the rules surface, or — if it is a ' +
                        'scaffold that is delivered to nobody — add it to RULE_SHAPED_EXEMPT with that reason.',
                );
            }
        }
    }

    return { findings, treesSeen, filesScanned };
}
