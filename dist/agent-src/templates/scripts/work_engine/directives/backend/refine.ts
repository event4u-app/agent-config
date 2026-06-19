/**
 * `refine` step — deterministic gate in front of the refinement skills.
 *
 * TypeScript twin of `work_engine/directives/backend/refine.py` (ADR-200
 * py2ts Phase 1 — work_engine directive sets). Public API names stay
 * snake_case to mirror the Python module 1:1 (per ADR-200 — Python style is
 * part of the contract).
 *
 * The step never calls an LLM. It inspects `state.ticket` (which carries
 * `input.data` after the CLI projection) and routes on shape:
 *
 * - **Ticket envelope** (`id`, `title`, `acceptance_criteria`) — the
 *   R1 path. Validates the minimum viable shape and either returns
 *   `SUCCESS` or `BLOCKED` with numbered options pointing at
 *   `/refine-ticket`.
 * - **Prompt envelope** (`raw` key present, `reconstructed_ac` /
 *   `assumptions` slots) — the R2 path. On the first pass the gate
 *   delegates to the `refine-prompt` skill via an `@agent-directive:`
 *   halt; on the rebound it scores the reconstructed envelope and routes
 *   the resulting confidence band:
 *
 *   - `high`   → `SUCCESS` (silent proceed, breakdown logged for the report)
 *   - `medium` → `PARTIAL` with an assumptions-report halt
 *   - `low`    → `BLOCKED` with one clarifying question targeted at the
 *     weakest dimension
 *
 * The checks live here (rather than inside the refinement skills) because
 * the dispatcher is synchronous Python: it cannot "delegate" to an agent
 * skill mid-loop. Making the gate deterministic keeps the contract "block
 * on ambiguity, never guess" enforceable from code, and ensures the band
 * the dispatcher routes on is always engine-computed — the skill produces
 * AC + assumptions, the engine decides.
 */

import type { DeliveryState} from '../../delivery_state.js';
import { type Any, Outcome, StepResult, agent_directive } from '../../delivery_state.js';
import type { ConfidenceScore} from '../../scoring/confidence.js';
import { DIMENSION_NAMES, score as _confidence_score } from '../../scoring/confidence.js';

const _MIN_TITLE_LEN = 3;
const _MIN_AC_LEN = 10;

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'missing_id',
        trigger: 'ticket has no `id` field (or only whitespace)',
        resolution: 'run `/refine-ticket` or paste the ticket id in chat',
    },
    {
        code: 'trivial_title',
        trigger: `title missing or shorter than ${_MIN_TITLE_LEN} chars`,
        resolution: 'run `/refine-ticket` to rewrite the title',
    },
    {
        code: 'missing_or_vague_ac',
        trigger: `acceptance_criteria empty, non-list, or any item under ${_MIN_AC_LEN} chars`,
        resolution: 'run `/refine-ticket` to add concrete acceptance criteria',
    },
    {
        code: 'prompt_unrefined',
        trigger:
            'prompt envelope present but `reconstructed_ac` is empty — ' +
            'the deterministic gate has nothing to score yet',
        resolution:
            'agent directive `refine-prompt` → run the skill, ' +
            'write AC + assumptions back into `state.ticket`',
    },
    {
        code: 'prompt_medium_confidence',
        trigger:
            'scored band is `medium` and the user has not confirmed the ' +
            'assumptions report yet',
        resolution:
            'user confirms the reconstructed AC + assumptions, ' +
            'or refines them; agent flips `confidence_confirmed=True` to ' +
            'release the gate',
    },
    {
        code: 'prompt_low_confidence',
        trigger:
            'scored band is `low` — too little signal to plan against, ' +
            'even after reconstruction',
        resolution:
            'user answers one clarifying question; the agent ' +
            're-runs `refine-prompt` against the refreshed prompt',
    },
    {
        code: 'prompt_ui_intent',
        trigger:
            'scorer flagged `ui_intent=True` — the prompt reads as UI ' +
            'work and the backend track cannot ship it cleanly',
        resolution:
            'user re-frames the prompt as backend-only, parks ' +
            'it for Roadmap 3 (`road-to-product-ui-track.md`), or aborts',
    },
];
/** Declared ambiguity surfaces. Every BLOCKED / PARTIAL return maps to one code. */

/** Route on envelope shape: ticket path or prompt path. */
export function run(state: DeliveryState): StepResult {
    const data = state.ticket || {};
    if (_is_prompt_envelope(data)) {
        return _run_prompt(state, data);
    }

    const deficiencies = _diagnose(data);
    if (deficiencies.length === 0) {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    const ticket_id = _pyTruthy(data.id) ? _pyStr(data.id) : '(no id)';
    const questions = _format_questions(ticket_id, deficiencies);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions,
        message: `Ticket ${ticket_id} is not refined enough to plan against: ` + deficiencies.join('; '),
    });
}

