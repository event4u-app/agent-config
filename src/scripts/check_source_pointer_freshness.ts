#!/usr/bin/env tsx
/**
 * check_source_pointer_freshness — fail when an AUTHORING artifact asserts a
 * RETIRED source-of-truth pointer as the current one.
 *
 * The doc-follows-code discipline (rule: downstream-changes § Doc-Impact;
 * skill: agent-docs-writing § Doc-Impact) is a behavioral obligation. This is
 * its deterministic backstop for the one drift class a plain script CAN catch
 * without semantics: a doc that still names the retired `.agent-src.uncondensed/`
 * tree as the source of truth after the source moved to `src/` (ADR-051).
 *
 * Scope is deliberately narrow (council 2026-07-21, do-not-build list): an
 * explicit allowlist of the authoring files that MAKE a source-of-truth claim,
 * not a whole-tree sweep — a gate that fires on every commit and gets
 * routinely overridden is worse than none. Historical mentions (ADRs under
 * docs/decisions/, archived roadmaps) are out of scope by construction; a
 * genuinely-historical line inside an allowlisted file is exempted with an
 * inline `<!-- pointer-freshness: historical -->` marker.
 *
 * Extend AUTHORING_FILES as the broader `.agent-src.uncondensed` cleanup lands.
 * road-to-retire-stale-authoring-pointers (2026-07-28) migrated the stale
 * *authoring-source* pointers (43 `.md` lines) to `src/` and added the now
 * token-free files here; the remaining `.agent-src.uncondensed/` references in
 * `src/` are live code constants / pipeline descriptions / catalog paths that
 * are correct and must stay (not authoring pointers).
 *
 * Exit codes: 0 = clean, 1 = a retired pointer in an allowlisted authoring
 * file, 2 = usage / self-test failure.
 *
 * Usage:
 *     tsx src/scripts/check_source_pointer_freshness.ts [--json] [--selftest]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
// parents[2] of src/scripts/<file> is the repo root.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// Authoring files that assert WHERE the source of truth lives. Each must NOT
// name the retired `.agent-src.uncondensed/` tree as current. Extend as the
// broader cleanup lands.
const AUTHORING_FILES: readonly string[] = [
    // Seeded by #989 (the source-of-truth README + thin-root skill).
    'src/agent-src/README.md',
    'src/skills/agents-md-thin-root/SKILL.md',
    // Added by road-to-retire-stale-authoring-pointers (2026-07-28): files whose
    // stale "edit `.agent-src.uncondensed/`" authoring pointers were migrated to
    // `src/` and are now token-free — locking them against regression. Files that
    // retain legitimate `.agent-src.uncondensed/` references (pipeline
    // descriptions, catalog-asset paths, validator_ignore config, fenced code)
    // are intentionally NOT listed — they are guarded behaviorally by the
    // downstream-changes § Doc-Impact rule, not by this any-occurrence scan.
    'src/agent-src/templates/persona.md',
    'src/domains/ai-video/image/command.md',
    'src/domains/ai-video/video/command.md',
    'src/domains/engineering-base/fix/portability/command.md',
    'src/domains/engineering-base/fix/refs/command.md',
    'src/domains/gtm-marketing/post-as/command.md',
    'src/domains/meta/agents/command.md',
    'src/domains/meta/agents/user/command.md',
    'src/domains/meta/optimize/augmentignore/command.md',
    'src/domains/product-basic/roadmap/ai-council/command.md',
    'src/domains/product-discovery/research/command.md',
    'src/skills/md-language-check/SKILL.md',
    'src/skills/override-management/SKILL.md',
    'src/skills/rule-refactor/SKILL.md',
];

// Retired source-of-truth pointer. Matches both the bare token and the older
// monorepo-prefixed form `packages/core/.agent-src.uncondensed/`.
const RETIRED_POINTER = /\.agent-src\.uncondensed\//;

// A line carrying this marker is a deliberate historical reference — exempt.
const HISTORICAL_MARKER = '<!-- pointer-freshness: historical -->';

interface Hit {
    file: string;
    line: number;
    text: string;
}

function _scanFile(rel: string): Hit[] {
    const abs = path.join(ROOT, rel);
    let text: string;
    try {
        if (!fs.statSync(abs).isFile()) {
            return [];
        }
        text = fs.readFileSync(abs, 'utf-8');
    } catch {
        // A missing allowlisted file is a config drift in itself — surface it.
        return [{ file: rel, line: 0, text: '(allowlisted authoring file not found)' }];
    }
    const hits: Hit[] = [];
    const lines = text.split('\n');
    for (let idx = 0; idx < lines.length; idx += 1) {
        const line = lines[idx] as string;
        if (line.includes(HISTORICAL_MARKER)) {
            continue;
        }
        if (RETIRED_POINTER.test(line)) {
            hits.push({ file: rel, line: idx + 1, text: line.trim().slice(0, 160) });
        }
    }
    return hits;
}

/** Deterministic self-check of the matcher — no filesystem, no network. */
function _selftest(): number {
    const stale = 'The source of truth is `.agent-src.uncondensed/`. Edit there.';
    const monorepo = 'Editing `packages/core/.agent-src.uncondensed/templates/AGENTS.md`.';
    const clean = 'The source of truth is `src/`. Edit there, then run `task sync`.';
    const historical = `Retired path \`.agent-src.uncondensed/\` ${HISTORICAL_MARKER}`;
    const cases: Array<[string, boolean]> = [
        [stale, true],
        [monorepo, true],
        [clean, false],
        [historical, false], // marker suppresses the match at scan time
    ];
    let ok = true;
    for (const [sample, shouldMatch] of cases) {
        const exempt = sample.includes(HISTORICAL_MARKER);
        const matched = !exempt && RETIRED_POINTER.test(sample);
        if (matched !== shouldMatch) {
            process.stderr.write(`selftest FAIL: ${JSON.stringify(sample)} expected match=${shouldMatch}, got ${matched}\n`);
            ok = false;
        }
    }
    if (ok) {
        process.stdout.write('✅  check_source_pointer_freshness selftest passed (4/4).\n');
        return 0;
    }
    return 2;
}

