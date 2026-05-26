import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    SCOPE_DETECT_AI_DIRS,
    SCOPE_DETECT_AI_FILES,
    SCOPE_DETECT_MANIFESTS,
    SETTINGS_FILE,
    detectLegacyV3,
    detectPackageRoot,
    detectPackageType,
    detectProjectShape,
    detectScope,
    detectToolPresence,
    discoverPacks,
    scopeToTarget,
} from '../../src/install/detect.js';

describe('detect — constants', () => {
    it('SETTINGS_FILE matches python SETTINGS_FILE', () => {
        expect(SETTINGS_FILE).toBe('.agent-settings.yml');
    });

    it('SCOPE_DETECT_MANIFESTS covers the six python manifests in order', () => {
        expect([...SCOPE_DETECT_MANIFESTS]).toEqual([
            'package.json',
            'composer.json',
            'pyproject.toml',
            'Cargo.toml',
            'go.mod',
            'Gemfile',
        ]);
    });

    it('SCOPE_DETECT_AI_DIRS includes all twelve python entries', () => {
        for (const d of ['.claude', '.cursor', '.windsurf', '.augment', '.clinerules', '.codex']) {
            expect(SCOPE_DETECT_AI_DIRS).toContain(d);
        }
        expect(SCOPE_DETECT_AI_DIRS.length).toBe(12);
    });

    it('SCOPE_DETECT_AI_FILES includes CLAUDE.md / AGENTS.md / .windsurfrules', () => {
        expect(SCOPE_DETECT_AI_FILES).toContain('CLAUDE.md');
        expect(SCOPE_DETECT_AI_FILES).toContain('AGENTS.md');
        expect(SCOPE_DETECT_AI_FILES).toContain('.windsurfrules');
    });
});

describe('detect — filesystem behaviour', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'detect-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('detectScope returns "project" when SETTINGS_FILE exists', () => {
        writeFileSync(join(root, SETTINGS_FILE), '');
        const decision = detectScope(root);
        expect(decision.scope).toBe('project');
        expect(decision.reason).toContain(SETTINGS_FILE);
    });

    it('detectScope returns "global" for empty dir', () => {
        const decision = detectScope(root);
        expect(decision.scope).toBe('global');
    });

    it('detectScope returns "global" when manifest is present but no AI marker', () => {
        writeFileSync(join(root, 'package.json'), '{}');
        expect(detectScope(root).scope).toBe('global');
    });

    it('detectScope returns "prompt" for manifest + AI-dir combo', () => {
        writeFileSync(join(root, 'package.json'), '{}');
        mkdirSync(join(root, '.claude'));
        const decision = detectScope(root);
        expect(decision.scope).toBe('prompt');
        expect(decision.reason).toContain('package.json');
        expect(decision.reason).toContain('.claude');
    });

    it('detectScope returns "prompt" for manifest + AI-file combo', () => {
        writeFileSync(join(root, 'composer.json'), '{}');
        writeFileSync(join(root, 'AGENTS.md'), '');
        expect(detectScope(root).scope).toBe('prompt');
    });

    it('detectProjectShape maps each manifest to the correct kind', () => {
        writeFileSync(join(root, 'Cargo.toml'), '');
        const shape = detectProjectShape(root);
        expect(shape.kind).toBe('cargo');
        expect(shape.manifest).toBe('Cargo.toml');
        expect(shape.root).toBe(root);
    });

    it('detectProjectShape returns "unknown" without manifests', () => {
        expect(detectProjectShape(root).kind).toBe('unknown');
        expect(detectProjectShape(root).manifest).toBeNull();
    });

    it('detectToolPresence flips booleans only for present markers', () => {
        mkdirSync(join(root, '.augment'));
        writeFileSync(join(root, 'AGENTS.md'), '');
        const presence = detectToolPresence(root);
        expect(presence.augment).toBe(true);
        expect(presence.agentsMd).toBe(true);
        expect(presence.claude).toBe(false);
        expect(presence.cursor).toBe(false);
    });

    it('detectToolPresence treats `.windsurfrules` as windsurf signal', () => {
        writeFileSync(join(root, '.windsurfrules'), '');
        expect(detectToolPresence(root).windsurf).toBe(true);
    });

    it('discoverPacks lists every packages/pack-* directory', () => {
        mkdirSync(join(root, 'packages', 'pack-foo'), { recursive: true });
        mkdirSync(join(root, 'packages', 'pack-bar'), { recursive: true });
        mkdirSync(join(root, 'packages', 'core'), { recursive: true });
        const packs = discoverPacks(root);
        expect(packs.length).toBe(2);
        expect(packs.some((p) => p.endsWith('pack-foo'))).toBe(true);
        expect(packs.some((p) => p.endsWith('pack-bar'))).toBe(true);
    });

    it('discoverPacks returns empty array when no packages dir exists', () => {
        expect(discoverPacks(root)).toEqual([]);
    });

    it('detectPackageRoot resolves a node_modules install', () => {
        const pkgDir = join(root, 'node_modules', '@event4u', 'agent-config');
        mkdirSync(pkgDir, { recursive: true });
        expect(detectPackageRoot(root)).toBe(pkgDir);
    });

    it('detectPackageRoot returns null when no marker is present', () => {
        expect(detectPackageRoot(root)).toBeNull();
    });

    it('detectPackageType classifies node_modules paths as npm', () => {
        expect(detectPackageType('/x/node_modules/@event4u/agent-config')).toBe('npm');
        expect(detectPackageType('/home/dev/agent-config')).toBe('local');
    });

    it('scopeToTarget rejects "prompt" with null', () => {
        expect(scopeToTarget('project')).toBe('project');
        expect(scopeToTarget('global')).toBe('global');
        expect(scopeToTarget('prompt')).toBeNull();
    });
});

describe('detectLegacyV3 (Phase E2)', () => {
    let home: string;

    beforeEach(() => {
        home = mkdtempSync(join(tmpdir(), 'detect-legacy-v3-'));
    });

    afterEach(() => {
        rmSync(home, { recursive: true, force: true });
    });

    it('reports `present: false` when no .event4u/agent-config directory exists', () => {
        const res = detectLegacyV3({ home });
        expect(res.present).toBe(false);
        expect(res.path).toBe(join(home, '.event4u', 'agent-config'));
        expect(res.backupTarget).toBe(join(home, '.event4u', 'agent-config.v3.bak'));
        expect(res.version).toBeNull();
    });

    it('reports `present: false` when VERSION is missing', () => {
        mkdirSync(join(home, '.event4u', 'agent-config'), { recursive: true });
        const res = detectLegacyV3({ home });
        expect(res.present).toBe(false);
        expect(res.version).toBeNull();
    });

    it('reports `present: true` for a v3.3.0 install', () => {
        const dir = join(home, '.event4u', 'agent-config');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'VERSION'), '3.3.0\n', 'utf8');
        const res = detectLegacyV3({ home });
        expect(res.present).toBe(true);
        expect(res.version).toBe('3.3.0');
    });

    it('reports `present: false` for v4 (current major) but surfaces the version string', () => {
        const dir = join(home, '.event4u', 'agent-config');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'VERSION'), '4.0.0', 'utf8');
        const res = detectLegacyV3({ home });
        expect(res.present).toBe(false);
        expect(res.version).toBe('4.0.0');
    });

    it('tolerates whitespace and multi-line VERSION files', () => {
        const dir = join(home, '.event4u', 'agent-config');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'VERSION'), '  3.7.1\nextra metadata\n', 'utf8');
        const res = detectLegacyV3({ home });
        expect(res.present).toBe(true);
        expect(res.version).toBe('3.7.1');
    });
});
