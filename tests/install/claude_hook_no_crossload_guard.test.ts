// 4.2 — a cross-load environment guard is emitted only for a host where a
// second firing was OBSERVED.
//
// That set is empty today, so the emitted command string carries no guard
// clause. This test states the absence as a decision: the sibling suite freezes
// the whole command and would catch an added guard, but as an accidental break
// rather than as a violated finding. The measurement the decision rests on is
// the file `EVIDENCE` names, and the second case fails if it stops saying so.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { build_claude_hook_matrix } from '../../src/scripts/_lib/claude_settings_hooks.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const EVIDENCE = path.join(
    REPO_ROOT,
    'agents',
    'evidence',
    'analysis',
    'host-hook-crossload-2026-09-06.md',
);

/** Environment variables a guard would test to detect a foreign host. */
const FOREIGN_HOST_ENV_MARKERS = [
    'CURSOR_',
    'CLINE_',
    'WINDSURF_',
    'GEMINI_',
    'AUGMENT_',
    'CODEX_',
    'COPILOT_',
];

describe('claude hook command — cross-load guard', () => {
    it('emits no guard, because no host was observed double-firing', () => {
        const matrix = build_claude_hook_matrix(MANIFEST);
        expect(Object.keys(matrix).length).toBeGreaterThan(0);
        for (const [native, command] of Object.entries(matrix)) {
            for (const marker of FOREIGN_HOST_ENV_MARKERS) {
                expect(command, `${native} carries a guard on ${marker}`).not.toContain(marker);
            }
        }
    });

    it('keeps the observation the decision rests on', () => {
        // A guard-free command is only defensible while the measurement behind
        // it is readable. Deleting the evidence must break this, not just the
        // provenance of a sentence in a roadmap.
        const text = fs.readFileSync(EVIDENCE, 'utf8');
        expect(text).toContain('codex-cli 0.148.0');
        expect(text).toContain('That set is **empty**');
    });
});
