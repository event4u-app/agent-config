/**
 * `agent-config doctor neighbours` — render the neighbour census.
 *
 * A separate entry point rather than another branch inside `cmd_doctor.ts`,
 * which sits 2,000 lines above the source-size ceiling: a verb this size does
 * not belong in a file that already cannot grow. The census itself is
 * `_lib/neighbour_census.ts`; everything here is presentation and the one
 * summary line the full `doctor` run links to.
 *
 * Refuses nothing. No label here removes, blocks, or rewrites a neighbour's
 * artifact — a label is a report, never a gate.
 *
 * It is no longer read-ONLY, and the two writes are named rather than implied.
 * Both land under `agents/reports/` and both are caches of this run's own
 * findings: `neighbour-scan.json`, the shape-scan verdicts the ranker reads on
 * the hook path, and `neighbour-overlap.json`, the cross-root pairs keyed by the
 * census digest. Nothing outside that directory is touched, and a failed write
 * is not a failed census.
 *
 * `--contradictions` (step 2.2) writes neither cache. It forms candidate pairs
 * and hands them to ONE council seat, whose question and transcript land under
 * gitignored `agents/runtime/council/`; with no council configured it prints
 * `n/a` and asks nobody.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

import {
    census,
    fileDigest,
    gatedEventsFrom,
    scanCachePath,
    type NeighbourCensus,
} from '../_lib/neighbour_census.js';
import { scanNeighbourBody, writeScanCache } from '../_lib/neighbour_scan.js';
import {
    RANK_NEIGHBOUR_ALWAYS_ON,
    RANK_NEIGHBOUR_SKILL,
    RANK_PROJECT,
    collisionPair,
    extractInstructions,
    modalityPairs,
    parseVerdicts,
    renderReview,
    reviewRows,
    seatPrompt,
    type CandidatePair,
    type InstructionSource,
    type ReviewRow,
} from '../_lib/neighbour_contradictions.js';
import { resolveAvailability } from '../council_availability_hook.js';
import { resolvePackageRoot } from '../_lib/package_root.js';
import {
    OVERLAP_THRESHOLD,
    CROSS_CACHE_NAME,
    cachedCrossRootPairs,
    crossRootOverlapMap,
} from '../audit_skill_overlap.js';

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

/**
 * The census, in two passes, and the second one is not an accident.
 *
 * The cross-root overlap can only be computed over the neighbour skills the
 * census FOUND — the unclaimed entries of two roots that also hold claimed ones,
 * since `agent-config install` writes this package's own skills into
 * `~/.claude/skills`. Pairing whole roots instead would compare our installed
 * copies against our own source tree and publish the install as an overlap. So
 * pass one finds them, the overlap runs over exactly those files, and pass two
 * labels them.
 *
 * The shape scan is memoized across both passes, so the four linters run once
 * per neighbour body rather than twice. The scan verdicts are then WRITTEN to
 * the cache the ranker reads on the hook path — this verb is the only producer,
 * which is why its absence reads there as `no-scan-record` rather than as a pass.
 */
export function runCensus(
    projectRoot: string,
    packageRoot: string,
    homeRoot?: string,
): NeighbourCensus {
    const scanned = new Map<string, string | null>();
    const scan = (p: string): string | null => {
        const hit = scanned.get(p);
        if (hit !== undefined) return hit;
        const kind = scanNeighbourBody(p).kind;
        scanned.set(p, kind);
        return kind;
    };
    const base = {
        gatedEvents: gatedEvents(packageRoot),
        templatesRoot: path.join(packageRoot, 'src', 'agent-src', 'templates'),
        ourSkillNames: ourSkillNames(packageRoot),
        packageRoot,
        scan,
        ...(homeRoot === undefined ? {} : { homeRoot }),
    };
    const first = census(projectRoot, base);
    const ourRoot = path.join(packageRoot, 'src', 'skills');
    let overlaps = new Map<string, { names: string[]; similarity: number }>();
    if (first.skills.length > 0 && fs.existsSync(ourRoot)) {
        try {
            const { pairs } = cachedCrossRootPairs(
                first.skills.map((s) => s.source),
                ourRoot,
                path.join(projectRoot, 'agents', 'reports', CROSS_CACHE_NAME),
                OVERLAP_THRESHOLD,
            );
            overlaps = crossRootOverlapMap(pairs);
        } catch {
            // An overlap pass that cannot run leaves every entry unlabelled by
            // it, which reads as `unclassified` — the absence of a signal — and
            // never as a claim that the pair is disjoint.
        }
    }
    const full = census(projectRoot, { ...base, overlaps });
    writeScanCache(
        scanCachePath(projectRoot),
        // `fileDigest`, not the census's own `digest`: the ranker re-digests the
        // file bytes it is about to index, and a cache written under a different
        // digest function would read as `digest-changed` on every prompt.
        full.skills.map((s) => ({
            qualified: s.qualified,
            digest: fileDigest(s.source) ?? '',
            unscanned: s.unscanned,
        })),
    );
    return full;
}

