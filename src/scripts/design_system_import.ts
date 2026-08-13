#!/usr/bin/env tsx
/**
 * Import an extracted design system into the `design-system.json` contract.
 *
 * Producer-side half of the contract in
 * `design-system-capture/references/design-system-json.md`
 * (road-to-design-system-onramp Phase 1). Three input lanes — a native
 * artifact, a W3C DTCG token file, or an extraction tool's raw JSON — one
 * output shape.
 *
 * **Pure and offline by construction.** It reads a file, transforms it, and
 * writes to stdout. No network, no browser, no crawl: the package owns the
 * contract and not the crawler (council 2026-06-28), and a transform that
 * fetched would quietly become the thing the lock forbids.
 *
 * The output is a **proposal**, never an applied change. It is handed to
 * `design-system-capture`, whose import step confirms it per field against
 * `DESIGN.md` and flags — never auto-applies — anything that conflicts with a
 * registered brand token.
 *
 * CLI:
 *
 *   ./scripts-run src/scripts/design_system_import &lt;file&gt; [options]
 *
 *   --lane {native,dtcg,dembrandt}  Force a lane instead of detecting it.
 *   --source-kind {url,repo,dir}    Provenance for formats that carry none.
 *   --source-ref REF                Provenance ref (the URL / repo / path).
 *   --captured-at ISO               Capture time; omitted records "unknown".
 *   --format {json,summary}         json (default) or a human-readable summary.
 *
 * Exit codes:
 *
 *   0 — imported; the artifact is on stdout (or its summary).
 *   1 — the input was rejected (no lane matched, or no provenance).
 *   2 — argument error.
 *   3 — internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    type ImportOutcome,
    type Lane,
    type ProvenanceOverride,
    importDesignSystem,
} from './_lib/design_system_import.js';

const _HERE = fileURLToPath(import.meta.url);

const LANES = new Set(['native', 'dtcg', 'dembrandt']);
const SOURCE_KINDS = new Set(['url', 'repo', 'dir']);
const FORMATS = new Set(['json', 'summary']);

const USAGE =
    'usage: design_system_import <file> [--lane {native,dtcg,dembrandt}] ' +
    '[--source-kind {url,repo,dir}] [--source-ref REF] [--captured-at ISO] ' +
    '[--format {json,summary}]';

interface Args {
    file: string;
    lane: Lane | null;
    sourceKind: 'url' | 'repo' | 'dir' | null;
    sourceRef: string | null;
    capturedAt: string | null;
    format: 'json' | 'summary';
}

function argError(message: string): never {
    process.stderr.write(`${USAGE}\ndesign_system_import: error: ${message}\n`);
    process.exit(2);
}

export function parse_args(argv: readonly string[]): Args {
    const args: Args = {
        file: '',
        lane: null,
        sourceKind: null,
        sourceRef: null,
        capturedAt: null,
        format: 'json',
    };
    const positional: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        const eq = a.indexOf('=');
        const flag = a.startsWith('--') && eq > 0 ? a.slice(0, eq) : a;
        const inline = a.startsWith('--') && eq > 0 ? a.slice(eq + 1) : null;
        const take = (): string => {
            if (inline !== null) return inline;
            const next = argv[++i];
            if (next === undefined) argError(`argument ${flag}: expected one argument`);
            return next;
        };
        switch (flag) {
            case '-h':
            case '--help':
                process.stdout.write(`${USAGE}\n`);
                process.exit(0);
                break;
            case '--lane': {
                const v = take();
                if (!LANES.has(v)) {
                    argError(`argument --lane: invalid choice: '${v}' (choose from 'native', 'dtcg', 'dembrandt')`);
                }
                args.lane = v as Lane;
                break;
            }
            case '--source-kind': {
                const v = take();
                if (!SOURCE_KINDS.has(v)) {
                    argError(`argument --source-kind: invalid choice: '${v}' (choose from 'url', 'repo', 'dir')`);
                }
                args.sourceKind = v as 'url' | 'repo' | 'dir';
                break;
            }
            case '--source-ref':
                args.sourceRef = take();
                break;
            case '--captured-at':
                args.capturedAt = take();
                break;
            case '--format': {
                const v = take();
                if (!FORMATS.has(v)) {
                    argError(`argument --format: invalid choice: '${v}' (choose from 'json', 'summary')`);
                }
                args.format = v as 'json' | 'summary';
                break;
            }
            default:
                if (a.startsWith('-')) argError(`unrecognized arguments: ${a}`);
                positional.push(a);
        }
    }
    if (positional.length === 0) argError('the following arguments are required: file');
    if (positional.length > 1) argError(`unrecognized arguments: ${positional.slice(1).join(' ')}`);
    args.file = positional[0] as string;
    // Half a provenance is worse than none: it reads as complete in the output
    // while naming nothing traceable, and the contract's whole point is that a
    // reader can go back to the source.
    if ((args.sourceKind === null) !== (args.sourceRef === null)) {
        argError('--source-kind and --source-ref must be given together');
    }
    return args;
}

/** One line per fact, so a human can see what was mapped without reading JSON. */
export function render_summary(outcome: ImportOutcome): string {
    if (!outcome.ok) {
        return `REJECTED (${outcome.lane ?? 'no lane'})\n  ${outcome.reason}`;
    }
    const ds = outcome.design_system;
    const lines: string[] = [];
    lines.push(`lane: ${outcome.lane}`);
    lines.push(`source: ${ds.source.kind} ${ds.source.ref} @ ${ds.source.captured_at} (provenance from ${ds.source._meta?.provenance_origin ?? 'input'})`);
    const counts: string[] = [];
    const light = Object.keys(ds.colors?.light ?? {}).length;
    const dark = Object.keys(ds.colors?.dark ?? {}).length;
    if (light + dark > 0) counts.push(`colors: ${light} light / ${dark} dark`);
    if (ds.typography?.families?.length) counts.push(`font families: ${ds.typography.families.length}`);
    if (ds.typography?.scale?.length) counts.push(`type steps: ${ds.typography.scale.length}`);
    if (ds.spacing?.scale?.length) counts.push(`spacing steps: ${ds.spacing.scale.length}`);
    if (ds.radius) counts.push(`radius roles: ${Object.keys(ds.radius).length}`);
    if (ds.shadow) counts.push(`shadow roles: ${Object.keys(ds.shadow).length}`);
    if (ds.motion?.durations) counts.push(`motion durations: ${Object.keys(ds.motion.durations).length}`);
    if (ds.motion?.easings) counts.push(`motion easings: ${Object.keys(ds.motion.easings).length}`);
    if (ds.components?.length) counts.push(`components: ${ds.components.length}`);
    lines.push(counts.length > 0 ? `mapped — ${counts.join(', ')}` : 'mapped — nothing (observation only)');
    for (const note of outcome.notes) lines.push(`note: ${note}`);
    lines.push('');
    lines.push('This artifact is observed, not authoritative. Hand it to design-system-capture,');
    lines.push('which confirms it per field; a value conflicting with a registered brand token is');
    lines.push('flagged, never auto-applied.');
    return lines.join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parse_args(argv);

    let raw: string;
    try {
        raw = fs.readFileSync(args.file, 'utf-8');
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`design_system_import: cannot read ${args.file}: ${msg}\n`);
        return 1;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`design_system_import: ${args.file} is not valid JSON: ${msg}\n`);
        return 1;
    }

    const provenance: ProvenanceOverride | undefined =
        args.sourceKind !== null && args.sourceRef !== null
            ? {
                  kind: args.sourceKind,
                  ref: args.sourceRef,
                  ...(args.capturedAt !== null ? { captured_at: args.capturedAt } : {}),
              }
            : undefined;

    const outcome = importDesignSystem(parsed, provenance, args.lane ?? undefined);

    if (!outcome.ok) {
        process.stderr.write(`${render_summary(outcome)}\n`);
        return 1;
    }
    if (args.format === 'summary') {
        process.stdout.write(`${render_summary(outcome)}\n`);
    } else {
        process.stdout.write(`${JSON.stringify(outcome.design_system, null, 2)}\n`);
        for (const note of outcome.notes) process.stderr.write(`note: ${note}\n`);
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`design_system_import: internal error: ${msg}\n`);
        process.exit(3);
    }
}
