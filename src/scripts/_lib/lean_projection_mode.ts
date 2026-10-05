/**
 * `lean_projection.mode` — ONE definition of what the three modes mean, and
 * since step 1.2 of `road-to-a-rule-carrier-that-works-outside-the-repo`, ONE
 * reader that produces it.
 *
 * ── What this module used to be, and why that was not enough ──
 *
 * It owned the NORMALISATION and left each caller its own READER: the projector
 * (`condense.ts`) resolved the value with a real YAML parse over the full
 * settings cascade; the delivery concern (`hooks/rule_inject_hook.ts`) resolved
 * it with an indentation-shaped read of `<cwd>/.agent-settings.yml` alone. The
 * header argued that two readers were unavoidable and that two *normalisations*
 * were the only thing worth preventing.
 *
 * Measured on 2026-10-02, that split was not a stylistic difference — it was a
 * disagreement about WHICH FILE. The installer writes settings to
 * `<root>/agents/settings/.agent-settings.yml` (`agent_settings.ts`'s canonical
 * write target; `install.ts:4108`). The concern read `<root>/.agent-settings.yml`,
 * the LEGACY location, and nothing else. On a normal install the concern
 * therefore read a file that does not exist, got `''`, normalised it to
 * `eager-all`, and closed its own gate — while the projector, reading the
 * canonical file, had written thin stubs. That is the pointer arm the delivery
 * mode exists to replace, reached by configuration rather than by choice, and
 * it is a SECOND independent cause of the silence step 1.1 repaired: a consumer
 * that fixed the package root alone would still have received nothing.
 *
 * The user-global layer was invisible to the concern for the same reason, which
 * matters more than it sounds: ADR-020 installs are global-only, so for those
 * consumers the ONLY layer carrying a mode is one the concern never opened.
 *
 * ── D3: one resolver, not a parity test between three ──
 *
 * The roadmap's D3 records the choice and the reason — a parity test keeps
 * three readers that can drift again, and this module already existed to be the
 * one. `resolveLeanProjection` below is that resolver. It reads the layers in
 * the order `load_agent_settings` defines (template base, user-global,
 * project), through `project_settings_path`, which prefers the canonical file
 * and falls back to the legacy one, so a hand-edited root file still works.
 *
 * ── Why the template path is passed in rather than resolved ──
 *
 * `agent_settings.default_template_path()` derives the package root from
 * `import.meta.url` three directories up. That is correct for a module at
 * `<pkg>/src/scripts/_lib/`; inside the composed hook bundle `import.meta.url`
 * is `<pkg>/dist/hooks/dispatch.js`, so the same arithmetic yields the PARENT
 * of the package and the template read misses. Verified in the built bundle,
 * not inferred. With no template the base layer is `{}` and an unconfigured
 * consumer resolves to `eager-all` — the silence again, one layer lower. So a
 * caller that knows the real package root (the carrier does: the dispatcher
 * passes it) hands it over, and the resolver reads the template from there.
 *
 * ── What has NOT changed ──
 *
 * Anything unrecognised — absent key, typo, `null`, a non-string — is still
 * `eager-all`: the parser fallback, which is NOT the value the template ships
 * (see the type below), because a mode nobody can spell must never silently
 * thin the standing corpus. That fallback now fires only when no layer carried
 * a value at all, rather than whenever the concern looked in the wrong place.
 */
import * as path from 'node:path';

import { load_agent_settings } from './agent_settings.js';

/**
 * The three projection shapes, and the two different defaults they answer to.
 *
 * The TEMPLATE default — what a consumer is given — is `delivery` with
 * `hosts: [claude-code]`, shipped in `src/config/agent-settings.template.yml`
 * since ADR-267, so on that one host a normal read resolves to `delivery`.
 * The PARSER FALLBACK — what applies when no value resolves from any layer —
 * is `eager-all` (`DEFAULT_LEAN_PROJECTION_MODE` below), deliberately not
 * flipped with the template per ADR-267 decision 4: the template says what was
 * chosen, the constant says what happens when nothing could be read.
 */
export type LeanProjectionMode = 'eager-all' | 'thin' | 'delivery';

