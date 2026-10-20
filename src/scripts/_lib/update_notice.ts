/**
 * What a session start should say about an available update, and whether it may
 * activate one — pure, so the hook around it is a thin wiring layer.
 *
 * Three properties this module exists to hold, in the order they matter:
 *
 * **No fetched text ever reaches the reader.** Everything in the notice is
 * either a number this module parsed as a semver, a sentence written here, or a
 * line read from the CHANGELOG of the package that is ALREADY INSTALLED. The
 * impact map arrives from the registry and is therefore attacker-influenceable;
 * {@link sanitiseImpactMap} reduces it to a closed enum and a boolean before
 * anything else looks at it, so a hostile changelog, description or version
 * label has nothing to travel on. That is roadmap decision D3, implemented as a
 * shape rather than as a scrubbing pass that could miss a case.
 *
 * **Nothing is activated at all, and that is narrower than it started.** A
 * candidate is STAGED and reported; the install stays with
 * `upgrade --unattended`, which a human or a scheduler runs. The concern used
 * to be able to spawn that run itself, and an independent review of 2026-10-20
 * refused the manifest for it: `effect: notification` means "tells the human
 * something and changes nothing else", and a hook that can replace the global
 * install is not that, whatever its `severity` says. The capability was
 * removed rather than the label widened.
 *
 * **A security release is loud in every mode but `off`.** It is the one notice
 * that does not wait for a mode to invite it, because `SECURITY.md:21` backports
 * nothing: an install that is not current is an install that is unpatched.
 */
import { CONSUMER_IMPACT_VALUES, type ConsumerImpact } from './consumer_impact.js';
import type { InstallOrigin, UpdateMode } from './classify_update.js';
import { compare_versions, parse_version } from './version_order.js';

/** The `SECURITY.md` line the security notice names, so the reader can check it. */
export const SECURITY_POLICY_REF = 'SECURITY.md:21 — fixes land on the latest version only; older releases are not backported';

/** The curated-head labels, most consequential first — the order the one line is picked in. */
export const HEAD_PRIORITY: readonly string[] = [
    'Security and correctness',
    'Default changes + migration',
    'Known limitations',
    'Behaviour changes',
    'Honest nulls',
];

/** One release's entry in the published impact map, after validation. */
export interface ImpactEntry {
    readonly impact: ConsumerImpact;
    readonly security: boolean;
}

/**
 * The registry's `agentConfig.impact` block reduced to versions this module
 * parsed and values from a closed enum.
 *
 * Anything else is dropped rather than reported: a map that does not validate
 * is an unknown, and an unknown is already handled by never resolving to
 * `auto`. Returning the forged text so the notice could explain itself would
 * put attacker-chosen bytes in front of the reader, which is the one thing this
 * surface may not do.
 */
export function sanitiseImpactMap(map: unknown): ReadonlyMap<string, ImpactEntry> {
    const clean = new Map<string, ImpactEntry>();
    if (map === null || typeof map !== 'object' || Array.isArray(map)) return clean;
    for (const [version, entry] of Object.entries(map as Record<string, unknown>)) {
        if (parse_version(version) === null) continue;
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const impact = (entry as Record<string, unknown>)['impact'];
        if (!(CONSUMER_IMPACT_VALUES as readonly unknown[]).includes(impact)) continue;
        clean.set(version, { impact: impact as ConsumerImpact, security: (entry as Record<string, unknown>)['security'] === true });
    }
    return clean;
}

/** The worst impact and whether any security fix lies in `(installed, candidate]`. */
export function impactInRange(
    map: ReadonlyMap<string, ImpactEntry>,
    installed: string,
    candidate: string,
): { readonly worst: ConsumerImpact | null; readonly security: boolean } {
    const rank = (i: ConsumerImpact): number => CONSUMER_IMPACT_VALUES.indexOf(i);
    let worst: ConsumerImpact | null = null;
    let security = false;
    for (const [version, entry] of map) {
        if (compare_versions(version, installed) !== 1 || compare_versions(version, candidate) === 1) continue;
        if (worst === null || rank(entry.impact) > rank(worst)) worst = entry.impact;
        security = security || entry.security;
    }
    return { worst, security };
}

export interface NoticeEnv {
    readonly ci: boolean;
    readonly interactive: boolean;
    readonly noUpdateCheck: boolean;
}

export interface NoticeInput {
    /** The version running right now, from the installed `package.json`. */
    readonly installed: string;
    /** The newest version the update probe cached; `null` when it has never run. */
    readonly candidate: string | null;
    /** The registry's impact block as cached — untrusted, validated here. */
    readonly impactMap: unknown;
    readonly mode: UpdateMode | undefined;
    readonly origin: InstallOrigin;
    readonly env: NoticeEnv;
    /** `{label: text}` from the INSTALLED package's changelog section for {@link installed}. */
    readonly curatedHead: ReadonlyMap<string, string>;
    /** The version a previous session staged, if any. */
    readonly staged: string | null;
    /** The version this concern last reported as installed, if any. */
    readonly lastSeenInstalled: string | null;
    /** True when another session is live on this machine right now. */
    readonly foreignSessionLive: boolean;
}

