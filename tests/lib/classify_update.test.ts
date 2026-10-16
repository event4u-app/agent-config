import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    type ClassifyUpdateInput,
    type UpdateAction,
    classifyUpdate,
    machine_override,
} from '../../src/scripts/_lib/classify_update';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, '..', '..', 'src', 'scripts', '_lib', 'classify_update.ts');

/** A fully known, clean, opted-in input: the one shape that may come out `auto`. */
const CLEAN: ClassifyUpdateInput = {
    installed: '16.5.0',
    candidate: '16.6.0',
    origin: 'global-only',
    env: {
        ci: false,
        interactive: true,
        noUpdateCheck: false,
        nodeVersion: 'v20.11.0',
        now: '2026-10-16T12:00:00Z',
    },
    impactMap: { '16.6.0': { impact: 'automatic' } },
    engines: { node: '>=20.11.0' },
    publishedAt: '2026-10-10T12:00:00Z',
    deprecated: null,
    provenance: true,
    settings: { mode: 'auto', projectPin: null, minReleaseAgeHours: 48 },
};

type Patch = {
    [K in keyof ClassifyUpdateInput]?: ClassifyUpdateInput[K] extends object | null
        ? Partial<NonNullable<ClassifyUpdateInput[K]>> | ClassifyUpdateInput[K]
        : ClassifyUpdateInput[K];
};

function input(patch: Patch = {}): ClassifyUpdateInput {
    const out = { ...CLEAN } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) {
        const base = (CLEAN as unknown as Record<string, unknown>)[k];
        const merge = (k === 'env' || k === 'settings') && v !== null && typeof v === 'object';
        out[k] = merge ? { ...(base as object), ...(v as object) } : v;
    }
    return out as unknown as ClassifyUpdateInput;
}

function deepFreeze<T>(o: T): T {
    if (o !== null && typeof o === 'object') {
        for (const v of Object.values(o as object)) deepFreeze(v);
        Object.freeze(o);
    }
    return o;
}

interface Case {
    readonly name: string;
    readonly patch: Patch;
    readonly expected: UpdateAction;
    /** The input carries an unknown, a missing provenance, a pin or an unmet engine. */
    readonly uncertain: boolean;
}

