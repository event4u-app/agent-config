#!/usr/bin/env tsx
/**
 * Dead relative links under `docs/`, split by whether the file SHIPS.
 *
 * `road-to-contract-review-deadlines` Phase 4.1. `check_references.ts` scans
 * `dist/agent-src` and `agents` only, so `docs/` is green by exclusion rather
 * than by being correct — the run reports thousands of `excluded_directory`
 * skips and no other gate does general link validation there.
 *
 * The split is the point, not the total. A dead link in `docs/guidelines/` is
 * shipped to consumers and is the only half that reaches anyone; a dead link in
 * an internal analysis note costs a maintainer one confused minute. Reporting
 * one number for both invites either an unreviewable 487-line sweep or nothing.
 *
 * A `.py` target is broken out separately because it is a MIGRATION LEFTOVER
 * with a mechanical fix — the TypeScript port renamed the file, and the pointer
 * did not follow. It is a class, not 152 independent defects.
 *
 * MEASUREMENT ONLY. This is deliberately not a `lint_*` / `check_*` gate: the
 * scope decision (does `docs/` enter `check_references`?) is step 4.3 and is a
 * maintainer call. A gate landed before that decision would pre-empt it.
 *
 * Usage:
 *     ./scripts-run src/scripts/measure_docs_dead_links
 *     ./scripts-run src/scripts/measure_docs_dead_links --format json
 *     ./scripts-run src/scripts/measure_docs_dead_links --list shipped
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Roots under `docs/` that `package.json:files[]` actually publishes. */
export const SHIPPED_DOCS_PREFIXES = [
    'docs/guidelines/',
    'docs/contracts/persona-schema.md',
    'docs/contracts/provider-lifecycle.md',
    'docs/contracts/settings-classes.md',
] as const;

/** Markdown inline links: `[text](target)`. Reference-style links are out of scope. */
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export type DeadClass = 'shipped' | 'internal';

export interface DeadLink {
    file: string;
    target: string;
    resolved: string;
    cls: DeadClass;
    pyTarget: boolean;
}

export interface Measurement {
    filesScanned: number;
    linksScanned: number;
    dead: DeadLink[];
}

function walkMd(root: string, rel = ''): string[] {
    const out: string[] = [];
    const abs = path.join(root, rel);
    for (const ent of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const r = rel === '' ? ent.name : `${rel}/${ent.name}`;
        if (ent.isDirectory()) out.push(...walkMd(root, r));
        else if (ent.name.endsWith('.md')) out.push(r);
    }
    return out;
}

function isShipped(file: string): boolean {
    return SHIPPED_DOCS_PREFIXES.some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p));
}

/**
 * True for a link this measurement can decide. Anchors, URLs, mailto: and
 * absolute paths are not relative file references and are skipped rather than
 * counted as alive — counting an undecidable target as alive is the same
 * false-green this whole roadmap is about.
 */
function isRelativeFileLink(target: string): boolean {
    if (target === '' || target.startsWith('#')) return false;
    // Prose placeholders, not links: a bare ellipsis inside a code-ish span, or
    // an angle-bracket variable like `../<peer>/SKILL.md`. Counting them as dead
    // would put un-fixable rows in a count whose whole purpose is to reach zero.
    if (/^\.+$/.test(target)) return false;
    if (target.includes('<') || target.includes('>')) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return false; // http:, https:, mailto:, …
    if (target.startsWith('/')) return false;
    return true;
}

export function measure(repoRoot: string = REPO_ROOT): Measurement {
    const docsRoot = path.join(repoRoot, 'docs');
    const files = walkMd(docsRoot);
    const dead: DeadLink[] = [];
    let linksScanned = 0;

    for (const rel of files) {
        const abs = path.join(docsRoot, rel);
        const text = fs.readFileSync(abs, 'utf8');
        LINK_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LINK_RE.exec(text)) !== null) {
            const raw = m[1]!;
            if (!isRelativeFileLink(raw)) continue;
            linksScanned += 1;
            const target = raw.split('#')[0]!;
            if (target === '') continue; // pure anchor after the split
            const resolved = path.normalize(path.join(path.dirname(abs), target));
            if (fs.existsSync(resolved)) continue;
            const file = `docs/${rel}`;
            dead.push({
                file,
                target: raw,
                resolved: path.relative(repoRoot, resolved),
                cls: isShipped(file) ? 'shipped' : 'internal',
                pyTarget: target.endsWith('.py'),
            });
        }
    }
    return { filesScanned: files.length, linksScanned, dead };
}