export interface NoticeOutcome {
    /** Lines for the user, in order. Empty means say nothing. */
    readonly lines: readonly string[];
    /** The version to record as staged, or `null` to clear the staging record. */
    readonly stage: string | null;
    /**
     * Always `null`. Kept as a field, not deleted, because its absence is the
     * finding: an independent review of 2026-10-20 refused the manifest while
     * this concern could spawn `upgrade --unattended`, on the ground that
     * `effect: notification` means "tells the human something and changes
     * nothing else" and a concern that can mutate the installation is not
     * that. The capability was removed rather than the label widened —
     * widening a closed effect vocabulary to fit one concern is the shape that
     * makes the vocabulary stop meaning anything. Activation stays with
     * `upgrade --unattended`, which a human or a scheduler runs.
     */
    readonly activate: null;
    /** Why nothing was said, for the lifecycle log. `null` when something was. */
    readonly suppressed: string | null;
}

const NOTHING = (reason: string): NoticeOutcome => ({ lines: [], stage: null, activate: null, suppressed: reason });

/** Contexts where a session start says nothing and writes nothing. */
export function noticeSuppression(input: Pick<NoticeInput, 'env' | 'origin' | 'mode'>): string | null {
    if (input.env.ci) return 'CI';
    if (!input.env.interactive) return 'non-interactive';
    if (input.env.noUpdateCheck) return 'AGENT_CONFIG_NO_UPDATE_CHECK=1';
    if (input.origin === 'source-checkout') return 'source checkout';
    if (input.origin === 'ephemeral') return 'ephemeral run';
    if (input.mode === 'off') return 'update.mode off';
    return null;
}

/** The one curated-head line for a version, or `null` when the head says nothing. */
export function oneCuratedLine(head: ReadonlyMap<string, string>): string | null {
    for (const label of HEAD_PRIORITY) {
        const text = head.get(label);
        if (text !== undefined && text.trim() !== '' && text.trim() !== '_none_') {
            return `${label}: ${text.trim()}`;
        }
    }
    return null;
}

/**
 * What to say and what may happen.
 *
 * The post-update branch comes first because it is the one that reports a
 * change that already occurred; an available-update notice about a version the
 * reader just moved past would be noise.
 */
export function updateNotice(input: NoticeInput): NoticeOutcome {
    const suppressed = noticeSuppression(input);
    if (suppressed !== null) return NOTHING(suppressed);

    // Post-update: the installed version moved since this concern last looked.
    if (input.lastSeenInstalled !== null && compare_versions(input.installed, input.lastSeenInstalled) === 1) {
        const line = oneCuratedLine(input.curatedHead);
        const lines = [`agent-config is now ${input.installed} (was ${input.lastSeenInstalled}).`];
        if (line !== null) lines.push(`  ${line}`);
        return { lines, stage: null, activate: null, suppressed: null };
    }

    if (input.candidate === null || parse_version(input.candidate) === null) return NOTHING('no cached candidate');
    if (compare_versions(input.candidate, input.installed) !== 1) return NOTHING('nothing newer cached');

    const range = impactInRange(sanitiseImpactMap(input.impactMap), input.installed, input.candidate);
    const lines = [`agent-config ${input.candidate} is available (installed: ${input.installed}).`];
    if (range.security) lines.push(`  Security fix in range. ${SECURITY_POLICY_REF}.`);
    if (range.worst === 'notice') lines.push('  A release in range carries a notice — read it before upgrading.');
    if (range.worst === 'action') lines.push('  A release in range needs a hand; it is never installed unattended.');

    // Staging only. This concern records which candidate it verified and says
    // so; it installs nothing, ever. Under `auto` it still names the live-session
    // state, because that is what decides whether an `upgrade --unattended` run
    // would be allowed to swap at all, and a reader under `auto` is entitled to
    // know which of the two reasons is holding their install back.
    const stageable = range.worst !== 'action';

    if (input.mode === 'auto' && stageable) {
        lines.push(
            input.foreignSessionLive
                ? '  Staged. Another session is open on this machine, so a swap would break its hooks.'
                : '  Staged. Run `agent-config upgrade --unattended` to install it.',
        );
    } else {
        lines.push('  Run `agent-config upgrade` to install it.');
    }

    return { lines, stage: stageable ? input.candidate : null, activate: null, suppressed: null };
}

/**
 * The curated head of one version's CHANGELOG section, as `{label: text}`.
 *
 * Parses the SHIPPED changelog — the one inside the installed package — which
 * is why this takes text rather than a path: the caller decides which tree it
 * is reading, and no caller may point it at a fetched document.
 *
 * The shape is the one `_lib/release_highlights.ts` writes: a `## [<version>]`
 * section, a `### Release highlights` heading inside it, then one
 * `- **<Label>:** <text>` bullet per label. A section without a highlights
 * heading yields an empty map, which the notice renders as no line at all —
 * absence is a legitimate answer here, not an error.
 */
export function parseCuratedHead(changelog: string, version: string): ReadonlyMap<string, string> {
    const head = new Map<string, string>();
    const lines = changelog.split('\n');
    const sectionStart = lines.findIndex((l) => new RegExp(`^## \\[?${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]?(\\s|$)`).test(l));
    if (sectionStart < 0) return head;
    let inHighlights = false;
    for (let i = sectionStart + 1; i < lines.length; i += 1) {
        const line = lines[i] as string;
        if (/^#{1,2} /.test(line)) break; // the next release section, or a new era
        if (/^### /.test(line)) {
            inHighlights = /^### Release highlights\s*$/.test(line);
            continue;
        }
        if (!inHighlights) continue;
        const m = /^- \*\*(.+?):\*\*\s*(.*)$/.exec(line);
        if (m !== null) head.set(m[1] as string, (m[2] as string).trim());
    }
    return head;
}
