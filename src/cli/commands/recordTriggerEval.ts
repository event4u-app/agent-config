/**
 * `agent-config eval:record` — native TS implementation.
 *
 * Records a live trigger-eval result into a corpus manifest's `upstream`
 * block (the second half of the corpus-refresh DoD, ADR-061 §6). It does
 * NOT run the eval — `skill_trigger_eval.py`'s confirmation gate hard-aborts
 * under automation by design, so the live run stays a human, interactive
 * step. This command is a *post-processor*: it reads the `EvalResult` JSON the
 * live run wrote (`--output`), enforces a precision/recall floor, and writes
 * the measured numbers back into the manifest so the result becomes
 * provenance — tied to the exact upstream SHA it was measured against.
 *
 * Floors are DOMAIN-SPECIFIC (road-to-image-brand-typography Phase D council
 * verdict): the floor is resolved per skill from DOMAIN_FLOORS, falling back
 * to the universal default — explicit `--min-recall` / `--min-precision`
 * always override. A reference task (iconography) demands near-perfect
 * precision; a judgment task (brand-strategy) tolerates a looser one.
 *
 * Integrity guards:
 * - Refuses to record a result whose `router` is not the real Anthropic
 *   client (a `--dry-run` / MockRouter result can never masquerade as
 *   provenance), unless `--allow-mock` is passed for plumbing checks.
 * - Stamps `sha_at_eval` from the manifest's current `upstream.sha`, so a
 *   recorded number is forever attached to the pin it was run against. A
 *   later SHA bump visibly invalidates it (`sha_at_eval` != `upstream.sha`).
 *
 * Exit codes mirror the legacy Python recorder:
 *   2 — integrity / IO error (nothing written)
 *   1 — floor not met (recorded for the audit trail, but a failing gate)
 *   0 — pass
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { sep } from 'node:path';
import { z } from 'zod';
import { logger } from '../log/logger.js';

/** Universal fallback floor when a skill carries no domain-specific entry. */
const DEFAULT_FLOOR = { minRecall: 1.0, minPrecision: 0.8 } as const;

/**
 * Domain-specific floors (Phase D council verdict — tuned to the trigger
 * pattern each skill shows, not a single global pair). A reference task wants
 * near-perfect precision; a judgment task tolerates a looser one. Skills
 * absent here fall back to {@link DEFAULT_FLOOR}.
 */
const DOMAIN_FLOORS: Readonly<Record<string, { minRecall: number; minPrecision: number }>> = {
    'image-generation': { minRecall: 1.0, minPrecision: 0.85 },
    iconography: { minRecall: 1.0, minPrecision: 0.9 },
    'brand-strategy': { minRecall: 0.9, minPrecision: 0.7 },
};

export interface RecordTriggerEvalOptions {
    /** Path to the EvalResult JSON written by skill_trigger_eval.py --output. */
    evalJson: string;
    /** Path to the corpus manifest.json to patch. */
    manifest: string;
    /** Floor override: no should-trigger query may be missed (per-skill default otherwise). */
    minRecall?: number;
    /** Floor override: tolerated false-positive rate (per-skill default otherwise). */
    minPrecision?: number;
    /** Permit recording a non-live (MockRouter) result — plumbing only. */
    allowMock?: boolean;
    /** Validate and print the record, but do not write the manifest. */
    dryRun?: boolean;
}

/** Subset of `skill_trigger_eval.py`'s `EvalResult` we depend on. */
const EvalResultSchema = z.object({
    skill: z.string().optional(),
    model: z.string().optional(),
    router: z.string(),
    metrics: z.object({
        precision: z.number(),
        recall: z.number(),
        true_positive: z.number().optional(),
        false_positive: z.number().optional(),
        false_negative: z.number().optional(),
        true_negative: z.number().optional(),
    }),
});

const ManifestSchema = z
    .object({
        upstream: z.object({ sha: z.string() }).passthrough(),
    })
    .passthrough();

interface LastEval {
    date: string;
    model: string;
    router: string;
    sha_at_eval: string;
    precision: number;
    recall: number;
    true_positive: number | null;
    false_positive: number | null;
    false_negative: number | null;
    true_negative: number | null;
    floor: { min_precision: number; min_recall: number };
    passed: boolean;
}

class RecordError extends Error {}

function readJson(path: string): unknown {
    let raw: string;
    try {
        raw = readFileSync(path, 'utf8');
    } catch {
        throw new RecordError(`file not found: ${path}`);
    }
    try {
        return JSON.parse(raw);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new RecordError(`invalid JSON in ${path}: ${detail}`);
    }
}

