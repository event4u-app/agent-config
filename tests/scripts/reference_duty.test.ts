/**
 * The reference duty, observed: which references a file act requires, and
 * whether the session's read ledger shows them read. Observation only.
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { dutyForPath, dutyStates } from '../../src/scripts/_lib/reference_duty.js';
import { ledgerFile } from '../../src/scripts/hooks/reread_guard_hook.js';

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

describe('dutyForPath', () => {
    it('names the references of rules whose path or file trigger matches, and only those', () => {
        const root = workspace();
        expect(dutyForPath('.claude/settings.json', root)).toEqual([{ rule: 'sot', reference: REF, resolved: RESOLVED }]);
        expect(dutyForPath('src/App.vue', root)).toEqual([]);
        expect(dutyForPath('src/a.ts', root)).toEqual([]);
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
        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
        run(root, {}, 'pre_compact');
        expect(duty(root)[`sot::${REF}`]).toMatchObject({ pending: 1 });
    });
    it('reads an inline load_context list the way YAML does', () => {
        const root = workspace();
        fs.writeFileSync(path.join(root, 'dist', 'agent-src', 'rules', 'sot.md'), `---\ntype: "auto"\nload_context: ["${REF}"] # inline\n---\n\n# sot\n`);
        expect(dutyForPath('.claude/a.md', root)).toEqual([{ rule: 'sot', reference: REF, resolved: RESOLVED }]);
    });
});
