/**
 * A2 install-completeness gate — subagent distribution is WEDGE-ONLY (ADR-109,
 * council 2026-07-05: claude-fable-5 + gpt-4o converged on Option A).
 *
 * Subagents reach consumers ONLY via the wedge (`docs/wedge/`, shipped in npm +
 * a 30-second curl). They are deliberately NOT condensed to `dist/`, NOT in the
 * install bundle, and NOT in the shared source enumeration — so the file-deleting
 * reaper (`condense.cleanup_stale`) and the ~10 `iter_all_sources` consumers never
 * see an ungoverned executable-prompt artifact. These tests LOCK that model so it
 * cannot silently rot into a half-wired state, and fence the wedge↔source drift
 * that is Option A's only real weakness.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { iter_all_sources, resolve_logical } from '../../src/scripts/_lib/agent_src.js';
import * as condense from '../../src/scripts/condense.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUBAGENT_SRC = path.join(REPO, 'src', 'subagents');
const WEDGE_DIR = path.join(REPO, 'docs', 'wedge');

function _units(): string[] {
    if (!fs.existsSync(SUBAGENT_SRC)) return [];
    return fs.readdirSync(SUBAGENT_SRC).filter((f) => f.endsWith('.md')).sort();
}

const _tmp: string[] = [];
afterEach(() => {
    for (const d of _tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('subagent distribution — wedge-only (A2)', () => {
    it('every src/subagents unit has a shipped wedge doc (coverage)', () => {
        for (const f of _units()) {
            const stem = path.basename(f, '.md');
            const wedge = path.join(WEDGE_DIR, stem, `${stem}.md`);
            expect(fs.existsSync(wedge), `missing wedge doc for ${stem}`).toBe(true);
        }
    });

    it('the wedge doc equals the src projection (fidelity — no drift)', () => {
        const saved = condense._getStateForTest();
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sabdist-'));
        _tmp.push(tmp);
        condense.MODULE_STATE.CLAUDE_AGENTS_DIR = tmp;
        try {
            condense.generate_claude_subagents();
            for (const f of _units()) {
                const stem = path.basename(f, '.md');
                const proj = fs.readFileSync(path.join(tmp, `${stem}.md`), 'utf-8').trim();
                const wedge = fs
                    .readFileSync(path.join(WEDGE_DIR, stem, `${stem}.md`), 'utf-8')
                    .trim();
                expect(proj, `wedge doc drifted from src projection for ${stem}`).toBe(wedge);
            }
        } finally {
            condense._setStateForTest(saved);
        }
    });

    it('subagents are absent from the shared source enumeration (reaper/discovery source of truth)', () => {
        for (const [, rel] of iter_all_sources()) {
            expect(rel.startsWith('subagents/'), `unexpected subagent in enumeration: ${rel}`).toBe(false);
        }
        // resolve_logical drives cleanup_stale; null here means the reaper cannot
        // manage a dist subagent — the guarantee that keeps them out of dist.
        expect(resolve_logical('subagents/production-validator.md')).toBeNull();
    });

    it('the installer does not wire a subagents dist bundle (not half-wired)', () => {
        const installer = fs.readFileSync(path.join(REPO, 'src', 'scripts', 'install.ts'), 'utf-8');
        expect(installer).not.toMatch(/dist\/agent-src\/subagents/);
    });

    it('dist/agent-src/subagents/ does not exist (copy-as-is not enabled)', () => {
        expect(fs.existsSync(path.join(REPO, 'dist', 'agent-src', 'subagents'))).toBe(false);
    });
});
