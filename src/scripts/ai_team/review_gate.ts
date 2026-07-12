/**
 * Review-Gate governance — road-to-team-mode Phase 4.
 *
 * The codex plugin's Stop-hook Review Gate (upstream: `codex@openai-codex`,
 * `scripts/stop-review-gate-hook.mjs`) can BLOCK every Stop and re-trigger a
 * Claude↔Codex loop without any bound — upstream's own README warns: "The
 * review gate can create a long-running Claude/Codex loop and may drain
 * usage limits quickly." The gate itself stays upstream's; this module owns
 * the GOVERNANCE:
 *
 *   1. Parse the gate transcript's first-line contract — upstream's prompt
 *      (`prompts/stop-review-gate.md`) demands the first line be exactly
 *      `ALLOW: <reason>` or `BLOCK: <reason>`. Anything else is honestly
 *      `UNKNOWN` and is NEVER counted as a BLOCK.
 *   2. Count CONSECUTIVE BLOCK verdicts per session (state: one small JSON
 *      under `agents/runtime/state/`, same convention as the other hook
 *      concerns, written via the shared `state_io` lock). ALLOW resets.
 *   3. At `ai_team.review_gate.max_consecutive_blocks`, surface a visible
 *      circuit-breaker notice EXACTLY ONCE and report the circuit as open
 *      (the managed layer stops re-blocking — the user decides).
 *   4. Ledger: one events-log line per gate verdict (`team.gate: BLOCK 2/3`
 *      / `ALLOW reset`) under `agents/runtime/team/events.log`, following
 *      the council events-log convention (`src/scripts/ai_council/
 *      events_log.ts`: schema_version + ts_utc + compact JSON line, honours
 *      the same `AGENT_CONFIG_NO_EVENTS_LOG` kill-switch, no free-form
 *      content — verdict enum + counter only, PII-excluded by construction).
 *
 * Composition point (documented, not yet manifest-wired): the minimal
 * call-site is `src/scripts/team_review_gate_hook.ts`, a `stop` concern in
 * the dispatcher shape. Claude Code gives sibling Stop hooks no view of the
 * plugin gate's own stdout, so the hook reads the gate verdict from the
 * plugin's persisted job record (`jobs/<id>.json` → `result.rawOutput`,
 * title `Codex Stop Gate Review`) — see `find_latest_gate_transcript`.
 * Registering the concern in `src/scripts/hook_manifest.yaml` (claude/
 * cowork `stop`, after `chat-history`) is the one remaining wiring step;
 * it drags the manifest lint + installer + tests/hooks snapshot surface and
 * is deliberately left to the orchestrator. With
 * `ai_team.review_gate.managed: false` (default) every entry point here is
 * a no-op — byte-identical pre-Phase-4 behavior.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { claude_config_dir, CODEX_MARKETPLACE_NAME, CODEX_PLUGIN_ID } from '../_lib/claude_plugin.js';
import { atomic_write_json } from '../hooks/state_io.js';
import { AI_TEAM_DEFAULTS, load_ai_team_config, type AiTeamConfig } from './config.js';

export type GateVerdict = 'ALLOW' | 'BLOCK' | 'UNKNOWN';

export const GATE_STATE_BASENAME = 'team-review-gate.json';
export const GATE_LEDGER_RELPATH = path.join('agents', 'runtime', 'team', 'events.log');
export const GATE_LEDGER_KIND = 'team.gate';

/** Same kill-switch the council events log honours. */
const _KILL_SWITCH_ENV = 'AGENT_CONFIG_NO_EVENTS_LOG';

/** Keep the per-session state file tiny — newest N sessions survive. */
const _MAX_TRACKED_SESSIONS = 20;

// ── verdict parsing ─────────────────────────────────────────────────

/**
 * Parse the first-line ALLOW/BLOCK contract of a gate transcript.
 *
 * Upstream's compact-output contract: the first line is exactly
 * `ALLOW: <short reason>` or `BLOCK: <short reason>` (the gate hook itself
 * matches `startsWith('ALLOW:')` / `startsWith('BLOCK:')`). We additionally
 * accept a bare `ALLOW` / `BLOCK` first line. Everything else — empty
 * output, prose, lowercase, a verdict buried on line 2 — is honestly
 * `UNKNOWN` and MUST NOT be counted as a BLOCK.
 */
