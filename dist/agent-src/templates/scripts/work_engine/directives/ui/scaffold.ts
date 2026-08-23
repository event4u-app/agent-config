/**
 * `scaffold` step — greenfield Zero-to-One skeleton gate (the `plan` slot).
 *
 * TypeScript twin of `directives/ui/scaffold.py` (ADR-200 py2ts). Public API
 * names stay snake_case to mirror the Python module 1:1.
 *
 * greenfield-scaffold Phase 3: raise a real multi-page skeleton from a
 * confirmed app-spec, under gates, without the engine ever writing app files.
 * The step occupies the UI set's `plan` slot, which runs **after** `analyze`
 * (design) and before `implement` (apply); it replaces the former no-op
 * pass-through there.
 *
 * Order: audit → app-spec → design → scaffold → apply. `design` fixes the
 * abstract visual language; `scaffold` maps that language onto concrete
 * structure. The recoverable state is "designed but not scaffolded" — the plan
 * is stack-agnostic and the engine writes zero files, so a failed scaffold
 * re-runs from this step alone.
 *
 * The gate is **scoped to the greenfield-scaffold path only** (the same guard
 * as `app_spec`). Every other UI flow sees this slot as a clean `SUCCESS`
 * no-op, so those flows stay byte-identical.
 *
 * Two stages, both honouring the engine-never-renders contract:
 *
 * 1. **Plan** — `state.ui_scaffold` carries no structural plan yet. Emit
 *    `@agent-directive: ui-scaffold-plan`: the agent/skill derives a
 *    stack-agnostic `{pages, routes, layout_strategy, component_manifest,
 *    token_seed}` and writes it into `state.ui_scaffold`.
 * 2. **Build** — the plan exists but `scaffolded` is not `True`. Emit the
 *    stack-specific `@agent-directive: ui-scaffold-<stack>`: the stack skill
 *    consumes the plan, creates the skeleton files, and writes
 *    `state.ui_scaffold.scaffolded = true` + `artifacts`.
 *
 * Idempotent: a fully-scaffolded plan round-trips through `SUCCESS`.
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

/**
 * Conventional locations for a project's DTCG `tokens.json`.
 *
 * When one is present (authored by the `design-tokens` skill, or shipped by
 * `pack-brand`), the scaffold plan's `token_seed` is seeded from it — the
 * anti-generic moat that makes a generated multi-page app coherent rather than
 * default-shadcn. Absent → sane defaults. The dependency is acyclic and
 * degrades gracefully: scaffold never *requires* `pack-brand`.
 */
export const BRAND_TOKEN_PATHS: ReadonlyArray<string> = [
    'tokens.json',
    'assets/tokens.json',
    'resources/tokens.json',
    'agents/settings/brand/tokens.json',
];

/**
 * Conventional location of the project's `Playbook` contexts (ADR-244).
 *
 * A playbook is this repository's OWN procedure for a task, and it outranks a shipped
 * skill: the generic skill answers a generic question, while the playbook carries decisions
 * the repository already made (file layout, barrel exports, naming) that no shipped skill
 * can know. Mirrors {@link BRAND_TOKEN_PATHS} deliberately — same acyclic,
 * degrades-gracefully shape: present → the repository's command is proposed first, absent →
 * nothing is emitted and the lane is byte-identical.
 */
export const PLAYBOOK_HOME = path.join('agents', 'settings', 'contexts');

/** A playbook the lane may act on: `configured` grade, matching scope, non-empty `invokes`. */
export interface ScaffoldPlaybook {
    readonly file: string;
    readonly task: string;
    readonly invokes: readonly string[];
}

/**
 * Read a playbook's head. Only `configured` playbooks with a `scope` that covers
 * `scope_root` are returned — an `observed` playbook is advisory (per the
 * `playbook-precedence` rule) and MUST NOT be dispatched ahead of a shipped skill, because
 * at least one of its ids was never resolved in the tree.
 */
