/**
 * Judgment ladder (Phase 2, road-to-always-on-orchestration) — the ONE
 * resolver that decides which of the five dispatch rungs (0-4), or the
 * silent ∅, a task resolves to. Committed table + rationale:
 * `src/agent-src/contexts/execution/auto-dispatch-classification.md`
 * § Judgment ladder.
 *
 * This WRAPS `classifyTask` rather than replacing it — rungs 1 and 2 ARE
 * `classifyTask`'s existing dispatch verdict (single-slice vs multi-slice);
 * rungs 0, 3, and 4 are new signal layers checked around it, in a FIXED
 * priority order (documented on {@link classifyLadder} itself, because the
 * order IS the contract: two signals matching the same text must resolve
 * deterministically, never on evaluation-order accident).
 *
 * Three previously-scattered classification surfaces (the delegable-signal
 * rules in `auto_dispatch.ts`, ad-hoc "should this be a team" judgment
 * calls, and the absence of any council-routing signal on the TASK side)
 * get ONE committed name and ONE resolver here — never a fourth parallel
 * classifier bolted on beside it.
 *
 * Deliberately independent of `ai_council/necessity.ts`: that module is the
 * council's OWN necessity gate (its `NECESSARY_TRIGGERS` vocabulary and its
 * `off|educate|block|warn-only` modes stay the council-side surface, per the
 * roadmap's 2.2 note). This resolver's rung-4 signals are a NEW, narrower
 * set — the three shapes the roadmap names explicitly (design decision,
 * security downgrade, release-gate escalation) — kept as separate,
 * regex-only constants rather than an import so this resolver carries no
 * runtime dependency on the council module.
 */
import {
    classifyLookup,
    classifyTask,
    SIZE_FLOOR,
    type ActivationInputs,
    type DispatchMode,
    type TaskSignals,
} from './auto_dispatch.js';

/** The five dispatch rungs, or `null` for the silent ∅ (in-session / ask). */
export type LadderRung = 0 | 1 | 2 | 3 | 4 | null;

export type LadderVerdict =
    | 'script' // rung 0 — deterministic transform/primitive, no spawn at all
    | 'subagent' // rung 1/2 — one, or several downshifted, subagent dispatch(es)
    | 'team' // rung 3 — communicating slices, dispatched via the host teams primitive
    | 'council' // rung 4 — contested judgment
    | 'ask' // ∅ — ambiguous; a VERDICT to the user, never a speculative spawn
    | 'in-session'; // ∅ — halted, no host primitive, trivial, approval-required, or recursive guard

export interface LadderResult {
    rung: LadderRung;
    verdict: LadderVerdict;
    reason: string;
    /**
     * Present only when a HIGHER rung's signal fired but its precondition
     * failed (today: rung 3's `agentTeams` host-capability check) and
     * resolution fell back to a lower rung/verdict. Names the rung the
     * signal originally pointed at, never the resolved one.
     */
    degraded_from?: LadderRung;
    /**
     * Carried through from `classifyTask` when the resolved rung is 1 or 2
     * — the concrete `subagent-orchestration` mode a caller dispatches on.
     * `null` for rung 1 (a single bounded slice has no do-in-steps /
     * do-in-parallel shape of its own) and for every non-subagent verdict.
     * Not part of the roadmap's minimal `{rung, verdict, reason,
     * degraded_from?}` shape — added because the delegation-nudge hook
     * (2.4) needs the concrete mode to build its injected line.
     */
    mode?: DispatchMode | null;
}

