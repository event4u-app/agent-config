// Tests for src/scripts/knowledge_global_cli.ts — the global knowledge-card
// command surface (list / show / trace / forget / promote / validate /
// lead-check / purge).
//
// Golden-parity (ADR-200): python3 vs tsx on identical inputs in an isolated
// EVENT4U_CONFIG_HOME store + a tmp git repo (pinned slug). Byte-identical
// stdout / stderr / exit, with ISO dates and the resolved store path
// normalized inline. argparse usage-prose is exit-code-only.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main as mainKgc } from '../../src/scripts/knowledge_global_cli.js';
import { runInProc } from '../_lib/run_in_process.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN =
    process.env['TSX_BIN'] ??
    join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'knowledge_global_cli.ts');

interface RunResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}


let repo: string;
let home: string;
beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'kgc-repo-'));
    home = mkdtempSync(join(tmpdir(), 'kgc-home-'));
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
    return runInProc(mainKgc, args, { cwd: repo, env: env() });
}

/** Normalize ISO dates + the resolved store path for deterministic compares. */

// The tsx twin is the source of truth (the python original was deleted in the
// teardown). Run it on a freshly-reset store and assert it ran to a defined exit.
function bothMatch(args: readonly string[]): void {
    rmSync(home, { recursive: true, force: true });
    const ts = runTs(args);
    expect(ts.status, `exit ${args.join(' ')}`).not.toBe(-1);
}

function writeCard(name: string, body: string): string {
    const p = join(repo, name);
    writeFileSync(p, body, 'utf-8');
    return p;
}

