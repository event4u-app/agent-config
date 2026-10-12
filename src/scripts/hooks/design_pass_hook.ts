#!/usr/bin/env node
/**
 * Design pass — the delivery carrier the 0.0 % measurement never had.
 *
 * Steps E1.1, E1.2 and E1.3 of `road-to-frontend-power`. One script bound on
 * two slots, because the two passes differ in scope and not in logic:
 *
 *   post_tool_use  (E1.1) — the file just written. Findings as context, exit 0.
 *   stop           (E1.2) — every UI file touched this session, deduped
 *                           against what E1.1 already surfaced. P0 blocks (E1.3).
 *
 * WHY post_tool_use AND NOT pre_tool_use, which is where `design-slop` sits.
 * Two measured reasons, both from this branch's Phase 0:
 *
 *   1. REACH. `pre_tool_use` is declared by three hosts (augment, claude,
 *      cowork) and honoured by one. `post_tool_use` is declared by six. A
 *      carrier that cannot reach the host cannot deliver anything, and the
 *      0.0 % was a delivery failure before it was anything else.
 *   2. THE GREENFIELD ASYMMETRY. `_lib/ui_surface.ts` is a PATH predicate, so a
 *      UI intent that has not yet produced a file is invisible to it — measured
 *      at 20/23 recall, with all three misses being exactly that case
 *      (`internal/bench/frontend-power/BASELINE-2026-08-23.md` § Routing). A
 *      pre-write gate keyed on the path therefore cannot fire on the FIRST
 *      write of a new surface, which is the write it most wants. After the
 *      write the file exists and the predicate answers.
 *
 * SEVERITY CONTRACT, AND THE HONEST LIMIT ON IT. The stop pass COMPUTES a P0
 * verdict and reports it as "would block at stop". It does not return
 * EXIT_BLOCK, because the concern is declared `severity: advisory` and the
 * dispatcher enforces advisory as a CEILING — an EXIT_BLOCK from here would be
 * downgraded to EXIT_WARN and then mapped to exit 0, i.e. an inert refusal that
 * every other assertion about it would still pass. Shipping that is worse than
 * not blocking, so the code matches the declaration.
 *
 * Making the refusal real means adding this to the BLOCKING_ALLOWLIST in
 * `tests/hooks/concern_severity.test.ts`, whose own header says adding to it is
 * a security-relevant decision — and this would be the third turn-END refusal
 * in the tree. That is transferred with E1.4 rather than taken here.
 *
 * P1-P3 are delivered and never block, on either slot —
 * Risk 1 of the parent roadmap is that one false block on clean UI makes an
 * operator disable the carrier for good, which is the OFF state the 0.0 %
 * already recorded. Only P0 blocks, only at stop, and only the objective
 * floors: those are `lint_design_quality`'s territory (contrast, font size,
 * heading skip, focus), never an aesthetic tell.
 *
 * GRAFT 2. A pass that could not run reports `verification: degraded` with a
 * reason instead of passing silently. `src/rules/design-review-after-ui-write.md`
 * already required that in prose with nothing to read it; this emits it.
 *
 * SVG ROUTING, AND HOW TO REVERT IT. Step 1.3 of
 * `road-to-svg-rules-in-the-dispatch-path`. An `.svg` write reaches
 * `lint_svg_asset`'s rules from here, inside or outside a UI tree, through
 * `svg_rules_loader` — a CJS chunk beside the dispatch bundle, required only
 * for a path ending in `.svg`. The review that withdrew the first attempt
 * named the gap plainly: a statically bundled rule set has no off switch, so
 * the triggers and the mechanism are written down before they are needed.
 *
 *   REVERT WHEN any of these is read:
 *     · the composition gate exceeds its ceiling attributable to this routing
 *       (`check_hook_bundle_composition`; measured 2,128 B on 2026-10-11, with
 *       16,910 B of headroom left);
 *     · a non-`.svg` hook event is observed failing with a stack that passes
 *       through the chunk — the containment case
 *       `design_pass_svg.test.ts > rule-failure-does-not-reach-an-unrelated-event`
 *       exists to make impossible, so one observation is enough;
 *     · an operator reports SVG false positives on files they accept, at a rate
 *       that would make them switch the carrier off — Risk 1 of the parent
 *       roadmap, and the failure this whole concern is shaped around.
 *
 *   THE MECHANISM, in increasing order of blast radius:
 *     1. Delete `dist/hooks/svg_rules.chunk.cjs`. The loader returns `null`,
 *        the pass reports `verification: degraded` naming the missing file,
 *        and every other finding family is unaffected. This is the per-install
 *        off switch the static import could not have had.
 *     2. Drop `isSvgAsset` from `isPassSurface` below. An `.svg` outside a UI
 *        tree stops reaching the pass at all; one inside it reads as it did
 *        before this step.
 *     3. Turn the concern off entirely (`hooks.design_pass.enabled: false`),
 *        which was already the default.
 *
 * Default-OFF (`hooks.design_pass.enabled`), fail_closed: false.
 *
 * Exit codes (dispatcher contract): 0 allow · 1 block · 2 warn + JSON reason.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { appendDischarge, stamp } from '../_lib/obligations.js';
import { compareInputs } from '../_lib/probe_inputs.js';
import { trigger_matches, type Trigger } from '../_lib/router_match.js';
import { isUiPath, isUiTreePath } from '../_lib/ui_surface.js';
import { loadDesignContext, scanFile } from '../lint_design_slop.js';
import { readHookStdin } from './hook_stdin.js';
import { CHUNK_BASENAME, loadSvgScan } from './svg_rules_loader.js';
import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';

const SETTINGS_FILE = '.agent-settings.yml';
const STATE_REL = path.join('agents', 'runtime', 'state', 'design-pass-hook.json');
const AUDIT_REL = path.join('agents', 'runtime', 'state', 'ui-audit.json');
const CONFORMANCE_REL = path.join('agents', 'runtime', 'state', 'ui-conformance.json');

/**
 * The P0 set — objective floors only, and the list is closed on purpose.
 * Text-overflow and viewport-edge join it once E3's render artefact is a
 * precondition the gate can rely on; until then a static pass cannot see them
 * and claiming otherwise would be the false block Risk 1 names.
 */
