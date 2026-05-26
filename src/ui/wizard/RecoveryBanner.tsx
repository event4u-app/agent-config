/**
 * RecoveryBanner — pre-Step-1 surface for an interrupted install.
 *
 * road-to-unified-setup § Phase B4. Rendered above the regular wizard
 * body when `GET /api/v1/install/recovery` returns
 * `{ incomplete: true }`. Offers Resume / Rollback / Ignore CTAs per
 * council Finding #24. The actual recovery handlers wire into a later
 * phase — for v4.0.0 the banner surfaces the abort and dismisses the
 * state so the next install starts clean.
 */

interface RecoveryBannerProps {
    abortedAt: string | null;
    abortNote: string | null;
    writesSinceRollback: number;
    busy: boolean;
    onResume: () => void;
    onRollback: () => void;
    onIgnore: () => void;
}

export function RecoveryBanner(props: RecoveryBannerProps): preact.JSX.Element {
    const ts = props.abortedAt ?? 'unknown time';
    const note = props.abortNote ?? 'no further detail recorded';
    const writes = props.writesSinceRollback;
    return (
        <aside class="ac-banner ac-banner--recovery" role="alert">
            <strong>Previous install was interrupted.</strong>
            <p>
                Aborted at <code>{ts}</code> — {note}. {writes} write
                {writes === 1 ? '' : 's'} landed before the abort marker.
            </p>
            <p>
                Pick how to recover before continuing. Resume reopens the
                wizard fresh, Rollback discards the abort state, Ignore
                hides this banner without touching the log.
            </p>
            <div class="ac-banner__actions">
                <button
                    type="button"
                    disabled={props.busy}
                    onClick={(): void => props.onResume()}
                >
                    Resume install
                </button>
                <button
                    type="button"
                    disabled={props.busy}
                    onClick={(): void => props.onRollback()}
                >
                    Rollback
                </button>
                <button
                    type="button"
                    disabled={props.busy}
                    onClick={(): void => props.onIgnore()}
                >
                    Ignore
                </button>
            </div>
        </aside>
    );
}
