/**
 * `apply` step — stack-dispatched UI implementation.
 *
 * TypeScript twin of `directives/ui/apply.py` (ADR-200 py2ts). Public API
 * names stay snake_case to mirror the Python module 1:1.
 *
 * The apply step turns the locked design brief into actual files. Routes on
 * `state.stack.frontend` to the appropriate implementation skill bundle, and
 * on `state.ticket["ui_apply"]` shape: first-pass delegation, placeholder
 * rejection, or change recording. Apply validates the output against the
 * brief's microcopy lock so a mid-loop hallucination is caught at the boundary.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    type Any,
    type DeliveryState,
    Outcome,
    StepResult,
    agent_directive,
} from '../../delivery_state.js';
import {
    type ComponentRequest,
    conformance_lines,
    plan_component_placement,
} from '../../taxonomy/place.js';
import { has_design_system, placeholder_paths, provided_artifact } from './design.js';
import { _playbook_lines, _scaffold_playbooks } from './scaffold.js';
import {
    is_ambiguous_stack,
    bundle_line,
    scope_lines,
    unsupported_stack_questions,
} from './stack_bundles.js';

/** Map `state.stack.frontend` → agent-directive skill name. */
/**
 * Task words that make a playbook relevant to the `apply` verb.
 *
 * Same shape as `scaffold`'s list and deliberately a SEPARATE constant: `apply` implements
 * into an existing surface, so a repository may reasonably carry a playbook for one verb and
 * not the other. One shared list would silently dispatch a scaffold-only procedure here.
 */
export const APPLY_VERB_TERMS: ReadonlyArray<string> = [
    'component',
    'page',
    'route',
    'screen',
    'view',
];

export const STACK_DIRECTIVES: Record<string, string> = {
    'blade-livewire-flux': 'ui-apply-blade-livewire-flux',
    'blade-livewire': 'ui-apply-blade-livewire',
    filament: 'ui-apply-filament',
    'react-shadcn': 'ui-apply-react-shadcn',
    react: 'ui-apply-react',
    vue: 'ui-apply-vue',
    plain: 'ui-apply-plain',
    // Present so the `keys == KNOWN_STACKS` invariant holds. Never emitted —
    // the step intercepts this lane and refuses instead of dispatching.
    unknown: 'ui-apply-unsupported',
};

/** Fallback directive when `state.stack` is missing or malformed. */
export const DEFAULT_DIRECTIVE = 'ui-apply-plain';