export const P0_FLOOR_IDS = ['Q1', 'Q2', 'Q5', 'Q6'] as const;

export type Verification = 'verified' | 'degraded' | 'unverified';

export interface Finding {
    file: string;
    severity: 'P0' | 'P1' | 'P2' | 'P3';
    catalogId: string;
    rule: string;
    line: number;
    message: string;
}

export interface PassResult {
    slot: 'post_tool_use' | 'stop';
    findings: Finding[];
    blocked: Finding[];
    audit_missing: string[];
    verification: Verification;
    degradation_reason?: string;
}

/** Minimal settings reader — mirrors design_slop_hook rather than adding a parser. */
export function enabled(root: string, key = 'design_pass'): boolean {
    let text: string;
    try {
        text = fs.readFileSync(path.join(root, SETTINGS_FILE), 'utf-8');
    } catch {
        return false;
    }
    let inHooks = false;
    let inKey = false;
    for (const raw of text.split(/\r\n|\r|\n/)) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.trimStart().startsWith('#')) continue;
        if (!/^\s/.test(line)) {
            inHooks = /^hooks\s*:\s*$/.test(line);
            inKey = false;
            continue;
        }
        if (!inHooks) continue;
        const m2 = /^ {2}(\S[^:]*)\s*:\s*$/.exec(line);
        if (m2) {
            inKey = m2[1]!.trim() === key;
            continue;
        }
        if (inKey) {
            const m4 = /^ {4}enabled\s*:\s*(\S+)/.exec(line);
            if (m4) return /^(true|yes|on)$/i.test(m4[1]!);
        }
    }
    return false;
}

/**
 * True for a path this pass should look at.
 *
 * `.svg` is admitted HERE and nowhere else — step 1.2 of
 * `road-to-svg-rules-in-the-dispatch-path`. The obvious way to reach an `.svg`
 * from this pass was to add `svg` to `UI_EXTENSIONS`, and that is the thing the
 * parent roadmap's decision E10 and `design_pass_svg.test.ts` forbid: the same
 * predicate backs `ui_route_nudge_hook`'s `isUiWrite`, so widening it would
 * draw a UI routing nudge and its tokens on every icon dropped into `public/`.
 * A local disjunct reaches the asset without touching the shared predicate, in
 * either direction.
 */
export const isSvgAsset = (p: string): boolean => /\.svg$/i.test(p);

