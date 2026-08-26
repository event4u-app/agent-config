/**
 * A per-path legacy/modern verdict for a half-migrated repository.
 *
 * `road-to-consumer-repo-reality` Phase 4, step 4.1. Incremental replacement of
 * a legacy system alongside the system it replaces is a named, published
 * migration pattern; the artifact that pattern needs and nobody produces is a
 * decidable answer to *"which conventions hold HERE"*.
 *
 * Current guidance says to respect existing patterns and to keep diffs minimal.
 * Neither is decidable without this: in a tree that is two-fifths namespaced,
 * strict-typed, PSR-shaped code and three-fifths an older include-and-dispatch
 * module system, "the existing pattern" is not a property of the repository.
 *
 * A MIXED VERDICT IS NOT A REFUSAL TO DECIDE. That is the step's own wording and
 * it is the hardest requirement here: a verdict that says only "mixed" leaves
 * the caller exactly where it started. So a mixed file reports WHICH convention
 * governs WHICH REGION, by line range, and `conventionAt(verdict, line)` answers
 * the only question an editor actually has — *what must my edit at this point
 * follow?*
 *
 * WHAT THIS MAY AND MAY NOT ENCODE. The phase states the trap in its own body:
 * 4.2 and 4.3 were each observed in exactly one tree, so what may be encoded is
 * the QUESTION, never the particular mechanism that tree happened to use. 4.1 is
 * not in that category — namespaces, strict-type declarations and PSR-4
 * autoloading are language-level and specification-level facts, not one
 * repository's arrangement — but the same restraint is applied anyway: the
 * signals below are all language constructs, and none is a project-specific
 * naming convention, directory layout or framework marker.
 *
 * PER PATH, NEVER PER REPOSITORY. A repository-wide verdict is the thing that
 * makes this artifact useless: the whole point is that the answer differs by
 * file, and inside a file by region.
 */
import * as fs from 'node:fs';

/** Which convention governs. `unknown` is returned rather than guessed. */
export type Convention = 'modern' | 'legacy' | 'mixed' | 'unknown';

/** A contiguous run of lines governed by one convention. */
export interface Region {
    /** 1-indexed, inclusive. */
    startLine: number;
    /** 1-indexed, inclusive. */
    endLine: number;
    convention: 'modern' | 'legacy';
    /** The construct that decided it. Never empty. */
    signal: string;
}

export interface PathVerdict {
    /** The path as given. */
    path: string;
    convention: Convention;
    /**
     * Populated for EVERY verdict that is not `unknown`, including a
     * single-convention file — a caller should not need two code paths.
     */
    regions: Region[];
    /** One sentence naming what decided it. Never empty. */
    reason: string;
}

/**
 * Signals, as language constructs only.
 *
 * `modern` markers are things the older include-and-dispatch style cannot
 * express; `legacy` markers are things the namespaced style does not use. A line
 * matching neither is inherited from the enclosing region rather than guessed —
 * most lines in any file carry no signal at all.
 */
const MODERN: readonly { re: RegExp; signal: string }[] = [
    { re: /^\s*declare\s*\(\s*strict_types\s*=\s*1\s*\)/, signal: 'declare(strict_types=1)' },
    { re: /^\s*namespace\s+[A-Za-z_]/, signal: 'namespace declaration' },
    { re: /^\s*use\s+[A-Za-z_][A-Za-z0-9_]*\\/, signal: 'namespaced use statement' },
    { re: /^\s*(?:final\s+|abstract\s+)?(?:readonly\s+)?(?:class|interface|trait|enum)\s+/, signal: 'class-like declaration' },
];

const LEGACY: readonly { re: RegExp; signal: string }[] = [
    { re: /^\s*(?:require|include)(?:_once)?\s*[\s(]/, signal: 'require/include' },
    { re: /^\s*global\s+\$/, signal: 'global statement' },
    { re: /\$GLOBALS\s*\[/, signal: '$GLOBALS access' },
    { re: /^\s*(?:function|class)\s+[a-z][A-Za-z0-9_]*\s*\(/, signal: 'unnamespaced snake/camel function' },
];

function _signalFor(line: string): { convention: 'modern' | 'legacy'; signal: string } | null {
    for (const { re, signal } of MODERN) if (re.test(line)) return { convention: 'modern', signal };
    for (const { re, signal } of LEGACY) if (re.test(line)) return { convention: 'legacy', signal };
    return null;
}

/**
 * Classify one file's text into regions.
 *
 * A signal starts a region that runs until the next signal of the OTHER
 * convention. Lines before the first signal belong to the first region, so every
 * line of a classified file is covered — a caller asking about line 1 of a file
 * whose first signal is on line 3 gets an answer rather than a hole.
 */
export function classifyText(pathName: string, text: string): PathVerdict {
    const lines = text.split('\n');
    const regions: Region[] = [];
    for (let i = 0; i < lines.length; i += 1) {
        const hit = _signalFor(lines[i] ?? '');
        if (hit === null) continue;
        const last = regions[regions.length - 1];
        if (last !== undefined && last.convention === hit.convention) {
            last.endLine = i + 1;
            continue;
        }
        regions.push({ startLine: i + 1, endLine: i + 1, convention: hit.convention, signal: hit.signal });
    }

    if (regions.length === 0) {
        return {
            path: pathName,
            convention: 'unknown',
            regions: [],
            reason: 'no convention signal found — neither a namespaced construct nor an include-and-dispatch one',
        };
    }

    // Extend each region to meet the next, and the first back to line 1, so the
    // whole file is covered and `conventionAt` never returns a hole.
    const first = regions[0] as Region;
    first.startLine = 1;
    for (let i = 0; i < regions.length - 1; i += 1) {
        (regions[i] as Region).endLine = (regions[i + 1] as Region).startLine - 1;
    }
    (regions[regions.length - 1] as Region).endLine = Math.max(lines.length, 1);

    const kinds = new Set(regions.map((r) => r.convention));
    if (kinds.size === 1) {
        const only = [...kinds][0] as 'modern' | 'legacy';
        return {
            path: pathName,
            convention: only,
            regions,
            reason: `every signal in this file is ${only} (${regions.map((r) => r.signal).join(', ')})`,
        };
    }
    return {
        path: pathName,
        convention: 'mixed',
        regions,
        reason:
            `both conventions appear in this file, in ${regions.length} regions. ` +
            regions.map((r) => `L${r.startLine}-${r.endLine} ${r.convention} (${r.signal})`).join('; ') +
            '. An edit follows the convention of the region it lands in, not the file as a whole.',
    };
}

/** Read and classify one file. An unreadable file is `unknown`, never guessed. */
export function classifyPath(absPath: string, displayPath = absPath): PathVerdict {
    try {
        return classifyText(displayPath, fs.readFileSync(absPath, 'utf8'));
    } catch {
        return { path: displayPath, convention: 'unknown', regions: [], reason: 'unreadable' };
    }
}

/**
 * The only question an editor actually has: what must an edit at THIS line
 * follow? Returns `null` when the file carries no signal at all — which is a
 * real answer, and different from "modern by default".
 */
export function conventionAt(verdict: PathVerdict, line: number): 'modern' | 'legacy' | null {
    for (const r of verdict.regions) {
        if (line >= r.startLine && line <= r.endLine) return r.convention;
    }
    return null;
}