export interface LadderInputs {
    /**
     * Raw task/prompt text — regex-only signal extraction for rungs 0, 1, 3,
     * and 4, in the same discipline as `delegation_nudge_hook.ts`'s
     * extractors (cheap, no LLM call; false-positive/negative trade-offs
     * documented per pattern below).
     */
    taskText: string;
    /** Structural signals `classifyTask` already consumes — rungs 1/2. */
    signals: TaskSignals;
    /** Emergency halt + subagent_spawn primitive — gates every rung above 0. */
    activation: ActivationInputs;
    /**
     * Host-capability manifest's `agent_teams` field
     * (`host_capability.ts::probeHostCapabilities`) — rung 3's precondition.
     * Absent/`false` degrades a matched rung-3 signal to rung 2.
     */
    agentTeams: boolean;
    /**
     * Caller states this step needs an explicit human decision before
     * anything may run (an approval gate, a Hard-Floor action, …) — NEVER
     * inferred from `taskText`. Checked first; overrides every other signal.
     */
    interactiveApprovalRequired?: boolean;
    /**
     * Recursive-dispatch guard (2.3). See {@link classifyLadder}'s doc
     * comment for the honest scope of what this suite can and cannot
     * detect on its own — this field is a CALLER-SUPPLIED fact, never
     * something this resolver probes for itself.
     */
    insideSubagentSession?: boolean;
}

// ── Rung 0 — mechanical-transform signals (regex-only) ──────────────────
//
// `classifyLookup` (auto_dispatch.ts, road-to-lean-agent-init L0) already
// covers the READ-ONLY half of "deterministic script, no spawn" (definition/
// references/string-existence/report-run lookups). This adds the WRITE half
// the roadmap names explicitly: mechanical transforms with no semantics to
// judge — a rename, a codemod, a formatter run, a bulk search-and-replace.
// Each pattern requires the verb AND its object shape (e.g. "rename X to Y",
// not bare "rename") so a sentence that merely MENTIONS renaming in passing
// ("we renamed this last week") does not false-positive into rung 0.
const RENAME_RE = /\brename\s+\S+\s+to\s+\S+\b/i;
const CODEMOD_RE = /\bcodemod\b/i;
const FORMATTER_RUN_RE =
    /\bauto-?format(?:ting)?\b|\breformat(?:ting)?\b|\brun(?:ning)?\s+prettier\b|\brun(?:ning)?\s+eslint\s*--fix\b|\bapply\s+eslint\s*--fix\b/i;
const SEARCH_REPLACE_RE = /\bsearch-and-replace\b|\bfind-and-replace\b|\bbulk\s+rename\b/i;

export function detectMechanicalTransform(text: string): { matched: boolean; reason: string } {
    const rename = RENAME_RE.exec(text);
    if (rename) {
        return { matched: true, reason: `rename signal ("${rename[0]}") — deterministic script, no spawn` };
    }
    const codemod = CODEMOD_RE.exec(text);
    if (codemod) {
        return { matched: true, reason: `codemod signal ("${codemod[0]}") — deterministic script, no spawn` };
    }
    const formatter = FORMATTER_RUN_RE.exec(text);
    if (formatter) {
        return { matched: true, reason: `formatter-run signal ("${formatter[0]}") — deterministic script, no spawn` };
    }
    const searchReplace = SEARCH_REPLACE_RE.exec(text);
    if (searchReplace) {
        return {
            matched: true,
            reason: `search-and-replace/bulk-rename signal ("${searchReplace[0]}") — deterministic script, no spawn`,
        };
    }
    return { matched: false, reason: 'no mechanical-transform signal' };
}

// ── Rung 1 — single bounded read-heavy slice (regex-only) ───────────────
//
// The one rung `classifyTask` structurally cannot see: its delegable rules
// all require >=2 slices, an ordered plan, or a declared `parallelizable`
// frontmatter value. A single "read this whole file and summarize it" task
// is real, non-trivial work that still benefits from a lite-tier subagent
// (session-context savings) but has no multi-slice shape at all. Requires a
// read-heavy VERB plus a bounded, singular TARGET phrase — a bare "read the
// code" without a stated target is too weak a signal to spawn on.
const SINGLE_SLICE_READHEAVY_RE =
    /\b(?:read|review|summarize|summarise|inventory|audit|investigate|research|inspect|dig into|look into)\b[^.!?\n]{0,80}\b(?:this file|the file|this codebase|the codebase|this transcript|the transcript|this log|the log|this document|the document|this diff|the diff)\b/i;