export function parse_gate_verdict(transcript_text: string | null | undefined): GateVerdict {
    const text = String(transcript_text ?? '').trim();
    if (text === '') {
        return 'UNKNOWN';
    }
    const first_line = (text.split(/\r?\n/, 1)[0] ?? '').trim();
    if (first_line === 'ALLOW' || first_line.startsWith('ALLOW:')) {
        return 'ALLOW';
    }
    if (first_line === 'BLOCK' || first_line.startsWith('BLOCK:')) {
        return 'BLOCK';
    }
    return 'UNKNOWN';
}

// ── per-session counter state ───────────────────────────────────────

interface GateSessionState {
    consecutive_blocks: number;
    notice_emitted: boolean;
    last_dedupe_key: string;
    updated_utc: string;
}

interface GateStateFile {
    schema_version: number;
    sessions: Record<string, GateSessionState>;
}

/** Canonical state path — `agents/runtime/state/team-review-gate.json`. */
export function gate_state_path(project_root: string): string {
    return path.join(project_root, 'agents', 'runtime', 'state', GATE_STATE_BASENAME);
}

function _safe_session(session_id: string | null | undefined): string {
    const raw = (session_id ?? '').trim() || 'unknown-session';
    return raw.replace(/\//g, '_').replace(/\\/g, '_').replace(/\.\./g, '_');
}

function _read_state(state_path: string): GateStateFile {
    const empty: GateStateFile = { schema_version: 1, sessions: {} };
    let parsed: unknown;
    try {
        parsed = JSON.parse(fs.readFileSync(state_path, 'utf-8'));
    } catch {
        return empty;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return empty;
    }
    const sessions_raw = (parsed as Record<string, unknown>)['sessions'];
    if (sessions_raw === null || typeof sessions_raw !== 'object' || Array.isArray(sessions_raw)) {
        return empty;
    }
    const sessions: Record<string, GateSessionState> = {};
    for (const [key, value] of Object.entries(sessions_raw as Record<string, unknown>)) {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            continue;
        }
        const v = value as Record<string, unknown>;
        const blocks = v['consecutive_blocks'];
        sessions[key] = {
            consecutive_blocks:
                typeof blocks === 'number' && Number.isInteger(blocks) && blocks >= 0 ? blocks : 0,
            notice_emitted: v['notice_emitted'] === true,
            last_dedupe_key: typeof v['last_dedupe_key'] === 'string' ? v['last_dedupe_key'] : '',
            updated_utc: typeof v['updated_utc'] === 'string' ? v['updated_utc'] : '',
        };
    }
    return { schema_version: 1, sessions };
}

function _prune_sessions(state: GateStateFile): void {
    const keys = Object.keys(state.sessions);
    if (keys.length <= _MAX_TRACKED_SESSIONS) {
        return;
    }
    const sorted = keys.sort((a, b) =>
        (state.sessions[b]?.updated_utc ?? '').localeCompare(state.sessions[a]?.updated_utc ?? ''),
    );
    for (const stale of sorted.slice(_MAX_TRACKED_SESSIONS)) {
        delete state.sessions[stale];
    }
}

// ── circuit-breaker notice ──────────────────────────────────────────

/** The visible circuit-breaker notice — rendered by the Stop-hook layer. */
export function circuit_breaker_notice(bound: number): string {
    return (
        `⚠️ team review-gate circuit breaker: ${bound} consecutive BLOCK verdict(s) ` +
        'this session (bound: `ai_team.review_gate.max_consecutive_blocks`). ' +
        'The managed gate stops re-blocking now — you decide: review the last ' +
        'BLOCK reason via `/team:status`, fix what is real, ignore what is not. ' +
        'An ALLOW verdict resets the counter.'
    );
}

// ── ledger (events-log convention) ──────────────────────────────────

function _kill_switch_active(): boolean {
    const value = process.env[_KILL_SWITCH_ENV] ?? '';
    return !(value === '' || value === '0' || value === 'false' || value === 'False');
}