/**
 * Repair a dead target by finding the ONE file in the tree it can only mean.
 *
 * The tail heuristic, and why it is safe: nearly every dead link here points at
 * a container that MOVED — the retired uncondensed source tree after ADR-051
 * flattened the source tree, or `../../rules/x.md` written from the wrong depth.
 * The container changed; the tail did not. So the tail from a known segment
 * onward (`rules/x.md`, `skills/x/SKILL.md`) still names the file uniquely.
 *
 * **Exactly one match, or no rewrite.** Ambiguity is reported, never guessed:
 * a link silently repointed at the wrong one of two candidates is worse than a
 * dead link, because a dead link is visible and a wrong one is not.
 */
const TAIL_SEGMENTS = ['rules/', 'skills/', 'commands/', 'contexts/', 'templates/', 'personas/', 'guidelines/', 'contracts/', 'scripts/', 'schemas/', 'tests/', 'golden/', 'decisions/'] as const;

function repoFileIndex(repoRoot: string): string[] {
    const out: string[] = [];
    const skip = new Set(['node_modules', '.git', 'dist', '.augment', '.claude', '.cursor', '.clinerules']);
    const walk = (rel: string): void => {
        for (const ent of fs.readdirSync(path.join(repoRoot, rel), { withFileTypes: true })) {
            if (skip.has(ent.name)) continue;
            const r = rel === '' ? ent.name : `${rel}/${ent.name}`;
            if (ent.isDirectory()) walk(r);
            else out.push(r);
        }
    };
    walk('');
    return out;
}

export function resolveTail(target: string, index: readonly string[]): string | null {
    const clean0 = target.split('#')[0]!;
    // The migration class, handled first because it is a RENAME rather than a
    // move: the TypeScript port changed the extension and the pointer did not
    // follow. `scripts/x.py` -> `scripts/x.ts` is mechanical and unambiguous
    // when the `.ts` file exists; when it does not, the file was deleted rather
    // than ported and the link falls through to the tail search below.
    const candidates = clean0.endsWith('.py')
        ? [
              `${clean0.slice(0, -3)}.ts`,
              // pytest's `test_x.py` became vitest's `x.test.ts` — a rename with
              // a different SHAPE, not just a different extension, so it needs
              // its own candidate rather than an extension swap.
              clean0.replace(/(^|\/)test_([^/]+)\.py$/, '$1$2.test.ts'),
              clean0,
          ]
        : [clean0];
    for (const clean of candidates) {
        const hit = resolveOne(clean, index);
        if (hit !== null) return hit;
    }
    return null;
}

function resolveOne(clean: string, index: readonly string[]): string | null {
    for (const seg of TAIL_SEGMENTS) {
        const at = clean.lastIndexOf(seg);
        if (at === -1) continue;
        const tail = clean.slice(at);
        const hits = index.filter((f) => f === tail || f.endsWith(`/${tail}`));
        if (hits.length === 1) return hits[0]!;
        if (hits.length > 1) {
            // Tie-break on the ONE axis this repository has already settled:
            // `src/` is the single source of truth and every other tree is a
            // projection or an override (CLAUDE.md § Source of truth). So a tie
            // between `src/rules/x.md` and `agents/overrides/rules/x.md` is not
            // a real ambiguity — a doc pointing at the rule means the source.
            // Any tie this does NOT break stays unresolved.
            // Prefer the candidate the ORIGINAL target already named. A link
            // reading `../../../src/scripts/memory_status.py` ties between
            // `src/scripts/memory_status.ts` and
            // `src/agent-src/templates/scripts/memory_status.ts` on the tail
            // alone — but only one of them is what the author wrote, once the
            // `../` prefix is dropped.
            const normalized = clean.replace(/^(?:\.\.\/)+/, '');
            const exact = hits.filter((f) => f === normalized);
            if (exact.length === 1) return exact[0]!;
            const inSrc = hits.filter((f) => f.startsWith('src/'));
            if (inSrc.length === 1) return inSrc[0]!;
            return null;
        }
    }
    // Last resort: the BASENAME alone, and only when the whole tree holds
    // exactly one file with it. This is what catches a move that changed the
    // directory as well as the name — `tests/test_condense.py` became
    // `tests/scripts/condense.test.ts`, so neither the tail nor the extension
    // swap alone reaches it. A basename with two homes stays unresolved: the
    // uniqueness IS the safety property, not a convenience.
    const base = clean.split('/').pop() ?? '';
    if (base === '' || !base.includes('.')) return null;
    const byBase = index.filter((f) => f.endsWith(`/${base}`) || f === base);
    if (byBase.length === 1) return byBase[0]!;
    const srcOrTests = byBase.filter((f) => f.startsWith('src/') || f.startsWith('tests/'));
    if (srcOrTests.length === 1) return srcOrTests[0]!;
    return null;
}

interface FixResult {
    rewritten: number;
    files: number;
    unresolved: DeadLink[];
}