export function detectBoundedReadHeavySlice(text: string): { matched: boolean; reason: string } {
    const m = SINGLE_SLICE_READHEAVY_RE.exec(text);
    return m
        ? {
              matched: true,
              reason: `single bounded read-heavy slice ("${m[0]}") — one lite-tier subagent instead of session-context burn`,
          }
        : { matched: false, reason: 'no single-slice read-heavy signal' };
}

// ── Rung 3 — communication-need signals (team) ───────────────────────────
//
// "Slices that must communicate" per the committed table: cross-layer work,
// an in-flight review-with-challenge shape, or an explicit shared work
// queue — signals a single implementer-then-judge handoff, or a set of
// independent parallel slices, cannot express, because the workers need to
// see each other's state DURING the run, not just at handoff.
const CROSS_LAYER_RE =
    /\bcross[- ]layer\b|\bcross[- ]cutting\b|\bback[- ]?end\s+and\s+front[- ]?end\b|\bfront[- ]?end\s+and\s+back[- ]?end\b/i;
const REVIEW_WITH_CHALLENGE_RE =
    /\breview[- ]with[- ]challenge\b|\bchallenge[- ]and[- ]implement\b|\bimplementer\s+and\s+(?:a\s+)?(?:judge|reviewer)\s+(?:working\s+)?together\b|\bsecond\s+opinion\s+while\s+(?:building|implementing)\b/i;
const SHARED_TASK_LIST_RE =
    /\bshared\s+(?:task\s+list|todo\s+list|backlog)\b|\bcoordinat(?:e|ed|ing)\s+(?:with|between|across)\s+(?:multiple\s+|several\s+)?(?:agents|workers|subagents|teammates)\b/i;

export function detectCommunicationNeed(text: string): { matched: boolean; reason: string } {
    const crossLayer = CROSS_LAYER_RE.exec(text);
    if (crossLayer) {
        return { matched: true, reason: `cross-layer communication signal ("${crossLayer[0]}")` };
    }
    const reviewChallenge = REVIEW_WITH_CHALLENGE_RE.exec(text);
    if (reviewChallenge) {
        return { matched: true, reason: `review-with-challenge signal ("${reviewChallenge[0]}")` };
    }
    const sharedList = SHARED_TASK_LIST_RE.exec(text);
    if (sharedList) {
        return { matched: true, reason: `shared-task-list signal ("${sharedList[0]}")` };
    }
    return { matched: false, reason: 'no communication-need signal' };
}

// ── Rung 4 — contested-judgment signals (council) ────────────────────────
//
// "Judgment under disagreement" per the committed table: a design decision,
// a proposed security downgrade, or an escalation at a release gate — the
// three shapes the roadmap names explicitly. Deliberately its OWN, narrower
// vocabulary rather than an import of `ai_council/necessity.ts`'s broader
// `NECESSARY_TRIGGERS` (architecture/tradeoff/ambiguity/strategic): that
// module stays the council's own necessity gate; this resolver only needs
// the narrow signal that should route a TASK to rung 4 in the first place.
// A bare `\badr\b` (no decision-context anchor) matched "update the ADR
// index" and "fix the release-gate CI script typo" — routine maintenance
// prose that names the artefact/gate but decides nothing — and suppressed
// the correct rung-2 nudge on both. Both alternatives below now require an
// explicit decision/escalation VERB within 40 chars of the artefact/gate
// token, on either side, so the bare noun alone never fires.
const DESIGN_DECISION_RE =
    /\bdesign\s+decision\b|\barchitectur(?:e|al)\s+decision\b|\b(?:record(?:ing)?|decide|deciding|decision|accept(?:ed|ing)?|approv(?:e|ed|ing|al)|challeng(?:e|ed|ing)|choos(?:e|ing)|reject(?:ed|ing)?)\b[^.!?\n]{0,40}\bADR\b|\bADR\b[^.!?\n]{0,40}\b(?:record(?:ing)?|decide|deciding|decision|accept(?:ed|ing)?|approv(?:e|ed|ing|al)|challeng(?:e|ed|ing)|choos(?:e|ing)|reject(?:ed|ing)?)\b/i;