export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'apply_envelope_missing',
        trigger:
            "state.ticket['ui_apply'] unset — first pass, " +
            'stack-specific skill has not run yet',
        resolution:
            'agent directive `ui-apply-<stack>` → skill ' +
            'bundle implements the brief and writes the envelope back',
    },
    {
        code: 'apply_coverage_missing',
        trigger:
            'a provided artifact is in state.ui_design but the ui_apply ' +
            'envelope carries no coverage report, or the report leaves a ' +
            'declared interaction / keyframe / asset unaccounted for',
        resolution:
            'agent writes ui_apply.coverage = {honoured: [], translated: [], ' +
            'flagged: []} naming every declared item exactly once — a dropped ' +
            'handler belongs in `flagged`, never in silence',
    },
    {
        code: 'apply_placeholders_in_output',
        trigger:
            'rendered text in apply envelope contains ' +
            'placeholder patterns (<placeholder>, Lorem, TODO:, TBD, XXX) ' +
            '— design-brief lock failed mid-loop',
        resolution:
            'agent re-renders the components with the locked ' +
            'microcopy verbatim from state.ui_design.microcopy',
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

/** Apply the stack-dispatched implementation gate. */
export function run(state: DeliveryState): StepResult {
    const envelope = _apply_envelope(state);
    if (envelope === null) {
        return _delegate_to_stack_skill(state);
    }

    const violations = _placeholder_violations_in_output(envelope);
    if (violations.length > 0) {
        return _halt_placeholders(state, violations);
    }

    const provided = provided_artifact(state.ui_design as Record<string, Any> | null);
    const notes: string[] = [];
    if (provided !== null) {
        const report = coverage_report(provided, envelope['coverage']);
        if (report.gaps.length > 0) {
            return _halt_coverage(state, provided, report.gaps);
        }
        notes.push(...report.fallbacks);
        // 3.2 — the shadow is now the outcome. 3.1 shipped the line one
        // release ahead (16.2.0 carries it) so a caller branching on
        // `SUCCESS` was found by the words before it is found by the value.
        if (carried_nothing(report)) {
            return _halt_carried_nothing(state, report, notes);
        }
    }

    _record_changes(state, envelope);
    return new StepResult({
        outcome: Outcome.SUCCESS,
        message: notes.join('\n'),
    });
}

/** Buckets the coverage report must sort every declared item into. */
export const COVERAGE_BUCKETS: ReadonlyArray<string> = ['honoured', 'translated', 'flagged'];

/** Declared-item lists a port has to account for, in report order. */
export const COVERED_INVENTORIES: ReadonlyArray<string> = [
    'interactions',
    'keyframes',
    'assets',
];

/** What the coverage report said, split into what halts and what only warns. */
export interface CoverageReport {
    /** Reasons the report fails to account for the artifact. A halt. */
    gaps: string[];
    /** Items carried only by the deprecated containment fallback. A warning. */
    fallbacks: string[];
    /** Every declared item, in report order. */
    declared: string[];
    /** Declared items whose only account is in `flagged` — work handed back. */
    handed_back: string[];
}

/**
 * Did the port hand back everything it was given?
 *
 * True only when there is a declared inventory and **every** item in it is
 * accounted for solely by `flagged`. Deliberately narrow: flagging one dropped
 * handler is the ledger working exactly as designed, and reporting that as a
 * hand-back would make the signal worthless within a week. What this catches
 * is the envelope that accounted for everything and carried none of it — which
 * `coverage_gaps` cannot see, because a complete report and a complete
 * surrender are the same empty gap list.
 */
export function carried_nothing(report: CoverageReport): boolean {
    return report.declared.length > 0 && report.handed_back.length === report.declared.length;
}

/** The line that says a port handed its work back, or `null`. */
function _handed_back_line(report: CoverageReport): string | null {
    if (!carried_nothing(report)) return null;
    return (
        `the port carried nothing over — all ${report.declared.length} declared ` +
        `item(s) are in \`flagged\`: ${report.handed_back.join(', ')}`
    );
}

/** Characters that make a containment hit part of a longer word. */
function _is_word_char(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9');
}

/**
 * Does `entry` mention `needle` as its own token rather than by accident?
 *
 * The deprecated fallback's boundary. Both arguments are already lower-cased.
 * `submit handler — translated` mentions `submit handler`; `table sort order`
 * does not mention `tab`, even though it contains those three letters. The
 * discriminator is whether the hit is delimited on both sides, which is
 * exactly the difference between an entry carrying its own explanation — the
 * one thing containment was documented as buying — and a short name colliding
 * with the inside of a longer word.
 */
function _mentions(entry: string, needle: string): boolean {
    let from = 0;
    for (;;) {
        const at = entry.indexOf(needle, from);
        if (at < 0) return false;
        const before = at === 0 ? '' : (entry[at - 1] as string);
        const after_at = at + needle.length;
        const after = after_at >= entry.length ? '' : (entry[after_at] as string);
        if (!_is_word_char(before) && !_is_word_char(after)) return true;
        from = at + 1;
    }
}

/**
 * Return what the coverage report fails to account for, and what it only warns on.
 *
 * The fidelity ledger the port case never had. `apply` used to validate its
 * output with a single placeholder substring scan and nothing else, so a
 * dropped handler or a lost keyframe left no trace anywhere — the loss was
 * structurally silent, not merely unreported. Requiring each declared item to
 * appear in exactly one bucket turns that silence into a halt: a handler the
 * port could not carry has to be written down in `flagged`.
 *
 * **Matching is equality, not containment.** Containment was chosen so an
 * entry could carry its own explanation ("submit handler — translated to a
 * form action") and still account for `submit handler`. It also accounted for
 * a declared `tab` with an entry about `table sort order`, which is the same
 * rule doing the opposite of its job: the shorter the declared name, the more
 * likely some unrelated entry contains it, so the gate grew weakest exactly
 * where the inventory was tersest.
 *
 * `allow_annotated_fallback` keeps the explanation case working for one
 * release, as a **warning** rather than a silent pass, so an envelope written
 * against the old rule does not halt without notice. It is narrower than the
 * containment it replaces: the mention has to be delimited
 * ({@link _mentions}), which is the property the explanation case always had
 * and the collision case never did.
 */
export function coverage_report(
    provided: Record<string, Any>,
    coverage: Any,
    allow_annotated_fallback = true,
): CoverageReport {
    const gaps: string[] = [];
    const fallbacks: string[] = [];
    const declared_all: string[] = [];
    const handed_back: string[] = [];
    if (!_isDict(coverage)) {
        return {
            gaps: [
                'no `coverage` report in the apply envelope — a provided artifact ' +
                    'requires one',
            ],
            fallbacks,
            declared: declared_all,
            handed_back,
        };
    }
    // Kept per-bucket, not flattened: which bucket accounted for an item is
    // what separates a port that translated its work from one that handed it
    // back, and a flat list of entries cannot answer that.
    const by_bucket = new Map<string, string[]>();
    for (const bucket of COVERAGE_BUCKETS) {
        const value = coverage[bucket];
        if (value === undefined) {
            gaps.push(`\`coverage.${bucket}\` is missing (use an empty list if nothing qualifies)`);
            continue;
        }
        if (!Array.isArray(value)) {
            gaps.push(`\`coverage.${bucket}\` must be a list of strings`);
            continue;
        }
        const kept: string[] = [];
        for (const item of value) {
            if (typeof item === 'string' && item !== '') {
                kept.push(item.toLowerCase());
            }
        }
        by_bucket.set(bucket, kept);
    }
    /** The buckets that account for `needle`, by either rule. */
    function _accounting_buckets(needle: string): string[] {
        const hit: string[] = [];
        for (const [bucket, entries] of by_bucket) {
            if (entries.some((entry) => entry === needle)) {
                hit.push(bucket);
            } else if (
                allow_annotated_fallback &&
                entries.some((entry) => _mentions(entry, needle))
            ) {
                hit.push(bucket);
            }
        }
        return hit;
    }
    for (const inventory of COVERED_INVENTORIES) {
        const declared = provided[inventory];
        if (!Array.isArray(declared)) continue;
        for (const item of declared) {
            if (typeof item !== 'string' || item === '') continue;
            declared_all.push(item);
            const needle = item.toLowerCase();
            const buckets = _accounting_buckets(needle);
            if (buckets.length === 0) {
                gaps.push(
                    `\`${inventory}\`: \`${item}\` appears in no coverage bucket`,
                );
                continue;
            }
            if (buckets.length === 1 && buckets[0] === 'flagged') {
                handed_back.push(item);
            }
            const exact = [...by_bucket.values()].some((entries) =>
                entries.some((entry) => entry === needle),
            );
            if (exact) continue;
            const mention = [...by_bucket.values()]
                .flat()
                .find((entry) => _mentions(entry, needle));
            if (mention !== undefined) {
                fallbacks.push(
                    `\`${inventory}\`: \`${item}\` matched only by containment ` +
                        `against \`${mention}\``,
                );
            }
        }
    }
    return { gaps, fallbacks, declared: declared_all, handed_back };
}

/**
 * Every reason the coverage report fails to account for the artifact.
 *
 * The halting half of {@link coverage_report}, kept as its own name because
 * that is what callers and the port tests already ask for.
 */
export function coverage_gaps(
    provided: Record<string, Any>,
    coverage: Any,
): string[] {
    return coverage_report(provided, coverage).gaps;
}

/** BLOCKED halt — the port did not account for what the artifact declared. */
function _halt_coverage(
    state: DeliveryState,
    provided: Record<string, Any>,
    gaps: string[],
): StepResult {
    const directive = _resolve_directive(state);
    const contract = has_design_system(provided)
        ? 'A `design-system.json` came with this artifact, so its token values ' +
          'are honoured verbatim — say which, and which you had to translate.'
        : 'No `design-system.json` came with this artifact, so every token ' +
          'value you did not read from it belongs in `translated` or `flagged`.';
    const lines: string[] = [
        agent_directive(directive),
        '> Apply rejected: this is a port of a provided artifact, and the ' +
            'coverage report does not account for it.',
        `> ${contract}`,
        '> Unaccounted:',
    ];
    for (const gap of gaps) {
        lines.push(`> - ${gap}`);
    }
    lines.push(
        '> Write `ui_apply.coverage = {honoured: [...], translated: [...], ' +
            'flagged: [...]}` naming every declared interaction, keyframe, and ' +
            'asset exactly once. A handler the port could not carry goes in ' +
            '`flagged` with the reason — never in silence.',
    );
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message:
            `UI apply rejected: ${gaps.length} coverage gap(s) against the provided artifact.`,
    });
}

