/**
 * Linear progress bar for the wizard.
 *
 * Renders a strip of segments (one per step), filled up to and including
 * the current index. ARIA: `progressbar` with valuenow / valuemax for
 * screen readers, decorative segments hidden from the AT.
 */

export interface ProgressBarProps {
    current: number;
    total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps): preact.JSX.Element {
    const safeTotal = Math.max(1, total);
    const safeCurrent = Math.max(0, Math.min(safeTotal - 1, current));
    const segments = Array.from({ length: safeTotal }, (_, i) => i <= safeCurrent);
    const pct = Math.round(((safeCurrent + 1) / safeTotal) * 100);
    return (
        <div
            class="ac-wizard__progress"
            role="progressbar"
            aria-valuenow={safeCurrent + 1}
            aria-valuemin={1}
            aria-valuemax={safeTotal}
            aria-valuetext={`Step ${safeCurrent + 1} of ${safeTotal} (${pct}%)`}
        >
            {segments.map((filled, i) => (
                <span
                    key={i}
                    class={`ac-wizard__progress-segment${filled ? ' ac-wizard__progress-segment--filled' : ''}`}
                    aria-hidden="true"
                />
            ))}
        </div>
    );
}
