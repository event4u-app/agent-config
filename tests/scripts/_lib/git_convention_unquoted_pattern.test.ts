/**
 * An unquoted `branch_pattern` is the likeliest wrong value a developer file
 * carries, and both ways YAML reads it must name the fix.
 */
import { describe, expect, it } from 'vitest';

import { parseLayerText, readGitConventionKey, type GitConventionLayer } from '../../../src/scripts/_lib/git_convention.js';

function read(text: string) {
    const layer: GitConventionLayer = { path: '.agent-settings.yml', carries: true, ...parseLayerText(text) };
    return readGitConventionKey('branch_pattern', { layers: () => [layer] }, {});
}

describe('an unquoted branch_pattern', () => {
    it('a pattern YAML reads as a mapping is invalid, shown as the mapping, with the quoting fix', () => {
        const r = read('git:\n  branch_pattern: {ticket}\n');
        expect(r.state).toBe('invalid');
        expect(r.value).not.toContain('[object Object]');
        expect(r.value).toBe('{"ticket":null}');
        expect(r.detail).toContain('quote the value, e.g. branch_pattern: "{ticket}-{slug}"');
    });

    it('a pattern YAML cannot parse names the line and suggests quoting', () => {
        const r = read('personal:\n  play_by_play: true\ngit:\n  branch_pattern: {ticket}-{slug}\n');
        expect(r.state).toBe('malformed');
        expect(r.detail).toContain('line 4');
        expect(r.detail).toContain('quote');
        expect(r.detail).toContain('{');
    });

    it('a parse error on a line without `{` names the line and suggests nothing about quoting', () => {
        const parsed = parseLayerText('git:\n  update_strategy: [merge\n');
        expect(parsed.parsed).toBe('malformed');
        expect(parsed.why).toMatch(/line \d+/);
        expect(parsed.why).not.toContain('quote');
    });

    it('a non-string enum value names the quoting fix with that key', () => {
        const layer: GitConventionLayer = { path: '.agent-settings.yml', carries: true, ...parseLayerText('git:\n  update_strategy: 1\n') };
        const r = readGitConventionKey('update_strategy', { layers: () => [layer] }, {});
        expect(r.state).toBe('invalid');
        expect(r.value).toBe('1');
        expect(r.detail).toContain('quote the value, e.g. update_strategy: "');
    });
});
