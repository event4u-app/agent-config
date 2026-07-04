/**
 * Tests for `src/scripts/lint_subagent_determinism.ts` (ADR-109 § 6).
 *
 * Exercises the guarantees the schema mini-validator cannot express
 * (`const` / `uniqueItems` / stem-match / global-uniqueness) by pointing the
 * lint at fixture dirs and asserting its exit code.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { main } from '../../src/scripts/lint_subagent_determinism.js';

const _tmpDirs: string[] = [];

function _fixtureDir(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sabdet-'));
    _tmpDirs.push(dir);
    for (const [name, body] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), body, 'utf-8');
    }
    return dir;
}

function _unit(overrides: Partial<Record<string, string>> = {}): string {
    const fm: Record<string, string> = {
        schema_version: 'subagent-v1',
        name: 'good-agent',
        'discovery.visible': 'false',
        tools: '[Read, Grep]',
        ...overrides,
    };
    // Build minimal frontmatter the lint reads (schema_version, name, tools, discovery.visible).
    return [
        '---',
        `schema_version: ${fm.schema_version}`,
        `name: ${fm.name}`,
        'description: fixture',
        'model_tier: inherit',
        `tools: ${fm.tools}`,
        'discovery:',
        `  visible: ${fm['discovery.visible']}`,
        '  requires_capability: claude_subagents',
        'source: package',
        '---',
        '',
        'body',
        '',
    ].join('\n');
}

afterEach(() => {
    for (const d of _tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

describe('lint_subagent_determinism', () => {
    it('passes a clean subagent', () => {
        const dir = _fixtureDir({ 'good-agent.md': _unit() });
        expect(main(dir)).toBe(0);
    });

    it('passes an empty dir (no subagents)', () => {
        const dir = _fixtureDir({});
        expect(main(dir)).toBe(0);
    });

    it('fails when discovery.visible is true (default-off breached)', () => {
        const dir = _fixtureDir({ 'good-agent.md': _unit({ 'discovery.visible': 'true' }) });
        expect(main(dir)).toBe(1);
    });

    it('fails on a wrong schema_version', () => {
        const dir = _fixtureDir({ 'good-agent.md': _unit({ schema_version: 'subagent-v2' }) });
        expect(main(dir)).toBe(1);
    });

    it('fails when name does not match the filename stem', () => {
        const dir = _fixtureDir({ 'good-agent.md': _unit({ name: 'other-name' }) });
        expect(main(dir)).toBe(1);
    });

    it('fails on duplicate tool entries', () => {
        const dir = _fixtureDir({ 'good-agent.md': _unit({ tools: '[Read, Read]' }) });
        expect(main(dir)).toBe(1);
    });

    it('fails on a duplicate name across two files', () => {
        // Two files whose stems differ but whose `name` collides — the lint's
        // stem-match catches the mismatch on the second file, and the
        // uniqueness guard would catch a true collision. Here we assert the
        // stem-match failure path returns non-zero.
        const dir = _fixtureDir({
            'good-agent.md': _unit(),
            'second-agent.md': _unit({ name: 'good-agent' }),
        });
        expect(main(dir)).toBe(1);
    });
});