const SECURITY_DOWNGRADE_RE = /\bsecurity\s+downgrade\b|\bdowngrade\s+(?:the\s+)?security\b|\bsecurity\s+exception\b/i;
const RELEASE_GATE_ESCALATION_RE =
    /\bgate\s+escalation\b|\bescalat(?:e|ion)\s+to\s+(?:the\s+)?council\b|\b(?:escalat(?:e|ing|ion)|contest(?:ed|ing)?|dispute|disputing|override|overriding|waiv(?:e|ing)|bypass(?:ed|ing)?|challeng(?:e|ed|ing))\b[^.!?\n]{0,40}\brelease[- ]gate\b|\brelease[- ]gate\b[^.!?\n]{0,40}\b(?:escalat(?:e|ing|ion)|contest(?:ed|ing)?|dispute|disputing|override|overriding|waiv(?:e|ing)|bypass(?:ed|ing)?|challeng(?:e|ed|ing))\b/i;

export function detectContestedJudgment(text: string): { matched: boolean; reason: string } {
    const design = DESIGN_DECISION_RE.exec(text);
    if (design) {
        return { matched: true, reason: `design-decision signal ("${design[0]}")` };
    }
    const security = SECURITY_DOWNGRADE_RE.exec(text);
    if (security) {
        return { matched: true, reason: `security-downgrade signal ("${security[0]}")` };
    }
    const releaseGate = RELEASE_GATE_ESCALATION_RE.exec(text);
    if (releaseGate) {
        return { matched: true, reason: `release-gate-escalation signal ("${releaseGate[0]}")` };
    }
    return { matched: false, reason: 'no contested-judgment signal' };
}

/**
 * Resolve the judgment-ladder verdict for one task.
 *
 * FIXED priority order (the order is the contract):
 *
 * 1. `interactiveApprovalRequired` — caller-stated, overrides everything.
 * 2. Rung 0 (`classifyLookup` primitive match OR a mechanical-transform
 *    signal) — never spawns, so neither the recursive guard nor the
 *    activation gate applies to it.
 * 3. Recursive-dispatch guard (2.3) — `insideSubagentSession` resolves ∅
 *    for every rung below this point.
 * 4. Activation gate (`halted` / no `subagent_spawn`) — nothing below this
 *    point can spawn without it.
 * 5. Rung 4 (contested-judgment signal) — council.
 * 6. Rung 3 (communication-need signal) — team when `agentTeams`; otherwise
 *    degrades to whatever `classifyTask` resolves on the SAME signals
 *    (usually rung 2 — slices that must communicate are usually plural
 *    slices — but this honestly follows `classifyTask`'s real verdict
 *    rather than fabricating a slice count nothing confirmed).
 * 7. Rungs 1/2 — `classifyTask`'s dispatch verdict. `do-in-steps` and
 *    `do-in-parallel` both resolve rung 2 in this v1: the roadmap's rung
 *    1-vs-2 split is single-slice vs multi-slice, and `classifyTask`
 *    structurally never dispatches on a single slice (its rules require
 *    >=2 slices, an ordered plan, or a declared `parallelizable` value) —
 *    so every `classifyTask` dispatch verdict is inherently multi-slice.
 *    Its `ask` / size-floor `in-session` outcomes get one more check
 *    first: rung 1's single-bounded-slice signal, the one shape
 *    `classifyTask`'s own rules cannot see.
 *
 * ## Recursive-dispatch guard — honest scope (2.3)
 *
 * No verified host discriminator exists for "is this classification running
 * inside a subagent/teammate session". This roadmap's own
 * `point-of-action-carrier` blocker records that the upstream PreToolUse
 * agent-identity request is closed NOT_PLANNED, and nothing in this repo's
 * hook envelope (`event` / `payload` / `platform` / `workspace_root` —
 * `delegation_nudge_hook.ts`'s own `main()`) carries a session-lineage
 * field. `insideSubagentSession` is therefore a CALLER-SUPPLIED fact: the
 * code path that dispatched the subagent/teammate loop is the one place
 * that genuinely knows. This resolver does NOT probe `process.env` for
 * it — inventing an unverified `CLAUDE_AGENT_*`-shaped variable name here
 * would be exactly the hallucinated-field failure `source-discovery-gate`
 * exists to stop. Documented as a gap, not silently assumed away: on a
 * host/caller that never sets this field, the guard is a no-op and rungs
 * 1-4 resolve normally even inside a subagent — the same gap the
 * `point-of-action-carrier` blocker already names as its pre-registered
 * null ("no discriminator" is publishable and does not block this roadmap).
 */
