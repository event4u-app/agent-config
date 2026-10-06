/**
 * The thin-projection MECHANISM, with no CLI entry of its own.
 *
 * Extracted from `src/scripts/project_thin_rules.ts` for
 * `road-to-an-installed-layer-that-is-thinned` step 1.1, which needs the
 * INSTALLER to apply the projector's own predicate to `~/.claude/rules`.
 *
 * THE EXTRACTION IS THE POINT, NOT TIDYING. `src/scripts/install.ts` is the
 * `build:install-bundle` entry, and `check_installer_import_purity` fails the
 * build when any module reachable from it carries a module-level
 * `process.exit()` — including the guarded `if (isMain) process.exit(main())`
 * shape, which that gate's own test names as "the real incident shape".
 * `project_thin_rules.ts` carries exactly that at its foot, so the installer
 * could not import it. The two live alternatives were both worse: a second
 * implementation of the stub form inside `src/install/` is the duplicate-reader
 * defect this repository has already paid for twice (the `lean_projection.mode`
 * header records the latest), and moving the CLI instead would break every
 * caller of `project_thin_rules --measure`.
 *
 * So the mechanism moves and the CLI stays. `project_thin_rules.ts` re-exports
 * every name below, so no existing importer changes.
 *
 * Nothing here runs on import, nothing here writes, and nothing here calls
 * `process.exit`. `measure`, `write_thin`, the JSON dumper and the CLI remain in
 * `project_thin_rules.ts`.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lawText, ruleBody } from './rule_law_section.js';
import {
    readConsequenceClass,
    stubLawIds,
    type ConsequenceClassConfig,
} from './rule_consequence_class.js';
import {
    pathOnlyRuleIds,
    triggerlessRuleIds,
    type Router,
} from './rule_injection.js';

const _HERE = fileURLToPath(import.meta.url);
/**
 * The package root.
 *
 * FOUR levels up, not three: this module sits at `src/scripts/_lib/`, one
 * directory deeper than the `src/scripts/<file>` the arithmetic was written for.
 * Keeping the old `'..','..'` here would have resolved to `src/` and every
 * default root below would have been silently wrong — the extraction's one
 * genuine hazard, so it is stated rather than left to be noticed.
 *
 * Correct for a module READ FROM SOURCE. A bundled caller must hand its own
 * package root over via {@link ThinRoots}; see that interface for why.
 */
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');

export const RULES_SOURCE = path.join(REPO_ROOT, 'dist/agent-src', 'rules');
export const ROUTER = path.join(REPO_ROOT, 'dist', 'router.json');

/** `sorted(dir.glob("*.md"))` — non-recursive, lexically sorted abs paths. */
export function _globSortedMd(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names.filter((n) => n.endsWith('.md')).map((n) => path.join(dir, n));
    out.sort();
    return out;
}

/** The always-full-bodied set — authoritative kernel list from the router. */
export function kernel_ids(routerPath: string = ROUTER): Set<string> {
    const data = JSON.parse(fs.readFileSync(routerPath, 'utf-8')) as Record<string, unknown>;
    const kernel = data.kernel;
    if (Array.isArray(kernel)) {
        return new Set(kernel.map((x) => String(x)));
    }
    return new Set();
}

/**
 * Tier rules the router gives NO trigger at all.
 *
 * These cannot be delivered on a match, so thinning them would remove a body
 * that nothing can ever put back — a silent hole rather than a saving. They
 * project full-bodied, and `measure` reports them by name so the residue is
 * visible instead of being absorbed into the pointer count
 * (road-to-trigger-delivered-rule-bodies 1.3).
 */
