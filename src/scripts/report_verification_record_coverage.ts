#!/usr/bin/env tsx
/**
 * How often a verification command leaves no usable record — per host.
 *
 * The question this answers is not "did the checks pass". It is whether the
 * INSTRUMENT that the turn-end gate reads is working on a given host at all. A
 * host whose records never carry an exit code gives the gate nothing to refuse
 * on, and that failure is silent in both directions: the gate does not complain,
 * and the records look like a clean run of passes.
 *
 * Named `report_` and not `check_` deliberately. `gate_population` classifies on
 * a `lint|check|audit|skill|verify_` prefix, and this gates nothing — it exits 0
 * whatever it finds. A high instrument-gap rate is answered by repairing the
 * carrier, never by refusing more often.
 *
 * What it can see, and the one thing it cannot.
 *
 * Its corpus is the witness files the recorder writes, one per session. From
 * those it reads, per host: sessions, records written, how many carry an exit
 * code, each record's verdict class, and the share of verdicts that are
 * instrument gaps rather than statements about the work.
 *
 * It CANNOT see a verification command that was never recorded. A candidate and
 * a record are the same event here — the recorder writes a record for every
 * command its selector admits — so the two can never differ in this corpus, and
 * a column reporting both would invite exactly the reading that nothing was
 * dropped. The failure that motivated this whole measurement was of that shape:
 * a failing command fired an event bound to nothing, so it left no record, and
 * no reading over records could have found it. That blind spot is printed with
 * the table rather than left for a reader to infer.
 *
 * A host is `unobserved` when it binds the recorder but no witness file names
 * it. That is not the same as a host with no gaps, and the output never lets the
 * two share a row.
 *
 * Usage:
 *   report_verification_record_coverage [--root DIR] [--json] [--quiet]
 *
 * Exit 0 always — except a dead scan scope, which throws via `assertScanned`:
 * a reader that read nothing has measured nothing, and printing 0 % gaps over an
 * empty corpus is the most misleading output this script could produce.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { assertScanned } from './_lib/scan_scope.js';
import {
    classifyRun,
    isInstrumentGap,
    type VerificationVerdict,
} from './_lib/verification_evidence.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Where the recorder writes one witness per session. */
export const WITNESS_DIR = path.join('agents', 'state', 'verify-before-complete');

/** The concern whose binding decides whether a host can produce a record at all. */
const RECORDER_CONCERN = 'verify-before-complete';

/** A witness file written before the producer recorded its host. */
export const UNATTRIBUTED = 'unattributed';

export interface HostCoverage {
    host: string;
    /** The host binds the recorder on a tool event, so a record is possible there. */
    binds_recorder: boolean;
    sessions: number;
    records: number;
    /** Records whose `exit_code` is a number — the gate's only hard signal. */
    exit_code_available: number;
    /** Verdict kind (or `INVALID_RUN:<reason>`) → count. */
    verdicts: Record<string, number>;
    /** Verdicts that describe the instrument rather than the work. */
    instrument_gaps: number;
    /** `instrument_gaps / records`, or null when there is nothing to divide. */
    instrument_gap_share: number | null;
}

export interface CoverageReport {
    root: string;
    files_scanned: number;
    hosts: HostCoverage[];
    /** Hosts that bind the recorder and left no witness at all. */
    unobserved: string[];
}

function _verdictKey(v: VerificationVerdict): string {
    return v.kind === 'INVALID_RUN' ? `INVALID_RUN:${v.reason}` : v.kind;
}

/**
 * Hosts whose manifest binds the recorder on a tool event.
 *
 * Read from the manifest rather than hardcoded, so a host that gains or loses
 * the binding changes this report without anybody remembering to edit it. A
 * manifest that cannot be read yields an empty set, which makes every observed
 * host report `binds_recorder: false` — visibly wrong rather than quietly
 * plausible.
 */
export function hostsBindingRecorder(manifestText: string): Set<string> {
    const out = new Set<string>();
    let manifest: Record<string, unknown>;
    try {
        manifest = (parseYaml(manifestText) ?? {}) as Record<string, unknown>;
    } catch {
        return out;
    }
    const platforms = (manifest['platforms'] ?? {}) as Record<string, unknown>;
    for (const [host, spec] of Object.entries(platforms)) {
        if (typeof spec !== 'object' || spec === null) continue;
        for (const [event, concerns] of Object.entries(spec as Record<string, unknown>)) {
            if (!event.endsWith('tool_use')) continue;
            if (Array.isArray(concerns) && concerns.includes(RECORDER_CONCERN)) out.add(host);
        }
    }
    return out;
}

