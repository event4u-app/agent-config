// The command a shipped skill tells the agent to run, checked where it lands.
//
// road-to-skill-scripts-that-run-where-they-land, Phases 1 / 4 / 5.
//
// A skill-script line is one a consumer is told to type:
//
//     <runner> <skills-root>/<skill>/scripts/<tool> <subcommand> …
//
// `<skills-root>` is defined by `corpus-grounding/SKILL.md` as "wherever
// skills are deployed". This file installs the shipped projection into a
// temporary home, substitutes that placeholder for the temporary root, and
// asks two questions of every such line: does the target file exist, and is
// the runner something a machine holding only `node` can start.
//
// It asks them of the PROJECTION (`dist/agent-src/skills/`), not of `src/`,
// because the projection is what `package.json` `files[]` ships and what an
// install deploys — the consumer's vantage point, not the maintainer's.
//
// Determinism: a temp copy per test run, no network, no clock, no git. The
// entry-point probes run in an empty temp cwd so a generator that writes
// beside itself cannot touch the tree.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PROJECTION = path.join(REPO_ROOT, 'dist', 'agent-src', 'skills');

const tmpDirs: string[] = [];
function mkTmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(d);
    return d;
}
afterAll(() => {
    for (const d of tmpDirs) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* best effort */
        }
    }
});

/** Copy the shipped projection into a temporary home; return the skills root. */
function installProjection(): string {
    const home = mkTmp('skill-script-lines-');
    const root = path.join(home, 'skills');
    fs.cpSync(PROJECTION, root, { recursive: true });
    return root;
}

// Collecting the taught lines.

interface TaughtLine {
    /** `<skill>/SKILL.md` or `<skill>/references/<name>.md`, projection-relative. */
    readonly rel: string;
    readonly lineNo: number;
    /** The skill whose `scripts/` directory the line names. */
    readonly ownerSkill: string;
    /** The tool, without extension, as written. */
    readonly tool: string;
    /** The path the line names, placeholder substituted. */
    readonly target: string;
    /** The token the consumer is told to type first. */
    readonly runner: string;
}

/**
 * The last shell-ish token of a markdown fragment: trailing backslash (a
 * continued command), backticks and whitespace stripped. Empty when the
 * fragment carries nothing but markdown decoration.
 */
function lastToken(fragment: string): string {
    const cleaned = fragment
        .replace(/\\\s*$/, '')
        .replace(/[`\s]+$/, '')
        .trim();
    if (cleaned === '') return '';
    const tok = cleaned.split(/\s+/).pop() ?? '';
    return tok.replace(/^[`>*_(]+/, '').replace(/[`*_)]+$/, '');
}

/**
 * The runner for a match: the token before the path on the same line, or —
 * when the path opens a wrapped command — the last token of the line above.
 * A fence opener is not a line above: its language tag is markdown, not a
 * command, and reading it as one turns a line that teaches NO runner into a
 * line that teaches `bash`. Empty means the consumer is told to type the
 * path alone.
 */
function runnerFor(lines: readonly string[], idx: number, col: number): string {
    const before = (lines[idx] as string).slice(0, col);
    const stripped = before.replace(/^[\s>]*(?:[-*+]\s+|\d+\.\s+)?/, '');
    const own = lastToken(stripped);
    if (own !== '') return own;
    if (idx === 0) return '';
    const above = lines[idx - 1] as string;
    if (/^\s*(?:```|~~~)/.test(above)) return '';
    return lastToken(above);
}

const SKILL_SCRIPT_RE = /<skills-root>\/([A-Za-z0-9._-]+)\/scripts\/([A-Za-z0-9._-]+)/;

function scanFile(root: string, rel: string): TaughtLine[] {
    const abs = path.join(root, rel);
    const lines = fs.readFileSync(abs, 'utf-8').split('\n');
    const out: TaughtLine[] = [];
    for (let i = 0; i < lines.length; i += 1) {
        const m = SKILL_SCRIPT_RE.exec(lines[i] as string);
        if (!m) continue;
        const ownerSkill = m[1] as string;
        const tool = m[2] as string;
        const col = m.index;
        out.push({
            rel,
            lineNo: i + 1,
            ownerSkill,
            tool,
            target: path.join(root, ownerSkill, 'scripts', tool),
            runner: runnerFor(lines, i, col),
        });
    }
    return out;
}

/** Every taught skill-script line in an installed projection. */
function collectTaughtLines(root: string): TaughtLine[] {
    const out: TaughtLine[] = [];
    for (const skill of fs.readdirSync(root).sort()) {
        const dir = path.join(root, skill);
        if (!fs.statSync(dir).isDirectory()) continue;
        if (fs.existsSync(path.join(dir, 'SKILL.md'))) {
            out.push(...scanFile(root, path.join(skill, 'SKILL.md')));
        }
        const refs = path.join(dir, 'references');
        if (fs.existsSync(refs) && fs.statSync(refs).isDirectory()) {
            for (const f of fs.readdirSync(refs).sort()) {
                if (f.endsWith('.md')) out.push(...scanFile(root, path.join(skill, 'references', f)));
            }
        }
    }
    return out;
}

/** The directory holding the running `node`, i.e. a PATH with nothing else. */
function nodeOnlyPath(): string {
    return path.dirname(process.execPath);
}

/**
 * Can a machine holding only `node` start this runner? A runner carrying a
 * slash is a path, resolved against the skills root and against the project
 * the consumer is standing in — never against THIS repository's cwd, where
 * the maintainer wrapper exists and would answer yes for the one reason the
 * question is being asked.
 */
function runnerAvailable(runner: string, root: string, consumerCwd: string): boolean {
    if (runner === '') return false;
    if (runner.includes('/')) {
        const candidates = [path.resolve(root, runner), path.resolve(consumerCwd, runner)];
        return candidates.some((c) => fs.existsSync(c));
    }
    for (const dir of nodeOnlyPath().split(path.delimiter)) {
        if (fs.existsSync(path.join(dir, runner))) return true;
    }
    return false;
}

// The taught path, checked as installed.

describe('skill-script lines in an installed projection', () => {
    it('control: no taught runner can be started on a machine holding only node', () => {
        const root = installProjection();
        const rows = collectTaughtLines(root);
        expect(rows.length, 'the projection must teach at least one skill-script line').toBeGreaterThan(0);

        const consumerCwd = mkTmp('skill-script-consumer-');
        const startable = rows.filter((r) => runnerAvailable(r.runner, root, consumerCwd));
        const runners = [...new Set(rows.map((r) => r.runner))].sort();

        // Two shapes ship today, and neither starts: the maintainer-only
        // dispatch wrapper `package.json` `files[]` does not list, and one
        // line that names no runner at all, leaving the consumer to execute
        // a `.ts` file directly.
        expect(runners).toEqual(['', './scripts-run']);
        expect(
            startable.map((r) => `${r.rel}:${r.lineNo}`),
            'rows whose runner a node-only machine can start',
        ).toEqual([]);
    });

    it('control: every taught target resolves to a file that is shipped', () => {
        const root = installProjection();
        const rows = collectTaughtLines(root);
        // The path half is already sound — `sync_non_md` carries `scripts/`
        // into the projection — so only the runner is broken. Recorded so a
        // later phase cannot silently trade one half for the other.
        const missing = rows.filter((r) => !fs.existsSync(`${r.target}.ts`) && !fs.existsSync(r.target));
        expect(
            missing.map((r) => `${r.rel}:${r.lineNo} -> ${path.relative(root, r.target)}`),
            'taught targets with no file behind them',
        ).toEqual([]);
    });
});
