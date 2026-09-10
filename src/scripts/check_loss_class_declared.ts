#!/usr/bin/env tsx
/**
 * An undeclared lossy transform on a model-facing path fails
 * (`road-to-runtime-context-floors` step 3.2).
 *
 * STRICTNESS — decided, not assumed
 * ---------------------------------
 * Council 2026-08-28 (2/2 convergent, anthropic + openai, 2 rounds) resolved the
 * `how-strict-the-loss-class-lint-is` blocker as option (b): FAIL on transforms
 * whose output reaches the model, WARN elsewhere. Option (a) — fail everywhere in
 * `src/` — buys a first-run backlog whose usual answer is a broad allowlist, and
 * this repository has a measured history of an allowlist emptying a gate. Option
 * (c) — warn everywhere, ratchet later — is the shape this repository has
 * measurably never ratcheted.
 *
 * Both seats added the same refinement, adopted here: **unknown reachability is
 * classified as model-reaching.** Ambiguity must not become an accidental
 * exemption.
 *
 * WHAT COUNTS AS MODEL-FACING
 * ---------------------------
 * An EMITTER is a hook concern script whose code emits a context payload. A
 * TARGET is any module that emitter reaches through relative imports —
 * transitively, the emitter itself included — whose code applies a lossy
 * operation to content. The emitter half and the lossy half are read from
 * different files on purpose: a `_lib` module does not emit, the concern does,
 * so requiring both halves of one file is what kept the corpus at one and then
 * at zero.
 *
 * Both halves are read from code with comments stripped — ALL comments, a
 * trailing `// truncate the rows` included, since one scan classifies every
 * character rather than two regexes guessing at each other's boundaries (see
 * `scanSource`). The first cut of this detector matched `truncat` inside three
 * docblocks that describe truncation without performing any. The LOSSY half
 * additionally blanks string, template and regex literals, and widening the
 * walk is what made that necessary — measured over the reached set, the raw
 * patterns matched a SQLite `PRAGMA wal_checkpoint(TRUNCATE)`, the settings key
 * `'knowledge.global_sharing.redaction.enabled'`, and a destructive-command
 * detector's own `/truncate\s+table/` regex. None of the three shortens
 * anything. A gate that fires on data ABOUT an operation rather than on the
 * operation is how a real corpus becomes a pro-forma one, each member carrying
 * a declaration nobody meant.
 *
 * The EMIT half deliberately keeps reading literals: a concern that writes its
 * payload key as `'additionalContext'` is emitting, and blanking that string
 * would drop a real emitter — measured, it dropped six of seven.
 *
 * WHAT IT MEASURES, AND HOW THAT NUMBER MOVED
 * -------------------------------------------
 * MATCHED IS NOT LOSSY, and the headline used to say otherwise. The detector
 * establishes a MATCH; the module's own DECLARATION says whether anything is
 * lost, and `exact` says nothing is. Of the five modules below, four declare a
 * lossy class and one declares `exact`, so "5 lossy modules" overstated the
 * real lossy corpus by one. Every count here now reads "matched".
 *
 * Measured at landing (emitter-only): **1** module — `hot_context_hook`, the
 * `ephemeral-lossy` exemplar the contract classifies. Measured 2026-09-09 after
 * road-to-continuity-writer-activation step 3.1 retired that module's cache
 * half: **0**. The scanned corpus was unchanged at 58 hook scripts; the matched
 * subset was empty, so the gate passed over nothing — a hole, not a clean bill,
 * tracked as blocker `loss-class-corpus-is-empty-after-hot-context`.
 *
 * Measured 2026-09-10 with the walk widened past concern scripts: **58 hook
 * scripts scanned, 7 of them emitters, 73 modules reached, 5 of those
 * matched** — four lossy plus one `exact`:
 *   - `_lib/session_index_trust.ts` — the surviving 30-row cap the blocker named
 *   - `session_memory_index.ts` — which applies it
 *   - `memory_lookup.ts` — the token-budget cut
 *   - `_lib/self_repair.ts` — evidence sanitization (but see below)
 *   - `ai_council/redact_low_impact_entry.ts` — `exact`: it refuses rather than
 *     rewrites, so no byte of its input is dropped or replaced
 * The retired exemplar is not among them and does not come back.
 *
 * `exact` IS A SILENCER, AND IT IS UNVERIFIABLE HERE. `parseLossDeclaration`
 * accepts it and `isProblem` is false, so declaring `exact` turns any future
 * over-match green without the detector learning anything. Nothing in this gate
 * checks that an `exact` module is byte-preserving — that is a reviewer's
 * judgement, and this one was reviewed: the redactor returns a verdict, never a
 * rewritten string. Treat a NEW `exact` declaration as a detector defect to fix
 * rather than a declaration to accept.
 *
 * ONE CORPUS MEMBER IS MATCHED FOR THE WRONG REASON. `_lib/self_repair.ts` is
 * declared `ephemeral-lossy` for `sanitizeEvidence`, which hard-cuts at
 * `MAX_EVIDENCE` — and the cap pattern CANNOT SEE that constant: `MAX_EVIDENCE`
 * fails `(?:WORD|CHAR|ROW|MAX)_(?:CAP|CHARS|LEN|WORDS)` because the unit word
 * must be followed by a size noun. What actually matches is `\bredact`, against
 * the `redact_low_impact_entry` identifier the module imports for its EGRESS
 * gate. Delete or rename that import and a module that still cuts content
 * leaves the corpus silently.
 *
 * Widening the pattern to any `MAX_<WORD>` was MEASURED before it was refused,
 * 2026-09-10 over the same 73-module reach: it takes the corpus from 5 to
 * **12**, admitting `MAX_RETRIES` (a retry budget), `DEFAULT_MAX_TOKENS` (an
 * API parameter), `MAX_PATHS`, `MAX_ENTRIES` and three `*_MAX_BYTES` retention
 * settings — seven constants, not one of them evidence that content is cut.
 * Seven pro-forma declarations to catch one real cap is the trade this gate's
 * own docstring argues against two paragraphs up, so the gap is disclosed
 * rather than closed. The honest position: this member's declaration is right
 * and the detector's reason for it is not.
 *
 * One pattern moved with the walk, and only one. `\b(?:WORD|CHAR|MAX)_…`
 * required the cap constant to BEGIN with a unit word, so it saw `WORD_CAP` and
 * could not see `SESSION_INDEX_ROW_CAP` — the exact constant the blocker names.
 * The prefix is now optional and `ROW` joined the unit list; everything the old
 * form matched, the new form still matches. Deliberately NOT generalized to any
 * `_CAP` at all: that also matches `security_lint.PRAGMA_CAP`, a lint budget
 * that shortens no content, which is the pro-forma member this paragraph exists
 * to keep out.
 *
 * Exit codes: 0 clean (warnings allowed) · 1 an undeclared model-facing
 * transform · 2 misuse / unreadable manifest.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_loss_class_declared [--root <dir>] [--json] [--quiet]
 *   ./scripts-run src/scripts/check_loss_class_declared --self-test
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { isProblem, parseLossDeclaration, type DeclarationProblem } from './_lib/loss_class.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');

/** Slots whose output can reach the model. */
const MODEL_FACING_SLOTS = [
    'session_start',
    'user_prompt_submit',
    'pre_compact',
    'stop',
    'post_tool_use',
    'pre_tool_use',
] as const;

