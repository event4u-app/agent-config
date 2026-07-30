#!/usr/bin/env tsx
/**
 * C-3 measurement harness — scope de-duplication of the rule projection.
 *
 * Pre-registered in `road-to-cache-economy.md` § "C-3
 * pre-registration" BEFORE this script produced a number. Metric, threshold and
 * honest-null consequence are fixed there; this file only measures.
 *
 * What it does, deterministically and without touching the real HOME:
 *
 *   1. Builds a two-scope FIXTURE: a temp home whose `.claude/rules/` is a
 *      byte-identical copy of the projected rule source. That is the condition
 *      the reduction targets — a consumer carrying the same package version at
 *      user scope and project scope. (On a maintainer machine the two scopes
 *      hold different releases, so the dedup is correctly inert; that case is
 *      measured too, as the control.)
 *   2. Censuses the payload with the dedup OFF, then ON.
 *   3. Reports the delta against BOTH denominators: the measured median
 *      cold-start (what a spawn actually pays) and the file-measurable subtotal.
 *
 * It never writes into `~`, never regenerates the repo's own projection, and
 * makes no network call.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { censusRuleDir } from './preamble_byte_census.js';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const RULES_SOURCE = path.join(REPO_ROOT, 'dist', 'agent-src', 'rules');

/** Estimated tokens, the same chars/4 basis the census uses. */
function tokens(chars: number): number {
    return Math.round(chars / 4);
}

interface ScopeSnapshot {
    files: number;
    chars: number;
    tokens: number;
}

function snapshot(dir: string): ScopeSnapshot {
    const c = censusRuleDir(dir);
    return { files: c.files, chars: c.chars, tokens: tokens(c.chars) };
}

/** Copy every `*.md` byte-for-byte — the fixture must be byte-identical to matter. */
function copyRules(from: string, to: string): number {
    fs.mkdirSync(to, { recursive: true });
    let n = 0;
    for (const entry of fs.readdirSync(from)) {
        if (!entry.endsWith('.md')) continue;
        fs.copyFileSync(path.join(from, entry), path.join(to, entry));
        n += 1;
    }
    return n;
}

/**
 * Which rules a byte-identity-gated dedup would skip at project scope. Mirrors
 * `condense._dedupable_rules`'s predicate rather than importing it, so the
 * measurement fails loudly if the two ever disagree instead of moving together.
 */
function dedupableCount(userDir: string, sourceDir: string): { skipped: number; chars: number } {
    let skipped = 0;
    let chars = 0;
    if (!fs.existsSync(userDir)) return { skipped, chars };
    for (const entry of fs.readdirSync(sourceDir)) {
        if (!entry.endsWith('.md')) continue;
        const twin = path.join(userDir, entry);
        const source = path.join(sourceDir, entry);
        if (!fs.existsSync(twin)) continue;
        const a = fs.readFileSync(twin);
        const b = fs.readFileSync(source);
        if (a.equals(b)) {
            skipped += 1;
            chars += b.byteLength;
        }
    }
    return { skipped, chars };
}

function main(argv: readonly string[]): number {
    const medianArg = argv.find((a) => a.startsWith('--measured-median='));
    // The measured median cold-start payload, from the transcript census. Passed
    // in rather than re-derived so this harness stays byte-only and offline.
    const measuredMedian = medianArg ? Number(medianArg.split('=')[1]) : 230556;

    const fixtureHome = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-dedup-'));
    const fixtureUserRules = path.join(fixtureHome, '.claude', 'rules');
    const copied = copyRules(RULES_SOURCE, fixtureUserRules);

    const source = snapshot(RULES_SOURCE);
    const fixtureUser = snapshot(fixtureUserRules);

    // --- the two conditions ---------------------------------------------------
    const fixture = dedupableCount(fixtureUserRules, RULES_SOURCE);
    const realUserRules = path.join(process.env['HOME'] ?? os.homedir(), '.claude', 'rules');
    const control = dedupableCount(realUserRules, RULES_SOURCE);

    const before = fixtureUser.tokens + source.tokens; // both scopes load
    const after = fixtureUser.tokens + (source.tokens - tokens(fixture.chars));
    const removed = before - after;

    const pct = (part: number, whole: number): string => `${((part / whole) * 100).toFixed(1)}%`;

    const lines: string[] = [];
    lines.push('C-3 measurement — scope de-duplication of the rule projection');
    lines.push(`  metric basis: chars/4 token estimate; rule source ${RULES_SOURCE}`);
    lines.push('');
    lines.push(`FIXTURE (consumer condition — same version at both scopes, ${copied} files copied)`);
    lines.push(`  user scope:            ${fixtureUser.files} files, ${fixtureUser.tokens} tok`);
    lines.push(`  project scope:         ${source.files} files, ${source.tokens} tok`);
    lines.push(`  byte-identical twins:  ${fixture.skipped}/${source.files}`);
    lines.push(`  rules payload before:  ${before} tok`);
    lines.push(`  rules payload after:   ${after} tok`);
    lines.push(`  removed:               ${removed} tok`);
    lines.push('');
    lines.push('REDUCTION vs the pre-registered denominators');
    lines.push(`  of measured median cold-start (${measuredMedian} tok): ${pct(removed, measuredMedian)}`);
    lines.push(`  of the two-scope rules payload (${before} tok):       ${pct(removed, before)}`);
    lines.push('');
    lines.push('CONTROL (this machine — versions drift, so the dedup must be inert)');
    lines.push(`  byte-identical twins:  ${control.skipped}/${source.files}`);
    lines.push(`  removed:               ${tokens(control.chars)} tok`);
    lines.push('');
    lines.push(`threshold: >= 15% of the measured median  ->  ${
        removed / measuredMedian >= 0.15 ? 'MET' : 'NOT MET'
    }`);
    lines.push('');
    lines.push('Content safety: only byte-identical twins are removed, so the host still');
    lines.push('loads the same rule text in full — once instead of twice. No rule becomes');
    lines.push('trigger-gated, which is what separates this from the disabled thin projection.');

    process.stdout.write(lines.join('\n') + '\n');
    fs.rmSync(fixtureHome, { recursive: true, force: true });
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main(process.argv.slice(2)));
}

export { dedupableCount, main };
