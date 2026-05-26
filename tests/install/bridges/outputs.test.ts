import { describe, expect, it } from 'vitest';

import { buildAugmentBridge } from '../../../src/install/bridges/augment.js';
import { buildClaudeBridge, CLAUDE_BINDINGS } from '../../../src/install/bridges/claude.js';
import {
    buildClineBridge,
    CLINE_BINDINGS,
    shellQuote,
} from '../../../src/install/bridges/cline.js';
import { buildCopilotBridge } from '../../../src/install/bridges/copilot.js';
import { buildCursorBridge } from '../../../src/install/bridges/cursor.js';
import { buildGeminiBridge } from '../../../src/install/bridges/gemini.js';
import { buildRoocodeBridge } from '../../../src/install/bridges/markers.js';
import { dispatchCommand } from '../../../src/install/bridges/types.js';
import type { BridgeContext } from '../../../src/install/bridges/types.js';
import { buildVscodeBridge } from '../../../src/install/bridges/vscode.js';
import { buildWindsurfBridge } from '../../../src/install/bridges/windsurf.js';

const ctx: BridgeContext = { projectRoot: '/repo', packageType: 'npm' };

describe('bridges — augment', () => {
    it('enables only the agent-config plugin under .augment/settings.json', () => {
        const out = buildAugmentBridge(ctx);
        expect(out).toMatchObject({
            kind: 'json',
            toolId: 'augment',
            target: '/repo/.augment/settings.json',
            payload: { enabledPlugins: { 'agent-config@event4u': true } },
        });
    });
});

describe('bridges — claude', () => {
    it('emits enabledPlugins + hooks for every binding', () => {
        const out = buildClaudeBridge(ctx);
        if (out.kind !== 'json') throw new Error('expected json bridge');
        expect(out.target).toBe('/repo/.claude/settings.json');
        expect(out.payload.enabledPlugins).toEqual({ 'agent-conf@event4u': true });
        const hooks = out.payload.hooks as Record<string, unknown[]>;
        for (const [acEvent, native] of CLAUDE_BINDINGS) {
            expect(hooks[native]).toEqual([
                { hooks: [{ type: 'command', command: dispatchCommand('claude', acEvent, native) }] },
            ]);
        }
    });
});

describe('bridges — cursor', () => {
    it('wraps every binding in a {command} entry under .cursor/hooks.json', () => {
        const out = buildCursorBridge(ctx);
        if (out.kind !== 'json') throw new Error('expected json bridge');
        expect(out.target).toBe('/repo/.cursor/hooks.json');
        expect(out.payload.version).toBe(1);
        const hooks = out.payload.hooks as Record<string, Array<{ command: string }>>;
        expect(Object.keys(hooks)).toContain('beforeSubmitPrompt');
        for (const entries of Object.values(hooks)) {
            for (const entry of entries) {
                expect(entry.command).toContain('./agent-config dispatch:hook --platform cursor');
            }
        }
    });
});

describe('bridges — windsurf', () => {
    it('sets show_output:false on every hook entry', () => {
        const out = buildWindsurfBridge(ctx);
        if (out.kind !== 'json') throw new Error('expected json bridge');
        expect(out.target).toBe('/repo/.windsurf/hooks.json');
        const hooks = out.payload.hooks as Record<string, Array<{ show_output: boolean }>>;
        const allEntries = Object.values(hooks).flat();
        expect(allEntries.length).toBeGreaterThan(0);
        for (const entry of allEntries) {
            expect(entry.show_output).toBe(false);
        }
    });
});

describe('bridges — gemini', () => {
    it('uses Gemini nested matcher/hooks shape with .* for AfterTool', () => {
        const out = buildGeminiBridge(ctx);
        if (out.kind !== 'json') throw new Error('expected json bridge');
        expect(out.target).toBe('/repo/.gemini/settings.json');
        const hooks = out.payload.hooks as Record<string, Array<{ matcher: string }>>;
        expect(hooks.AfterTool[0].matcher).toBe('.*');
        expect(hooks.SessionStart[0].matcher).toBe('');
    });
});

describe('bridges — vscode', () => {
    it('uses npm node_modules path for npm package type', () => {
        const out = buildVscodeBridge(ctx);
        if (out.kind !== 'json') throw new Error('expected json bridge');
        expect(out.payload).toEqual({
            'chat.pluginLocations': {
                './node_modules/@event4u/agent-config/plugin/agent-config': true,
            },
        });
    });

    it('falls back to ./plugin/agent-config for non-npm types', () => {
        const out = buildVscodeBridge({ projectRoot: '/repo', packageType: 'composer' });
        if (out.kind !== 'json') throw new Error('expected json bridge');
        expect(out.payload).toEqual({
            'chat.pluginLocations': { './plugin/agent-config': true },
        });
    });
});

describe('bridges — copilot', () => {
    it('registers the agent-config plugin in marketplace.json', () => {
        const out = buildCopilotBridge(ctx);
        if (out.kind !== 'json') throw new Error('expected json bridge');
        expect(out.target).toBe('/repo/.github/plugin/marketplace.json');
        const market = out.payload.marketplace as { plugins: Array<{ id: string }> };
        expect(market.plugins[0].id).toBe('agent-config@event4u');
    });
});

describe('bridges — cline', () => {
    it('returns one executable script per binding with 0755 mode', () => {
        const out = buildClineBridge(ctx);
        if (!Array.isArray(out)) throw new Error('expected array');
        expect(out.length).toBe(CLINE_BINDINGS.length);
        for (const o of out) {
            if (o.kind !== 'script') throw new Error('expected script');
            expect(o.mode).toBe(0o755);
            expect(o.content.startsWith('#!/usr/bin/env bash')).toBe(true);
            expect(o.content).toContain('./agent-config dispatch:hook');
            expect(o.target.startsWith('/repo/.clinerules/hooks/')).toBe(true);
        }
    });

    it("shellQuote escapes embedded single quotes via '\\''", () => {
        expect(shellQuote("/a/b")).toBe("'/a/b'");
        expect(shellQuote("/a'b")).toBe("'/a'\\''b'");
    });
});

describe('bridges — markers', () => {
    it('roocode marker lands at .roo/rules/agent-config.md', () => {
        const out = buildRoocodeBridge(ctx);
        if (out.kind !== 'marker') throw new Error('expected marker bridge');
        expect(out.target).toBe('/repo/.roo/rules/agent-config.md');
        expect(out.content).toContain('event4u/agent-config');
    });
});
