/**
 * WizardConflicts unit tests — Council Finding #19.
 *
 * Two render modes:
 *   - single-pick (< CONFLICT_BATCH_THRESHOLD entries): per-row radios
 *     for Skip / Overwrite / (Merge if mergeable). No batch CTA group.
 *   - batch (≥ CONFLICT_BATCH_THRESHOLD entries): three global CTAs
 *     (skip-all / overwrite-all / merge-json) sit above the row table;
 *     per-row radios stay actionable for overrides.
 *
 * The component is read-only on the state signals — these tests render
 * with plain props and assert against the emitted callbacks plus the
 * `aria-pressed` / `checked` projections of the effective resolution.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/preact';

import { WizardConflicts } from '../../src/ui/wizard/WizardConflicts.js';
import {
    CONFLICT_BATCH_THRESHOLD,
    type ConflictBatchChoice,
    type ConflictEntryWire,
    type ConflictResolutionWire,
} from '../../src/ui/wizard/state.js';

afterEach(() => { cleanup(); });

function entry(path: string, mergeable = false): ConflictEntryWire {
    return {
        path,
        kind: 'deployed',
        plannedSha256: 'a'.repeat(64),
        existingSha256: 'b'.repeat(64),
        mergeable,
    };
}

function renderConflicts(overrides: {
    conflicts: ConflictEntryWire[];
    resolutions?: Record<string, ConflictResolutionWire>;
    batchChoice?: ConflictBatchChoice | null;
    onResolutionChange?: (path: string, choice: ConflictResolutionWire) => void;
    onBatchChoice?: (choice: ConflictBatchChoice | null) => void;
}): ReturnType<typeof render> & {
    onResolutionChange: ReturnType<typeof vi.fn>;
    onBatchChoice: ReturnType<typeof vi.fn>;
} {
    const onResolutionChange = vi.fn(overrides.onResolutionChange);
    const onBatchChoice = vi.fn(overrides.onBatchChoice);
    const result = render(
        <WizardConflicts
            conflicts={overrides.conflicts}
            resolutions={overrides.resolutions ?? {}}
            batchChoice={overrides.batchChoice ?? null}
            onResolutionChange={onResolutionChange}
            onBatchChoice={onBatchChoice}
        />,
    );
    return Object.assign(result, { onResolutionChange, onBatchChoice });
}

describe('WizardConflicts — empty / hidden states', () => {
    it('renders nothing when there are no conflicts', () => {
        const { container } = renderConflicts({ conflicts: [] });
        expect(container.firstChild).toBeNull();
    });
});

describe('WizardConflicts — single-pick mode', () => {
    it('shows one row per conflict and no batch CTA group', () => {
        const r = renderConflicts({
            conflicts: [entry('/a.txt'), entry('/b.txt'), entry('/c.json', true)],
        });
        expect(r.container.querySelectorAll('.ac-wizard__conflicts-row')).toHaveLength(3);
        expect(r.queryByRole('group', { name: /Batch resolution/i })).toBeNull();
    });

    it('hides the Merge option for non-mergeable entries', () => {
        const r = renderConflicts({ conflicts: [entry('/a.txt', false)] });
        const group = r.getByRole('radiogroup', { name: /\/a\.txt/ });
        expect(within(group).queryByLabelText('Merge')).toBeNull();
        expect(within(group).getByLabelText('Skip')).toBeDefined();
        expect(within(group).getByLabelText('Overwrite')).toBeDefined();
    });

    it('shows the Merge option for mergeable JSON entries', () => {
        const r = renderConflicts({ conflicts: [entry('/c.json', true)] });
        const group = r.getByRole('radiogroup', { name: /\/c\.json/ });
        expect(within(group).getByLabelText('Merge')).toBeDefined();
    });

    it('fires onResolutionChange when a radio is clicked', () => {
        const r = renderConflicts({ conflicts: [entry('/a.txt')] });
        const group = r.getByRole('radiogroup', { name: /\/a\.txt/ });
        fireEvent.click(within(group).getByLabelText('Overwrite'));
        expect(r.onResolutionChange).toHaveBeenCalledWith('/a.txt', 'overwrite');
    });

    it('reflects an explicit resolution as the checked radio', () => {
        const r = renderConflicts({
            conflicts: [entry('/a.txt', true)],
            resolutions: { '/a.txt': 'merge' },
        });
        const group = r.getByRole('radiogroup', { name: /\/a\.txt/ });
        const merge = within(group).getByLabelText('Merge') as HTMLInputElement;
        expect(merge.checked).toBe(true);
    });

    it('defaults unresolved entries to Skip', () => {
        const r = renderConflicts({ conflicts: [entry('/a.txt')] });
        const group = r.getByRole('radiogroup', { name: /\/a\.txt/ });
        const skip = within(group).getByLabelText('Skip') as HTMLInputElement;
        expect(skip.checked).toBe(true);
    });
});

describe('WizardConflicts — batch mode', () => {
    function batchConflicts(): ConflictEntryWire[] {
        return Array.from({ length: CONFLICT_BATCH_THRESHOLD }, (_, i) =>
            entry(`/file-${i}.txt`, i % 2 === 0),
        );
    }

    it('renders the batch CTA group at or above the threshold', () => {
        const r = renderConflicts({ conflicts: batchConflicts() });
        const group = r.getByRole('group', { name: /Batch resolution/i });
        expect(within(group).getByRole('button', { name: /Skip all/ })).toBeDefined();
        expect(within(group).getByRole('button', { name: /Overwrite all/ })).toBeDefined();
        expect(within(group).getByRole('button', { name: /Merge JSON/ })).toBeDefined();
    });

    it('marks the active batch choice via aria-pressed', () => {
        const r = renderConflicts({ conflicts: batchConflicts(), batchChoice: 'overwrite-all' });
        const overwrite = r.getByRole('button', { name: /Overwrite all/ });
        expect(overwrite.getAttribute('aria-pressed')).toBe('true');
        expect(r.getByRole('button', { name: /Skip all/ }).getAttribute('aria-pressed')).toBe('false');
    });

    it('clicking an active batch CTA clears it (toggle off → null)', () => {
        const r = renderConflicts({ conflicts: batchConflicts(), batchChoice: 'skip-all' });
        fireEvent.click(r.getByRole('button', { name: /Skip all/ }));
        expect(r.onBatchChoice).toHaveBeenCalledWith(null);
    });

    it('clicking a new batch CTA emits that choice', () => {
        const r = renderConflicts({ conflicts: batchConflicts() });
        fireEvent.click(r.getByRole('button', { name: /Merge JSON/ }));
        expect(r.onBatchChoice).toHaveBeenCalledWith('merge-json');
    });

    it('projects merge-json as merge for mergeable rows, skip for the rest', () => {
        const r = renderConflicts({ conflicts: batchConflicts(), batchChoice: 'merge-json' });
        const mergeable = r.getByRole('radiogroup', { name: /\/file-0\.txt/ });
        expect((within(mergeable).getByLabelText('Merge') as HTMLInputElement).checked).toBe(true);
        const nonMerge = r.getByRole('radiogroup', { name: /\/file-1\.txt/ });
        expect((within(nonMerge).getByLabelText('Skip') as HTMLInputElement).checked).toBe(true);
    });

    it('per-row explicit resolution wins over the batch choice', () => {
        const r = renderConflicts({
            conflicts: batchConflicts(),
            batchChoice: 'skip-all',
            resolutions: { '/file-2.txt': 'overwrite' },
        });
        const overridden = r.getByRole('radiogroup', { name: /\/file-2\.txt/ });
        expect((within(overridden).getByLabelText('Overwrite') as HTMLInputElement).checked).toBe(true);
    });
});
