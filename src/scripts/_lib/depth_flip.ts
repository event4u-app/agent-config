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
 * rule, a skill, a contract, a guideline agents read before coding, or a record
 * that grants authority (an owner directive, a ratification) is markdown that
 * changes what agents do. Those stay at full depth whatever their extension.
 */
export const SAFE_PATH_PATTERNS: readonly RegExp[] = [
    /^agents\/roadmaps\/.+\.md$/,
    /^agents\/evidence\/(?!owner-directives\/|ratifications\/).+\.md$/,
    /^docs\/(?!contracts\/|decisions\/|guidelines\/).+\.md$/,
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

export interface ParsedReceipt {
    cls: RiskClass;
    mode: 'shadow' | 'active';
    /** The receipt was written for a step whose every path is structurally safe. */
    safe: boolean;
}

const RECEIPT_LINE = /<!--\s*receipt:\s*class=(R[0-3])\s*·\s*(shadow|active)\b([^>]*)-->/;

export function parseReceipt(line: string): ParsedReceipt | null {
    const m = RECEIPT_LINE.exec(line);
    if (m === null) return null;
    return { cls: m[1] as RiskClass, mode: m[2] as 'shadow' | 'active', safe: /·\s*scope=safe\b/.test(m[3] ?? '') };
}

/** Ticked steps of `cls` whose receipt reads `active` — the lowered steps so far, from the roadmaps themselves. */
export function lowersSoFar(roadmapTexts: readonly string[], cls: RiskClass): number {
    let n = 0;
    for (const text of roadmapTexts) {
        for (const line of text.split('\n')) {
            if (!/^\s*-\s\[x\]\s/.test(line)) continue;
            const r = parseReceipt(line);
            if (r !== null && r.cls === cls && r.mode === 'active') n += 1;
        }
    }
    return n;
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
 * Classes whose audit samples have broken the threshold, read over the latest
 * `min_steps` samples. A window still filling up is read too: a second escape
 * or a critical among fewer samples has already broken the threshold, and
 * waiting for thirty would keep a class lowered after it failed.
 */
export function rolledBackClasses(samples: readonly AuditSample[], threshold: FlipThreshold): RiskClass[] {
    const byClass = new Map<RiskClass, AuditSample[]>();
    for (const s of [...samples].sort((a, b) => a.date.localeCompare(b.date))) {
        byClass.set(s.cls, [...(byClass.get(s.cls) ?? []), s]);
    }
    const out: RiskClass[] = [];
    for (const [cls, all] of byClass) {
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
