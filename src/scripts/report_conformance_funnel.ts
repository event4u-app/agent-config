#!/usr/bin/env tsx
/**
 * report_conformance_funnel.ts — delivery → activation → compliance, one view.
 *
 * ⚠️ REPORT ONLY — THIS SCRIPT MUST NEVER BE WIRED INTO A CI WORKFLOW WITHOUT
 * A MEASURED FALSE-POSITIVE RATE FIRST (locked policy; council requirement,
 * road-to-feedback-9-29 Phase 4.2). Every source it joins is itself advisory
 * and says so; a join of advisories does not become a gate by aggregation.
 *
 * Executes road-to-feedback-9-29 Phase 4.2: one report join over the existing
 * conformance sources, so the three questions that were answered in three
 * places read as the funnel they are:
 *
 *   DELIVERY    what rule text the carriers put in front of the model, and
 *               whether the two carriers agree —
 *               `conformance_scan.measureDelivered` (carrier census) +
 *               `report_carrier_divergence.compareCarriers` (divergence).
 *   ACTIVATION  whether the shipped skills are invoked at all —
 *               `report_skill_activation.censusSkills` + `measureUsage`.
 *   COMPLIANCE  whether a loaded skill's obligations were violated (SK-2) —
 *               `report_skill_obligation_violations.scanStore`.
 *
 * JOINS, NEVER RE-DERIVES. Every number below comes from an EXPORTED function
 * of the source that owns it. A second copy of a classifier is the "second
 * artefact to keep in sync" this repo forbids — it is how the 8 → 30 spread
 * and the 303-vs-626 detector defect happened, and both are cited in the
 * sources this file imports.
 *
 * Each axis also carries the honest-scope statement its source already
 * carries (SK-2's mechanisable-subset ratio, activation's catalogue-not-
 * persisted caveat, delivery's not-per-session caveat). Where a source has no
 * local data, the axis prints its honest "no data" line rather than
 * disappearing — an absent store is an answer, not a zero.
 *
 * Reached via `agent-config conformance --funnel` (no new top-level verb —
 * the flag hangs off the existing `conformance` verb per the dispatcher-verb
 * registry trap named in the roadmap's risk table).
 *
 * Exit: 0 always, except a usage error (1). Deliberate — see the header.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    measureDelivered,
    defaultStore,
    type DeliveredPayload,
} from './conformance_scan.js';
import {
    compareCarriers,
    GLOBAL_RULES,
    PROJECT_RULES,
    PROJECTION_SOURCE,
    type CarrierDivergence,
} from './report_carrier_divergence.js';
import {
    censusSkills,
    measureUsage,
    SKILLS_ROOT,
    type SkillCensus,
    type UsageReport,
} from './report_skill_activation.js';
import { scanStore as scanObligationStore, type Sk2Report } from './report_skill_obligation_violations.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export interface FunnelOptions {
    /** The checkout whose skills and projection source are measured. */
    repoRoot?: string;
    /** The project rule carrier — what the host reads at project scope. */
    projectRulesDir?: string;
    /** The machine-global rule carrier. */
    globalRulesDir?: string;
    /** The projection source, read only to attribute manual-only absences. */
    sourceDir?: string;
    /** Transcript store for the activation and compliance axes. */
    store?: string;
    /** Most-recent sessions to scan. */
    limit?: number;
}

export interface FunnelReport {
    /** DELIVERY — carrier census (conformance_scan) + divergence (report_carrier_divergence). */
    delivered: DeliveredPayload;
    divergence: CarrierDivergence;
    /** ACTIVATION — skill census + usage (report_skill_activation). */
    skills: SkillCensus;
    usage: UsageReport;
    /** `false` is the no-data branch for both transcript-fed axes. */
    storePresent: boolean;
    /** COMPLIANCE — SK-2 loaded-but-violated (report_skill_obligation_violations). */
    sk2: Sk2Report;
}

