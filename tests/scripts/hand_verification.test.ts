import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { askOnce } from '../../src/scripts/ask_transport.js';
import { CouncilResponse, type ExternalAIClient } from '../../src/scripts/ai_council/clients.js';
import { buildOrchestrationLine } from '../../src/scripts/_lib/orchestration_record.js';
import { main as recordMain } from '../../src/scripts/orchestration_record.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hand-verify-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
});

const BASE = { spawn_count: 0, token_delta: 0, route_taken: 'ask' as const, ts: '2026-10-22T10:00:00.000Z', id: 'hv-1' };

function orch(input: Parameters<typeof buildOrchestrationLine>[0]): Record<string, unknown> {
    const { line, errors } = buildOrchestrationLine(input);
    expect(errors).toEqual([]);
    return line!['orchestration'] as Record<string, unknown>;
}

describe('the orchestration line carries the head’s verification of a hand', () => {
    it('rejects an unpaid-route line without verified', () => {
        for (const route_billing of ['free-quota', 'self-hosted'] as const) {
            const { line, errors } = buildOrchestrationLine({ ...BASE, route_billing });
            expect(line).toBeNull();
            expect(errors.join(' ')).toMatch(/verified/);
        }
    });

    it('a paid-route line may omit verified', () => {
        expect(buildOrchestrationLine({ ...BASE, route_billing: 'subscription' }).errors).toEqual([]);
    });

    it('carries route_billing, verified and the head’s verification tokens', () => {
        const o = orch({ ...BASE, route_billing: 'free-quota', verified: 'pass', verify_tokens: 320 });
        expect(o).toMatchObject({ route_billing: 'free-quota', verified: 'pass', verify_tokens: 320, counts_as_escalation: false });
    });

    it('a skipped verify on an unpaid return counts as an escalation; on a paid one it does not', () => {
        expect(orch({ ...BASE, route_billing: 'free-quota', verified: 'skipped' })['counts_as_escalation']).toBe(true);
        expect(orch({ ...BASE, route_billing: 'per-token', verified: 'skipped' })['counts_as_escalation']).toBe(false);
        expect(orch({ ...BASE })['counts_as_escalation']).toBeNull();
    });

    it('rejects values outside the enums and a negative token count', () => {
        expect(buildOrchestrationLine({ ...BASE, route_billing: 'gratis' as never, verified: 'pass' }).errors.join(' ')).toMatch(/route_billing/);
        expect(buildOrchestrationLine({ ...BASE, route_billing: 'free-quota', verified: 'maybe' as never }).errors.join(' ')).toMatch(/verified/);
        expect(
            buildOrchestrationLine({ ...BASE, route_billing: 'free-quota', verified: 'pass', verify_tokens: -1 }).errors.join(' '),
        ).toMatch(/verify_tokens/);
    });
});

function freeMember(text: string): ExternalAIClient {
    return {
        name: 'free1',
        billing_class: 'free-quota',
        ask: () => new CouncilResponse({ provider: 'free1', model: 'm', text, input_tokens: 3, output_tokens: 2 }),
    } as unknown as ExternalAIClient;
}

function lines(dir: string): Array<Record<string, unknown>> {
    return fs
        .readdirSync(dir)
        .flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n'))
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('askOnce records a hand as unverified until the head says otherwise', () => {
    it('a parsed free return is untrusted, recorded skipped, and carries the work id to verify under', async () => {
        const dir = path.join(tmp, 'a');
        const r = await askOnce('q', {
            members: [freeMember('{"summary":"s"}')],
            kind: 'summarise-given-text',
            contentClass: 'public-artifact',
            auditDir: dir,
            id: () => 'ask-1',
        });
        expect(r!.untrusted).toBe(true);
        const [l] = lines(dir);
        expect(l!['work_id']).toBe(r!.work_id);
        expect(l!['orchestration']).toMatchObject({ route_billing: 'free-quota', verified: 'skipped', counts_as_escalation: true });
    });

    it('a schema-invalid free return is recorded as a failed verify', async () => {
        const dir = path.join(tmp, 'b');
        await askOnce('q', { members: [freeMember('prose')], kind: 'classify', contentClass: 'public-artifact', auditDir: dir });
        expect(lines(dir)[0]!['orchestration']).toMatchObject({ verified: 'fail', schema_valid: false });
    });
});

describe('orchestration_record CLI records the head’s verdict', () => {
    it('accepts the verify flags and refuses an unpaid line without --verified', () => {
        const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        const common = ['--spawn-count', '0', '--token-delta', '0', '--route-taken', 'ask', '--route-billing', 'free-quota', '--dry-run'];
        expect(recordMain([...common, '--verified', 'pass', '--verify-tokens', '120', '--hand-kind', 'classify'])).toBe(0);
        const line = JSON.parse(String(out.mock.calls[0]![0])) as Record<string, unknown>;
        expect(line['orchestration']).toMatchObject({ verified: 'pass', verify_tokens: 120, hand_kind: 'classify' });
        expect(recordMain(common)).toBe(1);
    });
});
