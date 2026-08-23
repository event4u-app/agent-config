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
 * SEVERITY CONTRACT. P1-P3 are delivered and never block, on either slot —
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
 * Default-OFF (`hooks.design_pass.enabled`), fail_closed: false.
 *
 * Exit codes (dispatcher contract): 0 allow · 1 block · 2 warn + JSON reason.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isUiPath, isUiTreePath } from '../_lib/ui_surface.js';
import { readHookStdin } from './hook_stdin.js';

const EXIT_ALLOW = 0;
const EXIT_BLOCK = 1;
const EXIT_WARN = 2;
const SETTINGS_FILE = '.agent-settings.yml';
const STATE_REL = path.join('agents', 'runtime', 'state', 'design-pass-hook.json');
const AUDIT_REL = path.join('agents', 'runtime', 'state', 'ui-audit.json');

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

export const isUiSurface = (p: string): boolean => isUiPath(p) || isUiTreePath(p);

/**
 * E2.2 — is the audit artefact newer than the target?
 *
 * "Newer" is the whole point: a stale artefact is worse than a missing one,
 * because it looks like evidence. An artefact older than the file it is
 * supposed to describe has not seen the change.
 */
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

    // P0 blocks at stop only. On post_tool_use everything is delivery: a block
    // mid-turn cannot be acted on without re-entering the same write.
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

export function render(result: PassResult): string {
    const lines: string[] = [];
    if (result.blocked.length) {
        lines.push(
            `Design pass — ${result.blocked.length} P0 floor violation(s) must be fixed before this turn ends:`,
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
    return lines.join('\n');
}

async function main(): Promise<number> {
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
        if (!t || !isUiSurface(t)) return EXIT_ALLOW;
        targets = [t];
        if (!state.touched.includes(t)) state.touched.push(t);
    }
    if (!targets.length) return EXIT_ALLOW;

    // Findings come from the shipped registry, via the same entrypoint CI uses.
    const findings: Finding[] = [];
    let scanFailed: string | null = null;
    try {
        const { loadDesignContext, scanFile } = await import('../lint_design_slop.js');
        const ctx = loadDesignContext(root);
        for (const rel of targets) {
            const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
            if (!fs.existsSync(abs)) continue;
            for (const f of scanFile(abs, ctx)) {
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

    const auditMissing = targets.filter((t) => !auditIsFresh(root, t));
    let result = decide(slot, findings, auditMissing, new Set(state.surfaced), renderAvailable(root));
    if (scanFailed) {
        result = { ...result, verification: 'unverified', degradation_reason: `detector unavailable: ${scanFailed}` };
    }

    for (const f of result.findings) state.surfaced.push(`${f.file}::${f.rule}::${f.line}`);
    if (slot === 'stop') state.touched = [];
    writeState(root, state);

    if (!result.findings.length && !result.audit_missing.length && result.verification === 'verified') {
        return EXIT_ALLOW;
    }

    process.stdout.write(`${JSON.stringify({ reason: render(result) })}\n`);
    return result.blocked.length ? EXIT_BLOCK : EXIT_WARN;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    void main().then((c) => process.exit(c));
}
export { main as _main };
export const _HERE = fileURLToPath(import.meta.url);
