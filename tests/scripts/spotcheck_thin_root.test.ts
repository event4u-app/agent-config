// Focused structural test for spotcheck_thin_root (py2ts Phase 8 / Wave 8h).
//
// This script's entire `main()` is a LIVE AI-council call (Anthropic Sonnet
// 4.5 + OpenAI gpt-4o) that needs API keys + network and produces a
// non-deterministic report (per-call latency / token counts). It therefore
// has NO golden-parity path and CANNOT run inside CI. The live consult is
// delegated to a `python3` shim importing the still-Python `ai_council.clients`
// / `ai_council.orchestrator` modules (no TS twin in this wave; a `.ts` cannot
// import a `.py`) — see
// `docs/migration/divergences/src-scripts-spotcheck_thin_root.md`.
//
// What we CAN assert deterministically: the module imports without a
// top-level throw and exposes the `main` entry point (the CLI contract
// surface). The artefact assembly + `json.dumps(indent=2)` writer are
// exercised by the live path only.
import { describe, expect, it } from 'vitest';

describe('spotcheck_thin_root — structural', () => {
    it('imports cleanly and exposes main()', async () => {
        const mod = await import('../../src/scripts/spotcheck_thin_root.js');
        expect(typeof mod.main).toBe('function');
    });
});
