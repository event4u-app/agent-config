// Tests for src/scripts/check_knowledge_cards.ts — the knowledge-card gate.
//
// 1:1 port of the Python behavioral contract (ADR-200 parity). Each case spawns
// the TS script via tsx as a real child process and asserts on the observable
// contract (stdout / stderr / exit). A trailing golden-parity block runs
// python3 + tsx on identical fixtures and asserts byte-identical
// stdout+stderr+exit, skipped when python3 is absent.
//
// The script computes finding paths relative to the repo ROOT via
// `Path.relative_to(ROOT)`. To keep those paths byte-identical (and to avoid
// the documented latent crash on an absolute `--dir` outside ROOT — see the
// freshness test), the golden-parity fixtures live under a temp directory
// INSIDE the repo (the real-usage shape) and are passed as a relative `--dir`.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = (() => {
    const env = process.env['TSX_BIN'];
    if (env) {
        return resolve(REPO_ROOT, env);
    }
    return join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
})();
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'check_knowledge_cards.ts');

interface RunResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}

function runTs(args: readonly string[], cwd: string = REPO_ROOT): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8' });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

// A card directory that lives INSIDE the repo, so finding paths relativize to
// ROOT identically across python3 and tsx. Created fresh per test, removed after.
let cardDirAbs: string;
let cardDirRel: string;
beforeEach(() => {
    cardDirAbs = mkdtempSync(join(REPO_ROOT, 'agents', 'knowledge', '.ckc-test-'));
    cardDirRel = relative(REPO_ROOT, cardDirAbs);
});
afterEach(() => {
    rmSync(cardDirAbs, { recursive: true, force: true });
});

function writeCard(name: string, body: string): void {
    writeFileSync(join(cardDirAbs, name), body, 'utf-8');
}

const VALID = `---
trust: anti-hallucination
type: anti-hallucination
links:
  authoritative: ${'package.json'}
---
Body.
`;

