#!/usr/bin/env tsx
/**
 * Lint behavioural-eval freshness — a behavioural `evals.json` that pins the
 * skill body it was authored against must still match the current SKILL.md
 * body, or it is flagged stale (road-to-skill-eval-coverage Phase 3).
 *
 * Sibling to `lint_eval_freshness.ts`, DIFFERENT axis: that gate keeps a
 * corpus-backed skill's TRIGGER eval fresh against an upstream SHA; this gate
 * keeps a skill's BEHAVIOURAL eval fresh against its own SKILL.md body. The
 * two never conflate.
 *
 * A skill's `evals/evals.json` is in scope when it carries a `skill_body_sha`
 * (SHA-256 of the SKILL.md body — post-frontmatter, trimmed — at authoring
 * time). Absent = unpinned, OUT of scope (nothing to keep fresh), mirroring
 * `lint_eval_freshness`'s `upstream: null` handling. So the currently-shipped
 * evals (which carry no pin) never fail — the gate only bites once an author
 * opts in by pinning.
 *
 * In scope, the gate fails when the pinned `skill_body_sha` differs from the
 * current SKILL.md body sha: the body moved, so the eval may no longer
 * exercise it — re-verify and re-pin (`--write-floor`-style human step) rather
 * than let a stale eval pass silently.
 *
 * Deterministic, no token spend: reads on-disk files only. The live re-eval is
 * a separate, spend-bearing step; this gate verifies the pin is current.
 *
 * Exit codes: 0 clean (or none in scope) / 1 at least one stale / 2 usage.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO = path.resolve(path.dirname(_HERE), '..', '..');
let SKILLS_DIR = path.join(REPO, 'src', 'skills');

export function _setSkillsDirForTest(p: string): void {
    SKILLS_DIR = p;
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function _splitBody(text: string): string {
    if (!text.startsWith('---\n')) return text.replace(/\s+$/, '');
    const end = text.indexOf('\n---', 4);
    if (end === -1) return text.replace(/\s+$/, '');
    return text.slice(end + 4).replace(/^\n+/, '').replace(/\s+$/, '');
}

/** SHA-256 of a skill's SKILL.md body (post-frontmatter, trailing-ws-trimmed). */
export function skillBodySha(skillMdText: string): string {
    return crypto.createHash('sha256').update(_splitBody(skillMdText), 'utf-8').digest('hex');
}

export interface FreshnessResult {
    ok: boolean;
    stale: Array<{ skill: string; pinned: string; current: string }>;
    inScope: number;
    /**
     * Skill directories walked. `inScope` counts only the PINNED subset, which
     * is legitimately 0 today (nothing has opted in yet) — so it can never
     * anchor the scope assertion; this can.
     */
    scanned: number;
}

export function checkFreshness(): FreshnessResult {
    const stale: FreshnessResult['stale'] = [];
    let inScope = 0;
    let scanned = 0;
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    } catch {
        return { ok: true, stale, inScope, scanned };
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
        if (!e.isDirectory()) continue;
        scanned += 1;
        const evalsPath = path.join(SKILLS_DIR, e.name, 'evals', 'evals.json');
        const skillMd = path.join(SKILLS_DIR, e.name, 'SKILL.md');
        if (!fs.existsSync(evalsPath) || !fs.existsSync(skillMd)) continue;
        let spec: Json;
        try {
            spec = JSON.parse(fs.readFileSync(evalsPath, 'utf-8')) as Json;
        } catch {
            continue;
        }
        const pinned =
            spec && typeof spec === 'object' && !Array.isArray(spec)
                ? (spec['skill_body_sha'] as string | undefined)
                : undefined;
        if (typeof pinned !== 'string' || pinned === '') continue; // unpinned → out of scope
        inScope += 1;
        const current = skillBodySha(fs.readFileSync(skillMd, 'utf-8'));
        if (current !== pinned) {
            stale.push({ skill: e.name, pinned, current });
        }
    }
    return { ok: stale.length === 0, stale, inScope, scanned };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let quiet = false;
    for (const a of argv) {
        if (a === '--quiet') quiet = true;
        else {
            process.stderr.write('usage: lint_behavioural_eval_freshness [--quiet]\n');
            return 2;
        }
    }
    const { ok, stale, inScope, scanned } = checkFreshness();
    // `checkFreshness` swallows an unreadable skills root and returns ok:true,
    // so a moved `src/skills` prints "0 pinned eval(s) current" and passes.
    try {
        assertScanned({
            gate: 'lint_behavioural_eval_freshness',
            scanned,
            units: 'skill director(ies)',
            roots: ['src/skills'],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`${e.message}\n`);
            return 1;
        }
        throw e;
    }
    if (!ok) {
        for (const s of stale) {
            process.stderr.write(
                `stale behavioural eval: ${s.skill}/evals/evals.json pinned ${s.pinned.slice(0, 12)}… ` +
                    `but SKILL.md body is ${s.current.slice(0, 12)}… — re-verify and re-pin skill_body_sha\n`,
            );
        }
        return 1;
    }
    if (!quiet) {
        process.stdout.write(
            `✅  behavioural-eval freshness: ${inScope} pinned eval(s) current (unpinned evals out of scope).\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
