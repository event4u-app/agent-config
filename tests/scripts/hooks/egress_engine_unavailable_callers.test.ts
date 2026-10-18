/**
 * The two bundled callers outside the stage, with the egress engine
 * unavailable: the subagent capsule rejects an envelope it cannot scan, and the
 * replay preview says the engine did not load rather than reporting zero
 * findings (council round 3, 2026-10-18).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/scripts/hooks/egress_engine_loader.js', () => ({
    loadEgressEngine: () => ({ ok: false, reason: 'missing' }),
}));

const { scanEnvelopeSecrets } = await import('../../../src/scripts/_lib/subagent_capsule.js');
const { _egressPreview } = await import('../../../src/scripts/hooks/replay_hook.js');

describe('an unavailable engine outside the stage', () => {
    it('the capsule rejects the envelope instead of passing it unscanned', () => {
        const errors = scanEnvelopeSecrets({ next_task: 'write the report' });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('credential scan unavailable (missing)');
    });

    it('the replay preview reports the engine as unavailable, never as zero findings', () => {
        const preview = _egressPreview({ tool_input: { command: 'echo hello' } });
        expect(preview.counts).toEqual([]);
        expect(preview.refused.map((r) => r.rule)).toEqual(['engine-unavailable']);
    });
});