/**
 * True when `state.ticket` carries a prompt envelope.
 *
 * The presence of a string-valued `raw` key is unambiguous: ticket
 * payloads never carry `raw`, and prompt envelopes always do (the
 * resolver writes it before any handler sees the state).
 */
function _is_prompt_envelope(data: Record<string, Any>): boolean {
    if (!_isPlainObject(data)) {
        return false;
    }
    const raw = data.raw;
    return typeof raw === 'string' && Boolean(raw.trim());
}

/**
 * Return a human-readable list of what's missing from the ticket.
 *
 * Order matches what a reader needs first (identity → summary →
 * acceptance criteria) so the surfaced questions read naturally.
 */
function _diagnose(ticket: Record<string, Any>): string[] {
    const issues: string[] = [];

    const ticket_id = ticket.id;
    if (typeof ticket_id !== 'string' || !ticket_id.trim()) {
        issues.push('missing ticket id');
    }

    const title = ticket.title;
    if (typeof title !== 'string' || title.trim().length < _MIN_TITLE_LEN) {
        issues.push('missing or trivial title');
    }

    const ac = ticket.acceptance_criteria;
    if (!Array.isArray(ac) || ac.length === 0) {
        issues.push('no acceptance criteria');
    } else {
        const weak_indices: number[] = [];
        ac.forEach((item, idx) => {
            if (!_is_concrete_ac(item)) {
                weak_indices.push(idx + 1);
            }
        });
        if (weak_indices.length > 0) {
            issues.push('vague acceptance criteria at position(s) ' + weak_indices.map((i) => String(i)).join(', '));
        }
    }

    return issues;
}

/**
 * An AC is concrete when it is a non-empty string above the length floor.
 *
 * The floor is deliberately loose: refine is a gate, not a style
 * judge. The heavy lifting (measurability, testability, tone) is
 * owned by the `refine-ticket` skill on the rebound.
 */
function _is_concrete_ac(item: Any): boolean {
    if (typeof item !== 'string') {
        return false;
    }
    return item.trim().length >= _MIN_AC_LEN;
}

/**
 * Render the numbered options shown to the user when BLOCKED.
 *
 * Three options, ordered by likely next action: run the existing
 * refinement skill, paste the missing data in chat, or abandon the
 * ticket entirely. `user-interaction` requires numbered, prose-
 * free options; the deficiency list is rendered as a headnote.
 */
function _format_questions(ticket_id: string, deficiencies: string[]): string[] {
    const headnote = '> Ticket ' + ticket_id + ' is missing: ' + deficiencies.join('; ') + '.';
    return [
        headnote,
        `> 1. Run \`/refine-ticket ${ticket_id}\` and re-invoke \`/implement-ticket\``,
        "> 2. Provide the missing details in chat — I'll merge them into the ticket",
        '> 3. Abandon this ticket — too vague to implement',
    ];
}

/**
 * Score the prompt envelope and route on the resulting band.
 *
 * First pass (no AC reconstructed yet) → delegate to `refine-prompt`.
 * Second pass → score and branch:
 *
 * - `high`   → `SUCCESS`; the breakdown is recorded on
 *   `state.ticket['confidence']` so the report renderer can include
 *   it without re-scoring.
 * - `medium` → `PARTIAL` with an assumptions-report halt unless
 *   the agent has flipped `confidence_confirmed=True` after the
 *   user signed off. `low` band can never be released this way.
 * - `low`    → `BLOCKED` with one clarifying question targeted at
 *   the weakest dimension (lowest score wins; ties prefer the order
 *   declared in `work_engine.scoring.confidence.DIMENSION_NAMES`).
 */
