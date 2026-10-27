/**
 * Catalogue pressure — the deterministic halves of
 * `road-to-routing-assurance-live-floors` Phase 3 and the 4.2 parity gate.
 *
 * Selection accuracy is a comparison, so it is a function of what the target
 * is compared against. These functions fix that comparison set without a free
 * choice: distractors come in FNV-1a order keyed on a seed, the discipline
 * `rule_trigger_eval.ts` already uses, so the same seed reproduces the same set
 * on any machine at any later date.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** The catalogue sizes metric 3 registers; `full` is the whole catalogue. */
export const PRESSURE_SIZES = [12, 20, 50, 'full'] as const;
export type PressureSize = (typeof PRESSURE_SIZES)[number];

/** FNV-1a, 32-bit. */
export function fnv1a(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
}

/**
 * The catalogue a target is measured against at size `n`: the target itself
 * plus the first `n − 1` other names in `fnv1a(seed + "\0" + name)` order.
 * Returned sorted by name, because order within a listing is not part of the
 * comparison set and a caller must not be able to read it as one.
 */
export function catalogueSubset(all: readonly string[], target: string, n: PressureSize, seed: string): string[] {
    if (!all.includes(target)) throw new Error(`catalogueSubset: ${target} is not in the catalogue`);
    if (n === 'full') return [...all].sort();
    if (!Number.isInteger(n) || n < 1) throw new Error('catalogueSubset: n must be a positive integer or "full"');
    const distractors = all
        .filter((name) => name !== target)
        .map((name) => ({ name, key: fnv1a(`${seed}\0${name}`) }))
        .sort((a, b) => a.key - b.key || (a.name < b.name ? -1 : 1))
        .slice(0, n - 1)
        .map((d) => d.name);
    return [target, ...distractors].sort();
}

/**
 * Copy the named skills of `catalogueRoot` into `outRoot` — the catalogue a
 * pressure run's target plugin carries. Writes nothing else.
 */
export function writeSubset(catalogueRoot: string, names: readonly string[], outRoot: string): void {
    fs.mkdirSync(outRoot, { recursive: true });
    for (const name of names) {
        fs.cpSync(path.join(catalogueRoot, name), path.join(outRoot, name), { recursive: true });
    }
}

/**
 * Inject a near-duplicate twin of `skill` (3.2): a sibling skill whose only
 * difference is the paraphrased description. The twin's name is fixed
 * (`<skill>-twin`) so the confusion figure is readable from the invoked name,
 * and the twin text is returned so it can be archived with the result.
 */
export function injectTwin(catalogueRoot: string, skill: string, twinDescription: string): { name: string; text: string } {
    if (twinDescription.trim() === '' || twinDescription.includes('\n')) {
        throw new Error('injectTwin: the twin description must be one non-empty line');
    }
    const name = `${skill}-twin`;
    const dir = path.join(catalogueRoot, name);
    if (fs.existsSync(dir)) throw new Error(`injectTwin: ${name} already exists`);
    if (!fs.existsSync(path.join(catalogueRoot, skill, 'SKILL.md'))) {
        throw new Error(`injectTwin: ${skill} has no SKILL.md in the catalogue`);
    }
    const text = `---\nname: ${name}\ndescription: ${JSON.stringify(twinDescription)}\n---\n\n# ${name}\n`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), text);
    return { name, text };
}

/** The pre-registered parity epsilon (`docs/contracts/routing-assurance-metrics.md`). */
export const MCP_PARITY_EPSILON = 0.05;

export interface ParityVerdict {
    /** native − mcp; 0 is parity, positive means the MCP path selects worse. */
    delta: number;
    breached: boolean;
}

/**
 * The 4.2 parity gate. MCP-path recall may not undercut native-path recall by
 * more than epsilon on the same corpus; a breach blocks any MCP default-on
 * decision. A missing figure is a breach, never a pass.
 */
export function parityVerdict(
    nativeRecall: number | null,
    mcpRecall: number | null,
    epsilon: number = MCP_PARITY_EPSILON,
): ParityVerdict {
    if (nativeRecall === null || mcpRecall === null) return { delta: Number.NaN, breached: true };
    const delta = Math.round((nativeRecall - mcpRecall) * 1e6) / 1e6;
    return { delta, breached: delta > epsilon };
}
