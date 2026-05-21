/**
 * Interactive TUI helpers built on `@inquirer/prompts`.
 *
 * Thin wrappers so the orchestrator (`init.ts`) can call them as
 * regular async functions and the test suite can stub them via the
 * `TuiPicker` interface. The prompt library itself is only required at
 * runtime in interactive mode — flag-driven and agent-mode paths never
 * touch it.
 */

import { checkbox, confirm } from '@inquirer/prompts';
import type { DetectionSignal } from './detect.js';
import type { ManifestPack, ManifestTrustSummary, ManifestWorkspace } from './types.js';
import type { ResolvedPack } from './resolver.js';

export interface WorkspaceChoice {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly checked: boolean;
}

export interface PackChoice {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly artefactCount: number;
    readonly checked: boolean;
    readonly autoDetectedReason?: string;
    // Phase 5.1 (ADR-018): trust mix + HRR count for installer surfaces.
    readonly trustSummary: ManifestTrustSummary;
    readonly humanReviewRequired: number;
}

export interface TuiPicker {
    readonly pickWorkspaces: (choices: readonly WorkspaceChoice[]) => Promise<readonly string[]>;
    readonly pickPacks: (choices: readonly PackChoice[]) => Promise<readonly string[]>;
    readonly confirmAutoAdded: (added: readonly ResolvedPack[]) => Promise<boolean>;
    readonly confirmAdvisoryAcceptance: (advisoryPacks: readonly AdvisoryPack[]) => Promise<boolean>;
}

/** Pack carrying advisory/restricted/experimental artefacts needing acknowledgment. */
export interface AdvisoryPack {
    readonly id: string;
    readonly label: string;
    readonly trustSummary: ManifestTrustSummary;
    readonly humanReviewRequired: number;
}

/** Format a trust mix as a one-line summary — only non-zero levels rendered. */
export function formatTrustSummary(t: ManifestTrustSummary, hrr: number): string {
    const parts: string[] = [];
    if (t.core > 0) parts.push(`${t.core} core`);
    if (t.professional > 0) parts.push(`${t.professional} professional`);
    if (t.experimental > 0) parts.push(`${t.experimental} experimental`);
    if (t.advisory > 0) parts.push(`${t.advisory} advisory`);
    if (t.restricted > 0) parts.push(`${t.restricted} restricted`);
    const mix = parts.length === 0 ? '—' : parts.join(' · ');
    return hrr > 0 ? `${mix} · human-review on ${hrr}` : mix;
}

/** True if the pack contains any artefact requiring acknowledgment. */
export function packNeedsAcknowledgment(t: ManifestTrustSummary): boolean {
    return t.advisory > 0 || t.restricted > 0 || t.experimental > 0;
}

/** Default picker — backed by the real inquirer prompts. */
export const defaultPicker: TuiPicker = {
    pickWorkspaces: async (choices) => {
        const result = await checkbox({
            message: 'Which workspaces does this project need?',
            choices: choices.map((c) => ({
                name: `${c.label} — ${c.description}`,
                value: c.id,
                checked: c.checked,
            })),
        });
        return result;
    },
    pickPacks: async (choices) => {
        const result = await checkbox({
            message: 'Which packs do you want to install?',
            choices: choices.map((c) => {
                const suffix = c.autoDetectedReason !== undefined ? `  (auto-detected: ${c.autoDetectedReason})` : '';
                const trust = formatTrustSummary(c.trustSummary, c.humanReviewRequired);
                return {
                    name: `${c.label} [${c.artefactCount}]${suffix} — ${c.description}\n      trust: ${trust}`,
                    value: c.id,
                    checked: c.checked,
                };
            }),
        });
        return result;
    },
    confirmAutoAdded: async (added) => {
        if (added.length === 0) return true;
        const lines = added.map((p) => `  - ${p.id} (required by: ${p.requiredBy.join(', ')})`).join('\n');
        return confirm({
            message: `The following packs were auto-added via requires_hint:\n${lines}\nProceed?`,
            default: true,
        });
    },
    confirmAdvisoryAcceptance: async (advisoryPacks) => {
        if (advisoryPacks.length === 0) return true;
        const lines = advisoryPacks
            .map((p) => `  - ${p.id} (${p.label}): ${formatTrustSummary(p.trustSummary, p.humanReviewRequired)}`)
            .join('\n');
        return confirm({
            message:
                'The following packs include advisory/restricted/experimental artefacts ' +
                'that require explicit acknowledgment:\n' +
                lines +
                '\n\nThese carry trust caveats — outputs may need human review before use. ' +
                'Accept and proceed?',
            default: false,
        });
    },
};

/** Build workspace choices with the manifest's workspaces; none pre-checked. */
export function buildWorkspaceChoices(
    workspaces: readonly ManifestWorkspace[],
): readonly WorkspaceChoice[] {
    return workspaces.map((w) => ({
        id: w.id,
        label: w.label,
        description: w.description,
        checked: false,
    }));
}

/**
 * Build pack choices with explicit + default + auto-detected packs pre-checked.
 * `reasons` provides per-pack auto-detection evidence for the TUI hint.
 */
export function buildPackChoices(
    packs: readonly ManifestPack[],
    preChecked: readonly string[],
    detected: readonly DetectionSignal[],
): readonly PackChoice[] {
    const checkedSet = new Set(preChecked);
    const reasonById = new Map<string, string>();
    for (const d of detected) reasonById.set(d.packId, d.reason);
    return packs.map((p) => {
        const reason = reasonById.get(p.id);
        return {
            id: p.id,
            label: p.label,
            description: p.description,
            artefactCount: p.artefact_count,
            checked: checkedSet.has(p.id),
            trustSummary: p.trust_summary,
            humanReviewRequired: p.human_review_required,
            ...(reason !== undefined ? { autoDetectedReason: reason } : {}),
        };
    });
}

/** Compute packs needing acknowledgment from a resolved pack id list. */
export function collectAdvisoryPacks(
    packs: readonly ManifestPack[],
    selectedIds: readonly string[],
): readonly AdvisoryPack[] {
    const selected = new Set(selectedIds);
    return packs
        .filter((p) => selected.has(p.id) && packNeedsAcknowledgment(p.trust_summary))
        .map((p) => ({
            id: p.id,
            label: p.label,
            trustSummary: p.trust_summary,
            humanReviewRequired: p.human_review_required,
        }));
}
