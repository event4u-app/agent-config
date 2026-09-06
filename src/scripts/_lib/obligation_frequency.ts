/**
 * Obligation frequency, carrier frequency, and the coverage lattice between them.
 *
 * `enforced_by` answers *does something carry this rule*. It does not answer
 * *does it carry it often enough*, and the difference is not academic:
 * `session-canary` declares `hook:session-canary`, the hook exists, is wired and
 * fires — so the coverage instrument counts the rule as enforced — while the hook
 * sits in the `session_start` slot and the rule's obligation is per task. The
 * rule's own 30-session audit measured the opening canary dropped on ~13 of 15
 * task starts. Enforced on paper, broken in fact.
 *
 * This module supplies the missing half: a declared obligation period per rule
 * (frontmatter `obligation_frequency`), a carrier period resolved per slot AND
 * per platform, and a `covers()` relation that is honest about the two ways the
 * intuitive linear ordering produces FALSE GREENS.
 *
 * ## The value set is a forest, not a chain
 *
 * Four roots. A carrier in one root never covers an obligation in another:
 *
 *   lifecycle       per-turn ⊃ per-task ⊃ per-session
 *   tool-call       per-edit ⊃ per-file-write
 *   repository      per-commit
 *   external-event  per-event
 *
 * Two corrections that a magnitude-ordered chain would get wrong:
 *
 *  - `per-edit` and `per-turn` are INCOMPARABLE. `pre_tool_use`/`post_tool_use`
 *    fire per tool call, so a plain conversational reply fires them zero times.
 *    A per-turn obligation carried only by a per-edit hook is uncovered on
 *    exactly those turns — and a chain would paint that green.
 *  - `per-event` is a SEPARATE ROOT, not the bottom of the lifecycle chain. An
 *    external event fires on its own clock: a CI gate firing three times inside
 *    one session is not covered by a `session_start` check, yet a chain with
 *    `per-event` at the bottom would accept the session-scoped carrier as
 *    dominating it and report green.
 *
 * ## Point carriers vs sweep carriers — the third correction
 *
 * The forest rule above is stated for carriers that fire AT an event and see
 * only that event: a hook. A CI validator is not that shape. It fires once per
 * commit and inspects the whole tree, so it catches every edit inside the commit
 * regardless of how many there were. Treating it as a `per-commit` point carrier
 * would make every `validator:`-carried rule with a per-edit obligation a
 * finding — roughly a fifth of the declared corpus at once, all from one
 * modelling error, which is precisely the unusable-first-run failure this audit
 * must avoid.
 *
 * So carriers have a MODE. A `sweep` carrier covers any obligation whose
 * violations land in a durable artefact (`per-edit`, `per-file-write`,
 * `per-commit`). It covers none of the transient ones (`per-turn`, `per-task`,
 * `per-session`, `per-event`), because a reply's language, a greeting, or a
 * fetched-content decision leaves nothing in the tree for a sweep to read.
 */

// ------------------------------------------------------------------ vocabulary

export type Frequency =
    | 'per-edit'
    | 'per-turn'
    | 'per-task'
    | 'per-session'
    | 'per-event'
    | 'per-commit'
    | 'per-file-write'
    | 'none';

export const FREQUENCIES: readonly Frequency[] = [
    'per-edit',
    'per-turn',
    'per-task',
    'per-session',
    'per-event',
    'per-commit',
    'per-file-write',
    'none',
] as const;

export function is_frequency(v: unknown): v is Frequency {
    return typeof v === 'string' && (FREQUENCIES as readonly string[]).includes(v);
}

export type Root = 'lifecycle' | 'tool-call' | 'repository' | 'external-event' | 'none';

const ROOT_OF: Record<Frequency, Root> = {
    'per-turn': 'lifecycle',
    'per-task': 'lifecycle',
    'per-session': 'lifecycle',
    'per-edit': 'tool-call',
    'per-file-write': 'tool-call',
    'per-commit': 'repository',
    'per-event': 'external-event',
    none: 'none',
};

/**
 * Cross-root coverage that IS real, enumerated rather than inferred.
 *
 * `per-commit` keeps its own root because it is not a lifecycle event — a
 * `--fixup` during a rebase has no preceding user turn, so no lifecycle carrier
 * covers it. But in an agent runtime every commit the agent makes is issued
 * through a tool call, so a point carrier in the tool-call root DOES observe it:
 * `block-no-verify` sits in `pre_tool_use` and inspects the very `git commit`
 * command. Refusing that edge on a tidy root rule would report the commit guard
 * as failing to carry the commit rule, which is the opposite of true.
 *
 * The relation is one-directional. A per-commit carrier does not cover a
 * per-edit obligation: one commit can hold twenty edits, and a point carrier at
 * the commit sees the command, not each edit that preceded it.
 */
const CROSS_ROOT_COVERAGE: ReadonlyArray<readonly [Frequency, Frequency]> = [
    ['per-edit', 'per-commit'],
];

export function root_of(f: Frequency): Root {
    return ROOT_OF[f];
}

/**
 * Within-root inclusion depth: a SMALLER number fires more often, so it is a
 * superset of every larger number in the same root. Cross-root comparison is
 * rejected before this table is consulted.
 */