function _iso_seconds_z(d: Date): string {
    const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
    return (
        `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
    );
}

export interface GateLedgerEntry {
    schema_version: number;
    ts_utc: string;
    kind: string; // GATE_LEDGER_KIND
    session_id: string;
    verdict: GateVerdict;
    counter: string; // "2/3" | "reset" | "n/a"
}

/** Canonical ledger path — `agents/runtime/team/events.log`. */
export function gate_ledger_path(project_root: string): string {
    return path.join(project_root, GATE_LEDGER_RELPATH);
}

function _append_ledger_line(target: string, entry: GateLedgerEntry): boolean {
    if (_kill_switch_active()) {
        return false;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, JSON.stringify(entry) + '\n', { encoding: 'utf-8' });
    return true;
}

/** Human line for `/team:status` / session replay: `team.gate: BLOCK 2/3`. */
export function format_gate_ledger_line(entry: Pick<GateLedgerEntry, 'verdict' | 'counter'>): string {
    return `${GATE_LEDGER_KIND}: ${entry.verdict} ${entry.counter}`;
}

/**
 * Read helper for `/team:status` — newest-last gate ledger entries,
 * optionally filtered by session. Fail-open: unreadable file / broken
 * lines yield an empty / partial list, never a throw.
 */
export function read_gate_ledger(opts: {
    project_root?: string;
    ledger_path?: string;
    session_id?: string | null;
    limit?: number;
} = {}): GateLedgerEntry[] {
    const target =
        opts.ledger_path ?? gate_ledger_path(opts.project_root ?? process.cwd());
    let raw: string;
    try {
        raw = fs.readFileSync(target, 'utf-8');
    } catch {
        return [];
    }
    const want_session = opts.session_id ? _safe_session(opts.session_id) : null;
    const entries: GateLedgerEntry[] = [];
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (trimmed === '') {
            continue;
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            continue;
        }
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            continue;
        }
        const rec = parsed as Record<string, unknown>;
        if (rec['kind'] !== GATE_LEDGER_KIND) {
            continue;
        }
        const verdict = rec['verdict'];
        if (verdict !== 'ALLOW' && verdict !== 'BLOCK' && verdict !== 'UNKNOWN') {
            continue;
        }
        const entry: GateLedgerEntry = {
            schema_version: typeof rec['schema_version'] === 'number' ? rec['schema_version'] : 1,
            ts_utc: typeof rec['ts_utc'] === 'string' ? rec['ts_utc'] : '',
            kind: GATE_LEDGER_KIND,
            session_id: typeof rec['session_id'] === 'string' ? rec['session_id'] : '',
            verdict,
            counter: typeof rec['counter'] === 'string' ? rec['counter'] : '',
        };
        if (want_session !== null && entry.session_id !== want_session) {
            continue;
        }
        entries.push(entry);
    }
    const limit = opts.limit ?? entries.length;
    return limit >= entries.length ? entries : entries.slice(entries.length - limit);
}

// ── the managed-mode counter (state machine) ────────────────────────

export interface GateRecordOptions {
    session_id: string | null | undefined;
    /** Raw gate transcript (first-line contract). Ignored when `verdict` set. */
    transcript_text?: string | null;
    /** Pre-parsed verdict (skips parsing). */
    verdict?: GateVerdict;
    /**
     * Idempotency key for the underlying gate run (e.g. the plugin job id).
     * The same key twice in a row for one session is a re-observation of the
     * same gate run — it is not recounted.
     */
    dedupe_key?: string | null;
    /** Injected config (tests). Default: `load_ai_team_config()` from cwd. */
    config?: AiTeamConfig;
    /** Root for state + ledger paths. Default: `process.cwd()`. */
    project_root?: string;
    state_path?: string;
    ledger_path?: string;
    now?: Date;
}

export interface GateOutcome {
    verdict: GateVerdict;
    /** Consecutive BLOCKs after this verdict was applied. */
    consecutive_blocks: number;
    bound: number;
    /** false when unmanaged, deduped, or verdict UNKNOWN (never counted). */
    counted: boolean;
    /** true at/beyond the bound — the managed layer must not re-block. */
    circuit_open: boolean;
    /** Non-null exactly once per session per trip — the visible notice. */
    notice: string | null;
    /** The `team.gate: …` line appended to the ledger (null when none). */
    ledger_line: string | null;
}

/**
 * Apply one gate verdict to the per-session consecutive-BLOCK counter.
 *
 * State machine (managed mode only — `managed: false` is a strict no-op
 * that touches neither state nor ledger):
 *
 *   ALLOW   → counter := 0, notice flag cleared. Ledger `ALLOW reset`.
 *   BLOCK   → counter += 1. At counter == bound: notice returned (once),
 *             circuit opens. Beyond: circuit stays open, no second notice.
 *   UNKNOWN → counter unchanged, never counted as BLOCK.
 *             Ledger `UNKNOWN n/bound` (honest visibility).
 */
export function record_gate_verdict(opts: GateRecordOptions): GateOutcome {
    const config = opts.config ?? _load_config_fail_open();
    const bound = config.review_gate.max_consecutive_blocks;
    const verdict = opts.verdict ?? parse_gate_verdict(opts.transcript_text);

    if (!config.review_gate.managed) {
        return {
            verdict,
            consecutive_blocks: 0,
            bound,
            counted: false,
            circuit_open: false,
            notice: null,
            ledger_line: null,
        };
    }

    const project_root = opts.project_root ?? process.cwd();
    const state_path = opts.state_path ?? gate_state_path(project_root);
    const ledger_path = opts.ledger_path ?? gate_ledger_path(project_root);
    const now = opts.now ?? new Date();
    const session_key = _safe_session(opts.session_id);
    const dedupe_key = (opts.dedupe_key ?? '').trim();

    const state = _read_state(state_path);
    const session: GateSessionState = state.sessions[session_key] ?? {
        consecutive_blocks: 0,
        notice_emitted: false,
        last_dedupe_key: '',
        updated_utc: '',
    };

    if (dedupe_key !== '' && session.last_dedupe_key === dedupe_key) {
        // Same gate run observed again (e.g. a Stop event without a fresh
        // gate execution) — never recount.
        return {
            verdict,
            consecutive_blocks: session.consecutive_blocks,
            bound,
            counted: false,
            circuit_open: session.consecutive_blocks >= bound,
            notice: null,
            ledger_line: null,
        };
    }

    let counted = false;
    let notice: string | null = null;
    if (verdict === 'ALLOW') {
        session.consecutive_blocks = 0;
        session.notice_emitted = false;
        counted = true;
    } else if (verdict === 'BLOCK') {
        session.consecutive_blocks += 1;
        counted = true;
        if (session.consecutive_blocks >= bound && !session.notice_emitted) {
            notice = circuit_breaker_notice(bound);
            session.notice_emitted = true;
        }
    }
    // UNKNOWN: counter untouched, counted stays false.

    session.last_dedupe_key = dedupe_key;
    session.updated_utc = _iso_seconds_z(now);
    state.sessions[session_key] = session;
    _prune_sessions(state);
    atomic_write_json(state_path, state);

    const counter =
        verdict === 'ALLOW' ? 'reset' : `${session.consecutive_blocks}/${bound}`;
    const entry: GateLedgerEntry = {
        schema_version: 1,
        ts_utc: session.updated_utc,
        kind: GATE_LEDGER_KIND,
        session_id: session_key,
        verdict,
        counter,
    };
    const written = _append_ledger_line(ledger_path, entry);

    return {
        verdict,
        consecutive_blocks: session.consecutive_blocks,
        bound,
        counted,
        circuit_open: session.consecutive_blocks >= bound,
        notice,
        ledger_line: written ? format_gate_ledger_line(entry) : null,
    };
}

function _load_config_fail_open(): AiTeamConfig {
    try {
        return load_ai_team_config();
    } catch {
        // A broken ai_team block must never break the Stop path — doctor
        // owns reporting it. Defaults = managed off = strict no-op.
        return AI_TEAM_DEFAULTS;
    }
}

// ── upstream plugin state discovery (read-only) ─────────────────────

/** Upstream's plugin-data directory name under `~/.claude/plugins/data/`. */
const _CODEX_PLUGIN_DATA_DIRNAME = `${CODEX_PLUGIN_ID}-${CODEX_MARKETPLACE_NAME}`;

/** First line of upstream's stop-gate task prompt — tags the gate job. */
export const UPSTREAM_GATE_JOB_TITLE = 'Codex Stop Gate Review';

/**
 * Mirror upstream `state.mjs::resolveStateDir` workspace segment:
 * `<sanitized basename>-<sha256(realpath(workspace_root))[:16]>`.
 */
function _workspace_state_segment(workspace_root: string): string {
    let canonical = workspace_root;
    try {
        canonical = fs.realpathSync.native(workspace_root);
    } catch {
        canonical = workspace_root;
    }
    const slug_source = path.basename(workspace_root) || 'workspace';
    const slug =
        slug_source.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
    const hash = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
    return `${slug}-${hash}`;
}

/**
 * Candidate upstream state dirs for this workspace, highest priority first:
 * `$CLAUDE_PLUGIN_DATA` (set by Claude Code inside plugin hooks), the
 * observed on-disk plugin-data layout under the Claude config dir, and
 * upstream's tmpdir fallback. Read-only — never created.
 */
export function upstream_state_dir_candidates(workspace_root: string): string[] {
    const segment = _workspace_state_segment(workspace_root);
    const candidates: string[] = [];
    const env = (process.env['CLAUDE_PLUGIN_DATA'] ?? '').trim();
    if (env !== '') {
        candidates.push(path.join(env, 'state', segment));
    }
    candidates.push(
        path.join(claude_config_dir(), 'plugins', 'data', _CODEX_PLUGIN_DATA_DIRNAME, 'state', segment),
    );
    candidates.push(path.join(os.tmpdir(), 'codex-companion', segment));
    return candidates;
}

/**
 * True when the upstream plugin's Review Gate is switched on for this
 * workspace (`config.stopReviewGate: true` in the plugin's `state.json`,
 * toggled by `/codex:setup --enable-review-gate`). Unreadable / absent
 * state → false. Read-only.
 */
export function upstream_gate_enabled(workspace_root: string): boolean {
    for (const dir of upstream_state_dir_candidates(workspace_root)) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf-8'));
        } catch {
            continue;
        }
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            continue;
        }
        const cfg = (parsed as Record<string, unknown>)['config'];
        if (cfg !== null && typeof cfg === 'object' && !Array.isArray(cfg)) {
            if ((cfg as Record<string, unknown>)['stopReviewGate'] === true) {
                return true;
            }
        }
    }
    return false;
}

export interface GateTranscript {
    /** Raw gate output — first line carries the ALLOW/BLOCK contract. */
    transcript: string;
    /** Upstream job id — used as the dedupe key for the counter. */
    job_id: string;
}

/**
 * Locate the newest completed stop-gate review job for this workspace
 * (and session, when both sides carry a session id) in the upstream
 * plugin's `jobs/` dir, and return its raw output. The plugin persists
 * `result.rawOutput` (the codex final answer whose first line is
 * `ALLOW:`/`BLOCK:`) in `jobs/<id>.json` with title
 * `Codex Stop Gate Review`. Null when no such job exists. Read-only.
 */
export function find_latest_gate_transcript(
    workspace_root: string,
    session_id: string | null | undefined,
): GateTranscript | null {
    let best: { transcript: string; job_id: string; sort_key: string } | null = null;
    for (const dir of upstream_state_dir_candidates(workspace_root)) {
        const jobs_dir = path.join(dir, 'jobs');
        let names: string[];
        try {
            names = fs.readdirSync(jobs_dir);
        } catch {
            continue;
        }
        for (const name of names) {
            if (!name.endsWith('.json')) {
                continue;
            }
            let job: unknown;
            try {
                job = JSON.parse(fs.readFileSync(path.join(jobs_dir, name), 'utf-8'));
            } catch {
                continue;
            }
            if (job === null || typeof job !== 'object' || Array.isArray(job)) {
                continue;
            }
            const rec = job as Record<string, unknown>;
            if (rec['title'] !== UPSTREAM_GATE_JOB_TITLE) {
                continue;
            }
            const job_session = typeof rec['sessionId'] === 'string' ? rec['sessionId'] : '';
            const want = (session_id ?? '').trim();
            if (want !== '' && job_session !== '' && job_session !== want) {
                continue;
            }
            const result = rec['result'];
            if (result === null || typeof result !== 'object' || Array.isArray(result)) {
                continue;
            }
            const raw_output = (result as Record<string, unknown>)['rawOutput'];
            if (typeof raw_output !== 'string' || raw_output.trim() === '') {
                continue;
            }
            const sort_key = String(rec['completedAt'] ?? rec['createdAt'] ?? '');
            const job_id = typeof rec['id'] === 'string' && rec['id'] !== '' ? rec['id'] : name;
            if (best === null || sort_key.localeCompare(best.sort_key) > 0) {
                best = { transcript: raw_output, job_id, sort_key };
            }
        }
    }
    return best === null ? null : { transcript: best.transcript, job_id: best.job_id };
}

// ── doctor sub-signal (c) — Review-Gate governance ──────────────────

/** Upstream's own cost warning, quoted verbatim in the doctor remedy. */
export const UPSTREAM_GATE_COST_WARNING =
    'The review gate can create a long-running Claude/Codex loop and may drain usage limits quickly.';

export interface GateDoctorSignal {
    /** Detail fragment for the folded team-check message. */
    gate_str: string;
    /** Remediation sentences to fold into the team-check remedy. */
    remedies: string[];
}

/**
 * Doctor sub-signal (c) — Review-Gate governance. Consumes the RAW
 * `ai_team.review_gate` mapping (the doctor reads settings leniently and
 * must not crash on an invalid block) plus the read-only upstream gate
 * probe. WARN states:
 *
 *   - plugin gate ON while `managed: false` → the unbounded-loop shape;
 *     remedy carries the enable hint + upstream's cost warning quoted.
 *   - `managed: true` with an invalid `max_consecutive_blocks` in the raw
 *     settings (the strict loader would reject the whole block) → WARN.
 */
export function review_gate_doctor_signal(
    project_root: string,
    gate_raw: Record<string, unknown>,
): GateDoctorSignal {
    const managed = gate_raw['managed'] === true;
    const bound_raw = gate_raw['max_consecutive_blocks'];
    const bound_invalid =
        'max_consecutive_blocks' in gate_raw &&
        (typeof bound_raw !== 'number' || !Number.isInteger(bound_raw) || bound_raw < 1);
    const plugin_gate_on = upstream_gate_enabled(project_root);

    if (managed && bound_invalid) {
        return {
            gate_str: 'review-gate ⚠️ managed, loop bound invalid',
            remedies: [
                'set `ai_team.review_gate.max_consecutive_blocks` to a positive ' +
                    'integer (the strict loader rejects the current value)',
            ],
        };
    }
    if (plugin_gate_on && !managed) {
        return {
            gate_str: 'review-gate ⚠️ plugin gate on, unmanaged',
            remedies: [
                'the codex plugin Review Gate is enabled but ' +
                    '`ai_team.review_gate.managed` is false — no loop bound applies ' +
                    `(upstream: "${UPSTREAM_GATE_COST_WARNING}"); set ` +
                    '`ai_team.review_gate.managed: true` in .agent-settings.yml, or ' +
                    'disable the gate via `/codex:setup --disable-review-gate`',
            ],
        };
    }
    if (managed) {
        const bound =
            typeof bound_raw === 'number' && Number.isInteger(bound_raw) && bound_raw >= 1
                ? bound_raw
                : AI_TEAM_DEFAULTS.review_gate.max_consecutive_blocks;
        return {
            gate_str:
                `review-gate on (managed, bound ${bound}, ` +
                `plugin gate ${plugin_gate_on ? 'on' : 'off'})`,
            remedies: [],
        };
    }
    return { gate_str: 'review-gate off', remedies: [] };
}
