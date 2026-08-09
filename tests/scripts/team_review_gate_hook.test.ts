/**
 * E2E for the Review-Gate stop-concern call-site
 * (`src/scripts/team_review_gate_hook.ts`) — road-to-team-mode Phase 4.
 *
 * Spawns the hook via tsx with a dispatcher envelope on stdin against a
 * seeded upstream-plugin state dir. Asserts: unmanaged = strict no-op
 * (byte-identical Stop path), managed counting across three gate BLOCKs
 * renders the circuit breaker exactly once on stdout, a Stop without a
 * fresh gate run is deduped, and every path exits 0 (never blocks).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'team_review_gate_hook.ts');
const TSX = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const tmp_dirs: string[] = [];

afterEach(() => {
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

interface Env {
    root: string;
    claudeDir: string;
    jobsDir: string;
}

function make_env(managed: boolean, settings_override?: string | null): Env {
    const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gate-hook-')));
    tmp_dirs.push(base);
    const root = path.join(base, 'proj');
    fs.mkdirSync(root, { recursive: true });
    if (settings_override !== null) {
        fs.writeFileSync(
            path.join(root, '.agent-settings.yml'),
            settings_override ??
                'ai_team:\n  enabled: true\n' +
                    (managed
                        ? '  review_gate:\n    managed: true\n    max_consecutive_blocks: 3\n'
                        : ''),
        );
    }
    const claudeDir = path.join(base, 'claude');
    const canonical = fs.realpathSync.native(root);
    const hash = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
    const stateDir = path.join(
        claudeDir,
        'plugins',
        'data',
        'codex-openai-codex',
        'state',
        `proj-${hash}`,
    );
    const jobsDir = path.join(stateDir, 'jobs');
    fs.mkdirSync(jobsDir, { recursive: true });
    fs.writeFileSync(
        path.join(stateDir, 'state.json'),
        JSON.stringify({ version: 1, config: { stopReviewGate: true }, jobs: [] }),
    );
    return { root, claudeDir, jobsDir };
}

function seed_gate_job(env: Env, id: string, rawOutput: string, completedAt: string): void {
    fs.writeFileSync(
        path.join(env.jobsDir, `${id}.json`),
        JSON.stringify({
            id,
            title: 'Codex Stop Gate Review',
            status: 'completed',
            sessionId: 'sess-e2e',
            completedAt,
            result: { rawOutput },
        }),
    );
}

function run_stop(env: Env): { status: number; stdout: string; stderr: string } {
    const envelope = JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event: 'stop',
        native_event: 'Stop',
        session_id: 'sess-e2e',
        workspace_root: env.root,
        payload: {},
        settings: {},
    });
    const r = spawnSync(TSX, [HOOK], {
        encoding: 'utf8',
        cwd: env.root,
        input: envelope,
        env: {
            ...process.env,
            CLAUDE_CONFIG_DIR: env.claudeDir,
            CLAUDE_PLUGIN_DATA: '',
        },
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('team_review_gate_hook — stop-concern call-site (E2E via tsx)', () => {
    it('managed: false → strict no-op, exit 0, no output, no state written', () => {
        const env = make_env(false);
        seed_gate_job(env, 'task-1', 'BLOCK: something', '2026-07-12T10:00:00Z');
        const r = run_stop(env);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('');
        expect(
            fs.existsSync(path.join(env.root, 'agents', 'runtime', 'state', 'team-review-gate.json')),
        ).toBe(false);
        expect(fs.existsSync(path.join(env.root, 'agents', 'runtime', 'team', 'events.log'))).toBe(
            false,
        );
    });

    it('default posture: ai_team absent (no .agent-settings.yml) → strict no-op, exit 0, no output, no state', () => {
        const env = make_env(false, null);
        seed_gate_job(env, 'task-1', 'BLOCK: something', '2026-07-12T10:00:00Z');
        const r = run_stop(env);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toBe('');
        expect(
            fs.existsSync(path.join(env.root, 'agents', 'runtime', 'state', 'team-review-gate.json')),
        ).toBe(false);
        expect(fs.existsSync(path.join(env.root, 'agents', 'runtime', 'team', 'events.log'))).toBe(
            false,
        );
    });

    it('a leftover ai_team.enabled: false does NOT suppress managed governance (decoupled, Step 1.3)', () => {
        // `ai_team.enabled` was deleted; `managed` no longer stacks behind it.
        // A leftover `enabled: false` from an older install is accepted and
        // ignored by the config loader — it must not silently disable the
        // Review-Gate counter, which is governed by `managed` alone.
        const env = make_env(
            false,
            'ai_team:\n  enabled: false\n  review_gate:\n    managed: true\n    max_consecutive_blocks: 3\n',
        );
        seed_gate_job(env, 'task-1', 'BLOCK: something', '2026-07-12T10:00:00Z');
        const r = run_stop(env);
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toBe(''); // one BLOCK — below the bound, no notice yet
        // State + ledger ARE written — governance is active despite `enabled: false`.
        expect(
            fs.existsSync(path.join(env.root, 'agents', 'runtime', 'state', 'team-review-gate.json')),
        ).toBe(true);
        const ledger = fs
            .readFileSync(path.join(env.root, 'agents', 'runtime', 'team', 'events.log'), 'utf-8')
            .trim();
        expect(ledger).toContain('"verdict":"BLOCK"');
        expect(ledger).toContain('"counter":"1/3"');
    });

    it('managed: 3 consecutive BLOCKs → circuit breaker on stdout exactly once; dedupe on a stale job', () => {
        const env = make_env(true);

        seed_gate_job(env, 'task-1', 'BLOCK: issue 1', '2026-07-12T10:00:00Z');
        const r1 = run_stop(env);
        expect(r1.status, r1.stderr).toBe(0);
        expect(r1.stdout).toBe('');

        seed_gate_job(env, 'task-2', 'BLOCK: issue 2', '2026-07-12T10:05:00Z');
        const r2 = run_stop(env);
        expect(r2.stdout).toBe('');

        seed_gate_job(env, 'task-3', 'BLOCK: issue 3', '2026-07-12T10:10:00Z');
        const r3 = run_stop(env);
        expect(r3.status).toBe(0);
        expect(r3.stdout).toContain('team review-gate circuit breaker');
        expect(r3.stdout).toContain('3 consecutive BLOCK');

        // A Stop WITHOUT a fresh gate run re-observes task-3 → deduped,
        // and the notice is never rendered a second time.
        const r4 = run_stop(env);
        expect(r4.status).toBe(0);
        expect(r4.stdout).toBe('');

        // Ledger carries exactly the three counted verdicts.
        const ledger = fs
            .readFileSync(path.join(env.root, 'agents', 'runtime', 'team', 'events.log'), 'utf-8')
            .trim()
            .split('\n')
            .map((l) => JSON.parse(l) as { verdict: string; counter: string });
        expect(ledger.map((e) => `${e.verdict} ${e.counter}`)).toEqual([
            'BLOCK 1/3',
            'BLOCK 2/3',
            'BLOCK 3/3',
        ]);
    });

    it('ALLOW resets: BLOCK BLOCK ALLOW BLOCK never trips', () => {
        const env = make_env(true);
        seed_gate_job(env, 'task-1', 'BLOCK: 1', '2026-07-12T10:00:00Z');
        run_stop(env);
        seed_gate_job(env, 'task-2', 'BLOCK: 2', '2026-07-12T10:05:00Z');
        run_stop(env);
        seed_gate_job(env, 'task-3', 'ALLOW: fixed', '2026-07-12T10:10:00Z');
        const allow = run_stop(env);
        expect(allow.stdout).toBe('');
        seed_gate_job(env, 'task-4', 'BLOCK: new issue', '2026-07-12T10:15:00Z');
        const r = run_stop(env);
        expect(r.stdout).toBe('');
        const state = JSON.parse(
            fs.readFileSync(
                path.join(env.root, 'agents', 'runtime', 'state', 'team-review-gate.json'),
                'utf-8',
            ),
        ) as { sessions: Record<string, { consecutive_blocks: number }> };
        expect(state.sessions['sess-e2e']?.consecutive_blocks).toBe(1);
    });

    it('no gate job persisted → exit 0, silent (nothing to govern)', () => {
        const env = make_env(true);
        const r = run_stop(env);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('');
    });
});
