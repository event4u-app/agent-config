/**
 * WizardConflicts — surfaces filesystem collisions on the Review step.
 *
 * Two render modes (Council Finding #19):
 *   - single-pick  — fewer than {@link CONFLICT_BATCH_THRESHOLD} conflicts.
 *                    One row per file; per-row Skip / Overwrite / Merge.
 *   - batch        — at or above the threshold. Summary line + three
 *                    global CTAs (skip-all / overwrite-all / merge-json).
 *                    A collapsible row table stays available so the user
 *                    can still tweak individual paths.
 *
 * The component is read-only on the state signals — it consumes
 * `conflicts`, `resolutions`, `batchChoice` and emits two callbacks. The
 * parent (`WizardReview` → `WizardPage`) owns the signal store so this
 * file stays free of side effects and trivial to test.
 *
 * Phase B3 of road-to-unified-setup.
 */

import {
    CONFLICT_BATCH_THRESHOLD,
    type ConflictBatchChoice,
    type ConflictEntryWire,
    type ConflictResolutionWire,
} from './state.js';

export interface WizardConflictsProps {
    conflicts: ReadonlyArray<ConflictEntryWire>;
    resolutions: Readonly<Record<string, ConflictResolutionWire>>;
    batchChoice: ConflictBatchChoice | null;
    onResolutionChange: (path: string, choice: ConflictResolutionWire) => void;
    onBatchChoice: (choice: ConflictBatchChoice | null) => void;
}

const RESOLUTION_LABELS: Readonly<Record<ConflictResolutionWire, string>> = {
    skip: 'Skip',
    overwrite: 'Overwrite',
    merge: 'Merge',
};

function effectiveResolution(
    entry: ConflictEntryWire,
    resolutions: Readonly<Record<string, ConflictResolutionWire>>,
    batch: ConflictBatchChoice | null,
): ConflictResolutionWire {
    const explicit = resolutions[entry.path];
    if (explicit !== undefined) return explicit;
    if (batch === 'overwrite-all') return 'overwrite';
    if (batch === 'merge-json') return entry.mergeable ? 'merge' : 'skip';
    // skip-all, null → skip (the server-side default for surfaced entries)
    return 'skip';
}

function shortSha(sha: string | null): string {
    if (sha === null) return '—';
    return sha.slice(0, 8);
}

export function WizardConflicts(props: WizardConflictsProps): preact.JSX.Element | null {
    if (props.conflicts.length === 0) return null;
    const batchMode = props.conflicts.length >= CONFLICT_BATCH_THRESHOLD;
    return (
        <section class="ac-wizard__conflicts" aria-live="polite">
            <h3 class="ac-wizard__conflicts-title">
                {props.conflicts.length} file{props.conflicts.length === 1 ? '' : 's'} already exist
            </h3>
            <p class="ac-wizard__conflicts-hint">
                These files are not from a previous install and the planned content differs.
                Pick how to handle them — unresolved entries are skipped.
            </p>
            {batchMode ? (
                <BatchCTAs choice={props.batchChoice} onChoice={props.onBatchChoice} />
            ) : null}
            <ConflictRows
                conflicts={props.conflicts}
                resolutions={props.resolutions}
                batchChoice={props.batchChoice}
                onResolutionChange={props.onResolutionChange}
            />
        </section>
    );
}

function BatchCTAs(props: {
    choice: ConflictBatchChoice | null;
    onChoice: (next: ConflictBatchChoice | null) => void;
}): preact.JSX.Element {
    const buttons: ReadonlyArray<{ id: ConflictBatchChoice; label: string }> = [
        { id: 'skip-all', label: 'Skip all' },
        { id: 'overwrite-all', label: 'Overwrite all' },
        { id: 'merge-json', label: 'Merge JSON, skip rest' },
    ];
    return (
        <div class="ac-wizard__conflicts-batch" role="group" aria-label="Batch resolution">
            {buttons.map((b) => {
                const active = props.choice === b.id;
                return (
                    <button
                        key={b.id}
                        type="button"
                        class={`ac-wizard__conflicts-batch-btn${active ? ' ac-wizard__conflicts-batch-btn--active' : ''}`}
                        aria-pressed={active}
                        onClick={(): void => { props.onChoice(active ? null : b.id); }}
                    >
                        {b.label}
                    </button>
                );
            })}
        </div>
    );
}

function ConflictRows(props: {
    conflicts: ReadonlyArray<ConflictEntryWire>;
    resolutions: Readonly<Record<string, ConflictResolutionWire>>;
    batchChoice: ConflictBatchChoice | null;
    onResolutionChange: (path: string, choice: ConflictResolutionWire) => void;
}): preact.JSX.Element {
    return (
        <ul class="ac-wizard__conflicts-list">
            {props.conflicts.map((c) => {
                const current = effectiveResolution(c, props.resolutions, props.batchChoice);
                const options: ConflictResolutionWire[] = c.mergeable
                    ? ['skip', 'overwrite', 'merge']
                    : ['skip', 'overwrite'];
                return (
                    <li key={c.path} class="ac-wizard__conflicts-row">
                        <span class="ac-wizard__conflicts-path" title={c.path}>{c.path}</span>
                        <span class="ac-wizard__conflicts-sha">
                            planned {shortSha(c.plannedSha256)} · on disk {shortSha(c.existingSha256)}
                        </span>
                        <span class="ac-wizard__conflicts-actions" role="radiogroup" aria-label={`Resolution for ${c.path}`}>
                            {options.map((opt) => (
                                <label key={opt} class={`ac-wizard__conflicts-option${current === opt ? ' ac-wizard__conflicts-option--active' : ''}`}>
                                    <input
                                        type="radio"
                                        name={`ac-conflict-${c.path}`}
                                        checked={current === opt}
                                        onChange={(): void => { props.onResolutionChange(c.path, opt); }}
                                    />
                                    <span>{RESOLUTION_LABELS[opt]}</span>
                                </label>
                            ))}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