const DEPTH: Record<Frequency, number> = {
    'per-turn': 0,
    'per-task': 1,
    'per-session': 2,
    'per-edit': 0,
    'per-file-write': 1,
    'per-commit': 0,
    'per-event': 0,
    none: 0,
};

// -------------------------------------------------------------------- carriers

/**
 * How a carrier observes the world.
 *
 * `point` — fires at an event and sees that event (a hook).
 * `sweep` — fires once and inspects the whole artefact tree (a CI validator, a
 *           test suite). Its reach is bounded by what lands in the tree, not by
 *           how often it runs.
 */
export type CarrierMode = 'point' | 'sweep';

/** Obligations whose violations leave a durable trace a sweep can read. */
const SWEEPABLE: ReadonlySet<Frequency> = new Set<Frequency>([
    'per-edit',
    'per-file-write',
    'per-commit',
]);

/**
 * Does `carrier` cover `obligation`?
 *
 * An obligation of `none` is covered vacuously — there is nothing recurring to
 * carry, which is what `none` means. Everything else is decided by mode first,
 * then root, then within-root depth.
 */
export function covers(
    carrier: { frequency: Frequency; mode: CarrierMode },
    obligation: Frequency,
): boolean {
    if (obligation === 'none') return true;
    if (carrier.mode === 'sweep') return SWEEPABLE.has(obligation);
    if (carrier.frequency === 'none') return false;
    if (CROSS_ROOT_COVERAGE.some(([c, o]) => c === carrier.frequency && o === obligation)) {
        return true;
    }
    if (ROOT_OF[carrier.frequency] !== ROOT_OF[obligation]) return false;
    return DEPTH[carrier.frequency] <= DEPTH[obligation];
}

/** True when ANY of a carrier's firing periods covers the obligation. */
export function covers_any(frequencies: readonly Frequency[], obligation: Frequency): boolean {
    return frequencies.some((f) => covers({ frequency: f, mode: 'point' }, obligation));
}

// ------------------------------------------------------------- the decay guard

/**
 * Prose signals that suggest a period, keyed to the value they suggest.
 *
 * A declared value can be right the day it is written and wrong two edits later,
 * and nothing in the join notices — the field would then be a stale claim
 * wearing a schema. This heuristic reads the rule's own prose and reports when
 * it demands a TIGHTER period than the frontmatter declares.
 *
 * Deliberately one-directional. Prose looser than the declaration is not a
 * finding: a rule may state a per-session cache and still carry a per-turn
 * obligation elsewhere in its body, and flagging that would fire on most of the
 * corpus. Prose demanding MORE often than declared is the direction where the
 * join silently over-credits a carrier.
 */
const PROSE_SIGNALS: ReadonlyArray<readonly [Frequency, RegExp]> = [
    ['per-turn', /\b(every|each) (reply|turn|answer|response)\b/i],
    ['per-turn', /\bper (reply|turn)\b/i],
    ['per-task', /\b(every|each) (new )?task\b/i],
    ['per-edit', /\bafter every (code )?edit\b/i],
    ['per-edit', /\b(every|each) edit\b/i],
    ['per-commit', /\b(in the )?same commit\b/i],
    ['per-commit', /\b(every|each) commit\b/i],
];

/**
 * Frequencies the prose demands but the declared value does not cover.
 *
 * Empty is the passing answer. A non-empty result is a WARNING — the heuristic
 * is a keyword match over prose and will be noisy, so it never fails a build;
 * an audited mismatch is silenced with an explicit `# frequency-override:`
 * comment, which makes a suppression a decision someone signed rather than
 * silence.
 */
export function frequency_prose_conflicts(body: string, declared: Frequency): Frequency[] {
    const out: Frequency[] = [];
    for (const [freq, re] of PROSE_SIGNALS) {
        if (!re.test(body)) continue;
        if (covers({ frequency: declared, mode: 'point' }, freq)) continue;
        if (!out.includes(freq)) out.push(freq);
    }
    return out;
}

/** True when the file carries an audited `# frequency-override: <reason>` note. */
export function has_frequency_override(text: string): boolean {
    return /^#\s*frequency-override:\s*\S/m.test(text);
}

// --------------------------------------------------------- slot × platform map

export type Slot =
    | 'session_start'
    | 'session_end'
    | 'stop'
    | 'user_prompt_submit'
    | 'pre_tool_use'
    | 'post_tool_use';

/**
 * Default firing period per slot, before per-platform native-event corrections.
 *
 * `stop` is per-turn, NOT session end. On Claude Code the native `Stop` event
 * fires after every assistant reply — `hook_manifest.yaml` says so itself,
 * describing the `stop` write as a "deterministic … overwrite of hot-context.md",
 * i.e. a working-memory refresh per reply. True session end is the separate
 * `session_end` slot.
 */
const SLOT_FREQUENCY_DEFAULT: Record<Slot, Frequency> = {
    session_start: 'per-session',
    session_end: 'per-session',
    stop: 'per-turn',
    user_prompt_submit: 'per-turn',
    pre_tool_use: 'per-edit',
    post_tool_use: 'per-edit',
};