/**
 * Rules whose ONLY triggers are path-shaped — reachable from `pre_tool_use`
 * and from no other slot (road-to-delivery-for-every-host 3.2).
 *
 * They must never be thinned while the delivery concern is NOT bound on
 * `pre_tool_use`, because a stub plus a slot nobody listens on is a rule that
 * reaches the model at no scope at all. This is the same failure the
 * `no_trigger_ids` exemption prevents, one step out: there the rule has nothing
 * to match on, here it has nothing to match ON.
 *
 * Stated as a PROPERTY rather than a list of ids. If the concern is ever bound
 * on `pre_tool_use` again, this exemption is what should be reconsidered — not
 * three names someone has to remember.
 *
 * WHAT THIS EXEMPTION DOES **NOT** COVER — recorded 2026-09-08, R2 finding 1,
 * because the silence read as coverage. The predicate is `every` trigger
 * path-shaped. A rule with BOTH path and non-path triggers is therefore THINNED,
 * and its path-shaped half then has no carrier at all: the stub carries no
 * frontmatter (`condense.ts` writes it with `_writeText`, bypassing
 * `_emit_claude_rule`'s host-native `paths:` key), `pre_tool_use` lost the
 * binding under owner ruling E2, and `user_prompt_submit` never populates
 * `openFiles`. Measured over the current `dist/router.json`: **18 such rules**,
 * all non-kernel and all thinned — augment-edit-discipline, design-fidelity,
 * doc-screenshot-hygiene, domain-adoption-policy,
 * framework-neutrality-in-generic-skills, image-likeness-and-rights,
 * laravel-translations, lethal-trifecta-guard, linked-projects-onboarding-gate,
 * low-impact-corpus-privacy-floor, markdown-safe-codeblocks, onboarding-gate,
 * persona-governance, php-coding, provider-lifecycle-discipline,
 * roadmap-ci-steps-policy, roadmap-progress-sync, settings-ask-protocol.
 *
 * They do NOT reach the model at no scope: every non-path route
 * (keyword / phrase / command) still delivers the body through the concern, and
 * on `claude-code` they never had a separate host-native path route to lose —
 * `_claude_paths_plan` emits no `paths:` for a mixed-trigger rule on purpose, so
 * under `eager-all` they loaded UNCONDITIONALLY. What is lost is the difference
 * between unconditional and prompt-triggered: a session that touches a matching
 * file and says nothing that matches gets nothing.
 *
 * The labelled corpus cannot see this and the endpoint says so rather than
 * implying otherwise — `model_rule_injection --endpoints` (b) now publishes the
 * shipped `user_prompt_submit` reach beside the pre-registered reading, and
 * every one of these 18 has at least one prompt-matching positive, so none
 * appears in its "reachable only via a path trigger" column.
 *
 * WHY THIS IS NOT WIDENED TO `some` HERE. Measured: exempting all 18 moves the
 * thin rule layer 23,592 -> 39,921 GPT tok (+16,329, +69 %), which is a budget
 * move of a magnitude no agent may take, and it would erase most of the saving
 * the flip is licensed on. Restoring a path route needs either that exemption
 * under a re-anchored baseline or a `pre_tool_use` binding under a raised slot
 * cap — both owner-reserved, so the closure is tracked rather than taken here.
 * ADR-267's Consequences section names the receiver.
 */
/**
 * ONE spelling of the router-derived sets, shared with the injector (R2
 * finding 11).
 *
 * `path_only_ids` and `no_trigger_ids` were each a second, hand-rolled
 * implementation of `_lib/rule_injection.ts::pathOnlyRuleIds` /
 * `triggerlessRuleIds` — verified identical over the current router at the time
 * (symmetric difference empty), so drift risk rather than a live defect. It is
 * exactly the hazard `THIN_ENTRY_MARKER`'s own comment argues against one
 * screen below ("a gate that re-spelled this string would drift from the writer
 * silently"), and the two consumers here are the PROJECTOR's exemption set and
 * the INJECTOR's reachability set: they must not be able to disagree about which
 * rules the delivery path can reach.
 *
 * The finding named `path_only_ids`. The defect-pattern sweep found the SECOND
 * instance one function down — `no_trigger_ids` against `triggerlessRuleIds` —
 * and it is delegated in the same change. Count: 2 of 2 duplicated
 * router-derived sets in this file, 0 remaining.
 */
