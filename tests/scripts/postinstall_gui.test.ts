// Gate for the postinstall GUI (re)start. The gate is the risk surface — a
// wrong "true" launches a browser in CI / as a transitive dependency. Cover the
// launch decision exhaustively; the kill + detached-spawn are side-effectful and
// out of scope for a unit test.
import { describe, expect, it } from 'vitest';

import { shouldPostinstallLaunchGui } from '../../src/scripts/postinstall_gui.js';

describe('shouldPostinstallLaunchGui', () => {
    it('launches on a global, interactive-context, non-CI, non-headless install', () => {
        expect(shouldPostinstallLaunchGui({ npm_config_global: 'true' }, false)).toBe(true);
    });

    it('does NOT launch when not a global install (transitive dependency)', () => {
        expect(shouldPostinstallLaunchGui({ npm_config_global: '' }, false)).toBe(false);
        expect(shouldPostinstallLaunchGui({ npm_config_global: undefined }, false)).toBe(false);
        expect(shouldPostinstallLaunchGui({ npm_config_global: '0' }, false)).toBe(false);
        expect(shouldPostinstallLaunchGui({}, false)).toBe(false);
    });

    it('does NOT launch in CI', () => {
        expect(shouldPostinstallLaunchGui({ npm_config_global: 'true', CI: 'true' }, false)).toBe(false);
        expect(shouldPostinstallLaunchGui({ npm_config_global: 'true', CI: '1' }, false)).toBe(false);
    });

    it('treats CI=0 / CI="" as not-CI (still launches)', () => {
        expect(shouldPostinstallLaunchGui({ npm_config_global: 'true', CI: '0' }, false)).toBe(true);
        expect(shouldPostinstallLaunchGui({ npm_config_global: 'true', CI: '' }, false)).toBe(true);
    });

    it('does NOT launch when opted out via AGENT_CONFIG_NO_UI', () => {
        expect(shouldPostinstallLaunchGui({ npm_config_global: 'true', AGENT_CONFIG_NO_UI: '1' }, false)).toBe(false);
    });

    it('does NOT launch on a headless host (SSH / no DISPLAY)', () => {
        expect(shouldPostinstallLaunchGui({ npm_config_global: 'true' }, true)).toBe(false);
    });
});
