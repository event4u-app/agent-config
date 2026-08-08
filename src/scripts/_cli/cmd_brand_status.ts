/**
 * `agent-config brand:status` — is a consumer brand layer present, and where.
 *
 * Phase 2.4 of `road-to-capability-answerability`. `brand-source-of-truth` makes
 * a precedence claim — a registered brand outranks the curated corpus — and an
 * agent can only honour it by knowing whether a registered brand EXISTS. Before
 * this verb the rule named the artefact and no path at all, so "is there a
 * consumer brand here" was answerable only by guessing a filename, and the
 * silent failure is the expensive one: the corpus quietly supplies defaults and
 * the output looks fine.
 *
 * ## The filename defect this verb exposes
 *
 * The rule names `.tokens.json`, with a leading dot, four times. The only real
 * resolver in the tree — `BRAND_TOKEN_PATHS` in the UI scaffold directive —
 * looks for `tokens.json`, without one, in four conventional locations. A
 * consumer who followed the rule literally would author a file the resolver can
 * never find, and nothing would report it. So this verb searches the canonical
 * list AND separately reports a dot-prefixed file sitting beside it, because
 * "you have a brand file in the wrong place" is a different answer from "you
 * have no brand".
 *
 * The path list is IMPORTED from the resolver rather than restated. A probe with
 * its own copy of the search order is a second answer waiting to disagree with
 * the first, which is the whole defect class this roadmap closes.
 *
 * Read-only by construction. Exit code is always `0`: "no brand layer" is a
 * legitimate answer (greenfield), not a failure.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolve_project_root } from '../_lib/agent_settings.js';
import { BRAND_TOKEN_PATHS } from '../../agent-src/templates/scripts/work_engine/directives/ui/scaffold.js';

export interface BrandStatusOptions {
    cwd: string;
    json: boolean;
}

export interface BrandStatusResult {
    code: 0;
    out: string[];
    err: string[];
}

/** The first canonical path holding a tokens file under `root`, or `null`. */
export function findBrandTokens(root: string): string | null {
    for (const rel of BRAND_TOKEN_PATHS) {
        try {
            if (fs.statSync(path.join(root, rel)).isFile()) return rel;
        } catch {
            continue;
        }
    }
    return null;
}

/**
 * Dot-prefixed near-misses — a `.tokens.json` beside each canonical location.
 *
 * These are files a consumer plausibly created by following the rule's own
 * wording, and every one of them is invisible to the resolver.
 */
export function findDottedNearMisses(root: string): string[] {
    const found: string[] = [];
    for (const rel of BRAND_TOKEN_PATHS) {
        const dotted = path.join(path.dirname(rel), `.${path.basename(rel)}`);
        const normalised = dotted.startsWith('./') ? dotted.slice(2) : dotted;
        try {
            if (fs.statSync(path.join(root, normalised)).isFile()) found.push(normalised);
        } catch {
            continue;
        }
    }
    return found;
}

export function runBrandStatus(opts: BrandStatusOptions): BrandStatusResult {
    const out: string[] = [];
    const [projectRoot] = resolve_project_root(null, { cwd: opts.cwd });
    const found = findBrandTokens(projectRoot);
    const nearMisses = findDottedNearMisses(projectRoot);

    if (opts.json) {
        out.push(
            JSON.stringify(
                {
                    brand_layer_present: found !== null,
                    tokens_file: found,
                    searched: [...BRAND_TOKEN_PATHS],
                    dotted_near_misses: nearMisses,
                    project_root: projectRoot,
                },
                null,
                2,
            ),
        );
        return { code: 0, out, err: [] };
    }

    if (found !== null) {
        out.push(`brand layer   present — ${found}`);
        out.push('              brand-source-of-truth applies: these tokens outrank the corpus.');
    } else {
        out.push('brand layer   none');
        out.push(`  searched    ${BRAND_TOKEN_PATHS.join(', ')}`);
        out.push('  meaning     no consumer brand to be authoritative. The corpus is the only');
        out.push('              ground, and every emitted value is corpus-sourced — which is the');
        out.push('              greenfield branch of brand-source-of-truth, not a misconfiguration.');
    }

    if (nearMisses.length > 0) {
        out.push(
            '',
            '⚠️  A dot-prefixed tokens file exists and is NOT read by anything:',
            ...nearMisses.map((m) => `      ${m}`),
            '    The resolver searches `tokens.json`, never `.tokens.json`. Rename it to one',
            '    of the searched paths above, or it stays invisible while looking authored.',
        );
    }

    return { code: 0, out, err: [] };
}

interface ParsedArgv {
    ok: boolean;
    message?: string;
    json?: boolean;
}

export function parseArgv(argv: readonly string[]): ParsedArgv {
    let json = false;
    for (const a of argv) {
        if (a === '--json') {
            json = true;
        } else if (a === '-h' || a === '--help') {
            return { ok: false, message: 'usage: agent-config brand:status [--json]' };
        } else {
            return { ok: false, message: `unknown argument: ${a}` };
        }
    }
    return { ok: true, json };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const parsed = parseArgv(argv);
    if (!parsed.ok) {
        process.stderr.write(`${parsed.message ?? 'usage error'}\n`);
        return 2;
    }
    const result = runBrandStatus({ cwd: process.cwd(), json: parsed.json === true });
    for (const line of result.out) process.stdout.write(`${line}\n`);
    for (const line of result.err) process.stderr.write(`${line}\n`);
    return result.code;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
