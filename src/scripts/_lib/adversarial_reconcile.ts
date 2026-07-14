/**
 * Adversarial verification council — reconciliation core (Phase 1).
 *
 * Pure, no-I/O, DETERMINISTIC (no Date/random — ids come from sorted key order).
 * Turns per-skeptic finding lists into one `AdversarialFindings` envelope with
 * per-finding provenance (which models raised it) and a cross-model confidence
 * signal. This is the countable heart the ADR mandates lives in TS with tests,
 * never as LLM-computed prose.
 *
 * Contract: it VERIFIES (ranks + annotates findings). It NEVER gates the change
 * — the panel is advisory only (Hard Floor). "Suppression" of a false positive
 * demotes a finding into `false_positives_suppressed`; it is never silently
 * dropped.
 *
 * Schema: src/skills/subagent-orchestration/schemas/adversarial-findings.json
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Confidence = 'high' | 'medium' | 'low';

/** Worst → best; index is the rank used for severity aggregation + sorting. */
const SEVERITY_ORDER: readonly Severity[] = ['critical', 'high', 'medium', 'low'];

/** A single defect as one skeptic reports it. */
export interface RawFinding {
    severity: Severity;
    category: string;
    location: string;
    description: string;
}

/** One skeptic's return: what it raised, plus keys it examined and judged clean. */
export interface SkepticReturn {
    model: string;
    findings: RawFinding[];
    /** `findingKey` values this skeptic actively refuted (examined → not a defect). */
    refutes?: string[];
}

export interface Finding {
    id: string;
    severity: Severity;
    category: string;
    location: string;
    description: string;
    raised_by: string[];
    refuted_by: string[];
    confidence: Confidence;
}

export interface AdversarialFindings {
    panel: { models: string[]; skeptic_count: number };
    findings: Finding[];
    false_positives_suppressed: Finding[];
}

/** Dedup key — same location + same category is the same defect. */
export function findingKey(f: Pick<RawFinding, 'location' | 'category'>): string {
    return `${f.location.trim()}::${f.category.trim().toLowerCase()}`;
}

/** Throw on a malformed raw finding — the reconciler refuses garbage in. */
export function assertValidRawFinding(f: RawFinding): void {
    if (!SEVERITY_ORDER.includes(f.severity)) {
        throw new Error(`invalid severity: ${JSON.stringify(f.severity)}`);
    }
    for (const [k, v] of Object.entries({ category: f.category, location: f.location, description: f.description })) {
        if (typeof v !== 'string' || v.trim().length === 0) {
            throw new Error(`finding.${k} must be a non-empty string`);
        }
    }
}

/** Most-severe (lowest index) of two severities. */
function moreSevere(a: Severity, b: Severity): Severity {
    return SEVERITY_ORDER.indexOf(a) <= SEVERITY_ORDER.indexOf(b) ? a : b;
}

/**
 * Confidence from corroboration:
 * - `high`   — raised by >=2 skeptics AND by at least half the panel (quorum).
 * - `medium` — raised by >=2 (below quorum), OR the lone raiser on a solo panel.
 * - `low`    — a single raiser on a multi-skeptic panel (uncorroborated doubt).
 */
export function severityQuorum(raisedCount: number, refutedCount: number, panelSize: number): Confidence {
    if (raisedCount >= 2 && raisedCount * 2 >= panelSize) return 'high';
    if (raisedCount >= 2) return 'medium';
    if (panelSize === 1 && refutedCount === 0) return 'medium';
    return 'low';
}

/**
 * A finding is a suppressible false positive when a single skeptic raised it and
 * a strict majority of the OTHER skeptics actively refuted it. Demote, never drop.
 */
export function isSuppressedFalsePositive(raisedCount: number, refutedCount: number, panelSize: number): boolean {
    if (raisedCount !== 1) return false;
    const others = panelSize - 1;
    return others > 0 && refutedCount * 2 > others;
}

interface Aggregate {
    key: string;
    severity: Severity;
    category: string;
    location: string;
    description: string;
    raised_by: string[];
    refuted_by: string[];
}

/**
 * Reconcile per-skeptic returns into one advisory findings envelope.
 * Deterministic: findings are id'd and ordered by (severity rank, key).
 */
export function reconcileFindings(returns: SkepticReturn[]): AdversarialFindings {
    const models = returns.map((r) => r.model);
    const skepticCount = returns.length;
    const byKey = new Map<string, Aggregate>();

    for (const ret of returns) {
        for (const raw of ret.findings) {
            assertValidRawFinding(raw);
            const key = findingKey(raw);
            const existing = byKey.get(key);
            if (existing) {
                existing.severity = moreSevere(existing.severity, raw.severity);
                if (!existing.raised_by.includes(ret.model)) existing.raised_by.push(ret.model);
                // Keep the longest description — usually the most informative.
                if (raw.description.trim().length > existing.description.length) {
                    existing.description = raw.description.trim();
                }
            } else {
                byKey.set(key, {
                    key,
                    severity: raw.severity,
                    category: raw.category.trim(),
                    location: raw.location.trim(),
                    description: raw.description.trim(),
                    raised_by: [ret.model],
                    refuted_by: [],
                });
            }
        }
    }

    // Second pass: attach refutations only to findings that were actually raised.
    for (const ret of returns) {
        for (const refutedKey of ret.refutes ?? []) {
            const agg = byKey.get(refutedKey);
            if (agg && !agg.raised_by.includes(ret.model) && !agg.refuted_by.includes(ret.model)) {
                agg.refuted_by.push(ret.model);
            }
        }
    }

    const ordered = [...byKey.values()].sort((a, b) => {
        const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
        return bySeverity !== 0 ? bySeverity : a.key.localeCompare(b.key);
    });

    const findings: Finding[] = [];
    const suppressed: Finding[] = [];
    ordered.forEach((agg, i) => {
        const finding: Finding = {
            id: `avc-${String(i + 1).padStart(3, '0')}`,
            severity: agg.severity,
            category: agg.category,
            location: agg.location,
            description: agg.description,
            raised_by: agg.raised_by,
            refuted_by: agg.refuted_by,
            confidence: severityQuorum(agg.raised_by.length, agg.refuted_by.length, skepticCount),
        };
        if (isSuppressedFalsePositive(agg.raised_by.length, agg.refuted_by.length, skepticCount)) {
            suppressed.push(finding);
        } else {
            findings.push(finding);
        }
    });

    return {
        panel: { models, skeptic_count: skepticCount },
        findings,
        false_positives_suppressed: suppressed,
    };
}
