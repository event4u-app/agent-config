/**
 * The detection report — one builder, one renderer, three surfaces (Phases 3
 * and 4 of `road-to-zero-ceremony-detection`).
 *
 * `doctor`'s detection section, its `--json` payload, and the first-invocation
 * spend disclosure are all produced from the SAME rows built here. That is the
 * point: a disclosure rendered by its own code path drifts from the report the
 * user just read, and then the number they were shown is not the number that
 * governs the call.
 *
 * ## What a row says — and what it deliberately does not
 *
 * Per provider: `detected` · `authenticated` · `authSource` · `billing` ·
 * `enabledInConfig`, plus the transport `auto` WOULD select and, when the
 * provider is unavailable, a one-line reason and a one-line fix.
 *
 * The gap between "could work" and "allowed to spend" is reported, never
 * closed. `enabledInConfig: false` on a fully detected provider is not a
 * defect — it is a recorded consent decision, and this module's job is to make
 * that visible instead of mysterious. See the roadmap's
 * `council-availability-semantics` blocker for why detection does not confer
 * permission.
 *
 * ## Purity
 *
 * `buildDetectionReport` is pure over its inputs: an `EnvironmentReport` from
 * `_lib/environment_detector.ts` plus a `CouncilFacts` struct. The impure read
 * lives in `readCouncilFacts`, and the CLI-call counters are injected by the
 * caller — so this module never imports the council client layer and cannot
 * reach a billable call.
 */

import * as path from 'node:path';

import {
    classifyBilling,
    knownProviders,
    strongestAuth,
    PROVIDER_CLI_META,
    type AuthSource,
    type BillingClass,
    type DetectedHost,
    type EnvironmentReport,
} from '../_lib/environment_detector.js';
import { resolveTransport, type Transport } from '../ai_council/transport_resolver.js';

export const DETECTION_SCHEMA_VERSION = 1;

/** The council-config facts a row needs. Read separately so the builder is pure. */
export interface CouncilFacts {
    /** Resolved user-global config path, whether or not it exists. */
    readonly configPath: string;
    readonly configPresent: boolean;
    /** Council master switch. `false` when no config exists. */
    readonly enabled: boolean;
    /** Effective `defaults.mode`, or `null` when no config exists. */
    readonly defaultsMode: string | null;
    readonly members: Readonly<Record<string, CouncilMemberFacts>>;
    /** `cli_call_budget.max_calls_per_day` per provider. */
    readonly cliCaps: Readonly<Record<string, number>>;
    /** `cost_budget.max_total_usd`, or `null` when no config exists. */
    readonly costBudgetMaxUsd: number | null;
}

export interface CouncilMemberFacts {
    readonly enabled: boolean;
    /** Per-member `mode:` override, or `null`. */
    readonly mode: string | null;
    /** Per-member `binary:` override, or `null`. */
    readonly binary: string | null;
    readonly apiKeyRef: string | null;
}

export interface ProviderRow {
    readonly provider: string;
    /** A CLI binary resolves OR any credential is present. */
    readonly detected: boolean;
    /** Any credential is present. Presence — never a claim that it works. */
    readonly authenticated: boolean;
    readonly authSource: AuthSource | null;
    readonly billing: BillingClass;
    /** The transport `auto` would select right now, or `null` when none can be. */
    readonly transport: Transport | null;
    /**
     * The mode this member is actually CONFIGURED with — per-member override,
     * else `defaults.mode`. Distinct from `transport`: that answers "what could
     * work", this answers "what will run". A member pinned to `manual` makes no
     * provider call no matter what `auto` could have reached.
     */
    readonly configuredMode: string | null;
    readonly available: boolean;
    readonly enabledInConfig: boolean;
    /** Non-null exactly when `available` is false. */
    readonly reason: string | null;
    /** One-line fix. Non-null whenever the capability is unusable as configured. */
    readonly fix: string | null;
    /** Per-day CLI cap, or `null` when unset (unlimited from the loader's view). */
    readonly cliCap: number | null;
    /** CLI calls already spent today, when the caller supplied counters. */
    readonly cliUsed: number | null;
}

export interface DetectionReport {
    readonly schema_version: number;
    readonly council_config_path: string;
    readonly council_config_present: boolean;
    readonly council_enabled: boolean;
    readonly defaults_mode: string | null;
    readonly hosts: readonly DetectedHost[];
    readonly providers: readonly ProviderRow[];
    readonly budgets: {
        readonly cost_budget_max_total_usd: number | null;
        readonly cli_call_budget: Readonly<Record<string, number>>;
    };
}

