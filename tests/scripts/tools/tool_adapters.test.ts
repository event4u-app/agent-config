// Tests for src/scripts/tools/github_adapter.ts + jira_adapter.ts
// (py2ts Phase 1 — tools cluster).
//
// Ports tests/test_tool_adapters.py 1:1 (names, supported_actions, scaffold
// dispatch, validate/safe_execute) plus:
//   - request-construction parity (_buildRequest URL/headers/method) asserted
//     directly (no live network — the no-credentials path scaffolds and never
//     reaches HTTP, exactly like the Python original), and
//   - a golden-parity layer (python3 vs tsx) over the scaffold dispatch +
//     to_dict shapes, with a scrubbed env so the result is deterministic and
//     no API call is ever attempted.
//
// All credential env vars are cleared in-process (beforeEach) and in the
// spawned harness env so read actions deterministically take the scaffold
// path regardless of the developer's shell.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ToolAction } from '../../../src/scripts/tools/base_adapter.js';
import { GITHUB_API, GitHubAdapter } from '../../../src/scripts/tools/github_adapter.js';
import { JiraAdapter } from '../../../src/scripts/tools/jira_adapter.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

const CRED_KEYS = [
    'GITHUB_TOKEN',
    'JIRA_API_TOKEN',
    'JIRA_BASE_URL',
    'JIRA_EMAIL',
] as const;

// Snapshot + clear credential env in-process so the scaffold path is
// deterministic; restore afterward to avoid leaking into sibling suites.
const _saved: Record<string, string | undefined> = {};
beforeEach(() => {
    for (const k of CRED_KEYS) {
        _saved[k] = process.env[k];
        delete process.env[k];
    }
});
afterEach(() => {
    for (const k of CRED_KEYS) {
        if (_saved[k] === undefined) delete process.env[k];
        else process.env[k] = _saved[k];
    }
});

// --- Base / validate via GitHubAdapter (mirrors test_tool_adapters.py) ------

describe('tool adapters — ported pytest suite', () => {
    it('validate_action wrong tool', () => {
        const a = new GitHubAdapter();
        const err = a.validate_action(
            new ToolAction({ tool_name: 'jira', action: 'read_pr', params: {} }),
        );
        expect(err).not.toBeNull();
        expect(err!).toContain('does not match');
    });

    it('validate_action unsupported', () => {
        const a = new GitHubAdapter();
        const err = a.validate_action(
            new ToolAction({ tool_name: 'github', action: 'delete_repo', params: {} }),
        );
        expect(err).not.toBeNull();
        expect(err!).toContain('not supported');
    });

    it('validate_action valid', () => {
        const a = new GitHubAdapter();
        expect(
            a.validate_action(
                new ToolAction({ tool_name: 'github', action: 'read_pr', params: {} }),
            ),
        ).toBeNull();
    });

    it('safe_execute rejects invalid', () => {
        const a = new GitHubAdapter();
        const r = a.safe_execute(
            new ToolAction({ tool_name: 'github', action: 'delete_repo', params: {} }),
        );
        expect(r.success).toBe(false);
        expect(r.error).not.toBeNull();
    });

    it('safe_execute runs valid (scaffold)', () => {
        const a = new GitHubAdapter();
        const r = a.safe_execute(
            new ToolAction({ tool_name: 'github', action: 'read_pr', params: { pr_number: 42 } }),
        );
        expect(r.success).toBe(true);
        expect(r.data).not.toBeNull();
    });

    // GitHub
    it('github name', () => {
        expect(new GitHubAdapter().name).toBe('github');
    });

    it('github supported_actions', () => {
        const actions = new GitHubAdapter().supported_actions;
        expect(actions.has('read_pr')).toBe(true);
        expect(actions.has('create_pr')).toBe(true);
        expect(actions.has('list_files')).toBe(true);
    });

    it('github all actions scaffold', () => {
        const a = new GitHubAdapter();
        for (const action_name of a.supported_actions) {
            const r = a.execute_action(
                new ToolAction({ tool_name: 'github', action: action_name, params: { test: true } }),
            );
            expect(r.success, `Action ${action_name} failed`).toBe(true);
            expect(r.data).not.toBeNull();
            expect((r.data as Record<string, unknown>).scaffold).toBe(true);
        }
    });

    // Jira
    it('jira name', () => {
        expect(new JiraAdapter().name).toBe('jira');
    });

    it('jira supported_actions', () => {
        const actions = new JiraAdapter().supported_actions;
        expect(actions.has('read_ticket')).toBe(true);
        expect(actions.has('search_tickets')).toBe(true);
        expect(actions.has('add_comment')).toBe(true);
    });

    it('jira all actions scaffold', () => {
        const a = new JiraAdapter();
        for (const action_name of a.supported_actions) {
            const r = a.execute_action(
                new ToolAction({ tool_name: 'jira', action: action_name, params: { test: true } }),
            );
            expect(r.success, `Action ${action_name} failed`).toBe(true);
            expect(r.data).not.toBeNull();
        }
    });

    it('github unsupported action via execute_action', () => {
        const a = new GitHubAdapter();
        const r = a.execute_action(
            new ToolAction({ tool_name: 'github', action: 'no_such', params: {} }),
        );
        expect(r.success).toBe(false);
        expect(r.error).toBe('Unsupported action: no_such');
    });
});

