/**
 * B8 — structural + consistency test for the recorded proof-page demo.
 *
 * Asserts the demo script, the committed GIF, and the proof-page embed all
 * exist and agree: every `task …` command the demo records is also in the
 * proof page's "verify it yourself" block, so the recording can't show a
 * command the page doesn't tell a skeptic to run. (The runtime falsifiability
 * lock — the commands still pass — is .github/workflows/proof-demo.yml.)
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = join(fileURLToPath(import.meta.url), '..', '..', '..');
const DEMO = join(REPO, 'internal', 'demo', 'proof-demo-commands.sh');
const GIF = join(REPO, 'docs', 'media', 'proof-demo.gif');
const PROOF = join(REPO, 'docs', 'proof.md');

describe('proof demo (B8)', () => {
    it('the demo script exists and is a bash script', () => {
        expect(readFileSync(DEMO, 'utf8').startsWith('#!/usr/bin/env bash')).toBe(true);
    });

    it('the committed GIF exists and is non-empty', () => {
        expect(statSync(GIF).size).toBeGreaterThan(0);
    });

    it('the proof page embeds the demo GIF', () => {
        expect(readFileSync(PROOF, 'utf8')).toContain('](media/proof-demo.gif)');
    });

    it('every demo `task …` command also appears in the proof page verify block', () => {
        const demo = readFileSync(DEMO, 'utf8');
        const proof = readFileSync(PROOF, 'utf8');
        // Only the real step invocations (`step "…label…" task <name>`), not
        // `task …` mentions in the header comment.
        const cmds = [...demo.matchAll(/^step "[^"]*" (task [a-z-]+)/gm)].map((m) => m[1] as string);
        expect(cmds.length).toBeGreaterThanOrEqual(4);
        for (const c of new Set(cmds)) {
            expect(proof).toContain(c);
        }
    });
});
