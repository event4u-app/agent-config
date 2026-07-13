/**
 * Must-fail / must-pass fixtures for `lint_supported_tools_matrix`
 * (road-to-ecosystem-harvest-skill-quality-gates Phase 4, Source AA).
 *
 * The real README is the must-pass fixture; seeded doc/adapter drift (a row
 * removed, a row invented) must turn the lint red in both directions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    ADAPTER_REGISTRY,
    lint_matrix,
    parse_supported_tools,
} from '../../src/scripts/_lib/tool_adapter_registry.js';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const README = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf-8');

describe('parse_supported_tools', () => {
    it('extracts every row of the Project-installed matrix', () => {
        const tools = parse_supported_tools(README);
        expect(tools).toContain('Claude Code');
        expect(tools).toContain('Claude Desktop'); // last row — proves the table is read to the end
        expect(tools).toContain('Augment'); // parenthetical stripped
        expect(tools.length).toBe(ADAPTER_REGISTRY.length);
    });
});

describe('lint_matrix', () => {
    it('must-pass: the shipped README is in sync with the registry', () => {
        expect(lint_matrix(README)).toEqual([]);
    });

    it('must-fail: a README row removed (registry tool undocumented) turns red', () => {
        const drifted = README.replace(/^\| \*\*Cline\*\*.*\n/m, '');
        const errors = lint_matrix(drifted);
        expect(errors.some((e) => e.includes("'Cline'") && e.includes('missing from the README'))).toBe(true);
    });

    it('must-fail: an invented README row (no registry entry) turns red', () => {
        const drifted = README.replace(
            /^(\| \*\*Claude Desktop\*\*.*)$/m,
            '$1\n| **Imaginary IDE** | ✅ | — | — | Reads `.imaginary/` |',
        );
        const errors = lint_matrix(drifted);
        expect(errors.some((e) => e.includes("'Imaginary IDE'") && e.includes('no ADAPTER_REGISTRY entry'))).toBe(true);
    });
});
