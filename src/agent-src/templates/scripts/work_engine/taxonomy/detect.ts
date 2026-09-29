/**
 * Component-granularity taxonomy detection from a project's own layout.
 *
 * Leaf module — stdlib only, NO intra-`work_engine` imports — so it can be
 * called from a directive, a skill runner, or a test without pulling the
 * engine in. Public API names stay snake_case to mirror the sibling detectors
 * (`stack/detect.ts`, `stack/runner.ts`) 1:1, per ADR-200.
 *
 * What this answers, and what it deliberately does not:
 *
 * The question is *"has this project already chosen a way to organise its
 * components by granularity, and if so what does it call the tiers?"* — never
 * *"which taxonomy should this project use?"*. The recorded answer is the
 * project's OWN tier directory names in the project's own order, joined with
 * `/`, or {@link NO_TAXONOMY}. Nothing canonical is ever written into the
 * record: a project with three tiers records three tiers, and a project whose
 * tiers are called `primitives / patterns / features` records exactly that.
 *
 * That is the whole point of the module. The suite follows a taxonomy a
 * project has chosen; it never forces one onto a project that has not.
 *
 * Why there is a lexicon at all, and what bounds it:
 *
 * Deciding *"is `components/checkout/` a granularity tier or a domain
 * folder?"* cannot be done from structure alone — both are directories full of
 * components. So {@link GRANULARITY_LEXICON} exists as a **recognition aid**:
 * an unordered set of granularity words drawn from several vocabularies, with
 * no ordering, no completeness claim, no level semantics, and no per-tier
 * rules of any kind. It is read to answer "does this bucket name look like a
 * granularity word", and for nothing else.
 *
 * In particular it is NEVER read when a component is placed: placement reads
 * the recorded tier list by name (see `./place.ts`). A project whose tiers are
 * in no lexicon still gets conformance, because a declaration in its own docs
 * outranks inference — which is the path the `declared` fixture exercises.
 *
 * Evidence rules:
 *
 * 1. **Declared beats inferred.** A `## Component taxonomy` section in the
 *    project's `DESIGN.md` naming backticked directory names wins outright,
 *    provided at least {@link MIN_TIERS} of those names exist on disk under
 *    the component root. Grounding the declaration in the filesystem keeps a
 *    stale doc from declaring a taxonomy the tree does not have.
 * 2. **Inference needs a majority, never a single hit.** At least
 *    {@link MIN_TIERS} immediate buckets under the component root must carry
 *    lexicon names, AND they must be at least {@link TIER_MAJORITY} of all
 *    buckets. One granularity-sounding folder among domain folders is a
 *    collision, not a convention — that is the false-positive direction the
 *    `collision` fixture pins.
 * 3. **Anything else is {@link NO_TAXONOMY}.** A flat component folder, a
 *    missing component folder, an unreadable tree, a non-existent root: all
 *    record `none`, and the authoring step then behaves exactly as it does
 *    without this module.
 *
 * Detection never throws. A malformed doc, a permission error, or a missing
 * directory degrades to `none` — the same recoverable-error contract as
 * `stack/detect.ts`, and for the same reason: a wrong label is recoverable
 * (the user can say so), a crash mid-dispatch is not. Degrading to `none` is
 * also the *safe* direction here, because `none` is precisely the value that
 * leaves the project's own structures untouched.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Recorded value for a project that evidences no granularity taxonomy. */
export const NO_TAXONOMY = 'none';

/**
 * Granularity words used to RECOGNISE a tier name — never to prescribe one.
 *
 * Drawn from several vocabularies rather than one, and read at exactly one
 * place: {@link _infer_tiers}, which calls `.has()` and nothing else. It
 * carries no level, no cap and no placement rule, and it is not consulted when
 * a component is placed. A project is free to use names that appear nowhere
 * here — it declares them, and the declaration wins.
 *
 * **Held ALPHABETICALLY, and that is load-bearing rather than tidy.** A
 * JavaScript `Set` iterates in INSERTION order, so "it is a Set" proves
 * nothing about ordering — an earlier draft of this file claimed exactly that
 * while the first five entries were one vocabulary's five levels in their own
 * sequence. Alphabetical order cannot be a level sequence, it is checkable,
 * and a test asserts it. Iteration order is still never read for a decision.
 */
const _LEXICON_WORDS: ReadonlyArray<string> = [
    'atom',
    'block',
    'cell',
    'composite',
    'element',
    'layout',
    'molecule',
    'organism',
    'page',
    'part',
    'particle',
    'pattern',
    'primitive',
    'template',
    'widget',
];

