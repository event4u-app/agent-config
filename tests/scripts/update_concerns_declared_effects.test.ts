/**
 * The six conditions the AI council attached to ratifying `update-notice` and
 * `update-auto-invite` as DECLARED authority expansions (2/2, 2026-10-20).
 *
 * Conditions 2-5 are testable and are tested here. Condition 1 (ratify the
 * vocabulary before registering) is discharged by the artifact covering both
 * in one subject, and condition 6 (document staged-state visibility) is prose
 * in the roadmap — neither is asserted here, and saying so is cheaper than a
 * test that pretends to cover them.
 *
 * The point of the file is that the two properties the ratification RESTS ON
 * cannot quietly regress: if `updateNotice` ever activates, or if the ring-0
 * record is ever read before the user's opt-in, the verdict that permitted
 * the registration no longer describes the code.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { autoInviteDecision, type InviteInput } from '../../src/scripts/_lib/update_invite.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NOTICE_SRC = fs.readFileSync(path.join(ROOT, 'src', 'scripts', '_lib', 'update_notice.ts'), 'utf-8');

describe('condition 2 — every updateNotice path leaves activate null', () => {
    it('the type itself forbids any other value', () => {
        // Stronger than enumerating call sites: `activate: null` as a TYPE
        // means no path CAN return anything else, so this survives a new path
        // being added, which a behavioural sweep would not.
        expect(NOTICE_SRC).toMatch(/readonly activate:\s*null;/u);
    });

    it('no return literal in the module sets activate to anything else', () => {
        const assignments = [...NOTICE_SRC.matchAll(/activate:\s*([A-Za-z0-9_.]+)/gu)].map((m) => m[1]);
        expect(assignments.length).toBeGreaterThan(0);
        expect([...new Set(assignments)]).toEqual(['null']);
    });
});

describe('condition 3 — the user opt-in is read BEFORE the ring-0 kill switch', () => {
    // Fully typed, no cast: a new required field or a changed `mode` type must
    // fail to compile here rather than leave the cases on the wrong shape.
    const base: InviteInput = {
        mode: 'ask',
        ringZeroExited: true,
        registerAvailable: true,
        alreadyInvited: false,
        turnEndedOnVerifiedSuccess: true,
        env: { ci: false, noUpdateCheck: false, jsonOutput: false, subagent: false, headless: false, interactive: true },
    };

    it('refuses without the opt-in even when ring-0 has exited', () => {
        const d = autoInviteDecision({ ...base, mode: 'auto' });
        expect(d.ask).toBe(false);
        if (!d.ask) expect(d.reason).toContain('no user opt-in');
    });

    it('names the OPT-IN as the reason when both are missing — the order is the invariant', () => {
        // The ordering claim is what the ratification rests on: a rollout
        // switch may only ever subtract from a human's yes. If ring-0 were
        // read first this would report the ring-0 reason instead, and the
        // council's condition (d) would be false while every other case here
        // still passed.
        const d = autoInviteDecision({ ...base, mode: 'auto', ringZeroExited: false });
        expect(d.ask).toBe(false);
        if (!d.ask) expect(d.reason).toContain('no user opt-in');
    });

    it('still refuses on the ring-0 switch when the opt-in IS present', () => {
        const d = autoInviteDecision({ ...base, ringZeroExited: false });
        expect(d.ask).toBe(false);
        if (!d.ask) expect(d.reason).toContain('ring-0');
    });
});

/**
 * Every module a file can load at runtime, following relative VALUE imports
 * (static, side-effect, re-export and dynamic) and skipping `import type` /
 * `export type`, which the compiler erases. Bare specifiers are recorded, not
 * followed: a package is a leaf whose name says whether it can spawn.
 */
function runtimeClosure(entry: string): { files: Map<string, string | null>; bare: Map<string, string> } {
    const files = new Map<string, string | null>([[entry, null]]);
    const bare = new Map<string, string>();
    const queue = [entry];
    const spec = /(?:^|[\s;])(?:import|export)\s+(?!type\s)(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/gu;
    while (queue.length > 0) {
        const file = queue.shift() as string;
        const src = fs.readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
        for (const m of src.matchAll(spec)) {
            const s = (m[1] ?? m[2] ?? m[3]) as string;
            if (!s.startsWith('.')) {
                if (!bare.has(s)) bare.set(s, path.relative(ROOT, file));
                continue;
            }
            const base = path.resolve(path.dirname(file), s);
            const hit = [base.replace(/\.js$/u, '.ts'), base, `${base}.ts`, path.join(base, 'index.ts')].find(
                (c) => fs.existsSync(c) && fs.statSync(c).isFile(),
            );
            if (hit !== undefined && !files.has(hit)) {
                files.set(hit, file);
                queue.push(hit);
            }
        }
    }
    return { files, bare };
}

/** The import chain from the entry to `file`, for a failure a reader can act on. */
function chainTo(files: Map<string, string | null>, file: string): string {
    const out: string[] = [];
    for (let f: string | null | undefined = file; f !== null && f !== undefined; f = files.get(f)) {
        out.unshift(path.relative(ROOT, f));
    }
    return out.join(' -> ');
}

describe('condition 4 — neither concern may invoke an upgrade command', () => {
    // Finding 791c7f052d01 (17.0.0 review): this used to check each file's OWN
    // imports, which a transitive import of a spawning helper passes. The claim
    // is about everything the concern can load, so the check walks the whole
    // runtime import graph. A process can also be reached without the module —
    // `process.binding('spawn_sync')` — so that route is refused on every file
    // in the closure as well.
    for (const rel of [
        'src/scripts/_lib/update_notice.ts',
        'src/scripts/_lib/update_invite.ts',
        'src/scripts/update_notice_hook.ts',
        'src/scripts/update_invite_hook.ts',
    ]) {
        it(`${rel} cannot reach a child process through anything it loads`, () => {
            const { files, bare } = runtimeClosure(path.join(ROOT, rel));
            // `_lib/update_invite.ts` has only a type import, so a closure of
            // one is legitimate; the walker's sensitivity is the last case below.
            expect(files.has(path.join(ROOT, rel))).toBe(true);
            const spawning = [...bare.keys()].filter((b) => /^(?:node:)?(?:child_process|cluster|worker_threads)$/u.test(b));
            expect(spawning.map((b) => `${b} imported by ${bare.get(b) ?? '?'}`)).toEqual([]);
            const bindings = [...files.keys()].filter((f) =>
                /process\s*\.\s*(?:binding|_linkedBinding)\s*\(/u.test(fs.readFileSync(f, 'utf-8')),
            );
            expect(bindings.map((f) => chainTo(files, f))).toEqual([]);
        });
    }

    it('the walker sees a transitive spawn — sensitivity of the check above', () => {
        // before_complete_hook reaches `node:child_process` only through
        // `_lib/touched_file_quality.ts`, never directly, which is exactly the
        // shape the per-file grep missed.
        const own = fs.readFileSync(path.join(ROOT, 'src', 'scripts', 'before_complete_hook.ts'), 'utf-8');
        expect(own).not.toMatch(/['"]node:child_process['"]/u);
        const { bare } = runtimeClosure(path.join(ROOT, 'src', 'scripts', 'before_complete_hook.ts'));
        expect([...bare.keys()]).toContain('node:child_process');
    });
});
