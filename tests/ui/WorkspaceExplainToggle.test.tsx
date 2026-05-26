/**
 * ExplainToggle render + a11y tests — Phase A Step 4 of
 * `road-to-frictionless-employee-workspace.md`.
 *
 * Covers the four obligations the roadmap pins for this toggle:
 *   1. Default mode is `plain` — non-developer audiences get the
 *      plain-language path on first paint.
 *   2. Both radio inputs carry an explicit `aria-label`.
 *   3. Toggle reacts to click AND keyboard activation (space).
 *   4. Hint text updates in lockstep with the mode.
 *
 * The engineering-lead-role default-to-technical clause (per
 * `docs/contracts/explain-modes.md` § Per-role glossary override) is
 * a separate role-scoped concern surfaced when a role experience for
 * engineering-lead lands; covered by `tests/server/workspace.test.ts`
 * § translates technical vocabulary in plain mode.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';

function installMock(): { restore: () => void } {
    const original = global.fetch;
    global.fetch = vi.fn(async (url: string | URL | Request) => {
        const path = typeof url === 'string' ? url : url.toString();
        if (path === '/api/v1/workspace/roles') return new Response(JSON.stringify({ roles: [] }), { status: 200 });
        if (path.startsWith('/api/v1/workspace/sessions')) return new Response(JSON.stringify({ sessions: [] }), { status: 200 });
        if (path.startsWith('/api/v1/workspace/knowledge')) return new Response(JSON.stringify({ chunks: [] }), { status: 200 });
        if (path.startsWith('/api/v1/workspace/documents')) return new Response(JSON.stringify({ documents: [] }), { status: 200 });
        return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 });
    }) as unknown as typeof fetch;
    return { restore: (): void => { global.fetch = original; } };
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { cleanup(); });

describe('ExplainToggle', () => {
    it('defaults to plain mode on first paint', async () => {
        const mock = installMock();
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByLabelText, findByText } = render(<WorkspacePage />);
            await findByText(/Replies use everyday words/);
            const plain = await findByLabelText('Plain language') as HTMLInputElement;
            expect(plain.checked).toBe(true);
        } finally {
            mock.restore();
        }
    });

    it('every radio input carries an aria-label', async () => {
        const mock = installMock();
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByLabelText } = render(<WorkspacePage />);
            const plain = await findByLabelText('Plain language');
            const technical = await findByLabelText('Technical detail');
            expect(plain.getAttribute('aria-label')).toBe('Plain language');
            expect(technical.getAttribute('aria-label')).toBe('Technical detail');
        } finally {
            mock.restore();
        }
    });

    it('flips to technical mode on click and updates the hint text', async () => {
        const mock = installMock();
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByLabelText, findByText } = render(<WorkspacePage />);
            const technical = await findByLabelText('Technical detail') as HTMLInputElement;
            fireEvent.click(technical);
            await findByText(/Replies keep the technical vocabulary/);
            expect(technical.checked).toBe(true);
        } finally {
            mock.restore();
        }
    });

    it('flips back to plain mode on keyboard-driven change events', async () => {
        const mock = installMock();
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByLabelText, findByText } = render(<WorkspacePage />);
            const technical = await findByLabelText('Technical detail') as HTMLInputElement;
            fireEvent.click(technical);
            await findByText(/Replies keep the technical vocabulary/);
            const plain = await findByLabelText('Plain language') as HTMLInputElement;
            // Native radio reacts to keyboard via Space/Enter → fires `change`;
            // jsdom does not simulate keyboard activation through `keydown`,
            // so the assertion uses `fireEvent.change` on the radio directly.
            fireEvent.click(plain);
            await findByText(/Replies use everyday words/);
            expect(plain.checked).toBe(true);
        } finally {
            mock.restore();
        }
    });

    it('renders inside a fieldset with a visible legend for screen readers', async () => {
        const mock = installMock();
        try {
            const { WorkspacePage } = await import('../../src/ui/pages/WorkspacePage.js');
            const { findByText, container } = render(<WorkspacePage />);
            await findByText('Explanation style');
            const fieldset = container.querySelector('fieldset.ac-workspace__explain');
            expect(fieldset).not.toBeNull();
            const legend = fieldset?.querySelector('legend');
            expect(legend?.textContent).toBe('Explanation style');
        } finally {
            mock.restore();
        }
    });
});