/**
 * BLOCKED halt — the port accounted for everything and carried none of it.
 *
 * The gap list is empty here by construction: a complete report and a complete
 * surrender look identical to `coverage_gaps`, which is why this is its own
 * halt rather than a gap. `questions` is non-empty because the dispatcher
 * rejects a `BLOCKED` result that surfaces nothing to answer — handing the
 * work back has to come with a way forward, not just a refusal.
 */
function _halt_carried_nothing(
    state: DeliveryState,
    report: CoverageReport,
    fallbacks: ReadonlyArray<string>,
): StepResult {
    const directive = _resolve_directive(state);
    const lines: string[] = [
        agent_directive(directive),
        '> Apply rejected: the coverage report accounts for every declared ' +
            'item and the port carried none of them over.',
        `> All ${report.declared.length} declared item(s) are in \`flagged\`:`,
    ];
    for (const item of report.handed_back) {
        lines.push(`> - \`${item}\``);
    }
    lines.push(
        '> A complete report and a complete hand-back are the same empty gap ' +
            'list, so this is checked separately — flagging one handler the ' +
            'port could not carry is the ledger working; flagging all of them ' +
            'is the port not having run.',
        '> 1. Continue — implement the items above and re-write ' +
            '`ui_apply.coverage` with each one in `honoured` or `translated`, ' +
            'leaving in `flagged` only what genuinely could not be carried',
        '> 2. Flag deliberately — say here which of the items above are out of ' +
            'scope for this port and why, and the operator decides',
        '> 3. Abort — drop this UI request',
    );
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message: [...fallbacks, `UI apply rejected: ${_handed_back_line(report)}`].join('\n'),
    });
}