/**
 * Per-platform overrides where the native event a slot is mapped from means
 * something other than the default.
 *
 * Cline maps `stop` from `TaskCancel` — the session is interrupted with partial
 * state (`hook_manifest.yaml`: "TaskCancel maps to stop because the session is
 * interrupted with partial state"). That is an interruption on its own clock,
 * not a per-reply beat, so it belongs to the external-event root and covers no
 * lifecycle obligation. Collapsing it into per-turn is the semantic type error
 * a one-dimensional slot→frequency table cannot express.
 */
const SLOT_FREQUENCY_OVERRIDE: Record<string, Partial<Record<Slot, Frequency>>> = {
    cline: { stop: 'per-event' },
};

export function slot_frequency(platform: string, slot: Slot): Frequency {
    return SLOT_FREQUENCY_OVERRIDE[platform]?.[slot] ?? SLOT_FREQUENCY_DEFAULT[slot];
}

/**
 * Platforms this package binds nothing on.
 *
 * Copilot declares `fallback_only: true` in the manifest — concerns route
 * through rule-only fallback and the dispatcher no-ops. Every hook-declared
 * carrier fires zero times there, for every rule equally. Including it in the
 * join would turn one structural fact into a finding on every hook-carried rule
 * at once, which reports a platform property as if it were a per-rule defect.
 * It is excluded by declaration, and the exclusion is named in the report rather
 * than hidden.
 */
export function is_hook_capable(platform_block: Record<string, unknown>): boolean {
    return platform_block['fallback_only'] !== true;
}

// ------------------------------------------------- hook manifest platform read

export interface PlatformBinding {
    /** Platform id → slot → concern ids bound in that slot. */
    slots: Map<string, Map<Slot, string[]>>;
    /** Platform ids declared `fallback_only` — this package binds nothing there. */
    fallback_only: Set<string>;
}

const SLOT_NAMES: ReadonlySet<string> = new Set<string>([
    'session_start',
    'session_end',
    'stop',
    'user_prompt_submit',
    'pre_tool_use',
    'post_tool_use',
]);

/**
 * Read the `platforms:` block of `hook_manifest.yaml`.
 *
 * A narrow reader, matching the one `check_enforcement_coverage.parse_hook_manifest`
 * already uses for `concerns:` — the block is a fixed two-level shape
 * (`platform: slot: [concern, …]`) and the only facts needed are slot membership
 * and the `fallback_only` sentinel. Deliberately NOT a second YAML dependency.
 */
export function parse_hook_platforms(text: string): PlatformBinding {
    const slots = new Map<string, Map<Slot, string[]>>();
    const fallback_only = new Set<string>();
    let in_platforms = false;
    let current: string | null = null;

    for (const raw of text.split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (/^platforms:\s*$/.test(line)) {
            in_platforms = true;
            continue;
        }
        if (!in_platforms) continue;
        if (/^\S/.test(line)) break; // left the platforms block
        if (line.trim() === '' || /^\s*#/.test(line)) continue;

        const platform = /^ {2}([a-z0-9_-]+):\s*$/.exec(line)?.[1];
        if (platform !== undefined) {
            current = platform;
            slots.set(current, new Map());
            continue;
        }
        if (current === null) continue;

        if (/^\s+fallback_only:\s*true\s*$/.test(line)) {
            fallback_only.add(current);
            continue;
        }
        const m = /^\s+([a-z_]+):\s*\[(.*)\]\s*$/.exec(line);
        if (m === null) continue;
        const slot = m[1] as string;
        if (!SLOT_NAMES.has(slot)) continue;
        const concerns = (m[2] as string)
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        slots.get(current)?.set(slot as Slot, concerns);
    }
    return { slots, fallback_only };
}

/**
 * Resolve, per platform, EVERY period at which `concern` fires — a set, never a
 * scalar.
 *
 * A concern bound in more than one slot fires at the UNION of their periods, and
 * those periods can sit in different roots: `minimal-safe-diff` is bound in
 * `session_start` (per-session), `user_prompt_submit` (per-turn) AND
 * `post_tool_use` (per-edit). Collapsing that to one "strongest" value has no
 * correct answer, because per-turn and per-edit are incomparable by
 * construction — and picking either drops a root the carrier really does cover.
 * Doing so reported `minimal-safe-diff` as failing to carry its own per-edit
 * obligation while a post_tool_use binding was sitting right there.
 *
 * An empty array means the concern is bound in no slot on that platform, which
 * is a distinct answer from any frequency and must not be collapsed into one.
 */
export function carrier_frequency_by_platform(
    concern: string,
    binding: PlatformBinding,
): Record<string, Frequency[]> {
    const out: Record<string, Frequency[]> = {};
    for (const [platform, slot_map] of binding.slots) {
        if (binding.fallback_only.has(platform)) continue; // named in the report, not joined
        const found: Frequency[] = [];
        for (const [slot, concerns] of slot_map) {
            if (!concerns.includes(concern)) continue;
            const f = slot_frequency(platform, slot);
            if (!found.includes(f)) found.push(f);
        }
        out[platform] = found;
    }
    return out;
}