export interface BuildDetectionReportOptions {
    readonly environment: EnvironmentReport;
    readonly council: CouncilFacts;
    /** `provider -> calls spent today`. Injected so this module stays client-free. */
    readonly cliCallsUsed?: Readonly<Record<string, number>>;
    /** Environment map for resolving `env:` key refs. Defaults to `process.env`. */
    readonly env?: Readonly<Record<string, string | undefined>>;
}

/**
 * True when `ref` is an `env:<VAR>` reference whose variable actually holds a
 * value. A `file:` ref is deliberately NOT resolved here — the detector already
 * probes the standard key-file names, and re-resolving arbitrary paths would be
 * the third auth-probe shape this work exists to avoid.
 */
function envRefResolves(
    ref: string | null,
    env?: Readonly<Record<string, string | undefined>>,
): boolean {
    if (ref === null || !ref.startsWith('env:')) return false;
    const name = ref.slice('env:'.length).trim();
    if (name === '') return false;
    return ((env ?? process.env)[name] ?? '').trim() !== '';
}

/**
 * The one-line edit that grants a detected provider permission to spend.
 *
 * This is an EDIT, not an invented command: no settings-mutation CLI exists
 * (`settings` is a GUI alias; a `settings set` verb is greenfield), so emitting
 * `agent-config settings set …` would print a command that does not run. The
 * file and the exact key path are what remove the work of finding it, which is
 * the actual goal — consent stays an explicit act either way.
 */
export function enableInstruction(provider: string, configPath: string): string {
    return `set \`members.${provider}.enabled: true\` in ${configPath}`;
}

/** Build every row. Pure over `opts`. */
export function buildDetectionReport(opts: BuildDetectionReportOptions): DetectionReport {
    const { environment, council } = opts;
    const used = opts.cliCallsUsed ?? {};
    const providers: ProviderRow[] = [];

    for (const provider of knownProviders()) {
        const member = council.members[provider];
        const enabledInConfig = member?.enabled ?? false;
        const auth = strongestAuth(environment, provider);
        const authSource = auth?.source ?? null;
        const binaryOverride = member?.binary ?? null;

        // What `auto` would pick — the honest "could this work right now"
        // answer, independent of the mode actually configured.
        //
        // A CONFIGURED `api_key_ref` is not a RESOLVED key: every member in the
        // shipped template carries one (`env:XAI_API_KEY` and friends) whether
        // or not the variable is set. Treating configuration as presence made
        // every provider report `auto→api` while showing `detected ❌`. So the
        // detector's records decide, plus the one case configuration does prove:
        // an `env:` ref whose variable actually holds a value.
        const resolved = resolveTransport({
            provider,
            mode: 'auto',
            report: environment,
            binaryOverride,
            ...(envRefResolves(member?.apiKeyRef ?? null, opts.env)
                ? { apiKeyPresent: true }
                : {}),
        });

        const binaryPresent = cliBinaryPresent(environment, provider, binaryOverride);
        const detected = binaryPresent || authSource !== null;
        const capRaw = council.cliCaps[provider];

        providers.push({
            provider,
            detected,
            authenticated: authSource !== null,
            authSource,
            billing: classifyBilling(provider, authSource),
            transport: resolved.transport,
            configuredMode: member?.mode ?? council.defaultsMode,
            available: resolved.available,
            enabledInConfig,
            reason: resolved.reason,
            fix: fixFor({
                provider,
                detected,
                available: resolved.available,
                configuredMode: member?.mode ?? council.defaultsMode,
                enabledInConfig,
                councilEnabled: council.enabled,
                configPresent: council.configPresent,
                configPath: council.configPath,
                reason: resolved.reason,
            }),
            cliCap: capRaw ?? null,
            cliUsed: Object.prototype.hasOwnProperty.call(used, provider)
                ? (used[provider] ?? 0)
                : null,
        });
    }

    return {
        schema_version: DETECTION_SCHEMA_VERSION,
        council_config_path: council.configPath,
        council_config_present: council.configPresent,
        council_enabled: council.enabled,
        defaults_mode: council.defaultsMode,
        hosts: environment.hosts,
        providers,
        budgets: {
            cost_budget_max_total_usd: council.costBudgetMaxUsd,
            cli_call_budget: council.cliCaps,
        },
    };
}

