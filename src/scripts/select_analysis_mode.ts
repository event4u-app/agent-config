#!/usr/bin/env tsx
/**
 * `select_analysis_mode` — full analysis, or a targeted delta?
 *
 * `project-analysis-core` writes an artefact per analysed target under the
 * `agents/knowledge/concepts/` convention. Re-running it against a target that
 * already has one rewrites a page that mostly still holds, which costs a full
 * read of the codebase to reproduce conclusions already on disk.
 *
 * This decides which path to take, and it decides ONE thing only: write
 * economics. It does NOT change the trust status of the existing artefact.
 * A concept page is a hypothesis cache, never truth (`context-document`,
 * `source-discovery-gate` § v1↔v2 isolation), so the delta path still
 * re-verifies every structural claim it carries forward against a live source.
 * A cheaper write is not a licence to trust a cached read.
 *
 * Exit codes: 0 always — this is a router, not a gate. The answer is on stdout.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(HERE), '..', '..');

/** Where `/team-knowledge consolidate` lands concept pages. */
export const CONCEPTS_DIR = 'agents/knowledge/concepts';

export type AnalysisMode = 'full' | 'delta';

export interface ModeVerdict {
    mode: AnalysisMode;
    /** The artefact the delta path would update, repo-relative. Null on `full`. */
    artefact: string | null;
    /** One sentence, printed — why this path. */
    reason: string;
}

/** `Auth Module` / `auth-module` / `auth module` all address the same page. */
export function slugify(target: string): string {
    return target
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Does a concept page for this target already exist?
 *
 * Matched on the slug, so the caller's phrasing does not decide the answer. An
 * EMPTY file is deliberately treated as absent: a zero-byte page carries no
 * conclusions to delta against, and taking the delta path on one would produce
 * an update of nothing while reporting a saving.
 */
export function selectAnalysisMode(target: string, root: string = REPO_ROOT): ModeVerdict {
    const slug = slugify(target);
    if (slug === '') {
        return {
            mode: 'full',
            artefact: null,
            reason: 'the target resolves to an empty slug, so no artefact can be addressed',
        };
    }
    const dir = path.join(root, CONCEPTS_DIR);
    const candidate = path.join(dir, `${slug}.md`);
    let stat: fs.Stats;
    try {
        stat = fs.statSync(candidate);
    } catch {
        return {
            mode: 'full',
            artefact: null,
            reason: `no ${CONCEPTS_DIR}/${slug}.md — nothing to delta against`,
        };
    }
    if (!stat.isFile() || stat.size === 0) {
        return {
            mode: 'full',
            artefact: null,
            reason: `${CONCEPTS_DIR}/${slug}.md is empty — it carries no conclusions to carry forward`,
        };
    }
    return {
        mode: 'delta',
        artefact: path.join(CONCEPTS_DIR, `${slug}.md`),
        reason:
            `${CONCEPTS_DIR}/${slug}.md exists (${String(stat.size)} bytes) — read it first and ` +
            'analyse the gaps, stale sections and new patterns, not the whole tree. Its ' +
            'structural claims are still re-verified against a live source.',
    };
}

export function main(argv: string[] = process.argv.slice(2), root = REPO_ROOT): number {
    const target = argv.filter((a) => !a.startsWith('--')).join(' ');
    if (target === '') {
        process.stderr.write('usage: select_analysis_mode <target>\n');
        return 2;
    }
    const v = selectAnalysisMode(target, root);
    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(v)}\n`);
    } else {
        process.stdout.write(`${v.mode}: ${v.reason}\n`);
    }
    return 0;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(HERE)) {
    process.exit(main());
}
