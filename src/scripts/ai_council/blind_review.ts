/**
 * Council Blind Review — Phase 1 protocol diff (road-to-council-blind-review).
 *
 * Three flag-gated, default-off deliberation-protocol experiments, all
 * subordinate to the existing Iron Law of Neutrality (`docs/contracts/
 * ai-council-config.md` § "Normative behaviour — migrated verbatim") — this
 * module never touches that text, it only adds optional layers on top:
 *
 * - Ü1 (blind synthesis) — `deterministic_shuffle_indices` + `build_blind_labels`
 *   reuse the EXISTING `consensus.anonymize_responses` seam to strip provider
 *   identity from the chairman transcript, seeded deterministically from the
 *   question text (no `Math.random`, no `Date`). `render_deanonymization_block`
 *   restores the mapping AFTER the verdict — blind is only at decision time,
 *   never the archive.
 * - Ü2 (stance assignment) — `STANCE_DEFS` + `assign_stances` rotate five
 *   orthogonal examine-from-perspective-Y prompts deterministically over the
 *   config-ordered member list (never "recommend X" — that would breach the
 *   neutrality contract). The `outsider` seat is the one stance the caller
 *   (orchestrator `consult()`) ablates project context for.
 * - Ü3 (chairman fields) — `CHAIRMAN_FIELDS_ADDENDUM` / `with_chairman_fields`
 *   append two mandatory trailing sections to the synthesis template.
 *
 * All four exports are inert unless a CLI flag opts in (`council_cli.ts`
 * `--chairman` / `--blind-chairman` / `--stances` / `--chairman-fields`).
 */
import { createHash } from 'node:crypto';

import { anonymize_responses } from './consensus.js';

type Dict = Record<string, unknown>;

// ── deterministic seeding (sha256 of the question text — no Math.random, no Date) ──

/**
 * `sha256(s)` as lowercase hex.
 *
 * EXPORTED since 2026-08-30 rather than copied: the re-council guard
 * (`recouncil_guard.ts`) needs the question hash, and
 * road-to-inbox-harvest-2026-08-e-council-topology-evidence 1A.1 requires it to
 * reuse THE EXISTING one — "no second hash implementation". Two hashes of one
 * question are two answers to "is this the same question", and the second one
 * is the one nobody updates.
 */
export function _sha256_hex(s: string): string {
    return createHash('sha256').update(s, 'utf-8').digest('hex');
}

/**
 * Seeded permutation of `0..n-1`, deterministic in `seed`. Decorate-sort:
 * each index gets `sha256(seed + NUL + index)` as its sort key, ascending.
 */
export function deterministic_shuffle_indices(seed: string, n: number): number[] {
    const keyed = Array.from({ length: n }, (_, i) => ({ i, key: _sha256_hex(`${seed}\0${i}`) }));
    keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return keyed.map((k) => k.i);
}

// ── Ü1 — blind chairman transcript (reuses consensus.anonymize_responses) ──

/**
 * Build a blinded chairman transcript from `[source, text]` pairs (source =
 * canonical `provider:model`). The pair ORDER fed to `anonymize_responses` is
 * a deterministic shuffle seeded by `question_text` — which pair becomes
 * `Response-A` is not simply input order, so position alone leaks nothing.
 *
 * Returns the rendered transcript (label-headed blocks) AND the
 * `label -> provider:model` map the caller must keep for post-verdict
 * de-anonymization (never fed back into the prompt).
 */
export function build_blind_labels(
    question_text: string,
    pairs: ReadonlyArray<readonly [string, string]>,
): { transcript: string; label_to_source: Map<string, string> } {
    const order = deterministic_shuffle_indices(question_text, pairs.length);
    const shuffled = order.map((i) => pairs[i] as readonly [string, string]);
    const [anon_text, label_to_source] = anonymize_responses(shuffled, { persona_labels: null });
    const transcript = Array.from(anon_text.entries())
        .map(([label, text]) => `## ${label}\n\n${text}`)
        .join('\n\n---\n\n');
    return { transcript, label_to_source };
}

/**
 * Render the post-verdict de-anonymization map. `heading` lets callers use
 * the member-chairman heading (`### De-anonymization (post-verdict)`) or the
 * host-render heading (`### De-anonymization map`) — the two Phase-1 call
 * sites use distinct wording by design.
 */
export function render_deanonymization_block(heading: string, label_to_source: ReadonlyMap<string, string>): string {
    const lines = Array.from(label_to_source.entries()).map(([label, source]) => {
        const idx = source.indexOf(':');
        const provider = idx === -1 ? source : source.slice(0, idx);
        const model = idx === -1 ? '' : source.slice(idx + 1);
        return `- ${label} → ${provider} · ${model}`;
    });
    return `${heading}\n\n${lines.join('\n')}`;
}