/** Return the agent-written `ui_apply` envelope, or `null`. */
function _apply_envelope(state: DeliveryState): Record<string, Any> | null {
    const data = _pyTruthy(state.ticket) ? state.ticket : {};
    const envelope = (data as Record<string, Any>)['ui_apply'];
    if (_isDict(envelope) && _pyTruthy(envelope)) {
        return envelope;
    }
    return null;
}

/**
 * Conformance lines for the taxonomy the audit detected, or nothing.
 *
 * Empty whenever `state.ui_audit.component_taxonomy` is absent or names no
 * tiers — which is every project that has not chosen a granularity taxonomy,
 * and is the case whose output must stay exactly as it was. Holding to the
 * project's own structures is the standing rule; this step only ever conforms
 * to a taxonomy the project itself evidences.
 *
 * The `'none'` case is NOT re-checked here. `conformance_lines` owns that
 * invariant and says so in its own contract, and a second copy of the check
 * here would mask a regression in the first: with both present, either one
 * could be deleted and every AC-2 test would still pass. One owner, one test
 * that fails when it breaks.
 */
export function taxonomy_lines(state: DeliveryState): string[] {
    const audit = _isDict(state.ui_audit) ? (state.ui_audit as Record<string, Any>) : {};
    const taxonomy = audit['component_taxonomy'];
    if (typeof taxonomy !== 'string' || taxonomy === '') {
        return [];
    }
    const root = typeof audit['component_root'] === 'string' ? audit['component_root'] : '';
    const design = _isDict(state.ui_design) ? (state.ui_design as Record<string, Any>) : {};
    const raw = design['components'];
    const components: ComponentRequest[] = Array.isArray(raw)
        ? raw.filter((c): c is Record<string, Any> => _isDict(c))
        : [];
    return conformance_lines(
        taxonomy,
        root,
        plan_component_placement(taxonomy, root, components),
    );
}