function _run_prompt(state: DeliveryState, data: Record<string, Any>): StepResult {
    const raw = (_pyTruthy(data.raw) ? data.raw : '') as string;
    const ac: Any[] = Array.isArray(data.reconstructed_ac) ? data.reconstructed_ac : [];
    const assumptions: Any[] = Array.isArray(data.assumptions) ? data.assumptions : [];

    if (ac.length === 0) {
        return _delegate_to_refine_prompt(raw);
    }

    const result = _confidence_score({ raw, ac: ac as string[], assumptions: assumptions as string[] });
    data.confidence = {
        band: result.band,
        score: result.score,
        dimensions: { ...result.dimensions },
        reasons: [...result.reasons],
        ui_intent: result.ui_intent,
    };
    // Mirror reconstructed AC into the legacy slot every downstream gate
    // (analyze, plan, implement) reads. Prompt envelopes carry AC under
    // `reconstructed_ac`; without this projection `analyze` blocks with
    // "ticket lost its acceptance criteria" the moment `refine` succeeds.
    data.acceptance_criteria = [...ac];

    if (result.ui_intent) {
        return _halt_ui_intent(raw, result);
    }

    if (result.band === 'high') {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    if (result.band === 'medium') {
        if (data.confidence_confirmed === true) {
            return new StepResult({ outcome: Outcome.SUCCESS });
        }
        return _halt_medium(raw, ac, assumptions, result);
    }

    return _halt_low(raw, result);
}

/** Halt with an agent directive so the orchestrator runs `refine-prompt`. */
function _delegate_to_refine_prompt(raw: string): StepResult {
    const preview = _preview(raw);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('refine-prompt'),
            `> Prompt received: ${preview}`,
            '> No reconstructed acceptance criteria yet — running ' + '`refine-prompt` and resuming.',
            '> 1. Continue — let the skill reconstruct AC + assumptions',
            '> 2. Abort — the prompt is not what I meant',
        ],
        message: 'Prompt envelope present but unrefined; delegating to refine-prompt.',
    });
}

/** PARTIAL halt — assumptions report, one user round-trip. */
function _halt_medium(raw: string, ac: Any[], assumptions: Any[], result: ConfidenceScore): StepResult {
    const preview = _preview(raw);
    const ac_lines = ac.map((item, i) => `>    ${i + 1}. ${_pyStr(item)}`);
    const asm_lines = assumptions.length > 0 ? assumptions.map((item) => `>    - ${_pyStr(item)}`) : ['>    - (none recorded)'];
    const questions = [
        `> Prompt: ${preview}`,
        `> Confidence: **medium** (score ${_pyFormat2f(result.score)}). ` + 'Assumptions worth confirming before I plan.',
        '> Reconstructed AC:',
        ...ac_lines,
        '> Assumptions:',
        ...asm_lines,
        '> 1. Continue as-is — the AC + assumptions are good enough',
        "> 2. Refine — I'll send a corrected prompt and re-run " + '`refine-prompt`',
        '> 3. Abort — pause this `/work` cycle',
    ];
    return new StepResult({
        outcome: Outcome.PARTIAL,
        questions,
        message: `Prompt scored medium (${_pyFormat2f(result.score)}); ` + 'halting for assumptions confirmation.',
    });
}

/** BLOCKED halt — one targeted question on the weakest dimension. */
function _halt_low(raw: string, result: ConfidenceScore): StepResult {
    const preview = _preview(raw);
    const [weakest_idx, weakest_name] = _weakest_dimension(result.dimensions);
    const reason = weakest_idx < result.reasons.length ? result.reasons[weakest_idx] : '';
    const prompts: Record<string, string> = {
        goal_clarity: 'What is the single observable outcome you want?',
        scope_boundary: 'Which file, class, or module should I touch?',
        ac_evidence: 'What concrete behaviour proves it works?',
        stack_data: 'Which table, column, or migration target is involved?',
        reversibility: 'Is this change destructive — should I work behind a flag?',
    };
    const question = weakest_name in prompts ? prompts[weakest_name] : 'Can you tighten the prompt?';
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Prompt: ${preview}`,
            `> Confidence: **low** (score ${_pyFormat2f(result.score)}). ` + `Weakest dimension: \`${weakest_name}\` — ${reason}`,
            `> ${question}`,
            "> 1. I'll answer — paste the answer in chat and re-invoke `/work`",
            '> 2. Abort — drop this prompt',
        ],
        message: `Prompt scored low (${_pyFormat2f(result.score)}); blocking on ` + `\`${weakest_name}\` clarification.`,
    });
}

/**
 * BLOCKED halt — UI-shaped prompts await the R3 dispatch track.
 *
 * The backend `directives/backend/` set has no UI capability; routing a
 * UI prompt through it would either ship a backend stub or guess at a
 * component. Both are worse than a clean refusal with a pointer to the
 * deferred R3 track. The halt is band-independent — even a high-band
 * UI prompt blocks here, because confidence on the *reconstruction* says
 * nothing about whether the *dispatcher* can deliver it.
 */
