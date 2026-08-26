#!/usr/bin/env tsx
/**
 * The single sanctioned writer of a roadmap checkbox glyph.
 *
 * `road-to-skill-ecosystem-runtime-enforcement` Phase 6. Every mechanism here
 * exists because of a recorded way a concurrent writer destroys work, and each
 * one is listed with the failure it closes rather than as a good practice:
 *
 *   1. **Advisory lock + atomic rename.** Two writers read, edit and write the
 *      same file; the second write lands last and the first writer's step is
 *      gone, with no error to either. A torn write is worse still: a
 *      half-rewritten plan parses as a plan with fewer steps.
 *   2. **Anchor on the step's OWN LINE.** A greedy multi-line pattern across a
 *      multi-entry file is the recorded mechanism by which one substitution
 *      overwrites later entries — the regex matches from the first step to the
 *      last and replaces everything between.
 *   3. **Structural invariant against the LIVE pre-write file.** Asserting the
 *      step count against an in-memory snapshot confirms what you INTENDED to
 *      write while destroying what a parallel writer wrote in between. The
 *      re-read is the whole point: the file is checked at the moment of writing.
 *   4. **Post-write survival check.** In a concurrent overwrite the loser gets
 *      no error, so a successful write is not evidence the write survived.
 *      Grep for the mutated step afterwards and confirm exactly one occurrence.
 *   5. **Fail closed on ambiguity.** Two roadmaps in scope — one in the working
 *      directory, one nested — resolve NEITHER and name both. Silently choosing
 *      is how a step gets flipped in the wrong plan.
 *
 * Exit codes: 0 written · 1 refused (ambiguity, invariant, survival) · 2 usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

/** The four glyphs a roadmap step may carry. */
export const GLYPHS = ['x', ' ', '~', '-'] as const;
export type Glyph = (typeof GLYPHS)[number];

/** A lock older than this is treated as abandoned. A crashed writer must not wedge the file. */
export const LOCK_STALE_MS = 60_000;

export class RoadmapWriteError extends Error {}

/** Every checkbox line in the file, as `[lineIndex, glyph, text]`. */
export function scanSteps(content: string): { line: number; glyph: string; text: string }[] {
    const out: { line: number; glyph: string; text: string }[] = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const m = /^(\s*-\s\[)([ x~-])(\]\s?)(.*)$/.exec(lines[i] as string);
        if (m !== null) out.push({ line: i, glyph: m[2] as string, text: m[4] as string });
    }
    return out;
}

/**
 * Locate the ONE step whose text starts with `stepId`.
 *
 * Refuses on zero and on more than one. A prefix that matches two steps is an
 * ambiguous address, and picking the first is the same silent-choice failure as
 * resolving an ambiguous plan.
 */
export function findStep(content: string, stepId: string): { line: number; glyph: string; text: string } {
    const needle = stepId.trim();
    if (needle === '') throw new RoadmapWriteError('step id is empty');
    // Match against the raw text AND its bold-stripped form, so `**1.2` and `1.2`
    // both address the same step. Stripping only ONE side is the bug this shape
    // replaces: a needle carrying `**` then matched nothing at all.
    const strip = (t: string): string => t.replace(/^\*\*/, '');
    const hits = scanSteps(content).filter(
        (s) => s.text.startsWith(needle) || strip(s.text).startsWith(strip(needle)),
    );
    if (hits.length === 0) {
        throw new RoadmapWriteError(`no step whose text starts with "${needle}"`);
    }
    if (hits.length > 1) {
        throw new RoadmapWriteError(
            `"${needle}" matches ${String(hits.length)} steps (lines ${hits.map((h) => h.line + 1).join(', ')}) — ` +
                'refusing rather than picking the first. Give a longer prefix.',
        );
    }
    return hits[0]!;
}

/**
 * Rewrite ONE line's glyph. Line-anchored by construction: the function is given
 * a line index and touches only `lines[index]`, so there is no pattern that can
 * span entries even in principle.
 */
export function setGlyphOnLine(content: string, lineIndex: number, glyph: Glyph): string {
    const lines = content.split('\n');
    const line = lines[lineIndex];
    if (line === undefined) throw new RoadmapWriteError(`line ${String(lineIndex)} is out of range`);
    const m = /^(\s*-\s\[)([ x~-])(\].*)$/.exec(line);
    if (m === null) throw new RoadmapWriteError(`line ${String(lineIndex + 1)} is not a checkbox line`);
    lines[lineIndex] = `${m[1]}${glyph}${m[3]}`;
    return lines.join('\n');
}

/** Acquire an advisory lock, or throw. `O_EXCL` is the exclusion; the mtime is the staleness clock. */
export function acquireLock(file: string, nowMs = Date.now()): string {
    const lock = `${file}.lock`;
    try {
        fs.writeFileSync(lock, `${String(process.pid)}\n`, { flag: 'wx' });
        return lock;
    } catch {
        let age = 0;
        try {
            age = nowMs - fs.statSync(lock).mtimeMs;
        } catch {
            // The holder released it between our failed create and this stat —
            // retry once rather than reporting a lock that no longer exists.
            fs.writeFileSync(lock, `${String(process.pid)}\n`, { flag: 'wx' });
            return lock;
        }
        if (age > LOCK_STALE_MS) {
            // A crashed writer must not wedge the file forever. Breaking a stale
            // lock is safe precisely because every write below re-validates the
            // live file — the lock reduces collisions, it does not carry
            // correctness on its own.
            fs.rmSync(lock, { force: true });
            fs.writeFileSync(lock, `${String(process.pid)}\n`, { flag: 'wx' });
            return lock;
        }
        throw new RoadmapWriteError(
            `${path.basename(file)} is locked by another writer (${String(Math.round(age / 1000))}s old) — refusing`,
        );
    }
}

