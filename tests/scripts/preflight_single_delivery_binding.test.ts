// Proves the single-delivery invariant check is BOUND, and that it can refuse.
//
// This test exists because the AI council (2/2, 2026-08-19) converged on preflight
// as the binding surface and both seats attached the same condition: the binding
// must be provably live, "so it can't silently degrade the way the prior gates
// did". That is not a hypothetical failure mode in this repository — it is the
// measured state of the two nearest gates:
//
//   - check_standing_rule_delivery measures this exact defect (185.3 % of the
//     standing cap) and is registered in taskfiles/dev.yml, which nothing runs
//     automatically. It has been reporting to nobody.
//   - check_rule_projection_integrity exists for "stale tree on a developer's
//     checkout" and is INERT when agents/.agent-tools.yml selects zero tools,
//     which is the maintainer's normal local state.
//
// WHAT THIS TEST CAN AND CANNOT PROVE, stated because the distinction is the whole
// point. It proves (1) the registration is present in the preflight recipe and
// (2) the binary genuinely refuses on a real overlap under --enforce. It CANNOT
// prove anyone runs preflight — no test can — so the gap it closes is
// "registered somewhere nothing reads", not "a human skipped the step".

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('preflight binding for check_single_delivery', () => {
    const recipe = readFileSync(join(REPO, 'taskfiles', 'ci-fast.yml'), 'utf8');

    it('is registered in the preflight recipe', () => {
        expect(recipe).toContain('src/scripts/check_single_delivery');
    });

    it('is registered in REPORT mode, not --enforce, while Phase 2 is open', () => {
        // --enforce here would red every preflight run on a defect nobody can
        // currently fix, which is how a gate teaches people to skip it. The flip
        // lands with the partition; if someone flips it earlier, this fails and
        // they have to say why.
        const line = recipe
            .split('\n')
            .find((l) => l.includes('src/scripts/check_single_delivery'));
        expect(line).toBeDefined();
        expect(line).not.toContain('--enforce');
    });

    it('states why it binds to preflight rather than CI', () => {
        // The reason is a measured fact (CI has no .claude/ layers), and a binding
        // whose reason is not written down is the one a later cleanup deletes.
        const idx = recipe.indexOf('src/scripts/check_single_delivery');
        const preamble = recipe.slice(Math.max(0, idx - 1200), idx);
        expect(preamble).toMatch(/gitignored|no CI leg|developer\s*\n?\s*#?\s*machine/i);
    });
});

describe('the bound binary actually refuses', () => {
    let root: string;
    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'psd-'));
    });
    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    const run = (args: string[]): { status: number; out: string } => {
        try {
            const out = execFileSync('./scripts-run', ['src/scripts/check_single_delivery', ...args], {
                cwd: REPO,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            return { status: 0, out };
        } catch (e) {
            const err = e as { status?: number; stdout?: string; stderr?: string };
            return { status: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
        }
    };

    it('exits 1 on a real overlap under --enforce', () => {
        for (const scope of ['g', 'p']) {
            const d = join(root, scope, 'rules');
            mkdirSync(d, { recursive: true });
            writeFileSync(join(d, 'shared.md'), '---\ntype: auto\n---\nbody\n', 'utf8');
        }
        const r = run(['--global', join(root, 'g'), '--project', join(root, 'p'), '--enforce']);
        expect(r.status).toBe(1);
        expect(r.out).toContain('delivered twice');
    });

    it('exits 0 on disjoint layers under --enforce', () => {
        mkdirSync(join(root, 'g', 'rules'), { recursive: true });
        mkdirSync(join(root, 'p', 'rules'), { recursive: true });
        writeFileSync(join(root, 'g', 'rules', 'only-g.md'), '---\n---\nx\n', 'utf8');
        writeFileSync(join(root, 'p', 'rules', 'only-p.md'), '---\n---\ny\n', 'utf8');
        const r = run(['--global', join(root, 'g'), '--project', join(root, 'p'), '--enforce']);
        expect(r.status).toBe(0);
    });
});
