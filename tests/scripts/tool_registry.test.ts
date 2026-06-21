// Tests for src/scripts/tool_registry.ts (py2ts Phase 8 / Wave 8e).
//
// Ports tests/test_tool_registry.py 1:1 (get_tool, list_tools,
// validate_tool_declarations, TOOL_REGISTRY) plus a golden-parity layer
// (python3 vs tsx) on the text + json listing and the --validate-tools
// surfaces. Output is fully deterministic — no timestamps / measured fields.
import { describe, expect, it } from 'vitest';

import {
    TOOL_REGISTRY,
    get_tool,
    list_tools,
    validate_tool_declarations,
} from '../../src/scripts/tool_registry.js';
import { hasPython3, runPy, runTs } from './_wave8e.js';

const py3 = hasPython3();

describe('tool_registry — ported pytest suite', () => {
    it('github tool exists', () => {
        const tool = get_tool('github');
        expect(tool).not.toBeNull();
        expect(tool!.name).toBe('github');
        expect(tool!.supported_actions.has('read_pr')).toBe(true);
    });

    it('jira tool exists', () => {
        const tool = get_tool('jira');
        expect(tool).not.toBeNull();
        expect(tool!.name).toBe('jira');
        expect(tool!.supported_actions.has('read_ticket')).toBe(true);
    });

    it('unknown tool returns null', () => {
        expect(get_tool('nonexistent')).toBeNull();
    });

    it('list_tools returns all', () => {
        const names = new Set(list_tools().map((t) => t.name));
        expect(names.has('github')).toBe(true);
        expect(names.has('jira')).toBe(true);
    });

    it('validate valid tools', () => {
        const result = validate_tool_declarations(['github', 'jira']);
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
    });

    it('validate unknown tool fails', () => {
        const result = validate_tool_declarations(['github', 'slack']);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('slack'))).toBe(true);
    });

    it('validate empty tools passes', () => {
        const result = validate_tool_declarations([]);
        expect(result.valid).toBe(true);
    });

    it('validate tool permissions valid', () => {
        const result = validate_tool_declarations(['github'], {
            github: { actions: ['read_pr', 'create_pr'] },
        });
        expect(result.valid).toBe(true);
    });

    it('validate tool permissions invalid action', () => {
        const result = validate_tool_declarations(['github'], {
            github: { actions: ['delete_repo'] },
        });
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('delete_repo'))).toBe(true);
    });

    it('validate permissions without allowed warns', () => {
        const result = validate_tool_declarations(['github'], {
            jira: { actions: ['read_ticket'] },
        });
        expect(result.valid).toBe(true); // no errors
        expect(result.warnings.some((w) => w.includes('jira'))).toBe(true);
    });

    it('tool default modes', () => {
        const github = get_tool('github');
        expect(github).not.toBeNull();
        expect(github!.default_mode).toBe('read-only');
        expect(github!.requires_auth).toBe(true);
    });

    it('TOOL_REGISTRY is the two seed tools', () => {
        expect(Object.keys(TOOL_REGISTRY).sort()).toEqual(['github', 'jira']);
    });
});

describe.skipIf(!py3)('tool_registry — golden parity (python3 vs tsx)', () => {
    function bothEqual(args: string[]): void {
        const p = runPy('tool_registry', args);
        const t = runTs('tool_registry', args);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
    }

    it('default text listing → identical', () => {
        bothEqual([]);
    });

    it('--format json listing → identical', () => {
        bothEqual(['--format', 'json']);
    });

    it('--validate-tools github jira (valid, text) → identical', () => {
        bothEqual(['--validate-tools', 'github', 'jira']);
    });

    it('--validate-tools github slack (invalid, text) → identical + exit 1', () => {
        const p = runPy('tool_registry', ['--validate-tools', 'github', 'slack']);
        const t = runTs('tool_registry', ['--validate-tools', 'github', 'slack']);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
        expect(t.status).toBe(p.status);
        expect(t.status).toBe(1);
    });

    it('--validate-tools (empty) --format json → identical', () => {
        bothEqual(['--validate-tools', '--format', 'json']);
    });

    it('--validate-tools github slack --format json → identical', () => {
        bothEqual(['--validate-tools', 'github', 'slack', '--format', 'json']);
    });
});