/**
 * Candidate pairs for `--contradictions` (step 2.2), READ-ONLY.
 *
 * Calls `census()` directly rather than `runCensus()`, because the latter
 * writes the scan and overlap caches and this mode promises to change no file.
 * The shape scan still runs, and a refused neighbour body contributes no line.
 */
export function contradictionCandidates(
    projectRoot: string,
    packageRoot: string,
    homeRoot?: string,
): CandidatePair[] {
    const ours = ourSkillNames(packageRoot);
    const c = census(projectRoot, {
        gatedEvents: gatedEvents(packageRoot),
        templatesRoot: path.join(packageRoot, 'src', 'agent-src', 'templates'),
        ourSkillNames: ours,
        packageRoot,
        scan: (p) => scanNeighbourBody(p).kind,
        ...(homeRoot === undefined ? {} : { homeRoot }),
    });
    const sources: InstructionSource[] = [];
    for (const name of ['CLAUDE.md', 'AGENTS.md']) {
        const file = path.join(projectRoot, name);
        if (fs.existsSync(file)) sources.push({ label: name, file, rank: RANK_PROJECT });
    }
    for (const r of c.rule_files) {
        if (scanNeighbourBody(r.source).kind === null) {
            sources.push({ label: r.id, file: r.source, rank: RANK_NEIGHBOUR_ALWAYS_ON });
        }
    }
    for (const s of c.skills) {
        if (s.unscanned === null) sources.push({ label: s.qualified, file: s.source, rank: RANK_NEIGHBOUR_SKILL });
    }
    const pairs = modalityPairs(sources.flatMap((src) => extractInstructions(src)));
    for (const s of c.skills) {
        const name = s.qualified.split(':').slice(1).join(':') || s.qualified;
        if (ours.has(name)) pairs.push(collisionPair(s.qualified, name));
    }
    return pairs;
}

/** One council seat, run through the council CLI; `null` when it cannot answer. */
export type Seat = (prompt: string) => string | null;

function councilSeat(projectRoot: string): Seat {
    return (prompt) => {
        const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
        const q = path.join(projectRoot, 'agents', 'runtime', 'council', 'questions', `neighbour-contradictions-${stamp}.md`);
        const out = path.join(projectRoot, 'agents', 'runtime', 'council', 'responses', `neighbour-contradictions-${stamp}.md`);
        try {
            fs.mkdirSync(path.dirname(q), { recursive: true });
            fs.writeFileSync(q, prompt, 'utf-8');
            const args = ['council', 'run', q, '--single', '--prompt-mode', 'analysis', '--output', out, '--confirm', '--invocation', 'user_explicit'];
            const res = spawnSync('agent-config', args, { cwd: projectRoot, encoding: 'utf-8' });
            if (res.status !== 0) return null;
            const doc = JSON.parse(fs.readFileSync(out, 'utf-8')) as { responses?: { text?: string }[] };
            return doc.responses?.map((r) => r.text ?? '').join('\n') ?? null;
        } catch {
            return null;
        }
    };
}

/**
 * `--contradictions`: a verdict table, or `n/a` when no council is configured.
 *
 * Report-only — it edits nothing and gates nothing. The council transcript the
 * seat writes lands under gitignored `agents/runtime/council/`; no tracked file
 * changes.
 */
