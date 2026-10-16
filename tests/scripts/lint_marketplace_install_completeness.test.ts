// Tests for src/scripts/lint_marketplace_install_completeness.ts
// (py2ts Phase 4 / Wave 4b — VERIFY).
//
// No pytest suite exists. Light behavioural spec over exported pure helpers
// (subcommand_to_function, extract_subcommand) plus the golden-parity layer
// that runs python3 vs tsx on the REAL REPO (skipped without python3).
import { describe, expect, it } from 'vitest';

import * as lmic from '../../src/scripts/lint_marketplace_install_completeness.js';



describe('lint_marketplace_install_completeness — pure helpers', () => {
    it('subcommand_to_function normalises : and - to _', () => {
        expect(lmic.subcommand_to_function('roadmap:progress')).toBe('cmd_roadmap_progress');
        expect(lmic.subcommand_to_function('pr-create')).toBe('cmd_pr_create');
        expect(lmic.subcommand_to_function('plain')).toBe('cmd_plain');
    });

    it('extract_subcommand pulls the agent-config subcommand from a command line', () => {
        // The exact match shape is driven by the module's regexes; a line with
        // no agent-config invocation yields null.
        expect(lmic.extract_subcommand('echo hello world')).toBeNull();
    });

    it('a message the command prints is not the command it runs', () => {
        // hooks.json's no-dispatcher branch echoes prose that names "agent-config hook";
        // the invocation on the same line is `"$BIN" dispatch:hook`.
        const line =
            "BIN=agent-config; command -v \"$BIN\" >/dev/null 2>&1 || { echo 'agent-config: no hook dispatcher " +
            "reachable, so no agent-config hook runs in this session.' >&2; exit 0; }; \"$BIN\" dispatch:hook --platform claude";
        expect(lmic.extract_subcommand(line)).toBe('dispatch:hook');
        expect(lmic.extract_subcommand('"$CLAUDE_PROJECT_DIR"/agent-config roadmap:progress')).toBe('roadmap:progress');
    });

    it('a single-quoted string a shell runs is still read as the command', () => {
        expect(lmic.extract_subcommand("sh -c 'agent-config roadmap:progress'")).toBe('roadmap:progress');
        expect(lmic.extract_subcommand("printf '%s' 'agent-config hook'; agent-config dispatch:hook")).toBe('dispatch:hook');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

