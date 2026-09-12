/**
 * The runtime activation payload — what a trigger match charges per fire.
 *
 * The third of the three numbers `road-to-the-delivery-flip-that-tells-the-truth`
 * Phase 3 separates. The other two already have names and a record: ADR-270
 * calls them `source_corpus` (what the source tree could deliver) and
 * `host_payload` (what one host actually receives at rest), and requires them to
 * be structurally separate fields because "until the two are named apart, every
 * ceiling discussion risks comparing unlike quantities". After a per-host
 * projection flip a third quantity diverges from both: the bytes a delivery
 * concern injects when a rule's trigger fires. A standing reduction published
 * without it is a saving published without its cost.
 *
 * MEASURED THROUGH THE CONCERN'S OWN SELECTION, never a second model of it.
 * `matchTierRules` + `selectForInjection` are the functions the runtime concern
 * calls; an offline figure computed by a different matcher would price a set the
 * concern does not deliver. That is the same single-definition rule
 * `_lib/rule_injection.ts` was written for, applied one layer out.
 *
 * THE CAP IS A PARAMETER, not an import. The value lives on the concern
 * (`hooks/rule_inject_hook.ts::CAP_BYTES`) and every caller passes it, so this
 * module stays free of the hook's import closure and can be read from a gate, a
 * report, or a bundled path without dragging a hook into it.
 *
 * Moved here from `report_standing_payload_by_host.ts`, which had the only
 * implementation and is still its largest caller — same move, and for the same
 * reason, as `censusRuleDir` into `_lib/carrier_divergence.ts`: a second reader
 * needed it and a second copy is how two numbers start disagreeing.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { loadRouter, matchTierRules, selectForInjection } from './rule_injection.js';

/** The frozen corpus every fire figure in this module is sampled from. */
export const ROUTING_MATRIX_REL = path.join('tests', 'eval', 'routing-matrix');

/** One positive prompt of the frozen corpus, with the open files it declares. */
export interface CorpusPrompt {
    prompt: string;
    openFiles: string[] | null;
}

/**
 * Every YAML shape inside `positives:` this hand parser cannot read.
 *
 * `readCorpusPositives` accepts only `- prompt: "…"` with a double-quoted
 * same-line scalar and an inline `open_files: [...]`. Any other legal shape —
 * single quotes, an unquoted scalar, a folded block, a block sequence for
 * `open_files` — is SILENTLY SKIPPED, which drops fires out of the distribution
 * a budget row is derived from. A measurement that governs a budget must fail
 * loudly on a shape it cannot read rather than under-count, so callers refuse on
 * a non-empty result here.
 *
 * Reported as a shape problem rather than fixed by widening the parser: this
 * module must not grow a second YAML implementation, and the corpus is frozen,
 * so the honest answer to an unreadable shape is to say which file carries it.
 */
export function corpusShapeProblems(root: string): string[] {
    const dir = path.join(root, ROUTING_MATRIX_REL);
    const problems: string[] = [];
    if (!fs.existsSync(dir)) return problems;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.yaml')).sort()) {
        let inPositives = false;
        let lineNo = 0;
        for (const raw of fs.readFileSync(path.join(dir, f), 'utf-8').split('\n')) {
            lineNo += 1;
            if (/^positives:/u.test(raw)) { inPositives = true; continue; }
            if (/^near_misses:/u.test(raw)) { inPositives = false; continue; }
            if (!inPositives) continue;
            if (/^\s*-\s*prompt:/u.test(raw) && !/^\s*-\s*prompt:\s*"(.*)"\s*$/u.test(raw)) {
                problems.push(
                    `${f}:${String(lineNo)}: a \`- prompt:\` this parser cannot read — only a ` +
                        `double-quoted same-line scalar is accepted: ${JSON.stringify(raw.trim())}`,
                );
                continue;
            }
            if (/^\s*-\s*/u.test(raw) && !/^\s*-\s*(prompt|command|open_files):/u.test(raw)
                && raw.trim() !== '-' && raw.trim() !== '') {
                // A bare sequence item under `positives:` is a shape with no
                // `prompt:` key on its first line — folded or nested.
                if (!/^\s{4,}/u.test(raw)) {
                    problems.push(
                        `${f}:${String(lineNo)}: a positives entry whose first line carries no ` +
                            `\`prompt:\` key: ${JSON.stringify(raw.trim())}`,
                    );
                }
            }
            if (/^\s*open_files:\s*$/u.test(raw)) {
                problems.push(
                    `${f}:${String(lineNo)}: a BLOCK-sequence \`open_files:\` — only the inline ` +
                        '`[...]` form is read, so this entry\'s files would be dropped',
                );
            }
        }
    }
    return problems;
}

