import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { is_claude_builtin_name } from '../../src/scripts/_lib/claude_builtin_names.js';

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'host-builtins');
const FIXTURES = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json')).sort();

interface HostFixture {
    readonly version: string;
    readonly read: string;
    readonly names: readonly string[];
}

describe('claude_builtin_names', () => {
    it('finds more than one witness fixture', () => {
        expect(FIXTURES.length).toBeGreaterThan(1);
    });

    for (const file of FIXTURES) {
        it(`pinned-host-control: every name ${file} witnesses is reserved`, () => {
            const fixture = JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf-8')) as HostFixture;
            expect(fixture.read.length).toBeGreaterThan(0);
            expect(fixture.names.length).toBeGreaterThan(0);
            const unreserved = fixture.names.filter((n) => !is_claude_builtin_name(n));
            expect(unreserved).toEqual([]);
        });
    }

    it('matches case-insensitively and rejects a near-miss', () => {
        expect(is_claude_builtin_name('Design-Sync')).toBe(true);
        expect(is_claude_builtin_name('design-system')).toBe(false);
    });

    it('normalizes the way the host does: NFKC, no whitespace or format characters, lowercase', () => {
        expect(is_claude_builtin_name('\uFF4D\uFF43\uFF50')).toBe(true); // full-width
        expect(is_claude_builtin_name('m\u200Bcp')).toBe(true); // zero-width space
        expect(is_claude_builtin_name(' MCP ')).toBe(true);
        expect(is_claude_builtin_name('mcp-tool-use')).toBe(false);
    });
});
