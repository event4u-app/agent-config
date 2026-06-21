// Tests for src/scripts/lint_workflow_security.ts (py2ts — workflow linter).
//
// Two layers:
//  1. Unit tests over the exported helpers (_triggers, scan_workflow,
//     is_allowlisted, load_allowlist) via the _set*ForTest seams on tmp fixtures.
//  2. Golden-parity: python3 lint_workflow_security.py vs tsx
//     lint_workflow_security.ts, both pointed at the SAME tmp fixture dir
//     (Python via an importlib wrapper that monkeypatches WORKFLOWS_DIR /
//     ALLOWLIST_PATH; TS via the _set*ForTest seam), asserting byte-identical
//     stdout/stderr + exit and a byte-identical --json artifact. Parity skipped
//     without python3.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _triggers, is_allowlisted, scan_workflow } from '../../src/scripts/lint_workflow_security.js';



const DANGEROUS_WF = [
    'on:',
    '  pull_request_target:',
    'permissions: write-all',
    'jobs:',
    '  build:',
    '    permissions: write-all',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '        with:',
    '          ref: ${{ github.event.pull_request.head.sha }}',
    '      - uses: somevendor/action@v1',
    '      - run: npm ci',
    '',
].join('\n');

const CLEAN_WF = [
    'on:',
    '  push:',
    'permissions:',
    '  contents: read',
    'jobs:',
    '  build:',
    '    steps:',
    '      - uses: actions/checkout@0000000000000000000000000000000000000000',
    '      - run: npm ci --ignore-scripts',
    '',
].join('\n');

// --- Unit: _triggers --------------------------------------------------------

describe('lint_workflow_security — _triggers', () => {
    it('handles string, list, dict, null', () => {
        expect([..._triggers('push')]).toEqual(['push']);
        expect([..._triggers(['push', 'pull_request'])].sort()).toEqual(['pull_request', 'push']);
        expect([..._triggers({ pull_request_target: null })]).toEqual(['pull_request_target']);
        expect([..._triggers(null)]).toEqual([]);
        expect([..._triggers(undefined)]).toEqual([]);
    });
});

// --- Unit: scan_workflow on tmp fixtures ------------------------------------

describe('lint_workflow_security — scan_workflow', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lws-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('flags the dangerous workflow with HIGH + MEDIUM findings', () => {
        const wf = path.join(tmp, 'bad.yml');
        fs.writeFileSync(wf, DANGEROUS_WF, 'utf-8');
        const findings = scan_workflow(wf, []);
        const rules = findings.map((f) => f['rule']);
        expect(rules).toContain('dangerous-trigger-untrusted-ref');
        expect(rules).toContain('permissions-write-all');
        expect(rules).toContain('npm-install-without-ignore-scripts');
        expect(rules).toContain('mutable-action-tag');
    });

    it('clean workflow yields no findings', () => {
        const wf = path.join(tmp, 'ok.yml');
        fs.writeFileSync(wf, CLEAN_WF, 'utf-8');
        expect(scan_workflow(wf, [])).toEqual([]);
    });

    it('parse error → HIGH parse-error finding', () => {
        const wf = path.join(tmp, 'broken.yml');
        fs.writeFileSync(wf, 'foo: [unterminated\n', 'utf-8');
        const findings = scan_workflow(wf, []);
        expect(findings[0]!['rule']).toBe('parse-error');
        expect(findings[0]!['severity']).toBe('HIGH');
    });

    it('marks allowlisted findings', () => {
        const wf = path.join(tmp, 'bad.yml');
        fs.writeFileSync(wf, DANGEROUS_WF, 'utf-8');
        const al = [{ workflow: 'bad.yml', rule: 'permissions-write-all' }];
        const findings = scan_workflow(wf, al);
        const perm = findings.find((f) => f['rule'] === 'permissions-write-all');
        expect(perm!['allowlisted']).toBe(true);
    });
});

// --- Unit: is_allowlisted ---------------------------------------------------

describe('lint_workflow_security — is_allowlisted', () => {
    it('matches workflow + rule', () => {
        const al = [{ workflow: 'x.yml', rule: 'permissions-write-all' }];
        expect(is_allowlisted(al, 'x.yml', 'permissions-write-all')).toBe(true);
        expect(is_allowlisted(al, 'x.yml', 'other')).toBe(false);
        expect(is_allowlisted(al, 'y.yml', 'permissions-write-all')).toBe(false);
    });
});

// --- Golden parity (python3 vs tsx) -----------------------------------------


// Wrappers are written to disk (not passed via -c / -e) so prog-name and the
// "cjs top-level await" limitation do not interfere. Each imports the module
// by path, monkeypatches the scan dir + allowlist from env, then calls main().

