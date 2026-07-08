// Tests for src/scripts/surface_probe_hook.ts (road-to-install-path-
// convergence Phase 4): clean surface, live duplicate, rate-limited repeat,
// corrupted state file, auto_converge suppression, unreadable matrix.
// Contract under test: exit 0 on EVERY path (fail-open), at most one stderr
// nudge per 24h window.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../../src/scripts/surface_probe_hook.js';

const MATRIX = `
schema_version: 1
tools:
  claude-code:
    surface: projection
    scope_path: "~/.claude/"
    hooks: managed-settings-block
    duplicate:
      description: plugin snapshot next to the projection
      detect:
        all_of:
          - "~/.claude/skills"
          - "~/.claude/plugins/cache/event4u-agent-config"
    converge:
      command: "claude plugin uninstall agent-config@event4u-agent-config"
  augment:
    surface: projection
    scope_path: "~/.augment/"
    hooks: settings-hooks-opt-in
    duplicate:
      pending_evidence: unverified
`;

describe('surface_probe_hook', () => {
    let tmp: string;
    let home: string;
    let pkgRoot: string;
    let projectRoot: string;
    let settingsPath: string;
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    const statePath = (): string =>
        path.join(projectRoot, 'agents', 'runtime', 'state', 'surface-probe.json');

    function opts(extra: Record<string, unknown> = {}) {
        return {
            project_root: projectRoot,
            package_root: pkgRoot,
            home,
            global_settings_path: settingsPath,
            now_ms: 1_000_000_000_000,
            ...extra,
        };
    }

    function makeDuplicate(): void {
        fs.mkdirSync(path.join(home, '.claude', 'skills'), { recursive: true });
        fs.mkdirSync(path.join(home, '.claude', 'plugins', 'cache', 'event4u-agent-config'), {
            recursive: true,
        });
    }

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-'));
        home = path.join(tmp, 'home');
        pkgRoot = path.join(tmp, 'pkg');
        projectRoot = path.join(tmp, 'project');
        settingsPath = path.join(tmp, 'global', 'agent-settings.yml');
        fs.mkdirSync(home, { recursive: true });
        fs.mkdirSync(projectRoot, { recursive: true });
        fs.mkdirSync(path.join(pkgRoot, 'src', 'config'), { recursive: true });
        fs.writeFileSync(path.join(pkgRoot, 'src', 'config', 'surface-matrix.yml'), MATRIX);
        stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });
    afterEach(() => {
        stderrSpy.mockRestore();
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function nudges(): string[] {
        return stderrSpy.mock.calls.map((c) => String(c[0])).filter((s) => s.includes('[surface]'));
    }

    it('clean surface → exit 0, fully silent, state stamped', () => {
        expect(main([], opts())).toBe(0);
        expect(nudges()).toEqual([]);
        expect(fs.existsSync(statePath())).toBe(true);
    });

    it('live duplicate → exit 0 + ONE nudge naming tool and converge command', () => {
        makeDuplicate();
        expect(main([], opts())).toBe(0);
        const n = nudges();
        expect(n).toHaveLength(1);
        expect(n[0]).toContain('claude-code');
        expect(n[0]).toContain('agent-config converge');
        expect(n[0]).toContain('claude plugin uninstall agent-config@event4u-agent-config');
        // pending_evidence classes never appear.
        expect(n[0]).not.toContain('augment');
    });

    it('rate-limited repeat inside the 24h window → silent', () => {
        makeDuplicate();
        const t0 = 1_000_000_000_000;
        expect(main([], opts({ now_ms: t0 }))).toBe(0);
        expect(nudges()).toHaveLength(1);
        // 1 hour later — window still open, no second nudge.
        expect(main([], opts({ now_ms: t0 + 3_600_000 }))).toBe(0);
        expect(nudges()).toHaveLength(1);
        // 25 hours later — window expired, nudges again.
        expect(main([], opts({ now_ms: t0 + 25 * 3_600_000 }))).toBe(0);
        expect(nudges()).toHaveLength(2);
    });

    it('corrupted state file counts as due and is rewritten', () => {
        makeDuplicate();
        fs.mkdirSync(path.dirname(statePath()), { recursive: true });
        fs.writeFileSync(statePath(), '{ not json !!!');
        expect(main([], opts())).toBe(0);
        expect(nudges()).toHaveLength(1);
        const state = JSON.parse(fs.readFileSync(statePath(), 'utf-8')) as {
            last_check_utc: number;
        };
        expect(state.last_check_utc).toBe(1_000_000_000_000);
    });

    it('install.auto_converge: true suppresses the nudge entirely', () => {
        makeDuplicate();
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
        fs.writeFileSync(settingsPath, 'install:\n  auto_converge: true\n');
        expect(main([], opts())).toBe(0);
        expect(nudges()).toEqual([]);
    });

    it('unreadable matrix → exit 0, silent (fail-open)', () => {
        makeDuplicate();
        fs.writeFileSync(path.join(pkgRoot, 'src', 'config', 'surface-matrix.yml'), ':::: not yaml [');
        expect(main([], opts())).toBe(0);
        expect(nudges()).toEqual([]);
    });

    it('unwritable state dir → exit 0 (never blocks the session)', () => {
        makeDuplicate();
        // A FILE where the state dir should be makes mkdir fail.
        fs.mkdirSync(path.join(projectRoot, 'agents', 'runtime'), { recursive: true });
        fs.writeFileSync(path.join(projectRoot, 'agents', 'runtime', 'state'), 'not a dir');
        expect(main([], opts())).toBe(0);
    });
});
