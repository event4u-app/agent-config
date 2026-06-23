// Tests for the py2ts `lint_workspace_boundary` twin (ADR-200).
//
// The workspace-boundary linter flags a `src/cli/python/workspace_*.py` module
// that imports an owner-module of a NOT-owned domain. These unit checks drive
// the per-segment detectors directly:
//   - `_is_intra_workspace(head)` — the workspace-head allow.
//   - `_forbidden_reason(segment)` — each FORBIDDEN pattern, matched on segment
//     boundaries (not substrings); the intra-workspace + unrelated misses.
import { describe, expect, it } from 'vitest';

import { _forbidden_reason, _is_intra_workspace } from '../../src/scripts/lint_workspace_boundary.js';

// --- TS-side unit checks ----------------------------------------------------

describe('lint_workspace_boundary — TS-side unit checks', () => {
    it('_is_intra_workspace recognises the workspace head', () => {
        expect(_is_intra_workspace('workspace')).toBe(true);
        expect(_is_intra_workspace('workspace_skills')).toBe(true);
        expect(_is_intra_workspace('workspace.sub.mod')).toBe(true);
        expect(_is_intra_workspace('os')).toBe(false);
        expect(_is_intra_workspace('packaging')).toBe(false);
    });

    it('_forbidden_reason matches FORBIDDEN with segment boundaries, not substrings', () => {
        expect(_forbidden_reason('condense')).toBe('skill design / condensation');
        expect(_forbidden_reason('skill_linter')).toBe('skill design');
        expect(_forbidden_reason('discovery_manifest')).toBe('profile/pack semantics');
        expect(_forbidden_reason('profiles')).toBe('profile/pack semantics');
        expect(_forbidden_reason('ai_video')).toBe('video-provider logic');
        expect(_forbidden_reason('mcp')).toBe('MCP-registry policy');
        expect(_forbidden_reason('router')).toBe('router / projection policy');
        expect(_forbidden_reason('persona_writer')).toBe('persona / skill design');
        // `packaging` must NOT trip `pack`; intra-workspace must NOT trip.
        expect(_forbidden_reason('packaging')).toBeNull();
        expect(_forbidden_reason('workspace_skills')).toBeNull();
        expect(_forbidden_reason('os')).toBeNull();
    });
});