export const DEFAULT_LEAN_PROJECTION_MODE: LeanProjectionMode = 'eager-all';

/** Map a raw settings value onto a mode. Unrecognised → `eager-all`. */
export function normalizeLeanProjectionMode(raw: unknown): LeanProjectionMode {
    const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (v === 'thin') return 'thin';
    if (v === 'delivery') return 'delivery';
    return DEFAULT_LEAN_PROJECTION_MODE;
}

/**
 * True when the projector writes pointer stubs instead of bodies.
 *
 * `delivery` is a superset of `thin`: it writes the same thin files AND binds
 * the concern that delivers the bodies back on a trigger.
 */
export function writesThinFiles(mode: LeanProjectionMode): boolean {
    return mode === 'thin' || mode === 'delivery';
}

/** True only in the mode where a hook delivers rule bodies at runtime. */
export function deliversBodies(mode: LeanProjectionMode): boolean {
    return mode === 'delivery';
}

/**
 * The hosts a thinning mode may actually thin.
 *
 * Deliberately NOT "every host id the package knows". `condense`'s `TOOL_DIRS`
 * writes a per-rule tree for exactly three hosts, so those are the only ids for
 * which `lean_projection.hosts` can mean anything: naming `windsurf` there would
 * be a request to thin a single concatenated file that has no per-rule stub
 * shape, and naming `codex` a request to thin a tree the installer writes and
 * `condense` never touches. Accepting such an id silently would leave the
 * operator believing a host was scoped when nothing reads the entry.
 */
export const THINNABLE_HOSTS: readonly string[] = ['claude-code', 'cursor', 'cline'];

/**
 * The shipped default host set for a thinning mode.
 *
 * One host, and it is the one host that both binds `pre_tool_use` and honours a
 * deny (`docs/enforcement-by-host.md:18-28`) — i.e. the only host where the
 * delivery concern's verdict is acted on. Widening this is a decision, never a
 * default: see `resolveLeanProjectionHosts`, which never widens implicitly.
 */
export const DEFAULT_LEAN_PROJECTION_HOSTS: readonly string[] = ['claude-code'];

/** Why an id in a configured `hosts:` list was not kept. */
export type DroppedHostReason = 'unknown' | 'not-thinnable';

export interface LeanProjectionHosts {
    /** The ids that survived, sorted and de-duplicated. */
    readonly hosts: readonly string[];
    /** Ids that were dropped, with the reason — reported, never silently discarded. */
    readonly dropped: ReadonlyArray<{ readonly id: string; readonly reason: DroppedHostReason }>;
    /** True when nothing was configured and the default was applied. */
    readonly usedDefault: boolean;
}

/**
 * Resolve a configured `lean_projection.hosts` list.
 *
 * Three properties, each of which is a failure this repository has seen in a
 * neighbouring config surface:
 *
 * 1. **Absent means the default, never "all".** An empty or missing list
 *    resolves to `DEFAULT_LEAN_PROJECTION_HOSTS`. A key nobody set must not
 *    thin every host — that is D1, the defect this axis exists to repair.
 * 2. **The set never widens implicitly.** Every id is checked against
 *    `THINNABLE_HOSTS`; anything else is dropped. A typo cannot enrol a host,
 *    and neither can a real host id that has no per-rule tree.
 * 3. **A drop is reported, not swallowed.** The caller gets the ids and the
 *    reason so it can print them. Silently ignoring an entry an operator wrote
 *    is how a setting comes to mean nothing while looking configured.
 *
 * A configured list that resolves to NOTHING keeps `usedDefault: false` and an
 * empty `hosts` — that is "thin no host", which is a legitimate and safe answer
 * and must not fall back to the default. Falling back there would turn a
 * fully-typo'd list into a Claude Code flip the operator never asked for.
 *
 * WHICH FILES REACH THIS AT ALL, stated because R2 finding 6 read the drop path
 * as unreachable: `agent-settings.schema.json` and the wizard's Zod schema both
 * constrain the items to an `enum`, so an out-of-vocabulary id written through
 * either surface is a hard validation FAILURE and never arrives here. What
 * arrives here is a HAND-EDITED `.agent-settings.yml` — the file
 * `condense._lean_projection_settings` and `hooks/rule_inject_hook.gateOpen`
 * both read directly, with no validation step in between. The two layers are
 * defence in depth, not one contract stated twice: the schema is the authoring
 * gate, this function is the read-time gate, and the drop wording below exists
 * for the file the schema never saw.
 */