function _halt_ui_intent(raw: string, result: ConfidenceScore): StepResult {
    const preview = _preview(raw);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Prompt: ${preview}`,
            '> This prompt reads as **UI work** — the backend dispatch ' + "track can't ship it cleanly.",
            '> UI dispatch is deferred to Roadmap 3 ' + '(`road-to-product-ui-track.md`); until it lands, `/work` ' + 'only handles backend-shaped prompts.',
            "> 1. Re-frame as a backend-only prompt — I'll re-score and proceed",
            '> 2. Park this prompt — wait for R3 and re-invoke `/work` then',
            '> 3. Abort — drop this prompt',
        ],
        message: `Prompt flagged as UI-intent (band=${result.band}, ` + `score=${_pyFormat2f(result.score)}); blocked pending R3 UI track.`,
    });
}

/**
 * Return `[index, name]` of the lowest-scoring dimension.
 *
 * Ties are broken by `_confidence.DIMENSION_NAMES` order so the
 * same input always produces the same question (replay determinism).
 */
function _weakest_dimension(dimensions: Record<string, number>): [number, string] {
    const ordered: string[] = [...DIMENSION_NAMES];
    // Python `min(ordered, key=lambda n: (dimensions.get(n, 0), ordered.index(n)))`
    // — lowest score wins; ties broken by declared order (stable, first wins).
    let weakest_name = ordered[0] ?? '';
    let weakest_key: [number, number] = [dimensions[weakest_name] ?? 0, 0];
    for (let i = 1; i < ordered.length; i += 1) {
        const name = ordered[i] ?? '';
        const key: [number, number] = [dimensions[name] ?? 0, i];
        if (key[0] < weakest_key[0] || (key[0] === weakest_key[0] && key[1] < weakest_key[1])) {
            weakest_name = name;
            weakest_key = key;
        }
    }
    return [ordered.indexOf(weakest_name), weakest_name];
}

/** Trim a raw prompt for inline display in halts. */
function _preview(raw: string, max_chars = 80): string {
    // `" ".join((raw or "").split())` — Python `str.split()` splits on
    // whitespace runs and drops empties; join with single spaces.
    const text = (raw || '').split(/\s+/u).filter((t) => t.length > 0).join(' ');
    if (text.length <= max_chars) {
        return text;
    }
    // `text[:max_chars - 1].rstrip() + "…"`
    return text.slice(0, max_chars - 1).replace(/\s+$/u, '') + '…';
}

/**
 * Python `f"{value:.2f}"` — fixed two-decimal formatting with
 * round-half-to-even. `score` values are normalised to 4 decimals by the
 * scorer, so the standard `toFixed(2)` round-half-away-from-zero and Python's
 * banker's rounding agree on every value the scorer can emit; the explicit
 * even-rounding path below keeps parity for any exact-half edge case.
 */
function _pyFormat2f(value: number): string {
    if (!Number.isFinite(value)) {
        // Python renders inf/nan as 'inf'/'nan'; the scorer never emits these.
        return value > 0 ? 'inf' : value < 0 ? '-inf' : 'nan';
    }
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    const scaled = abs * 100;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    let rounded: number;
    const eps = 1e-9;
    if (frac > 0.5 + eps) {
        rounded = floor + 1;
    } else if (frac < 0.5 - eps) {
        rounded = floor;
    } else {
        // exact half → round to even
        rounded = floor % 2 === 0 ? floor : floor + 1;
    }
    const intPart = Math.floor(rounded / 100);
    const fracPart = rounded - intPart * 100;
    return `${sign}${intPart}.${String(fracPart).padStart(2, '0')}`;
}

/** `(value or "")` style truthiness, Python semantics. */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length !== 0;
    }
    if (Array.isArray(value)) {
        return value.length !== 0;
    }
    if (value instanceof Set || value instanceof Map) {
        return value.size !== 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>).length !== 0;
    }
    return true;
}

/** True for a dict-like value (mirrors Python `isinstance(x, dict)`). */
function _isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Set) &&
        !(value instanceof Map)
    );
}

/**
 * Python `str(value)` for the scalar / container kinds the halts render.
 *
 * Strings render as-is; `None`/booleans use Python spelling; numbers as-is;
 * dict / list use Python's `repr`-style bracketing so a `str(item)` fallback
 * (a non-string AC or assumption entry) matches the Python output.
 */
function _pyStr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _pyReprInner(v)).join(', ') + ']';
    }
    if (_isPlainObject(value)) {
        const parts = Object.entries(value as Record<string, unknown>).map(
            ([k, v]) => `${_pyReprInner(k)}: ${_pyReprInner(v)}`,
        );
        return '{' + parts.join(', ') + '}';
    }
    return String(value);
}

/** Python `repr()` for values nested inside a `str(container)` render. */
function _pyReprInner(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    if (typeof value === 'string') {
        return `'${value}'`;
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return '[' + value.map((v) => _pyReprInner(v)).join(', ') + ']';
    }
    if (_isPlainObject(value)) {
        const parts = Object.entries(value as Record<string, unknown>).map(
            ([k, v]) => `${_pyReprInner(k)}: ${_pyReprInner(v)}`,
        );
        return '{' + parts.join(', ') + '}';
    }
    return String(value);
}
