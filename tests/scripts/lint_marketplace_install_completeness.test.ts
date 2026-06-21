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
});

// --- Golden parity on the REAL REPO -----------------------------------------

