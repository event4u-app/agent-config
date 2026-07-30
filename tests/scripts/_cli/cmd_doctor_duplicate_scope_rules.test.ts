// Unit tests for the `duplicate-scope-rules` doctor check
// (road-to-cache-economy Phase 3, C-2). Exercises the check on synthetic
// two-scope and one-scope fixtures — never the real `~/.claude/rules` on the
// machine running the suite (the `userRulesDirOverride` param exists for
// exactly this).

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _check_duplicate_scope_rules } from '../../../src/scripts/_cli/cmd_doctor.js';

function writeRule(dir: string, name: string, body: string): void {
    fs.writeFileSync(path.join(dir, name), body);
}

describe('doctor — duplicate-scope-rules check', () => {
    let tmp: string;
    let userRulesDir: string;
    let projectRulesDir: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dup-scope-'));
        userRulesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dup-scope-user-'));
        // A consumer-shaped project: not the agent-config source repo (no
        // dist/agent-src/rules of its own), but a projected .augment/rules
        // tree — one of the `_RULE_PROJECTION_DIRS` this check also checks.
        projectRulesDir = path.join(tmp, '.augment', 'rules');
        fs.mkdirSync(projectRulesDir, { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.rmSync(userRulesDir, { recursive: true, force: true });
    });

    it('warns with the estimated token cost and names project scope authoritative on a two-scope install', () => {
        const shared = 'x'.repeat(400); // 400 chars -> 100 tokens at chars/4
        writeRule(userRulesDir, 'commit-policy.md', shared);
        writeRule(projectRulesDir, 'commit-policy.md', shared);
        writeRule(userRulesDir, 'user-only.md', 'y'.repeat(50));
        writeRule(projectRulesDir, 'project-only.md', 'z'.repeat(50));

        const res = _check_duplicate_scope_rules(tmp, userRulesDir);
        expect(res['status']).toBe('warn');
        const msg = res['message'] as string;
        expect(msg).toContain('1 rule(s)');
        expect(msg).toContain('100 redundant tokens');
        expect(msg).toContain('Project scope is authoritative');
        expect(res['remedy']).toContain('detection only');
        expect(res['remedy']).not.toContain('delete');
    });

    it('stays silent (ok, no warning) on a single-scope install — no shared filenames', () => {
        writeRule(userRulesDir, 'user-only.md', 'a'.repeat(100));
        writeRule(projectRulesDir, 'project-only.md', 'b'.repeat(100));

        const res = _check_duplicate_scope_rules(tmp, userRulesDir);
        expect(res['status']).toBe('ok');
        expect(res['message']).toContain('no shared');
    });

    it('skips when no project-scope rule tree exists', () => {
        fs.rmSync(projectRulesDir, { recursive: true, force: true });
        writeRule(userRulesDir, 'commit-policy.md', 'x'.repeat(100));

        const res = _check_duplicate_scope_rules(tmp, userRulesDir);
        expect(res['status']).toBe('skipped');
        expect(res['message']).toContain('no project-scope rule tree found');
    });

    it('stays silent when the user-scope directory does not exist at all', () => {
        writeRule(projectRulesDir, 'commit-policy.md', 'x'.repeat(100));
        const res = _check_duplicate_scope_rules(tmp, path.join(tmp, 'no-such-user-rules'));
        expect(res['status']).toBe('ok');
    });
});
