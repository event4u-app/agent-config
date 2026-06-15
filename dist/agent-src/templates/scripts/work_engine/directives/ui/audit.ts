/**
 * `audit` step — mandatory pre-step for the UI directive set.
 *
 * TypeScript twin of `directives/ui/audit.py` (ADR-200 py2ts). Public API
 * names stay snake_case to mirror the Python module 1:1.
 *
 * Routes on `state.ui_audit` shape: first-pass delegation, greenfield decision,
 * shadcn version mismatch, ambiguous candidate pick, or high-confidence pass.
 * The deterministic checks live here so "no design without audit findings" is
 * enforceable from code, not norms. Mirrors the `state.ui_audit` gate the
 * `ui-audit-gate` rule defends.
 */
import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
} from '../../delivery_state.js';

/** Similarity threshold for a "strong reusable match". */
export const STRONG_SIMILARITY = 0.7;

/** Top-2 within this gap counts as ambiguous regardless of confidence. */
export const TIE_GAP = 0.05;

/** Major version the `react-shadcn-ui` skill body declares as tested against. */
export const TESTED_AGAINST_SHADCN_MAJOR = 2;

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'audit_missing',
        trigger: 'state.ui_audit is None or empty — skill has not run yet',
        resolution:
            'agent directive `existing-ui-audit` → skill writes ' +
            'findings into state.ui_audit',
    },
    {
        code: 'greenfield_undecided',
        trigger:
            'state.ui_audit.greenfield is True but greenfield_decision ' +
            'is unset — user has not picked a scaffolding direction',
        resolution:
            'user picks scaffold / bare / external_reference; ' +
            'agent records the choice in state.ui_audit.greenfield_decision',
    },
    {
        code: 'shadcn_version_mismatch',
        trigger:
            'state.ui_audit.shadcn_inventory.version major differs from ' +
            'TESTED_AGAINST_SHADCN_MAJOR — react-shadcn-ui skill was ' +
            'tested against a different major',
        resolution:
            'user accepts cautious composition or aborts; ' +
            'agent records the choice in ' +
            'state.ui_audit.version_mismatch_decision',
    },
    {
        code: 'audit_ambiguous',
        trigger:
            'confidence band is medium, OR inventory has multiple matches ' +
            'with similar similarity scores, OR no match clears ' +
            'STRONG_SIMILARITY',
        resolution:
            "user picks a candidate to extend (or 'build new'); " +
            'agent records the choice in state.ui_audit.audit_path ' +
            'and state.ui_audit.candidate_pick',
    },
];