const MATRIX: readonly Case[] = [
    { name: 'clean automatic minor, mode auto', patch: {}, expected: 'auto', uncertain: false },
    { name: 'clean none-impact release (absent from map)', patch: { impactMap: {} }, expected: 'auto', uncertain: false },

    // The recorded majors from BREAKING_CHANGES.md:50-56 — five needed no action.
    ...(['10.0.0', '11.0.0', '13.0.0', '14.0.0', '16.0.0'] as const).map((v): Case => {
        const [major] = v.split('.');
        return {
            name: `recorded no-action major ${v}`,
            patch: {
                installed: `${Number(major) - 1}.9.0`,
                candidate: v,
                impactMap: v === '13.0.0' || v === '16.0.0' ? {} : { [v]: { impact: 'automatic' } },
            },
            expected: 'auto',
            uncertain: false,
        };
    }),
    // ...and two needed a hand.
    ...(['12.0.0', '15.0.0'] as const).map((v): Case => {
        const [major] = v.split('.');
        return {
            name: `recorded action major ${v}`,
            patch: { installed: `${Number(major) - 1}.9.0`, candidate: v, impactMap: { [v]: { impact: 'action' } } },
            expected: 'ask',
            uncertain: false,
        };
    }),
    {
        name: 'action two releases back inside the range',
        patch: {
            installed: '16.3.0',
            candidate: '16.6.0',
            impactMap: { '16.4.0': { impact: 'action' }, '16.6.0': { impact: 'automatic' } },
        },
        expected: 'ask',
        uncertain: false,
    },
    {
        name: 'action at the installed version is outside the range',
        patch: { impactMap: { '16.5.0': { impact: 'action' } } },
        expected: 'auto',
        uncertain: false,
    },
    {
        name: 'action above the candidate is outside the range',
        patch: { impactMap: { '16.7.0': { impact: 'action' } } },
        expected: 'auto',
        uncertain: false,
    },
    { name: 'notice in range', patch: { impactMap: { '16.6.0': { impact: 'notice' } } }, expected: 'notify', uncertain: false },
    {
        name: 'security fix in range, mode auto, otherwise clean',
        patch: { impactMap: { '16.6.0': { impact: 'automatic', security: true } } },
        expected: 'auto',
        uncertain: false,
    },
    {
        name: 'security fix in range, mode notify',
        patch: { impactMap: { '16.6.0': { impact: 'none', security: true } }, settings: { mode: 'notify' } },
        expected: 'notify',
        uncertain: false,
    },
    {
        name: 'security fix on a deprecated candidate still notifies',
        patch: { impactMap: { '16.6.0': { impact: 'automatic', security: true } }, deprecated: 'use 16.6.1' },
        expected: 'notify',
        uncertain: false,
    },
    {
        name: 'security fix with mode off',
        patch: { impactMap: { '16.6.0': { impact: 'automatic', security: true } }, settings: { mode: 'off' } },
        expected: 'none',
        uncertain: false,
    },

    { name: 'engines unmet: >=22 under Node 20', patch: { engines: { node: '>=22' } }, expected: 'ask', uncertain: true },
    {
        name: 'engines unmet beats an automatic map',
        patch: { engines: { node: '>=22' }, impactMap: { '16.6.0': { impact: 'none' } } },
        expected: 'ask',
        uncertain: true,
    },
    { name: 'engines unmet on a deprecated candidate', patch: { engines: { node: '>=22' }, deprecated: 'x' }, expected: 'ask', uncertain: true },
    { name: 'engines unmet with a project pin', patch: { engines: { node: '>=24' }, settings: { projectPin: '16.5.0' } }, expected: 'ask', uncertain: true },
    { name: 'engines range unparseable', patch: { engines: { node: 'banana' } }, expected: 'ask', uncertain: true },
    { name: 'runtime version unparseable', patch: { env: { nodeVersion: 'unknown' } }, expected: 'ask', uncertain: true },
    { name: 'engines block absent', patch: { engines: null }, expected: 'notify', uncertain: true },
    { name: 'engines.node absent', patch: { engines: {} }, expected: 'notify', uncertain: true },

    { name: 'impact map unreadable (disk full, null)', patch: { impactMap: null }, expected: 'notify', uncertain: true },
    { name: 'impact map absent (undefined)', patch: { impactMap: undefined }, expected: 'notify', uncertain: true },
    { name: 'forged map: not an object', patch: { impactMap: 'all fine' }, expected: 'ask', uncertain: true },
    { name: 'forged map: array', patch: { impactMap: [] }, expected: 'ask', uncertain: true },
    { name: 'forged map: unknown impact value', patch: { impactMap: { '16.6.0': { impact: 'trivial' } } }, expected: 'ask', uncertain: true },
    { name: 'forged map: invalid version key', patch: { impactMap: { 'not-a-version': { impact: 'none' } } }, expected: 'ask', uncertain: true },
    { name: 'forged map: entry not an object', patch: { impactMap: { '16.6.0': 'automatic' } }, expected: 'ask', uncertain: true },

    { name: 'provenance missing', patch: { provenance: false }, expected: 'notify', uncertain: true },
    { name: 'provenance unknown', patch: { provenance: null }, expected: 'notify', uncertain: true },
    { name: 'project pin present', patch: { settings: { projectPin: '16.5.0' } }, expected: 'notify', uncertain: true },
    { name: 'origin unknown', patch: { origin: 'unknown' }, expected: 'notify', uncertain: true },
    { name: 'candidate is a prerelease', patch: { candidate: '16.6.0-next.3', impactMap: {} }, expected: 'notify', uncertain: true },
    {
        name: 'prerelease installed, final candidate',
        patch: { installed: '16.6.0-next.3', impactMap: {} },
        expected: 'auto',
        uncertain: false,
    },
    { name: 'publishedAt missing with an age gate', patch: { publishedAt: null }, expected: 'notify', uncertain: true },
    { name: 'publishedAt unparseable', patch: { publishedAt: 'yesterday' }, expected: 'notify', uncertain: true },
    { name: 'mode not set', patch: { settings: { mode: undefined } }, expected: 'notify', uncertain: true },
    { name: 'mode ask caps auto', patch: { settings: { mode: 'ask' } }, expected: 'notify', uncertain: false },

    { name: 'inside the release-age gate → wait', patch: { publishedAt: '2026-10-15T12:00:00Z' }, expected: 'none', uncertain: false },
    { name: 'deprecated candidate → wait', patch: { deprecated: 'broken, use 16.6.1' }, expected: 'none', uncertain: false },
    { name: 'deprecated true → wait', patch: { deprecated: true }, expected: 'none', uncertain: false },

    { name: 'dist-tag drift: candidate older than installed', patch: { candidate: '16.4.0' }, expected: 'none', uncertain: false },
    { name: 'candidate equals installed', patch: { candidate: '16.5.0' }, expected: 'none', uncertain: false },
    { name: 'candidate unparseable', patch: { candidate: 'latest' }, expected: 'none', uncertain: true },
    { name: 'installed unparseable', patch: { installed: '' }, expected: 'none', uncertain: true },

    { name: 'CI', patch: { env: { ci: true } }, expected: 'none', uncertain: false },
    { name: 'non-interactive', patch: { env: { interactive: false } }, expected: 'none', uncertain: false },
    { name: 'source checkout', patch: { origin: 'source-checkout' }, expected: 'none', uncertain: false },
    { name: 'AGENT_CONFIG_NO_UPDATE_CHECK=1', patch: { env: { noUpdateCheck: true } }, expected: 'none', uncertain: false },
    { name: 'mode off', patch: { settings: { mode: 'off' } }, expected: 'none', uncertain: false },
    { name: 'CI suppresses even an unmet engine', patch: { env: { ci: true }, engines: { node: '>=22' } }, expected: 'none', uncertain: true },
];