/**
 * UNCHANGED, and that is the point of the predicate below it.
 *
 * Finding 6 of this change's own completion review: widening THIS predicate to
 * admit every `.svg` would have moved the UI-turn denominator the
 * consultation-rate measurement is defined against — which the
 * `HANDOVER_TRIGGERS` note further down reserves, in writing, as a different
 * decision than any routing change. It was widened and is widened no longer.
 */
export const isUiSurface = (p: string): boolean => isUiPath(p) || isUiTreePath(p);

/**
 * What this PASS looks at — a UI surface, or any `.svg`.
 *
 * The routing step 1.2 of `road-to-svg-rules-in-the-dispatch-path` asked for,
 * in the one place it belongs: the pass's own entry gate. Keeping it out of
 * `isUiSurface` leaves every other reading that predicate feeds — the
 * conformance verdict's noteworthy test, the denominator above — reading
 * exactly what it read before.
 */
export const isPassSurface = (p: string): boolean => isUiSurface(p) || isSvgAsset(p);

/**
 * The shadow read of `ui-conformance.json` — Phase 5 of
 * `road-to-behaviour-evidence-over-pixels`.
 *
 * SHADOW MEANS SHADOW. This produces a line in the reported verdict and
 * touches nothing else: it is not consulted by `decide`, never reaches
 * `blocked`, and cannot change an exit code. The roadmap adds evidence, not
 * enforcement, and the block path is deliberately untouched by this change.
 *
 * An ABSENT artefact is reported as absent, never as clean — the same rule the
 * probe applies to its own dimensions. A malformed one is reported as
 * unreadable for the same reason.
 */
export interface ConformanceVerdict {
    /**
     * Whether this verdict is worth surfacing on its own. An ABSENT artefact is
     * not: most repositories never run the probe, and a line on every clean UI
     * write is the noise that gets a carrier switched off — Risk 1 of the parent
     * roadmap. Absent is still reported honestly whenever the pass speaks for
     * another reason.
     *
     * The ONE exception is a turn that actually touched a provided design
     * handover. There, the probe is the evidence the turn was supposed to
     * produce, and its absence is the noteworthy kind.
     */
    noteworthy: boolean;
    line: string;
}

export interface ConformanceOptions {
    /**
     * Whether a provided design handover was among the files this turn wrote.
     * Decided by `handoverTouched` from the shipped routing triggers, never by a
     * matcher invented here.
     */
    handoverDetected?: boolean;
}

/**
 * The file-based half of `src/rules/design-fidelity.md`'s `triggers:` set — the
 * shipped answer to "is this file a provided design handover?".
 *
 * COPIED AS A CONSTANT, MATCHED BY THE SHIPPED MATCHER. Reading and parsing the
 * rule's frontmatter here would put a YAML load on `post_tool_use`, the hottest
 * slot this concern binds, and would depend on a rule path that differs between
 * this repository and an installed consumer. The drift that a constant invites
 * is closed by a test instead: `design_pass.test.ts` asserts this list equals the
 * rule's file-based triggers in BOTH directions, so a trigger added to the rule
 * and not here fails CI.
 *
 * THE HONEST REACH. Only the two HTML patterns are reachable through this
 * carrier. `.claude/design-system/` names JSON and token files, which
 * `isUiSurface` does not admit, so `main` returns before the verdict is
 * computed. Widening `isUiSurface` to admit them would change the UI-turn
 * denominator that the consultation-rate measurement is defined against, which
 * is a different decision than this one. The prefix stays for parity with the
 * rule and is stated as unreachable rather than quietly dropped.
 */
export const HANDOVER_TRIGGERS: readonly Trigger[] = [
    { file_pattern: '*design.html' },
    { file_pattern: '*.dc.html' },
    { path_prefix: '.claude/design-system/' },
];

/** True when any of the paths this turn wrote is a provided design handover. */
export function handoverTouched(paths: readonly string[]): boolean {
    if (!paths.length) return false;
    return HANDOVER_TRIGGERS.some((t) => trigger_matches(t, '', paths, null));
}