/** Emitting a context payload — the "reaches the model" half. */
const EMIT_PATTERNS = [/\bcontext\s*:/, /additionalContext/, /hookSpecificOutput/];

/**
 * Shortening, redacting or capping content — the "lossy" half.
 *
 * The third pattern names a CAP CONSTANT. Its unit vocabulary is the load-bearing
 * part, not the leading position: an optional qualifying prefix lets it see
 * `SESSION_INDEX_ROW_CAP` while `PRAGMA_CAP` — a count of lint pragmas, not of
 * content — stays out.
 */
const LOSSY_PATTERNS = [
    /\bredact/i,
    /\btruncat/i,
    /\b(?:[A-Z0-9]+_)*(?:WORD|CHAR|ROW|MAX)_(?:CAP|CHARS|LEN|WORDS)\b/,
];

/**
 * Relative module specifiers, in every form this tree actually writes them.
 *
 * The extension is no longer part of the pattern — `resolveSpecifier` decides
 * what a specifier resolves to, and it accepts only code files, so an
 * extensionless import is a reach and `'./notes.md'` still is not.
 */
// Anchored on an import or call position rather than matching any quoted
// `./`-shaped string anywhere. Unanchored, a path in a prose message could pull
// an unimported module into the gated population — over-match, so it costs a
// declaration rather than a silent green, but a corpus member nobody imports is
// the pro-forma shape this gate refuses. Measured: the corpus is the same 5
// either way, so the narrowing loses no real edge, `from`/`(`/`,` still covers
// static imports and every `createRequire` alias this tree writes.
const IMPORT_SPEC = /(?:from\s*|[(,]\s*)['"](\.\.?\/[^'"\n]*)['"]/g;

export interface LossFinding {
    concern: string;
    /** The concern's own script — the emitter the module was reached from. */
    script: string;
    /** The reached module that applies the lossy operation. */
    module: string;
    tier: 'fail' | 'warn';
    problem: DeclarationProblem;
}

export interface LossVerdict {
    /** Concern scripts read from the manifest. */
    scanned: number;
    /** Concern scripts that emit a context payload — the walk's entry points. */
    emitters: number;
    /** Distinct modules the detector MATCHED on a model-facing path. */
    modelFacing: number;
    /**
     * Of those, how many declare `exact` — matched, and losing nothing.
     *
     * Reported separately because the headline used to call every matched
     * module lossy, and one of them is a redactor that refuses rather than
     * rewrites. "Matched" is what the detector establishes; "lossy" is what
     * the declaration says, and on `exact` it says the opposite.
     */
    declaredExact: number;
    /**
     * Those modules by repo-relative path, sorted.
     *
     * Exposed so a test can assert WHICH module the detector matched, not only
     * how many — the blocker this walk closed was satisfiable by a count.
     */
    modules: string[];
    findings: LossFinding[];
}

/** The two views of a source file the detector reads. */
export interface SourceViews {
    /** Comments removed, literals blanked — code, and nothing about code. */
    code: string;
    /** Comments removed, literals kept — code plus the data it writes. */
    withLiterals: string;
}

/** Characters after which a `/` opens a regex rather than dividing. */
const REGEX_PREFIX = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', ';']);
/** Keywords after which the same is true. */
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'yield', 'await', 'throw']);

/** The standard division-vs-regex heuristic, read off what the scan has emitted. */
function regexAllowed(code: string): boolean {
    let j = code.length - 1;
    while (j >= 0 && /\s/.test(code[j] as string)) j -= 1;
    if (j < 0) return true;
    const ch = code[j] as string;
    if (REGEX_PREFIX.has(ch)) return true;
    if (!/[A-Za-z0-9_$]/.test(ch)) return false;
    let k = j;
    while (k >= 0 && /[A-Za-z0-9_$]/.test(code[k] as string)) k -= 1;
    return REGEX_KEYWORDS.has(code.slice(k + 1, j + 1));
}

