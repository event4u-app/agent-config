/**
 * Jira Tool Adapter — read-only Jira API interactions.
 *
 * Read-only actions use real API calls when JIRA_API_TOKEN + JIRA_BASE_URL are
 * set. Write actions remain scaffold-only (never auto-executed). Falls back to
 * scaffold data when no credentials are present.
 *
 * TypeScript twin of `src/scripts/tools/jira_adapter.py` (ADR-096 — Python→TS
 * migration, Phase 1 / tools adapter cluster). Public API mirrors the Python
 * module exactly (snake_case kept deliberately): the
 * `read_ticket` / `search_tickets` / `add_comment` / `transition_ticket`
 * dispatch, the JIRA_API_TOKEN + JIRA_BASE_URL (+ optional JIRA_EMAIL)
 * credential-from-env handling (basic-auth when email present, else bearer),
 * the `_base_url` trailing-slash strip, the JQL space-encoding, the scaffold
 * fallback shape, and the Jira API request construction (URL, headers,
 * method). The Python reference uses `urllib.request`; this twin builds the
 * identical request and performs the fetch through `_httpGetJson` — a seam
 * tests stub so no live network call is made (the no-credentials path
 * scaffolds and never reaches HTTP). No behaviour changes.
 */
import { spawnSync } from 'node:child_process';

import { BaseToolAdapter, ToolAction, ToolResult } from './base_adapter.js';

export const TIMEOUT_SECONDS = 15;

/** Request shape mirroring `urllib.request.Request`. */
export interface BuiltRequest {
    url: string;
    headers: Record<string, string>;
    method: string;
    timeout: number;
}

/** Adapter for Jira API interactions. */
export class JiraAdapter extends BaseToolAdapter {
    static readonly READ_ACTIONS: ReadonlySet<string> = new Set(['read_ticket', 'search_tickets']);
    static readonly WRITE_ACTIONS: ReadonlySet<string> = new Set([
        'add_comment',
        'transition_ticket',
    ]);

    get name(): string {
        return 'jira';
    }

    get supported_actions(): ReadonlySet<string> {
        return new Set([...JiraAdapter.READ_ACTIONS, ...JiraAdapter.WRITE_ACTIONS]);
    }

    check_auth(): boolean {
        return Boolean(this._token) && Boolean(this._base_url);
    }

    protected get _token(): string | undefined {
        return process.env.JIRA_API_TOKEN || undefined;
    }

    protected get _base_url(): string | undefined {
        const url = process.env.JIRA_BASE_URL ?? '';
        return url ? url.replace(/\/+$/, '') : undefined;
    }

    protected get _email(): string | undefined {
        return process.env.JIRA_EMAIL || undefined;
    }

    /**
     * Build the Jira API request for `path` (mirrors the `urllib.Request`
     * construction in `_api_get`). Exposed for parity tests.
     */
    _buildRequest(path: string): BuiltRequest {
        const url = `${this._base_url}/rest/api/3/${path.replace(/^\/+/, '')}`;
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (this._email && this._token) {
            const creds = Buffer.from(`${this._email}:${this._token}`, 'utf8').toString('base64');
            headers.Authorization = `Basic ${creds}`;
        } else if (this._token) {
            headers.Authorization = `Bearer ${this._token}`;
        }
        return { url, headers, method: 'GET', timeout: TIMEOUT_SECONDS };
    }

    /**
     * Perform the authenticated GET and decode JSON. Seam over the actual
     * network call — never reached on the no-credentials / scaffold path.
     * Default implementation mirrors `urlopen(...).read().decode()` +
     * `json.loads`.
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
            read_ticket: (a) => this._read_ticket(a),
            search_tickets: (a) => this._search_tickets(a),
            add_comment: (a) => this._add_comment(a),
            transition_ticket: (a) => this._transition_ticket(a),
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

    private _read_ticket(action: ToolAction): ToolResult {
        const key = (action.params.key as string | undefined) ?? '';
        if (!key || !this.check_auth()) {
            return this._scaffold('read_ticket', action);
        }
        try {
            const data = this._api_get(`issue/${key}`);
            return new ToolResult({
                tool_name: this.name,
                action: 'read_ticket',
                success: true,
                data,
            });
        } catch (e) {
            return new ToolResult({
                tool_name: this.name,
                action: 'read_ticket',
                success: false,
                error: String(e instanceof Error ? e.message : e),
            });
        }
    }

    private _search_tickets(action: ToolAction): ToolResult {
        const jql = (action.params.jql as string | undefined) ?? '';
        if (!jql || !this.check_auth()) {
            return this._scaffold('search_tickets', action);
        }
        try {
            const encoded_jql = jql.split(' ').join('%20');
            const data = this._api_get(`search?jql=${encoded_jql}&maxResults=20`);
            return new ToolResult({
                tool_name: this.name,
                action: 'search_tickets',
                success: true,
                data,
            });
        } catch (e) {
            return new ToolResult({
                tool_name: this.name,
                action: 'search_tickets',
                success: false,
                error: String(e instanceof Error ? e.message : e),
            });
        }
    }

    /** Write action — scaffold only. */
    private _add_comment(action: ToolAction): ToolResult {
        return this._scaffold('add_comment', action);
    }

    /** Write action — scaffold only. */
    private _transition_ticket(action: ToolAction): ToolResult {
        return this._scaffold('transition_ticket', action);
    }

    private _scaffold(action_name: string, action: ToolAction): ToolResult {
        return new ToolResult({
            tool_name: this.name,
            action: action_name,
            success: true,
            data: { scaffold: true, action: action_name, params: action.params },
        });
    }
}