function _router(routerPath: string = ROUTER): Router {
    return JSON.parse(fs.readFileSync(routerPath, 'utf-8')) as Router;
}

export function path_only_ids(routerPath: string = ROUTER): Set<string> {
    return pathOnlyRuleIds(_router(routerPath));
}

export function no_trigger_ids(routerPath: string = ROUTER): Set<string> {
    return new Set(triggerlessRuleIds(_router(routerPath)));
}

/**
 * id → workspaces for every non-kernel router entry (router.json schema v2,
 * road-to-request-scoped-rule-load Phase 1). Rules absent from the map (or
 * with an empty list) fail safe: they stay in scope.
 */
export function rule_workspaces_map(routerPath: string = ROUTER): Map<string, string[]> {
    const data = JSON.parse(fs.readFileSync(routerPath, 'utf-8')) as Record<string, unknown>;
    const map = new Map<string, string[]>();
    for (const tier of ['tier_1', 'tier_2']) {
        const entries = data[tier];
        if (!Array.isArray(entries)) continue;
        for (const e of entries) {
            const obj = e as Record<string, unknown>;
            const ws = Array.isArray(obj.workspaces) ? obj.workspaces.map((w) => String(w)) : [];
            map.set(String(obj.id), ws);
        }
    }
    return map;
}

/**
 * Whether a rule id survives a workspace scope. Kernel always survives;
 * `scope === null` = legacy-all. An out-of-scope non-kernel rule is dropped
 * entirely — neither body nor pointer line (the pointer floor shrinks with
 * consumer scoping).
 */
export function id_in_scope(
    rule_id: string,
    scope: readonly string[] | null,
    kernel: ReadonlySet<string>,
    wsMap: ReadonlyMap<string, string[]>,
    fallback_ws: readonly string[] = [],
): boolean {
    if (scope === null || kernel.has(rule_id)) {
        return true;
    }
    // Router map first (schema v2); `type: manual` rules are reference-only
    // and never emitted to the router — their frontmatter is the fallback.
    const ws = wsMap.get(rule_id) ?? fallback_ws;
    if (ws.length === 0) {
        return true; // untagged / unknown → fail safe
    }
    return ws.some((w) => scope.includes(w));
}

/** `workspaces:` list parsed straight from a rule file's frontmatter. */
export function fm_workspaces(text: string): string[] {
    const [fm] = split_frontmatter(text);
    // Flow style: `workspaces: [a, b, c]`
    const flow = /^workspaces:[ \t]*\[([^\]]*)\]/m.exec(fm);
    if (flow) {
        return (flow[1] as string)
            .split(',')
            .map((s) => s.trim().replace(/^["']|["']$/g, ''))
            .filter((s) => s.length > 0);
    }
    // Block style; tolerate the list being the LAST frontmatter key.
    const m = /^workspaces:[ \t]*\n((?:[ \t]+-[ \t]+.*(?:\n|$))+)/m.exec(fm);
    if (!m) {
        return [];
    }
    return [...(m[1] as string).matchAll(/-[ \t]+(\S+)/g)].map((x) => x[1] as string);
}

/** Return [frontmatter_including_fences, body]. Empty fm if none. */
export function split_frontmatter(text: string): [string, string] {
    if (text.startsWith('---\n')) {
        const end = text.indexOf('\n---\n', 4);
        if (end !== -1) {
            return [text.slice(0, end + 5), text.slice(end + 5)];
        }
    }
    return ['', text];
}

function _description(fm: string): string {
    // re.search(r'^description:\s*"?(.+?)"?\s*$', fm, re.MULTILINE)
    const m = /^description:\s*"?(.+?)"?\s*$/m.exec(fm);
    return m ? (m[1] as string).trim() : '';
}

// How many trigger keywords/phrases to surface as the always-on match hint.
const _TRIGGER_HINT_LIMIT = 6;

/** A short, comma-joined sample of the rule's trigger keywords/phrases. */
function _trigger_hint(fm: string): string {
    const hits: string[] = [];
    // re.finditer(r'^\s*-\s*(?:keyword|phrase):\s*"?(.+?)"?\s*$', fm, re.MULTILINE)
    const re = /^\s*-\s*(?:keyword|phrase):\s*"?(.+?)"?\s*$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(fm)) !== null) {
        hits.push((m[1] as string).trim());
        if (hits.length >= _TRIGGER_HINT_LIMIT) {
            break;
        }
    }
    return hits.join(', ');
}

