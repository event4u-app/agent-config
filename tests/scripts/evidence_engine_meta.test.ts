// Evidence-engine meta-tests (road-to-feedback-9.8.0-followups Phase 3):
// the engine that checks claims gets checked. One fixture per failure mode
// the reviews named — each must be caught RED by the engine's own seams:
//   1. false-positive script  — a rubber-stamp command outside the allowlist
//   2. stale fixture          — a pointer whose anchor text no longer exists
//   3. manipulated denominator— published backed-count vs live ledger
//   4. non-deterministic path — shell metacharacters / repo-escape in exec args
//   5. local-only counted as CI — taskfile-only validator must not rank blocking
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    parse_exec_pointer,
    split_argv,
    command_is_allowlisted,
    args_are_safe,
} from '../../src/scripts/_lib/exec_evidence.js';
import { REPO, count_backed, pointer_unresolved } from '../../src/scripts/check_claims.js';
import {
    resolve_one,
    strongest,
    parse_hook_manifest,
    type Resolution,
} from '../../src/scripts/check_enforcement_coverage.js';

describe('evidence-engine meta — each failure mode is caught red', () => {
    it('1. false-positive script: a rubber-stamp command outside the allowlist is rejected', () => {
        // `true` exits 0 forever — the perfect liar. The allowlist, not the
        // exit code, is what stops it from carrying evidence.
        const p = parse_exec_pointer('exec:true -> 0');
        expect(p).not.toBeNull();
        expect(command_is_allowlisted(split_argv('true'))).toBe(false);
        // Control: a real allowlisted gate is accepted.
        expect(command_is_allowlisted(split_argv('lint_agent_security'))).toBe(true);
    });

    it('2. stale fixture: a resolving file with a vanished anchor is a red pointer', () => {
        // README.md exists; the anchor text does not. Existence alone must
        // not keep the claim green.
        const stale = pointer_unresolved('README.md#this-anchor-text-was-deleted-long-ago-xyzzy');
        expect(stale, 'stale anchor must be reported unresolved').not.toBeNull();
        // Control: the same file with no anchor resolves (existence check).
        expect(pointer_unresolved('README.md')).toBeNull();
    });

    it('3. manipulated denominator: the published backed-count is derived from the live ledger', () => {
        const rel = 'internal/reports/exec-evidence-feasibility.json';
        const report = JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8')) as {
            backed_claims: number;
        };
        // count_backed() re-derives from docs/CLAIMS.md; the check_claims gate
        // compares exactly these two numbers and goes red on drift (it fired
        // live on 2026-07-28 when a new backed entry landed without the
        // report update). This meta-test pins the derivation stays wired.
        expect(report.backed_claims).toBe(count_backed());
    });

    it('4. non-deterministic / injectable exec args are rejected before running', () => {
        // Shell metacharacters would let a pointer smuggle `; rm -rf` or a
        // time-dependent subshell — argv-level checks refuse them.
        expect(args_are_safe(split_argv('lint_agent_security $(date +%s)'))).toBe(false);
        expect(args_are_safe(split_argv('lint_agent_security ../../etc/passwd'))).toBe(false);
        expect(args_are_safe(split_argv('lint_agent_security a|b'))).toBe(false);
    });

    it('5. a taskfile-only validator resolves validator-local, never blocking', () => {
        // Wiring corpus reaches the script ONLY locally (taskfile) → the rule
        // may not be counted as CI-blocking. This is the "local-only gate
        // counted as CI" inflation the reviews flagged.
        const hooks = parse_hook_manifest('');
        const decl = 'validator:src/scripts/lint_skills.ts';
        const exists = (): boolean => true;
        const r: Resolution = resolve_one(decl, {
            reachable_ci: new Set<string>(),
            reachable_local: new Set(['src/scripts/lint_skills.ts']),
            hooks,
            exists,
        }).resolution;
        expect(r).toBe('validator-local');
        expect(strongest([r])).toBe('validator-local');
        // Control: the same declaration reachable from CI ranks validator.
        const r2 = resolve_one(decl, {
            reachable_ci: new Set(['src/scripts/lint_skills.ts']),
            reachable_local: new Set<string>(),
            hooks,
            exists,
        }).resolution;
        expect(r2).toBe('validator');
    });
});