export const GRANULARITY_LEXICON: ReadonlySet<string> = new Set(_LEXICON_WORDS);

/**
 * Sibling folders that hold no components of their own tier.
 *
 * Excluded from the majority DENOMINATOR, never from the matches. A project
 * that keeps `hooks/`, `utils/` and `types/` next to its tiers has not stopped
 * using its tiers, but {@link COMPONENT_SUFFIXES} includes `.ts`, so those
 * folders read as buckets and drag the share down: `atoms / molecules /
 * organisms / hooks / utils / types` measured 3 of 6 and recorded `none`.
 * Three ordinary sibling folders were enough to suppress a real taxonomy.
 */
export const SUPPORT_BUCKETS: ReadonlySet<string> = new Set([
    'constant',
    'context',
    'helper',
    'hook',
    'icon',
    'lib',
    'provider',
    'store',
    'style',
    'test',
    'type',
    'util',
]);

/** Fewest tiers that can evidence a taxonomy. One name is a coincidence. */
export const MIN_TIERS = 2;

/**
 * Share of a component root's buckets that must be tier-shaped to infer one.
 *
 * **Above two thirds, which is a measurement rather than a preference.** It
 * sat at 0.6, and at 0.6 the ordinary kind-split `components/{layout, pages,
 * forms}` measured 2 of 3 = 0.67 and was recorded as the taxonomy
 * `layout/pages` — every `forms` component then a conformance gap, on a
 * project that never chose a taxonomy at all. That is this roadmap's
 * highest-ranked risk happening, so the floor is set above the 2-of-3 ratio
 * that produced it. `layout`, `page`, `block`, `element`, `part` and `cell`
 * are all ordinary folder names as well as granularity words, which is why a
 * bare share is not enough on its own and {@link SUPPORT_BUCKETS} exists.
 *
 * It is NOT set higher: `atoms / molecules / organisms` beside one support
 * folder is 3 of 4 = 0.75 and must still be found.
 */
export const TIER_MAJORITY = 0.7;

/** Directory names searched, in order, for the project's component root. */
export const COMPONENT_ROOT_CANDIDATES: ReadonlyArray<string> = [
    'src/components',
    'app/components',
    'src/lib/components',
    'src/app/components',
    'resources/js/components',
    'resources/views/components',
    'app/javascript/components',
    'components',
];

/**
 * Docs read for a declared convention, in order; the first QUALIFYING one wins.
 *
 * A doc with no `## Component taxonomy` section, or one naming fewer than
 * {@link MIN_TIERS} tiers that exist on disk, falls through to the next.
 */
export const DECLARATION_DOCS: ReadonlyArray<string> = [
    'DESIGN.md',
    'docs/DESIGN.md',
];

/** Heading that opens a declared-taxonomy section, lower-cased. */
const DECLARATION_HEADING = 'component taxonomy';

/** File suffixes that make a file look like a component. */
const COMPONENT_SUFFIXES: ReadonlyArray<string> = [
    '.tsx',
    '.jsx',
    '.vue',
    '.svelte',
    '.blade.php',
    '.ts',
    '.js',
];

/** Where the recorded taxonomy came from. */
export type TaxonomySource = 'declared' | 'inferred' | 'none';

/** What {@link detect_component_taxonomy} returns. */
export interface TaxonomyResult {
    /**
     * The single value the audit records in `state.ui_audit.component_taxonomy`
     * — the project's own tiers joined with `/`, or {@link NO_TAXONOMY}.
     */
    taxonomy: string;
    /**
     * The same tiers as a list.
     *
     * `declared` carries the DOCUMENT's order, which is the project's own.
     * `inferred` carries alphabetical order, because bucket names arrive
     * sorted and no filesystem fact states a level sequence. It reads as one
     * for `atoms/molecules/organisms` by coincidence and would not for
     * `pages/templates/organisms`. Nothing downstream reads the order.
     */
    tiers: string[];
    /** Component root relative to the project root, or `null` when none. */
    component_root: string | null;
    /** Which rule produced the answer. */
    source: TaxonomySource;
    /** Human-readable trace of what was read, for the audit's output. */
    evidence: string[];
}

function _none(evidence: string[], component_root: string | null = null): TaxonomyResult {
    return {
        taxonomy: NO_TAXONOMY,
        tiers: [],
        component_root,
        source: 'none',
        evidence,
    };
}

/**
 * Detect the component-granularity taxonomy a project evidences.
 *
 * @param project_root Absolute or relative path to the project root.
 * @returns A {@link TaxonomyResult}; never throws.
 */
