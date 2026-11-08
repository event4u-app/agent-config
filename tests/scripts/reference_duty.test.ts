/**
 * The reference duty, observed: which references a file act requires, and
 * whether the session's read ledger shows them read. Observation only.
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { dutyStates, scanActDuties, scanDuties } from '../../src/scripts/_lib/reference_duty.js';
import { _concern_matches_tool, _load_yaml, _resolve_concerns } from '../../src/scripts/hooks/dispatch_hook.js';
import { ledgerFile, MAX_DUTY_KEYS } from '../../src/scripts/hooks/reread_guard_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'reread_guard_hook.ts');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const tmps: string[] = [];
afterEach(() => {
    for (const t of tmps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});

// Real rules write references relative to the rule file: `../contexts/...`.
const REF = '../contexts/sot-mechanics.md';
const RESOLVED = 'dist/agent-src/contexts/sot-mechanics.md';

function workspace(): string {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ref-duty-'));
    tmps.push(root);
    const rules = path.join(root, 'dist', 'agent-src', 'rules');
    fs.mkdirSync(rules, { recursive: true });
    fs.mkdirSync(path.join(root, 'dist', 'agent-src', 'contexts'), { recursive: true });
    fs.writeFileSync(path.join(root, RESOLVED), 'mechanics\n');
    fs.writeFileSync(
        path.join(root, 'dist', 'router.json'),
        JSON.stringify({
            kernel: [],
            tier_1: [{ id: 'sot', triggers: [{ path_prefix: '.claude/' }, { path_prefix: 'dist/agent-src/' }, { keyword: 'source' }] }],
            tier_2: [
                { id: 'ui', triggers: [{ file_pattern: '*.vue' }] },
                { id: 'talk', triggers: [{ keyword: 'ask' }] },
            ],
        }),
    );
    fs.writeFileSync(path.join(rules, 'sot.md'), `---\ntype: "auto"\nload_context:\n  - ${REF}\n---\n\n# sot\n`);
    fs.writeFileSync(path.join(rules, 'ui.md'), '---\ntype: "auto"\n---\n\n# ui\n');
    fs.writeFileSync(path.join(rules, 'talk.md'), `---\ntype: "auto"\nload_context:\n  - ${REF}\n---\n\n# talk\n`);
    return root;
}

function run(root: string, payload: object, event = 'pre_tool_use'): void {
    const input = JSON.stringify({ schema_version: 1, platform: 'claude', event, session_id: 's1', workspace_root: root, payload });
    const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd: root, input, env: { ...process.env, AGENT_CONFIG_PACKAGE_ROOT: '' } });
    expect(r.status).not.toBeNull();
}

function duty(root: string): Record<string, { state: string }> {
    const key = crypto.createHash('sha256').update('s1').digest('hex');
    return (JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as { duty?: Record<string, { state: string }> }).duty ?? {};
}

describe('scanDuties', () => {
    it('names the references of rules whose path or file trigger matches, and only those', () => {
        const root = workspace();
        expect(scanDuties('.claude/settings.json', root).duties).toEqual([{ rule: 'sot', reference: REF, resolved: RESOLVED }]);
        expect(scanDuties('src/App.vue', root).duties).toEqual([]);
        expect(scanDuties('src/a.ts', root).duties).toEqual([]);
    });
});

describe('dutyStates', () => {
    it('is read only when the ledger holds a full read of the reference', () => {
        const d = [{ rule: 'sot', reference: REF, resolved: RESOLVED }];
        const root = workspace();
        const st = fs.statSync(path.join(root, RESOLVED));
        const rec = { mtime: st.mtimeMs, size: st.size };
        expect(dutyStates(d, {}, root)).toEqual({ [`sot::${REF}`]: 'required-pending' });
        expect(dutyStates(d, { [RESOLVED]: rec }, root)).toEqual({ [`sot::${REF}`]: 'read' });
        expect(dutyStates(d, { 'elsewhere/contexts/sot-mechanics.md': rec }, root)).toEqual({ [`sot::${REF}`]: 'required-pending' });
    });
});

describe('E2E: the hook records the duty and changes nothing else', () => {
    it('records required-pending on a write under the trigger, then read after a whole-file read', () => {
        const root = workspace();
        const target = path.join(root, '.claude', 'x.md');
        run(root, { tool_name: 'Write', tool_input: { file_path: target, content: 'x' } });
        expect(duty(root)[`sot::${REF}`]?.state).toBe('required-pending');
        run(root, { tool_name: 'Read', tool_input: { file_path: path.join(root, RESOLVED) } });
        run(root, { tool_name: 'Edit', tool_input: { file_path: target, old_string: 'x', new_string: 'y' } });
        expect(duty(root)[`sot::${REF}`]?.state).toBe('read');
    });
    it('records the duty for a write under an exempt path such as dist/agent-src/', () => {
        const root = workspace();
        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, 'dist', 'agent-src', 'rules', 'new.md'), content: 'x' } });
        expect(duty(root)[`sot::${REF}`]?.state).toBe('required-pending');
    });
});

describe('council round 1 findings', () => {
    it('does not credit a read of a reference that changed since', () => {
        const root = workspace();
        const ref = path.join(root, RESOLVED);
        const st = fs.statSync(ref);
        const d = [{ rule: 'sot', reference: REF, resolved: RESOLVED }];
        expect(dutyStates(d, { [RESOLVED]: { mtime: st.mtimeMs, size: st.size } }, root)).toEqual({ [`sot::${REF}`]: 'read' });
        expect(dutyStates(d, { [RESOLVED]: { mtime: st.mtimeMs, size: st.size + 1 } }, root)).toEqual({ [`sot::${REF}`]: 'required-pending' });
    });
    it('counts every observation instead of keeping only the last', () => {
        const root = workspace();
        const target = path.join(root, '.claude', 'x.md');
        run(root, { tool_name: 'Write', tool_input: { file_path: target, content: 'x' } });
        run(root, { tool_name: 'Read', tool_input: { file_path: path.join(root, RESOLVED) } });
        run(root, { tool_name: 'Edit', tool_input: { file_path: target, old_string: 'x', new_string: 'y' } });
        expect(duty(root)[`sot::${REF}`]).toMatchObject({ state: 'read', pending: 1, read: 1 });
    });
    it('keeps the write and advisory bookkeeping across a compaction, clearing only reads', () => {
        const root = workspace();
        const target = path.join(root, '.claude', 'x.md');
        run(root, { tool_name: 'Read', tool_input: { file_path: path.join(root, RESOLVED) } });
        run(root, { tool_name: 'Write', tool_input: { file_path: target, content: 'x' } });
        run(root, {}, 'pre_compact');
        const key = crypto.createHash('sha256').update('s1').digest('hex');
        const ledger = JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as Record<string, Record<string, unknown>>;
        expect(ledger['reads']).toEqual({});
        expect(Object.keys(ledger['writes'] ?? {})).toEqual(['.claude/x.md']);
    });
    it('counts a file act whose router cannot be read, instead of reading it as no duty', () => {
        const root = workspace();
        fs.writeFileSync(path.join(root, 'dist', 'router.json'), '{ not json');
        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
        const key = crypto.createHash('sha256').update('s1').digest('hex');
        expect((JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as { duty_errors?: number }).duty_errors).toBe(1);
    });
});

describe('council round 2: one canonical key for reads and duties', () => {
    it('credits a read of a reference that lives outside the workspace, in the user-level package', () => {
        const pkg = workspace();
        const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ref-duty-ws-'));
        tmps.push(root);
        const target = path.join(root, '.claude', 'x.md');
        const env = { AGENT_CONFIG_PACKAGE_ROOT: pkg };
        runEnv(root, { tool_name: 'Write', tool_input: { file_path: target, content: 'x' } }, env);
        expect(duty(root)[`sot::${REF}`]?.state).toBe('required-pending');
        runEnv(root, { tool_name: 'Read', tool_input: { file_path: path.join(pkg, RESOLVED) } }, env);
        runEnv(root, { tool_name: 'Edit', tool_input: { file_path: target, old_string: 'x', new_string: 'y' } }, env);
        expect(duty(root)[`sot::${REF}`]?.state).toBe('read');
    });
});

function runEnv(root: string, payload: object, env: Record<string, string>): void {
    const input = JSON.stringify({ schema_version: 1, platform: 'claude', event: 'pre_tool_use', session_id: 's1', workspace_root: root, payload });
    const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd: root, input, env: { ...process.env, ...env } });
    expect(r.status).not.toBeNull();
}

describe('council round 3: every matched rule yields duties or a counted error', () => {
    it('counts a matched rule whose file is missing', () => {
        const root = workspace();
        fs.rmSync(path.join(root, 'dist', 'agent-src', 'rules', 'sot.md'));
        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
        const key = crypto.createHash('sha256').update('s1').digest('hex');
        expect((JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as { duty_errors?: number }).duty_errors).toBe(1);
    });
    it('counts a router whose tiers are not lists', () => {
        const root = workspace();
        fs.writeFileSync(path.join(root, 'dist', 'router.json'), JSON.stringify({ tier_1: 'oops', tier_2: [{ id: 'sot', triggers: 'nope' }] }));
        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
        const key = crypto.createHash('sha256').update('s1').digest('hex');
        expect((JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as { duty_errors?: number }).duty_errors).toBe(1);
    });
    it('keeps the duty counts and errors across a compaction, clearing only reads', () => {
        const root = workspace();
        const key = crypto.createHash('sha256').update('s1').digest('hex');
        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
        fs.writeFileSync(path.join(root, 'dist', 'router.json'), '{ broken');
        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'y.md'), content: 'y' } });
        const ledgerPath = ledgerFile(root, key);
        const before = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as Record<string, unknown>;
        before['fired'] = { 'src/a.ts': true };
        fs.writeFileSync(ledgerPath, JSON.stringify(before));
        run(root, {}, 'pre_compact');
        const after = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as Record<string, unknown>;
        expect(after['reads']).toEqual({});
        expect(after['duty_errors']).toBe(1);
        expect(after['fired']).toEqual({ 'src/a.ts': true });
        expect(duty(root)[`sot::${REF}`]).toMatchObject({ pending: 1 });
    });
    it('reads an inline load_context list the way YAML does', () => {
        const root = workspace();
        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', 'sot.md'), `---\ntype: "auto"\nload_context: ["${REF}"] # inline\n---\n\n# sot\n`);
        expect(scanDuties('.claude/a.md', root).duties).toEqual([{ rule: 'sot', reference: REF, resolved: RESOLVED }]);
    });
    it.each([
        ['a null tier entry', { tier_1: [null] }],
        ['a trigger that is not an object', { tier_1: [{ id: 'sot', triggers: [5] }] }],
        ['a router that is an array', [{ id: 'sot', triggers: [{ path_prefix: '.claude/' }] }]],
    ])('counts %s, and the hook still exits 0', (_name, router) => {
        const root = workspace();
        fs.writeFileSync(path.join(root, 'dist', 'router.json'), JSON.stringify(router));
        const input = JSON.stringify({ schema_version: 1, platform: 'claude', event: 'pre_tool_use', session_id: 's1', workspace_root: root, payload: { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } } });
        const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd: root, input, env: { ...process.env, AGENT_CONFIG_PACKAGE_ROOT: '' } });
        expect(r.status).toBe(0);
        const key = crypto.createHash('sha256').update('s1').digest('hex');
        expect((JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as { duty_errors?: number }).duty_errors).toBe(1);
    });
    it('counts a rule whose frontmatter is not a mapping', () => {
        const root = workspace();
        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', 'sot.md'), '---\n- just\n- a list\n---\n\n# sot\n');
        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
        const key = crypto.createHash('sha256').update('s1').digest('hex');
        expect((JSON.parse(fs.readFileSync(ledgerFile(root, key), 'utf8')) as { duty_errors?: number }).duty_errors).toBe(1);
    });
});

describe('council round 6', () => {
    it('reads a frontmatter whose closing line is exactly ---, not a line that starts with it', () => {
        const root = workspace();
        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', 'sot.md'), `---\ntype: "auto"\nnote: ---not-the-end\nload_context:\n  - ${REF}\n---\n\n# sot\n`);
        expect(scanDuties('.claude/a.md', root).duties).toEqual([{ rule: 'sot', reference: REF, resolved: RESOLVED }]);
    });
    it('keeps the duties of a healthy matched rule when another matched rule is broken', () => {
        const root = workspace();
        const routerPath = path.join(root, 'dist', 'router.json');
        const router = JSON.parse(fs.readFileSync(routerPath, 'utf8')) as Record<string, unknown>;
        router['tier_2'] = [...(router['tier_2'] as unknown[]), { id: 'ghost', triggers: [{ path_prefix: '.claude/' }] }];
        fs.writeFileSync(routerPath, JSON.stringify(router));
        const scan = scanDuties('.claude/a.md', root);
        expect(scan.duties).toEqual([{ rule: 'sot', reference: REF, resolved: RESOLVED }]);
        expect(scan.errors).toHaveLength(1);
    });
});

describe('ratification entry questions: bounded state', () => {
    it('caps distinct duty keys and counts what it drops', () => {
        const root = workspace();
        const key = crypto.createHash('sha256').update('s1').digest('hex');
        const ledgerPath = ledgerFile(root, key);
        fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
        const duty: Record<string, unknown> = {};
        for (let i = 0; i < MAX_DUTY_KEYS; i++) duty[`r${String(i)}::x`] = { state: 'read', pending: 0, read: 1, ts: 1 };
        fs.writeFileSync(ledgerPath, JSON.stringify({ reads: {}, writes: {}, fired: {}, duty }));
        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
        const after = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as { duty: Record<string, unknown>; duty_overflow?: number };
        expect(Object.keys(after.duty)).toHaveLength(MAX_DUTY_KEYS);
        expect(after.duty_overflow).toBe(1);
    });
});

describe('the shipped manifest routes the read ledger where the duty needs it', () => {
    const manifest = _load_yaml(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'));
    it('runs reread-guard on claude pre_compact', () => {
        expect(_resolve_concerns(manifest, 'claude', 'pre_compact').map((c) => c.name)).toContain('reread-guard');
    });
    it('runs reread-guard on a claude Bash post_tool_use, where a completed cat is credited', () => {
        const concern = _resolve_concerns(manifest, 'claude', 'post_tool_use').find((c) => c.name === 'reread-guard');
        expect(concern).toBeDefined();
        expect(_concern_matches_tool(concern as unknown as Record<string, never>, 'Bash')).toBe(true);
    });
    it('runs reread-guard on a claude Bash pre_tool_use, and on Read', () => {
        const concern = _resolve_concerns(manifest, 'claude', 'pre_tool_use').find((c) => c.name === 'reread-guard');
        expect(concern).toBeDefined();
        expect(_concern_matches_tool(concern as unknown as Record<string, never>, 'Bash')).toBe(true);
        expect(_concern_matches_tool(concern as unknown as Record<string, never>, 'Read')).toBe(true);
    });
});

describe('the cap holds on a ledger loaded over it', () => {
    it('prunes an oversized duty map on load and counts the excess', () => {
        const root = workspace();
        const key = crypto.createHash('sha256').update('s1').digest('hex');
        const ledgerPath = ledgerFile(root, key);
        fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
        const duty: Record<string, unknown> = {};
        for (let i = 0; i < MAX_DUTY_KEYS + 10; i++) duty[`r${String(i)}::x`] = { state: 'read', pending: 0, read: 1, ts: i };
        fs.writeFileSync(ledgerPath, JSON.stringify({ reads: {}, writes: {}, fired: {}, duty }));
        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, 'src', 'a.ts'), content: 'x' } });
        const after = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as { duty: Record<string, unknown>; duty_overflow?: number };
        expect(Object.keys(after.duty)).toHaveLength(MAX_DUTY_KEYS);
        expect(after.duty_overflow).toBe(10);
    });
});

describe('act-time duty: a shell command bound in act-references', () => {
    function withCommitRule(root: string): void {
        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', 'commit-policy.md'), `---\ntype: "always"\nload_context:\n  - ${REF}\n---\n\n# commit-policy\n`);
    }
    it('names the bound rule\'s references for a chained git commit, and nothing for an unbound command', () => {
        const root = workspace();
        withCommitRule(root);
        expect(scanActDuties('git add a && git commit -m x', root).duties).toEqual([{ rule: 'commit-policy', reference: REF, resolved: RESOLVED }]);
        expect(scanActDuties('git status', root).duties).toEqual([]);
    });
    it('counts a bound rule whose file is missing as an error', () => {
        const root = workspace();
        expect(scanActDuties('git commit -m x', root).errors).toHaveLength(1);
    });
    it('records the duty at a Bash pre_tool_use, observe-only, without the raw command', () => {
        const root = workspace();
        withCommitRule(root);
        run(root, { tool_name: 'Bash', tool_input: { command: 'git add a && git commit -m "secret-ish message"' } });
        const d = duty(root);
        expect(d[`commit-policy::${REF}`]).toMatchObject({ state: 'required-pending', pending: 1 });
        const key = crypto.createHash('sha256').update('s1').digest('hex');
        expect(fs.readFileSync(ledgerFile(root, key), 'utf8')).not.toContain('secret-ish');
    });
});

describe('the duty chunk failing to load', () => {
    it('the loader returns null for a bundled run whose chunk is missing', async () => {
        const { loadReferenceDuty, _resetReferenceDutyCache } = await import('../../src/scripts/hooks/reference_duty_loader.js');
        _resetReferenceDutyCache();
        const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'duty-chunk-'));
        tmps.push(dir);
        expect(loadReferenceDuty(pathToFileURL(path.join(dir, 'dispatch.js')).href, true)).toBeNull();
        _resetReferenceDutyCache();
    });
    it('counts one error per act scan when the duty cannot load, not two', async () => {
        const { _recordActDutyWith } = await import('../../src/scripts/hooks/reread_guard_hook.js');
        const root = workspace();
        const ledger = { reads: {}, writes: {}, fired: {} } as Record<string, unknown>;
        _recordActDutyWith(ledger as never, 'git commit -m x', root, null);
        expect(ledger['duty_errors']).toBe(1);
    });
    it('a file write whose duty cannot load counts one error and keeps the write bookkeeping', async () => {
        const { _recordDutyWith } = await import('../../src/scripts/hooks/reread_guard_hook.js');
        const root = workspace();
        const ledger = { reads: { a: { ts: 1 } }, writes: { b: { ts: 2 } }, fired: { c: 1 } } as Record<string, unknown>;
        const before = JSON.stringify({ reads: ledger['reads'], writes: ledger['writes'], fired: ledger['fired'] });
        _recordDutyWith(ledger as never, 'src/rules/x.md', root, null);
        expect(ledger['duty_errors']).toBe(1);
        expect(ledger['duty']).toBeUndefined();
        expect(JSON.stringify({ reads: ledger['reads'], writes: ledger['writes'], fired: ledger['fired'] })).toBe(before);
    });
    it('a partly quoted commit reaches the ledger through pre-check, lexer and table', () => {
        const root = workspace();
        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', 'commit-policy.md'), `---\ntype: "always"\nload_context:\n  - ${REF}\n---\n\n# commit-policy\n`);
        run(root, { tool_name: 'Bash', tool_input: { command: 'cd x && git "comm"it -m y 2>&1 | tail -1' } });
        expect(duty(root)[`commit-policy::${REF}`]).toMatchObject({ pending: 1 });
    });
});
