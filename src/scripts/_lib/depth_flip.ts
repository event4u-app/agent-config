/**
 * Where a lowered ceremony depth may apply, and when it must stop applying.
 *
 * The owner's decision of 2026-10-21 (option (d) of the
 * `class-depth-flip-reopens-the-risk-null` blocker) allows a lower depth only
 * on steps whose every changed path is structurally safe — prose about the work
 * rather than the work, or a test fixture — and only once the shadow reading
 * clears the pre-registered threshold. A sampled full-depth audit then keeps
 * reading each lowered class, and a class whose sampled escapes exceed the same
 * threshold returns to full depth without anyone having to notice.
 */
import { createHash } from 'node:crypto';

import type { RiskClass } from '../classify_change_risk.js';

/**
 * Paths whose risk the path itself bounds.
 *
 * Narrower than R0 on purpose: R0 admits every `.md`, and in this repository a
 * rule, a skill or a contract is markdown that changes what agents do. Those
 * stay at full depth whatever their extension.
 */
export const SAFE_PATH_PATTERNS: readonly RegExp[] = [
    /^agents\/roadmaps\/.+\.md$/,
    /^agents\/evidence\/.+\.md$/,
    /^docs\/(?!contracts\/|decisions\/).+\.md$/,
    /^README\.md$/,
    /(^|\/)tests?\/(.+\/)?fixtures?\//,
];

export function isStructurallySafe(paths: readonly string[]): boolean {
    return paths.length > 0 && paths.every((p) => SAFE_PATH_PATTERNS.some((re) => re.test(p.replace(/^\.\//, ''))));
}

export interface FlipThreshold {
    /** Steps (or audit samples) a class needs before its figures are read. */
    min_steps: number;
    /** Escaped high/critical findings tolerated across those steps. */
    max_escaped: number;
    max_critical: number;
}

export interface FlipBlock {
    scope: 'structurally-safe-paths';
    classes: RiskClass[];
    requires: FlipThreshold;
    /** Repo-relative path of the committed reading that cleared `requires`; null until then. */
    reading: string | null;
}

export interface AuditSample {
    step: string;
    cls: RiskClass;
    escaped: boolean;
    critical: boolean;
    date: string;
}

/**
 * Whether the step is audited at full depth after merge: 1 in 4 of a class's
 * first `min_steps` lowered steps, 1 in 10 after. Seeded by the step key alone,
 * so anyone re-running it on the same key gets the same answer.
 */
export function sampledForAudit(stepKey: string, lowersSoFar: number, threshold: FlipThreshold): boolean {
    const every = lowersSoFar < threshold.min_steps ? 4 : 10;
    const digest = createHash('sha256').update(`depth-audit-v1:${stepKey}`).digest();
    return digest.readUInt32BE(0) % every === 0;
}

/**
 * Classes whose audit samples have broken the threshold. A class is read only
 * once it has `min_steps` samples, and from then on the latest `min_steps` decide.
 */
export function rolledBackClasses(samples: readonly AuditSample[], threshold: FlipThreshold): RiskClass[] {
    const byClass = new Map<RiskClass, AuditSample[]>();
    for (const s of [...samples].sort((a, b) => a.date.localeCompare(b.date))) {
        byClass.set(s.cls, [...(byClass.get(s.cls) ?? []), s]);
    }
    const out: RiskClass[] = [];
    for (const [cls, all] of byClass) {
        if (all.length < threshold.min_steps) continue;
        const window = all.slice(-threshold.min_steps);
        const escaped = window.filter((s) => s.escaped).length;
        const critical = window.filter((s) => s.critical).length;
        if (escaped > threshold.max_escaped || critical > threshold.max_critical) out.push(cls);
    }
    return out.sort();
}

/** The depth a step actually runs at: lowered only inside the owner's scope, and never for a rolled-back class. */
export function effectiveMode(
    tableMode: 'shadow' | 'active',
    cls: RiskClass,
    paths: readonly string[],
    flip: FlipBlock,
    rolledBack: readonly RiskClass[],
): 'shadow' | 'active' {
    const lowered =
        tableMode === 'active' && flip.classes.includes(cls) && isStructurallySafe(paths) && !rolledBack.includes(cls);
    return lowered ? 'active' : 'shadow';
}