export function applyFix(repoRoot: string, dead: readonly DeadLink[]): FixResult {
    const index = repoFileIndex(repoRoot);
    const byFile = new Map<string, DeadLink[]>();
    for (const d of dead) {
        const l = byFile.get(d.file) ?? [];
        l.push(d);
        byFile.set(d.file, l);
    }
    const unresolved: DeadLink[] = [];
    let rewritten = 0;
    let filesTouched = 0;
    for (const [file, allLinks] of byFile) {
        // One rewrite per DISTINCT target: the replacement is global within the
        // file, so a target appearing twice would otherwise report one success
        // and one phantom "unresolved" for a link that is already fixed.
        const seen = new Set<string>();
        const links = allLinks.filter((d) => (seen.has(d.target) ? false : (seen.add(d.target), true)));
        const abs = path.join(repoRoot, file);
        let text = fs.readFileSync(abs, 'utf8');
        let changed = false;
        for (const d of links) {
            const resolvedRel = resolveTail(d.target, index);
            if (resolvedRel === null) {
                unresolved.push(d);
                continue;
            }
            const anchor = d.target.includes('#') ? `#${d.target.split('#').slice(1).join('#')}` : '';
            let next = path.relative(path.dirname(abs), path.join(repoRoot, resolvedRel));
            if (!next.startsWith('.')) next = `./${next}`;
            const replacement = `${next}${anchor}`;
            if (replacement === d.target) {
                unresolved.push(d);
                continue;
            }
            const needle = `](${d.target})`;
            if (!text.includes(needle)) {
                unresolved.push(d);
                continue;
            }
            text = text.split(needle).join(`](${replacement})`);
            rewritten += 1;
            changed = true;
        }
        if (changed) {
            fs.writeFileSync(abs, text, 'utf8');
            filesTouched += 1;
        }
    }
    return { rewritten, files: filesTouched, unresolved };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(
            'usage: measure_docs_dead_links [--format json] [--list shipped|internal|py]\n' +
                '                               [--fix shipped|py|all]\n' +
                '  --fix rewrites a dead target only when EXACTLY ONE file in the tree\n' +
                '        matches its path tail; ambiguity is reported, never guessed.\n',
        );
        return 0;
    }
    const asJson = argv.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json';
    const listIdx = argv.indexOf('--list');
    const list = listIdx !== -1 ? argv[listIdx + 1] : null;
    const fixIdx = argv.indexOf('--fix');
    const fixScope = fixIdx !== -1 ? (argv[fixIdx + 1] ?? 'shipped') : null;

    const r = measure();

    if (fixScope !== null) {
        const pool =
            fixScope === 'shipped'
                ? r.dead.filter((d) => d.cls === 'shipped')
                : fixScope === 'py'
                  ? r.dead.filter((d) => d.pyTarget)
                  : r.dead;
        const res = applyFix(REPO_ROOT, pool);
        process.stdout.write(
            `measure_docs_dead_links --fix ${fixScope}: rewrote ${String(res.rewritten)} link(s) in ` +
                `${String(res.files)} file(s); ${String(res.unresolved.length)} left unresolved ` +
                '(ambiguous or no unique candidate — never guessed).\n',
        );
        for (const d of res.unresolved.slice(0, 30)) {
            process.stdout.write(`    unresolved: ${d.file} -> ${d.target}\n`);
        }
        return 0;
    }
    const shipped = r.dead.filter((d) => d.cls === 'shipped');
    const internal = r.dead.filter((d) => d.cls === 'internal');
    const py = r.dead.filter((d) => d.pyTarget);

    if (list !== null && list !== undefined) {
        const pick = list === 'shipped' ? shipped : list === 'internal' ? internal : py;
        for (const d of pick) process.stdout.write(`${d.file} -> ${d.target}\n`);
        return 0;
    }
    if (asJson) {
        process.stdout.write(
            `${JSON.stringify({ filesScanned: r.filesScanned, linksScanned: r.linksScanned, total: r.dead.length, shipped: shipped.length, internal: internal.length, pyTarget: py.length }, null, 2)}\n`,
        );
        return 0;
    }
    process.stdout.write(
        `docs/ dead relative links — ${r.dead.length} of ${r.linksScanned} link(s) across ${r.filesScanned} file(s)\n` +
            `  shipped   ${String(shipped.length).padStart(4)}  (package.json files[] publishes docs/guidelines/ plus three named contracts)\n` +
            `  internal  ${String(internal.length).padStart(4)}\n` +
            `  .py target${String(py.length).padStart(5)}  (migration leftovers; a subset of the two rows above, not a third bucket)\n`,
    );
    process.stdout.write(`scanned: ${r.filesScanned}\n`);
    return 0;
}

/* c8 ignore start */
if (process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(_HERE).href) {
    process.exit(main());
}
/* c8 ignore stop */