// --- Request construction parity (no live network) --------------------------

describe('request construction (no live network)', () => {
    it('github _buildRequest: no token → no Authorization header', () => {
        const a = new GitHubAdapter();
        const req = a._buildRequest('/repos/o/r/pulls/1');
        expect(req.url).toBe(`${GITHUB_API}/repos/o/r/pulls/1`);
        expect(req.headers.Accept).toBe('application/vnd.github+json');
        expect('Authorization' in req.headers).toBe(false);
        expect(req.method).toBe('GET');
        expect(req.timeout).toBe(15);
    });

    it('github _buildRequest: with token → Bearer header + lstrip leading slash', () => {
        process.env.GITHUB_TOKEN = 'gh_tok';
        const a = new GitHubAdapter();
        const req = a._buildRequest('///repos/o/r/commits/abc');
        expect(req.url).toBe(`${GITHUB_API}/repos/o/r/commits/abc`);
        expect(req.headers.Authorization).toBe('Bearer gh_tok');
    });

    it('jira _buildRequest: email+token → Basic base64 + base-url slash strip', () => {
        process.env.JIRA_BASE_URL = 'https://acme.atlassian.net//';
        process.env.JIRA_API_TOKEN = 'tok';
        process.env.JIRA_EMAIL = 'me@acme.io';
        const a = new JiraAdapter();
        const req = a._buildRequest('issue/ABC-1');
        const expectedCreds = Buffer.from('me@acme.io:tok', 'utf8').toString('base64');
        expect(req.url).toBe('https://acme.atlassian.net/rest/api/3/issue/ABC-1');
        expect(req.headers.Authorization).toBe(`Basic ${expectedCreds}`);
        expect(req.headers.Accept).toBe('application/json');
    });

    it('jira _buildRequest: token only → Bearer header', () => {
        process.env.JIRA_BASE_URL = 'https://acme.atlassian.net';
        process.env.JIRA_API_TOKEN = 'tok';
        const a = new JiraAdapter();
        const req = a._buildRequest('issue/ABC-1');
        expect(req.headers.Authorization).toBe('Bearer tok');
    });

    it('jira search JQL space-encoding (all spaces → %20)', () => {
        process.env.JIRA_BASE_URL = 'https://acme.atlassian.net';
        process.env.JIRA_API_TOKEN = 'tok';
        const a = new JiraAdapter();
        // Stub the HTTP seam to capture the path instead of calling the network.
        let capturedUrl = '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a as any)._httpGetJson = (req: { url: string }) => {
            capturedUrl = req.url;
            return {};
        };
        const r = a.execute_action(
            new ToolAction({
                tool_name: 'jira',
                action: 'search_tickets',
                params: { jql: 'project = ABC AND status = Open' },
            }),
        );
        expect(r.success).toBe(true);
        expect(capturedUrl).toBe(
            'https://acme.atlassian.net/rest/api/3/search?jql=project%20=%20ABC%20AND%20status%20=%20Open&maxResults=20',
        );
    });

    it('github read_pr with token routes through HTTP seam, not scaffold', () => {
        process.env.GITHUB_TOKEN = 'gh_tok';
        const a = new GitHubAdapter();
        let capturedUrl = '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a as any)._httpGetJson = (req: { url: string }) => {
            capturedUrl = req.url;
            return { number: 7 };
        };
        const r = a.execute_action(
            new ToolAction({
                tool_name: 'github',
                action: 'read_pr',
                params: { owner: 'o', repo: 'r', number: '7' },
            }),
        );
        expect(r.success).toBe(true);
        expect(capturedUrl).toBe(`${GITHUB_API}/repos/o/r/pulls/7`);
        expect((r.data as Record<string, unknown>).number).toBe(7);
        // Not a scaffold result.
        expect((r.data as Record<string, unknown>).scaffold).toBeUndefined();
    });
});

