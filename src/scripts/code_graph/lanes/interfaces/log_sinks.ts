/**
 * Where a project's logs and error reports can go, as data: one row per sink,
 * the packages that bring it per ecosystem, the config keys that name it and
 * the env names that configure it. A sibling of `sdk_table.ts`; a new sink is a
 * new row. Names only — a reader of this table never reads an env value
 * (road-to-a-map-that-knows-what-happened L.1, kill row L-K1).
 *
 * `remote: false` marks a sink that stays on the machine. A finding that a
 * project logs only locally while a remote sink is present reads this flag.
 */
import type { SdkRow } from './sdk_table.js';

export type SinkKind = 'errors' | 'logs' | 'traces' | 'chat';

export interface SinkRow {
    sink: string;
    kinds: readonly SinkKind[];
    remote: boolean;
    packages: ReadonlyArray<{ ecosystem: SdkRow['ecosystem']; pkg: string }>;
    /** Env names; a trailing `*` matches a prefix. */
    env: readonly string[];
    /** Values a logging config may name the sink by (a Laravel channel driver, a Monolog handler). */
    config: readonly string[];
}

export const LOG_SINKS: readonly SinkRow[] = [
    {
        sink: 'sentry',
        kinds: ['errors', 'traces'],
        remote: true,
        packages: [
            { ecosystem: 'composer', pkg: 'sentry/sentry-laravel' },
            { ecosystem: 'composer', pkg: 'sentry/sentry-symfony' },
            { ecosystem: 'composer', pkg: 'sentry/sentry' },
            { ecosystem: 'npm', pkg: '@sentry/*' },
            { ecosystem: 'pypi', pkg: 'sentry-sdk' },
            { ecosystem: 'go', pkg: 'github.com/getsentry/sentry-go' },
        ],
        env: ['SENTRY_DSN', 'SENTRY_LARAVEL_DSN', 'SENTRY_ENVIRONMENT', 'SENTRY_TRACES_SAMPLE_RATE'],
        config: ['sentry'],
    },
    {
        sink: 'datadog',
        kinds: ['logs', 'traces', 'errors'],
        remote: true,
        packages: [
            { ecosystem: 'composer', pkg: 'datadog/dd-trace' },
            { ecosystem: 'npm', pkg: 'dd-trace' },
            { ecosystem: 'npm', pkg: '@datadog/*' },
            { ecosystem: 'pypi', pkg: 'ddtrace' },
            { ecosystem: 'go', pkg: 'gopkg.in/DataDog/dd-trace-go*' },
        ],
        env: ['DD_*'],
        config: ['datadog'],
    },
    {
        sink: 'newrelic',
        kinds: ['logs', 'traces', 'errors'],
        remote: true,
        packages: [
            { ecosystem: 'npm', pkg: 'newrelic' },
            { ecosystem: 'pypi', pkg: 'newrelic' },
            { ecosystem: 'go', pkg: 'github.com/newrelic/go-agent*' },
        ],
        env: ['NEW_RELIC_*'],
        config: ['newrelic'],
    },
    {
        sink: 'otel-collector',
        kinds: ['logs', 'traces'],
        remote: true,
        packages: [
            { ecosystem: 'composer', pkg: 'open-telemetry/*' },
            { ecosystem: 'npm', pkg: '@opentelemetry/*' },
            { ecosystem: 'pypi', pkg: 'opentelemetry-*' },
            { ecosystem: 'go', pkg: 'go.opentelemetry.io/otel*' },
        ],
        env: ['OTEL_*'],
        config: ['otlp'],
    },
    {
        sink: 'slack',
        kinds: ['chat'],
        remote: true,
        packages: [],
        env: ['LOG_SLACK_WEBHOOK_URL'],
        config: ['slack'],
    },
    {
        sink: 'loki',
        kinds: ['logs'],
        remote: true,
        packages: [{ ecosystem: 'npm', pkg: 'winston-loki' }, { ecosystem: 'pypi', pkg: 'python-logging-loki' }],
        env: ['LOKI_*'],
        config: ['loki'],
    },
    {
        sink: 'papertrail',
        kinds: ['logs'],
        remote: true,
        packages: [],
        env: ['PAPERTRAIL_URL', 'PAPERTRAIL_PORT'],
        config: ['papertrail'],
    },
    { sink: 'syslog', kinds: ['logs'], remote: false, packages: [], env: [], config: ['syslog', 'errorlog'] },
    { sink: 'stderr', kinds: ['logs'], remote: false, packages: [], env: [], config: ['stderr'] },
    { sink: 'file', kinds: ['logs'], remote: false, packages: [], env: [], config: ['single', 'daily', 'stream'] },
];

/** Env names a logging config uses to pick its route; they name no sink by themselves. */
export const LOG_ROUTE_ENV: readonly string[] = ['LOG_CHANNEL', 'LOG_STACK', 'LOG_LEVEL'];

export interface SinkWitness {
    kind: 'package' | 'env';
    /** `ecosystem:name` for a package, the env name for an env witness */
    ref: string;
}

export interface SinkFound {
    sink: string;
    remote: boolean;
    witnesses: SinkWitness[];
}

const matches = (pattern: string, name: string): boolean => (pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern);

/**
 * The sinks a project's declared packages and env names point at. Pure: the
 * caller reads manifests and env-name lists; nothing here touches the tree.
 */
export function sinksOf(packages: ReadonlyArray<{ ecosystem: SdkRow['ecosystem']; name: string }>, envNames: readonly string[]): SinkFound[] {
    const out: SinkFound[] = [];
    for (const row of LOG_SINKS) {
        const witnesses: SinkWitness[] = [];
        for (const p of packages) {
            if (row.packages.some((r) => r.ecosystem === p.ecosystem && matches(r.pkg, p.name))) witnesses.push({ kind: 'package', ref: `${p.ecosystem}:${p.name}` });
        }
        for (const e of envNames) if (row.env.some((r) => matches(r, e))) witnesses.push({ kind: 'env', ref: e });
        if (witnesses.length) out.push({ sink: row.sink, remote: row.remote, witnesses });
    }
    return out;
}
