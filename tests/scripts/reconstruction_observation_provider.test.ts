// road-to-an-observation-provider-slot 1.1–1.3 and 2.1 — the provider slot and
// a ledger row that closes on a provider observation.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    OBSERVATION_KINDS,
    PROVIDER_VERIFIABLE_TIERS,
    evaluateLedger,
    parseObservationProviders,
    type Obligation,
} from '../../src/scripts/_lib/reconstruction_ledger.js';
import { main } from '../../src/scripts/reconstruction_ledger.js';
import { settingsSchema } from '../../src/server/schemas/settings.js';

const slot = settingsSchema.shape.reconstruction;

function behaviorRow(over: Partial<Obligation> = {}): Obligation {
    return {
        id: 'b1',
        behavior: 'tapping save on an empty form shows "title required"',
        tier: 'behavior',
        required_cases: ['empty-title'],
        evidence: { 'empty-title': ['OBS-1'] },
        verifier: 'provider:device-driver',
        verifier_authority: 'controlled-replay',
        status: 'verified',
        ...over,
    };
}

describe('2.1 a ledger row closes on provider evidence', () => {
    it('moves open → verified and the verdict open → closed only with the recorded observation', () => {
        const open = behaviorRow({ status: 'open', evidence: { 'empty-title': [] } });
        const without = evaluateLedger([open], { evidenceIds: new Set() });
        expect(without.state).toBe('open');
        expect(without.verified).toBe(0);

        const withObs = evaluateLedger([behaviorRow()], { evidenceIds: new Set(['OBS-1']) });
        expect(withObs).toMatchObject({ state: 'closed', verified: 1, counted: 1, errors: [] });
    });

    it('reads invalid when the row cites an observation id the run never recorded', () => {
        const verdict = evaluateLedger([behaviorRow({ evidence: { 'empty-title': ['OBS-9'] } })], { evidenceIds: new Set(['OBS-1']) });
        expect(verdict.state).toBe('invalid');
        expect(verdict.errors.join('\n')).toMatch(/unknown evidence id OBS-9/);
    });

    it('refuses a provider name written as the authority', () => {
        const verdict = evaluateLedger([behaviorRow({ verifier_authority: 'device-driver' as Obligation['verifier_authority'] })], {
            evidenceIds: new Set(['OBS-1']),
        });
        expect(verdict.state).toBe('invalid');
        expect(verdict.errors.join('\n')).toMatch(/unknown verifier_authority device-driver/);
    });

    it('lets a provider verify ux, behavior and protocol, and refuses byte and inspired-by', () => {
        expect(PROVIDER_VERIFIABLE_TIERS).toEqual(['ux', 'behavior', 'protocol']);
        const ctx = { evidenceIds: new Set(['OBS-1']) };
        for (const tier of ['ux', 'behavior', 'protocol'] as const) {
            expect(evaluateLedger([behaviorRow({ tier })], ctx).state).toBe('closed');
        }
        for (const tier of ['byte', 'inspired-by'] as const) {
            const v = evaluateLedger([behaviorRow({ tier })], ctx);
            expect(v.state).toBe('invalid');
            expect(v.errors.join('\n')).toMatch(new RegExp(`cannot verify tier ${tier}`));
        }
        // A byte row checked by a non-provider verifier is unaffected.
        expect(evaluateLedger([behaviorRow({ tier: 'byte', verifier: 'cmp out.bin ref.bin' })], ctx).state).toBe('closed');
    });

    it('never lifts a visible-only row: a provider screenshot leaves the ledger open with parity 0', () => {
        const v = evaluateLedger([behaviorRow({ status: 'visible-only' })], { evidenceIds: new Set(['OBS-1']) });
        expect(v).toMatchObject({ state: 'open', verified: 0, parity: 0 });
    });
});

describe('1.1 the slot', () => {
    it('defaults to empty in the schema and the template', () => {
        expect(slot.parse(undefined).observation_providers).toEqual([]);
        const template = fs.readFileSync(path.join(__dirname, '../../src/config/agent-settings.template.yml'), 'utf-8');
        expect(template).toMatch(/^reconstruction:\n {2}observation_providers: \[\]$/m);
    });

    it('keeps the schema enum and the ledger kinds in step', () => {
        const parsed = slot.parse({ observation_providers: [{ server: 's', kinds: [...OBSERVATION_KINDS] }] });
        expect(parsed.observation_providers[0]?.kinds).toEqual([...OBSERVATION_KINDS]);
        expect(() => slot.parse({ observation_providers: [{ server: 's', kinds: ['radio'] }] })).toThrow();
    });

    it('parses entries and names every malformed one instead of dropping it', () => {
        expect(parseObservationProviders(undefined)).toEqual({ providers: [], errors: [] });
        expect(parseObservationProviders([{ server: 'rev-mcp', kinds: ['binary'] }]).providers).toEqual([{ server: 'rev-mcp', kinds: ['binary'] }]);
        const bad = parseObservationProviders([{ server: '', kinds: ['runtime'] }, { server: 'x', kinds: [] }, { server: 'y', kinds: ['radio'] }]);
        expect(bad.providers).toEqual([]);
        expect(bad.errors).toHaveLength(3);
        expect(parseObservationProviders('rev-mcp').errors).toHaveLength(1);
    });
});

describe('1.2 / 1.3 reading the slot, absence as a stated result', () => {
    let dir: string;
    let out: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'obs-slot-'));
        out = '';
        const capture = (chunk: string | Uint8Array): boolean => {
            out += String(chunk);
            return true;
        };
        vi.spyOn(process.stdout, 'write').mockImplementation(capture);
        vi.spyOn(process.stderr, 'write').mockImplementation(capture);
    });
    afterEach(() => {
        vi.restoreAllMocks();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('says coverage: unknown and exits 0 with no provider configured', () => {
        expect(main(['--providers', '--root', dir])).toBe(0);
        expect(out).toMatch(/runtime evidence unavailable .*coverage: unknown/);
    });

    it('lists a configured provider from the project settings', () => {
        fs.writeFileSync(
            path.join(dir, '.agent-settings.yml'),
            'reconstruction:\n  observation_providers:\n    - server: device-driver\n      kinds: [device, runtime]\n',
        );
        expect(main(['--providers', '--root', dir])).toBe(0);
        expect(out).toMatch(/provider device-driver · device, runtime/);
        expect(out).not.toMatch(/coverage: unknown/);
    });

    it('exits 2 on a malformed slot rather than reading it as empty', () => {
        fs.writeFileSync(path.join(dir, '.agent-settings.yml'), 'reconstruction:\n  observation_providers:\n    - server: x\n');
        expect(main(['--providers', '--root', dir])).toBe(2);
        expect(out).toMatch(/kinds/);
    });
});