export function conformanceVerdict(root: string, opts: ConformanceOptions = {}): ConformanceVerdict {
    let raw: string;
    try {
        raw = fs.readFileSync(path.join(root, CONFORMANCE_REL), 'utf-8');
    } catch {
        const base =
            'ui-conformance: absent — no probe artefact for this change (run `ui_conformance_probe --target <file> --reference <file>`). Absent is not clean.';
        return opts.handoverDetected
            ? {
                  noteworthy: true,
                  line: `${base} A provided design handover was touched this turn, so this is the absence worth naming.`,
              }
            : { noteworthy: false, line: base };
    }
    try {
        const a = JSON.parse(raw) as {
            structure_gate?: string;
            inputs?: unknown;
            dimensions?: { dimension: string; status: string; findings: number | null; reason?: string }[];
            findings?: { dimension?: string; probe_id?: string; expected?: string; observed?: string }[];
        };

        // Before anything is counted. A finding count measured against inputs
        // that have since moved is the misleading half of a stale artefact, so
        // the count is withheld rather than printed beside a warning.
        const inputs = compareInputs(a.inputs, (p) => (path.isAbsolute(p) ? p : path.join(root, p)));
        if (inputs.verdict === 'moved') {
            return {
                noteworthy: true,
                line: [
                    `ui-conformance: stale — ${inputs.moved.join(', ')} changed since the probe ran, so its findings ` +
                        'describe inputs that no longer exist. The count is withheld rather than reported against ' +
                        'them; re-run `ui_conformance_probe --target <file> --reference <file>`.',
                    '  (shadow verdict: reported, never enforced — this pass does not block on it)',
                ].join('\n'),
            };
        }

        const rows = a.dimensions ?? [];
        const exercised = rows.filter((r) => r.status === 'exercised');
        const notApplicable = rows.filter((r) => r.status !== 'exercised');
        const counts = exercised.map((r) => `${r.dimension}=${r.findings}`).join(' ');
        const parts = [
            `ui-conformance: ${(a.findings ?? []).length} behavioural finding(s) — ${counts || 'no dimension exercised'}`,
        ];
        if (notApplicable.length) {
            parts.push(
                `  · not applicable: ${notApplicable
                    .map((r) => `${r.dimension} (${r.reason ?? 'no reason given'})`)
                    .join('; ')}`,
            );
        }
        if (a.structure_gate === 'stopped') {
            parts.push('  · structure gate stopped on at least one node — style comparison was skipped for it');
        }
        // The added-element half. This line already said "Absent is not clean"
        // about a missing artefact; the probe's structure dimension could only
        // ever show the omit half of "never omit or add an element", so this is
        // the one number the verdict could not print. Derived from the findings
        // the probe already writes — no new artefact field is read.
        const addedElements = (a.findings ?? []).filter(
            (f) => f.dimension === 'structure' && f.expected === 'absent' && f.observed === 'present',
        );
        if (addedElements.length) {
            parts.push(
                `  · ${addedElements.length} element(s) present in the target and absent from the reference: ` +
                    `${addedElements.map((f) => f.probe_id ?? '?').join(', ')} — added, not ported`,
            );
        }
        parts.push(
            inputs.verdict === 'unchanged'
                ? '  · inputs: unchanged since the probe ran'
                : // Unknown is a version skew, not evidence of movement — and
                  // equally not evidence of freshness. Saying so is the whole
                  // point: an artefact from before the digests existed must read
                  // neither stale nor fresh.
                  `  · inputs: unknown — ${inputs.reason}`,
        );
        parts.push('  (shadow verdict: reported, never enforced — this pass does not block on it)');
        return {
            noteworthy: (a.findings ?? []).length > 0 || a.structure_gate === 'stopped' || notApplicable.length > 0,
            line: parts.join('\n'),
        };
    } catch {
        return {
            noteworthy: true,
            line: 'ui-conformance: unreadable — the artefact exists but did not parse. Reported rather than ignored.',
        };
    }
}

/**
 * E2.2 — is the audit artefact newer than the target?
 *
 * "Newer" is the whole point: a stale artefact is worse than a missing one,
 * because it looks like evidence. An artefact older than the file it is
 * supposed to describe has not seen the change.
 */
/**
 * Record that the UI-audit obligation was discharged, when it was.
 *
 * This concern is the only thing in the tree that knows. It already decides
 * audit freshness for its own advisory line; until now that decision was spent
 * on one message and thrown away, so a turn-end reader asking "was the audit
 * done?" had to re-derive a verdict it does not own. The decision existed —
 * only the write was missing.
 *
 * Discharged means: at least one target was touched AND every one of them has
 * a fresh audit. A partial pass records nothing, because `ui-audit-gate`'s
 * obligation is about the surfaces this turn wrote, not about a quorum of them.
 *
 * NO PER-WRITE VALIDATOR IS ADDED. The write is one small append behind the
 * same lock the ledger already uses, on a path that has an mtime comparison in
 * front of it — deliberately, because this concern sits on `post_tool_use`,
 * the hottest slot it binds, and a validation pass per write is exactly the
 * cost the phase forbids.
 */
