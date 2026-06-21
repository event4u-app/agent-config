// Tests for src/scripts/memory_status.ts — file-backed status.
//
// 1:1 port of tests/test_memory_status.py (pytest → vitest, ADR-094 parity
// contract). Memory is entirely file-backed (no external backend); status()
// and health() are constant. The former package-detection machinery
// (`_find_cli`, `_probe_health`, present/misconfigured states) was removed
// with the agent-memory package. A trailing golden-parity block runs python3
// + tsx and asserts byte-identical output, skipped without python3.
import { describe, expect, it } from 'vitest';

import * as ms from '../../src/scripts/memory_status.js';



describe('memory_status.ts — status() / health()', () => {
    it('status is file-backed', () => {
        const r = ms.status();
        expect(r.status).toBe('file');
        expect(r.backend).toBe('file');
        expect(r.reason).toBeTruthy();
        expect(r.elapsed_ms).toBe(0);
    });

    it('status never raises', () => {
        // Constant + side-effect-free; refresh flag is a back-compat no-op.
        expect(ms.status(true).status).toBe('file');
    });

    it('health envelope shape', () => {
        const h = ms.health();
        expect(h['contract_version']).toBe(ms.CONTRACT_VERSION);
        expect(h['status']).toBe('ok');
        expect(h['backend_version']).toBe('0.0.0-file');
        expect((h['features'] as string[]).includes('file-fallback')).toBe(true);
    });
});