export function buildFunnel(opts: FunnelOptions = {}): FunnelReport {
    const repoRoot = opts.repoRoot ?? REPO_ROOT;
    const projectRulesDir = opts.projectRulesDir ?? path.join(repoRoot, PROJECT_RULES);
    const globalRulesDir = opts.globalRulesDir ?? path.join(os.homedir(), GLOBAL_RULES);
    const sourceDir = opts.sourceDir ?? path.join(repoRoot, PROJECTION_SOURCE);
    const store = opts.store ?? defaultStore(repoRoot);
    const limit = opts.limit ?? 30;
    return {
        delivered: measureDelivered(projectRulesDir, globalRulesDir),
        divergence: compareCarriers(projectRulesDir, globalRulesDir, sourceDir),
        skills: censusSkills(path.join(repoRoot, SKILLS_ROOT)),
        usage: measureUsage(store, limit),
        storePresent: fs.existsSync(store),
        sk2: scanObligationStore(repoRoot, store, limit),
    };
}

function _pct(n: number, d: number): string {
    return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`;
}

function _carrierLine(label: string, c: { present: boolean; files: number; tokens: number }): string {
    return c.present
        ? `    ${label}  ${String(c.files).padStart(4)} rules  ${String(c.tokens).padStart(7)} tok`
        : `    ${label}  ABSENT — not a measured zero, this carrier does not exist here`;
}

export function render(r: FunnelReport): string {
    const lines: string[] = [];
    lines.push('conformance funnel — delivery → activation → compliance (report, not a gate)');
    lines.push('');

    // ── DELIVERY ───────────────────────────────────────────────────────────
    lines.push('DELIVERY — rule text the carriers put in front of the model');
    lines.push(_carrierLine('project', r.delivered.project));
    lines.push(_carrierLine('global ', r.delivered.global));
    lines.push(`    union                  ${String(r.delivered.union_tokens).padStart(7)} tok`);
    lines.push('    Carriers as they stand NOW — a session\'s own payload is NOT recoverable:');
    lines.push('    the transcript records no system or tools field (conformance_scan).');
    const d = r.divergence;
    if (!d.globalPresent) {
        lines.push('    Divergence: the global carrier is absent — this machine loads the project');
        lines.push('    projection only, so there is no second copy to diverge from. A real');
        lines.push('    answer, not a skipped check.');
    } else if (!d.projectPresent) {
        lines.push('    Divergence: the project rule tree does not exist in this checkout — it is');
        lines.push('    generated and gitignored. Run `task generate-tools`, then re-run. Not');
        lines.push('    substituted with dist/, which would answer a different question.');
    } else {
        lines.push(
            `    Divergence: ${d.shared} shared · ${d.bodyDiff.length} prose-diff · ` +
                `${d.frontmatterOnly.length} frontmatter-only · ` +
                `${d.provenanceOnly.length} provenance-only · ${d.projectOnly.length} project-only · ` +
                `${d.globalOnly.length} global-only` +
                (d.manualOnlyGlobal.length > 0 ? ` (${d.manualOnlyGlobal.length} by design, ADR-004 manual)` : ''),
        );
        if (d.bodyDiff.length > 0) {
            lines.push(`    PROSE DIVERGENCE — both copies reach the model: ${d.bodyDiff.join(', ')}`);
            lines.push('    The host resolves nothing: both layers load at launch at the same');
            lines.push('    priority with no precedence marker, so which text binds is UNDEFINED');
            lines.push('    (claude-code-rules-dir-contract.md). The project copy is merely the');
            lines.push('    newer one — recency, not precedence.');
        }
        if (d.frontmatterOnly.length > 0) {
            lines.push(`    ${String(d.frontmatterOnly.length)} pair(s) differ only in frontmatter — prose byte-identical, nothing`);
            lines.push('    to act on; the host delivers the prose without that block.');
        }
        if (d.unreadable.length > 0) {
            lines.push(`    Unreadable on one side (${d.unreadable.length}) — a broken install, not a disagreement.`);
        }
    }
    lines.push('');

    // ── ACTIVATION ─────────────────────────────────────────────────────────
    lines.push('ACTIVATION — are the delivered skills invoked?');
    lines.push(`    skills shipped                        ${r.skills.total}`);
    lines.push(
        `    with a machine-matchable trigger key  ${r.skills.withTriggerKey.length} ` +
            `(${_pct(r.skills.withTriggerKey.length, r.skills.total)})`,
    );
    if (!r.storePresent) {
        lines.push(`    NO DATA: no transcript store at ${r.usage.store} — usage is not`);
        lines.push('    measurable here. An absent store is an answer, not a zero.');
    } else {
        const distinct = Object.keys(r.usage.bySkill).length;
        lines.push(
            `    sessions=${r.usage.sessions} assistant turns=${r.usage.assistantTurns} ` +
                `Skill invocations=${r.usage.invocations} distinct skills=${distinct} of ${r.skills.total} ` +
                `(${_pct(distinct, r.skills.total)})`,
        );
    }
    if (r.skills.withTriggerKey.length === 0) {
        lines.push('    Honest scope: activation is NOT measurable as a rate — no skill declares');
        lines.push('    a machine-matchable trigger, and matching description prose is the class');
        lines.push('    this suite excludes (report_skill_activation).');
    }
    lines.push('    NOT MEASURED: whether each skill reached the model WITH its description —');
    lines.push('    the host\'s injected catalogue is not persisted in the transcript, so the');
    lines.push('    bare-name (truncation) hypothesis stays a single-session observation.');
    lines.push('');

    // ── COMPLIANCE ─────────────────────────────────────────────────────────
    const c = r.sk2.census;
    lines.push('COMPLIANCE — SK-2 loaded-but-violated (coverage is the headline)');
    lines.push(`    skills with a deterministic obligation  ${c.skills.length}`);
    lines.push(
        `    testable without judgement              ${c.forbidden.length} artefact(s) over ` +
            `${c.totalLines} obligation line(s)`,
    );
    lines.push('    The rest are deterministic in WORDING and need a reading to test — the');
    lines.push('    FC-8 class this suite excludes, reported as uncovered, not approximated');
    lines.push('    (report_skill_obligation_violations).');
    if (!r.storePresent) {
        lines.push('    NO DATA: no transcript store — loaded-but-violated cannot be observed');
        lines.push('    here. The coverage census above is static and still holds.');
    } else {
        lines.push(
            `    sessions scanned=${r.sk2.sessions} with a skill in context=${r.sk2.sessionsWithASkill} ` +
                `flags=${r.sk2.flags.length}`,
        );
        for (const f of r.sk2.flags) {
            lines.push(`      ${f.session}  [${f.skill}] ${f.artefact} via ${f.tool}`);
        }
    }
    lines.push('    PRECISION: every flag is hand-read before any number here is cited — the');
    lines.push('    detector cannot state its false-positive rate, so it ships detection-only.');
    lines.push('');

    lines.push('This is a REPORT. It gates on nothing and must never be wired into a CI');
    lines.push('workflow without a measured false-positive rate first (locked policy).');
    return lines.join('\n');
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    const opts: FunnelOptions = {};
    // A value must not itself be a flag — the same hole the sibling reports
    // close on both the flag-name and flag-value halves.
    const value = (i: number): string | null => {
        const v = args[i + 1];
        return v === undefined || v.startsWith('-') ? null : v;
    };
    for (let i = 0; i < args.length; i += 1) {
        const a = args[i];
        if (a === '--store' || a === '--project' || a === '--global' || a === '--source') {
            const v = value(i);
            if (v === null) {
                process.stderr.write(`report_conformance_funnel: ${a} needs a value\n`);
                return 1;
            }
            const resolved = path.resolve(v);
            if (a === '--store') opts.store = resolved;
            else if (a === '--project') opts.projectRulesDir = resolved;
            else if (a === '--global') opts.globalRulesDir = resolved;
            else opts.sourceDir = resolved;
            i += 1;
        } else if (a === '--limit') {
            const v = value(i);
            const n = v === null ? Number.NaN : Number.parseInt(v, 10);
            if (!Number.isFinite(n) || n <= 0) {
                process.stderr.write('report_conformance_funnel: --limit must be a positive integer\n');
                return 1;
            }
            opts.limit = n;
            i += 1;
        } else if (a === '--help' || a === '-h') {
            process.stdout.write(
                'usage: report_conformance_funnel [--store PATH] [--limit N]\n' +
                    '                                 [--project DIR] [--global DIR] [--source DIR]\n',
            );
            return 0;
        } else if (a !== undefined && a.startsWith('--') && a !== '--quiet') {
            process.stderr.write(`report_conformance_funnel: unknown flag ${a}\n`);
            return 1;
        }
    }
    process.stdout.write(`${render(buildFunnel(opts))}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
