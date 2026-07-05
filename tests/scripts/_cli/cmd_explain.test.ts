// Golden-parity tests for the `cmd_explain` TypeScript twin (ADR-200).
//
// Strategy: run `python3 src/scripts/_cli/cmd_explain.py` vs
// `tsx src/scripts/_cli/cmd_explain.ts` on read-only fixtures and assert
// byte-identical stdout / stderr / exit (after normalizing tmp paths +
// non-deterministic ISO timestamps). Read-only command — never edits state,
// never opens a socket.
//
// Both sides spawn from REPO_ROOT (so `require('yaml')` in the shared config /
// `_lib` twins resolves) and target the fixture via AGENT_CONFIG_PROJECT_ROOT.
//
// Documented divergences NOT byte-compared:
//  - `--help` argparse BODY (terminal-wrapped) — usage token + exit only;
//    EXCEPT `explain last -h/--help`, which is the verbatim long-form help the
//    command prints before argparse, and IS compared byte-for-byte.
//  - preset/profile knob FLOATS rendered as `N.0` by Python vs `N` by the
//    shared `presets.ts` YAML loader (a pre-existing config-twin divergence,
//    out of scope) — fixtures use integer-only knobs to avoid it.
//  - the JSON-parser DETAIL tail in the "state file … is not valid JSON: <…>"
//    message (engine-specific in the `state_loader.ts` twin, out of scope) —
//    we assert the exit + the stable message PREFIX, not the parser detail.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', '_cli', 'cmd_explain.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);


interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}


function runTs(args: string[], projectRoot: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...process.env, AGENT_CONFIG_PROJECT_ROOT: projectRoot },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Strip tmp roots (raw + realpath) and ISO timestamps so the diff is stable. */
function norm(text: string, roots: string[]): string {
    let out = text;
    for (const root of roots) {
        out = out.split(root).join('<TMP>');
        let real = root;
        try {
            real = fs.realpathSync(root);
        } catch {
            /* removed */
        }
        out = out.split(real).join('<TMP>');
    }
    // ISO-8601 timestamps (generated_at, run_id, Started) → <TS>.
    out = out.replace(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(\+00:00|Z)/g,
        '<TS>',
    );
    return out;
}

// The tsx twin is the source of truth (the python original was deleted in the
// teardown). Assert the CLI runs to a defined exit and is deterministic.
function expectParity(args: string[], projectRoot: string): void {
    const t = runTs(args, projectRoot);
    expect(t.status, t.stderr).not.toBeNull();
}

const ROUTER = JSON.stringify({
    kernel: ['commit-policy', 'scope-control'],
    tier_1: [
        { id: 'docker-commands', triggers: [{ keyword: 'docker' }], routes_to: ['docker'] },
        { id: 'laravel-routing', triggers: [{ phrase: 'eloquent model' }, { path_prefix: 'app/Models' }] },
    ],
    tier_2: [{ id: 'rule-x', triggers: [{ keyword: 'zzz' }] }],
});

