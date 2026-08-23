#!/usr/bin/env node
/**
 * lint_spawn_payload — makes the `subagent-spawn-contract.md` Iron Law
 * ("NEVER BULK-DUMP CONTEXT INTO A SUBAGENT") deterministic
 * (road-to-lean-agent-init Phase 3).
 *
 * WIDENED 2026-08-23 (road-to-review-independence step 0.4) to a THIRD surface: the
 * SHIPPED prompt templates under `src/skills/subagent-orchestration/prompts/`. The gate
 * made the "NEVER BULK-DUMP CONTEXT INTO A SUBAGENT" Iron Law deterministic over test
 * fixtures and golden transcripts — i.e. over the places a violation is *simulated* —
 * while the templates that actually construct a spawn brief in production sat outside
 * it. Eight diff-payload placeholder sites across five of those files, plus two further
 * placeholder shapes in two more, were unscanned.
 *
 * Still WARN-ONLY, exactly as before: this surface is prose with placeholders, and a
 * placeholder is not yet a payload. What the widening buys is that a template growing a
 * bulk-dump shape is now visible rather than invisible.
 *
 * Scans three surfaces for spawn-brief-shaped payloads: (a) JSON fixtures
 * matching `tests/fixtures/**\/*spawn*.json`; (b) fenced code blocks in
 * `tests/reasoning-layer-eval/golden-transcripts/*.md` that either parse as
 * JSON with both a `task` and a `knowledge_refs` key, or are introduced by
 * nearby prose mentioning "spawn" + "task"/"brief".
 *
 * Three checks per payload found:
 *   R1 inline-ref-body — a `knowledge_refs` entry with a newline or > 200
 *      chars (mirrors `isRefLike` in `_lib/subagent_spawn.ts` — refs must be
 *      pointers, never inline bodies).
 *   R2 uncut-file-dump — the payload itself spans > 40 lines (a curated
 *      brief is short; a 40+ line blob is a raw dump).
 *   R3 over-cap — total payload size exceeds its tier's char cap: lite
 *      8_000 / medium 16_000 / high 32_000 (SEED values, ~2k/4k/8k tokens at
 *      ~4 chars/token). Unrecognised/absent tier caps at `high` — never guess
 *      down. These are a first cut; the roadmap's Phase-3 `init_tokens`
 *      telemetry is expected to refine them against a measured baseline, and
 *      Phase 5's healthy-worker target (~1,500 tokens/worker) sits well
 *      under even the `lite` cap.
 *
 * Warn-only by default. `--strict` flips findings to exit 2 — the promotion
 * path once a clean observation window confirms the caps and detection
 * heuristics don't false-positive on real traffic, per the same
 * warn-then-promote pattern as `lint_skill_originality.ts`
 * (`adr-architectural-consensus-mechanism`).
 *
 * Usage:
 *   ./scripts-run src/scripts/lint_spawn_payload            # warn-only (CI default)
 *   ./scripts-run src/scripts/lint_spawn_payload --strict   # exit 2 on any finding
 *   ./scripts-run src/scripts/lint_spawn_payload --quiet    # summary line only
 *
 * Exit codes: 0 = clean or warn-only findings, 2 = --strict + findings present.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { reportScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');

type Tier = 'lite' | 'medium' | 'high';

/** Per-tier payload char cap — SEED values, see header comment. */
const CAPS: Record<Tier, number> = { lite: 8_000, medium: 16_000, high: 32_000 };

interface Finding {
    rule: string;
    file: string;
    line: number;
    snippet: string;
}

interface Payload {
    file: string;
    line: number;
    text: string;
    parsed: unknown;
}

function isTier(s: string): s is Tier {
    return s === 'lite' || s === 'medium' || s === 'high';
}

/** Determine the payload's tier from a `tier` JSON field, then a nearby
 * `tier: <x>` mention in the raw text; unknown → `high` (never guess down). */
