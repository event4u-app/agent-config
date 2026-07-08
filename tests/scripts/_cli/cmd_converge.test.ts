// Tests for src/scripts/_cli/cmd_converge.ts (road-to-install-path-convergence
// Phase 3): consent model (standing key / --yes / interactive / refusal),
// dry-run fidelity, rollback hint, and the hard floor — only matrix-declared,
// ~/-anchored reap paths are ever touched.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main, read_consent } from '../../../src/scripts/_cli/cmd_converge.js';

interface Sink {
    text: string;
    write: (t: string) => void;
}
function sink(): Sink {
    const s: Sink = { text: '', write: (t: string) => void (s.text += t) };
    return s;
}

const MATRIX_WITH_DUP = `
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
      action: plugin-uninstall
      command: "claude plugin uninstall agent-config@event4u-agent-config"
      reaps:
        - "~/.claude/plugins/cache/event4u-agent-config"
        - "/etc/passwd"
  augment:
    surface: projection
    scope_path: "~/.augment/"
    hooks: settings-hooks-opt-in
    duplicate:
      pending_evidence: unverified — never acted on
`;

describe('cmd_converge', () => {
    let tmp: string;
    let home: string;
    let pkgRoot: string;
    let settingsPath: string;
    let ran: string[][];
    const runner = (cmd: string[]): number => {
        ran.push(cmd);
        return 0;
    };

    function writeMatrix(body: string): void {
        const cfg = path.join(pkgRoot, 'src', 'config');
        fs.mkdirSync(cfg, { recursive: true });
        fs.writeFileSync(path.join(cfg, 'surface-matrix.yml'), body, 'utf-8');
    }

    function makeDuplicate(): void {
        fs.mkdirSync(path.join(home, '.claude', 'skills'), { recursive: true });
        fs.mkdirSync(path.join(home, '.claude', 'plugins', 'cache', 'event4u-agent-config'), {
            recursive: true,
        });
        fs.writeFileSync(
            path.join(home, '.claude', 'plugins', 'cache', 'event4u-agent-config', 'x.txt'),
            'snapshot',
        );
    }

    function opts(extra: Record<string, unknown> = {}) {
        return {
            runner,
            home,
            package_root: pkgRoot,
            settings_path: settingsPath,
            confirm: () => false,
            out: sink(),
            err: sink(),
            ...extra,
        };
    }

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'converge-'));
        home = path.join(tmp, 'home');
        pkgRoot = path.join(tmp, 'pkg');
        settingsPath = path.join(tmp, 'global', 'agent-settings.yml');
        fs.mkdirSync(home, { recursive: true });
        ran = [];
        writeMatrix(MATRIX_WITH_DUP);
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('nothing to converge → exit 0, no actions', () => {
        const out = sink();
        const rc = main([], opts({ out }));
        expect(rc).toBe(0);
        expect(out.text).toContain('nothing to converge');
        expect(ran).toEqual([]);
    });

    it('dry-run prints the exact actions and touches nothing', () => {
        makeDuplicate();
        const out = sink();
        const rc = main(['--dry-run'], opts({ out }));
        expect(rc).toBe(0);
        expect(out.text).toContain('claude plugin uninstall agent-config@event4u-agent-config');
        expect(out.text).toContain('~/.claude/plugins/cache/event4u-agent-config');
        expect(ran).toEqual([]);
        // Nothing removed, no consent persisted.
        expect(fs.existsSync(path.join(home, '.claude', 'plugins', 'cache', 'event4u-agent-config'))).toBe(true);
        expect(fs.existsSync(settingsPath)).toBe(false);
    });

    it('no consent key + declined confirm → refusal, exit 1, nothing touched', () => {
        makeDuplicate();
        const err = sink();
        const rc = main([], opts({ err, confirm: () => false }));
        expect(rc).toBe(1);
        expect(err.text).toContain('converge refused');
        expect(err.text).toContain('install.auto_converge');
        expect(ran).toEqual([]);
        expect(fs.existsSync(path.join(home, '.claude', 'plugins', 'cache', 'event4u-agent-config'))).toBe(true);
    });

    it('interactive yes → converges and persists standing consent', () => {
        makeDuplicate();
        const out = sink();
        const rc = main([], opts({ out, confirm: () => true }));
        expect(rc).toBe(0);
        expect(ran).toEqual([['claude', 'plugin', 'uninstall', 'agent-config@event4u-agent-config']]);
        expect(read_consent(settingsPath)).toBe(true);
        expect(fs.existsSync(path.join(home, '.claude', 'plugins', 'cache', 'event4u-agent-config'))).toBe(false);
    });

    it('standing consent key → converges without asking', () => {
        makeDuplicate();
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
        fs.writeFileSync(settingsPath, 'install:\n  auto_converge: true\n', 'utf-8');
        const out = sink();
        const rc = main([], opts({ out, confirm: () => { throw new Error('must not ask'); } }));
        expect(rc).toBe(0);
        expect(ran.length).toBe(1);
    });

    it('--yes grants consent for the run and persists the key', () => {
        makeDuplicate();
        const out = sink();
        const rc = main(['--yes'], opts({ out, confirm: () => { throw new Error('must not ask'); } }));
        expect(rc).toBe(0);
        expect(read_consent(settingsPath)).toBe(true);
    });

    it('hard floor: non-~/ matrix reap entries are refused (never touched)', () => {
        makeDuplicate();
        const out = sink();
        const rc = main(['--yes'], opts({ out }));
        expect(rc).toBe(0);
        // /etc/passwd from the matrix fixture was filtered out, not reaped.
        expect(out.text).not.toContain('/etc/passwd');
        expect(fs.existsSync('/etc/passwd')).toBe(true);
    });

    it('reports a rollback hint after converging', () => {
        makeDuplicate();
        const out = sink();
        main(['--yes'], opts({ out }));
        expect(out.text).toContain('Rollback hint');
        expect(out.text).toContain('claude plugin marketplace add event4u-app/agent-config');
        expect(out.text).toContain('the file projection is untouched');
    });

    it('pending_evidence classes are never acted on', () => {
        makeDuplicate();
        fs.mkdirSync(path.join(home, '.augment'), { recursive: true });
        const out = sink();
        main(['--dry-run'], opts({ out }));
        expect(out.text).not.toContain('augment');
    });
});