export function detect_component_taxonomy(project_root: string): TaxonomyResult {
    const evidence: string[] = [];
    let component_root: string | null;
    try {
        component_root = _find_component_root(project_root);
    } catch {
        return _none(['component root unreadable']);
    }
    if (component_root === null) {
        evidence.push(
            `no component root under ${_display(project_root)} ` +
                `(searched ${COMPONENT_ROOT_CANDIDATES.length} conventional paths)`,
        );
        return _none(evidence);
    }
    evidence.push(`component root: ${component_root}`);

    let buckets: string[];
    try {
        buckets = _component_buckets(path.join(project_root, component_root));
    } catch {
        return _none([...evidence, 'component root unreadable'], component_root);
    }

    // `_declared_tiers` already applies the MIN_TIERS floor and returns `[]`
    // below it, so re-testing the floor here would be a second copy of one
    // invariant — the shape this branch removed from `apply.ts` for masking a
    // regression in its own sibling. One owner; this asks only "was there one".
    const declared = _declared_tiers(project_root, buckets, evidence);
    if (declared.length > 0) {
        return {
            taxonomy: declared.join('/'),
            tiers: declared,
            component_root,
            source: 'declared',
            evidence,
        };
    }

    const inferred = _infer_tiers(buckets, evidence);
    if (inferred.length === 0) {
        return _none(evidence, component_root);
    }
    return {
        taxonomy: inferred.join('/'),
        tiers: inferred,
        component_root,
        source: 'inferred',
        evidence,
    };
}

/** First conventional component directory that exists, or `null`. */
function _find_component_root(project_root: string): string | null {
    for (const candidate of COMPONENT_ROOT_CANDIDATES) {
        const full = path.join(project_root, ...candidate.split('/'));
        let st: fs.Stats;
        try {
            st = fs.statSync(full);
        } catch {
            continue;
        }
        if (st.isDirectory()) {
            return candidate;
        }
    }
    return null;
}

/**
 * Immediate subdirectories of the component root that actually hold components.
 *
 * A directory with no component-shaped file anywhere beneath it is not a
 * bucket — it is a stray folder, and counting it would drag the majority test
 * around for reasons that have nothing to do with the project's convention.
 */
function _component_buckets(root: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        if (_holds_component(path.join(root, entry.name), 0)) {
            out.push(entry.name);
        }
    }
    out.sort();
    return out;
}

/** True when a component-shaped file sits at or under `dir` (depth-capped). */
function _holds_component(dir: string, depth: number): boolean {
    if (depth > 3) return false;
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return false;
    }
    for (const entry of entries) {
        if (entry.isFile()) {
            if (COMPONENT_SUFFIXES.some((s) => entry.name.endsWith(s))) {
                return true;
            }
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
            if (_holds_component(path.join(dir, entry.name), depth + 1)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Tiers declared in the project's own docs, grounded against the tree.
 *
 * Reads the `## Component taxonomy` section of the first
 * {@link DECLARATION_DOCS} hit and keeps the backticked names that exist as
 * buckets. Order is the document's, because that is the project's own order.
 */
function _declared_tiers(
    project_root: string,
    buckets: string[],
    evidence: string[],
): string[] {
    const known = new Set(buckets);
    for (const doc of DECLARATION_DOCS) {
        let body: string;
        try {
            body = fs.readFileSync(path.join(project_root, ...doc.split('/')), 'utf8');
        } catch {
            continue;
        }
        const section = _taxonomy_section(body);
        if (section === null) {
            evidence.push(`${doc}: no \`## Component taxonomy\` section`);
            continue;
        }
        const named: string[] = [];
        for (const line of section.split(/\r?\n/u)) {
            // Only a list item declares a tier. A backticked name inside a
            // prose sentence is a mention — the `legacy` fixture says in prose
            // that it is NOT a tier, and a parser that scanned the whole
            // section would enrol it on the strength of the backticks alone.
            // `**` / `__` may lead the name: `- **\`alpha\`** — ...` is a
            // completely ordinary way to write this list, and a regex that
            // demanded the backtick lead dropped it silently.
            const item = /^\s*(?:[-*+]|\d+[.)])\s+(?:\*\*|__)?`([^`\n]+)`/u.exec(line);
            if (item === null) continue;
            const name = (item[1] ?? '').trim();
            // Grounded against the tree: a declaration cannot conjure a tier
            // the project has not created.
            if (name !== '' && known.has(name) && !named.includes(name)) {
                named.push(name);
            }
        }
        if (named.length >= MIN_TIERS) {
            evidence.push(`${doc}: declares ${named.length} tiers, all present on disk`);
            return named;
        }
        evidence.push(
            `${doc}: \`## Component taxonomy\` names ${named.length} tier(s) ` +
                `present on disk — below the ${MIN_TIERS}-tier floor, so not a declaration`,
        );
    }
    return [];
}