function cliBinaryPresent(
    environment: EnvironmentReport,
    provider: string,
    binaryOverride: string | null,
): boolean {
    if (binaryOverride !== null && binaryOverride.trim() !== '') return true;
    const expected = PROVIDER_CLI_META[provider]?.[0];
    if (expected === undefined) return false;
    return environment.hosts.some(
        (h) => h.binary !== null && stripExe(path.basename(h.binary)) === expected,
    );
}

function stripExe(name: string): string {
    return name.replace(/\.(exe|cmd)$/i, '');
}

/**
 * One-line fix for whatever makes this provider unusable, most-blocking first:
 * no config file → no master switch → nothing detected → detected-but-not-
 * enabled → detected-and-enabled-but-no-transport. `null` when it works.
 */
function fixFor(o: {
    provider: string;
    detected: boolean;
    available: boolean;
    configuredMode: string | null;
    enabledInConfig: boolean;
    councilEnabled: boolean;
    configPresent: boolean;
    configPath: string;
    reason: string | null;
}): string | null {
    if (!o.configPresent) {
        return (
            `no council config — copy \`agents/templates/.ai-council.yml.example\` ` +
            `to ${o.configPath}`
        );
    }
    if (!o.councilEnabled) {
        return `set \`enabled: true\` in ${o.configPath}`;
    }
    // A manual member needs neither a binary nor a key — the human is the
    // transport. Telling them to install a CLI would be advice for a transport
    // they explicitly opted out of.
    if (o.configuredMode === 'manual') {
        return o.enabledInConfig ? null : enableInstruction(o.provider, o.configPath);
    }
    if (!o.detected) {
        const bin = PROVIDER_CLI_META[o.provider]?.[0] ?? o.provider;
        return (
            `nothing detected — install the \`${bin}\` CLI and log in, or add an ` +
            `\`api_key_ref\` for ${o.provider}`
        );
    }
    if (!o.enabledInConfig) {
        // Detected but not permitted: the gap this report exists to surface.
        return enableInstruction(o.provider, o.configPath);
    }
    if (!o.available) {
        return o.reason;
    }
    return null;
}

// ── rendering ───────────────────────────────────────────────────────────

const GLYPH_OK = '✅';
const GLYPH_NO = '❌';
const GLYPH_WARN = '⚠️';

/** `detected · authenticated · source · billing · enabled` for one provider. */
export function renderProviderLine(row: ProviderRow, configPath: string): string {
    const parts = [
        `detected ${row.detected ? GLYPH_OK : GLYPH_NO}`,
        `authenticated ${row.authenticated ? GLYPH_OK : GLYPH_NO}`,
        `source ${row.authSource ?? '—'}`,
        `billing ${row.billing}`,
        `enabled-in-config ${row.enabledInConfig ? GLYPH_OK : GLYPH_NO}`,
    ];
    parts.push(`mode ${row.configuredMode ?? '—'}`);
    if (row.transport !== null) {
        parts.push(`auto→${row.transport}`);
    }
    if (row.cliCap !== null) {
        const used = row.cliUsed ?? 0;
        const glyph = used >= row.cliCap ? GLYPH_WARN : GLYPH_OK;
        parts.push(`cli-quota ${used}/${row.cliCap} ${glyph}`);
    }
    // A detected-but-unpermitted provider is the case the report exists for —
    // name the consent gap explicitly rather than leaving a bare ❌.
    if (row.detected && !row.enabledInConfig) {
        parts.push(`not allowed to spend — ${enableInstruction(row.provider, configPath)}`);
    }
    return `${row.provider}: ${parts.join(' · ')}`;
}

/**
 * The full detection section, as lines. Hosts + versions, the provider →
 * transport → billing table, budgets, and a reason + fix per unavailable
 * capability.
 */
export function renderDetectionLines(report: DetectionReport): string[] {
    const lines: string[] = ['detection:'];

    const installed = report.hosts.filter((h) => h.installed);
    lines.push(`  hosts: ${installed.length}/${report.hosts.length} installed`);
    for (const h of installed) {
        const version = h.version === null ? 'no binary' : h.version;
        lines.push(`    ${h.id}: ${version}${h.binary === null ? '' : ` (${h.binary})`}`);
    }

    lines.push(
        `  council config: ${report.council_config_present ? report.council_config_path : `absent (${report.council_config_path})`}` +
            `${report.council_config_present ? ` · enabled ${report.council_enabled ? GLYPH_OK : GLYPH_NO} · defaults.mode ${report.defaults_mode ?? '—'}` : ''}`,
    );

    lines.push('  providers:');
    for (const row of report.providers) {
        lines.push(`    ${renderProviderLine(row, report.council_config_path)}`);
        if (row.fix !== null) {
            lines.push(`      fix: ${row.fix}`);
        }
    }

    const caps = Object.entries(report.budgets.cli_call_budget);
    lines.push(
        `  budgets: cost_budget.max_total_usd ${report.budgets.cost_budget_max_total_usd ?? '—'}` +
            ` · cli_call_budget ${caps.length === 0 ? 'unset' : caps.map(([p, c]) => `${p}=${c}`).join(', ')}`,
    );
    return lines;
}

