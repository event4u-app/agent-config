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
 * The authored surfaces once named `.tokens.json`, with a leading dot. The only
 * real resolver in the tree — `BRAND_TOKEN_PATHS` in the UI scaffold directive —
 * looks for `tokens.json`, without one, in four conventional locations. A
 * consumer who followed the old wording authored a file the resolver can never
 * find. So this verb searches the canonical list AND separately reports a
 * dot-prefixed file sitting beside it, because "you have a brand file in the
 * wrong place" is a different answer from "you have no brand".
 *
 * A file that merely exists is not a brand either: each hit is parsed, hashed
 * and classified (`inspectBrand`), so a malformed or shadowed file is named as
 * such rather than reported as the brand.
 *
 * The path list is IMPORTED from the resolver rather than restated. A probe with
 * its own copy of the search order is a second answer waiting to disagree with
 * the first, which is the whole defect class this roadmap closes.
 *
 * Read-only by construction. Exit code is always `0`: "no brand layer" is a
 * legitimate answer (greenfield), not a failure.
 */

import { createHash } from 'node:crypto';
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

/** The source kinds `brand-token-consumption` names. Only `tokens` has a resolver path today. */
export type BrandSourceKind = 'tokens' | 'voice' | 'design-system' | 'design-md';

/**
 * `valid` — the file the brand is read from. `invalid` — unparseable or not a
 * DTCG document. `duplicate` — byte-identical to the winner. `shadowed` — a
 * valid file with different content that loses to the winner on precedence.
 */
export type BrandSourceStatus = 'valid' | 'invalid' | 'duplicate' | 'shadowed';

export interface BrandSource {
    path: string;
    kind: BrandSourceKind;
    sha256: string;
    status: BrandSourceStatus;
    error?: string;
    winner?: string;
}

/**
 * The contract's set names, verbatim (`brand-token-consumption.md` § 2): `bare`
 * is the greenfield case. One vocabulary — never a second one beside it.
 */
export type BrandState = 'bare' | 'mixed' | 'branded';
export type BrandQualifier = 'invalid' | 'shadowed';

export interface BrandInspection {
    state: BrandState;
    qualifiers: BrandQualifier[];
    tokens_file: string | null;
    sources: BrandSource[];
}

const DESIGN_MD = 'DESIGN.md';

function _hasDtcgToken(node: unknown, depth = 0): boolean {
    if (depth > 64 || typeof node !== 'object' || node === null || Array.isArray(node)) return false;
    if ('$value' in node) return true;
    return Object.values(node as Record<string, unknown>).some((v) => _hasDtcgToken(v, depth + 1));
}

/**
 * Parse before present: `null` when the text is a DTCG token document, else the
 * reason it is not one. A file that merely exists is not a brand.
 */
export function tokenDocumentError(text: string): string | null {
    let doc: unknown;
    try {
        doc = JSON.parse(text);
    } catch (exc) {
        return `not JSON: ${exc instanceof Error ? exc.message : String(exc)}`;
    }
    if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
        return 'not a DTCG document: the root is not an object';
    }
    if (!_hasDtcgToken(doc)) {
        return 'not a DTCG document: no token carries a `$value`';
    }
    return null;
}

/**
 * Every canonical path holding a tokens file, classified. Computed on every
 * call and never persisted — a stored index would be a third brand truth.
 * Nothing is merged by value: the first valid file in resolver order wins.
 */
export function inspectBrand(root: string): BrandInspection {
    const sources: BrandSource[] = [];
    let winner: BrandSource | null = null;
    for (const rel of BRAND_TOKEN_PATHS) {
        let bytes: Buffer;
        try {
            const abs = path.join(root, rel);
            if (!fs.statSync(abs).isFile()) continue;
            bytes = fs.readFileSync(abs);
        } catch {
            continue;
        }
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const error = tokenDocumentError(bytes.toString('utf-8'));
        if (error !== null) {
            sources.push({ path: rel, kind: 'tokens', sha256, status: 'invalid', error });
        } else if (winner === null) {
            winner = { path: rel, kind: 'tokens', sha256, status: 'valid' };
            sources.push(winner);
        } else {
            sources.push({
                path: rel,
                kind: 'tokens',
                sha256,
                status: sha256 === winner.sha256 ? 'duplicate' : 'shadowed',
                winner: winner.path,
            });
        }
    }
    // DESIGN.md sits at the project root (`design-system-capture`). It records
    // usage decisions, not values, so it is listed and never decides the state.
    // A `design-system.json` has no canonical location in the tree to search.
    try {
        const abs = path.join(root, DESIGN_MD);
        if (fs.statSync(abs).isFile()) {
            const sha256 = createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
            sources.push({ path: DESIGN_MD, kind: 'design-md', sha256, status: 'valid' });
        }
    } catch {
        // absent — nothing to list
    }
    const qualifiers: BrandQualifier[] = [];
    if (sources.some((s) => s.status === 'invalid')) qualifiers.push('invalid');
    if (sources.some((s) => s.status === 'shadowed')) qualifiers.push('shadowed');
    // The voice side has no slot yet, so it reads as absent and a valid tokens
    // file alone is `mixed`; `branded` needs the voice slot.
    const voicePresent = false;
    const tokensPresent = winner !== null;
    const state: BrandState =
        tokensPresent && voicePresent ? 'branded' : tokensPresent || voicePresent ? 'mixed' : 'bare';
    return { state, qualifiers, tokens_file: winner?.path ?? null, sources };
}

/** The canonical path the brand is read from — the first VALID tokens file — or `null`. */
export function findBrandTokens(root: string): string | null {
    return inspectBrand(root).tokens_file;
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

const VOICE_NOT_READ = 'no brand-voice slot exists yet, so the voice side reads as absent';

export function runBrandStatus(opts: BrandStatusOptions): BrandStatusResult {
    const out: string[] = [];
    const [projectRoot] = resolve_project_root(null, { cwd: opts.cwd });
    const inspection = inspectBrand(projectRoot);
    const found = inspection.tokens_file;
    const nearMisses = findDottedNearMisses(projectRoot);

    if (opts.json) {
        out.push(
            JSON.stringify(
                {
                    brand_layer_present: found !== null,
                    tokens_file: found,
                    state: inspection.state,
                    qualifiers: inspection.qualifiers,
                    sources: inspection.sources,
                    voice: { read: false, reason: VOICE_NOT_READ },
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

    const qualifierText = inspection.qualifiers.length > 0 ? ` (${inspection.qualifiers.join(', ')})` : '';
    out.push(`brand state   ${inspection.state}${qualifierText}`);
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

    if (inspection.sources.length > 0) {
        out.push('', 'sources');
        for (const s of inspection.sources) {
            const note =
                s.status === 'invalid'
                    ? ` — ${s.error ?? 'invalid'}`
                    : s.winner !== undefined
                      ? ` — loses to ${s.winner}`
                      : '';
            out.push(`  ${s.status.padEnd(9)} ${s.path}  sha256:${s.sha256.slice(0, 12)}${note}`);
        }
    }
    out.push('', `voice         not read — ${VOICE_NOT_READ}`);

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
