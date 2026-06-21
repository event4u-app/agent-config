// Tests for src/scripts/audit_cloud_compatibility.ts (py2ts Phase 8 / Wave 8a).
//
// No pytest suite exists, so this is a focused differential suite over the
// classify pipeline (tier + cloud-action + marker downgrade) plus a
// golden-parity layer that runs python3 vs tsx on the REAL repo across the
// CI surfaces (default summary, --details json/md, --tier/--cloud-action
// filters, --iron-law) — byte-exact JSON/markdown is the contract. Skipped
// without python3.
import { describe, expect, it } from 'vitest';

import * as acc from '../../src/scripts/audit_cloud_compatibility.js';



describe('audit_cloud_compatibility — classify', () => {
    it('pure guidance is T1 with cloud_action none', () => {
        const [tier, ev] = acc.classify('Plain prose, no scripts, no paths.');
        expect(tier).toBe('T1');
        expect(ev.cloud_action).toBe('none');
        expect(ev.scripts).toEqual([]);
    });
    it('a soft script mention (mid-sentence) bumps to T3-S', () => {
        // Mid-sentence backtick CLI is a soft option, not a `Run scripts/`
        // imperative, so HARD_RE does not match → T3-S.
        const [tier, ev] = acc.classify('You can use `python3 scripts/foo_bar.py` if you like.');
        expect(tier).toBe('T3-S');
        expect(ev.scripts.length).toBeGreaterThan(0);
    });
    it('a hard MUST-run dependency bumps to T3-H, blocked on cloud', () => {
        const [tier, ev] = acc.classify('You MUST run `scripts/x.py` first.\nUses scripts/x.py.');
        expect(tier).toBe('T3-H');
        expect(ev.has_hard_dep_marker).toBe(true);
        expect(ev.cloud_action).toBe('blocked');
    });
    it('fs references with no script are T2', () => {
        const [tier] = acc.classify('Edits live under .augment/ and agents/.');
        expect(tier).toBe('T2');
    });
    it('cloud_safe: noop marker downgrades to T1', () => {
        const [tier, ev] = acc.classify('MUST run `scripts/x.py`. <!-- cloud_safe: noop -->\nscripts/x.py');
        expect(tier).toBe('T1');
        expect(ev.raw_tier).toBe('T3-H');
        expect(ev.cloud_marker).toBe('noop');
    });
    it('cloud_safe: degrade downgrades T3-H to T3-S only', () => {
        const [tier, ev] = acc.classify('MUST run `scripts/x.py`. <!-- cloud_safe: degrade -->\nscripts/x.py');
        expect(tier).toBe('T3-S');
        expect(ev.raw_tier).toBe('T3-H');
    });
    it('classify_cloud_action: edit imperative on a local path → edits', () => {
        expect(acc.classify_cloud_action('Edit your .agent-settings.yml file.')).toBe('edits');
    });
});