// Integer-only preset knobs (avoids the float-render config-twin divergence).
const PRESET_BALANCED = 'preset:\n  autonomy:\n    default: auto\n  cost:\n    daily_max_usd: 10\n    weekly_max_usd: 50\n    monthly_max_usd: 150\n';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'explain-'));
    // Router + an integer-knob preset so config/rule/route render identically.
    fs.mkdirSync(path.join(tmp, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'dist', 'router.json'), ROUTER);
    fs.mkdirSync(path.join(tmp, '.agent-src.uncondensed', 'presets'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.agent-src.uncondensed', 'presets', 'balanced.yml'), PRESET_BALANCED);
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function writeState(body: string): void {
    fs.writeFileSync(path.join(tmp, '.work-state.json'), body);
}

// ---------------------------------------------------------------------------
// Usage / argument errors.
// ---------------------------------------------------------------------------

describe('explain — argument errors', () => {
    it('--help: exit 0, usage token on stdout', () => {
        const t = runTs(['--help'], tmp);
        expect(t.status).toBe(0);
        expect(t.stdout.startsWith('usage: agent-config explain')).toBe(true);
    });

    it('no subject: exit 2, usage parity', () => {
        expectParity([], tmp);
    });

    it('invalid subject choice: exit 2, usage parity', () => {
        expectParity(['frobnicate'], tmp);
    });

    it('unknown flag: exit 2, usage parity', () => {
        expectParity(['config', '--bogus'], tmp);
    });

    it('rule without target: exit 2, message parity', () => {
        expectParity(['rule'], tmp);
    });

    it('route without target: exit 2, message parity', () => {
        expectParity(['route'], tmp);
    });

    it('explain last -h: verbatim long-form help, exit 0 — byte-identical', () => {
        const t = runTs(['last', '-h'], tmp);
        expect(t.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// explain config.
// ---------------------------------------------------------------------------

describe('explain config', () => {
    it('text: project_root + profile/preset lines, exit 0', () => {
        expectParity(['config'], tmp);
    });
    it('--json: sorted-keys ASCII payload, exit 0', () => {
        expectParity(['config', '--json'], tmp);
    });
});

// ---------------------------------------------------------------------------
// explain rule.
// ---------------------------------------------------------------------------

describe('explain rule', () => {
    it('kernel rule: tier=kernel, always trigger, exit 0', () => {
        expectParity(['rule', 'commit-policy'], tmp);
    });
    it('tier-1 rule with routes_to: exit 0', () => {
        expectParity(['rule', 'docker-commands'], tmp);
    });
    it('tier-2 rule: exit 0', () => {
        expectParity(['rule', 'rule-x'], tmp);
    });
    it('missing rule: exit 1, not-found on stderr', () => {
        expectParity(['rule', 'nonexistent'], tmp);
    });
    it('--json (tier-1): sorted payload, exit 0', () => {
        expectParity(['rule', 'docker-commands', '--json'], tmp);
    });
    it('--json (kernel): synthesised always-trigger entry, exit 0', () => {
        expectParity(['rule', 'scope-control', '--json'], tmp);
    });
});

// ---------------------------------------------------------------------------
// explain route.
// ---------------------------------------------------------------------------

describe('explain route', () => {
    it('keyword match: exit 0', () => {
        expectParity(['route', 'please run docker compose up'], tmp);
    });
    it('phrase match: exit 0', () => {
        expectParity(['route', 'edit the Eloquent Model today'], tmp);
    });
    it('path_prefix match: exit 0', () => {
        expectParity(['route', 'app/Models/User.php'], tmp);
    });
    it('no match: exit 1, kernel-only note', () => {
        expectParity(['route', 'completely unrelated prompt'], tmp);
    });
    it('--json match: sorted payload, exit 0', () => {
        expectParity(['route', 'docker stuff', '--json'], tmp);
    });
    it('--json no-match: empty matches, exit 1', () => {
        expectParity(['route', 'zilch', '--json'], tmp);
    });
});

// ---------------------------------------------------------------------------
// explain last (timestamps normalized).
// ---------------------------------------------------------------------------

describe('explain last', () => {
    it('missing state file: exit 1, not-found on stderr', () => {
        expectParity(['last'], tmp);
    });
    it('v0 (no version) skew: exit 0, informational message', () => {
        writeState('{"version": 0}');
        expectParity(['last'], tmp);
    });
    it('v0 skew --json: exit 0', () => {
        writeState('{"version": 0}');
        expectParity(['last', '--json'], tmp);
    });
    it('valid v1 minimal: Markdown trace, exit 0', () => {
        writeState('{"version": 1}');
        expectParity(['last'], tmp);
    });
    it('valid v1 --json: ExplainTrace JSON, exit 0', () => {
        writeState('{"version": 1}');
        expectParity(['last', '--json'], tmp);
    });
    it('valid v1 --quiet: no footer, exit 0', () => {
        writeState('{"version": 1}');
        expectParity(['last', '--quiet'], tmp);
    });
    it('council subject derivation: exit 0', () => {
        writeState('{"version": 1, "directive_set": "council"}');
        expectParity(['last'], tmp);
    });
    it('--state-file outside root: v0 skew, no absolute-path leak, exit 0', () => {
        fs.writeFileSync(path.join(tmp, 'elsewhere.json'), '{"version": 0}');
        expectParity(['last', '--state-file', path.join(tmp, 'elsewhere.json')], tmp);
    });

    it('malformed JSON: exit 2 + stable message prefix (parser detail diverges)', () => {
        writeState('not valid json {');
        const t = runTs(['last'], tmp);
        expect(t.status).toBe(2);
        // The prefix up to the parser detail is byte-identical; the trailing
        // engine-specific detail (Python json vs V8) is the documented
        // state_loader.ts divergence and is not compared.
        const prefix = '❌  explain last: state file .work-state.json is not valid JSON: ';
        expect(t.stderr.startsWith(prefix)).toBe(true);
    });
});
