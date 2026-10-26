/**
 * StatuslineTapRow — the one offer of the quota status-line tap (OQ-19, council
 * 2026-10-26: offer once during setup, default yes). The box starts ticked; the
 * tap is added when the wizard finishes, and only then. Unticking records a
 * "no", so the offer is not repeated. Nothing is shown once the tap is in place
 * or the offer was declined.
 */

import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { apiFetch } from '../api.js';

interface StatuslineOffer {
    state: 'offer' | 'installed' | 'declined';
    settings_path: string;
    has_existing: boolean;
}

const offer = signal<StatuslineOffer | null>(null);
/** The user's choice; default yes. */
export const statuslineTapWanted = signal<boolean>(true);

async function loadOffer(): Promise<void> {
    try {
        offer.value = await apiFetch<StatuslineOffer>('/api/v1/wizard/statusline');
    } catch {
        offer.value = null;
    }
}

/** Called once the wizard has finished: applies the answer, returns one line for the finish banner ('' when nothing was offered). */
export async function applyStatuslineTap(): Promise<string> {
    if (offer.value?.state !== 'offer') return '';
    try {
        const r = await apiFetch<{ ok: boolean; message: string }>('/api/v1/wizard/statusline', {
            method: 'POST',
            body: { install: statuslineTapWanted.value },
        });
        offer.value = { ...offer.value, state: statuslineTapWanted.value ? 'installed' : 'declined' };
        return r.message;
    } catch {
        return 'The status-line tap could not be added; run `agent-config statusline:install` to try again.';
    }
}

export function StatuslineTapRow(): preact.JSX.Element | null {
    useEffect(() => {
        void loadOffer();
    }, []);
    if (offer.value?.state !== 'offer') return null;
    return (
        <div class="ac-rtk-row">
            <div class="ac-rtk-row__head">
                <span class="ac-rtk-row__label">Plan-quota warnings</span>
                <span class="ac-badge ac-badge--missing">recommended</span>
            </div>
            <div class="ac-rtk-row__install">
                <p class="ac-field__description">
                    Lets AC warn you when your Claude Code plan window fills faster than it resets, and
                    when a session's context is nearly full. It reads the numbers Claude Code hands its
                    status line and writes one entry to <code>{offer.value.settings_path}</code>
                    {offer.value.has_existing ? ' — your current status line keeps printing, chained behind it' : ''}.
                    Undo any time with <code>agent-config statusline:uninstall</code>.
                </p>
                <label class="ac-field__label">
                    <input
                        type="checkbox"
                        checked={statuslineTapWanted.value}
                        onChange={(e): void => {
                            statuslineTapWanted.value = (e.currentTarget as HTMLInputElement).checked;
                        }}
                    />{' '}
                    Add it when setup finishes
                </label>
            </div>
        </div>
    );
}
