import { describe, expect, it } from 'vitest';

import { LOG_ROUTE_ENV, LOG_SINKS, sinksOf } from '../../src/scripts/code_graph/lanes/interfaces/log_sinks.js';

// road-to-a-map-that-knows-what-happened L.1 — the sink catalogue as data.

describe('the log sink catalogue', () => {
    it('holds each sink once, with at least one way to find it', () => {
        const names = LOG_SINKS.map((r) => r.sink);
        expect(new Set(names).size).toBe(names.length);
        for (const r of LOG_SINKS) expect(r.packages.length + r.env.length + r.config.length, r.sink).toBeGreaterThan(0);
    });

    it('marks only the on-machine sinks as local', () => {
        expect(LOG_SINKS.filter((r) => !r.remote).map((r) => r.sink).sort()).toEqual(['file', 'stderr', 'syslog']);
    });

    it('lists only env names, never a value shape', () => {
        for (const r of LOG_SINKS) for (const e of r.env) expect(e, r.sink).toMatch(/^[A-Z][A-Z0-9_]*\*?$/);
        expect(LOG_ROUTE_ENV).toEqual(['LOG_CHANNEL', 'LOG_STACK', 'LOG_LEVEL']);
    });
});

describe('sinksOf', () => {
    it('finds one Sentry sink with two witnesses for sentry-laravel plus SENTRY_DSN', () => {
        const got = sinksOf([{ ecosystem: 'composer', name: 'sentry/sentry-laravel' }], ['SENTRY_DSN', 'APP_KEY']);
        expect(got).toEqual([
            {
                sink: 'sentry',
                remote: true,
                witnesses: [
                    { kind: 'package', ref: 'composer:sentry/sentry-laravel' },
                    { kind: 'env', ref: 'SENTRY_DSN' },
                ],
            },
        ]);
    });

    it('matches prefix rows and keeps sinks apart', () => {
        const got = sinksOf([{ ecosystem: 'npm', name: '@opentelemetry/sdk-node' }, { ecosystem: 'npm', name: 'dd-trace' }], ['DD_SERVICE', 'OTEL_EXPORTER_OTLP_ENDPOINT']);
        expect(got.map((s) => [s.sink, s.witnesses.length])).toEqual([
            ['datadog', 2],
            ['otel-collector', 2],
        ]);
    });

    it('finds nothing for unrelated packages and env names, and no sink from a route name alone', () => {
        expect(sinksOf([{ ecosystem: 'npm', name: 'left-pad' }], ['LOG_CHANNEL', 'APP_ENV'])).toEqual([]);
    });

    it('does not let an ecosystem match another ecosystem’s package', () => {
        expect(sinksOf([{ ecosystem: 'pypi', name: 'dd-trace' }], [])).toEqual([]);
    });
});