// ── Ü2 — orthogonal stance assignment per seat ──

export interface StanceDef {
    readonly name: string;
    readonly prompt: string;
}

const _EXAMINE = 'Examine the question from the perspective of';

/**
 * Five orthogonal stances, UNDER the existing neutrality contract: every
 * prompt reads "examine from perspective Y", never "recommend X" — a stance
 * frames the lens, it never picks the answer.
 */
export const STANCE_DEFS: readonly StanceDef[] = [
    {
        name: 'skeptic',
        prompt:
            `${_EXAMINE} a skeptic: name the weakest assumption underneath the ` +
            `artefact and the failure mode most likely to be overlooked.`,
    },
    {
        name: 'first-principles',
        prompt:
            `${_EXAMINE} first principles: decompose the artefact into its most ` +
            `basic true statements and reason upward from there, setting existing ` +
            `conventions aside.`,
    },
    {
        name: 'opportunity',
        prompt:
            `${_EXAMINE} opportunity: surface the upside case and the option ` +
            `value a narrower reading of the artefact might miss.`,
    },
    {
        name: 'outsider',
        prompt:
            `${_EXAMINE} an outsider unfamiliar with this project's history and ` +
            `conventions: work only from the artefact in front of you.`,
    },
    {
        name: 'operator',
        prompt:
            `${_EXAMINE} an operator who has to run the resulting decision day to ` +
            `day: surface the operational cost and the maintenance burden.`,
    },
] as const;

/** The one seat whose deliberation prompt drops `project_context` (Ü2). */
export const OUTSIDER_STANCE_NAME = 'outsider';

/** `sha256(question_text)` first byte, mod `STANCE_DEFS.length` — the rotation offset. */
export function stance_offset(question_text: string): number {
    const hex = _sha256_hex(question_text);
    return parseInt(hex.slice(0, 2), 16) % STANCE_DEFS.length;
}

/**
 * Member `i` (in the given config order) gets
 * `STANCE_DEFS[(offset + i) mod 5]`, `offset` deterministic from
 * `question_text`. Same question → same assignment; different question →
 * (usually) a different rotation offset.
 */
export function assign_stances(member_names: readonly string[], question_text: string): Map<string, StanceDef> {
    const offset = stance_offset(question_text);
    const out = new Map<string, StanceDef>();
    member_names.forEach((name, i) => {
        out.set(name, STANCE_DEFS[(offset + i) % STANCE_DEFS.length] as StanceDef);
    });
    return out;
}

// ── Ü3 — mandatory chairman fields ──

export const CHAIRMAN_FIELDS_ADDENDUM = `## Collective blind spot
What did ALL members miss — non-obvious, specific.

## One-line verdict
One sentence, and the single strongest reason.`;

/** Append the two Ü3 sections to a synthesis template (host or member-chairman). */
export function with_chairman_fields(template: string): string {
    return template ? `${template}\n\n${CHAIRMAN_FIELDS_ADDENDUM}` : CHAIRMAN_FIELDS_ADDENDUM;
}

// ── `--chairman <host|auto|member:NAME>` override parsing ──

export interface ChairmanOverride {
    readonly mode: 'host' | 'auto' | 'member';
    readonly member: string | null;
}

/** Parse the `--chairman` flag value. `null` input → `null` (no override). Throws on malformed input. */
export function parse_chairman_override(raw: string | null): ChairmanOverride | null {
    if (raw === null) {
        return null;
    }
    if (raw === 'host' || raw === 'auto') {
        return { mode: raw, member: null };
    }
    if (raw.startsWith('member:')) {
        const member = raw.slice('member:'.length).trim();
        if (!member) {
            throw new Error(`--chairman member: form requires a name, got ${JSON.stringify(raw)}.`);
        }
        return { mode: 'member', member };
    }
    throw new Error(`--chairman expects host|auto|member:NAME, got ${JSON.stringify(raw)}.`);
}

/** Apply a parsed `--chairman` override to a raw `ai_council` config dict — a pure override, no config write. */
export function apply_chairman_override(ai_cfg: Dict, override: ChairmanOverride | null): Dict {
    if (override === null) {
        return ai_cfg;
    }
    const existing = (ai_cfg['chairman'] as Dict) || {};
    const next: Dict = { ...existing, mode: override.mode };
    if (override.mode === 'member') {
        next['member'] = override.member;
    } else {
        delete next['member'];
    }
    return { ...ai_cfg, chairman: next };
}