export function computeCoverage(
    files: ReadonlyArray<{ path: string; text: string }>,
    binding: ReadonlySet<string>,
    root: string,
): CoverageReport {
    const byHost = new Map<string, HostCoverage>();
    const ensure = (host: string): HostCoverage => {
        let h = byHost.get(host);
        if (h === undefined) {
            h = {
                host,
                binds_recorder: binding.has(host),
                sessions: 0,
                records: 0,
                exit_code_available: 0,
                verdicts: {},
                instrument_gaps: 0,
                instrument_gap_share: null,
            };
            byHost.set(host, h);
        }
        return h;
    };

    for (const f of files) {
        let state: Record<string, unknown>;
        try {
            state = JSON.parse(f.text) as Record<string, unknown>;
        } catch {
            // A torn or half-written witness is counted under the host that
            // cannot be read from it, never dropped: a file the reader could not
            // parse is evidence about the instrument too.
            ensure(UNATTRIBUTED).sessions += 1;
            continue;
        }
        const platform = state['platform'];
        const host = typeof platform === 'string' && platform ? platform : UNATTRIBUTED;
        const h = ensure(host);
        h.sessions += 1;

        const runs = state['verification_runs'];
        if (!Array.isArray(runs)) continue;
        for (const rec of runs) {
            h.records += 1;
            const code = (rec as Record<string, unknown> | null)?.['exit_code'];
            if (typeof code === 'number') h.exit_code_available += 1;
            const verdict = classifyRun(rec);
            const key = _verdictKey(verdict);
            h.verdicts[key] = (h.verdicts[key] ?? 0) + 1;
            if (isInstrumentGap(verdict)) h.instrument_gaps += 1;
        }
    }

    for (const h of byHost.values()) {
        h.instrument_gap_share = h.records > 0 ? h.instrument_gaps / h.records : null;
    }

    const hosts = [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host));
    const unobserved = [...binding].filter((x) => !byHost.has(x)).sort();
    return { root, files_scanned: files.length, hosts, unobserved };
}

function _pct(x: number | null): string {
    return x === null ? '—' : `${(x * 100).toFixed(1)}%`;
}

export function renderText(r: CoverageReport): string {
    const lines: string[] = [];
    lines.push(`verification record coverage — ${r.files_scanned} witness file(s) under ${r.root}`);
    lines.push('');
    lines.push('| host | binds recorder | sessions | records | exit_code available | instrument gaps | gap share |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const h of r.hosts) {
        lines.push(
            `| ${h.host} | ${h.binds_recorder ? 'yes' : 'no'} | ${String(h.sessions)} | ` +
                `${String(h.records)} | ${String(h.exit_code_available)} | ` +
                `${String(h.instrument_gaps)} | ${_pct(h.instrument_gap_share)} |`,
        );
    }
    for (const host of r.unobserved) {
        lines.push(`| ${host} | yes | 0 | 0 | 0 | 0 | unobserved |`);
    }
    lines.push('');
    lines.push('verdict classes');
    for (const h of r.hosts) {
        const keys = Object.keys(h.verdicts).sort();
        if (keys.length === 0) {
            lines.push(`  ${h.host}: no records`);
            continue;
        }
        lines.push(`  ${h.host}: ${keys.map((k) => `${k}=${String(h.verdicts[k])}`).join(' · ')}`);
    }
    lines.push('');
    if (r.unobserved.length > 0) {
        lines.push(
            `unobserved (binds the recorder, left no witness here): ${r.unobserved.join(', ')} — ` +
                'this is an absence of measurement, not an absence of gaps.',
        );
    }
    lines.push(
        'blind spot: a verification command that left no record at all is invisible to this ' +
            'reading. Records are the corpus, so a command the recorder never saw cannot appear ' +
            'as a gap — it appears as nothing.',
    );
    return lines.join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let root = path.join(REPO_ROOT, WITNESS_DIR);
    let asJson = false;
    let quiet = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--root') {
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write('report_verification_record_coverage: --root needs a path\n');
                return 2;
            }
            root = next;
            i += 1;
        } else if (a === '--json') {
            asJson = true;
        } else if (a === '--quiet') {
            quiet = true;
        } else {
            process.stderr.write(
                'usage: report_verification_record_coverage [--root DIR] [--json] [--quiet]\n',
            );
            return 2;
        }
    }

    const files: Array<{ path: string; text: string }> = [];
    if (fs.existsSync(root)) {
        for (const name of fs.readdirSync(root).sort()) {
            if (!name.endsWith('.json')) continue;
            const p = path.join(root, name);
            try {
                files.push({ path: p, text: fs.readFileSync(p, 'utf8') });
            } catch {
                // Unreadable on this filesystem — skipped, and the file count
                // below reflects what was actually read rather than what was listed.
            }
        }
    }

    // A dead scope is the one outcome this report must refuse. Everything else
    // it has to say is a number; "0 % gaps" over nothing is not a number, it is
    // a sentence about an empty directory wearing a measurement's clothes.
    assertScanned({
        gate: 'report_verification_record_coverage',
        scanned: files.length,
        units: 'witness files',
        roots: [root],
    });

    let manifestText = '';
    try {
        manifestText = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'),
            'utf8',
        );
    } catch {
        manifestText = '';
    }

    const report = computeCoverage(files, hostsBindingRecorder(manifestText), root);
    if (!quiet) {
        process.stdout.write(asJson ? `${JSON.stringify(report, null, 2)}\n` : `${renderText(report)}\n`);
    }
    return 0;
}

if (
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href
) {
    process.exit(main());
}

export { _HERE };