function _isDict(value: Any): value is Record<string, Any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function _pyTruthy(value: Any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.length > 0;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

function pyStr(value: Any): string {
    if (value === null || value === undefined) return 'None';
    if (value === true) return 'True';
    if (value === false) return 'False';
    return String(value);
}

function _pyRStrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/** Apply the audit gate to `state.ui_audit`. */
export function run(state: DeliveryState): StepResult {
    const audit = state.ui_audit;
    if (!_is_populated(audit)) {
        return _delegate_to_audit_skill(state);
    }

    const a = audit as Record<string, Any>;
    if (a['greenfield'] === true && !_pyTruthy(a['greenfield_decision'])) {
        return _halt_greenfield(state, a);
    }

    // Greenfield with a recorded decision skips the candidate-pick halt and
    // lands on SUCCESS.
    if (a['greenfield'] === true) {
        if (!_pyTruthy(a['audit_path'])) {
            a['audit_path'] = 'greenfield';
        }
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    const mismatch = _detect_shadcn_version_mismatch(a);
    if (mismatch !== null && !_pyTruthy(a['version_mismatch_decision'])) {
        return _halt_shadcn_version_mismatch(state, mismatch);
    }

    // Idempotent re-entry: an already-decided path round-trips through SUCCESS.
    if (a['audit_path'] === 'high_confidence' || a['audit_path'] === 'ambiguous') {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    const decision = _decide_path(state, a);
    if (decision === 'high_confidence') {
        a['audit_path'] = 'high_confidence';
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    return _halt_ambiguous(state, a);
}

/** True when `audit` carries actionable findings. */
function _is_populated(audit: Any): boolean {
    if (!_isDict(audit)) return false;
    if (Object.keys(audit).length === 0) return false;
    return ['components_found', 'components', 'greenfield'].some((key) => key in audit);
}

/** Render a one-line preview of the input being audited. */
function _preview_input(state: DeliveryState): string {
    const data = (_isDict(state.ticket) ? state.ticket : {}) as Record<string, Any>;
    const raw = data['raw'];
    let text: string;
    if (typeof raw === 'string' && raw.trim() !== '') {
        text = raw.split(/\s+/u).filter((x) => x.length > 0).join(' ');
    } else {
        const title = data['title'];
        if (typeof title === 'string') {
            text = title;
        } else {
            const id = data['id'];
            text = _pyTruthy(id) ? pyStr(id) : '(no title)';
        }
    }
    if ([...text].length <= 80) {
        return text;
    }
    return _pyRStrip([...text].slice(0, 79).join('')) + '…';
}

/** Halt with an agent directive so the orchestrator runs `existing-ui-audit`. */
function _delegate_to_audit_skill(state: DeliveryState): StepResult {
    const preview = _preview_input(state);
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive('existing-ui-audit'),
            `> Input: ${preview}`,
            '> No UI audit findings yet — running `existing-ui-audit` ' +
                'to inventory components, design system, tokens, and ' +
                'candidate matches before design.',
            '> 1. Continue — let the skill produce the audit',
            '> 2. Abort — drop this UI request',
        ],
        message: 'UI audit findings missing; delegating to existing-ui-audit skill.',
    });
}

/** BLOCKED halt — greenfield project needs an explicit scaffolding pick. */
function _halt_greenfield(state: DeliveryState, audit: Record<string, Any>): StepResult {
    void audit;
    const preview = _preview_input(state);
    const questions: string[] = [
        `> Input: ${preview}`,
        '> No existing UI surface detected — this looks like greenfield.',
        '> 1. Scaffold — minimal token set + base component primitive folder',
        '> 2. Bare — proceed with Tailwind defaults, no scaffolding',
        '> 3. External reference — point me at a design-system URL or file',
        '',
        '**Recommendation: 1 — Scaffold tokens + primitives** ' +
            '— even one extra screen benefits from a shared base; the ' +
            'scaffold cost is ~10 min and saves re-doing every primitive ' +
            'on screen 2. Caveat: flip to 2 if this is a demo or ' +
            'single-page prototype that will not grow.',
    ];
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions,
        message:
            'UI audit detected greenfield; halting for scaffolding ' +
            'direction (scaffold / bare / external_reference).',
    });
}

/** Return `"high_confidence"` or `"ambiguous"` for a populated audit. */
function _decide_path(state: DeliveryState, audit: Record<string, Any>): string {
    const band = _confidence_band(state);
    if (band !== 'high') {
        return 'ambiguous';
    }

    const matches = _matches(audit);
    if (matches.length === 0) {
        return 'ambiguous';
    }

    const scored = matches.map((m) => _similarity_of(m)).sort((x, y) => y - x);
    const top = scored[0] as number;
    if (top < STRONG_SIMILARITY) {
        return 'ambiguous';
    }
    if (scored.length >= 2 && top - (scored[1] as number) < TIE_GAP) {
        return 'ambiguous';
    }
    return 'high_confidence';
}

/** Return the scored confidence band, or `"high"` when not applicable. */
function _confidence_band(state: DeliveryState): string {
    const data = (_isDict(state.ticket) ? state.ticket : {}) as Record<string, Any>;
    const confidence = data['confidence'];
    if (_isDict(confidence)) {
        const band = confidence['band'];
        if (typeof band === 'string' && band !== '') {
            return band;
        }
    }
    const input_kind = data['input_kind'];
    if (input_kind === 'diff' || input_kind === 'file') {
        return 'high';
    }
    return 'medium';
}

/** Return the inventory list, preferring `components_found`. */
function _matches(audit: Record<string, Any>): Record<string, Any>[] {
    for (const key of ['components_found', 'components']) {
        const value = audit[key];
        if (Array.isArray(value) && value.length > 0) {
            return value.filter((m): m is Record<string, Any> => _isDict(m));
        }
    }
    return [];
}

/** Read a similarity score from a match entry; default to 0.0. */
function _similarity_of(match: Record<string, Any>): number {
    const raw = match['similarity'];
    const f = _pyFloat(raw);
    return f === null ? 0.0 : f;
}

/**
 * Python `float(x)` for the JSON shapes that reach a similarity value.
 * Returns the float, or `null` to mirror `except (TypeError, ValueError)`.
 */