function detectTier(text: string, parsed: unknown): Tier {
    if (parsed !== null && typeof parsed === 'object') {
        const t = (parsed as Record<string, unknown>).tier;
        if (typeof t === 'string' && isTier(t.toLowerCase())) return t.toLowerCase() as Tier;
    }
    const m = /\btier["']?\s*[:=]\s*["']?(lite|medium|high)\b/i.exec(text);
    if (m?.[1] && isTier(m[1].toLowerCase())) return m[1].toLowerCase() as Tier;
    return 'high';
}

function mk(p: Payload, rule: string, snippet: string): Finding {
    return { rule, file: p.file, line: p.line, snippet };
}

/** The three checks, run against one identified spawn payload. */
function checkPayload(p: Payload): Finding[] {
    const out: Finding[] = [];

    const lineCount = p.text.split('\n').length;
    if (lineCount > 40) {
        out.push(
            mk(p, 'uncut-file-dump', `payload spans ${lineCount} lines (> 40) — looks like a raw file dump, not a curated brief`),
        );
    }

    const tier = detectTier(p.text, p.parsed);
    const cap = CAPS[tier];
    if (p.text.length > cap) {
        out.push(mk(p, 'over-cap', `payload is ${p.text.length} chars, over the '${tier}' cap of ${cap}`));
    }

    if (p.parsed !== null && typeof p.parsed === 'object') {
        const refs = (p.parsed as Record<string, unknown>).knowledge_refs;
        if (Array.isArray(refs)) {
            for (const ref of refs) {
                if (typeof ref !== 'string') continue;
                if (ref.includes('\n')) {
                    out.push(mk(p, 'inline-ref-body', 'knowledge_refs entry contains a newline — refs must be short pointers, never inline bodies'));
                } else if (ref.length > 200) {
                    out.push(mk(p, 'inline-ref-body', `knowledge_refs entry is ${ref.length} chars (> 200) — refs must be short pointers, never inline bodies`));
                }
            }
        }
    }

    return out;
}

// ---------------------------------------------------------------------------
// Surface (a) — JSON fixtures matching tests/fixtures/**/*spawn*.json
// ---------------------------------------------------------------------------
function* walkFiles(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walkFiles(full);
        else yield full;
    }
}

function scanJsonFixture(filePath: string, repoRoot: string): Finding[] {
    const rel = path.relative(repoRoot, filePath);
    const raw = fs.readFileSync(filePath, 'utf-8');
    let parsed: unknown = null;
    try {
        parsed = JSON.parse(raw);
    } catch {
        parsed = null;
    }
    return checkPayload({ file: rel, line: 1, text: raw, parsed });
}