/**
 * Best-effort skill-name inference from the manifest's location. Layout is
 * `.../skills/<skill>/data/manifest.json`. Used only to catch an accidental
 * mismatch between the eval JSON and the manifest being patched.
 */
function expectedSkillFromManifest(manifestPath: string): string | null {
    const parts = manifestPath.split(sep);
    const i = parts.indexOf('skills');
    if (i >= 0 && i + 1 < parts.length) return parts[i + 1] ?? null;
    return null;
}

/** Resolve the floor: explicit opts win, then the per-skill floor, then the default. */
function resolveFloor(
    skill: string | null,
    opts: RecordTriggerEvalOptions,
): { minRecall: number; minPrecision: number } {
    const domain = (skill && DOMAIN_FLOORS[skill]) || DEFAULT_FLOOR;
    return {
        minRecall: opts.minRecall ?? domain.minRecall,
        minPrecision: opts.minPrecision ?? domain.minPrecision,
    };
}

export function runRecordTriggerEval(opts: RecordTriggerEvalOptions): number {
    const allowMock = opts.allowMock ?? false;
    const dryRun = opts.dryRun ?? false;

    let record: LastEval;
    let manifest: Record<string, unknown>;
    let evalSkill: string | undefined;
    let expectedSkill: string | null;

    try {
        const parsedEval = EvalResultSchema.safeParse(readJson(opts.evalJson));
        if (!parsedEval.success) {
            throw new RecordError(`eval JSON is not a valid EvalResult: ${parsedEval.error.message}`);
        }
        const parsedManifest = ManifestSchema.safeParse(readJson(opts.manifest));
        if (!parsedManifest.success) {
            throw new RecordError(`${opts.manifest} has no \`upstream.sha\` to attach the eval to`);
        }

        const ev = parsedEval.data;
        manifest = parsedManifest.data as Record<string, unknown>;
        const upstream = (manifest as { upstream: { sha: string } }).upstream;

        const router = ev.router.toLowerCase();
        if (router !== 'anthropic' && !allowMock) {
            throw new RecordError(
                `refusing to record a non-live result (router='${router}'). ` +
                    'A dry-run / MockRouter number is not provenance. ' +
                    'Run the live eval, or pass --allow-mock for a plumbing check.',
            );
        }

        expectedSkill = expectedSkillFromManifest(opts.manifest);
        evalSkill = ev.skill;
        if (expectedSkill && evalSkill && evalSkill !== expectedSkill) {
            throw new RecordError(
                `skill mismatch: eval JSON is for '${evalSkill}' but the manifest path implies '${expectedSkill}'`,
            );
        }

        const { minRecall, minPrecision } = resolveFloor(evalSkill ?? expectedSkill, opts);
        const { precision, recall } = ev.metrics;
        const passed = precision >= minPrecision && recall >= minRecall;

        record = {
            date: new Date().toISOString().slice(0, 10),
            model: ev.model ?? 'unknown',
            router,
            sha_at_eval: upstream.sha,
            precision: Math.round(precision * 1000) / 1000,
            recall: Math.round(recall * 1000) / 1000,
            true_positive: ev.metrics.true_positive ?? null,
            false_positive: ev.metrics.false_positive ?? null,
            false_negative: ev.metrics.false_negative ?? null,
            true_negative: ev.metrics.true_negative ?? null,
            floor: { min_precision: minPrecision, min_recall: minRecall },
            passed,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`❌  ${message}`);
        return 2;
    }

    (manifest as { upstream: Record<string, unknown> }).upstream.last_eval = record;

    const summary =
        `skill=${evalSkill ?? expectedSkill ?? '?'}  ` +
        `precision=${record.precision}  recall=${record.recall}  ` +
        `floor=${record.floor.min_recall}/${record.floor.min_precision}  ` +
        `sha=${record.sha_at_eval.slice(0, 8)}  passed=${record.passed}`;

    if (dryRun) {
        logger.info('(dry-run, manifest not written)');
        logger.info(JSON.stringify(record, null, 2));
        logger.info(summary);
        return record.passed ? 0 : 1;
    }

    writeFileSync(opts.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    logger.info(`✓  recorded into ${opts.manifest}`);
    logger.info(summary);
    if (!record.passed) {
        logger.warn(
            '⚠  floor NOT met — recorded for the audit trail, but treat this ' +
                "as a failing gate (the description's triggers regressed).",
        );
    }
    return record.passed ? 0 : 1;
}
