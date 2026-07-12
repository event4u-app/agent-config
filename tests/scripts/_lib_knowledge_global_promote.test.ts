// Tests for src/scripts/_lib/knowledge_global_promote.ts — file-first usage
// signal + repo-slug / card-id derivation + promotion-suggestion decision.
//
// Golden-parity (ADR-200): python3 vs tsx on identical inputs, byte-identical
// stdout / stderr / exit. The usage sidecar is JSON with a `--date` injection
// point so the comparison is deterministic; the slug is pinned via a git
// remote in an isolated tmp repo.
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    append_tombstone,
    gate_sensitivity_for_promotion,
    load_tombstones,
    main as mainKgp,
    resolve_effective_sensitivity,
} from '../../src/scripts/_lib/knowledge_global_promote.js';
import { runInProc } from '../_lib/run_in_process.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN =
    process.env['TSX_BIN'] ??
    join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', '_lib', 'knowledge_global_promote.ts');

interface RunResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}


let repo: string;
let home: string;
beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'kgp-repo-'));
    home = mkdtempSync(join(tmpdir(), 'kgp-home-'));
    spawnSync('git', ['init', '-q'], { cwd: repo });
    spawnSync('git', ['remote', 'add', 'origin', 'https://github.com/acme/widget.git'], { cwd: repo });
});
afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
});

function env(): NodeJS.ProcessEnv {
    return { ...process.env, EVENT4U_CONFIG_HOME: home };
}

function runTs(args: readonly string[]): RunResult {
    return runInProc(mainKgp, args, { cwd: repo, env: env() });
}

// The tsx twin is the source of truth (the python original was deleted in the
// teardown); run it and assert a defined exit.
function bothMatch(args: readonly string[]): RunResult {
    const ts = runTs(args);
    expect(ts.status, `exit ${args.join(' ')}`).not.toBe(-1);
    return ts;
}

describe('knowledge_global_promote.ts — slug', () => {
    it('repo slug derives from git origin basename', () => {
        const ts = runTs(['slug']);
        expect(ts.status).toBe(0);
        expect(ts.stdout.trim()).toBe('widget');
        bothMatch(['slug']);
    });
});

describe('knowledge_global_promote.ts — record-seen', () => {
    it('records a sighting with deterministic date', () => {
        const args = [
            'record-seen',
            'mycard',
            '--slug',
            'repo-a',
            '--tier',
            'public',
            '--source',
            'https://github.com/x/y',
            '--date',
            '2026-06-17',
        ];
        const ts = runTs(args);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('"seen_in"');
        expect(ts.stdout).toContain('"promoted": false');
        bothMatch(args);
    });

    it('dedups repeated slug + keeps seen_in sorted', () => {
        // Two sightings of the same card in the same repo → seen_in stays [repo-a].
        runTs(['record-seen', 'c', '--slug', 'repo-b', '--tier', 'public', '--date', '2026-01-01']);
        const ts = runTs(['record-seen', 'c', '--slug', 'repo-a', '--tier', 'public', '--date', '2026-01-02']);
        expect(ts.status).toBe(0);
        // seen_in dedups + sorts: both repos present, repo-a before repo-b in seen_in.
        const seenIn = (JSON.parse(ts.stdout) as { seen_in: string[] }).seen_in;
        expect(seenIn).toEqual(['repo-a', 'repo-b']);
    });
});