export interface SetStepResult {
    file: string;
    line: number;
    from: string;
    to: Glyph;
    stepsBefore: number;
    stepsAfter: number;
}

/**
 * Flip one step's glyph, safely.
 *
 * The ordering is the contract: lock → RE-READ → locate → invariant → write →
 * survival check → unlock. The re-read after the lock is what makes the
 * invariant meaningful; checking a snapshot taken before the lock would confirm
 * an intention rather than a fact.
 */
export function setStep(file: string, stepId: string, glyph: Glyph, nowMs = Date.now()): SetStepResult {
    const lock = acquireLock(file, nowMs);
    try {
        // LIVE read, inside the lock. Any snapshot taken earlier is stale by
        // definition — a parallel writer may have landed between then and now.
        const before = fs.readFileSync(file, 'utf8');
        const stepsBefore = scanSteps(before).length;
        const target = findStep(before, stepId);
        const after = setGlyphOnLine(before, target.line, glyph);

        const stepsAfter = scanSteps(after).length;
        if (stepsAfter !== stepsBefore) {
            throw new RoadmapWriteError(
                `structural invariant failed: ${String(stepsBefore)} step(s) before, ${String(stepsAfter)} after. ` +
                    'A glyph flip may not change the step count — this is the signature of a pattern ' +
                    'that spanned entries.',
            );
        }

        const tmp = `${file}.${String(process.pid)}.tmp`;
        fs.writeFileSync(tmp, after, 'utf8');
        fs.renameSync(tmp, file);

        // SURVIVAL, not success. In a concurrent overwrite the loser receives no
        // error, so the write returning is not evidence the write is on disk.
        const verify = fs.readFileSync(file, 'utf8');
        const survivors = scanSteps(verify).filter(
            (s) => s.line === target.line && s.glyph === glyph && s.text === target.text,
        );
        if (survivors.length !== 1) {
            throw new RoadmapWriteError(
                `write did not survive: expected exactly 1 occurrence of the mutated step, found ` +
                    `${String(survivors.length)}. A parallel writer very likely landed after ours.`,
            );
        }
        return { file, line: target.line + 1, from: target.glyph, to: glyph, stepsBefore, stepsAfter };
    } finally {
        fs.rmSync(lock, { force: true });
    }
}

/**
 * Resolve the roadmap to write, FAILING CLOSED on ambiguity.
 *
 * When the working directory carries an active roadmap and a nested directory
 * carries its own, neither is resolved and both are named. Choosing silently is
 * how a step gets flipped in the wrong plan — and the wrong plan's author gets
 * no signal at all.
 */
export function resolvePlan(roots: readonly string[]): string {
    const found: string[] = [];
    for (const root of roots) {
        const dir = path.join(root, 'agents', 'roadmaps');
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir)) {
            if (name.endsWith('.md') && name !== 'README.md') found.push(path.join(dir, name));
        }
    }
    if (found.length === 0) throw new RoadmapWriteError('no active roadmap found under any candidate root');
    if (found.length > 1) {
        throw new RoadmapWriteError(
            `ambiguous plan — ${String(found.length)} active roadmaps in scope:\n  ${found.join('\n  ')}\n` +
                'Refusing to choose. Name the file explicitly with --file.',
        );
    }
    return found[0]!;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const usage =
        'usage: roadmap_set_step --file <roadmap.md> --step <id-prefix> --glyph <x| |~|->\n' +
        '  Refuses on: an ambiguous step prefix, a changed step count, a write that did not survive.\n';
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(usage);
        return 0;
    }
    const val = (flag: string): string | null => {
        const i = argv.indexOf(flag);
        return i !== -1 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
    };
    const file = val('--file');
    const step = val('--step');
    const glyph = val('--glyph');
    if (file === null || step === null || glyph === null || !(GLYPHS as readonly string[]).includes(glyph)) {
        process.stderr.write(`roadmap_set_step: error: --file, --step and a valid --glyph are required\n${usage}`);
        return 2;
    }
    try {
        const r = setStep(path.resolve(file), step, glyph as Glyph);
        process.stdout.write(
            `✅  ${path.basename(r.file)}:${String(r.line)} [${r.from}] → [${r.to}] · ` +
                `${String(r.stepsAfter)} step(s) intact\n`,
        );
        return 0;
    } catch (e) {
        process.stderr.write(`❌  ${e instanceof Error ? e.message : String(e)}\n`);
        return e instanceof RoadmapWriteError ? 1 : 2;
    }
}

/* c8 ignore start */
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(_HERE).href) {
    process.exit(main());
}
/* c8 ignore stop */