/** Body of the `## Component taxonomy` section, or `null` when absent. */
function _taxonomy_section(body: string): string | null {
    const lines = body.split(/\r?\n/u);
    let start = -1;
    let level = 0;
    for (let i = 0; i < lines.length; i += 1) {
        const m = /^(#{1,6})\s+(.*)$/u.exec(lines[i] as string);
        if (m === null) continue;
        const heading = (m[2] ?? '').trim().toLowerCase().replace(/[:.]+$/u, '');
        if (start === -1) {
            if (heading === DECLARATION_HEADING) {
                start = i + 1;
                level = (m[1] as string).length;
            }
            continue;
        }
        if ((m[1] as string).length <= level) {
            return lines.slice(start, i).join('\n');
        }
    }
    return start === -1 ? null : lines.slice(start).join('\n');
}

/**
 * Tiers inferred from bucket names, or `[]` when the evidence is too thin.
 *
 * The only place {@link GRANULARITY_LEXICON} is consulted.
 */
function _infer_tiers(buckets: string[], evidence: string[]): string[] {
    if (buckets.length === 0) {
        evidence.push('component root has no sub-directories — flat layout');
        return [];
    }
    const matched = buckets.filter((b) => GRANULARITY_LEXICON.has(_singular(b)));
    const counted = buckets.filter((b) => !SUPPORT_BUCKETS.has(_singular(b)));
    if (counted.length === 0) {
        evidence.push('every bucket is a support folder — no tiers to weigh');
        return [];
    }
    const share = matched.length / counted.length;
    if (matched.length < MIN_TIERS || share < TIER_MAJORITY) {
        evidence.push(
            `${matched.length} of ${counted.length} weighed buckets carry granularity ` +
                `names (need >= ${MIN_TIERS} and >= ${Math.round(TIER_MAJORITY * 100)}%; ` +
                `${buckets.length - counted.length} support folder(s) not weighed) — ` +
                'reads as domain folders, not a taxonomy',
        );
        return [];
    }
    evidence.push(
        `${matched.length} of ${counted.length} weighed buckets carry granularity ` +
            `names (${buckets.length - counted.length} support folder(s) not weighed) — ` +
            'inferred from layout',
    );
    return matched;
}

/**
 * Lower-case a bucket name and drop a trailing plural `s`.
 *
 * Deliberately naive: it exists so `atoms` matches `atom`, not to be a
 * morphology engine. A name it mis-normalises simply fails to match, which
 * lands on `none` — the safe direction.
 */
function _singular(name: string): string {
    const lower = name.toLowerCase();
    return lower.endsWith('s') && lower.length > 2 ? lower.slice(0, -1) : lower;
}

/** Trim a path for an evidence line so the trace stays readable. */
function _display(p: string): string {
    const base = path.basename(p);
    return base === '' ? p : base;
}

/**
 * CLI entry: print the detection result for a project root as JSON.
 *
 * `existing-ui-audit` § 1b tells the agent to RUN this file, so it has to be
 * runnable. Without this block `npx tsx .../detect.ts` exited 0 and printed
 * nothing, and an agent following the instruction literally got silence and
 * then had to invent the two state keys the audit is supposed to record.
 *
 * ```bash
 * npx tsx scripts/work_engine/taxonomy/detect.ts [--root <dir>]
 * ```
 *
 * Defaults to the process CWD. Exits 0 whichever answer it reaches: `none` is
 * a real answer here, not a failure, and an exit code that said otherwise
 * would push a caller toward treating a no-taxonomy project as an error.
 */
export function main(argv: ReadonlyArray<string>): number {
    const at = argv.indexOf('--root');
    const root = at !== -1 && at + 1 < argv.length ? (argv[at + 1] as string) : process.cwd();
    process.stdout.write(`${JSON.stringify(detect_component_taxonomy(root), null, 2)}\n`);
    return 0;
}

// Only when this module is the process entry, never on import. tsx sets
// `import.meta.url` to the entry file URL.
if (import.meta.url === `file://${process.argv[1]}`) {
    process.exitCode = main(process.argv.slice(2));
}