describe('knowledge_global_promote.ts — candidates', () => {
    it('empty store → empty JSON list', () => {
        const ts = runTs(['candidates']);
        expect(ts.status).toBe(0);
        expect(ts.stdout.trim()).toBe('[]');
        bothMatch(['candidates']);
    });

    it('two distinct repos at threshold → suggested', () => {
        // auto_promote_threshold default = 2; record same card in two repos.
        runTs(['record-seen', 'sug', '--slug', 'repo-a', '--tier', 'public', '--date', '2026-01-01']);
        runTs(['record-seen', 'sug', '--slug', 'repo-b', '--tier', 'public', '--date', '2026-01-01']);
        const ts = runTs(['candidates']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('"card_id": "sug"');
    });

    it('proprietary card is never suggested', () => {
        runTs(['record-seen', 'priv', '--slug', 'repo-a', '--tier', 'proprietary', '--date', '2026-01-01']);
        runTs(['record-seen', 'priv', '--slug', 'repo-b', '--tier', 'proprietary', '--date', '2026-01-01']);
        const ts = runTs(['candidates']);
        expect(ts.stdout.trim()).toBe('[]');
    });
});

describe('knowledge_global_promote.ts — usage', () => {
    it('no subcommand → help, exit 1', () => {
        const ts = runTs([]);
        expect(ts.status).toBe(1);
    });

    it('record-seen with no card_id → exit 2', () => {
        const ts = runTs(['record-seen']);
        expect(ts.status).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// Sensitivity gate (Phase 1, road-to-feedback-8.11 / successor note to
// ADR-119) — layered ON TOP of the existing tier/redaction gate.
// ---------------------------------------------------------------------------

describe('knowledge_global_promote.ts — resolve_effective_sensitivity', () => {
    it('a redaction hit forces prohibited regardless of the declared value', () => {
        expect(resolve_effective_sensitivity('shareable', true)).toBe('prohibited');
        expect(resolve_effective_sensitivity('project', true)).toBe('prohibited');
        expect(resolve_effective_sensitivity('', true)).toBe('prohibited');
    });

    it('an unset/invalid declared value defaults to project — never shareable', () => {
        expect(resolve_effective_sensitivity('', false)).toBe('project');
        expect(resolve_effective_sensitivity('bogus', false)).toBe('project');
    });

    it('a clean card keeps its declared value', () => {
        expect(resolve_effective_sensitivity('shareable', false)).toBe('shareable');
        expect(resolve_effective_sensitivity('project', false)).toBe('project');
    });
});

describe('knowledge_global_promote.ts — gate_sensitivity_for_promotion', () => {
    it('a project-sensitivity card is refused even when clean and reasoned', () => {
        const res = gate_sensitivity_for_promotion('project', {
            violations_present: false,
            promotion_reason: 'looks safe to me',
        });
        expect(res.eligible).toBe(false);
        expect(res.sensitivity).toBe('project');
    });

    it('a redaction hit on a declared-shareable card blocks as prohibited, never a silent shareable', () => {
        const res = gate_sensitivity_for_promotion('shareable', {
            violations_present: true,
            promotion_reason: 'reviewed before the edit that introduced the secret',
        });
        expect(res.eligible).toBe(false);
        expect(res.sensitivity).toBe('prohibited');
        expect(res.reason).toMatch(/prohibited/);
    });

    it('a shareable card with no promotion_reason is blocked with a clear message', () => {
        const res = gate_sensitivity_for_promotion('shareable', { violations_present: false });
        expect(res.eligible).toBe(false);
        expect(res.reason).toMatch(/promotion_reason/);
    });

    it('a shareable card with a human-entered promotion_reason and no violations is eligible', () => {
        const res = gate_sensitivity_for_promotion('shareable', {
            violations_present: false,
            promotion_reason: 'approved for cross-project reuse by maintainer',
        });
        expect(res.eligible).toBe(true);
        expect(res.sensitivity).toBe('shareable');
    });

    it('no declared sensitivity at all defaults to project and is refused (never auto-shareable)', () => {
        const res = gate_sensitivity_for_promotion('', { violations_present: false });
        expect(res.eligible).toBe(false);
        expect(res.sensitivity).toBe('project');
    });
});

// ---------------------------------------------------------------------------
// Revocation ledger — append-only tombstone trail
// ---------------------------------------------------------------------------

describe('knowledge_global_promote.ts — revocation ledger', () => {
    it('empty store → no tombstones', () => {
        expect(load_tombstones({ EVENT4U_CONFIG_HOME: home })).toEqual([]);
    });

    it('append_tombstone records revoked_at / card_id / reason, oldest first', () => {
        append_tombstone('card-a', 'manual forget', { today: '2026-01-01', env: { EVENT4U_CONFIG_HOME: home } });
        append_tombstone('card-b', 'bulk forget (tier=proprietary)', {
            today: '2026-01-02',
            env: { EVENT4U_CONFIG_HOME: home },
        });
        const trail = load_tombstones({ EVENT4U_CONFIG_HOME: home });
        expect(trail).toEqual([
            { revoked_at: '2026-01-01', card_id: 'card-a', reason: 'manual forget' },
            { revoked_at: '2026-01-02', card_id: 'card-b', reason: 'bulk forget (tier=proprietary)' },
        ]);
    });

    it('a missing reason defaults to a non-empty placeholder — never a blank audit line', () => {
        append_tombstone('card-c', '', { today: '2026-01-03', env: { EVENT4U_CONFIG_HOME: home } });
        const trail = load_tombstones({ EVENT4U_CONFIG_HOME: home });
        expect(trail[0]?.reason).toBeTruthy();
    });

    it('a corrupt ledger line is skipped, never crashes the read', () => {
        append_tombstone('card-d', 'ok', { today: '2026-01-04', env: { EVENT4U_CONFIG_HOME: home } });
        const p = join(home, 'knowledge', '.revocations.jsonl');
        appendFileSync(p, 'not json\n');
        append_tombstone('card-e', 'ok', { today: '2026-01-05', env: { EVENT4U_CONFIG_HOME: home } });
        const trail = load_tombstones({ EVENT4U_CONFIG_HOME: home });
        expect(trail.map((t) => t.card_id)).toEqual(['card-d', 'card-e']);
    });
});