// --- Golden parity (python3 vs tsx) — scaffold dispatch + to_dict -----------

const PY_HARNESS = `
import json, sys
sys.path.insert(0, "src/scripts")
from tools.github_adapter import GitHubAdapter
from tools.jira_adapter import JiraAdapter
from tools.base_adapter import ToolAction

def run(adapter):
    out = []
    for action_name in sorted(adapter.supported_actions):
        action = ToolAction(tool_name=adapter.name, action=action_name, params={"test": True, "b": "x"})
        out.append(adapter.execute_action(action).to_dict())
    # one validation rejection + one unsupported dispatch
    bad = ToolAction(tool_name="other", action=sorted(adapter.supported_actions)[0], params={})
    out.append(adapter.safe_execute(bad).to_dict())
    unsup = ToolAction(tool_name=adapter.name, action="zzz_no_such", params={})
    out.append(adapter.execute_action(unsup).to_dict())
    return out

result = {"github": run(GitHubAdapter()), "jira": run(JiraAdapter())}
sys.stdout.write(json.dumps(result, indent=2, sort_keys=True))
`;

const TS_HARNESS = `
import { GitHubAdapter } from "./src/scripts/tools/github_adapter.ts";
import { JiraAdapter } from "./src/scripts/tools/jira_adapter.ts";
import { ToolAction, BaseToolAdapter } from "./src/scripts/tools/base_adapter.ts";

function run(adapter: BaseToolAdapter) {
    const actions = [...adapter.supported_actions].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const out: unknown[] = [];
    for (const action_name of actions) {
        const action = new ToolAction({ tool_name: adapter.name, action: action_name, params: { test: true, b: "x" } });
        out.push(adapter.execute_action(action).to_dict());
    }
    const bad = new ToolAction({ tool_name: "other", action: actions[0]!, params: {} });
    out.push(adapter.safe_execute(bad).to_dict());
    const unsup = new ToolAction({ tool_name: adapter.name, action: "zzz_no_such", params: {} });
    out.push(adapter.execute_action(unsup).to_dict());
    return out;
}

const result = { github: run(new GitHubAdapter()), jira: run(new JiraAdapter()) };
function sortKeys(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        const r: Record<string, unknown> = {};
        for (const k of Object.keys(o).sort()) r[k] = sortKeys(o[k]);
        return r;
    }
    return v;
}
process.stdout.write(JSON.stringify(sortKeys(result), null, 2));
`;

describe.skipIf(!py3)('tool adapters — golden parity (python3 vs tsx)', () => {
    it('scaffold dispatch + to_dict are byte-identical', () => {
        const scrubbedEnv = { ...process.env };
        for (const k of CRED_KEYS) delete scrubbedEnv[k];
        const p = spawnSync('python3', ['-c', PY_HARNESS], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env: scrubbedEnv,
        });
        const t = spawnSync(TSX_BIN, ['--eval', TS_HARNESS], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env: scrubbedEnv,
        });
        expect(p.status).toBe(0);
        expect(t.status).toBe(0);
        expect(t.stdout).toBe(p.stdout);
    });
});