// ---------------------------------------------------------------------------
// Surface (b) — fenced spawn-payload blocks in golden transcripts
// ---------------------------------------------------------------------------
function scanMarkdownTranscript(filePath: string, repoRoot: string): Finding[] {
    const rel = path.relative(repoRoot, filePath);
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const findings: Finding[] = [];

    let inBlock = false;
    let fenceMarker = '';
    let blockStart = -1;
    let blockLines: string[] = [];
    const contextWindow: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';

        if (!inBlock) {
            const openMatch = /^(```|~~~)/.exec(line);
            if (openMatch?.[1]) {
                inBlock = true;
                fenceMarker = openMatch[1];
                blockStart = i;
                blockLines = [];
                continue;
            }
            if (line.trim().length > 0) contextWindow.push(line.trim());
            continue;
        }

        if (line.startsWith(fenceMarker)) {
            const blockText = blockLines.join('\n');
            let parsed: unknown = null;
            try {
                parsed = JSON.parse(blockText);
            } catch {
                parsed = null;
            }
            const parsedLooksLikeSpawn =
                parsed !== null &&
                typeof parsed === 'object' &&
                Object.prototype.hasOwnProperty.call(parsed, 'task') &&
                Object.prototype.hasOwnProperty.call(parsed, 'knowledge_refs');
            const precedingContext = contextWindow.slice(-3).join(' ');
            const contextLooksLikeSpawn = /spawn/i.test(precedingContext) && /(task|brief)/i.test(precedingContext);

            if (parsedLooksLikeSpawn || contextLooksLikeSpawn) {
                findings.push(...checkPayload({ file: rel, line: blockStart + 2, text: blockText, parsed }));
            }

            inBlock = false;
            contextWindow.length = 0;
            continue;
        }

        blockLines.push(line);
    }

    return findings;
}

function scanRepo(repoRoot: string): Finding[] {
    const findings: Finding[] = [];
    // Counted before the `*spawn*.json` / spawn-context filters: those decide
    // what is JUDGED, and both are legitimately zero on a clean tree. Only the
    // walk itself distinguishes "no spawn payloads" from "no files read".
    let scanned = 0;

    const fixturesDir = path.join(repoRoot, 'tests', 'fixtures');
    for (const f of walkFiles(fixturesDir)) {
        scanned += 1;
        if (f.endsWith('.json') && /spawn/i.test(path.basename(f))) {
            findings.push(...scanJsonFixture(f, repoRoot));
        }
    }

    // The shipped templates — step 0.4's surface. Counted the same way as the other two
    // (the walk, not the filter), so "no violations" and "no files read" stay
    // distinguishable; that distinction is why `scanned` is incremented before any
    // content test in all three loops.
    const templatesDir = path.join(repoRoot, 'src', 'skills', 'subagent-orchestration', 'prompts');
    if (fs.existsSync(templatesDir)) {
        for (const entry of fs.readdirSync(templatesDir, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.endsWith('.md')) {
                scanned += 1;
                findings.push(
                    ...scanMarkdownTranscript(path.join(templatesDir, entry.name), repoRoot),
                );
            }
        }
    }

    const transcriptsDir = path.join(repoRoot, 'tests', 'reasoning-layer-eval', 'golden-transcripts');
    if (fs.existsSync(transcriptsDir)) {
        for (const entry of fs.readdirSync(transcriptsDir, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.endsWith('.md')) {
                scanned += 1;
                findings.push(...scanMarkdownTranscript(path.join(transcriptsDir, entry.name), repoRoot));
            }
        }
    }

    // `reportScanned`, not `assertScanned`: step 0.4's verify compares the scanned count
    // against the pre-change one, and a count the gate never prints cannot be compared.
    // The helper's own docstring makes the same point — "a count only visible without
    // `--quiet` is not a count, since CI passes `--quiet`" — so the line goes to stdout
    // unconditionally.
    reportScanned({
        gate: 'lint_spawn_payload',
        scanned,
        units: 'fixture / transcript / template file(s)',
        roots: [
            'tests/fixtures',
            'tests/reasoning-layer-eval/golden-transcripts',
            'src/skills/subagent-orchestration/prompts',
        ],
    });
    return findings;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv: readonly string[]): { strict: boolean; quiet: boolean } {
    return { strict: argv.includes('--strict'), quiet: argv.includes('--quiet') };
}

function main(argv?: readonly string[], repoRootOverride?: string): number {
    const args = parseArgs(argv ?? process.argv.slice(2));
    const root = repoRootOverride ?? REPO_ROOT;
    let findings: Finding[];
    try {
        findings = scanRepo(root);
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            // 2 is this gate's only non-zero code. Returning it without
            // `--strict` is deliberate: warn-only governs FINDINGS, and a dead
            // scope means there were none to warn about.
            process.stderr.write(`❌  ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    if (!args.quiet) {
        for (const f of findings) {
            process.stdout.write(`⚠️  ${f.file}:${f.line} [${f.rule}] ${f.snippet}\n`);
        }
    }

    if (findings.length === 0) {
        if (!args.quiet) process.stdout.write('✅  lint_spawn_payload: clean — no spawn-payload contract violations found.\n');
        return 0;
    }

    if (args.strict) {
        if (!args.quiet) {
            process.stderr.write(`❌  lint_spawn_payload: ${findings.length} finding(s) under --strict.\n`);
        }
        return 2;
    }

    if (!args.quiet) {
        process.stdout.write(
            `\nlint_spawn_payload: ${findings.length} finding(s), warn-only. Promote with --strict once caps hold across a clean observation window.\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}

export { CAPS, checkPayload, detectTier, main, scanJsonFixture, scanMarkdownTranscript, scanRepo };
export type { Finding, Payload, Tier };
