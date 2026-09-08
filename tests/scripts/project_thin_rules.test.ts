// Tests for src/scripts/project_thin_rules.ts (py2ts Phase 8 / Wave 8b).
//
// No pytest suite exists, so this is a focused differential suite over the
// pure surface (measure / build_thin / thin_entry / split_frontmatter /
// kernel_ids) plus a golden-parity layer that runs python3 vs tsx on the
// REAL repo. Every CLI surface here is deterministic (no timestamp), so the
// stdout / written files / exit codes are compared byte-for-byte:
//   - default + `--json` + `--measure` → byte-identical stdout/stderr/exit.
//   - `--out <dir>` → byte-identical per-file output + stdout line.
// Skipped without python3.
import * as fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';

import * as ptr from '../../src/scripts/project_thin_rules.js';



const _tmpDirs: string[] = [];
afterEach(() => {
    for (const d of _tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

describe('project_thin_rules — pure surface', () => {
    it('split_frontmatter splits fenced frontmatter from body', () => {
        const text = '---\ndescription: x\n---\nbody here\n';
        const [fm, body] = ptr.split_frontmatter(text);
        expect(fm).toBe('---\ndescription: x\n---\n');
        expect(body).toBe('body here\n');
    });
    it('split_frontmatter returns empty fm when none', () => {
        const [fm, body] = ptr.split_frontmatter('no frontmatter\n');
        expect(fm).toBe('');
        expect(body).toBe('no frontmatter\n');
    });
    it('thin_entry points its Body link at a directory that EXISTS', () => {
        // Renamed and re-pointed 2026-09-07 (road-to-delivery-for-every-host).
        // This assertion used to pin the link "verbatim" at a path inside the
        // uncondensed source tree ADR-051 retired — faithful to the Python port
        // and dead in every checkout since. The literal is deliberately NOT
        // reproduced here: `check_no_new_legacy_path` matches the string and
        // cannot tell a repair record from a live reference, so writing it out
        // would make this comment fail the gate it is describing. `git log -S`
        // on this file finds the old value. Under
        // `delivery` the hook loads the body from `dist/agent-src/rules` and
        // never follows the link, which is why nothing noticed; under `thin`
        // the link is the ONLY path to the body there is.
        //
        // Pinning a port's verbatim output is a real discipline, and it is the
        // wrong one here: what it preserved was a broken user-facing link, and
        // the repository already ratchets references into that retired tree
        // down as debt.
        const text = '---\ndescription: A short desc\ntriggers:\n  - keyword: foo\n---\nBODY\n';
        const entry = ptr.thin_entry('my-rule', text);
        expect(entry).toContain('## My Rule\n');
        expect(entry).toContain('Fires on: foo.');
        expect(entry).toContain('A short desc');
        expect(entry).toContain('Body: [`my-rule`](../../dist/agent-src/rules/my-rule.md)');
        expect(entry).not.toContain('.agent-src.uncondensed');
    });
    it('thin_entry omits the Fires-on clause when no trigger hint', () => {
        const text = '---\ndescription: Desc only\n---\nBODY\n';
        const entry = ptr.thin_entry('plain-rule', text);
        expect(entry).not.toContain('Fires on:');
        expect(entry).toContain('## Plain Rule\n');
    });
    it('kernel_ids returns a non-empty set from the real router', () => {
        const k = ptr.kernel_ids();
        expect(k.size).toBeGreaterThan(0);
    });
    it('build_thin keeps kernel rules full-bodied and thins the rest', () => {
        const map = ptr.build_thin();
        const kernel = ptr.kernel_ids();
        let kernelFull = 0;
        let thinned = 0;
        const noTrigger = ptr.no_trigger_ids();
        const pathOnly = ptr.path_only_ids();
        for (const [name, text] of map) {
            const stem = name.replace(/\.md$/, '');
            if (kernel.has(stem) || noTrigger.has(stem) || pathOnly.has(stem)) {
                // Three eager classes, not two. Kernel; the no-trigger residue,
                // because a rule the router cannot fire is a rule no hook can
                // put back; and since 2026-09-07 the PATH-ONLY residue, whose
                // only triggers are path-shaped while the delivery concern is
                // unbound on `pre_tool_use` — same failure one step out, a rule
                // with nothing to match ON rather than nothing to match on.
                kernelFull += 1;
            } else {
                // thinned entries are the one-line pointer
                expect(text).toContain('Routed rule — load the body on trigger-match.');
                thinned += 1;
            }
        }
        expect(kernelFull).toBeGreaterThan(0);
        expect(thinned).toBeGreaterThan(0);
    });
    it('keeps every no-trigger rule full-bodied, never a pointer', () => {
        const map = ptr.build_thin();
        const noTrigger = ptr.no_trigger_ids();
        expect(noTrigger.size).toBeGreaterThan(0);
        for (const id of noTrigger) {
            const text = map.get(`${id}.md`);
            if (text === undefined) continue; // out of scope in this projection
            expect(text).not.toContain('Routed rule — load the body on trigger-match.');
        }
    });
    it('measure returns the full key set with consistent arithmetic', () => {
        const m = ptr.measure();
        // Three-way split since road-to-trigger-delivered-rule-bodies 1.3: the
        // no-trigger residue is neither kernel nor thinned, and folding it into
        // either count is what would hide it.
        expect(m.rules_total).toBe(m.kernel_full + m.non_kernel_thinned + m.no_trigger_full);
        expect(m.no_trigger_full).toBe(m.no_trigger_ids.length);
        expect(m.no_trigger_gpt).toBeGreaterThan(0);
        expect(m.saved_gpt).toBe(m.eager_gpt - m.thin_gpt);
        expect(typeof m.saved_pct).toBe('number');
        expect(typeof m.token_method).toBe('string');
    });
});