export function classifyLadder(inp: LadderInputs): LadderResult {
    if (inp.interactiveApprovalRequired === true) {
        return {
            rung: null,
            verdict: 'in-session',
            reason: 'interactive-approval-required — caller-stated, needs a human decision before anything may run',
        };
    }

    // Rung 0 — never spawns, so checked before the recursive guard and the
    // activation gate: neither one is a precondition for a script that
    // never dispatches anything.
    const lookup = classifyLookup(inp.taskText);
    if (lookup.route === 'primitive') {
        return { rung: 0, verdict: 'script', reason: `lookup-class ${lookup.lookup_class} — ${lookup.reason}` };
    }
    const mechanical = detectMechanicalTransform(inp.taskText);
    if (mechanical.matched) {
        return { rung: 0, verdict: 'script', reason: mechanical.reason };
    }

    if (inp.insideSubagentSession === true) {
        return {
            rung: null,
            verdict: 'in-session',
            reason:
                'recursive-dispatch guard: this classification runs inside a subagent/teammate session — ' +
                'rungs 1-4 resolve in-session',
        };
    }

    if (inp.activation.halted) {
        return { rung: null, verdict: 'in-session', reason: 'emergency.orchestration_halt is set' };
    }
    if (!inp.activation.subagent_spawn) {
        return { rung: null, verdict: 'in-session', reason: 'host has no subagent_spawn primitive' };
    }

    const contested = detectContestedJudgment(inp.taskText);
    if (contested.matched) {
        return { rung: 4, verdict: 'council', reason: contested.reason };
    }

    const communication = detectCommunicationNeed(inp.taskText);
    if (communication.matched) {
        if (inp.agentTeams) {
            return { rung: 3, verdict: 'team', reason: communication.reason };
        }
        const fallback = classifyTask(inp.signals, inp.activation);
        if (fallback.action === 'dispatch' && fallback.mode !== null) {
            return {
                rung: 2,
                verdict: 'subagent',
                mode: fallback.mode,
                degraded_from: 3,
                reason: `${communication.reason} — no agent_teams host capability, degraded to rung 2 (${fallback.reason})`,
            };
        }
        return {
            rung: null,
            verdict: fallback.action === 'ask' ? 'ask' : 'in-session',
            degraded_from: 3,
            reason: `${communication.reason} — no agent_teams host capability, degraded below rung 2 (${fallback.reason})`,
        };
    }

    const classification = classifyTask(inp.signals, inp.activation);
    if (classification.action === 'dispatch' && classification.mode !== null) {
        return { rung: 2, verdict: 'subagent', mode: classification.mode, reason: classification.reason };
    }

    // A task below the size floor never delegates — not even via rung 1's
    // narrower single-slice regex. `classifyTask` already enforces this
    // floor for rung 2 (its own `inSession('task below size floor …')`
    // verdict); checked directly on `size_estimate` here — rather than by
    // string-matching `classification.reason` — so this guard survives a
    // future reword of that message, and so it fires regardless of WHICH of
    // classifyTask's `in-session` branches produced the non-dispatch verdict.
    // Before this check, a floor-worthy prompt like "review this diff" (no
    // enumerated slices → size_estimate 0) still matched rung 1's read-heavy
    // regex and dispatched a subagent anyway, silently bypassing the floor
    // `classifyTask` had just enforced one line above.
    if (inp.signals.size_estimate <= SIZE_FLOOR) {
        return {
            rung: null,
            verdict: classification.action === 'ask' ? 'ask' : 'in-session',
            reason: classification.reason,
        };
    }

    const single = detectBoundedReadHeavySlice(inp.taskText);
    if (single.matched) {
        return { rung: 1, verdict: 'subagent', mode: null, reason: single.reason };
    }

    return {
        rung: null,
        verdict: classification.action === 'ask' ? 'ask' : 'in-session',
        reason: classification.reason,
    };
}