/**
 * ONE left-to-right scan that classifies every character as code, literal or
 * comment, and returns both views from that single pass.
 *
 * Independent regexes for comments and for literals cannot see each other, and
 * a completion review found the resulting hole from both sides:
 *
 *   - a trailing `// truncate the rows` survived comment stripping (which
 *     removed WHOLE-LINE `//` only) and read as a real truncation — an
 *     over-match that manufactures a declaration nobody meant;
 *   - a `/*` inside a string opened a phantom block comment that deleted every
 *     byte up to the next real `*` + `/` — an under-match, the silent-green
 *     direction.
 *
 * The second finding's ATTRIBUTION was corrected by reproduction before this
 * fix was written: it blamed the composition order in `stripLiterals(
 * stripComments(src))`, and the old comment pass ALONE already ate that input,
 * so the order was never the cause. The phantom-comment half was pre-existing
 * in comment stripping, not introduced by composing the two. Both halves are
 * the same root cause seen from two sides, and both are gone here for the same
 * reason: a scanner that knows which state it is in cannot open a comment
 * inside a literal, cannot open a literal inside a comment, and does not care
 * whether a `//` starts its line.
 *
 * Newlines inside a removed comment are preserved so the two views stay
 * line-aligned with the source.
 */
export function scanSource(src: string): SourceViews {
    let code = '';
    let withLiterals = '';
    const n = src.length;
    // `code` mode reads code; `template` mode reads template-literal text. A
    // `${…}` pushes `code` back on, so a substitution's expression is code —
    // which is what it is.
    const modes: ('code' | 'template')[] = ['code'];
    /** Brace depth outside each open `${…}`, innermost last. */
    const subst: number[] = [];
    let braces = 0;
    let i = 0;

    while (i < n) {
        const ch = src[i] as string;

        if (modes[modes.length - 1] === 'template') {
            if (ch === '\\') {
                withLiterals += src.slice(i, i + 2);
                i += 2;
                continue;
            }
            if (ch === '`') {
                modes.pop();
                code += '`';
                withLiterals += '`';
                i += 1;
                continue;
            }
            if (ch === '$' && src[i + 1] === '{') {
                modes.push('code');
                subst.push(braces);
                braces += 1;
                code += '${';
                withLiterals += '${';
                i += 2;
                continue;
            }
            if (ch === '\n') code += '\n';
            withLiterals += ch;
            i += 1;
            continue;
        }

        const next = src[i + 1];
        if (ch === '/' && next === '/') {
            let j = i + 2;
            while (j < n && src[j] !== '\n') j += 1;
            i = j; // the newline itself is emitted on the next turn
            continue;
        }
        if (ch === '/' && next === '*') {
            let j = i + 2;
            while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j += 1;
            const end = Math.min(j + 2, n);
            const kept = src.slice(i, end).replace(/[^\n]/g, '');
            code += kept;
            withLiterals += kept;
            i = end;
            continue;
        }
        if (ch === "'" || ch === '"') {
            let j = i + 1;
            while (j < n && src[j] !== ch && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
            const end = src[j] === ch ? j + 1 : j;
            code += ch + ch;
            withLiterals += src.slice(i, end);
            i = end;
            continue;
        }
        if (ch === '`') {
            modes.push('template');
            code += '`';
            withLiterals += '`';
            i += 1;
            continue;
        }
        if (ch === '/' && regexAllowed(code)) {
            let j = i + 1;
            let inClass = false;
            let closed = false;
            while (j < n && src[j] !== '\n') {
                const c = src[j] as string;
                if (c === '\\') {
                    j += 2;
                    continue;
                }
                if (c === '[') inClass = true;
                else if (c === ']') inClass = false;
                else if (c === '/' && !inClass) {
                    closed = true;
                    break;
                }
                j += 1;
            }
            if (closed) {
                let k = j + 1;
                while (k < n && /[dgimsuvy]/.test(src[k] as string)) k += 1;
                code += '/RE/';
                withLiterals += src.slice(i, k);
                i = k;
                continue;
            }
        }
        if (ch === '{') {
            braces += 1;
        } else if (ch === '}') {
            const open = subst[subst.length - 1];
            if (open !== undefined && braces === open + 1) {
                subst.pop();
                braces = open;
                modes.pop();
                code += '}';
                withLiterals += '}';
                i += 1;
                continue;
            }
            braces -= 1;
        }
        code += ch;
        withLiterals += ch;
        i += 1;
    }
    return { code, withLiterals };
}

/**
 * Comments removed, literals KEPT — the emit half, and the marker-substitution
 * half of the lossy test.
 *
 * Name and callers unchanged; the behaviour is the scan's, so a trailing `//`
 * is now removed like any other comment.
 */
export function stripComments(src: string): string {
    return scanSource(src).withLiterals;
}

/** Comments removed and literals blanked — the pattern half of the lossy test. */
export function stripNonCode(src: string): string {
    return scanSource(src).code;
}

export function emitsContext(codeOnly: string): boolean {
    return EMIT_PATTERNS.some((p) => p.test(codeOnly));
}

export function isLossy(codeOnly: string): boolean {
    return LOSSY_PATTERNS.some((p) => p.test(codeOnly));
}

/**
 * A substitution whose ARGUMENTS carry the lossy marker — `s.replace(RE,
 * '[REDACTED]')`. Deliberately a proximity test and not a file-level one: a
 * module that merely mentions `redaction` somewhere AND calls `.slice` somewhere
 * else is not performing a redaction, and admitting it was measured to pull in
 * three modules that lose nothing (settings KEY NAMES containing `redaction`, a
 * SQLite `PRAGMA wal_checkpoint(TRUNCATE)`, and length constants used only to
 * VALIDATE). Three pro-forma declarations is the corpus this gate's own
 * docstring warns against, so the co-presence rule was measured and dropped.
 */
// `(?:[^()]|\([^()]*\))*?` and not `[^)]*?`: the first form stopped at the
// FIRST `)`, so `s.replace(buildPattern(), '[REDACTED]')` — marker after a
// nested call — was invisible, which is a silent-green gap in the one mechanism
// this pattern exists to close. One level of nesting covers every shape in this
// tree; deeper nesting is a bounded under-match rather than an unbounded scan
// that would run into the next statement.
const MARKER_SUBSTITUTION = /\.(?:replace|replaceAll)\s*\((?:[^()]|\([^()]*\))*?(?:redact|truncat)/i;

/**
 * Is this module lossy, judged on BOTH the blanked and the unblanked form?
 *
 * Blanking literals keeps the gate off data ABOUT operations — a SQLite
 * `PRAGMA wal_checkpoint(TRUNCATE)`, a settings key containing `redaction`, a
 * destructive-command detector's own `/truncate\s+table/`. It also deletes a
 * real class of true positives, which a completion review caught and this
 * function is the answer to: a redaction whose only code-level evidence is its
 * replacement marker — `s.replace(RE, '[REDACTED]')` — is lossy, and blanking
 * alone made it invisible.
 *
 * The discriminator is measured, not guessed, and the first version of it was
 * wrong. Asking only whether the module ALSO contains a shortening call
 * anywhere admitted three modules that lose nothing — settings key names
 * containing `redaction`, a SQLite `PRAGMA wal_checkpoint(TRUNCATE)`, and
 * length constants used to validate rather than cut — taking the corpus from 5
 * to 8. Co-presence in a file is not evidence. The marker has to sit in the
 * substitution's own arguments, which is what separates `s.replace(RE,
 * '[REDACTED]')` from `db.exec(q)`, `read(k)` and `RE.test(cmd)`.
 *
 * Residual error, stated rather than implied: a substitution whose replacement
 * merely NAMES redaction without performing one still counts. That direction is
 * the affordable one — it costs a declaration, where the other direction is a
 * module cutting content with nothing watching.
 */
export function isLossyModule(source: string): boolean {
    return isLossyViews(scanSource(source));
}

/** The same test over an already-scanned file, so the scan is paid once. */
export function isLossyViews(views: SourceViews): boolean {
    if (isLossy(views.code)) return true;
    return MARKER_SUBSTITUTION.test(views.withLiterals);
}

/** Resolve a relative specifier to a real file, preferring the `.ts` twin of a `.js` import. */
export function resolveSpecifier(spec: string, fromFile: string, root: string): string | null {
    const base = path.resolve(path.dirname(fromFile), spec);
    // A specifier that already names a code file keeps the original two
    // candidates. One that does not gets the extensionless and directory forms
    // in Node resolution order: the pattern used to REQUIRE an extension, so
    // `require('./_lib/x')` and `from './helpers'` were not reaches at all — a
    // static gap the contract's disclosure list did not carry. A specifier
    // naming some other extension (`./x.md`) falls here too and resolves to
    // nothing, which keeps non-code files out of the walk.
    //
    // Measured 2026-09-10, and the honest number is zero: the reached set is
    // 73 modules with the extension required and 73 without, and the matched
    // corpus is the same 5 either way — this tree writes no extensionless
    // relative specifier on any reached path today. The gap is closed
    // prospectively, not because it was leaking. A self-test case pins that
    // the new candidates resolve at all, so the closure is not untested.
    // `.mts` / `.cts` / `.tsx` / `.jsx` are in the list although this tree
    // writes none of them on a reached path today. Leaving them out is a
    // latent under-match that would surface as a silently smaller corpus the
    // day one appears, which is the failure direction this whole gate exists
    // to refuse; carrying them costs nothing.
    const candidates = /\.(?:js|ts|mjs|cjs|mts|cts|tsx|jsx)$/.test(base)
        ? [base.replace(/\.(?:js|mjs|cjs|jsx)$/, '.ts'), base]
        : [`${base}.ts`, `${base}.js`, path.join(base, 'index.ts'), path.join(base, 'index.js')];
    for (const candidate of candidates) {
        if (!candidate.startsWith(root + path.sep)) continue;
        try {
            if (fs.statSync(candidate).isFile()) return candidate;
        } catch {
            /* not a file — try the next candidate */
        }
    }
    return null;
}

/**
 * Read each file once per run and keep both views plus its declaration.
 *
 * The walk, the lossy test and the declaration parse all want the same file,
 * and `reachedModules` re-walked a heavily shared `_lib` graph once per
 * emitter. With 7 emitters that was O(emitters × graph) reads for a result
 * that is per-file and per-entry and does not change during a run.
 */
export class SourceCache {
    private readonly files = new Map<string, { raw: string; views: SourceViews } | null>();
    private readonly reach = new Map<string, string[]>();

    get(file: string): { raw: string; views: SourceViews } | null {
        const hit = this.files.get(file);
        if (hit !== undefined) return hit;
        let entry: { raw: string; views: SourceViews } | null = null;
        try {
            const raw = fs.readFileSync(file, 'utf-8');
            entry = { raw, views: scanSource(raw) };
        } catch {
            entry = null;
        }
        this.files.set(file, entry);
        return entry;
    }

    /** Memoized per entry point, which is what the per-emitter loop asks for. */
    reachedFrom(entry: string, root: string): string[] {
        const hit = this.reach.get(entry);
        if (hit !== undefined) return hit;
        const out = reachedModules(entry, root, this);
        this.reach.set(entry, out);
        return out;
    }
}

/**
 * Every module an emitter reaches through relative imports, transitively, the
 * emitter itself included.
 *
 * `createRequire` is how the lazy hook paths in this tree load their heavy
 * dependencies, so the walk reads relative SPECIFIERS rather than `import`
 * statements — a `req('./_lib/session_index_trust.js')` is a reach and a static
 * import is a reach, and the detector must not be able to tell them apart.
 *
 * There is no depth cap, and that is a fix rather than an omission. The cap
 * was tested AFTER `seen.add`, and the stack is LIFO, so `depth` was the depth
 * of whichever path happened to push a node first — a module first popped deep
 * was marked reached and its children were never explored, even when a shallow
 * path to it existed and was popped later. That made the reach set depend on
 * import order rather than on the graph. `seen` is what terminates a cycle, and
 * it terminated every cycle already, so removing the cap removes the
 * order-dependence and nothing else.
 */
export function reachedModules(entry: string, root: string, cache: SourceCache = new SourceCache()): string[] {
    const seen = new Set<string>();
    const stack: string[] = [entry];
    while (stack.length > 0) {
        const file = stack.pop();
        if (file === undefined) break;
        if (seen.has(file)) continue;
        seen.add(file);
        const hit = cache.get(file);
        if (hit === null) continue;
        for (const m of hit.views.withLiterals.matchAll(IMPORT_SPEC)) {
            const spec = m[1];
            if (spec === undefined) continue;
            const target = resolveSpecifier(spec, file, root);
            if (target !== null && !seen.has(target)) stack.push(target);
        }
    }
    return [...seen];
}

function loadManifest(root: string): { concerns: Record<string, { script?: unknown }>; platforms: Record<string, Record<string, string[]>> } {
    const file = path.join(root, 'src', 'scripts', 'hook_manifest.yaml');
    const raw = fs.readFileSync(file, 'utf-8');
    const out = spawnSync(
        process.execPath,
        ['-e', 'const y=require("js-yaml");let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=y.load(s);process.stdout.write(JSON.stringify({concerns:d.concerns||{},platforms:d.platforms||{}}))})'],
        { input: raw, encoding: 'utf-8', cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 },
    );
    if (out.status !== 0 || !out.stdout) throw new Error(`hook_manifest.yaml could not be parsed: ${out.stderr || 'no output'}`);
    return JSON.parse(out.stdout) as { concerns: Record<string, { script?: unknown }>; platforms: Record<string, Record<string, string[]>> };
}

/**
 * Which concerns sit on a model-facing slot.
 *
 * A concern bound on NO slot this gate recognises is `unknown` reachability, and
 * per the council refinement it is treated as model-facing rather than skipped.
 */
export function modelFacingConcerns(platforms: Record<string, Record<string, string[]>>): Set<string> {
    const out = new Set<string>();
    for (const slots of Object.values(platforms)) {
        if (slots === null || typeof slots !== 'object') continue;
        for (const [slot, names] of Object.entries(slots)) {
            if (!Array.isArray(names)) continue;
            const facing = (MODEL_FACING_SLOTS as readonly string[]).includes(slot);
            for (const n of names) if (facing) out.add(n);
        }
    }
    return out;
}

export function evaluate(root: string = REPO_ROOT, ledger?: GateLedger): LossVerdict {
    const { concerns, platforms } = loadManifest(root);
    const facing = modelFacingConcerns(platforms);
    const bound = new Set<string>();
    for (const slots of Object.values(platforms)) {
        if (slots === null || typeof slots !== 'object') continue;
        for (const names of Object.values(slots)) if (Array.isArray(names)) for (const n of names) bound.add(n);
    }

    const findings: LossFinding[] = [];
    const lossyModules = new Map<string, boolean>();
    const exactModules = new Set<string>();
    const cache = new SourceCache();
    let scanned = 0;
    let emitters = 0;

    ledger?.plan(Object.keys(concerns));

    for (const [name, spec] of Object.entries(concerns)) {
        const rel = typeof spec?.script === 'string' ? spec.script : null;
        if (rel === null) {
            ledger?.skip(name, 'manifest_absent');
            continue;
        }
        const abs = path.join(root, rel);
        const entry = cache.get(abs);
        if (entry === null) {
            ledger?.skip(name, 'no_applicable_files');
            continue;
        }
        scanned += 1;

        // The emitter half is a property of the CONCERN script. A `_lib` module
        // never emits; requiring it to is what emptied this corpus.
        if (!emitsContext(entry.views.withLiterals)) {
            ledger?.outOfScope(name, 'not_applicable_kind');
            continue;
        }
        emitters += 1;

        // Unknown reachability fails closed: a bound concern this gate cannot
        // place on a known slot is treated as model-reaching.
        const reaches = facing.has(name) || !bound.has(name);

        let anyLossy = false;
        let anyProblem = false;
        for (const file of cache.reachedFrom(abs, root)) {
            const hit = cache.get(file);
            if (hit === null) continue;
            if (!isLossyViews(hit.views)) continue;
            anyLossy = true;
            const moduleRel = path.relative(root, file);
            if (reaches) lossyModules.set(moduleRel, true);

            // The declaration lives in a docblock, so it is read from the RAW
            // source — the one place the comment-stripped views are wrong.
            const decl = parseLossDeclaration(hit.raw);
            if (!isProblem(decl)) {
                if (reaches && decl.lossClass === 'exact') exactModules.add(moduleRel);
                continue;
            }
            anyProblem = true;
            findings.push({ concern: name, script: rel, module: moduleRel, tier: reaches ? 'fail' : 'warn', problem: decl });
        }

        if (!anyLossy) {
            // Nothing this emitter reaches shortens content: the check does not
            // apply to it.
            ledger?.outOfScope(name, 'not_applicable_kind');
            continue;
        }
        if (anyProblem) {
            ledger?.fail(name, 'reaches a lossy module with no usable loss_class');
            continue;
        }
        ledger?.complete(name);
    }
    return {
        scanned,
        emitters,
        modelFacing: lossyModules.size,
        declaredExact: exactModules.size,
        modules: [...lossyModules.keys()].sort(),
        findings,
    };
}

// ---------------------------------------------------------------- self-test

const LOSSY_EMITTER = `
const WORD_CAP = 400;
export function run() {
  const kept = redactLines(body).slice(0, WORD_CAP);
  return { context: kept.join('\\n') };
}
`;

/**
 * The specifier the self-test fixtures import, assembled rather than written.
 *
 * `prepack-check` scans every SHIPPED source for `from '<relative>'` and fails
 * on one that does not resolve. These fixtures are template literals describing
 * a file the self-test writes to a temp directory, so the path resolves there
 * and nowhere here — and interpolating it keeps the literal form out of this
 * file while leaving it intact in the fixture that gets written. The same shape
 * this gate's own IMPORT_SPEC was narrowed for: a path in a string is not an
 * import, and two different tools read it as one.
 */
const FIXTURE_LIB = './_lib/fixture_lib.js';
const FIXTURE_LIB_BARE = './_lib/fixture_lib';

/** An emitter that is clean itself and reaches a lossy `_lib` module. */
const IMPORTING_EMITTER = `
import { capRows } from '${FIXTURE_LIB}';
export function run() {
  return { context: capRows(rows).join('\\n') };
}
`;

/** The same emitter, importing a module that shortens nothing. */
const IMPORTING_CLEAN_EMITTER = `
import { passthrough } from '${FIXTURE_LIB}';
export function run() {
  return { context: passthrough(rows).join('\\n') };
}
`;

const LOSSY_LIB = `
export const SESSION_INDEX_ROW_CAP = 30;
export function capRows(rows) { return rows.slice(0, SESSION_INDEX_ROW_CAP); }
`;

const CLEAN_LIB = `
export function passthrough(rows) { return rows; }
`;

/** The same emitter again, reaching its lib through an EXTENSIONLESS specifier. */
const EXTENSIONLESS_EMITTER = `
import { capRows } from '${FIXTURE_LIB_BARE}';
export function run() {
  return { context: capRows(rows).join('\\n') };
}
`;

/**
 * The cap-widening pair. These two differ in ONE token — the unit word — so
 * either one failing localises the pattern change. The reject half used to be
 * a byte-identical copy of the "reached module" case above and could not fail
 * independently of it.
 */
const PREFIXED_UNIT_CAP_LIB = `
export const SESSION_INDEX_ROW_CAP = 30;
export function rows(r) { return r.slice(0, SESSION_INDEX_ROW_CAP); }
`;
const PREFIXED_NON_UNIT_CAP_LIB = `
export const SESSION_INDEX_PRAGMA_CAP = 30;
export function rows(r) { return r; }
`;
const ROWS_EMITTER = IMPORTING_EMITTER.replaceAll('capRows', 'rows');

// ---- the four shapes that must stay OUT, one fixture each -----------------
//
// One per shape on purpose. They used to be two shapes in one fixture, so a
// regression in either was reported as one failure and neither was localised.

/** A SQLite pragma that names TRUNCATE and shortens nothing. */
const PRAGMA_LITERAL_EMITTER = `
const stmt = 'PRAGMA wal_checkpoint(TRUNCATE)';
export function run() { return { context: stmt }; }
`;

/** A destructive-command detector's OWN pattern — data about truncation. */
const DETECTOR_REGEX_EMITTER = `
const destructive = /\\btruncate\\s+table\\b/i;
export function run() { return { context: String(destructive) }; }
`;

/** A settings KEY NAME containing `redaction`. Reading a flag is not redacting. */
const SETTINGS_KEY_EMITTER = `
const KEY = 'knowledge.global_sharing.redaction.enabled';
export function run() { return { context: read(KEY) }; }
`;

/** A TRAILING comment — the half whole-line comment stripping could not see. */
const TRAILING_COMMENT_EMITTER = `
export function run() { return { context: rows.join('\\n') }; } // truncate the rows here
`;

// ---- the three shapes that must stay IN ------------------------------------

/** A redaction whose ONLY code-level evidence is its replacement literal. */
const MARKER_REPLACEMENT_LIB = `
export function scrub(s) { return s.replace(SECRET_RE, '[REDACTED]'); }
`;
// The same redaction with the marker AFTER a nested call. `[^)]*?` stopped at
// the first `)` and made this shape invisible — a silent-green gap in the one
// mechanism that pattern exists to close, and unpinned until this case.
const NESTED_MARKER_LIB = `
export function scrub(s) { return s.replace(buildPattern(kind), '[REDACTED]'); }
`;
const SCRUB_EMITTER = `
import { scrub } from '${FIXTURE_LIB}';
export function run() { return { context: scrub(body) }; }
`;

/** A contraction inside a template literal, with real truncating code after it. */
const TEMPLATE_APOSTROPHE_EMITTER = `
export function run(body) {
  const msg = \`it's fine\`; const kept = body.truncate('x');
  return { context: msg + kept };
}
`;

/**
 * An UNBALANCED `/*` inside a string literal, followed by a real comment.
 *
 * The unbalanced form is the one that bites: whole-line comment stripping ran
 * from the phantom opener to the next real closer and deleted the truncation
 * between them, so the module read clean. A balanced `'src/` + `**` + `/*.ts'`
 * glob only mangles the string and leaves the code, which is why this fixture
 * does not use one.
 */
const PHANTOM_COMMENT_EMITTER = `
const open = '/*';
export function run(body) { return { context: open + truncateBody(body) }; }
/* a real comment, after the phantom one */
`;

interface Plant {
    header?: string;
    body: string;
    libHeader?: string;
    lib?: string;
    slot?: string;
}

function plant(dir: string, p: Plant): void {
    fs.mkdirSync(path.join(dir, 'src', 'scripts', '_lib'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'scripts', 'fixture_hook.ts'), (p.header ?? '') + p.body);
    if (p.lib !== undefined) {
        fs.writeFileSync(path.join(dir, 'src', 'scripts', '_lib', 'fixture_lib.ts'), (p.libHeader ?? '') + p.lib);
    }
    fs.writeFileSync(
        path.join(dir, 'src', 'scripts', 'hook_manifest.yaml'),
        `schema_version: 1\nconcerns:\n  fixture:\n    script: src/scripts/fixture_hook.ts\nplatforms:\n  claude:\n    ${p.slot ?? 'session_start'}:\n      - fixture\n`,
    );
}

const NO_DECL = '';
const DECL_RECOVERABLE = '/**\n * loss_class: recoverable-lossy\n * loss_recovery: agents/knowledge/intake/<file>:<a>-<b>\n */\n';
const DECL_RECOVERABLE_NO_LOCATOR = '/**\n * loss_class: recoverable-lossy\n */\n';
const DECL_EPHEMERAL = '/**\n * loss_class: ephemeral-lossy\n */\n';
const DECL_TYPO = '/**\n * loss_class: recoverable_lossy\n */\n';

function selfTestCases(): SelfTestCase[] {
    const mk = (name: string, expect: 'reject' | 'accept', p: Plant): SelfTestCase => ({
        name,
        expect,
        run: () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcd-'));
            try {
                plant(dir, p);
                return runGateCli(REPO_ROOT, 'src/scripts/check_loss_class_declared.ts', ['--root', dir, '--quiet'], REPO_ROOT);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        },
    });
    return [
        mk('model-facing lossy transform with no declaration → reject', 'reject', { header: NO_DECL, body: LOSSY_EMITTER }),
        mk('same transform with recoverable-lossy + locator → accept', 'accept', { header: DECL_RECOVERABLE, body: LOSSY_EMITTER }),
        mk('recoverable-lossy WITHOUT a locator → reject', 'reject', { header: DECL_RECOVERABLE_NO_LOCATOR, body: LOSSY_EMITTER }),
        mk('ephemeral-lossy (owes no locator) → accept', 'accept', { header: DECL_EPHEMERAL, body: LOSSY_EMITTER }),
        mk('a misspelled class is not honoured → reject', 'reject', { header: DECL_TYPO, body: LOSSY_EMITTER }),
        mk('non-lossy emitter needs no declaration → accept', 'accept', { header: NO_DECL, body: `export function run(){return {context:'hi'};}` }),
        mk('lossy but emits no context → accept', 'accept', { header: NO_DECL, body: `const WORD_CAP=5;export function run(){return body.slice(0,WORD_CAP);}` }),
        mk('prose about truncation is not truncation → accept', 'accept', { header: NO_DECL, body: `/* we deliberately never truncate or redact here */\nexport function run(){return {context:'hi'};}` }),
        // The widening, in both directions.
        mk('a lossy _lib module an emitter REACHES, undeclared → reject', 'reject', {
            header: NO_DECL, body: IMPORTING_EMITTER, libHeader: NO_DECL, lib: LOSSY_LIB,
        }),
        mk('the same reached module, declared on the module itself → accept', 'accept', {
            header: NO_DECL, body: IMPORTING_EMITTER, libHeader: DECL_EPHEMERAL, lib: LOSSY_LIB,
        }),
        mk('a declaration on the EMITTER does not cover the reached module → reject', 'reject', {
            header: DECL_EPHEMERAL, body: IMPORTING_EMITTER, libHeader: NO_DECL, lib: LOSSY_LIB,
        }),
        mk('a reached module that shortens nothing → accept', 'accept', {
            header: NO_DECL, body: IMPORTING_CLEAN_EMITTER, libHeader: NO_DECL, lib: CLEAN_LIB,
        }),
        // The cap widening, isolated: these two differ in ONE token.
        mk('a prefixed UNIT cap is a cap — SESSION_INDEX_ROW_CAP → reject', 'reject', {
            header: NO_DECL, body: ROWS_EMITTER, libHeader: NO_DECL, lib: PREFIXED_UNIT_CAP_LIB,
        }),
        mk('the same shape with a NON-unit word — SESSION_INDEX_PRAGMA_CAP → accept', 'accept', {
            header: NO_DECL, body: ROWS_EMITTER, libHeader: NO_DECL, lib: PREFIXED_NON_UNIT_CAP_LIB,
        }),
        mk('a lint budget is not a content cap — PRAGMA_CAP → accept', 'accept', {
            // `replaceAll`, not `replace`: the first-match form renamed the
            // import and left the call site reading `capRows`, so the fixture
            // no longer meant what its name said.
            header: NO_DECL, body: IMPORTING_EMITTER.replaceAll('capRows', 'pragmas'), libHeader: NO_DECL,
            lib: `export const PRAGMA_CAP = 20;\nexport function pragmas(rows) { return rows; }\n`,
        }),
        // The four DATA shapes, one case each, so a regression localises.
        mk('a SQLite PRAGMA naming TRUNCATE shortens nothing → accept', 'accept', {
            header: NO_DECL, body: PRAGMA_LITERAL_EMITTER,
        }),
        mk("a detector's own /truncate table/ pattern is data → accept", 'accept', {
            header: NO_DECL, body: DETECTOR_REGEX_EMITTER,
        }),
        mk('a settings key containing `redaction` is not a redaction → accept', 'accept', {
            header: NO_DECL, body: SETTINGS_KEY_EMITTER,
        }),
        mk('a TRAILING // comment about truncation is not truncation → accept', 'accept', {
            header: NO_DECL, body: TRAILING_COMMENT_EMITTER,
        }),
        // The three shapes that must stay IN — the true positives blanking and
        // regex-composed stripping each cost, one case per direction.
        mk('a redaction whose only evidence is its replacement literal → reject', 'reject', {
            header: NO_DECL, body: SCRUB_EMITTER, libHeader: NO_DECL, lib: MARKER_REPLACEMENT_LIB,
        }),
        mk('a marker after a nested call is still a redaction → reject', 'reject', {
            header: NO_DECL, body: SCRUB_EMITTER, libHeader: NO_DECL, lib: NESTED_MARKER_LIB,
        }),
        mk('an apostrophe in a template literal does not blank the code after it → reject', 'reject', {
            header: NO_DECL, body: TEMPLATE_APOSTROPHE_EMITTER,
        }),
        mk('a /* inside a string literal does not open a comment → reject', 'reject', {
            header: NO_DECL, body: PHANTOM_COMMENT_EMITTER,
        }),
        // The reach widening: an extensionless specifier is a reach.
        mk('an extensionless relative import is a reach → reject', 'reject', {
            header: NO_DECL, body: EXTENSIONLESS_EMITTER, libHeader: NO_DECL, lib: LOSSY_LIB,
        }),
    ];
}

// ---------------------------------------------------------------------- CLI

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) {
        // Floors sit ON the actual counts, not below them. At 13/5 against
        // 15/6 the reject floor tolerated deleting a rejecting case in
        // silence, so it no longer defended the number `gate-coverage.yml`
        // documents. Raising a floor is a deliberate edit; letting one rot
        // below the corpus is not.
        return runSelfTest({ gate: 'check_loss_class_declared', cases: selfTestCases(), minCases: 24, minRejectCases: 11 });
    }
    const quiet = argv.includes('--quiet');
    const json = argv.includes('--json');
    const ri = argv.indexOf('--root');
    const rootArg = ri !== -1 ? argv[ri + 1] : undefined;
    const root = rootArg !== undefined ? path.resolve(rootArg) : REPO_ROOT;

    const ledger = new GateLedger('check_loss_class_declared');
    let v: LossVerdict;
    try {
        v = evaluate(root, ledger);
    } catch (err) {
        process.stderr.write(`❌  check_loss_class_declared: ${(err as Error).message}\n`);
        return 2;
    }

    try {
        reportScanned({ gate: 'check_loss_class_declared', scanned: v.scanned, units: 'hook script(s)', roots: ['src/scripts/hook_manifest.yaml'] });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  check_loss_class_declared: ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    ledger.report();

    if (json) {
        process.stdout.write(JSON.stringify(v, null, 2) + '\n');
        return v.findings.some((f) => f.tier === 'fail') ? 1 : 0;
    }

    const say = (f: LossFinding): string => {
        switch (f.problem.kind) {
            case 'missing':
                return 'declares no loss_class';
            case 'unknown-class':
                return `declares loss_class: ${f.problem.value}, which is not one of the five`;
            case 'missing-recovery':
                return 'declares recoverable-lossy but no loss_recovery locator — without one the class is indistinguishable from ephemeral-lossy';
        }
    };

    // One line per MODULE, not per (concern, module) pair. A shared `_lib`
    // module reached from several emitters is one undeclared module and one
    // edit; printing it once per reaching emitter made the output disagree
    // with `modules` / `modelFacing`, which already deduplicate. The ledger
    // keeps its per-concern `fail` — that count answers a different question
    // (which concerns are affected), and the reaching set is named on the line
    // so nothing is lost by collapsing it.
    const byModule = new Map<string, { first: LossFinding; concerns: string[] }>();
    for (const f of v.findings) {
        const hit = byModule.get(f.module);
        if (hit === undefined) byModule.set(f.module, { first: f, concerns: [f.concern] });
        else {
            hit.concerns.push(f.concern);
            if (f.tier === 'fail') hit.first = { ...hit.first, tier: 'fail' };
        }
    }

    for (const { first: f, concerns } of byModule.values()) {
        const stream = f.tier === 'fail' ? process.stderr : process.stdout;
        const reached =
            concerns.length === 1
                ? `reached from concern ${f.concern} → ${f.script}`
                : `reached from ${String(concerns.length)} concerns: ${concerns.join(', ')}`;
        stream.write(
            `${f.tier === 'fail' ? '❌' : '⚠️ '}  ${f.module} shortens content on a model-facing path ` +
                `(${reached}) and ${say(f)}\n`,
        );
    }

    if (v.findings.some((f) => f.tier === 'fail')) {
        process.stderr.write(
            `\n    Add a declaration to the module's own docblock:\n` +
                `      loss_class: exact | lossless | recoverable-lossy | ephemeral-lossy | forbidden\n` +
                `      loss_recovery: <where the original is retrievable>   # recoverable-lossy only\n` +
                `    Contract: docs/contracts/loss-classes.md\n`,
        );
        return 1;
    }
    if (!quiet) {
        // "matched", not "lossy". The detector establishes a match; the
        // DECLARATION says whether anything is lost, and on `exact` it says
        // nothing is. Calling every matched module lossy overstated the real
        // lossy corpus by however many `exact` members it held.
        const exact = v.declaredExact > 0 ? `, ${String(v.declaredExact)} of them declaring exact` : '';
        process.stdout.write(
            `✅  every model-facing lossy transform declares its loss class ` +
                `(${String(v.modelFacing)} matched module(s)${exact}, reached from ${String(v.emitters)} emitter(s) ` +
                `of ${String(v.scanned)} hook script(s)).\n`,
        );
    }
    return 0;
}

if (process.env['GATE_SELF_TEST_CHILD'] !== '1' || process.argv.includes('--root')) {
    if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
        process.exit(main());
    }
}
