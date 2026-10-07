/**
 * The static import closure of the hook dispatcher, and the class of each
 * module in it.
 *
 * `check_kernel_edit_ratified` derives part of its watched set from this
 * reading: a module the dispatcher reaches that decides an exit code needs a
 * ratification record, whichever file the logic currently lives in. A hand
 * list stayed correct until one function moved files; a derived set follows it.
 *
 * Deliberately static and deliberately narrow, so the reading is reproducible
 * from a tree alone:
 *
 *   - only RELATIVE specifiers (`./x.js`, `../_lib/y.js`) are followed —
 *     packages and `node:` builtins are not this repository's plumbing;
 *   - `import … from`, `export … from` and side-effect `import '…'` count;
 *     dynamic `import()` does not, because its target is not decidable here;
 *   - the walk STOPS at the concern table. Every module `concern_registry.ts`
 *     imports is a concern, classed `concern` and not walked into, because
 *     concerns stay outside the fence — a governance concern is gated by its
 *     own `block_*` pattern, and widening to every concern would turn routine
 *     edits into record-carrying ones.
 *
 * Classes, decided from the module's own source text:
 *
 *   - `verdict` — names an exit-code constant (`EXIT_ALLOW`, `EXIT_BLOCK`,
 *     `EXIT_WARN`, `EXIT_USAGE`), or exports a function whose name says it
 *     decides a refusal (`deny…`, `…block…`, `…verdict…`, `…fail_closed…`).
 *     The constants are how the dispatcher turns a crash, a timeout or a stdin
 *     failure into the code a host acts on; the second signal catches a policy
 *     that returns a boolean the dispatcher then maps — `denyOnStdinFailure`
 *     names no constant and still decides whether a failed read refuses.
 *   - `payload` — names the payload a concern receives (`payload`, `stdin`).
 *   - `neither` — everything else (timing, state I/O, logging).
 *   - `concern` — imported by the concern table; outside the fence.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** The dispatcher, repo-relative. The closure's root. */
export const DISPATCHER_PATH = 'src/scripts/hooks/dispatch_hook.ts';

/** The concern table. Its imports are concerns, the walk's boundary. */
export const CONCERN_REGISTRY_PATH = 'src/scripts/hooks/concern_registry.ts';

export type ModuleClass = 'verdict' | 'payload' | 'neither' | 'concern';

export interface ClosureEntry {
    /** Repo-relative POSIX path. */
    path: string;
    class: ModuleClass;
}

const EXIT_CONSTANT_RE = /\bEXIT_(?:ALLOW|BLOCK|WARN|USAGE)\b/;
const VERDICT_EXPORT_RE =
    /\bexport\s+(?:async\s+)?(?:function\s+|const\s+)([A-Za-z_$][\w$]*)/g;
const VERDICT_NAME_RE = /deny|block|verdict|fail_?closed|refus/i;
const PAYLOAD_RE = /\b(?:payload|stdin)\b/i;

/**
 * Relative specifiers in a module's source. Comments are stripped first so a
 * commented-out import does not count as an edge.
 */
export function relativeSpecifiers(source: string): string[] {
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const out: string[] = [];
    const re = /(?:\bimport\s+(?:type\s+)?(?:[\s\S]*?\bfrom\s*)?|\bexport\s+(?:type\s+)?[\s\S]*?\bfrom\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(stripped)) !== null) {
        if (m[1] !== undefined) {
            out.push(m[1]);
        }
    }
    return out;
}

/** Resolve a `.js` specifier from `fromRel` to the `.ts` source on disk. */
function resolveSpecifier(root: string, fromRel: string, spec: string): string | null {
    const base = path.posix.join(path.posix.dirname(fromRel), spec);
    const candidates = [base.replace(/\.js$/, '.ts'), base, `${base}.ts`, `${base}/index.ts`];
    for (const c of candidates) {
        const norm = path.posix.normalize(c);
        if (fs.existsSync(path.join(root, norm)) && fs.statSync(path.join(root, norm)).isFile()) {
            return norm;
        }
    }
    return null;
}

/** Classify one module from its source text. Never returns `concern`. */
export function classifySource(source: string): Exclude<ModuleClass, 'concern'> {
    if (EXIT_CONSTANT_RE.test(source)) {
        return 'verdict';
    }
    for (const m of source.matchAll(VERDICT_EXPORT_RE)) {
        if (VERDICT_NAME_RE.test(m[1] ?? '')) {
            return 'verdict';
        }
    }
    if (PAYLOAD_RE.test(source)) {
        return 'payload';
    }
    return 'neither';
}

/**
 * Walk the closure from the dispatcher under `root`. Returns `[]` when the
 * dispatcher is absent, so a fixture tree without one yields an empty set
 * rather than an error. The dispatcher itself is not in the result — it is
 * already watched by name.
 */
export function dispatchImportClosure(root: string, entry: string = DISPATCHER_PATH): ClosureEntry[] {
    if (!fs.existsSync(path.join(root, entry))) {
        return [];
    }
    const seen = new Map<string, ModuleClass>();
    const queue: string[] = [entry];
    const visited = new Set<string>();
    while (queue.length > 0) {
        const rel = queue.shift() as string;
        if (visited.has(rel)) {
            continue;
        }
        visited.add(rel);
        const source = fs.readFileSync(path.join(root, rel), 'utf8');
        if (rel !== entry) {
            seen.set(rel, classifySource(source));
        }
        const isRegistry = rel === CONCERN_REGISTRY_PATH;
        for (const spec of relativeSpecifiers(source)) {
            const target = resolveSpecifier(root, rel, spec);
            if (target === null || target === entry) {
                continue;
            }
            if (isRegistry) {
                if (!seen.has(target)) {
                    seen.set(target, 'concern');
                }
                visited.add(target);
                continue;
            }
            if (!visited.has(target)) {
                queue.push(target);
            }
        }
    }
    return [...seen.entries()]
        .map(([p, c]) => ({ path: p, class: c }))
        .sort((a, b) => a.path.localeCompare(b.path));
}

/** The verdict-deciding modules of the closure — the part the gate watches. */
export function verdictModules(root: string): string[] {
    return dispatchImportClosure(root)
        .filter((e) => e.class === 'verdict')
        .map((e) => e.path);
}