export function resolveLeanProjectionHosts(raw: unknown): LeanProjectionHosts {
    const known = new Set(THINNABLE_HOSTS);
    if (!Array.isArray(raw) || raw.length === 0) {
        return { hosts: [...DEFAULT_LEAN_PROJECTION_HOSTS], dropped: [], usedDefault: true };
    }
    const hosts: string[] = [];
    const dropped: Array<{ id: string; reason: DroppedHostReason }> = [];
    for (const entry of raw) {
        const id = typeof entry === 'string' ? entry.trim().toLowerCase() : '';
        if (id === '') {
            dropped.push({ id: String(entry), reason: 'unknown' });
            continue;
        }
        if (!known.has(id)) {
            // `not-thinnable` is reserved for an id this package genuinely knows
            // as a host but which owns no per-rule tree. Everything else is a
            // typo or an invention, and the two deserve different wording
            // because the operator's next action differs: fix the spelling, or
            // learn that the host cannot be thinned at all.
            dropped.push({ id, reason: KNOWN_NON_THINNABLE_HOSTS.has(id) ? 'not-thinnable' : 'unknown' });
            continue;
        }
        if (!hosts.includes(id)) hosts.push(id);
    }
    hosts.sort();
    return { hosts, dropped, usedDefault: false };
}

/**
 * Host ids the package ships surfaces for that own no per-rule rule tree.
 *
 * Only used to word a drop precisely; it grants nothing. Sourced from
 * `condense._ALL_TOOLS` plus the two hosts outside it that the host table
 * carries (`codex`, `cowork`).
 */
const KNOWN_NON_THINNABLE_HOSTS: ReadonlySet<string> = new Set([
    'claude-desktop', 'augment', 'copilot', 'windsurf', 'gemini', 'codex', 'cowork',
]);

/** One line per dropped id, for a caller that prints warnings. Empty when nothing was dropped. */
export function describeDroppedHosts(res: LeanProjectionHosts): string[] {
    return res.dropped.map(({ id, reason }) =>
        reason === 'not-thinnable'
            ? `lean_projection.hosts: "${id}" is a known host but has no per-rule rule tree — dropped`
            : `lean_projection.hosts: "${id}" is not a thinnable host id — dropped`,
    );
}

/**
 * Does the projector write stubs for this host, under this mode and host set?
 *
 * The single predicate `condense` calls. Mode is checked FIRST and on purpose:
 * with `mode` unset the answer is `false` for every host regardless of what
 * `hosts` says, so a `hosts:` list left behind after a rollback to `eager-all`
 * thins nothing.
 */
export function thinsHost(mode: LeanProjectionMode, hosts: readonly string[], hostId: string): boolean {
    return writesThinFiles(mode) && hosts.includes(hostId);
}

export interface ResolvedLeanProjection {
    readonly mode: LeanProjectionMode;
    readonly hosts: LeanProjectionHosts;
    /**
     * Was `lean_projection.mode` set on a layer the USER controls — user-global,
     * project, or project-local — rather than inherited from the shipped
     * template?
     *
     * THE DISTINCTION IS NOT A REFINEMENT, IT IS A SAFETY BOUNDARY, and it is
     * the one `road-to-an-installed-layer-that-is-thinned` names in its Context:
     * the shipped template already says `mode: delivery`
     * (`src/config/agent-settings.template.yml:212-214`), so the moment the
     * INSTALLER resolves the mode through this resolver, the template value
     * alone would thin every consumer's `~/.claude/rules` — a default flip
     * arriving as a side effect of wiring a reader, with nobody deciding it.
     *
     * Whether that default flips is owner-reserved (that roadmap's blocker
     * `default-flip-of-the-installed-layer`, decision D4). So the installer must
     * be able to ask a question `mode` cannot answer: not "what is the mode" but
     * "did a human ask for this". That is this flag, and it is why it reports
     * provenance rather than a value.
     *
     * `false` whenever no layer the user controls carries the key — including
     * when `mode` reads `delivery` from the template, which is exactly the case
     * that must NOT be read as consent.
     */
    readonly modeExplicit: boolean;
}

