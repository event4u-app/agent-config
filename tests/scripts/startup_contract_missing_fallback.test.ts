// A consequence-class rule whose contract file is missing must not lose its
// floor: build_thin keeps the whole rule rather than a pointer stub. The CI
// gate check_startup_contracts already refuses a missing contract; this pins
// what an install does if one ever reaches it anyway.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { lawText, ruleBody } from '../../src/scripts/_lib/rule_law_section.js';
import { build_thin, is_thin_entry } from '../../src/scripts/_lib/thin_rules.js';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const DROPPED = ['legal-safety-floor', 'domain-safety-pii', 'user-interrupt-priority'];

describe('a required rule with no contract file stays whole', () => {
    let tmp: string;
    let stubs: Map<string, string>;
    beforeAll(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-contract-'));
        fs.cpSync(path.join(REPO, 'dist', 'agent-src', 'rules'), path.join(tmp, 'rules'), { recursive: true });
        fs.cpSync(path.join(REPO, 'dist', 'agent-src', 'startup-contracts'), path.join(tmp, 'startup-contracts'), { recursive: true });
        for (const id of DROPPED) fs.rmSync(path.join(tmp, 'startup-contracts', 'rules', `${id}.md`));
        stubs = build_thin(path.join(tmp, 'rules'), null, null, null, { packageRoot: REPO });
    });
    afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it.each(DROPPED)('%s is delivered byte-identical to its full rule', (id) => {
        expect(stubs.get(`${id}.md`)).toBe(fs.readFileSync(path.join(tmp, 'rules', `${id}.md`), 'utf8'));
    });
});

// Round 25 (openai): if the clause audit is also absent or malformed, the
// declared set cannot be read. Fail safe: every high-consequence or
// safety-floor rule without a contract stays whole.
describe.each([
    ['absent', null],
    ['malformed', '{ not json'],
    ['wrong shape', '{"rules": []}'],
])('with the clause audit %s and the contracts missing', (_label, audit) => {
    let tmp: string;
    let stubs: Map<string, string>;
    beforeAll(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-audit-'));
        const pkg = path.join(tmp, 'pkg');
        fs.cpSync(path.join(REPO, 'dist', 'agent-src', 'rules'), path.join(pkg, 'dist', 'agent-src', 'rules'), { recursive: true });
        fs.cpSync(path.join(REPO, 'dist', 'agent-src', 'startup-contracts'), path.join(pkg, 'dist', 'agent-src', 'startup-contracts'), { recursive: true });
        fs.cpSync(path.join(REPO, 'dist', 'router.json'), path.join(pkg, 'dist', 'router.json'));
        fs.cpSync(path.join(REPO, 'src', 'config'), path.join(pkg, 'src', 'config'), { recursive: true });
        const auditPath = path.join(pkg, 'src', 'config', 'startup-contract-clauses.json');
        if (audit === null) fs.rmSync(auditPath);
        else fs.writeFileSync(auditPath, audit);
        for (const id of DROPPED) fs.rmSync(path.join(pkg, 'dist', 'agent-src', 'startup-contracts', 'rules', `${id}.md`));
        stubs = build_thin(path.join(pkg, 'dist', 'agent-src', 'rules'), null, null, null, { packageRoot: pkg });
    });
    afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it.each(DROPPED)('%s is delivered byte-identical to its full rule', (id) => {
        expect(stubs.get(`${id}.md`)).toBe(fs.readFileSync(path.join(tmp, 'pkg', 'dist', 'agent-src', 'rules', `${id}.md`), 'utf8'));
    });
});

// Round 26 (openai): a READABLE audit that omits a rule. CI refuses that audit
// (check_startup_contracts: "no clause audit"), so it needs a damaged package.
// Even then a high-consequence member never falls to a bare pointer: it gets
// the law stub — its Iron Law byte-copied — the form a thinned layer gave it
// before contracts existed.
describe.each([
    ['empty', () => JSON.stringify({ rules: {} })],
    ['missing the dropped entries', () => {
        const full = JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'config', 'startup-contract-clauses.json'), 'utf8')) as { rules: Record<string, unknown> };
        for (const id of DROPPED) delete full.rules[id];
        return JSON.stringify(full);
    }],
])('with a readable audit %s and the contracts missing', (_label, audit) => {
    let tmp: string;
    let stubs: Map<string, string>;
    beforeAll(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'partial-audit-'));
        const pkg = path.join(tmp, 'pkg');
        fs.cpSync(path.join(REPO, 'dist', 'agent-src', 'rules'), path.join(pkg, 'dist', 'agent-src', 'rules'), { recursive: true });
        fs.cpSync(path.join(REPO, 'dist', 'agent-src', 'startup-contracts'), path.join(pkg, 'dist', 'agent-src', 'startup-contracts'), { recursive: true });
        fs.cpSync(path.join(REPO, 'dist', 'router.json'), path.join(pkg, 'dist', 'router.json'));
        fs.cpSync(path.join(REPO, 'src', 'config'), path.join(pkg, 'src', 'config'), { recursive: true });
        fs.writeFileSync(path.join(pkg, 'src', 'config', 'startup-contract-clauses.json'), audit());
        for (const id of DROPPED) fs.rmSync(path.join(pkg, 'dist', 'agent-src', 'startup-contracts', 'rules', `${id}.md`));
        stubs = build_thin(path.join(pkg, 'dist', 'agent-src', 'rules'), null, null, null, { packageRoot: pkg });
    });
    afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it.each(DROPPED)('%s is never a bare pointer: whole, or a stub carrying its Iron Law verbatim', (id) => {
        const full = fs.readFileSync(path.join(tmp, 'pkg', 'dist', 'agent-src', 'rules', `${id}.md`), 'utf8');
        const out = stubs.get(`${id}.md`) as string;
        if (is_thin_entry(out)) {
            expect(out).toContain(lawText(ruleBody(full)) as string);
        } else {
            expect(out).toBe(full);
        }
    });
});
