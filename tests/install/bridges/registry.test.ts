import { describe, expect, it } from 'vitest';

import {
    BRIDGE_REGISTRY,
    generateProjectBridges,
    KNOWN_TOOL_IDS,
} from '../../../src/install/bridges/index.js';
import type { BridgeContext } from '../../../src/install/bridges/types.js';

function ctx(overrides: Partial<BridgeContext> = {}): BridgeContext {
    return {
        projectRoot: '/repo',
        packageType: 'npm',
        ...overrides,
    };
}

describe('bridges — registry', () => {
    it('registers exactly the 17 project-scope bridges from install.py', () => {
        const ids = BRIDGE_REGISTRY.map(([id]) => id);
        expect(ids).toEqual([
            'vscode',
            'augment',
            'claude',
            'cursor',
            'windsurf',
            'gemini',
            'cline',
            'copilot',
            'roocode',
            'claude-desktop',
            'aider',
            'codex',
            'continue',
            'kilocode',
            'zed',
            'jetbrains',
            'kiro',
        ]);
    });

    it('exposes KNOWN_TOOL_IDS matching the registry', () => {
        expect(KNOWN_TOOL_IDS.size).toBe(BRIDGE_REGISTRY.length);
        for (const [id] of BRIDGE_REGISTRY) {
            expect(KNOWN_TOOL_IDS.has(id)).toBe(true);
        }
    });

    it('every builder produces at least one output', () => {
        for (const [id, builder] of BRIDGE_REGISTRY) {
            const result = builder(ctx());
            const outputs = Array.isArray(result) ? result : [result];
            expect(outputs.length, `${id} must produce ≥1 output`).toBeGreaterThan(0);
            for (const out of outputs) {
                expect(out.toolId, `${id} toolId`).toBe(id);
                expect(out.target.startsWith('/repo')).toBe(true);
            }
        }
    });
});

describe('bridges — generateProjectBridges', () => {
    it('returns outputs only for enabled IDs and skips unknown', () => {
        const outputs = generateProjectBridges(ctx(), ['claude', 'unknown-tool']);
        expect(outputs.map(o => o.toolId)).toEqual(['claude']);
    });

    it('preserves registry order regardless of enabledIds order', () => {
        const outputs = generateProjectBridges(ctx(), ['gemini', 'augment', 'claude']);
        expect(outputs.map(o => o.toolId)).toEqual(['augment', 'claude', 'gemini']);
    });

    it('flattens multi-output builders (cline → 6 scripts)', () => {
        const outputs = generateProjectBridges(ctx(), ['cline']);
        expect(outputs.length).toBe(6);
        for (const out of outputs) {
            expect(out.kind).toBe('script');
            expect(out.toolId).toBe('cline');
        }
    });

    it('accepts a Set or an Array as enabledIds', () => {
        const arr = generateProjectBridges(ctx(), ['vscode', 'augment']);
        const set = generateProjectBridges(ctx(), new Set(['vscode', 'augment']));
        expect(arr).toEqual(set);
    });

    it('returns an empty list when no IDs are enabled', () => {
        expect(generateProjectBridges(ctx(), [])).toEqual([]);
    });
});