export function runContradictions(
    projectRoot: string,
    packageRoot: string,
    opts: { homeRoot?: string; seat?: Seat; configured?: boolean } = {},
): { lines: string[]; rows: ReviewRow[] | null } {
    const configured =
        opts.configured ?? resolveAvailability(projectRoot, process.env)?.configured ?? false;
    const pairs = contradictionCandidates(projectRoot, packageRoot, opts.homeRoot);
    if (!configured) {
        return {
            lines: [`  contradictions: n/a — no council configured (${pairs.length} candidate pair(s) formed, none reviewed)`],
            rows: null,
        };
    }
    if (pairs.length === 0) return { lines: renderReview([]), rows: [] };
    let rubric = '';
    for (const rel of [['dist', 'agent-src', 'rules'], ['src', 'rules']]) {
        try {
            rubric = fs.readFileSync(path.join(packageRoot, ...rel, 'neighbour-precedence.md'), 'utf-8');
            break;
        } catch {
            // Try the next layout.
        }
    }
    const answer = (opts.seat ?? councilSeat(projectRoot))(seatPrompt(pairs, rubric));
    if (answer === null) {
        return { lines: [`  contradictions: n/a — the council seat did not answer (${pairs.length} candidate pair(s) formed)`], rows: null };
    }
    const rows = reviewRows(pairs, parseVerdicts(answer, pairs.length));
    return { lines: renderReview(rows), rows };
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
    if (c.skills.length > 0) {
        out.push('');
        out.push(`  skills (${c.skills.length})`);
        for (const s of c.skills) {
            const also = s.also.length === 0 ? '' : ` also: ${s.also.join(', ')}`;
            const why = s.unscanned === null ? '' : ` unscanned: ${s.unscanned}`;
            out.push(`      ${s.qualified}  compat: ${s.compat}${also}${why}`);
        }
    }
    section('commands', c.commands);
    section('agents', c.agents);
    if (c.mcp_servers.length > 0) {
        out.push('');
        out.push(`  mcp servers (${c.mcp_servers.length})`);
        for (const m of c.mcp_servers) {
            // `used` and `advertised` are printed side by side so the reader
            // never takes the first for a coverage ratio: the denominator is
            // not missing by accident, it is not obtainable without launching
            // the neighbour's process, which this census does not do.
            out.push(
                `      ${m.id}  tools used (${m.tools_window_days}d): ${m.tools_used_30d}` +
                    `  advertised: ${m.tools_advertised}`,
            );
        }
    }
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
    let contradictions = false;
    let root = process.cwd();
    let home: string | undefined;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--json') json = true;
        else if (argv[i] === '--contradictions') contradictions = true;
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
    if (contradictions) {
        const r = runContradictions(path.resolve(root), resolvePackageRoot(import.meta.url), home === undefined ? {} : { homeRoot: home });
        if (json) process.stdout.write(`${JSON.stringify({ contradictions: r.rows })}\n`);
        else for (const line of r.lines) process.stdout.write(`${line}\n`);
        return 0;
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
 * Same entry guard the sibling CLIs use — including the delegate branch, which
 * an earlier version of this file left out and which the delegate smoke test
 * caught: `no bundle is a silent no-op` reported `cmd_doctor_neighbours.js (no
 * output, exit 0)`, the exact shape the paragraph below describes.
 *
 * Inside the cli-delegate bundle `--splitting` moves this module's body into a
 * shared chunk, so the URL comparison weighs the CHUNK against `argv[1]` and
 * never matches. `agent-config doctor` shipped that way once already — a
 * diagnostic reporting success while saying nothing. The invoked file name is
 * the reliable signal there; a miss falls THROUGH to the realpath comparison
 * rather than returning false, so a symlinked or renamed invocation still
 * resolves. Inlined into the installer / hook / MCP bundle instead, it must
 * never auto-run, which is why one "am I bundled" flag cannot answer "may I
 * run" and both flags are read.
 */
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
declare const __AGENT_CONFIG_CLI_DELEGATE__: boolean | undefined;

function _isCliEntry(): boolean {
    const bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
    const cliDelegate =
        typeof __AGENT_CONFIG_CLI_DELEGATE__ !== 'undefined' && __AGENT_CONFIG_CLI_DELEGATE__;
    if (bundled && !cliDelegate) return false;
    if (process.argv[1] === undefined) return false;
    if (cliDelegate && path.basename(process.argv[1], '.js') === 'cmd_doctor_neighbours') {
        return true;
    }
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
