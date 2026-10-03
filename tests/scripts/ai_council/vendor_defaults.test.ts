// `ai_council/vendor_defaults.ts` — the import edge that must stay broken.
//
// WHAT THIS GUARDS, and why a source-level assertion is the right shape for it.
// `config.ts` needs exactly one string from the council transport layer. While
// it took that string from `clients.js`, every hook dispatch on every slot
// carried `clients.ts` and its closure — measured at **51,523 bytes** of the
// composed `dist/hooks/dispatch.js` on 2026-10-02, against a bundle that stood
// 75 bytes under its ceiling. The bytes are checked by
// `check_hook_bundle_composition`, which builds the bundle and measures it; a
// byte count cannot say WHICH edge re-appeared. This test names the edge, so a
// re-added import fails with the reason rather than with a number.
//
// The second case is the one that makes the first safe: the split is only
// correct while both spellings resolve to the same value, because every
// existing importer still reads `clients.js`.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { OPENAI_CLI_VENDOR_DEFAULT as VIA_CLIENTS } from '../../../src/scripts/ai_council/clients.js';
import { OPENAI_CLI_VENDOR_DEFAULT as VIA_VENDOR } from '../../../src/scripts/ai_council/vendor_defaults.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function read(rel: string): string {
    return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
}

describe('ai_council/vendor_defaults — the hook-bundle import edge', () => {
    it('config.ts takes the sentinel from vendor_defaults, never from clients', () => {
        const src = read('src/scripts/ai_council/config.ts');
        expect(src).toContain("from './vendor_defaults.js'");
        // The whole point: no import edge from the configuration reader to the
        // transport layer. `council-availability` reaches `config.ts` on
        // `session_start`, so this edge is paid by every hook dispatch.
        expect(src).not.toMatch(/import[^;]*from '\.\/clients\.js'/);
    });

    it('vendor_defaults imports nothing — a module that gains one stops being the cheap half', () => {
        const src = read('src/scripts/ai_council/vendor_defaults.ts');
        expect(src).not.toMatch(/^\s*import\s/m);
    });

    it('clients.ts still re-exports the sentinel, so existing importers resolve', () => {
        expect(VIA_CLIENTS).toBe(VIA_VENDOR);
        expect(VIA_VENDOR).toBe('codex-default');
    });
});