function _pyFloat(value: Any): number | null {
    if (typeof value === 'boolean') {
        return value ? 1.0 : 0.0;
    }
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'string') {
        const t = value.trim();
        if (t === '') return null;
        // Python float() accepts decimals, exponents, inf, nan; the inputs here
        // are plain decimals — match the common numeric form.
        if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
            return Number(t);
        }
        const lower = t.toLowerCase().replace(/^[+-]/, '');
        if (lower === 'inf' || lower === 'infinity') {
            return t.startsWith('-') ? -Infinity : Infinity;
        }
        if (lower === 'nan') {
            return NaN;
        }
        return null;
    }
    return null;
}

/** Return mismatch info when the inventory diverges by a major. */
function _detect_shadcn_version_mismatch(audit: Record<string, Any>): Record<string, Any> | null {
    const inventory = audit['shadcn_inventory'];
    if (!_isDict(inventory)) {
        return null;
    }
    const raw_version = inventory['version'];
    if (typeof raw_version !== 'string' || raw_version.trim() === '') {
        return null;
    }
    const head = _pyRStripWs(_pyLStripChar(raw_version, 'v').split('.', 1)[0] as string);
    const installed_major = _pyIntStrict(head);
    if (installed_major === null) {
        return null;
    }
    if (installed_major === TESTED_AGAINST_SHADCN_MAJOR) {
        return null;
    }
    return {
        installed_version: raw_version,
        installed_major,
        tested_major: TESTED_AGAINST_SHADCN_MAJOR,
    };
}

/** Python `str.lstrip(ch)`. */
function _pyLStripChar(s: string, ch: string): string {
    let start = 0;
    while (start < s.length && s[start] === ch) start += 1;
    return s.slice(start);
}

/** Python `str.strip()` (no-arg) applied to the parsed head. */
function _pyRStripWs(s: string): string {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/**
 * Python `str.split(sep, 1)` for a single-character separator: at most one
 * split, returning the first segment via `[0]`.
 */
// (inlined via String.prototype.split(sep, limit) won't replicate Python's
// maxsplit semantics for `[0]`; but `[0]` only needs the prefix before the
// first separator, which `split` then index 0 yields identically.)

/**
 * Python `int(s)` on an already-trimmed integer string. Returns the int, or
 * `null` to mirror `except ValueError`.
 */
function _pyIntStrict(s: string): number | null {
    if (/^[+-]?[0-9]+$/.test(s)) {
        return Number(s);
    }
    return null;
}

/** BLOCKED soft-halt — user accepts cautious composition or aborts. */
function _halt_shadcn_version_mismatch(
    state: DeliveryState,
    mismatch: Record<string, Any>,
): StepResult {
    const preview = _preview_input(state);
    const installed = mismatch['installed_version'];
    const tested = mismatch['tested_major'];
    const installed_major = mismatch['installed_major'];
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            `> Input: ${preview}`,
            `> shadcn skill tested against v${pyStr(tested)}.x; project uses ` +
                `\`${pyStr(installed)}\` (major v${pyStr(installed_major)}).`,
            '> 1. Proceed with cautious composition — skill applies ' +
                'general patterns, agent verifies primitive APIs against ' +
                'the installed version',
            '> 2. Abort — update the `react-shadcn-ui` skill to the ' +
                'installed major before continuing',
            '',
            '**Recommendation: 1 — Proceed with caution** ' +
                '— most shadcn primitive APIs are stable across ' +
                "majors; the skill's structural guidance still applies. " +
                'Caveat: flip to 2 if the design brief leans on a ' +
                'primitive whose API changed (Form, Sheet, Dialog have ' +
                'had breaking renames in past majors).',
        ],
        message:
            `shadcn version mismatch (skill v${pyStr(tested)}.x vs project ` +
            `${pyStr(installed)}); halting for cautious-composition decision.`,
    });
}