// ── Explanation trail (additive — Phase 4.1, road-to-feedback-9-29) ──────
//
// `classifyLadder` short-circuits on the first rung that resolves, so its
// minimal `{rung, verdict, reason}` return cannot answer "why NOT team /
// why NOT council / why no spawn". This layer answers exactly that without
// touching the minimal shape current callers depend on: the result is taken
// from `classifyLadder` itself (never re-derived, so the two can never
// disagree on the headline), and the per-rung trail is reconstructed from
// the SAME exported pure detectors and gate fields the resolver reads, in
// the same fixed priority order.

export type RungStatus = 'taken' | 'rejected' | 'not-reached';

export interface RungEvaluation {
    rung: 0 | 1 | 2 | 3 | 4;
    /** The verdict this rung resolves to when taken. */
    resolves_to: 'script' | 'subagent' | 'team' | 'council';
    status: RungStatus;
    reason: string;
}

export interface LadderExplanation {
    /** The authoritative resolution — exactly `classifyLadder(inp)`. */
    result: LadderResult;
    /** Per-rung trail in the resolver's fixed priority order: 0, 4, 3, 2, 1. */
    trail: RungEvaluation[];
    /** Present only when `result.rung` is null (∅) — the why-no-spawn reason. */
    no_spawn_reason?: string;
}

/**
 * Explain one ladder resolution: the rung taken, every rung genuinely
 * evaluated-and-rejected (with the detector's own reason), and rungs the
 * short-circuit never reached (marked `not-reached`, never given a
 * fabricated rejection reason — a lower rung's detector might well have
 * matched had it been consulted).
 */
