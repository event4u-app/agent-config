/**
 * RecoveryBanner unit tests — road-to-unified-setup § Phase B4.
 *
 * Asserts the three CTAs (Resume / Rollback / Ignore) call the right
 * callback, the busy flag disables every button, and the abort-marker
 * metadata renders verbatim (timestamp + note + write-count).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/preact';

import { RecoveryBanner } from '../../src/ui/wizard/RecoveryBanner.js';

afterEach(() => { cleanup(); });

function renderBanner(overrides: Partial<{
    abortedAt: string | null;
    abortNote: string | null;
    writesSinceRollback: number;
    busy: boolean;
}>): {
    onResume: ReturnType<typeof vi.fn>;
    onRollback: ReturnType<typeof vi.fn>;
    onIgnore: ReturnType<typeof vi.fn>;
    container: HTMLElement;
} {
    const onResume = vi.fn();
    const onRollback = vi.fn();
    const onIgnore = vi.fn();
    const abortedAt = 'abortedAt' in overrides ? overrides.abortedAt ?? null : '2026-05-26T08:00:00.000Z';
    const abortNote = 'abortNote' in overrides ? overrides.abortNote ?? null : 'client disconnected';
    const { container } = render(
        <RecoveryBanner
            abortedAt={abortedAt}
            abortNote={abortNote}
            writesSinceRollback={overrides.writesSinceRollback ?? 3}
            busy={overrides.busy ?? false}
            onResume={onResume}
            onRollback={onRollback}
            onIgnore={onIgnore}
        />,
    );
    return { onResume, onRollback, onIgnore, container };
}

describe('RecoveryBanner', () => {
    it('renders the abort timestamp, note, and write-count', () => {
        const { container } = renderBanner({});
        expect(container.textContent).toContain('2026-05-26T08:00:00.000Z');
        expect(container.textContent).toContain('client disconnected');
        expect(container.textContent).toContain('3 writes');
    });

    it('singularises the write count when exactly one write landed', () => {
        const { container } = renderBanner({ writesSinceRollback: 1 });
        expect(container.textContent).toContain('1 write landed');
    });

    it('falls back to copy when abort metadata is null', () => {
        const { container } = renderBanner({ abortedAt: null, abortNote: null });
        expect(container.textContent).toContain('unknown time');
        expect(container.textContent).toContain('no further detail recorded');
    });

    it('Resume button invokes onResume only', () => {
        const { onResume, onRollback, onIgnore, container } = renderBanner({});
        fireEvent.click(container.querySelector('button:nth-of-type(1)')!);
        expect(onResume).toHaveBeenCalledTimes(1);
        expect(onRollback).not.toHaveBeenCalled();
        expect(onIgnore).not.toHaveBeenCalled();
    });

    it('Rollback button invokes onRollback only', () => {
        const { onResume, onRollback, onIgnore, container } = renderBanner({});
        fireEvent.click(container.querySelector('button:nth-of-type(2)')!);
        expect(onRollback).toHaveBeenCalledTimes(1);
        expect(onResume).not.toHaveBeenCalled();
        expect(onIgnore).not.toHaveBeenCalled();
    });

    it('Ignore button invokes onIgnore only', () => {
        const { onResume, onRollback, onIgnore, container } = renderBanner({});
        fireEvent.click(container.querySelector('button:nth-of-type(3)')!);
        expect(onIgnore).toHaveBeenCalledTimes(1);
        expect(onResume).not.toHaveBeenCalled();
        expect(onRollback).not.toHaveBeenCalled();
    });

    it('busy=true disables every CTA', () => {
        const { container } = renderBanner({ busy: true });
        const buttons = container.querySelectorAll('button');
        expect(buttons.length).toBe(3);
        for (const b of buttons) {
            expect((b as HTMLButtonElement).disabled).toBe(true);
        }
    });
});