describe('classifyUpdate — the rule matrix', () => {
    it('has at least 40 cases', () => {
        expect(MATRIX.length).toBeGreaterThanOrEqual(40);
    });

    it.each(MATRIX.map((c) => [c.name, c] as const))('%s', (_name, c) => {
        const verdict = classifyUpdate(input(c.patch));
        expect(verdict.action).toBe(c.expected);
        expect(verdict.reasons.length).toBeGreaterThan(0);
    });

    it('returns no auto verdict for any input that carries an uncertainty', () => {
        const autos = MATRIX.filter((c) => c.uncertain)
            .filter((c) => classifyUpdate(input(c.patch)).action === 'auto')
            .map((c) => c.name);
        expect(autos).toEqual([]);
    });

    it('asks for every input with an unsatisfied engines.node unless the check is suppressed or there is no update', () => {
        const noUpdateOrSuppressed = new Set([
            'CI',
            'non-interactive',
            'source checkout',
            'AGENT_CONFIG_NO_UPDATE_CHECK=1',
            'mode off',
            'security fix with mode off',
            'CI suppresses even an unmet engine',
            'dist-tag drift: candidate older than installed',
            'candidate equals installed',
            'candidate unparseable',
            'installed unparseable',
        ]);
        const wrong: string[] = [];
        for (const node of ['>=22', '>=24', '^22', '>=20.12.0']) {
            for (const c of MATRIX.filter((m) => !noUpdateOrSuppressed.has(m.name))) {
                const action = classifyUpdate(input({ ...c.patch, engines: { node } })).action;
                if (action !== 'ask') wrong.push(`${c.name} / ${node} → ${action}`);
            }
        }
        expect(wrong).toEqual([]);
    });
});

describe('machine_override — the local machine overrides the map', () => {
    it('makes the impact action for engines.node >=22 under Node 20', () => {
        expect(machine_override({ node: '>=22' }, 'v20.11.0').impact).toBe('action');
    });

    it('leaves the map in charge when the runtime satisfies the range', () => {
        expect(machine_override({ node: '>=20.11.0' }, 'v20.11.0')).toEqual({ impact: null, reason: null });
    });

    it('treats a range it cannot check as action and a missing range as an unknown', () => {
        expect(machine_override({ node: 'banana' }, 'v20.11.0').impact).toBe('action');
        expect(machine_override(null, 'v20.11.0')).toEqual({
            impact: null,
            reason: 'candidate declares no engines.node',
        });
    });
});

describe('classifyUpdate — purity', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('computes from a deeply frozen input with no network or process exit', () => {
        const fetchSpy = vi.fn(() => {
            throw new Error('network access');
        });
        vi.stubGlobal('fetch', fetchSpy);
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
            throw new Error('process exit');
        });
        const frozen = deepFreeze(input({ impactMap: { '16.6.0': { impact: 'action' } } }));
        expect(classifyUpdate(frozen)).toEqual(classifyUpdate(frozen));
        expect(classifyUpdate(frozen).action).toBe('ask');
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(exitSpy).not.toHaveBeenCalled();
    });

    it('imports no node builtin and reads no process state', () => {
        const src = fs.readFileSync(SOURCE, 'utf-8');
        expect(src).not.toMatch(/from ['"]node:/);
        expect(src).not.toMatch(/\bprocess\./);
        expect(src).not.toMatch(/\brequire\(/);
        expect(src).not.toMatch(/\bfetch\(/);
    });
});