/** Pick the agent directive for the project's frontend stack. */
function _resolve_directive(state: DeliveryState): string {
    const stack = _pyTruthy(state.stack) ? state.stack : {};
    if (_isDict(stack)) {
        const frontend = stack['frontend'];
        if (typeof frontend === 'string' && frontend in STACK_DIRECTIVES) {
            return STACK_DIRECTIVES[frontend] as string;
        }
    }
    return DEFAULT_DIRECTIVE;
}

/**
 * Return paths into `envelope['rendered']` whose text matches a pattern.
 *
 * Delegates to the walker shared with `design`, so the producer-side and
 * consumer-side gates cannot drift apart. They previously held
 * byte-identical copies of the same array-blind recursion, which meant the
 * contract's "defense-in-depth" framing described two layers that failed on
 * exactly the same inputs.
 */
function _placeholder_violations_in_output(envelope: Record<string, Any>): string[] {
    return [...placeholder_paths(envelope['rendered']), ...written_file_placeholders(envelope)];
}

/**
 * Return the written files whose text carries a placeholder pattern.
 *
 * `rendered` is the porter's own report of what it wrote. The files are what
 * it actually wrote, and nothing made the two agree — a placeholder that never
 * entered the report was invisible to a gate that only read the report. This
 * reads the other side of that pair.
 *
 * **Only `envelope['files']`** — the set the port declares it changed. Never a
 * tree sweep: the directive has no business reading files this run did not
 * touch, and a sweep would grow with the repository rather than with the port.
 *
 * A path that does not resolve to a readable file is **skipped, not reported**.
 * `apply` runs at points where a declared file may not be on disk yet, and
 * halting a correct port because a path failed to resolve would be a worse
 * failure than the one this closes. The cost is real and worth naming: a
 * placeholder inside a file the engine cannot read stays unseen.
 *
 * `root` defaults to the working directory, which is the consumer project root
 * when the engine runs — the same convention as `scaffold`'s token lookup.
 */
export function written_file_placeholders(
    envelope: Record<string, Any>,
    root: string | null = null,
): string[] {
    const files = envelope['files'];
    if (!Array.isArray(files)) return [];
    const base = root !== null ? root : process.cwd();
    const hits: string[] = [];
    for (const rel of files as Any[]) {
        if (typeof rel !== 'string' || rel === '') continue;
        let text: string;
        try {
            const full = path.resolve(base, rel);
            if (!fs.statSync(full).isFile()) continue;
            text = fs.readFileSync(full, 'utf8');
        } catch {
            continue;
        }
        if (placeholder_paths(text, rel).length > 0) {
            hits.push(rel);
        }
    }
    return hits;
}

