import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    GLOBAL_RULE_DIRS,
    globalRuleLayerNames,
    globalRuleLayerPath,
    hostLayerCarries,
    hostsWithGlobalRuleLayer,
} from '../../src/install/globalRuleLayers.js';
import { USER_SCOPE_PATHS } from '../../src/scripts/install.js';

/**
 * `globalRuleLayers` restates a path the installer already owns, deliberately
 * (its docstring says why). A restatement is only safe while something fails when
 * the original moves — that is what the first block below is.
 */
describe('global rule layer registry', () => {
    it('covers exactly the five hosts that receive a projected rule tree', () => {
        expect(hostsWithGlobalRuleLayer()).toEqual([
            'augment',
            'claude-code',
            'cline',
            'cursor',
            'windsurf',
        ]);
    });

    it.each(Object.keys(GLOBAL_RULE_DIRS))('%s sits under its own USER_SCOPE_PATHS root', (id) => {
        const root = USER_SCOPE_PATHS[id];
        expect(root, `${id} must exist in USER_SCOPE_PATHS`).toBeTruthy();
        const rootRel = root!.replace(/^~\//, '').replace(/\/$/, '');
        // Every row is either the root itself (cline) or the root plus a
        // subdirectory. A root that moves breaks this and says which host.
        expect(GLOBAL_RULE_DIRS[id]!.startsWith(rootRel)).toBe(true);
    });

    it('resolves windsurf under .codeium and cline without a rules suffix', () => {
        // The two rows nobody would guess from the tool id — pinned by name so a
        // "tidy up the paths" edit cannot silently point them at ~/.windsurf.
        expect(GLOBAL_RULE_DIRS['windsurf']).toBe('.codeium/windsurf/rules');
        expect(GLOBAL_RULE_DIRS['cline']).toBe('Documents/Cline/Rules');
    });

    it('returns null for a host with no directory-shaped layer', () => {
        expect(globalRuleLayerPath('gemini-cli')).toBeNull();
        expect(globalRuleLayerNames('gemini-cli')).toBeNull();
    });
});

describe('absent-tolerance and the carries predicate', () => {
    const mkHome = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'grl-'));

    it('a missing directory reads as absent, never as a throw', () => {
        const home = mkHome();
        expect(globalRuleLayerNames('cursor', home)).toBeNull();
        const v = hostLayerCarries('cursor', ['direct-answers.md'], home);
        expect(v.carries).toBe(false);
        expect(v.reason).toBe('layer-absent');
    });

    it('a host with no layer at all carries nothing and says so', () => {
        const v = hostLayerCarries('gemini-cli', ['direct-answers.md'], mkHome());
        expect(v.carries).toBe(false);
        expect(v.reason).toBe('no-layer-for-host');
        expect(v.layerPath).toBeNull();
    });

    it('normalises .mdc so a cursor layer is not read as empty', () => {
        const home = mkHome();
        const dir = path.join(home, GLOBAL_RULE_DIRS['cursor']!);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'direct-answers.mdc'), 'x');
        expect(globalRuleLayerNames('cursor', home)).toEqual(['direct-answers.md']);
        expect(hostLayerCarries('cursor', ['direct-answers.md'], home).carries).toBe(true);
    });

    it('one missing name is enough to refuse, and names it', () => {
        const home = mkHome();
        const dir = path.join(home, GLOBAL_RULE_DIRS['claude-code']!);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'a.md'), 'x');
        const v = hostLayerCarries('claude-code', ['a.md', 'b.md'], home);
        expect(v.carries).toBe(false);
        expect(v.reason).toBe('missing-names');
        expect(v.missing).toEqual(['b.md']);
    });

    it('withholding nothing needs no evidence', () => {
        const home = mkHome();
        const dir = path.join(home, GLOBAL_RULE_DIRS['claude-code']!);
        fs.mkdirSync(dir, { recursive: true });
        expect(hostLayerCarries('claude-code', [], home).carries).toBe(true);
    });

    it('ignores non-rule files when reading a layer', () => {
        const home = mkHome();
        const dir = path.join(home, GLOBAL_RULE_DIRS['augment']!);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'a.md'), 'x');
        fs.writeFileSync(path.join(dir, 'README.txt'), 'x');
        fs.mkdirSync(path.join(dir, 'sub'));
        expect(globalRuleLayerNames('augment', home)).toEqual(['a.md']);
    });
});
