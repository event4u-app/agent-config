// Unit tests for the `rule-scope-drift` doctor check (road-to-request-scoped-
// rule-load, 9.0 consumer flip). Exercises the derive-scope + diff logic on
// synthetic consumer projection fixtures — a temp project root with a
// `.agent-settings.yml` scope and a projected `.augment/rules` tree — rather
// than the real repo (where the check correctly reports `skipped`).

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _check_rule_scope_drift } from '../../../src/scripts/_cli/cmd_doctor.js';

/** A consumer-shaped rule .md file with the given frontmatter workspaces. */
function writeRule(dir: string, name: string, workspaces: string[] | null, kernel = false): void {
    const fm: string[] = [];
    if (kernel) fm.push('type: always');
    if (workspaces !== null) fm.push(`workspaces: [${workspaces.join(', ')}]`);
    const front = fm.length > 0 ? `---\n${fm.join('\n')}\n---\n` : '';
    fs.writeFileSync(path.join(dir, name), `${front}# ${name}\n\nbody\n`);
}

describe('doctor — rule-scope-drift check', () => {
    let tmp: string;
    let rulesDir: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rsd-'));
        rulesDir = path.join(tmp, '.augment', 'rules');
        fs.mkdirSync(rulesDir, { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function writeSettings(rule_workspaces: string[] | null): void {
        const yml =
            rule_workspaces === null
                ? 'onboarding:\n  onboarded: true\n'
                : `projection:\n  rule_workspaces: [${rule_workspaces.join(', ')}]\n`;
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), yml);
    }

    it('flags a stale full/global projection with an actionable diff', () => {
        // Scoped consumer: workspaces = [event4u-app]. But the projected tree
        // still carries pre-flip maintainer-only rules + the compat-excluded
        // source-of-truth.md — leftover from a pre-9.0 full projection.
        writeSettings(['event4u-app']);
        writeRule(rulesDir, 'downstream-changes.md', null); // untagged → in scope
        writeRule(rulesDir, 'commit-policy.md', null); // untagged → in scope
        writeRule(rulesDir, 'non-destructive-by-default.md', null, true); // kernel → in scope
        writeRule(rulesDir, 'source-of-truth.md', ['event4u-app']); // compat-excluded always
        writeRule(rulesDir, 'kernel-rule-edits.md', ['agent-config-maintainer']); // out of scope
        writeRule(rulesDir, 'preservation-guard.md', ['agent-config-maintainer']); // out of scope

        const res = _check_rule_scope_drift(tmp);
        expect(res['status']).toBe('warn');
        const msg = res['message'] as string;
        // 6 found, 3 unexpected (2 maintainer + source-of-truth), 3 expected.
        expect(msg).toContain('expected 3 rules, found 6');
        expect(msg).toContain('3 unexpected');
        expect(msg).toContain('kernel-rule-edits.md');
        expect(msg).toContain('preservation-guard.md');
        expect(msg).toContain('source-of-truth.md');
        expect(res['remedy']).toContain('re-project');
    });

    it('reports ok when the projection already matches the scope', () => {
        writeSettings(['event4u-app']);
        writeRule(rulesDir, 'downstream-changes.md', null);
        writeRule(rulesDir, 'commit-policy.md', null);
        writeRule(rulesDir, 'non-destructive-by-default.md', null, true);

        const res = _check_rule_scope_drift(tmp);
        expect(res['status']).toBe('ok');
        expect(res['message']).toContain('3 rules');
    });

    it('legacy-all settings only flag the compat exclusion (source-of-truth.md)', () => {
        writeSettings(null); // no projection.rule_workspaces → legacy-all
        writeRule(rulesDir, 'downstream-changes.md', null);
        writeRule(rulesDir, 'kernel-rule-edits.md', ['agent-config-maintainer']); // ships under legacy-all
        writeRule(rulesDir, 'source-of-truth.md', null); // compat-excluded on every path

        const res = _check_rule_scope_drift(tmp);
        expect(res['status']).toBe('warn');
        const msg = res['message'] as string;
        expect(msg).toContain('1 unexpected');
        expect(msg).toContain('source-of-truth.md');
        expect(msg).not.toContain('kernel-rule-edits.md');
    });

    it('skips when no projected rule tree is present', () => {
        fs.rmSync(rulesDir, { recursive: true, force: true });
        writeSettings(['event4u-app']);
        const res = _check_rule_scope_drift(tmp);
        expect(res['status']).toBe('skipped');
        expect(res['message']).toContain('no projected rule tree');
    });
});