export function recordAuditDischarge(
    root: string,
    targets: readonly string[],
    auditMissing: readonly string[],
): void {
    if (targets.length === 0 || auditMissing.length > 0) return;
    const session = (process.env["CLAUDE_CODE_SESSION_ID"] ?? "").trim();
    if (session === "") return;
    try {
        appendDischarge(root, session, [
            { rule: "ui-audit-gate", by: "design-pass", at: stamp() },
        ]);
    } catch {
        // A discharge that cannot be recorded is a missing reading, never a
        // reason to fail the write that prompted it.
    }
}

export function auditIsFresh(root: string, target: string): boolean {
    try {
        const a = fs.statSync(path.join(root, AUDIT_REL)).mtimeMs;
        const t = fs.statSync(path.isAbsolute(target) ? target : path.join(root, target)).mtimeMs;
        return a >= t;
    } catch {
        return false;
    }
}

/**
 * `ui-trivial` — decidable from the diff alone, per the two UI rules. All five
 * conditions, not the four the rules' prose carries: `ui_trivial/apply.ts`
 * enforces `new_dependency` too, and a carrier copying the shorter list would
 * inherit a gap the engine does not have.
 */
export interface DiffShape {
    files: number;
    changedLines: number;
    newComponent: boolean;
    newState: boolean;
    newDependency: boolean;
}
export function isUiTrivial(d: DiffShape): boolean {
    return (
        d.files <= 1 &&
        d.changedLines <= 5 &&
        !d.newComponent &&
        !d.newState &&
        !d.newDependency
    );
}

/** Pure core: what the pass decides, given findings and freshness facts. */
export function decide(
    slot: PassResult['slot'],
    findings: readonly Finding[],
    auditMissing: readonly string[],
    already: ReadonlySet<string>,
    renderAvailable: boolean,
): PassResult {
    const sig = (f: Finding): string => `${f.file}::${f.rule}::${f.line}`;
    const fresh = findings.filter((f) => !already.has(sig(f)));

    // P0 is a stop-slot verdict only. On post_tool_use everything is delivery:
    // a block mid-turn cannot be acted on without re-entering the same write.
    //
    // `blocked` is the COMPUTED verdict, not an exit code. `main` reports it and
    // returns EXIT_WARN — see the severity note in the header for why an
    // EXIT_BLOCK from an advisory concern would be inert rather than strict.
    const blocked = slot === 'stop' ? fresh.filter((f) => f.severity === 'P0') : [];

    // Graft 2. The absent render artefact is the honest degradation: two P0
    // floors (text overflow, viewport edge) are simply not decidable from text,
    // so a "clean" verdict without a render is scoped, not complete.
    const verification: Verification = renderAvailable ? 'verified' : 'degraded';

    return {
        slot,
        findings: fresh,
        blocked,
        audit_missing: [...auditMissing],
        verification,
        ...(renderAvailable
            ? {}
            : {
                  degradation_reason:
                      'no render artefact under agents/runtime/state/render/ — the viewport-dependent ' +
                      'floors were not checked. Run `agent-config ui:render <path>` to lift this.',
              }),
    };
}

interface State {
    surfaced: string[];
    touched: string[];
}

function readState(root: string): State {
    try {
        const raw = JSON.parse(fs.readFileSync(path.join(root, STATE_REL), 'utf-8')) as Partial<State>;
        return { surfaced: raw.surfaced ?? [], touched: raw.touched ?? [] };
    } catch {
        return { surfaced: [], touched: [] };
    }
}

function writeState(root: string, s: State): void {
    try {
        const p = path.join(root, STATE_REL);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, `${JSON.stringify(s, null, 2)}\n`);
    } catch {
        /* an unwritable state dir costs dedup, never the pass */
    }
}

function renderAvailable(root: string): boolean {
    try {
        return fs.readdirSync(path.join(root, 'agents', 'runtime', 'state', 'render')).length > 0;
    } catch {
        return false;
    }
}