/**
 * The first-invocation spend disclosure — built from the SAME rows as the table
 * above, so the two can never disagree about which members spend money.
 *
 * Only enabled AND available members can spend, so only they appear. A member
 * that is detected but not enabled is named as explicitly excluded, because
 * "why is my provider not being consulted" is the question this answers.
 */
export function renderSpendDisclosure(report: DetectionReport): string {
    // Bucket by the CONFIGURED mode, not by what `auto` could reach: a member
    // pinned to `manual` makes no provider call regardless of what is installed,
    // and telling the user it will hit an API would be exactly the drift this
    // single-renderer design exists to prevent.
    const spending = report.providers.filter(
        (r) => r.enabledInConfig && (r.available || r.configuredMode === 'manual'),
    );
    const excludedTail = renderExcludedTail(report);
    if (spending.length === 0) {
        // The excluded list matters MOST here: "no call will be made" without it
        // leaves the obvious next question ("but my provider IS installed?")
        // unanswered.
        return (
            'council spend disclosure · no member is both enabled and available — ' +
            `no call will be made.${excludedTail}`
        );
    }
    const free = spending.filter((r) => r.configuredMode === 'manual');
    const billed = spending.filter((r) => r.configuredMode !== 'manual');
    const metered = billed.filter((r) => r.billing === 'per-token');
    const subscription = billed.filter((r) => r.billing === 'subscription');

    const segments: string[] = [];
    if (metered.length > 0) {
        segments.push(
            `${metered.length} metered (per-token): ` +
                metered.map((r) => `${r.provider}→${r.transport}`).join(', '),
        );
    }
    if (subscription.length > 0) {
        segments.push(
            `${subscription.length} on subscription quota: ` +
                subscription
                    .map(
                        (r) =>
                            `${r.provider}→${r.transport}` +
                            (r.cliCap === null ? '' : ` (${r.cliUsed ?? 0}/${r.cliCap} today)`),
                    )
                    .join(', '),
        );
    }
    if (free.length > 0) {
        segments.push(`${free.length} manual (no provider call): ${free.map((r) => r.provider).join(', ')}`);
    }

    return `council spend disclosure · ${segments.join(' · ')}${excludedTail}`;
}

/** The `detected but not allowed to spend` tail, or `''` when there is none. */
function renderExcludedTail(report: DetectionReport): string {
    const excluded = report.providers.filter((r) => r.detected && !r.enabledInConfig);
    if (excluded.length === 0) return '';
    return ` · detected but not allowed to spend: ${excluded.map((r) => r.provider).join(', ')}`;
}

/** The `--json` payload for the detection section. Stable field order. */
export function detectionJson(report: DetectionReport): Record<string, unknown> {
    return {
        schema_version: report.schema_version,
        council_config_path: report.council_config_path,
        council_config_present: report.council_config_present,
        council_enabled: report.council_enabled,
        defaults_mode: report.defaults_mode,
        hosts: report.hosts.map((h) => ({
            id: h.id,
            installed: h.installed,
            binary: h.binary,
            version: h.version,
        })),
        providers: report.providers.map((r) => ({
            provider: r.provider,
            detected: r.detected,
            authenticated: r.authenticated,
            auth_source: r.authSource,
            billing: r.billing,
            transport: r.transport,
            configured_mode: r.configuredMode,
            available: r.available,
            enabled_in_config: r.enabledInConfig,
            reason: r.reason,
            fix: r.fix,
            cli_cap: r.cliCap,
            cli_used: r.cliUsed,
        })),
        budgets: {
            cost_budget_max_total_usd: report.budgets.cost_budget_max_total_usd,
            cli_call_budget: report.budgets.cli_call_budget,
        },
        spend_disclosure: renderSpendDisclosure(report),
    };
}

/** Facts for a machine with no council config at all. */
export function absentCouncilFacts(configPath: string): CouncilFacts {
    return {
        configPath,
        configPresent: false,
        enabled: false,
        defaultsMode: null,
        members: {},
        cliCaps: {},
        costBudgetMaxUsd: null,
    };
}
