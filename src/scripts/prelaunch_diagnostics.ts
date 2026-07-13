#!/usr/bin/env tsx
/**
 * prelaunch_diagnostics.ts — validate / verdict / diff for pre-launch
 * diagnostic reports (road-to-ecosystem-harvest-prelaunch-diagnostics,
 * Source L). Contract: docs/contracts/prelaunch-diagnostics.md.
 *
 * Read-only by design: reads report JSON (+ optional suppression YAML),
 * writes nothing — the consumer-side fix loop stays approval-gated.
 *
 * CLI:
 *   validate <report.json> [--suppressions <file>]
 *   diff <baseline.json> <current.json> [--ci] [--suppressions <file>]
 *
 * Exit codes: 0 clean · 1 validation error / --ci gate tripped · 2 usage.
 *
 * NO numeric score anywhere — council-locked (contract § 9).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(_HERE), '..', '..');
const AREAS_FILE = path.join(REPO_ROOT, 'src', 'config', 'prelaunch-areas.yml');

export interface AreaDef {
    code: string;
    launch_gate: boolean;
    description?: string;
}

export interface AreaState {
    state: 'pass' | 'finding' | 'unknown' | 'not-applicable';
    evidence?: string;
    reason?: string;
}

export interface Finding {
    id: string;
    area: string;
    severity: 'P0' | 'P1' | 'P2' | 'P3';
    title: string;
    evidence?: string;
    status: 'open' | 'fixed' | 'accepted-risk' | 'deferred-with-reason' | 'suppressed-with-evidence' | 'not-applicable';
    reason?: string;
}

export interface Report {
    schema_version: string;
    project: string;
    run_at: string;
    areas: Record<string, AreaState>;
    findings: Finding[];
    questions?: string[];
}

export interface Suppression {
    id: string;
    reason: string;
    evidence: string;
}

const ID_RE = /^AC-([A-Z][A-Z0-9]{1,7})-([0-9]{3})$/;
const REASON_REQUIRED = new Set(['accepted-risk', 'deferred-with-reason', 'suppressed-with-evidence', 'not-applicable']);

export function load_areas(file: string = AREAS_FILE): Record<string, AreaDef> {
    const doc = parseYaml(fs.readFileSync(file, 'utf-8')) as { areas?: Record<string, AreaDef> };
    return doc.areas ?? {};
}

export function load_suppressions(file: string): Suppression[] {
    if (!fs.existsSync(file)) return [];
    const doc = parseYaml(fs.readFileSync(file, 'utf-8')) as { suppressions?: Suppression[] };
    return doc.suppressions ?? [];
}

/**
 * Epistemics + structure validation beyond the JSON schema shape:
 * pass-needs-evidence, N/A-needs-reason, ID grammar + area agreement,
 * unique IDs, status-reason coupling, suppression receipts.
 */
export function validate_report(
    report: Report,
    areas: Record<string, AreaDef>,
    suppressions: Suppression[] = [],
): string[] {
    const errors: string[] = [];
    const codeByArea = new Map(Object.entries(areas).map(([k, v]) => [k, v.code]));

    for (const [areaKey, st] of Object.entries(report.areas ?? {})) {
        if (!codeByArea.has(areaKey)) {
            errors.push(`areas.${areaKey}: unknown area (not in prelaunch-areas.yml — the vocabulary is fixed)`);
        }
        if (st.state === 'pass' && !st.evidence) {
            errors.push(`areas.${areaKey}: state 'pass' without evidence — a pass is a cited diagnosis, not an assertion`);
        }
        if (st.state === 'not-applicable' && !st.reason) {
            errors.push(`areas.${areaKey}: state 'not-applicable' without a reason`);
        }
    }

    const seen = new Set<string>();
    const suppressionById = new Map(suppressions.map((s) => [s.id, s]));
    for (const f of report.findings ?? []) {
        const m = ID_RE.exec(f.id);
        if (!m) {
            errors.push(`${f.id}: malformed finding ID (grammar: AC-<AREA>-NNN)`);
            continue;
        }
        if (seen.has(f.id)) errors.push(`${f.id}: duplicate finding ID — IDs are immutable and never re-assigned`);
        seen.add(f.id);
        const expected = codeByArea.get(f.area);
        if (expected === undefined) {
            errors.push(`${f.id}: unknown area '${f.area}'`);
        } else if (m[1] !== expected) {
            errors.push(`${f.id}: ID area code '${m[1]}' does not match area '${f.area}' (code ${expected})`);
        }
        if (REASON_REQUIRED.has(f.status) && !f.reason) {
            errors.push(`${f.id}: status '${f.status}' requires a reason`);
        }
        if (f.status === 'suppressed-with-evidence') {
            const s = suppressionById.get(f.id);
            if (!s) errors.push(`${f.id}: suppressed-with-evidence without a matching suppression entry`);
            else if (!s.reason || !s.evidence) errors.push(`${f.id}: suppression entry must carry both reason and evidence`);
        }
    }
    return errors;
}

/**
 * The launch verdict. READY IS THE RESIDUAL STATE, NEVER THE DEFAULT:
 * any open P0 refuses ready regardless of every other area (suppression
 * does not rescue a P0 — contract § 5); any open P1 or a launch-gate
 * area not at pass/not-applicable refuses ready too.
 */