export function explainLadder(inp: LadderInputs): LadderExplanation {
    const result = classifyLadder(inp);
    const trail: RungEvaluation[] = [];
    const approval = inp.interactiveApprovalRequired === true;

    // Rung 0 — evaluated first, exempt from the guards below.
    if (result.rung === 0) {
        trail.push({ rung: 0, resolves_to: 'script', status: 'taken', reason: result.reason });
    } else if (approval) {
        trail.push({
            rung: 0,
            resolves_to: 'script',
            status: 'not-reached',
            reason: 'interactive-approval-required resolves before every rung',
        });
    } else {
        const lookup = classifyLookup(inp.taskText);
        const mechanical = detectMechanicalTransform(inp.taskText);
        trail.push({ rung: 0, resolves_to: 'script', status: 'rejected', reason: `${lookup.reason}; ${mechanical.reason}` });
    }

    // A gate that resolved ∅ before rung 4 blocks rungs 4-1 wholesale; a
    // resolution at rung 0 means they were never consulted either.
    const gate: string | null = approval
        ? 'interactive-approval-required — caller-stated, resolves ∅'
        : result.rung === 0
          ? 'resolved at rung 0'
          : inp.insideSubagentSession === true
            ? 'recursive-dispatch guard — running inside a subagent/teammate session'
            : inp.activation.halted
              ? 'emergency.orchestration_halt is set'
              : !inp.activation.subagent_spawn
                ? 'host has no subagent_spawn primitive'
                : null;

    const notReached = (why: string): string => `not evaluated — ${why}`;

    // Rung 4 — council.
    if (gate !== null) {
        trail.push({ rung: 4, resolves_to: 'council', status: 'not-reached', reason: notReached(gate) });
    } else if (result.rung === 4) {
        trail.push({ rung: 4, resolves_to: 'council', status: 'taken', reason: result.reason });
    } else {
        trail.push({ rung: 4, resolves_to: 'council', status: 'rejected', reason: detectContestedJudgment(inp.taskText).reason });
    }

    // Rung 3 — team.
    if (gate !== null) {
        trail.push({ rung: 3, resolves_to: 'team', status: 'not-reached', reason: notReached(gate) });
    } else if (result.rung === 4) {
        trail.push({ rung: 3, resolves_to: 'team', status: 'not-reached', reason: notReached('resolved at rung 4') });
    } else if (result.rung === 3) {
        trail.push({ rung: 3, resolves_to: 'team', status: 'taken', reason: result.reason });
    } else {
        const communication = detectCommunicationNeed(inp.taskText);
        const reason =
            communication.matched && result.degraded_from === 3
                ? `${communication.reason} — but host reports agent_teams: false, degraded (see resolved rung)`
                : communication.reason;
        trail.push({ rung: 3, resolves_to: 'team', status: 'rejected', reason });
    }

    // Rungs 2 and 1 — classifyTask's verdict, then the single-slice check.
    const resolvedAbove = result.rung === 4 || result.rung === 3;
    if (gate !== null || resolvedAbove) {
        const why = gate ?? `resolved at rung ${result.rung}`;
        trail.push({ rung: 2, resolves_to: 'subagent', status: 'not-reached', reason: notReached(why) });
        trail.push({ rung: 1, resolves_to: 'subagent', status: 'not-reached', reason: notReached(why) });
    } else {
        const classification = classifyTask(inp.signals, inp.activation);
        if (result.rung === 2) {
            trail.push({ rung: 2, resolves_to: 'subagent', status: 'taken', reason: result.reason });
            trail.push({ rung: 1, resolves_to: 'subagent', status: 'not-reached', reason: notReached('resolved at rung 2') });
        } else {
            trail.push({ rung: 2, resolves_to: 'subagent', status: 'rejected', reason: classification.reason });
            if (result.rung === 1) {
                trail.push({ rung: 1, resolves_to: 'subagent', status: 'taken', reason: result.reason });
            } else if (result.degraded_from === 3) {
                // The communication branch returns from INSIDE rung 3's handling
                // (its `classifyTask` fallback is the rung-2 attempt), so it exits
                // before `detectBoundedReadHeavySlice` is ever called. Reporting
                // rung 1 as `rejected` here quoted that detector's reason — and
                // when the detector MATCHES, that reason describes a match, so
                // the trail read "rejected: one lite-tier subagent instead of
                // session-context burn". A maintainer asking why nothing spawned
                // was told rung 1 declined, hiding the missing agent_teams
                // capability that actually ended the walk.
                trail.push({
                    rung: 1,
                    resolves_to: 'subagent',
                    status: 'not-reached',
                    reason: notReached('the rung-3 communication branch resolved before rung 1 was consulted'),
                });
            } else if (inp.signals.size_estimate <= SIZE_FLOOR) {
                trail.push({
                    rung: 1,
                    resolves_to: 'subagent',
                    status: 'rejected',
                    reason: `task below size floor (${inp.signals.size_estimate} <= ${SIZE_FLOOR}) — rung 1 never bypasses the floor`,
                });
            } else {
                trail.push({ rung: 1, resolves_to: 'subagent', status: 'rejected', reason: detectBoundedReadHeavySlice(inp.taskText).reason });
            }
        }
    }

    return result.rung === null ? { result, trail, no_spawn_reason: result.reason } : { result, trail };
}