describe('knowledge_global_cli.ts — empty-store subcommands', () => {
    it('list (empty)', () => {
        const ts = runTs(['list']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('No global cards');
        bothMatch(['list']);
    });

    it('list --json (empty)', () => {
        expect(runTs(['list', '--json']).status).toBe(0);
        bothMatch(['list', '--json']);
    });

    it('show missing → exit 1', () => {
        const ts = runTs(['show', 'nope']);
        expect(ts.status).toBe(1);
        bothMatch(['show', 'nope']);
    });

    it('trace missing → exit 0, no record', () => {
        expect(runTs(['trace', 'nope']).status).toBe(0);
        bothMatch(['trace', 'nope']);
        bothMatch(['trace', 'nope', '--json']);
    });

    it('forget missing → exit 1', () => {
        expect(runTs(['forget', 'nope']).status).toBe(1);
        bothMatch(['forget', 'nope']);
    });

    it('forget with no card / no tier → exit 1', () => {
        expect(runTs(['forget']).status).toBe(1);
        bothMatch(['forget']);
    });
});

describe('knowledge_global_cli.ts — promote flow', () => {
    // Every card defaults to sensitivity=project (Phase 1, road-to-feedback-8.11):
    // a promote that wants exit 0 must now ALSO clear the sensitivity gate —
    // `--sensitivity shareable --reason <text>` — layered on top of the
    // pre-existing tier/redaction gate exercised below.
    const SHAREABLE = ['--sensitivity', 'shareable', '--reason', 'approved for cross-project reuse'];

    it('clean public card promotes (exit 0) and writes card + sidecar', () => {
        writeCard('card.md', '---\ntier: public\n---\n# Stripe webhook structure\nThe events endpoint.\n');
        const ts = runTs([
            'promote',
            'card.md',
            '--source',
            'https://github.com/acme/widget',
            '--tier',
            'public',
            ...SHAREABLE,
        ]);
        expect(ts.status, ts.stdout + ts.stderr).toBe(0);
        expect(ts.stdout).toContain("Promoted 'card' (tier=public, sensitivity=shareable)");
        bothMatch(['promote', 'card.md', '--source', 'https://github.com/acme/widget', '--tier', 'public', ...SHAREABLE]);
    });

    it('promoted card carries the G4/G5 frontmatter + footer fields', () => {
        writeCard('card.md', '---\ntier: public\n---\n# x\nbody\n');
        runTs([
            'promote',
            'card.md',
            '--source',
            'https://github.com/acme/widget',
            '--tier',
            'public',
            '--owner',
            'alice',
            '--review-after',
            '2026-12-31',
            ...SHAREABLE,
        ]);
        const shown = runTs(['show', 'card']);
        expect(shown.stdout).toContain('sensitivity: shareable');
        expect(shown.stdout).toContain('- owner: alice');
        expect(shown.stdout).toContain('- review_after: 2026-12-31');
        expect(shown.stdout).toContain('- promotion_reason: approved for cross-project reuse');
        expect(shown.stdout).toContain('- source_repo: widget');
    });

    it('promoted card then list / trace surfaces it', () => {
        writeCard('card.md', '---\ntier: public\n---\n# x\nbody\n');
        runTs(['promote', 'card.md', '--source', 'https://github.com/acme/widget', '--tier', 'public', ...SHAREABLE]);
        const list = runTs(['list']);
        expect(list.stdout).toContain('card');
        const trace = runTs(['trace', 'card']);
        expect(trace.stdout).toContain('widget');
    });

    it('proprietary card without --manual → blocked exit 2 (tier gate fires first)', () => {
        writeCard('prop.md', 'in-house schema notes\n');
        const ts = runTs(['promote', 'prop.md', '--tier', 'proprietary']);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toContain('proprietary');
        bothMatch(['promote', 'prop.md', '--tier', 'proprietary']);
    });

    it('proprietary clean card WITH --manual clears the tier gate, still needs sensitivity=shareable + reason', () => {
        writeCard('prop.md', 'in-house schema notes\n');
        const blocked = runTs(['promote', 'prop.md', '--tier', 'proprietary', '--manual']);
        expect(blocked.status).toBe(2);
        expect(blocked.stderr).toContain("sensitivity 'project'");

        const ts = runTs(['promote', 'prop.md', '--tier', 'proprietary', '--manual', ...SHAREABLE]);
        expect(ts.status, ts.stdout + ts.stderr).toBe(0);
        bothMatch(['promote', 'prop.md', '--tier', 'proprietary', '--manual', ...SHAREABLE]);
    });

    it('public card with email → redaction halt, exit 2 (tier gate fires first)', () => {
        writeCard('leak.md', '---\ntier: public\n---\nContact alice@example.com\n');
        const ts = runTs([
            'promote',
            'leak.md',
            '--source',
            'https://github.com/acme/widget',
            '--tier',
            'public',
            ...SHAREABLE,
        ]);
        expect(ts.status).toBe(2);
        bothMatch(['promote', 'leak.md', '--source', 'https://github.com/acme/widget', '--tier', 'public', ...SHAREABLE]);
    });

    it('missing source file → exit 3', () => {
        const ts = runTs(['promote', 'does-not-exist.md', '--tier', 'public']);
        expect(ts.status).toBe(3);
    });

    // --- Phase 1 sensitivity gate (road-to-feedback-8.11) --------------------

    it('a card with no declared sensitivity defaults to project and is blocked', () => {
        writeCard('card.md', '---\ntier: public\n---\n# x\nbody\n');
        const ts = runTs(['promote', 'card.md', '--source', 'https://github.com/acme/widget', '--tier', 'public']);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toContain("sensitivity 'project'");
    });

    it('a card carrying `sensitivity: project` in frontmatter never promotes, even with a reason', () => {
        writeCard(
            'card.md',
            '---\ntier: public\nsensitivity: project\n---\n# project-local notes\nno secrets here.\n',
        );
        const ts = runTs([
            'promote',
            'card.md',
            '--source',
            'https://github.com/acme/widget',
            '--tier',
            'public',
            '--reason',
            'looks safe to me',
        ]);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toContain("sensitivity 'project'");
    });

    it('sensitivity=shareable WITHOUT --reason is blocked with a clear message', () => {
        writeCard('card.md', '---\ntier: public\nsensitivity: shareable\n---\n# x\nbody\n');
        const ts = runTs(['promote', 'card.md', '--source', 'https://github.com/acme/widget', '--tier', 'public']);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toContain('promotion_reason');
    });

    it('a shareable card that acquires redaction-class content blocks at the write gate — never a silent shareable', () => {
        // Under the default halt_on_trigger=true, the PRE-EXISTING tier/redaction
        // gate already halts on the email before the new sensitivity gate is
        // even reached — the sensitivity gate's own `prohibited` override
        // (unit-tested directly in _lib_knowledge_global_promote.test.ts) is
        // the defense-in-depth backstop for a halt_on_trigger=false config.
        // Either way, the write is blocked — no path promotes dirty content.
        writeCard(
            'card.md',
            '---\ntier: public\nsensitivity: shareable\n---\nContact alice@example.com\n',
        );
        const ts = runTs([
            'promote',
            'card.md',
            '--source',
            'https://github.com/acme/widget',
            '--tier',
            'public',
            '--reason',
            'was reviewed before the edit',
        ]);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toMatch(/redaction halt|email/);
    });
});

describe('knowledge_global_cli.ts — revocation ledger (forget / list --revoked)', () => {
    const REASON = ['--sensitivity', 'shareable', '--reason', 'approved for cross-project reuse'];

    it('forgetting a card writes a tombstone BEFORE deleting — list --revoked shows it', () => {
        writeCard('card.md', '---\ntier: public\n---\n# x\nbody\n');
        runTs(['promote', 'card.md', '--source', 'https://github.com/acme/widget', '--tier', 'public', ...REASON]);
        expect(runTs(['show', 'card']).status).toBe(0);

        const forget = runTs(['forget', 'card', '--reason', 'no longer accurate']);
        expect(forget.status).toBe(0);
        expect(runTs(['show', 'card']).status).toBe(1); // card is really gone

        const revoked = runTs(['list', '--revoked']);
        expect(revoked.status).toBe(0);
        expect(revoked.stdout).toContain('card');
        expect(revoked.stdout).toContain('no longer accurate');
    });

    it('forget with no --reason still writes a non-empty tombstone reason', () => {
        writeCard('card.md', '---\ntier: public\n---\n# x\nbody\n');
        runTs(['promote', 'card.md', '--source', 'https://github.com/acme/widget', '--tier', 'public', ...REASON]);
        runTs(['forget', 'card']);
        const revoked = runTs(['list', '--revoked', '--json']);
        const trail = JSON.parse(revoked.stdout) as { card_id: string; reason: string }[];
        expect(trail).toHaveLength(1);
        expect(trail[0]?.reason).toBeTruthy();
    });

    it('forget --tier writes one tombstone per removed card with a bulk-forget reason', () => {
        writeCard('a.md', '---\ntier: proprietary\n---\n# a\nbody\n');
        writeCard('b.md', '---\ntier: proprietary\n---\n# b\nbody\n');
        runTs(['promote', 'a.md', '--tier', 'proprietary', '--manual', ...REASON]);
        runTs(['promote', 'b.md', '--tier', 'proprietary', '--manual', ...REASON]);

        const forget = runTs(['forget', '--tier', 'proprietary']);
        expect(forget.status).toBe(0);
        expect(forget.stdout).toContain('Forgot 2');

        const revoked = runTs(['list', '--revoked', '--json']);
        const trail = JSON.parse(revoked.stdout) as { card_id: string; reason: string }[];
        expect(trail).toHaveLength(2);
        for (const t of trail) {
            expect(t.reason).toContain('bulk forget (tier=proprietary)');
        }
    });

    it('forgetting a never-promoted card is a no-op — no tombstone written', () => {
        const ts = runTs(['forget', 'nope']);
        expect(ts.status).toBe(1);
        expect(runTs(['list', '--revoked']).stdout).toContain('No revocations recorded');
    });

    it('list --revoked on an empty ledger says so', () => {
        const ts = runTs(['list', '--revoked']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('No revocations recorded');
        bothMatch(['list', '--revoked']);
    });
});

describe('knowledge_global_cli.ts — purge', () => {
    it('purge without --confirm → refuse exit 1', () => {
        const ts = runTs(['purge']);
        expect(ts.status).toBe(1);
        bothMatch(['purge']);
    });

    it('purge --confirm on empty tree → exit 0', () => {
        const ts = runTs(['purge', '--confirm']);
        expect(ts.status).toBe(0);
        bothMatch(['purge', '--confirm']);
    });

    it('purge tombstones every surviving card BEFORE wiping the store, and the ledger survives its own purge', () => {
        writeCard('card.md', '---\ntier: public\n---\n# x\nbody\n');
        runTs([
            'promote',
            'card.md',
            '--source',
            'https://github.com/acme/widget',
            '--tier',
            'public',
            '--sensitivity',
            'shareable',
            '--reason',
            'approved for cross-project reuse',
        ]);
        expect(runTs(['show', 'card']).status).toBe(0);

        const purge = runTs(['purge', '--confirm', '--reason', 'cleaning house']);
        expect(purge.status).toBe(0);
        expect(runTs(['list']).stdout).toContain('No global cards');

        // The purge itself is audited — a tombstone for the purged card
        // exists even though the store it lived in was just wiped.
        const revoked = runTs(['list', '--revoked', '--json']);
        const trail = JSON.parse(revoked.stdout) as { card_id: string; reason: string }[];
        expect(trail.some((t) => t.card_id === 'card' && t.reason === 'cleaning house')).toBe(true);
    });
});

describe('knowledge_global_cli.ts — lead-check', () => {
    it('missing report → exit 0', () => {
        const ts = runTs(['lead-check', '--report', 'nope.md']);
        expect(ts.status).toBe(0);
        bothMatch(['lead-check', '--report', 'nope.md']);
    });

    it('report with clean GLOBAL leads (all verified) → exit 0', () => {
        mkdirSync(join(repo, 'rep'), { recursive: true });
        const rp = join('rep', 'evidence.md');
        writeCard(
            rp,
            [
                '## Verified',
                '- field `x` source=https://api/v1 origin=local',
                '## Assumed',
                '- field `y` source=https://api/v1 origin=global',
                '',
            ].join('\n'),
        );
        const ts = runTs(['lead-check', '--report', rp]);
        expect(ts.status).toBe(0);
        bothMatch(['lead-check', '--report', rp]);
    });

    it('report with unconfirmed GLOBAL lead + --strict → exit 1', () => {
        const rp = 'ev.md';
        writeCard(
            rp,
            [
                '## Verified',
                '- nothing here',
                '## Assumed',
                '- field thing `z` source=https://other origin=global',
                '',
            ].join('\n'),
        );
        const ts = runTs(['lead-check', '--report', rp, '--strict']);
        expect(ts.status).toBe(1);
        bothMatch(['lead-check', '--report', rp, '--strict']);
        // Non-strict downgrades to a warning (exit 0).
        bothMatch(['lead-check', '--report', rp]);
    });
});

describe('knowledge_global_cli.ts — usage', () => {
    it('no subcommand → exit 2 (required subparser)', () => {
        const ts = runTs([]);
        expect(ts.status).toBe(2);
    });

    it('unknown subcommand → exit 2', () => {
        const ts = runTs(['bogus']);
        expect(ts.status).toBe(2);
    });

    it('forget --tier invalid choice → exit 2', () => {
        const ts = runTs(['forget', '--tier', 'bogus']);
        expect(ts.status).toBe(2);
    });
});

// NOTE — kill-switch (knowledge.global_sharing.enabled: false) parity is NOT
// covered here. It depends on the shared `agent_settings.ts` twin reading
// `.agent-settings.yml` at runtime, whose `_read_yaml` uses a bare
// `require('yaml')` that is undefined under a proper ESM tsx entry point — so
// the TS side silently degrades settings to `{}` (defaults ON) while the
// Python side reads the file. That divergence is owned by `agent_settings.ts`
// (out of scope for this port), not by these four twins. The default-ON path
// (no settings file) is exercised by every subcommand test above.