export interface ResolveOptions {
    /** Project tree whose settings cascade is read. */
    readonly projectRoot?: string | null;
    /** Explicit settings file, overriding `projectRoot`. Tests and `condense` pin this. */
    readonly settingsPath?: string | null;
    /** Install root carrying `src/config/agent-settings.template.yml`. */
    readonly packageRoot?: string | null;
}

/**
 * THE resolver. Every surface that asks "which delivery mode" calls this.
 *
 * Tolerant like everything else on a hook path: `load_agent_settings` answers
 * with defaults on an unreadable or malformed file and never throws, and the
 * normalisers above turn anything unrecognised into the safe value. A caller
 * on a hot path pays two cascade reads per prompt — one for the value and one,
 * template-isolated, for `modeExplicit`'s provenance.
 */
export function resolveLeanProjection(opts: ResolveOptions = {}): ResolvedLeanProjection {
    // The LEGACY root path, deliberately, and not `project_settings_path`'s
    // either-or pick. `load_agent_settings` expands whatever it is given into
    // `[the file, <its dir>/agents/settings/.agent-settings.yml, <its dir>/
    // agents/settings/.agent-settings.local.yml]` and merges them deepest-wins,
    // so handing it the root path reads BOTH the legacy and the canonical file
    // — which is strictly more than picking one, and is what a tree carrying
    // both should resolve to. It also keeps one export out of this module's
    // import list, which is runtime bytes in the composed hook bundle.
    const file =
        opts.settingsPath ?? path.join(opts.projectRoot ?? process.cwd(), '.agent-settings.yml');
    const tpl =
        opts.packageRoot == null
            ? null
            : path.join(opts.packageRoot, 'src', 'config', 'agent-settings.template.yml');
    let lean: unknown;
    try {
        lean = load_agent_settings(
            tpl === null ? { project_path: file } : { project_path: file, template_path: tpl },
        )['lean_projection'];
    } catch {
        /* a settings layer nothing can read must never fail a turn */
    }
    const obj = typeof lean === 'object' && lean !== null && !Array.isArray(lean) ? lean : {};
    const o = obj as Record<string, unknown>;
    return {
        mode: normalizeLeanProjectionMode(o['mode'] ?? ''),
        hosts: resolveLeanProjectionHosts(o['hosts']),
        modeExplicit: rawExplicitLeanProjectionMode(opts) !== '',
    };
}

/**
 * A path no tree contains, so `template_defaults` contributes nothing.
 *
 * This is the mechanism `load_agent_settings` documents for the purpose —
 * "a test or tool that pins every other input can pin the defaults base too,
 * and point it at a nonexistent file to isolate the cascade" — used here for a
 * tool rather than a test. It is a reserved device filename on every platform
 * this package runs on and is never created, so the read fails and the loader's
 * own tolerance turns it into `{}`.
 *
 * The alternative — re-reading the YAML layers by hand — was rejected because
 * it would be a SECOND reader of the same key, which is the precise defect step
 * 1.2 of the carrier roadmap existed to remove. Isolating the base keeps one
 * reader and changes only which layers it is given.
 */
const NO_TEMPLATE_LAYER = path.join(path.sep, 'dev', 'null', 'agent-config-absent-template.yml');

/**
 * The RAW `lean_projection.mode` string from the user-controlled layers only,
 * or `''` when no such layer carries it.
 *
 * Raw and un-normalised on purpose: {@link normalizeLeanProjectionMode} maps
 * everything unrecognised — `''` included — onto `eager-all`, so a normalised
 * answer cannot tell "the user chose eager-all" from "the user chose nothing".
 * Provenance needs exactly that distinction, so it has to be read before the
 * normaliser runs.
 */
