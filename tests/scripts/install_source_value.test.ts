// The `source_path:` an installed file carries (road-to-the-adapted-layer-on-main,
// owner decision of 2026-11-09, option 1). The value is ownership evidence; no
// reader parses it. A rule loses the shared `dist/agent-src/rules/` prefix,
// which every session start paid once per installed rule.
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { installed_source_value } from '../../src/scripts/install.js';

const PKG = path.join(path.sep, 'opt', 'pkg');

describe('installed_source_value', () => {
    it('drops the rules prefix from a packaged rule', () => {
        expect(installed_source_value(path.join(PKG, 'dist/agent-src/rules/scope-control.md'), PKG)).toBe('scope-control.md');
    });

    it('keeps a nested rule path below the prefix', () => {
        expect(installed_source_value(path.join(PKG, 'dist/agent-src/rules/pack/x.md'), PKG)).toBe('pack/x.md');
    });

    it('leaves every other packaged path relative to the package, as before', () => {
        expect(installed_source_value(path.join(PKG, 'dist/agent-src/skills/a/SKILL.md'), PKG)).toBe('dist/agent-src/skills/a/SKILL.md');
    });

    it('keeps an absolute path for a source outside the package, and none for no source', () => {
        expect(installed_source_value('/elsewhere/r.md', PKG)).toBe('/elsewhere/r.md');
        expect(installed_source_value(null, PKG)).toBeNull();
    });
});