/** BLOCKED halt — user picks an existing candidate or 'build new'. */
function _halt_ambiguous(state: DeliveryState, audit: Record<string, Any>): StepResult {
    const preview = _preview_input(state);
    const matches = _matches(audit);
    const scored = _stableSortByKeyDesc(matches, _similarity_of).slice(0, 3);

    const lines: string[] = [
        `> Input: ${preview}`,
        '> Audit findings are ambiguous — pick the candidate to ' +
            'extend, or build new:',
    ];
    let idx = 1;
    for (const match of scored) {
        const name = _pyTruthy(match['name'])
            ? match['name']
            : _pyTruthy(match['path'])
              ? match['path']
              : '(unnamed)';
        const sim = _similarity_of(match);
        const path = _pyTruthy(match['path']) ? match['path'] : '';
        const suffix = path ? ` — \`${pyStr(path)}\`` : '';
        lines.push(`> ${idx}. Extend \`${pyStr(name)}\` (similarity ${_pyFixed(sim, 2)})${suffix}`);
        idx += 1;
    }
    const next_idx = scored.length + 1;
    lines.push(`> ${next_idx}. Build new — none of the above is close enough`);

    let rec: string;
    if (scored.length > 0) {
        const top = scored[0] as Record<string, Any>;
        const top_name = _pyTruthy(top['name'])
            ? top['name']
            : _pyTruthy(top['path'])
              ? top['path']
              : 'candidate 1';
        const top_sim = _similarity_of(top);
        rec =
            `**Recommendation: 1 — Extend \`${pyStr(top_name)}\`** — ` +
            `similarity ${_pyFixed(top_sim, 2)} is the strongest match in the ` +
            'inventory; reuse beats new code unless the contract ' +
            `diverges. Caveat: flip to ${next_idx} if the existing ` +
            'component cannot host the new behavior cleanly.';
    } else {
        rec =
            `**Recommendation: ${next_idx} — Build new** — ` +
            'no inventory match cleared the strong-similarity bar. ' +
            'Caveat: flip to an extend option only if a near-miss ' +
            'is a better fit than starting from scratch.';
    }
    lines.push('', rec);

    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message:
            'UI audit findings ambiguous; halting for candidate pick ' +
            '(extend existing / build new).',
    });
}

/**
 * Python `sorted(matches, key=_similarity_of, reverse=True)` — stable sort,
 * descending by key, ties keep original order. JS `Array.prototype.sort` is
 * stable; for `reverse=True` Python keeps equal-key elements in original
 * order, so a stable comparator that only compares keys (never swaps ties)
 * reproduces it exactly.
 */
function _stableSortByKeyDesc(
    items: Record<string, Any>[],
    key: (m: Record<string, Any>) => number,
): Record<string, Any>[] {
    const keyed = items.map((m) => ({ m, k: key(m) }));
    keyed.sort((a, b) => (a.k < b.k ? 1 : a.k > b.k ? -1 : 0));
    return keyed.map((e) => e.m);
}

/**
 * Python `format(x, '.2f')` — fixed-point, 2 decimals, round-half-to-even on
 * the exact IEEE value. Mirrors `telemetry/report_renderer._pyFixed`.
 */
function _pyFixed(value: number, ndigits: number): string {
    if (!Number.isFinite(value)) {
        return String(value);
    }
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    const str = abs.toPrecision(17);
    if (str.includes('e') || str.includes('E')) {
        return sign + abs.toFixed(ndigits);
    }
    const dot = str.indexOf('.');
    const intPart = dot === -1 ? str : str.slice(0, dot);
    let fracPart = dot === -1 ? '' : str.slice(dot + 1);
    while (fracPart.length <= ndigits) {
        fracPart += '0';
    }
    const keepFrac = fracPart.slice(0, ndigits);
    const deciderStr = fracPart.slice(ndigits);
    let scaledInt = BigInt(intPart + keepFrac || '0');
    const firstDecider = deciderStr.charAt(0);
    const restNonZero = /[1-9]/u.test(deciderStr.slice(1));
    let roundUp = false;
    if (firstDecider > '5' || (firstDecider === '5' && restNonZero)) {
        roundUp = true;
    } else if (firstDecider === '5' && !restNonZero) {
        roundUp = scaledInt % 2n === 1n;
    }
    if (roundUp) {
        scaledInt += 1n;
    }
    let digits = scaledInt.toString();
    while (digits.length <= ndigits) {
        digits = `0${digits}`;
    }
    const outInt = ndigits === 0 ? digits : digits.slice(0, digits.length - ndigits);
    const outFrac = ndigits === 0 ? '' : digits.slice(digits.length - ndigits);
    const zeroValue = /^0*$/u.test(digits);
    return `${zeroValue ? '' : sign}${outInt}${ndigits > 0 ? `.${outFrac}` : ''}`;
}
