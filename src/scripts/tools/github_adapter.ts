/**
 * GitHub Tool Adapter — read-only GitHub API interactions.
 *
 * Read-only actions use real API calls when GITHUB_TOKEN is available.
 * Write actions remain scaffold-only (never auto-executed).
 * Falls back to scaffold data when no token is present.
 *
 * TypeScript twin of `src/scripts/tools/github_adapter.py` (ADR-094 —
 * Python→TS migration, Phase 1 / tools adapter cluster). Public API mirrors
 * the Python module exactly (snake_case kept deliberately): the
 * `read_pr` / `read_issue` / `list_files` / `read_commit` / `create_pr`
 * dispatch, the GITHUB_TOKEN credential-from-env handling, the scaffold
 * fallback shape, and the GitHub API request construction (URL, headers,
 * method). The Python reference uses `urllib.request`; this twin builds the
 * identical request and performs the fetch through `_httpGetJson` — a seam
 * tests stub so no live network call is made (the no-token path scaffolds and
 * never reaches HTTP, exactly like the original). No behaviour changes.
 */
import { spawnSync } from 'node:child_process';

import { BaseToolAdapter, ToolAction, ToolResult } from './base_adapter.js';

export const GITHUB_API = 'https://api.github.com';
export const TIMEOUT_SECONDS = 15;

/** Request shape mirroring `urllib.request.Request`. */
export interface BuiltRequest {
    url: string;
    headers: Record<string, string>;
    method: string;
    timeout: number;
}

/** Adapter for GitHub API interactions. */
export class GitHubAdapter extends BaseToolAdapter {
    static readonly READ_ACTIONS: ReadonlySet<string> = new Set([
        'read_pr',
        'read_issue',
        'list_files',
        'read_commit',
    ]);
    static readonly WRITE_ACTIONS: ReadonlySet<string> = new Set(['create_pr']);

    get name(): string {
        return 'github';
    }

    get supported_actions(): ReadonlySet<string> {
        return new Set([...GitHubAdapter.READ_ACTIONS, ...GitHubAdapter.WRITE_ACTIONS]);
    }

    check_auth(): boolean {
        return Boolean(process.env.GITHUB_TOKEN);
    }

    protected get _token(): string | undefined {
        return process.env.GITHUB_TOKEN || undefined;
    }

    /**
     * Build the GitHub API request for `path` (mirrors the `urllib.Request`
     * construction in `_api_get`). Exposed for parity tests.
     */
    _buildRequest(path: string): BuiltRequest {
        const url = `${GITHUB_API}/${path.replace(/^\/+/, '')}`;
        const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
        if (this._token) {
            headers.Authorization = `Bearer ${this._token}`;
        }
        return { url, headers, method: 'GET', timeout: TIMEOUT_SECONDS };
    }

    /**
     * Perform the authenticated GET and decode JSON. Seam over the actual
     * network call — never reached on the no-token / scaffold path. Default
     * implementation mirrors `urlopen(...).read().decode()` + `json.loads`.
     */
    protected _httpGetJson(req: BuiltRequest): Record<string, unknown> {
        const headerArgs: string[] = [];
        for (const [k, v] of Object.entries(req.headers)) {
            headerArgs.push('-H', `${k}: ${v}`);
        }
        const proc = spawnSync(
            'curl',
            ['-sS', '--fail', '--max-time', String(req.timeout), ...headerArgs, req.url],
            { encoding: 'utf8' },
        );
        if (proc.status !== 0) {
            throw new Error(proc.stderr || `request failed for ${req.url}`);
        }
        return JSON.parse(proc.stdout) as Record<string, unknown>;
    }

    private _api_get(path: string): Record<string, unknown> {
        return this._httpGetJson(this._buildRequest(path));
    }