/** Every positive prompt in the frozen routing-matrix corpus. Near-misses are not fires. */
export function readCorpusPositives(root: string): CorpusPrompt[] {
    const dir = path.join(root, ROUTING_MATRIX_REL);
    const out: CorpusPrompt[] = [];
    if (!fs.existsSync(dir)) return out;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.yaml')).sort()) {
        let inPositives = false;
        let cur: CorpusPrompt | null = null;
        for (const raw of fs.readFileSync(path.join(dir, f), 'utf-8').split('\n')) {
            if (/^positives:/u.test(raw)) { inPositives = true; continue; }
            if (/^near_misses:/u.test(raw)) { inPositives = false; continue; }
            if (!inPositives) continue;
            const p = /^\s*-\s*prompt:\s*"(.*)"\s*$/u.exec(raw);
            if (p !== null) {
                cur = { prompt: p[1] as string, openFiles: null };
                out.push(cur);
                continue;
            }
            const of = /^\s*open_files:\s*\[(.*)\]\s*$/u.exec(raw);
            if (of !== null && cur !== null) {
                cur.openFiles = (of[1] as string)
                    .split(',')
                    .map((x) => x.trim().replace(/^["']|["']$/gu, ''))
                    .filter((x) => x !== '');
            }
        }
    }
    return out;
}

/** Nearest-rank percentile over an unsorted sample. Empty sample → 0. */
export function percentile(xs: readonly number[], q: number): number {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] as number;
}

export interface SlotFireSizes {
    readonly slot: string;
    readonly fires: number;
    readonly p50: number;
    readonly p90: number;
    readonly max: number;
}

/**
 * Gate-open per-fire emission sizes for the delivery concern, per slot.
 *
 * `pre_compact` is 0 by construction rather than by measurement: that branch of
 * `rule_inject_hook` clears the seen-set and returns allow without writing to
 * stdout, so there is no emission to sample.
 */
export function slotFireSizes(root: string, capBytes: number): SlotFireSizes[] {
    const router = loadRouter(root);
    const prompts = readCorpusPositives(root);
    const sample = (mode: 'prompt' | 'file'): number[] => {
        const out: number[] = [];
        for (const r of prompts) {
            if (mode === 'file' && (r.openFiles === null || r.openFiles.length === 0)) continue;
            const matches =
                mode === 'prompt'
                    ? matchTierRules(router, r.prompt, null, null)
                    : matchTierRules(router, '', r.openFiles, null);
            if (matches.length === 0) continue;
            const sel = selectForInjection(root, matches, capBytes);
            if (sel.selected.length > 0) out.push(sel.bytes);
        }
        return out;
    };
    const row = (slot: string, xs: number[]): SlotFireSizes => ({
        slot,
        fires: xs.length,
        p50: percentile(xs, 0.5),
        p90: percentile(xs, 0.9),
        max: xs.length === 0 ? 0 : Math.max(...xs),
    });
    return [
        row('user_prompt_submit', sample('prompt')),
        row('pre_tool_use', sample('file')),
        row('pre_compact', []),
    ];
}

/** The third labelled number, or the reason it could not be taken on this tree. */
export interface ActivationPayload {
    /** Always the literal `activation-payload` — the label a reader and a caller key on. */
    readonly scope: 'activation-payload';
    /** `false` when the corpus or the router is absent; every figure is then 0. */
    readonly measured: boolean;
    /** Why it is unmeasured, or `null`. Never an estimate in place of a number. */
    readonly unmeasured_reason: string | null;
    /** The cap the sampled selection was taken at — the concern's `CAP_BYTES`. */
    readonly cap_bytes: number;
    readonly corpus: string;
    readonly slots: readonly SlotFireSizes[];
    readonly basis: string;
}

/**
 * The runtime activation payload, or an honestly unmeasured reading.
 *
 * Never throws and never estimates: a missing corpus or router yields
 * `measured: false` with the reason named, because a fabricated distribution
 * published beside a standing saving is the exact defect this number exists to
 * prevent.
 */
export function measureActivationPayload(root: string, capBytes: number): ActivationPayload {
    const basis =
        'Gate-open per-fire emission of the `rule-inject` concern over the frozen ' +
        '`tests/eval/routing-matrix` positives, measured through the same ' +
        '`matchTierRules` + `selectForInjection` the runtime concern calls, at the ' +
        'concern\'s own CAP_BYTES. Bytes per fire, never tokens — the unit ' +
        '`hook-token-budget.json` enforces.';
    const empty = (reason: string): ActivationPayload => ({
        scope: 'activation-payload',
        measured: false,
        unmeasured_reason: reason,
        cap_bytes: capBytes,
        corpus: ROUTING_MATRIX_REL,
        slots: [],
        basis,
    });
    if (!fs.existsSync(path.join(root, ROUTING_MATRIX_REL))) {
        return empty(`the frozen corpus ${ROUTING_MATRIX_REL} is absent under ${root}`);
    }
    const shape = corpusShapeProblems(root);
    if (shape.length > 0) {
        return empty(
            `${String(shape.length)} corpus entry/entries are in a shape the reader cannot parse, ` +
                `so the distribution would be under-counted — first: ${shape[0] as string}`,
        );
    }
    let slots: SlotFireSizes[];
    try {
        slots = slotFireSizes(root, capBytes);
    } catch (err) {
        return empty(`the fire sample could not be taken: ${(err as Error).message}`);
    }
    return {
        scope: 'activation-payload',
        measured: true,
        unmeasured_reason: null,
        cap_bytes: capBytes,
        corpus: ROUTING_MATRIX_REL,
        slots,
        basis,
    };
}