/** First-pass halt — emit the stack-specific apply directive. */
function _delegate_to_stack_skill(state: DeliveryState): StepResult {
    const directive = _resolve_directive(state);
    const stack_label = _stack_label(state);
    if (is_ambiguous_stack(state.stack)) {
        const conflicts = ((state.stack as Record<string, Any>)['ambiguity'] ??
            []) as ReadonlyArray<string>;
        return new StepResult({
            outcome: Outcome.BLOCKED,
            questions: unsupported_stack_questions('apply', conflicts),
            message:
                `UI apply halted: detection is ambiguous (${conflicts.join('; ')}) — ` +
                'the open question is which project to build for.',
        });
    }
    const provided = provided_artifact(state.ui_design as Record<string, Any> | null);
    // The repository's own procedure goes ahead of the stack skill when it has one. Empty
    // when it does not, which is what keeps a project with no playbook home byte-identical.
    // Imported from `scaffold` rather than duplicated: two copies of a scope-match rule
    // drift, and the drift would be invisible — both lanes would still emit *something*.
    const playbook_lines = _playbook_lines(_scaffold_playbooks(state, APPLY_VERB_TERMS));
    const lines: string[] = [
        agent_directive(directive),
        ...playbook_lines,
        `> Stack: \`${stack_label}\`. Implementing the locked design brief.`,
        bundle_line(state.stack, 'build', stack_label),
        ...scope_lines(state.stack),
        '> Microcopy is locked — every button label, empty-state ' +
            'message, and validation message must come verbatim from ' +
            '`state.ui_design.microcopy`.',
        ...taxonomy_lines(state),
    ];
    if (provided !== null) {
        lines.push(
            '> This is a **port**: `state.ui_design.provided_artifact` is the ' +
                'spec. Build it 1:1' +
                (has_design_system(provided)
                    ? ', and read token values from its `design_system` rather ' +
                      'than re-deriving them.'
                    : '; no `design_system` came with it, so anything you cannot ' +
                      'read from the artifact is a translation you have to name.'),
            '> The envelope must carry `coverage: {honoured, translated, ' +
                'flagged}` accounting for every declared interaction, keyframe, ' +
                'and asset exactly once — apply rejects the envelope otherwise.',
        );
    }
    lines.push(
        '> 1. Continue — implement the brief and write a ' +
            '`ui_apply` envelope back into state.ticket ' +
            '(rendered: {path: text}, files: [...])',
        '> 2. Abort — drop this UI request',
    );
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message: `UI apply pending; delegating to \`${directive}\` for stack \`${stack_label}\`.`,
    });
}

/** BLOCKED halt — rendered output still carries placeholder patterns. */
function _halt_placeholders(state: DeliveryState, violations: string[]): StepResult {
    const directive = _resolve_directive(state);
    const lines: string[] = [
        agent_directive(directive),
        '> Apply rejected: the port output contains placeholder strings. ' +
            'The design-brief microcopy lock failed mid-loop.',
        '> Affected paths, in `ui_apply.rendered` and in the files the ' +
            'envelope declares it wrote:',
    ];
    for (const p of violations) {
        lines.push(`> - \`${p}\``);
    }
    lines.push(
        '> Re-render with the locked microcopy verbatim from ' +
            '`state.ui_design.microcopy`; apply will not write placeholder text.',
    );
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: lines,
        message:
            `UI apply rejected: ${violations.length} placeholder ` +
            'violation(s) in rendered output.',
    });
}

/** Append one `state.changes` entry per file in the apply envelope. */
function _record_changes(state: DeliveryState, envelope: Record<string, Any>): void {
    let files = envelope['files'];
    if (!Array.isArray(files)) {
        files = [];
    }
    const summary = _pyTruthy(envelope['summary']) ? envelope['summary'] : 'ui apply';
    const stack_label = _stack_label(state);
    for (const p of files as Any[]) {
        if (typeof p !== 'string' || p === '') {
            continue;
        }
        state.changes.push({
            kind: 'ui',
            stack: stack_label,
            file: p,
            summary: summary,
        });
    }
}

/** Return the frontend stack label, defaulting to `plain`. */
function _stack_label(state: DeliveryState): string {
    const stack = _pyTruthy(state.stack) ? state.stack : {};
    if (_isDict(stack)) {
        const frontend = stack['frontend'];
        if (typeof frontend === 'string' && frontend !== '') {
            return frontend;
        }
    }
    return 'plain';
}
