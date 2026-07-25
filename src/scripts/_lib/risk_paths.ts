/**
 * Trust-boundary risk classification — the second axis of rigor.
 *
 * `discipline_profile: auto` answers one question: *how much governance can
 * this host afford?* It is a property of the environment. The question it
 * cannot ask is *how dangerous is this diff?* — a property of the change.
 *
 * The two are orthogonal, and today only one of them is wired. That leaves a
 * live combination: a weak host plus a diff in the installer's provenance path
 * resolves to minimum discipline, which is exactly the change class hardened in
 * 9.6.0 (CWE-426/88/427). The fix went in; the process escalation for the next
 * change of the same class did not.
 *
 * **This module classifies. It does not gate.** It exists to produce the number
 * that decides whether gating is justified — see
 * `internal/reports/risk-escalation-shadow.json`. The teeth threshold was
 * written into the roadmap before the report was first read, so the measurement
 * cannot be rationalised after the fact.
 *
 * Classification is path-based on purpose. A model judgement about whether a
 * diff "feels risky" is not reproducible from the diff alone; a path match is.
 */

import { KERNEL_RULE_FILENAMES } from './kernel_rules.js';

/** Risk classes, in ascending severity. `none` is the common case. */
export type RiskClass = 'none' | 'governance' | 'auth' | 'trust-boundary';

/** Severity order — used to take the max across a multi-file diff. */
const SEVERITY: Record<RiskClass, number> = {
    none: 0,
    governance: 1,
    auth: 2,
    'trust-boundary': 3,
};

export interface RiskVerdict {
    /** Highest class across every path in the diff. */
    risk: RiskClass;
    /** Why — one reason per matched path, for the report. */
    reasons: { path: string; risk: RiskClass; because: string }[];
}

/**
 * Docs-only changes are exempt from escalation.
 *
 * Taken from the reference, which carves this out explicitly, and it is the
 * right carve-out: a paragraph describing the installer does not cross a trust
 * boundary.
 *
 * The exemption is about what a file *is*, not what extension it carries. In
 * this repo governance is written in markdown — a rule file, `AGENTS.md`, and
 * the kernel set are all `.md`, and all of them are executable policy rather
 * than prose about policy. An extension-only test classified
 * `src/rules/icon-consistency.md` as `none`, which is how the most governed
 * surface in the tree would have escaped the classifier entirely. Governed
 * markdown is excluded from the exemption up front.
 */
function is_docs_only(p: string): boolean {
    if (!/\.(md|mdx|txt)$/i.test(p)) return false;
    if (p.startsWith('src/rules/')) return false;
    if (/(^|\/)AGENTS\.md$/.test(p)) return false;
    return true;
}

/**
 * Does this path carry authentication, authorization, session, or token logic?
 * Kept to the names this repo actually uses, so it does not fire on every file
 * with "user" in it.
 */
function is_auth_path(p: string): boolean {
    return /(^|\/)(auth|authz|session|token|credential|secret)s?[/.]/i.test(p)
        || /(^|\/)(keys|keychain)\b/i.test(p);
}

/**
 * Does this path decide *where framework code comes from* or *whether it is
 * genuine*? This is the class the reference justifies in its own text as
 * crossing a downstream trust boundary — the change affects people other than
 * the one making it, because a consumer installs the result.
 */
function is_trust_boundary_path(p: string): boolean {
    if (p.startsWith('src/install/')) return true;
    if (/(^|\/)(install|bootstrap|update)r?\.(ts|sh|mjs|cjs)$/i.test(p)) return true;
    if (/scripts\/install/i.test(p)) return true;
    if (/(^|\/)(provenance|manifest|integrity|bundle)[.-]/i.test(p)) return true;
    // Publishing and release automation resolve the source a consumer receives.
    if (/^\.github\/workflows\/(publish|release)/i.test(p)) return true;
    // The spawn path composes the prompt a subagent runs under, floor included.
    if (/subagent_(spawn|bundle|floor)/i.test(p)) return true;
    if (/generate_subagent_floor/i.test(p)) return true;
    return false;
}

/** Kernel rules and the safety floor — the invariants everything else rests on. */
function is_kernel_path(p: string): boolean {
    const base = p.slice(p.lastIndexOf('/') + 1);
    if (p.startsWith('src/rules/') && KERNEL_RULE_FILENAMES.has(base)) return true;
    return /_lib\/kernel_rules\.ts$/.test(p) || /iron_law_sha/.test(p);
}

/** Governance surfaces — rules, settings schema, and the agent contract files. */
function is_governance_path(p: string): boolean {
    if (p.startsWith('src/rules/')) return true;
    if (/(^|\/)AGENTS\.md$/.test(p)) return true;
    if (/agent-settings.*\.(yml|yaml|json)$/i.test(p)) return true;
    if (/schemas\/.*\.schema\.json$/.test(p)) return true;
    return false;
}

/** Classify one path. */
export function classify_path(p: string): { risk: RiskClass; because: string } {
    // Kernel and spawn paths outrank the docs exemption: a kernel rule IS a
    // markdown file, so exempting by extension first would classify the most
    // dangerous surface in the repo as `none`.
    if (is_kernel_path(p)) {
        return { risk: 'trust-boundary', because: 'kernel rule or Iron-Law integrity surface' };
    }
    if (is_docs_only(p)) return { risk: 'none', because: 'docs-only' };
    if (is_trust_boundary_path(p)) {
        return {
            risk: 'trust-boundary',
            because: 'installer, provenance, publish, or subagent-spawn path — crosses a downstream trust boundary',
        };
    }
    if (is_auth_path(p)) {
        return { risk: 'auth', because: 'authentication, session, token, or secret handling' };
    }
    if (is_governance_path(p)) {
        return { risk: 'governance', because: 'rule, settings, or schema surface' };
    }
    return { risk: 'none', because: '' };
}

/** Classify a whole diff — the verdict is the highest class present. */
export function classify_diff(paths: readonly string[]): RiskVerdict {
    const reasons: RiskVerdict['reasons'] = [];
    let risk: RiskClass = 'none';
    for (const p of paths) {
        const v = classify_path(p);
        if (v.risk === 'none') continue;
        reasons.push({ path: p, risk: v.risk, because: v.because });
        if (SEVERITY[v.risk] > SEVERITY[risk]) risk = v.risk;
    }
    return { risk, reasons };
}

/**
 * Combine the host axis with the risk axis.
 *
 * The direction is the whole point and is encoded rather than left to a caller:
 * the host profile sets a floor, a risk trigger may only **raise** it. A weak
 * host must never be able to lower an escalation, which is the failure mode
 * that makes the two-axis model worth having at all.
 */
export function escalated_floor(hostFloor: number, risk: RiskClass): number {
    return Math.max(hostFloor, SEVERITY[risk]);
}

export { SEVERITY as RISK_SEVERITY };