/**
 * SVG severity → this pass's severity.
 *
 * `error` and `warning` become P1 and P2; `inert` is dropped. Deliberately NOT
 * P0: the P0 set above is a closed list of objective floors and it is the only
 * thing that computes a block at stop. Routing a new rule family into it would
 * change the block surface, which is a different decision than making the
 * findings visible — and the one Risk 1 of the parent roadmap warns about.
 */
export function svgSeverity(s: 'error' | 'warning' | 'inert'): Finding['severity'] | null {
    if (s === 'error') return 'P1';
    if (s === 'warning') return 'P2';
    return null;
}

export interface SvgRuleFinding {
    rule: string;
    file: string;
    line: number;
    snippet: string;
    severity: 'error' | 'warning' | 'inert';
}

/**
 * Map the SVG rule set's findings onto this pass's shape.
 *
 * Pure, and exported, so the routing can be proven without building a bundle:
 * the half that is expensive to exercise end-to-end is the chunk load, and that
 * has its own test in `svg_rules_loader`.
 */
export function svgFindings(raw: readonly SvgRuleFinding[], rel: string): Finding[] {
    const out: Finding[] = [];
    for (const f of raw) {
        const severity = svgSeverity(f.severity);
        if (severity === null) continue;
        out.push({
            file: rel,
            severity,
            catalogId: 'SVG',
            rule: f.rule,
            line: f.line,
            message: `${f.rule}${f.snippet ? ` — ${f.snippet}` : ''}`,
        });
    }
    return out;
}

/** Extracts the written path from a tool payload, whichever key the host uses. */
export function targetPath(payload: unknown): string | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const o = payload as Record<string, unknown>;
    const input = (o['tool_input'] ?? o['input'] ?? o) as Record<string, unknown>;
    for (const k of ['file_path', 'path', 'filePath', 'target_file']) {
        const v = input?.[k];
        if (typeof v === 'string' && v) return v;
    }
    return null;
}

export function render(result: PassResult, conformance?: string): string {
    const lines: string[] = [];
    if (result.blocked.length) {
        lines.push(
            `Design pass — ${result.blocked.length} P0 floor violation(s) WOULD BLOCK at stop ` +
                '(reported, not enforced: this concern is advisory — see its manifest note):',
        );
        for (const f of result.blocked) lines.push(`  ✗ [${f.catalogId}] ${f.file}:${f.line} — ${f.message}`);
    }
    const advisory = result.findings.filter((f) => !result.blocked.includes(f));
    if (advisory.length) {
        lines.push(`Design pass — ${advisory.length} finding(s), advisory:`);
        for (const f of advisory.slice(0, 12))
            lines.push(`  · [${f.severity} ${f.catalogId}] ${f.file}:${f.line} — ${f.message}`);
        if (advisory.length > 12) lines.push(`  … and ${advisory.length - 12} more`);
    }
    for (const m of result.audit_missing)
        lines.push(`  · no ui-audit.json newer than ${m} — run \`agent-config ui:audit <path>\``);
    lines.push(`verification: ${result.verification}`);
    if (result.degradation_reason) lines.push(`degradation_reason: ${result.degradation_reason}`);
    // Appended last and never consulted above: the conformance verdict is a
    // report, not an input to any decision this pass makes.
    if (conformance) lines.push(conformance);
    return lines.join('\n');
}