function main(argv: readonly string[]): number {
    if (argv.includes('--selftest')) {
        return _selftest();
    }
    const asJson = argv.includes('--json');
    // Scope is the allowlist itself — there is no tree to walk. An emptied
    // AUTHORING_FILES scans nothing and reports "No retired source-of-truth
    // pointers" forever, which is the one result this gate must never produce
    // by accident. Exit 2 (the usage / self-test class, i.e. the gate could
    // not run), never 1 — 1 asserts a retired pointer was actually found.
    try {
        assertWatchlistResolves({
            gate: 'check_source_pointer_freshness',
            candidates: AUTHORING_FILES,
            repoRoot: ROOT,
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 2;
        }
        throw err;
    }
    const hits: Hit[] = [];
    for (const rel of AUTHORING_FILES) {
        hits.push(..._scanFile(rel));
    }

    if (asJson) {
        process.stdout.write(JSON.stringify({ ok: hits.length === 0, hits }, null, 2) + '\n');
    } else if (hits.length > 0) {
        process.stdout.write(`❌  ${hits.length} retired source-of-truth pointer(s) in authoring files:\n\n`);
        for (const h of hits) {
            process.stdout.write(`  ${h.file}:${h.line}  ${h.text}\n`);
        }
        process.stdout.write(
            '\nThese name the retired `.agent-src.uncondensed/` tree as the source of\n' +
                'truth. The source of truth is `src/` (ADR-051, rule: source-of-truth).\n' +
                'Fix the pointer, or mark a genuinely-historical line with\n' +
                `\`${HISTORICAL_MARKER}\`. See rule: downstream-changes § Doc-Impact.\n`,
        );
    } else {
        process.stdout.write('✅  No retired source-of-truth pointers in authoring files.\n');
    }
    return hits.length > 0 ? 1 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}

export { main, _scanFile, _selftest, AUTHORING_FILES, RETIRED_POINTER, HISTORICAL_MARKER };
