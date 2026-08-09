/**
 * The always-written carve-out set for the sparse settings file.
 *
 * `road-to-zero-ceremony-settings` Phase 3. The user's global settings file
 * becomes a sparse record of decisions actually made, which is safe only while
 * *key absent* resolves exactly like *key set to the template default*.
 *
 * An audit of every reader found that is NOT universally true. For the keys
 * below a reader deliberately resolves an absent key to something other than
 * the template's default, so omitting them from a fresh install's file would
 * silently change behaviour. They are written explicitly instead, with their
 * template value, and stamped `package-default` in the provenance sidecar so
 * the file never claims the user decided them.
 *
 * This is the blocker's "carved out" branch. The alternative branch — "fixed at
 * its reader" — was rejected for the `projection.*` family because the
 * divergence there is the documented upgrade-safety contract
 * (`agent-settings.template.yml`: *"a missing key also still means legacy-all,
 * so only fresh installs get the scoped default"*). Changing those readers
 * would flip existing 5.x installs from `legacy-all` to `scoped`, which is the
 * silent narrowing the contract exists to prevent.
 *
 * Pure module — no I/O. The VALUES are not duplicated here; only the key paths
 * and the reason. The emitter reads each value out of the template, so this
 * list cannot drift from the defaults it is protecting.
 *
 * @see docs/contracts/settings-classes.md
 */

/** One key whose absence is not equivalent to its template default. */
export interface CarveOutKey {
    /** Dotted path into the settings tree. */
    key: string;
    /** The reader that diverges, as `file:line`, so the claim is checkable. */
    reader: string;
    /** What an ABSENT key resolves to at that reader. */
    absentResolvesTo: string;
    /** Why it is carved out rather than fixed at the reader. */
    reason: string;
}

export const SETTINGS_CARVE_OUT: readonly CarveOutKey[] = [
    {
        key: 'projection.mode',
        reader: 'src/scripts/install.ts:3409 _resolve_scoped_projection',
        absentResolvesTo: 'legacy-all',
        reason:
            'The template fallback applies only when NO global settings file exists. '
            + 'Once a file exists, an absent key means legacy-all by documented contract, '
            + 'so an existing install is never silently narrowed on upgrade.',
    },
    {
        key: 'projection.rule_workspaces',
        reader: 'src/install/rule_scope.ts:96 ruleScopeFromSettings',
        absentResolvesTo: 'null — LEGACY_ALL, i.e. every rule ships including maintainer-only ones',
        reason:
            'Same upgrade contract as projection.mode, and the failure is louder: '
            + 'an absent list widens the projection instead of narrowing it.',
    },
    {
        key: 'discipline_profile',
        reader: 'work_engine/_lib/agent_settings.ts:1263',
        absentResolvesTo: 'essential, unconditionally',
        reason:
            'The template ships `auto`, which resolves to `off` on any measured-null model, '
            + 'any non-Claude host, and any host exposing no model id. Absent skips that '
            + 'resolution entirely and loads the essential tier everywhere.',
    },
    {
        key: 'chat_history.frequency',
        reader: 'src/scripts/chat_history.ts:1140',
        absentResolvesTo: 'per_phase',
        reason:
            'Canonical substitution is `per_turn`. Absent gives coarser capture than the '
            + 'shipped default — an audit-thinning change, which the class contract\'s own '
            + 'test 8 (what can the attacker HIDE) names as the severe direction.',
    },
    {
        key: 'profile.id',
        reader: 'src/scripts/config/profiles.ts:221 resolve_profile',
        absentResolvesTo:
            'the id `developer`, but a DEGRADED profile — packs: [], personas: [], hints: []',
        reason:
            'Exactly the projection.mode shape: the template default is honoured only when '
            + 'no settings file exists. With a file present the id resolves but its profile '
            + 'body does not load, so the install silently loses every pack and persona.',
    },
    {
        key: 'quality.local_auto_run',
        reader: 'src/scripts/lint_roadmap_ci_steps.ts:106',
        absentResolvesTo: 'true — which DISABLES the CI-step gate',
        reason:
            'Inverted polarity, and the most dangerous row in the set: the template ships '
            + '`false`, which ARMS the gate. Omitting the key would disarm a quality gate '
            + 'for every fresh install while the reference page says it is on.',
    },
    {
        key: 'onboarding.onboarded',
        reader: 'src/scripts/onboarding_gate_hook.ts:99',
        absentResolvesTo: 'gate skipped, as if onboarding had already completed',
        reason:
            'Absent behaves like `onboarded: true`, not like the template default `false`. '
            + 'Omitting it would skip the onboarding gate on precisely the fresh installs '
            + 'the gate exists for.',
    },
    {
        key: 'chat_history.enabled',
        reader: 'src/scripts/chat_history.ts:1025 _read_chat_history_enabled',
        absentResolvesTo: 'false',
        reason:
            'The reader falls back to false while the template ships true. This one is '
            + 'privacy-shaped: fixing the reader would start recording history for every '
            + 'install whose file lacks the key. Writing it explicitly keeps the decision '
            + 'visible in the file the user can read.',
    },
];

/** Just the paths — the emitter iterates these against the template. */
export function carveOutKeys(): readonly string[] {
    return SETTINGS_CARVE_OUT.map((c) => c.key);
}

/**
 * `projection.*` is additionally stripped from the user-global layer by
 * `load_agent_settings`'s `MERGEABLE_KEYS` whitelist, so `_globalRuleScope`
 * (`src/server/routes/install.ts:234`) resolves LEGACY_ALL whether or not the
 * key is written. That is a pre-existing defect, independent of sparseness —
 * widening the whitelist requires an ADR, per its own comment — and the
 * carve-out neither causes nor fixes it. Recorded so the next reader of this
 * module does not mistake the carve-out for a fix.
 */
export const KNOWN_UNFIXED_BY_CARVE_OUT =
    'src/server/routes/install.ts:234 _globalRuleScope — MERGEABLE_KEYS strips projection.*; needs an ADR.';