export function verdict(report: Report, areas: Record<string, AreaDef>): { ready: boolean; blockers: string[] } {
    const blockers: string[] = [];
    for (const f of report.findings ?? []) {
        if (f.severity === 'P0' && f.status !== 'fixed' && f.status !== 'not-applicable') {
            blockers.push(`${f.id} (P0, ${f.status}): open P0 caps the verdict regardless of every other area`);
        } else if (f.severity === 'P1' && f.status === 'open') {
            blockers.push(`${f.id} (P1, open): fix before general rollout`);
        }
    }
    for (const [key, def] of Object.entries(areas)) {
        if (!def.launch_gate) continue;
        const st = report.areas?.[key]?.state ?? 'unknown';
        if (st !== 'pass' && st !== 'not-applicable') {
            blockers.push(`area ${key} (launch-gate): state '${st}' — Unknown is never a Pass`);
        }
    }
    return { ready: blockers.length === 0, blockers };
}

export interface DiffResult {
    new_findings: Finding[];
    resolved: Finding[];
    regressed_areas: string[];
    ci_trips: string[];
}

/** Diff two reports BY ID (titles are mutable metadata, never the key). */
export function diff_reports(
    baseline: Report,
    current: Report,
    areas: Record<string, AreaDef>,
    suppressions: Suppression[] = [],
): DiffResult {
    const suppressed = new Set(suppressions.map((s) => s.id));
    const baseIds = new Set((baseline.findings ?? []).map((f) => f.id));
    const baseById = new Map((baseline.findings ?? []).map((f) => [f.id, f]));

    const new_findings = (current.findings ?? []).filter((f) => !baseIds.has(f.id));
    const resolved = (current.findings ?? []).filter(
        (f) => f.status === 'fixed' && baseById.get(f.id)?.status === 'open',
    );

    const regressed_areas: string[] = [];
    for (const [key, def] of Object.entries(areas)) {
        if (!def.launch_gate) continue;
        const before = baseline.areas?.[key]?.state;
        const after = current.areas?.[key]?.state ?? 'unknown';
        if (before === 'pass' && after !== 'pass' && after !== 'not-applicable') {
            regressed_areas.push(key);
        }
    }

    const ci_trips: string[] = [];
    for (const f of new_findings) {
        if ((f.severity === 'P0' || f.severity === 'P1') && f.status === 'open' && !suppressed.has(f.id)) {
            ci_trips.push(`new open ${f.severity}: ${f.id} — ${f.title}`);
        }
    }
    for (const a of regressed_areas) {
        ci_trips.push(`launch-gate area '${a}' regressed from pass (Pass→Finding flip)`);
    }
    return { new_findings, resolved, regressed_areas, ci_trips };
}

function _readReport(p: string): Report {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Report;
}

function _renderDiff(d: DiffResult, suppressions: Suppression[]): string {
    const lines: string[] = [];
    lines.push(`new: ${d.new_findings.length} · resolved: ${d.resolved.length} · regressed launch-gate areas: ${d.regressed_areas.length}`);
    for (const f of d.new_findings) lines.push(`  + ${f.id} [${f.severity}/${f.status}] ${f.title}`);
    for (const f of d.resolved) lines.push(`  ✓ ${f.id} resolved`);
    for (const a of d.regressed_areas) lines.push(`  ↓ area ${a} regressed from pass`);
    if (suppressions.length > 0) {
        lines.push('<details><summary>suppressed findings (evidence-backed, excluded from CI triggers)</summary>');
        for (const s of suppressions) lines.push(`  ~ ${s.id} — ${s.reason} (evidence: ${s.evidence})`);
        lines.push('</details>');
    }
    return lines.join('\n');
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_HERE);
if (isMain) {
    const argv = process.argv.slice(2);
    const cmd = argv[0];
    const sIdx = argv.indexOf('--suppressions');
    const suppressions = sIdx !== -1 ? load_suppressions(argv[sIdx + 1] ?? '') : [];
    const areas = load_areas();

    if (cmd === 'validate' && argv[1]) {
        const report = _readReport(argv[1]);
        const errors = validate_report(report, areas, suppressions);
        for (const e of errors) process.stderr.write(`❌  ${e}\n`);
        const v = verdict(report, areas);
        process.stdout.write(v.ready ? '✅  verdict: ready\n' : `⚠️  verdict: NOT ready (${v.blockers.length} blocker(s))\n`);
        for (const b of v.blockers) process.stdout.write(`   - ${b}\n`);
        process.exit(errors.length > 0 ? 1 : 0);
    } else if (cmd === 'diff' && argv[1] && argv[2]) {
        const d = diff_reports(_readReport(argv[1]), _readReport(argv[2]), areas, suppressions);
        process.stdout.write(_renderDiff(d, suppressions) + '\n');
        if (argv.includes('--ci') && d.ci_trips.length > 0) {
            for (const t of d.ci_trips) process.stderr.write(`❌  ${t}\n`);
            process.exit(1);
        }
        process.exit(0);
    } else {
        process.stderr.write('usage: prelaunch_diagnostics validate <report.json> | diff <baseline.json> <current.json> [--ci] [--suppressions <file>]\n');
        process.exit(2);
    }
}
