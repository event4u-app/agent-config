// Tests for src/scripts/tool_registry.ts (py2ts Phase 8 / Wave 8e).
//
// Ports tests/test_tool_registry.py 1:1 (get_tool, list_tools,
// validate_tool_declarations, TOOL_REGISTRY) plus a CLI layer (tsx
// subprocess) on the text + json listing and the --validate-tools surfaces —
// converted from the retired python3-vs-tsx golden parity block (the Python
// original was deleted). Output is fully deterministic — no timestamps /
// measured fields — so the CLI layer asserts it directly.
import { describe, expect, it } from 'vitest';

import {
    TOOL_REGISTRY,
    get_tool,
    list_tools,
    validate_tool_declarations,
} from '../../src/scripts/tool_registry.js';
import { runTs } from './_wave8e.js';

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

describe('tool_registry — CLI surface (tsx)', () => {
    it('default text listing renders both seed tools', () => {
        const t = runTs('tool_registry', []);
        expect(t.status).toBe(0);
        expect(t.stderr).toBe('');
        expect(t.stdout).toContain('Registered tools: 2');
        expect(t.stdout).toContain('github (read-only)');
        expect(t.stdout).toContain('GitHub API — PRs, issues, files, commits');
        expect(t.stdout).toContain('Actions: create_pr, list_files, read_commit, read_issue, read_pr');
        expect(t.stdout).toContain('jira (read-only)');
        expect(t.stdout).toContain('Actions: add_comment, read_ticket, search_tickets, transition_ticket');
    });

    it('--format json listing emits the full registry', () => {
        const t = runTs('tool_registry', ['--format', 'json']);
        expect(t.status).toBe(0);
        expect(t.stderr).toBe('');
        const doc = JSON.parse(t.stdout) as Array<Record<string, unknown>>;
        expect(doc.map((d) => d['name'])).toEqual(['github', 'jira']);
        expect(doc[0]).toEqual({
            name: 'github',
            description: 'GitHub API — PRs, issues, files, commits',
            actions: ['create_pr', 'list_files', 'read_commit', 'read_issue', 'read_pr'],
            default_mode: 'read-only',
            requires_auth: true,
        });
        expect(doc[1]!['actions']).toEqual([
            'add_comment',
            'read_ticket',
            'search_tickets',
            'transition_ticket',
        ]);
    });

    it('--validate-tools github jira (valid, text) → exit 0', () => {
        const t = runTs('tool_registry', ['--validate-tools', 'github', 'jira']);
        expect(t.status).toBe(0);
        expect(t.stderr).toBe('');
    });

    it('--validate-tools github slack (invalid, text) → error line + exit 1', () => {
        const t = runTs('tool_registry', ['--validate-tools', 'github', 'slack']);
        expect(t.status).toBe(1);
        expect(t.stdout).toContain("Tool 'slack' is not registered in the tool registry");
    });

    it('--validate-tools (empty) --format json → valid result', () => {
        const t = runTs('tool_registry', ['--validate-tools', '--format', 'json']);
        expect(t.status).toBe(0);
        expect(JSON.parse(t.stdout)).toEqual({ valid: true, errors: [], warnings: [] });
    });

    it('--validate-tools github slack --format json → structured errors + exit 1', () => {
        const t = runTs('tool_registry', ['--validate-tools', 'github', 'slack', '--format', 'json']);
        expect(t.status).toBe(1);
        expect(JSON.parse(t.stdout)).toEqual({
            valid: false,
            errors: ["Tool 'slack' is not registered in the tool registry"],
            warnings: [],
        });
    });
});
