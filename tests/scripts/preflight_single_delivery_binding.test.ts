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
// point — and because the first version of this file got it wrong. It proves
// (1) the command is inside the `preflight` task's OWN block, not merely somewhere
// in the file, and (2) the binary genuinely refuses on a real overlap under
// --enforce. It CANNOT prove anyone runs preflight — no test can — so the gap it
// closes is "registered where nothing reads it", not "a human skipped the step".
//
// The correction matters: the original assertions read the whole taskfile as a flat
// string, so moving the command into a task nobody invokes left them green. R2
// review caught it, and the claim "the binding is PROVEN live" was an overstatement
// of exactly the failure this file exists to catch.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Extract the command list of ONE task from the taskfile.
 *
 * R2 finding: the first version of these assertions read the whole file as a flat
 * string, so moving the command — comment block and all — into a task nobody
 * invokes left every assertion green while `preflight` no longer listed it. That
 * proved PRESENCE while claiming REACHABILITY, which is the exact failure the test
 * exists to prevent. Parsing one task's own block is the cheapest thing that can
 * tell the difference.
 *
 * Deliberately a small indentation-aware reader rather than a YAML dependency: the
 * assertion is about which task owns a line, and a full parse would still have to
 * be told that.
 */
function taskCommands(recipe: string, task: string): string[] {
    const lines = recipe.split('\n');
    const start = lines.findIndex((l) => l.trimEnd() === `  ${task}:`);
    if (start < 0) return [];
    const out: string[] = [];
    for (let i = start + 1; i < lines.length; i += 1) {
        const l = lines[i] as string;
        // A new top-level task ends the block. Two-space indent + name + colon.
        if (/^ {2}[A-Za-z0-9_:.-]+:\s*$/.test(l)) break;
        out.push(l);
    }
    return out;
}

describe('preflight binding for check_single_delivery', () => {
    const recipe = readFileSync(join(REPO, 'taskfiles', 'ci-fast.yml'), 'utf8');
    const preflight = taskCommands(recipe, 'preflight');

    it('finds the preflight task at all (guards the parser itself)', () => {
        // Vacuity guard: every assertion below is over `preflight`, so an empty
        // slice would make them all pass for the wrong reason.
        expect(preflight.length).toBeGreaterThan(10);
        expect(preflight.join('\n')).toContain('src/scripts/check_detector_corpus');
    });

    it('is registered INSIDE the preflight task, not merely somewhere in the file', () => {
        expect(preflight.join('\n')).toContain('src/scripts/check_single_delivery');
    });

    it('is registered in REPORT mode — --enforce is unbindable HERE, not merely early', () => {
        // The original reason was "while Phase 2 is open", and the promise attached
        // to it was that the flip lands with the partition. Phase 2 shipped, the
        // partition now reaches all six families, and `--enforce` exits 0 on a
        // two-layer machine — and the flip STILL cannot land here. Measured
        // 2026-08-21: pointed at a one-layer topology, `--enforce` exits **1** via
        // the `readNothing` branch, which is correct behaviour and exactly the
        // wrong behaviour for this binding. `.claude/` is gitignored, no CI leg
        // installs at user scope, and a contributor without a global install has
        // one layer — so an enforced preflight would red for everyone whose
        // topology is the normal one, on an invariant their machine cannot even
        // express.
        //
        // So the condition is structural, not temporal, and this assertion is not
        // waiting for anything: `--enforce` belongs where BOTH layers are known to
        // exist and be verified — a doctor surface or an explicit maintainer run —
        // never in a task every checkout runs. An attempt to flip it here has to
        // fail this test and argue against the measurement above, not against a
        // phase that has since closed.
        const line = preflight.find((l) => l.includes('src/scripts/check_single_delivery'));
        expect(line).toBeDefined();
        expect(line).not.toContain('--enforce');
    });

    it('states, at the call site, why it binds to preflight rather than CI', () => {
        // A binding whose reason is not written down is the one a later cleanup
        // deletes. Scoped to the preflight block so the reason cannot be satisfied
        // by prose elsewhere in the file.
        const body = preflight.join('\n');
        const idx = body.indexOf('src/scripts/check_single_delivery');
        expect(idx).toBeGreaterThan(-1);
        expect(body.slice(Math.max(0, idx - 1400), idx)).toMatch(/gitignored|no CI leg/i);
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