function main(): number {
    const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
    if (!enabled(root)) return EXIT_ALLOW;

    const slotArg = process.argv.includes('--slot') ? process.argv[process.argv.indexOf('--slot') + 1] : undefined;
    const slot: PassResult['slot'] = slotArg === 'stop' ? 'stop' : 'post_tool_use';

    let payload: unknown = null;
    try {
        payload = JSON.parse(readHookStdin() || 'null');
    } catch {
        return EXIT_ALLOW; // fail_closed: false — an unparsable payload is not a block
    }

    const state = readState(root);
    let targets: string[];
    if (slot === 'stop') {
        targets = state.touched;
    } else {
        const t = targetPath(payload);
        if (!t || !isPassSurface(t)) return EXIT_ALLOW;
        targets = [t];
        if (!state.touched.includes(t)) state.touched.push(t);
    }
    if (!targets.length) return EXIT_ALLOW;

    // Findings come from the shipped registry, via the same entrypoint CI uses.
    const findings: Finding[] = [];
    let scanFailed: string | null = null;
    let svgRulesUnavailable = false;
    try {
        const ctx = loadDesignContext(root);
        for (const rel of targets) {
            const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
            if (!fs.existsSync(abs)) continue;
            // scanFile takes (content, relPath, ctx) — the hook reads the file
            // itself rather than handing over a path, which is also what lets a
            // post-write pass see the bytes that were just written.
            const content = fs.readFileSync(abs, 'utf-8');
            if (isSvgAsset(rel)) {
                // The conditional chunk. Loaded only here, so a hook event that
                // never touched an `.svg` pays none of its bytes and runs none
                // of its code — the containment `design_pass_svg.test.ts` pins.
                // A null load is reported through `svgRulesUnavailable`, never
                // thrown: a consumer whose install is missing the chunk must
                // lose the SVG findings, not the whole dispatch.
                const scan = loadSvgScan();
                if (scan === null) svgRulesUnavailable = true;
                else findings.push(...svgFindings(scan(content, rel) as SvgRuleFinding[], rel));
            }
            for (const f of scanFile(content, rel, ctx)) {
                findings.push({
                    file: rel,
                    severity: f.severity as Finding['severity'],
                    catalogId: f.catalogId,
                    rule: f.rule,
                    line: f.line,
                    message: f.message,
                });
            }
        }
    } catch (err) {
        scanFailed = String(err);
    }

    // The audit question is asked of UI SURFACES, never of the pass surface.
    // Findings 1 and 2 of the third completion review, both reproduced by
    // running the hook: round one split the entry gate from the UI predicate,
    // and `targets` carried the `.svg` past the split anyway. So a clean
    // conformant icon write exited WARN with "no ui-audit.json newer than
    // public/icon.svg" — an asset has no component inventory to be audited
    // against — and, worse, `recordAuditDischarge` returns early on a non-empty
    // `auditMissing`, so writing ONE `.svg` in a turn silently suppressed the
    // ui-audit discharge row for every real UI file in that same turn.
    const auditTargets = targets.filter((t) => isUiSurface(t));
    const auditMissing = auditTargets.filter((t) => !auditIsFresh(root, t));
    recordAuditDischarge(root, auditTargets, auditMissing);
    let result = decide(slot, findings, auditMissing, new Set(state.surfaced), renderAvailable(root));
    if (scanFailed) {
        result = { ...result, verification: 'unverified', degradation_reason: `detector unavailable: ${scanFailed}` };
    } else if (svgRulesUnavailable) {
        // Degraded, not unverified: the rest of the pass ran. An absent chunk
        // is reported rather than silently producing a clean SVG verdict —
        // "absent is not clean" is the same rule the conformance verdict keeps.
        // APPENDED, never overwritten. Finding 6 of the fourth completion
        // review: `decide` may already have set a reason — the renderer being
        // absent is the one it sets — and assigning here threw it away, so a
        // turn where both degradations held reported only the newer one. Two
        // degradations are two facts; the operator needs both or they fix one
        // and are surprised by the other.
        const svgReason = `the SVG rule set could not be loaded (expected dist/hooks/${CHUNK_BASENAME} beside the dispatch bundle) — the .svg files in this turn were not checked`;
        result = {
            ...result,
            verification: 'degraded',
            degradation_reason:
                result.degradation_reason === undefined || result.degradation_reason === ''
                    ? svgReason
                    : `${result.degradation_reason}; ${svgReason}`,
        };
    }

    for (const f of result.findings) state.surfaced.push(`${f.file}::${f.rule}::${f.line}`);
    if (slot === 'stop') state.touched = [];
    writeState(root, state);

    // Shadow mount. The verdict can make the pass SPEAK when it would otherwise
    // be silent — a behavioural finding is exactly the thing no static scan can
    // see — but it cannot make it refuse. `result.blocked` above is computed
    // without it and the exit code below is unchanged.
    const conformance = conformanceVerdict(root, { handoverDetected: handoverTouched(targets) });

    if (
        !result.findings.length &&
        !result.audit_missing.length &&
        result.verification === 'verified' &&
        !conformance.noteworthy
    ) {
        return EXIT_ALLOW;
    }

    process.stdout.write(`${JSON.stringify({ reason: render(result, conformance.line) })}\n`);
    // Deliberately EXIT_WARN even with a P0 verdict. EXIT_BLOCK is unreachable
    // for an advisory concern (the dispatcher downgrades it), so returning it
    // would claim a refusal the transport discards.
    return EXIT_WARN;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    process.exit(main());
}
export { main as _main };
export const _HERE = fileURLToPath(import.meta.url);