/** Python `str.title()` — uppercase first alpha of each run, rest lowercase. */
function _title(s: string): string {
    return s.replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * The marker that makes a projected entry recognisable as a stub.
 *
 * Exported so the WRITER and every DETECTOR share one definition. A gate that
 * re-spelled this string would drift from the writer silently, and the failure
 * would be invisible in exactly the direction that matters: a stub the gate
 * fails to recognise reads as a complete rule body. Two gates had done exactly
 * that until step 2.1 of `road-to-a-thinned-layer-measured-in-one-unit`; both
 * import this now.
 *
 * SHORTENED 2026-10-06 from 47 characters to 27 (step 2.2). It is paid once per
 * stub and there were 89 stubs on the measured layer, so the sentence cost
 * 4,183 characters of a 97,496-character standing total; at 27 it costs 2,403,
 * a saving of 1,780 = 20 x 89.
 *
 * WHAT THE SHORTENING WAS NOT ALLOWED TO DO: drop the instruction. This is the
 * only standing text in the whole layer that says what a stub is FOR — "load
 * the body" occurs in no kernel rule and in neither root instruction file — so
 * a bare token like `> thin` would have saved more and left nothing that could
 * be followed. The decision record (D2, K6) rejected that explicitly: nothing
 * in this repository can check whether an instruction nobody states is still
 * obeyed.
 *
 * WHY IT MUST STAY LONG ENOUGH TO BE UNIQUE: {@link is_thin_entry} is a
 * substring test over the whole file, so a marker short or generic enough to
 * occur inside ordinary rule prose would make that rule read as a stub — and
 * nine rule files carry blockquote lines. `thin_marker_unique_in_corpus.test.ts`
 * runs the constant against every rule body in `src/rules/` and against every
 * entry `build_thin` emits, in both directions, which is the check that bounds
 * any further shortening.
 */
export const THIN_ENTRY_MARKER = '> Load the body on a match.';

/** Is this projected entry a pointer stub rather than a rule body? */
export function is_thin_entry(text: string): boolean {
    return text.includes(THIN_ENTRY_MARKER);
}

/**
 * What introduces a stub's body pointer. One writer, one reader.
 *
 * A BARE PATH SINCE 2026-10-06 (step 2.3 of
 * `road-to-a-thinned-layer-measured-in-one-unit`). The pointer used to be a
 * markdown link, ``Body: [`<id>`](<prefix><id>.md)``, whose link TEXT repeated
 * the rule id the target already ends in. That cost `6 + len(id)` per stub over
 * the bare form — 2,359 characters across the 89 stubs of the measured layer,
 * 534 of it pure syntax and the rest the id written a second time.
 *
 * Nothing followed the link as a link. Under `delivery` the hook loads the body
 * and never reads the pointer at all; under `thin` an agent reads the path. A
 * markdown link renders in neither case, so the syntax bought rendering nobody
 * was doing.
 */
export const THIN_BODY_POINTER_PREFIX = 'Body: ';

/**
 * The pointer, as the WRITER emits it — exported so a detector cannot re-spell
 * it, which is the same drift {@link THIN_ENTRY_MARKER} documents one screen up
 * and which two gates had already committed there.
 *
 * ANCHORED TO END OF LINE, NOT `\S+`. The pointer is the last thing on its
 * line, and a package root may contain spaces; `\S+` would silently stop at the
 * first one and report a well-formed pointer as missing.
 */
export const THIN_BODY_POINTER_RE = /Body: (.+\.md)\s*$/m;

/** Does this entry carry a body pointer the writer would recognise? */
export function has_body_pointer(text: string): boolean {
    return THIN_BODY_POINTER_RE.test(text);
}

/**
 * Where a stub tells a reader the body actually is.
 *
 * FIXED 2026-09-07: this pointed into the uncondensed source tree ADR-051
 * retired — the literal path is deliberately NOT reproduced here, because
 * `check_no_uncondensed_refs` matches the string and cannot tell a repair
 * record from a live reference; `git log -S` on this file finds the old value.
 * It exists in no checkout, so EVERY stub's fallback pointer
 * resolved to nothing — invisible under `delivery`, where the hook loads the
 * body from `dist/agent-src/rules` and never follows this link, and total under
 * `thin`, where the pointer is the only path to the body there is.
 *
 * KNOWN LIMIT, stated rather than discovered later: one relative prefix cannot
 * be right for every tree, because they sit at different depths — `.claude/rules`
 * and `.cursor/rules` are two levels below the repo root and `.clinerules` is
 * one. `../../` is correct for the first two, which are the only trees the
 * shipped `lean_projection.hosts` default can thin. A stub in `.clinerules`
 * needs an operator to have added `cline` to that list, and its pointer is off
 * by one level. That is strictly better than the previous state, where the
 * pointer was dead in all three, and it is recorded here so the remaining case
 * is a known limit rather than a surprise.
 */
const BODY_LINK_PREFIX = '../../dist/agent-src/rules/';

/**
 * The absolute body-link prefix for a tree whose rules were installed OUT of the
 * repository — `~/.claude/rules`, where no relative prefix can be right.
 *
 * The limit documented on {@link BODY_LINK_PREFIX} is a statement about trees at
 * a KNOWN depth below a repo root. An installed layer has no such relation to
 * the package at all: `~/.claude/rules/x.md` and `<pkg>/dist/agent-src/rules/x.md`
 * share no common ancestor the installer may assume, so the only prefix that can
 * resolve is one rooted at the package the install was made from. The installer
 * knows that path (`package_root`), which is why this takes it rather than
 * deriving it from `import.meta.url` — inside a bundled CLI that arithmetic
 * yields the parent of the package, the same miss `lean_projection_mode`'s header
 * records for the template read.
 *
 * KNOWN LIMIT, stated rather than found later: the pointer is as durable as the
 * package directory it names. A global `npm i -g` install is durable; an `npx`
 * run is not, and a stub written from an ephemeral package root points at a path
 * that will not exist afterwards. That is strictly better than the project-
 * relative prefix, which resolves from an installed layer NEVER, and under
 * `delivery` the hook loads the body and does not follow this link at all.
 */
export function absoluteBodyLinkPrefix(packageRoot: string): string {
    return `${path.join(path.resolve(packageRoot), 'dist', 'agent-src', 'rules')}${path.sep}`;
}

/** Build the minimal progressive-disclosure pointer for a non-kernel rule. */
export function thin_entry(
    rule_id: string,
    text: string,
    bodyLinkPrefix: string = BODY_LINK_PREFIX,
): string {
    const [fm] = split_frontmatter(text);
    const desc = _description(fm);
    const hint = _trigger_hint(fm);
    const title = _title(rule_id.replace(/-/g, ' '));
    const fires = hint ? ` Fires on: ${hint}.` : '';
    return (
        `## ${title}\n` +
        `${THIN_ENTRY_MARKER}${fires} ${desc} ` +
        `${THIN_BODY_POINTER_PREFIX}${bodyLinkPrefix}${rule_id}.md\n`
    );
}

/**
 * The marker that opens a stub's copied law block, and the one that closes it
 * with the digest of what was copied.
 *
 * Exported for the same reason {@link THIN_ENTRY_MARKER} is: a detector that
 * re-spelled either string would drift from the writer silently, and the
 * failure would read as "this stub carries no law" — the one direction that
 * matters.
 */
export const STUB_LAW_OPEN = '<!-- law: byte-copied from the rule, sha256 ';
export const STUB_LAW_CLOSE = '<!-- /law -->';

/** Short digest of a law text — the same function the stub writer and any reader use. */
export function lawDigest(law: string): string {
    return createHash('sha256').update(law, 'utf-8').digest('hex').slice(0, 16);
}

/**
 * Raised when a class member cannot carry its law and has not said so.
 *
 * The roadmap's own words: a class member whose law section is missing or over
 * the ceiling FAILS the projection rather than shipping a shortened copy. The
 * declared `no_stub` subset is the escape, and it costs a reason in the diff —
 * which is the whole difference between an exception and a silent shrink.
 */
export class StubLawError extends Error {
    readonly ruleId: string;

    constructor(ruleId: string, message: string) {
        super(message);
        this.name = 'StubLawError';
        this.ruleId = ruleId;
    }
}

/** Characters of law a stub may carry — the hard ceiling `lint_rule_law_section` holds. */
export const STUB_LAW_MAX_CHARS = 2_000;

/**
 * A stub that carries the rule's own law, byte for byte.
 *
 * The council rejected a compiled or summarised contract: a second
 * authoritative representation of a rule is a new trust boundary whose
 * omissions read as permission. So nothing here rewrites, truncates or
 * reformats — the law text is `slice`d out of the source body and emitted
 * verbatim, and the digest beside it is what makes "verbatim" checkable rather
 * than asserted.
 */
export function thin_entry_with_law(
    rule_id: string,
    text: string,
    bodyLinkPrefix: string = BODY_LINK_PREFIX,
): string {
    const law = lawText(ruleBody(text));
    if (law === null) {
        throw new StubLawError(
            rule_id,
            `${rule_id} is a high-consequence class member with no law section — write one, or ` +
                `record it under \`no_stub\` in src/config/rule-consequence-class.json with the reason`,
        );
    }
    if (law.length > STUB_LAW_MAX_CHARS) {
        throw new StubLawError(
            rule_id,
            `${rule_id} is a high-consequence class member whose law section is ${law.length} chars, ` +
                `over the ${STUB_LAW_MAX_CHARS} ceiling — a stub never ships a shortened copy, so either ` +
                'the law moves under the ceiling or the rule is recorded under `no_stub` in ' +
                'src/config/rule-consequence-class.json with the reason',
        );
    }
    return (
        thin_entry(rule_id, text, bodyLinkPrefix) +
        `\n${STUB_LAW_OPEN}${lawDigest(law)} -->\n` +
        `${law}\n` +
        `${STUB_LAW_CLOSE}\n`
    );
}

/**
 * Overridable roots for a {@link build_thin} caller outside this repository.
 *
 * Added for `road-to-an-installed-layer-that-is-thinned` step 1.1: the INSTALLER
 * applies the projector's predicate to `~/.claude/rules`, and it must read the
 * router and the consequence class from the package it is installing FROM, not
 * from wherever `import.meta.url` happens to resolve in a bundle.
 */
export interface ThinRoots {
    /** Package root carrying `dist/router.json` and `src/config/`. */
    readonly packageRoot?: string;
    /** Explicit router path, overriding the one derived from `packageRoot`. */
    readonly routerPath?: string;
    /** Prefix a stub's `Body:` link is built on — see {@link absoluteBodyLinkPrefix}. */
    readonly bodyLinkPrefix?: string;
}

/** Map {filename: thin_or_full_text} for every rule. Kernel stays full. */
export function build_thin(
    rules_dir: string = RULES_SOURCE,
    scope: readonly string[] | null = null,
    /**
     * Optional sink for the D3 diagnostic
     * (road-to-delivery-for-every-host 2.2).
     *
     * An `auto` rule the router gives NO trigger is already kept full-bodied by
     * `noTrigger` below, which is the substantive protection and predates this
     * roadmap. What did not exist is any way to SEE it happen: the rule is
     * silently exempted, so an author who removes a rule's last trigger gets a
     * silently eager rule and no signal. The line makes the exemption audible.
     */
    announce: ((message: string) => void) | null = null,
    /**
     * The high-consequence class. Defaults to the committed config; a caller
     * may inject one so a fixture can drive the stub-law form without a tree.
     */
    consequenceClass: ConsequenceClassConfig | null = null,
    /**
     * Where the router, the consequence class and the stub body links come from
     * when the caller is NOT this repository's own projector.
     *
     * Every default below is derived from {@link REPO_ROOT}, which is
     * `import.meta.url` four directories up. That is correct for a module read
     * from `<pkg>/src/scripts/`, and wrong inside a bundled CLI, where the same
     * arithmetic lands on the PARENT of the package — so a caller that knows the
     * real package root hands it over instead of letting the module guess.
     */
    roots: ThinRoots | null = null,
): Map<string, string> {
    const routerPath = roots?.routerPath ?? (roots?.packageRoot === undefined
        ? ROUTER
        : path.join(roots.packageRoot, 'dist', 'router.json'));
    const classRoot = roots?.packageRoot ?? REPO_ROOT;
    const bodyLinkPrefix = roots?.bodyLinkPrefix ?? BODY_LINK_PREFIX;
    const kernel = kernel_ids(routerPath);
    const noTrigger = no_trigger_ids(routerPath);
    const pathOnly = path_only_ids(routerPath);
    const cls = consequenceClass ?? readConsequenceClass(classRoot);
    const lawInStub = stubLawIds(cls);
    const wsMap = scope !== null ? rule_workspaces_map(routerPath) : new Map<string, string[]>();
    const out = new Map<string, string>();
    for (const p of _globSortedMd(rules_dir)) {
        const text = fs.readFileSync(p, 'utf-8');
        const stem = path.basename(p).replace(/\.md$/, '');
        if (!id_in_scope(stem, scope, kernel, wsMap, fm_workspaces(text))) {
            continue; // out of workspace scope — no body, no pointer line
        }
        // A declared `no_stub` member keeps its whole body. Its law cannot be
        // copied into a stub, and a stub with no law is exactly the shape the
        // class exists to prevent for these rules — so the safe residue is the
        // full text, not a pointer.
        const noStub = cls.no_stub[stem] !== undefined;
        const full = kernel.has(stem) || noTrigger.has(stem) || pathOnly.has(stem) || noStub;
        if (announce !== null && noTrigger.has(stem) && !kernel.has(stem)) {
            announce(`D3: trigger-less auto rule ${path.basename(p)} — kept full-bodied, never thinned`);
        }
        if (announce !== null && pathOnly.has(stem) && !kernel.has(stem) && !noTrigger.has(stem)) {
            announce(
                `E2: path-only auto rule ${path.basename(p)} — kept full-bodied; its only triggers ` +
                    `are path-shaped and the delivery concern is not bound on pre_tool_use`,
            );
        }
        if (full) {
            out.set(path.basename(p), text);
            continue;
        }
        if (lawInStub.has(stem)) {
            if (announce !== null) {
                announce(
                    `LAW: high-consequence rule ${path.basename(p)} — stub carries its own law section, byte-copied`,
                );
            }
            out.set(path.basename(p), thin_entry_with_law(stem, text, bodyLinkPrefix));
            continue;
        }
        out.set(path.basename(p), thin_entry(stem, text, bodyLinkPrefix));
    }
    return out;
}

