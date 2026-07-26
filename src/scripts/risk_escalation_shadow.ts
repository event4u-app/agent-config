/**
 * Risk-escalation shadow report — measure before adding teeth.
 *
 * Walks the last N first-parent merges, classifies each one's touched paths by
 * trust-boundary risk, and writes what *would* have escalated. Nothing is
 * gated. Nothing fails. The output is a number whose only job is to decide
 * whether the gate is worth building.
 *
 * This is the same sequencing ADR-127 used on `exec:` evidence: pre-register a
 * threshold, measure, then decide. The threshold here — >= 5 of ~100 merges
 * landing in a trust-boundary class — was written into
 * `agents/roadmaps/road-to-executable-evidence.md` Phase 2 before this script
 * was first run, so a disappointing number cannot be re-framed into a
 * justification afterwards.
 *
 * Why it must not gate yet: the escalation the reference pairs this with is
 * *non-declinable* — a user's "no" stops counting. That trades away something
 * this package's authority model holds (`agent-authority`, `ask-when-uncertain`),
 * and a trade that size needs evidence that the class it protects is real here,
 * not merely real somewhere.
 *
 * Usage:
 *     ./scripts-run src/scripts/risk_escalation_shadow
 *     ./scripts-run src/scripts/risk_escalation_shadow --limit 200
 *     ./scripts-run src/scripts/risk_escalation_shadow --json
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { classify_diff, type RiskClass } from './_lib/risk_paths.js';

const _FILE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_FILE), '..', '..');
const OUT_REL = 'internal/reports/risk-escalation-shadow.json';

/** Pre-registered in the roadmap BEFORE this report was first read. */
const TEETH_THRESHOLD = 5;

interface MergeRow {
    sha: string;
    subject: string;
    files: number;
    risk: RiskClass;
    reasons: string[];
}

function git(args: string[]): string {
    const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) return '';
    return r.stdout ?? '';
}

function parse_limit(argv: string[]): number {
    const i = argv.indexOf('--limit');
    if (i === -1) return 100;
    const n = Number(argv[i + 1]);
    return Number.isFinite(n) && n > 0 ? n : 100;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const limit = parse_limit(argv);
    const asJson = argv.includes('--json');

    const log = git(['log', '--first-parent', `-${limit}`, '--format=%H%x00%s']).trim();
    if (!log) {
        process.stderr.write('❌  risk_escalation_shadow: no git history readable\n');
        return 2;
    }

    const rows: MergeRow[] = [];
    for (const line of log.split('\n')) {
        const [sha, subject] = line.split('\0');
        if (!sha) continue;
        // First-parent diff: what this merge brought to the trunk.
        const files = git(['show', '--first-parent', '--name-only', '--format=', sha])
            .split('\n')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (files.length === 0) continue;
        const verdict = classify_diff(files);
        rows.push({
            sha: sha.slice(0, 9),
            subject: (subject ?? '').slice(0, 90),
            files: files.length,
            risk: verdict.risk,
            reasons: [...new Set(verdict.reasons.map((r) => r.because))],
        });
    }

    const counts: Record<RiskClass, number> = {
        none: 0,
        governance: 0,
        auth: 0,
        'trust-boundary': 0,
    };
    for (const r of rows) counts[r.risk] += 1;

    const trustBoundary = counts['trust-boundary'];
    const justified = trustBoundary >= TEETH_THRESHOLD;

    const report = {
        _doc:
            'Shadow report for trust-boundary risk escalation. NOTHING IS GATED BY THIS FILE. It answers one ' +
            'question: over recent history, how often did a merge land in a class the reference would have ' +
            'escalated? The threshold below was pre-registered in the roadmap before this was first read.',
        measured_at_sha: rows[0]?.sha ?? null,
        merges_examined: rows.length,
        pre_registered_teeth_threshold: TEETH_THRESHOLD,
        counts,
        trust_boundary_merges: trustBoundary,
        decision: justified
            ? `JUSTIFIED — ${trustBoundary} of ${rows.length} first-parent merges touched a trust-boundary path, ` +
              `at or above the pre-registered threshold of ${TEETH_THRESHOLD}. A non-declinable escalation for ` +
              'that class gets its own ADR and its own PR; it is deliberately NOT enabled by this report.'
            : `NOT JUSTIFIED — ${trustBoundary} of ${rows.length} first-parent merges touched a trust-boundary ` +
              `path, below the pre-registered threshold of ${TEETH_THRESHOLD}. The escalation stays unbuilt and ` +
              'the authority model stays intact. This is the honest-null outcome, published as the answer.',
        note:
            'Classification is path-based and reproducible from the diff alone — no model judgement. Docs-only ' +
            'changes are exempt by extension, except on kernel-rule paths, where a markdown file IS the ' +
            'governed surface.',
        escalating_merges: rows.filter((r) => r.risk !== 'none').slice(0, 40),
    };

    const abs = path.join(REPO, OUT_REL);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(report, null, 2) + '\n');

    if (asJson) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        return 0;
    }

    process.stdout.write(
        `risk-escalation shadow · ${rows.length} first-parent merges examined\n` +
            `    trust-boundary ${counts['trust-boundary']} · auth ${counts.auth} · ` +
            `governance ${counts.governance} · none ${counts.none}\n` +
            `    pre-registered threshold: ${TEETH_THRESHOLD} → ${justified ? 'JUSTIFIED' : 'NOT JUSTIFIED'}\n` +
            `✅  wrote ${OUT_REL}\n`,
    );
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

export { REPO, OUT_REL, TEETH_THRESHOLD };