export function rawExplicitLeanProjectionMode(opts: ResolveOptions = {}): string {
    const file =
        opts.settingsPath ?? path.join(opts.projectRoot ?? process.cwd(), '.agent-settings.yml');
    let lean: unknown;
    try {
        lean = load_agent_settings({ project_path: file, template_path: NO_TEMPLATE_LAYER })[
            'lean_projection'
        ];
    } catch {
        return ''; // a layer nothing can read states no preference
    }
    if (typeof lean !== 'object' || lean === null || Array.isArray(lean)) return '';
    const m = (lean as Record<string, unknown>)['mode'];
    return typeof m === 'string' ? m.trim() : '';
}

/**
 * Did a human ask for this mode, and is it the one the caller is gated on?
 *
 * The question an installer actually has. `modeExplicit` alone is not enough —
 * a consumer who explicitly set `eager-all` has set the key explicitly and must
 * NOT be thinned — so the two conditions are folded here rather than left to
 * every caller to remember to combine.
 */
export function leanProjectionModeChosen(
    mode: LeanProjectionMode,
    opts: ResolveOptions = {},
): boolean {
    const raw = rawExplicitLeanProjectionMode(opts);
    return raw !== '' && normalizeLeanProjectionMode(raw) === mode;
}

/**
 * May the INSTALLER thin this host's rule tree?
 *
 * The host-aware sibling of {@link leanProjectionModeChosen}, and the predicate
 * `road-to-an-installed-layer-that-is-thinned` step 1.1 keys on. It folds the
 * three conditions that must hold together, once, so no caller has to remember
 * to combine them:
 *
 * 1. **A human asked.** `modeExplicit` — false whenever the only layer carrying
 *    the key is the shipped template, which already says `delivery`. Reading the
 *    template as consent would thin every consumer's `~/.claude/rules` as a side
 *    effect of wiring a reader, which is the owner-reserved default flip (that
 *    roadmap's blocker, decision D4).
 * 2. **The chosen mode actually writes stubs.** A consumer who explicitly chose
 *    `eager-all` has set the key and must NOT be thinned on the strength of
 *    having an opinion.
 * 3. **This host is in scope.** The same `hosts:` list the projector honours, so
 *    installer and projector cannot disagree about which trees are thinned.
 *
 * ONE `resolveLeanProjection` call, which is why this is not two
 * {@link leanProjectionModeChosen} calls: that one answers "is the chosen mode
 * exactly X" and knows nothing about `hosts`, so a caller combining it with a
 * host check by hand would re-create the fold this function exists to own.
 *
 * That is one CALL and two cascade READS, because `resolveLeanProjection`
 * computes `modeExplicit` through a second, template-isolated load. Stated
 * rather than rounded down: the installer runs once per deploy and does not care,
 * but the delivery concern on `user_prompt_submit` pays it per prompt, and a
 * docstring claiming one read would hide that from whoever profiles it next.
 */
export function installerThinsHost(hostId: string, opts: ResolveOptions = {}): boolean {
    const { mode, hosts, modeExplicit } = resolveLeanProjection({
        ...opts,
        settingsPath: opts.settingsPath ?? NO_PROJECT_LAYER,
    });
    return modeExplicit && thinsHost(mode, hosts.hosts, hostId);
}

/**
 * A path no tree contains, so the PROJECT cascade contributes nothing.
 *
 * The same device {@link NO_TEMPLATE_LAYER} uses, pointed at the other end of
 * the cascade, and the reason is scope rather than isolation: the thing
 * {@link installerThinsHost} gates is a mutation of `~/.claude/rules`, which
 * belongs to the MACHINE. A per-checkout value must not decide it, in either
 * direction — a project saying `delivery` would thin the layer every other
 * project on that machine reads, and a project saying `eager-all` would
 * suppress an opt-in the user wrote user-globally, because the project cascade
 * merges last and wins.
 *
 * `load_agent_settings` reads `user_global_settings_paths()` regardless of what
 * `project_path` it is given, so pointing the project layer at nothing leaves
 * exactly the machine-global layers — which is the scope the installer's
 * sibling `_resolve_global_rule_scope` already resolves for the same deploy.
 * A caller may still pass an explicit `settingsPath` (tests pin one).
 */
const NO_PROJECT_LAYER = path.join(
    path.sep,
    'dev',
    'null',
    'agent-config-absent-project-settings.yml',
);