export function _read_playbook(file: string, scope_root: string): ScaffoldPlaybook | null {
    let text = '';
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch {
        return null;
    }
    if (!text.startsWith('---')) return null;
    const end = text.indexOf('\n---', 3);
    if (end < 0) return null;
    const head = text.slice(3, end);

    const grade = /^grade:\s*["']?([A-Za-z]+)["']?\s*$/m.exec(head);
    if (grade === null || grade[1] !== 'configured') return null;

    const scope = /^scope:\s*["']?(.+?)["']?\s*$/m.exec(head);
    const scope_value = scope?.[1] ?? '';
    // `repo` covers everything; otherwise the playbook's scope must be a prefix of the
    // project's scope_root (or equal to it). A partial match is NOT a match — a playbook
    // for `packages/ui` says nothing about `packages/api`.
    const in_scope =
        scope_value === 'repo' ||
        (scope_value !== '' && (scope_root === scope_value || scope_root.startsWith(`${scope_value}/`)));
    if (!in_scope) return null;

    const task = /^task:\s*["']?(.+?)["']?\s*$/m.exec(head);
    const invokes: string[] = [];
    let in_list = false;
    for (const line of head.split('\n')) {
        if (/^invokes:\s*$/.test(line)) {
            in_list = true;
            continue;
        }
        if (in_list) {
            const item = /^\s+-\s*["']?(.+?)["']?\s*$/.exec(line);
            if (item?.[1] !== undefined) {
                invokes.push(item[1]);
                continue;
            }
            in_list = false;
        }
        const inline = /^invokes:\s*\[(.*)\]\s*$/.exec(line);
        if (inline?.[1] !== undefined) {
            for (const part of inline[1].split(',')) {
                const v = part.trim().replace(/^["']|["']$/g, '');
                if (v.length > 0) invokes.push(v);
            }
        }
    }
    // A `configured` playbook with no ids cannot be dispatched: there is nothing to propose,
    // and proposing the empty set as "the repository's procedure" would be worse than silence.
    if (invokes.length === 0) return null;
    return { file, task: task?.[1] ?? '(untitled)', invokes };
}

/**
 * The `configured` playbooks whose scope covers this project, for the given verb.
 *
 * `verb` is matched against the playbook's `task` as a plain lower-cased substring. That is
 * deliberately loose: a playbook titled "Add a new component to this repository" must match
 * the `scaffold` lane's component work, and a stricter match would make the whole mechanism
 * unreachable for the phrasing `playbook-authoring` actually generates.
 */
export function _scaffold_playbooks(
    state: DeliveryState,
    verb_terms: ReadonlyArray<string>,
    root: string | null = null,
): ScaffoldPlaybook[] {
    const base = root !== null ? root : process.cwd();
    const home = path.join(base, PLAYBOOK_HOME);
    let names: string[] = [];
    try {
        names = fs.readdirSync(home).filter((n) => n.endsWith('.md')).sort();
    } catch {
        return [];
    }
    const stack = _pyTruthy(state.stack) ? state.stack : {};
    const scope_root_raw = _isDict(stack) ? stack['scope_root'] : undefined;
    const scope_root = typeof scope_root_raw === 'string' ? scope_root_raw : '';

    const out: ScaffoldPlaybook[] = [];
    for (const name of names) {
        const pb = _read_playbook(path.join(home, name), scope_root);
        if (pb === null) continue;
        const task_lower = pb.task.toLowerCase();
        if (!verb_terms.some((t) => task_lower.includes(t))) continue;
        out.push(pb);
    }
    return out;
}

/**
 * The lines that put the repository's own procedure ahead of the stack skill.
 *
 * Empty array when no playbook matches — that is what keeps a project with no playbook home
 * byte-identical to before this existed. The commands are PROPOSED, never run: the
 * engine-never-writes contract is unchanged, and a playbook is authoritative about *what*,
 * never about who runs it.
 */
export function _playbook_lines(playbooks: ReadonlyArray<ScaffoldPlaybook>): string[] {
    if (playbooks.length === 0) return [];
    const lines: string[] = [
        '> **This repository has its own procedure for this, and it goes FIRST.** A shipped ' +
            'skill is a generic answer; the playbook below carries decisions this repository ' +
            'already made. Use the stack skill only for what the playbook does not cover.',
    ];
    for (const pb of playbooks) {
        lines.push(
            `> \`${pb.file}\` — ${pb.task}: propose \`${pb.invokes.join('`, `')}\` ` +
                'before any stack-skill step. Propose, never run — the human runs it.',
        );
    }
    return lines;
}

/**
 * Stack-agnostic directive that derives the scaffold plan.
 *
 * The plan IS stack-agnostic, so plan derivation is a single directive
 * regardless of frontend; only the build stage dispatches per stack.
 */
export const PLAN_DIRECTIVE = 'ui-scaffold-plan';

/**
 * Task words that make a playbook relevant to the `scaffold` verb.
 *
 * Kept small and concrete rather than clever: these are the nouns
 * `playbook-authoring` derives from a repository's own creation scripts
 * (`new:component`, `new:package`, `generate:page`), so the terms and the generator are
 * two halves of one contract.
 */
export const SCAFFOLD_VERB_TERMS: ReadonlyArray<string> = [
    'component',
    'page',
    'package',
    'workspace',
    'route',
    'screen',
];

/**
 * Map `state.stack.frontend` → build-stage agent-directive skill name.
 *
 * Mirrors `directives/ui/apply.STACK_DIRECTIVES`. An unknown / missing stack
 * falls through to `ui-scaffold-plain` rather than raising — a wrong skill
 * pick is recoverable, a crash is not.
 */
export const STACK_DIRECTIVES: Record<string, string> = {
    'blade-livewire-flux': 'ui-scaffold-blade-livewire-flux',
    'react-shadcn': 'ui-scaffold-react-shadcn',
    vue: 'ui-scaffold-vue',
    plain: 'ui-scaffold-plain',
};

/** Fallback build directive when `state.stack` is missing or malformed. */
export const DEFAULT_DIRECTIVE = 'ui-scaffold-plain';

/** Declared ambiguity surfaces for this step. */
export const AMBIGUITIES: ReadonlyArray<Record<string, string>> = [
    {
        code: 'scaffold_plan_missing',
        trigger:
            'greenfield scaffold path and state.ui_scaffold carries no ' +
            'structural plan (no routes / layout_strategy / component_manifest) — ' +
            'the scaffold plan has not been derived yet',
        resolution:
            'agent directive `ui-scaffold-plan` → derive a ' +
            'stack-agnostic {pages, routes, layout_strategy, component_manifest, ' +
            'token_seed} from the confirmed app_spec + locked design brief into ' +
            'state.ui_scaffold',
    },
    {
        code: 'scaffold_build_pending',
        trigger:
            'greenfield scaffold path and state.ui_scaffold carries a ' +
            'plan but `scaffolded` is not True — the stack skill has not created ' +
            'the skeleton files yet',
        resolution:
            'agent directive `ui-scaffold-<stack>` → stack skill ' +
            'consumes the plan, creates the skeleton, and writes ' +
            'state.ui_scaffold.scaffolded = true + artifacts',
    },
];

function _isDict(value: Any): value is Record<string, Any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Apply the greenfield scaffold gate.
 *
 * No-op `SUCCESS` for every non-greenfield-scaffold flow; the plan → build loop
 * only engages when the audit recorded a `scaffold` greenfield decision.
 */
export function run(state: DeliveryState): StepResult {
    if (!_is_greenfield_scaffold(state)) {
        return new StepResult({ outcome: Outcome.SUCCESS });
    }

    const scaffold = state.ui_scaffold;

    if (!_is_planned(scaffold)) {
        return _delegate_plan(state);
    }

    const scaffoldDict = scaffold as Record<string, Any>;
    if (scaffoldDict['scaffolded'] !== true) {
        return _delegate_build(state, scaffoldDict);
    }

    return new StepResult({ outcome: Outcome.SUCCESS });
}

/**
 * True when the audit recorded a `scaffold` greenfield decision.
 *
 * Identical guard to `app_spec._is_greenfield_scaffold`: the gate is inert for
 * improve-existing, the `bare` / `external_reference` greenfield picks, and the
 * `diff` / `file` envelopes.
 */
function _is_greenfield_scaffold(state: DeliveryState): boolean {
    const audit = state.ui_audit;
    if (!_isDict(audit)) return false;
    return (
        audit['greenfield'] === true &&
        audit['greenfield_decision'] === 'scaffold'
    );
}

/**
 * True when `scaffold` carries a structural plan.
 *
 * The defining content of the scaffold plan is the structure the app-spec did
 * not produce — routes, a layout strategy, or a component manifest. Their
 * presence (any one) is the "plan derived" signal; an empty dict or a bare
 * `None` is treated as "skill has not run". `pages` alone is *not* sufficient,
 * since the app-spec slice also carries a page-set.
 */
function _is_planned(scaffold: Any): boolean {
    if (!_isDict(scaffold)) {
        return false;
    }
    return ['routes', 'layout_strategy', 'component_manifest'].some(
        (key) => key in scaffold,
    );
}

/** Render a one-line preview of the input being scaffolded. */
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

/** Pick the build-stage directive for the project's frontend stack. */
function _resolve_build_directive(state: DeliveryState): string {
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
 * Return the relative path to a present `tokens.json`, or `null`.
 *
 * Checks {@link BRAND_TOKEN_PATHS} under `root` (default: the current working
 * directory, which is the consumer project root when the engine runs). The
 * first existing file wins. Absent → `null` so the caller degrades to default
 * tokens — the acyclic, graceful-degradation contract.
 */
function _brand_token_source(root: string | null = null): string | null {
    const base = root !== null ? root : process.cwd();
    for (const rel of BRAND_TOKEN_PATHS) {
        try {
            if (fs.statSync(path.join(base, rel)).isFile()) {
                return rel;
            }
        } catch {
            continue;
        }
    }
    return null;
}

/**
 * Describe the token-seed source for the plan directive.
 *
 * Brand-seeds from a present DTCG `tokens.json` when one exists; otherwise
 * instructs the skill to derive from the locked design brief + sane defaults.
 * Graceful degradation: no token source → defaults, never a hard failure.
 */
function _token_seed_line(_state: DeliveryState): string {
    const source = _brand_token_source();
    if (source !== null) {
        return (
            `> \`token_seed\`: seed from the project's brand/design tokens ` +
            `at \`${source}\` (DTCG \`tokens.json\`) — the anti-generic moat. ` +
            `Do NOT fall back to default shadcn tokens when this source is ` +
            `present; carry its primitives + semantic layers into the plan.`
        );
    }
    return (
        '> `token_seed`: derive from the locked design brief\'s tokens; ' +
        'fall back to sane defaults (neutral scale, system font) when the ' +
        'brief leaves a slot open (no `tokens.json` brand source detected).'
    );
}

/** Stage 1 — emit the stack-agnostic plan-derivation directive. */
function _delegate_plan(state: DeliveryState): StepResult {
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive(PLAN_DIRECTIVE),
            `> Input: ${_preview_input(state)}`,
            '> Greenfield scaffold — derive a stack-agnostic skeleton plan ' +
                'from the confirmed `state.app_spec` (page-set + entity model) ' +
                'and the locked `state.ui_design` brief. The engine writes no ' +
                'files; this stage only produces the plan.',
            '> Write `state.ui_scaffold` = ' +
                '{pages, routes, layout_strategy, component_manifest, token_seed}.',
            _token_seed_line(state),
            '> 1. Continue — derive the scaffold plan into ' +
                '`state.ui_scaffold`',
            '> 2. Abort — drop this UI request',
            '',
            '**Recommendation: 1 — derive the plan** — the ' +
                'stack-agnostic plan is the recoverable checkpoint: if the build ' +
                'stage fails, scaffold re-runs from here without touching design ' +
                'or apply.',
        ],
        message:
            'Greenfield scaffold plan missing; delegating to ' +
            '`ui-scaffold-plan` to derive the stack-agnostic skeleton plan.',
    });
}

/** Stage 2 — emit the stack-specific skeleton-build directive. */
function _delegate_build(state: DeliveryState, scaffold: Record<string, Any>): StepResult {
    const directive = _resolve_build_directive(state);
    const stack_label = _stack_label(state);
    const pages = scaffold['pages'];
    const page_count = Array.isArray(pages) ? pages.length : 0;
    const routes = scaffold['routes'];
    const route_count = Array.isArray(routes) ? routes.length : 0;
    const playbook_lines = _playbook_lines(_scaffold_playbooks(state, SCAFFOLD_VERB_TERMS));
    return new StepResult({
        outcome: Outcome.BLOCKED,
        questions: [
            agent_directive(directive),
            ...playbook_lines,
            `> Stack: \`${stack_label}\`. Scaffold plan is ready ` +
                `(${page_count} page(s), ${route_count} route(s)). Create the ` +
                'skeleton from `state.ui_scaffold` — routes, layout shell, and ' +
                'the component-manifest stubs.',
            '> The engine writes no files: the stack skill creates the ' +
                'skeleton and writes `state.ui_scaffold.scaffolded = true` plus ' +
                '`state.ui_scaffold.artifacts` (the created paths).',
            '> Recoverable: a failed build re-runs from this scaffold step ' +
                'alone — design and app-spec stay locked.',
            '> 1. Continue — create the skeleton and mark ' +
                '`scaffolded = true`',
            '> 2. Abort — drop this UI request',
            '',
            `**Recommendation: 1 — build the skeleton** — the ` +
                `\`${stack_label}\` scaffold skill materialises the confirmed plan; ` +
                `the rendered output is verified downstream by the review gate.`,
        ],
        message:
            `Greenfield scaffold plan ready; delegating to \`${directive}\` to ` +
            `create the skeleton for stack \`${stack_label}\`.`,
    });
}