    execute_action(action: ToolAction): ToolResult {
        const handlers: Record<string, ((a: ToolAction) => ToolResult) | undefined> = {
            read_pr: (a) => this._read_pr(a),
            read_issue: (a) => this._read_issue(a),
            list_files: (a) => this._list_files(a),
            read_commit: (a) => this._read_commit(a),
            create_pr: (a) => this._create_pr(a),
        };
        const handler = handlers[action.action];

        if (!handler) {
            return new ToolResult({
                tool_name: this.name,
                action: action.action,
                success: false,
                error: `Unsupported action: ${action.action}`,
            });
        }
        return handler(action);
    }

    private _read_pr(action: ToolAction): ToolResult {
        const owner = (action.params.owner as string | undefined) ?? '';
        const repo = (action.params.repo as string | undefined) ?? '';
        const number = (action.params.number as string | undefined) ?? '';
        if (!(owner && repo && number) || !this._token) {
            return this._scaffold('read_pr', action);
        }
        try {
            const data = this._api_get(`repos/${owner}/${repo}/pulls/${number}`);
            return new ToolResult({ tool_name: this.name, action: 'read_pr', success: true, data });
        } catch (e) {
            return new ToolResult({
                tool_name: this.name,
                action: 'read_pr',
                success: false,
                error: String(e instanceof Error ? e.message : e),
            });
        }
    }

    private _read_issue(action: ToolAction): ToolResult {
        const owner = (action.params.owner as string | undefined) ?? '';
        const repo = (action.params.repo as string | undefined) ?? '';
        const number = (action.params.number as string | undefined) ?? '';
        if (!(owner && repo && number) || !this._token) {
            return this._scaffold('read_issue', action);
        }
        try {
            const data = this._api_get(`repos/${owner}/${repo}/issues/${number}`);
            return new ToolResult({
                tool_name: this.name,
                action: 'read_issue',
                success: true,
                data,
            });
        } catch (e) {
            return new ToolResult({
                tool_name: this.name,
                action: 'read_issue',
                success: false,
                error: String(e instanceof Error ? e.message : e),
            });
        }
    }

    private _list_files(action: ToolAction): ToolResult {
        const owner = (action.params.owner as string | undefined) ?? '';
        const repo = (action.params.repo as string | undefined) ?? '';
        const number = (action.params.number as string | undefined) ?? '';
        if (!(owner && repo && number) || !this._token) {
            return this._scaffold('list_files', action);
        }
        try {
            const data = this._api_get(`repos/${owner}/${repo}/pulls/${number}/files`);
            return new ToolResult({
                tool_name: this.name,
                action: 'list_files',
                success: true,
                data,
            });
        } catch (e) {
            return new ToolResult({
                tool_name: this.name,
                action: 'list_files',
                success: false,
                error: String(e instanceof Error ? e.message : e),
            });
        }
    }

    private _read_commit(action: ToolAction): ToolResult {
        const owner = (action.params.owner as string | undefined) ?? '';
        const repo = (action.params.repo as string | undefined) ?? '';
        const sha = (action.params.sha as string | undefined) ?? '';
        if (!(owner && repo && sha) || !this._token) {
            return this._scaffold('read_commit', action);
        }
        try {
            const data = this._api_get(`repos/${owner}/${repo}/commits/${sha}`);
            return new ToolResult({
                tool_name: this.name,
                action: 'read_commit',
                success: true,
                data,
            });
        } catch (e) {
            return new ToolResult({
                tool_name: this.name,
                action: 'read_commit',
                success: false,
                error: String(e instanceof Error ? e.message : e),
            });
        }
    }

    /** Write action — scaffold only, never auto-executed. */
    private _create_pr(action: ToolAction): ToolResult {
        return this._scaffold('create_pr', action);
    }

    /** Return scaffold data when no token or params are missing. */
    private _scaffold(action_name: string, action: ToolAction): ToolResult {
        return new ToolResult({
            tool_name: this.name,
            action: action_name,
            success: true,
            data: { scaffold: true, action: action_name, params: action.params },
        });
    }
}
