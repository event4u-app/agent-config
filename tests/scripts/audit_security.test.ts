import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { auditSecurity, exitCode } from '../../src/scripts/audit_security.js';

function project(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-security-'));
    for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), text);
    }
    return root;
}

const lock = (pkgs: Record<string, Record<string, unknown>>) =>
    JSON.stringify({ name: 'app', lockfileVersion: 3, packages: { '': { name: 'app' }, ...Object.fromEntries(Object.entries(pkgs).map(([n, p]) => [`node_modules/${n}`, { version: '1.0.0', resolved: `https://registry.npmjs.org/${n}/-/${n}-1.0.0.tgz`, ...p }])) } }, null, 2);

const DANGEROUS_WF = `on: pull_request_target
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      - run: npm test
`;

/** One planted defect per lens. */
const seeded = () =>
    project({
        Dockerfile: 'FROM node:22\n',
        'package-lock.json': lock({ expres: {}, 'left-pad': { hasInstallScript: true } }),
        '.github/workflows/ci.yml': DANGEROUS_WF,
    });

/** The same project with the defects removed and the containment section in place. */
const clean = () =>
    project({
        Dockerfile: 'FROM node:22\n',
        'package-lock.json': lock({ express: {} }),
        '.github/workflows/ci.yml': 'on: push\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n',
        'agents/settings/security-ops.yml':
            'schema_version: 1\noperator_path: sso\nbreak_glass: cli\nlevers:\n  - id: off\n    level: L3\n    fail_mode: closed\n    owner: on-call\n    release: control-surface\n',
        'docs/runbooks/rollback.md': '# Rollback\n',
    });

const lens = (r: ReturnType<typeof auditSecurity>, name: string) => r.lenses.find((l) => l.lens === name)!;

describe('audit:security', () => {
    it('finds the planted defect in every lens', () => {
        const r = auditSecurity(seeded());
        const supply = lens(r, 'supply');
        expect(supply.status).toBe('finding');
        expect(supply.findings.map((f) => f.detail).join(' ')).toMatch(/expres.*express/);
        expect(supply.findings.map((f) => f.detail).join(' ')).toMatch(/left-pad.*install script/);
        expect(lens(r, 'pipeline').status).toBe('finding');
        expect(lens(r, 'contain').status).toBe('finding');
        expect(lens(r, 'contain').findings[0]!.detail).toMatch(/no lever inventory/);
        expect(lens(r, 'recover').status).toBe('finding');
        expect(exitCode(r)).toBe(1);
    });

    it('reports ok on the cleaned twin, with file:line on every finding it would raise', () => {
        const r = auditSecurity(clean());
        for (const l of ['supply', 'pipeline', 'contain', 'recover']) expect([l, lens(r, l).status]).toEqual([l, 'ok']);
        expect(exitCode(r)).toBe(0);
        for (const l of auditSecurity(seeded()).lenses) for (const f of l.findings) expect(f.where).toMatch(/:\d+$|^[^:]+$/);
    });

    it('never reports a lens it could not read as ok', () => {
        const root = project({ Dockerfile: 'FROM node:22\n', 'package-lock.json': '{ not json', 'agents/settings/security-ops.yml': ': : :\n  - [', 'docs/runbook.md': '# Runbook\n' });
        const r = auditSecurity(root);
        expect(lens(r, 'supply').status).toBe('unknown');
        expect(lens(r, 'contain').status).toBe('unknown');
        expect(exitCode(r)).toBe(3);
    });

    it('a library with no deploy signal is not-applicable for contain and recover', () => {
        const r = auditSecurity(project({ 'package-lock.json': lock({ express: {} }) }));
        expect(lens(r, 'contain').status).toBe('not-applicable');
        expect(lens(r, 'recover').status).toBe('not-applicable');
    });

    it('routes run, code and agents to the audits that own them, and gives no total score', () => {
        const r = auditSecurity(clean());
        expect(r.routed).toEqual(['/audit deps', '/audit code', '/audit agents']);
        expect(Object.keys(r)).not.toContain('score');
    });

    it('an invalid lever inventory is a finding naming the problem', () => {
        const root = clean();
        fs.writeFileSync(path.join(root, 'agents/settings/security-ops.yml'), 'schema_version: 1\noperator_path: url-secret\nbreak_glass: cli\nlevers:\n  - id: x\n    level: L1\n    owner: a\n    release: cli\n');
        const c = lens(auditSecurity(root), 'contain');
        expect(c.status).toBe('finding');
        expect(c.findings.map((f) => f.detail).join(' ')).toMatch(/fail_mode/);
    });

    it('a well-known package that happens to sit one edit from another is not a typo-squat, and a package is reported once', () => {
        const root = project({ 'package-lock.json': lock({ preact: {}, react: {}, fsevents: { hasInstallScript: true }, 'a/node_modules/fsevents': { hasInstallScript: true } }) });
        const details = lens(auditSecurity(root), 'supply').findings.map((f) => f.detail);
        expect(details.join(' ')).not.toMatch(/preact/);
        expect(details.filter((d) => d.startsWith('fsevents'))).toHaveLength(1);
    });
});
