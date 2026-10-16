import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { is_claude_builtin_name } from '../../src/scripts/_lib/claude_builtin_names.js';

const FIXTURE = join(__dirname, '..', 'fixtures', 'host-builtins', '2.1.301.json');

interface HostFixture {
    readonly version: string;
    readonly names: readonly string[];
}

describe('claude_builtin_names', () => {
    it('pinned-host-control: every name the pinned host registers is reserved', () => {
        const fixture = JSON.parse(readFileSync(FIXTURE, 'utf-8')) as HostFixture;
        expect(fixture.names.length).toBeGreaterThan(0);
        const unreserved = fixture.names.filter((n) => !is_claude_builtin_name(n));
        expect(unreserved).toEqual([]);
    });

    it('matches case-insensitively and rejects a near-miss', () => {
        expect(is_claude_builtin_name('Design-Sync')).toBe(true);
        expect(is_claude_builtin_name('design-system')).toBe(false);
    });
});