describe('check_knowledge_cards.ts', () => {
    it('missing directory is not an error', () => {
        const r = runTs(['--dir', join(cardDirRel, 'does-not-exist')]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('No cards directory found');
    });

    it('empty directory reports nothing to check', () => {
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('No knowledge cards found — nothing to check.\n');
    });

    it('README.md is skipped', () => {
        writeCard('README.md', 'index\n');
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('No knowledge cards found — nothing to check.\n');
    });

    it('a valid card passes', () => {
        writeCard('good.md', VALID);
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('passed all checks');
    });

    it('C1 — card over 150 lines fails', () => {
        const big = `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: package.json\n---\n${'l\n'.repeat(200)}`;
        writeCard('big.md', big);
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('C1: card exceeds 150 lines');
    });

    it('C4 — missing trust/type fails', () => {
        writeCard('bad.md', `---\nfoo: bar\nlinks:\n  authoritative: package.json\n---\nBody.\n`);
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain("C4: missing 'trust' field");
        expect(r.stdout).toContain("C4: missing 'type' field");
    });

    it('C4 — wrong type fails', () => {
        writeCard(
            'bad.md',
            `---\ntrust: t\ntype: lead\nlinks:\n  authoritative: package.json\n---\nBody.\n`,
        );
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain("C4: type must be 'anti-hallucination', got 'lead'");
    });

    it('C2 — missing pointer fails', () => {
        writeCard('bad.md', `---\ntrust: t\ntype: anti-hallucination\n---\nBody.\n`);
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('C2: missing links.authoritative pointer');
    });

    it('C3 — local pointer not found fails', () => {
        writeCard(
            'bad.md',
            `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: nope/does-not-exist.md\n---\nBody.\n`,
        );
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('C3: local pointer not found: nope/does-not-exist.md');
    });

    it('C5 — observed_at span over 7 days fails', () => {
        writeCard(
            'span.md',
            `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nobserved_at: 2026-01-01\nobserved_at: 2026-02-01\n`,
        );
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('C5: observed_at timestamps span');
    });

    it('C5 — non-ancestor SHAs flagged as Frankenstein', () => {
        writeCard(
            'sha.md',
            `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nsource_version: abcdef1\nsource_version: 1234567\n`,
        );
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('are not in a linear ancestry chain (Frankenstein card)');
    });

    it('C6 — strict mode flags missing source path', () => {
        writeCard(
            'strict.md',
            `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nfact source=src/scripts/no_such_file.zzz:5\n`,
        );
        const r = runTs(['--dir', cardDirRel, '--strict']);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('C6: source path not found or empty: src/scripts/no_such_file.zzz');
    });

    it('freshness-days warns on an old card (relative dir, exit 0)', () => {
        writeCard(
            'fresh.md',
            `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nobserved_at: 2020-01-01\n`,
        );
        const r = runTs(['--dir', cardDirRel, '--freshness-days', '30']);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('lead-only');
        expect(r.stdout).toContain('passed all checks');
    });

    it('freshness-days with an absolute outside-ROOT dir replicates the Python crash (exit 1)', () => {
        // Faithful replication of the Python latent bug (ADR-200): relative_to
        // raises for an absolute --dir outside ROOT → uncaught → exit 1.
        const out = mkdtempSync(join(tmpdir(), 'ckc-out-'));
        try {
            writeFileSync(
                join(out, 'fresh.md'),
                `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nobserved_at: 2020-01-01\n`,
            );
            const r = runTs(['--dir', out, '--freshness-days', '30']);
            expect(r.status).toBe(1);
        } finally {
            rmSync(out, { recursive: true, force: true });
        }
    });

    it('invalid --freshness-days int exits 2', () => {
        const r = runTs(['--freshness-days', 'abc']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain("invalid int value: 'abc'");
    });

    it('unrecognized argument exits 2', () => {
        const r = runTs(['--bogus']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('unrecognized arguments: --bogus');
    });
});

// ---------------------------------------------------------------------------
// --global mode: G4 (sensitivity) / G5 (promotion audit-trail footer fields)
// / G6 (prohibited hard error) — Phase 1, road-to-feedback-8.11 / successor
// note to ADR-119. G1 (tier) / G2 (footer) / G3 (redaction-clean) already
// existed but had no dedicated fixture coverage; the sensitivity axis tests
// below exercise the whole `--global` gate, not just the three new checks.
// ---------------------------------------------------------------------------

const VALID_GLOBAL_FOOTER = [
    '<!-- global-provenance:start -->',
    '<!-- This global store is unversioned (ADR-100); this footer is its audit trail. -->',
    '- first_seen: repo-a · 2026-01-01',
    '- promoted_at: 2026-01-01',
    '- last_verified: 2026-01-01',
    '- tier: public',
    '- seen_in: repo-a',
    '- source_repo: repo-a',
    '- owner: alice',
    '- review_after: 2026-07-01',
    '- promotion_reason: approved for cross-project reuse',
    '<!-- global-provenance:end -->',
    '',
].join('\n');

function globalCard(opts: { tier?: string; sensitivity?: string; footer?: string | null } = {}): string {
    const tier = opts.tier ?? 'public';
    const sensitivity = opts.sensitivity ?? 'shareable';
    const footer = opts.footer === undefined ? VALID_GLOBAL_FOOTER : (opts.footer ?? '');
    return (
        `---\ntrust: t\ntype: anti-hallucination\ntier: ${tier}\nsensitivity: ${sensitivity}\n` +
        `links:\n  authoritative: package.json\n---\nBody.\n\n${footer}`
    );
}

describe('check_knowledge_cards.ts --global — sensitivity axis (G4/G5/G6)', () => {
    it('a fully-formed global card (tier + sensitivity + full footer) passes', () => {
        writeCard('good.md', globalCard());
        const r = runTs(['--dir', cardDirRel, '--global']);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('passed all checks');
    });

    it('the same card WITHOUT --global is not held to G1/G4/G5/G6', () => {
        writeCard('good.md', globalCard());
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('passed all checks');
    });

    it('G4 — missing sensitivity fails', () => {
        writeCard(
            'bad.md',
            `---\ntrust: t\ntype: anti-hallucination\ntier: public\nlinks:\n  authoritative: package.json\n---\nBody.\n\n${VALID_GLOBAL_FOOTER}`,
        );
        const r = runTs(['--dir', cardDirRel, '--global']);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain("G4: global card missing 'sensitivity'");
    });

    it('G4 — invalid sensitivity value fails', () => {
        writeCard('bad.md', globalCard({ sensitivity: 'bogus' }));
        const r = runTs(['--dir', cardDirRel, '--global']);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain("G4: sensitivity 'bogus' not in");
    });

    it("G6 — sensitivity 'prohibited' is a hard error in the global store", () => {
        writeCard('bad.md', globalCard({ sensitivity: 'prohibited' }));
        const r = runTs(['--dir', cardDirRel, '--global']);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain("G6: sensitivity 'prohibited' must never be in the global store");
    });

    it('G5 — footer missing the promotion audit-trail fields fails once per field', () => {
        const thinFooter = [
            '<!-- global-provenance:start -->',
            '- first_seen: repo-a · 2026-01-01',
            '- promoted_at: 2026-01-01',
            '- last_verified: 2026-01-01',
            '- tier: public',
            '- seen_in: repo-a',
            '<!-- global-provenance:end -->',
            '',
        ].join('\n');
        writeCard('bad.md', globalCard({ footer: thinFooter }));
        const r = runTs(['--dir', cardDirRel, '--global']);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain("G5: provenance footer missing 'source_repo'");
        expect(r.stdout).toContain("G5: provenance footer missing 'owner'");
        expect(r.stdout).toContain("G5: provenance footer missing 'review_after'");
        expect(r.stdout).toContain("G5: provenance footer missing 'promotion_reason'");
    });

    it('G2 — missing footer entirely does not additionally spam G5 (single audit-trail error)', () => {
        writeCard('bad.md', globalCard({ footer: null }));
        const r = runTs(['--dir', cardDirRel, '--global']);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('G2: missing provenance footer');
        expect(r.stdout).not.toContain('G5:');
    });
});
