// Tests for src/scripts/lint_agents_layout.ts (py2ts Phase 4 / Wave 4b — VERIFY).
//
// Layer 1: tests/test_lint_agents_layout.py ported 1:1 over the pure helpers
//   (find_violations, find_consumer_warnings, is_source_repo, the two
//   frozen-set constants) plus the real-repo regression.
// Layer 2: CLI golden parity python3 vs tsx on the REAL REPO (default,
//   --quiet, --strict, --strict --quiet). The Python derives ROOT from
//   __file__ (no --root flag); both run with cwd=REPO_ROOT.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/lint_agents_layout.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


function seed(root: string, names: string[]): void {
    fs.mkdirSync(root, { recursive: true });
    for (const name of names) {
        fs.writeFileSync(path.join(root, name), 'x\n', 'utf-8');
    }
}

describe('lint_agents_layout — ported pytest suite (helpers)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agl-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('test_allowed_only_passes', () => {
        const agents = path.join(tmp, 'agents');
        seed(agents, [...mod.ALLOWED_FLAT_FILES].sort());
        expect(mod.find_violations(agents)).toEqual([]);
    });

    it('test_unknown_file_fails', () => {
        const agents = path.join(tmp, 'agents');
        seed(agents, ['scratch.txt']);
        const unknown = mod.find_violations(agents);
        expect(unknown.length).toBe(1);
        expect(unknown[0]).toContain('scratch.txt');
        expect(unknown[0]).toContain('not in agents/ whitelist');
    });

    it('test_chat_history_at_agents_root_is_unknown', () => {
        const agents = path.join(tmp, 'agents');
        seed(agents, ['.agent-chat-history']);
        const unknown = mod.find_violations(agents);
        expect(unknown.length).toBe(1);
        expect(unknown[0]).toContain('.agent-chat-history');
    });

    it('test_mixed_allowed_and_unknown', () => {
        const agents = path.join(tmp, 'agents');
        seed(agents, [
            'index.md',
            'roadmaps-progress.md',
            '.agent-chat-history',
            '.augment-budget-history.jsonl',
            'rogue.md',
        ]);
        const unknown = mod.find_violations(agents);
        expect(unknown.length).toBe(3);
        const flat = unknown.join('\n');
        expect(flat).toContain('rogue.md');
        expect(flat).toContain('.agent-chat-history');
        expect(flat).toContain('.augment-budget-history.jsonl');
    });

    it('test_subdirectories_ignored', () => {
        const agents = path.join(tmp, 'agents');
        const sub = path.join(agents, 'runtime');
        fs.mkdirSync(sub, { recursive: true });
        fs.writeFileSync(path.join(sub, 'anything.txt'), 'x\n', 'utf-8');
        expect(mod.find_violations(agents)).toEqual([]);
    });

    it('test_missing_root_is_silent', () => {
        expect(mod.find_violations(path.join(tmp, 'does-not-exist'))).toEqual([]);
    });

    it('test_bridge_marker_is_allowed_flat_file', () => {
        expect(mod.ALLOWED_FLAT_FILES.has('.event4u-bridge.yml')).toBe(true);
    });

    it('test_consumer_expected_entries_contract_set', () => {
        // Full consumer-scope allowlist per docs/contracts/agents-layout.md
        // (road-to-agents-dir-and-gitignore-hygiene Phase 2.4).
        expect(new Set(mod.CONSUMER_EXPECTED_ENTRIES)).toEqual(
            new Set([
                'overrides',
                '.event4u-bridge.yml',
                '.gitkeep',
                'knowledge',
                'memory',
                // Consumer-scoped because the drafting skill runs consumer-side:
                // learning-to-rule-or-skill writes agents/proposals/<id>.md there
                // and upstream-contribute opens the PR from it. Without the entry
                // a consumer proposals/ warns as a legacy artefact.
                'proposals',
                'roadmaps',
                'tmp',
                'tmp.old',
                'index.md',
                'roadmaps-progress.md',
                '.agent-tools.yml',
                '.maintainer-workspace.md',
            ]),
        );
    });

    it('test_source_repo_unknown_dir_is_violation', () => {
        // Phase 2.3 — unknown top-level dirs are errors in source-repo mode.
        const agents = path.join(tmp, 'agents');
        fs.mkdirSync(path.join(agents, 'random-new-dir'), { recursive: true });
        const violations = mod.find_violations(agents, true);
        expect(violations.length).toBe(1);
        expect(violations[0]).toContain('random-new-dir');
        expect(violations[0]).toContain('ALLOWED_SOURCE_DIRS');
    });

    it('test_source_repo_known_dir_is_clean', () => {
        const agents = path.join(tmp, 'agents');
        fs.mkdirSync(path.join(agents, 'evidence'), { recursive: true });
        fs.mkdirSync(path.join(agents, 'tmp.old'), { recursive: true });
        expect(mod.find_violations(agents, true)).toEqual([]);
    });

    it('test_consumer_mode_unknown_dir_not_error', () => {
        // In consumer mode (sourceRepo=false), unknown dirs stay warnings-only.
        const agents = path.join(tmp, 'agents');
        fs.mkdirSync(path.join(agents, 'random-new-dir'), { recursive: true });
        expect(mod.find_violations(agents, false)).toEqual([]);
    });

    it('test_is_source_repo_detects_root_uncondensed', () => {
        fs.mkdirSync(path.join(tmp, '.agent-src.uncondensed'), { recursive: true });
        expect(mod.is_source_repo(tmp)).toBe(true);
    });

    it('test_is_source_repo_detects_root_condensed', () => {
        fs.mkdirSync(path.join(tmp, 'dist/agent-src'), { recursive: true });
        expect(mod.is_source_repo(tmp)).toBe(true);
    });

    it('test_is_source_repo_detects_pack_uncondensed', () => {
        fs.mkdirSync(path.join(tmp, 'packages', 'core', '.agent-src.uncondensed'), {
            recursive: true,
        });
        expect(mod.is_source_repo(tmp)).toBe(true);
    });

    it('test_is_source_repo_false_in_clean_consumer', () => {
        fs.mkdirSync(path.join(tmp, 'agents', 'overrides'), { recursive: true });
        expect(mod.is_source_repo(tmp)).toBe(false);
    });

    it('test_consumer_warnings_silent_on_target_shape', () => {
        const agents = path.join(tmp, 'agents');
        fs.mkdirSync(path.join(agents, 'overrides'), { recursive: true });
        fs.writeFileSync(path.join(agents, '.event4u-bridge.yml'), 'schema: event4u-bridge/v1\n', 'utf-8');
        expect(mod.find_consumer_warnings(agents)).toEqual([]);
    });

    it('test_consumer_warnings_flag_legacy_dirs', () => {
        const agents = path.join(tmp, 'agents');
        fs.mkdirSync(path.join(agents, 'overrides'), { recursive: true });
        fs.mkdirSync(path.join(agents, 'runtime'), { recursive: true });
        fs.mkdirSync(path.join(agents, 'evidence'), { recursive: true });
        const warnings = mod.find_consumer_warnings(agents);
        const joined = warnings.join('\n');
        expect(joined).toContain('runtime');
        expect(joined).toContain('evidence');
        expect(joined.replace(/agents\/overrides\//g, '')).not.toContain('overrides');
    });

    it('test_consumer_warnings_skip_unknown_flat_files', () => {
        const agents = path.join(tmp, 'agents');
        fs.mkdirSync(path.join(agents, 'overrides'), { recursive: true });
        fs.writeFileSync(path.join(agents, 'rogue.txt'), 'x\n', 'utf-8');
        const warnings = mod.find_consumer_warnings(agents);
        expect(warnings.some((w) => w.includes('rogue.txt'))).toBe(false);
    });
});

describe('lint_agents_layout — real-repo regression', () => {
    it('test_real_repo_has_no_unknown_flat_files', () => {
        const unknown = mod.find_violations(path.join(REPO_ROOT, 'agents'));
        expect(unknown).toEqual([]);
    });
});

// --- CLI golden parity on the REAL REPO -------------------------------------

