
import { describe, expect, it } from 'vitest';

import {
    BAND_HIGH_MIN,
    BAND_MEDIUM_MIN,
    DIMENSION_NAMES,
    MAX_PER_DIMENSION,
    score,
} from '../../../src/agent-src/templates/scripts/work_engine/scoring/confidence.js';

describe('scoring/confidence — exported constants', () => {
    it('thresholds + rubric shape', () => {
        expect(BAND_HIGH_MIN).toBe(0.8);
        expect(BAND_MEDIUM_MIN).toBe(0.5);
        expect(MAX_PER_DIMENSION).toBe(2);
        expect([...DIMENSION_NAMES]).toEqual([
            'goal_clarity',
            'scope_boundary',
            'ac_evidence',
            'stack_data',
            'reversibility',
        ]);
    });
});

describe('scoring/confidence — score shape', () => {
    it('empty prompt → low band (stack_data + reversibility still score 2 each)', () => {
        const r = score({ raw: '' });
        expect(r.band).toBe('low');
        // goal/scope/ac are 0; an empty prompt has no stack signal (→2) and is
        // code-only (→2), so total=4 → 0.4, matching CPython.
        expect(r.score).toBe(0.4);
        expect(r.dimensions.goal_clarity).toBe(0);
        expect(r.reasons[0]).toBe('goal_clarity=0: empty prompt');
        expect(r.ui_intent).toBe(false);
    });

    it('high-quality prompt with anchored AC → high band', () => {
        const r = score({
            raw: 'Add a logout button to `auth/LoginForm.tsx`',
            ac: [
                'should render a logout button',
                'when clicked it must clear the session',
                'then redirect to the login page',
            ],
        });
        expect(r.band).toBe('high');
        expect(r.score).toBeGreaterThanOrEqual(0.8);
    });

    it('ui keyword sets ui_intent', () => {
        const r = score({ raw: 'redesign the dashboard layout with tailwind' });
        expect(r.ui_intent).toBe(true);
    });

    it('frozen result cannot be mutated', () => {
        const r = score({ raw: 'fix the login bug' });
        expect(() => {
            // @ts-expect-error — runtime frozen check
            r.band = 'high';
        }).toThrow();
    });
});

describe('scoring/confidence — German and English score alike', () => {
    // Same content, two languages: the band must not depend on the language.
    const PAIRS: Array<[string, string]> = [
        ['Add rate limiting to the login endpoint', 'Füge Rate-Limiting zum Login-Endpoint hinzu'],
        ['Create a settings page for notifications', 'Erstelle eine Einstellungsseite für Benachrichtigungen'],
        ['Implement CSV export for the invoice list', 'Implementiere einen CSV-Export für die Rechnungsliste'],
        ['Fix the broken pagination on the user list', 'Behebe die kaputte Paginierung in der Benutzerliste'],
        ['Remove the unused payment adapter', 'Entferne den ungenutzten Zahlungsadapter'],
        ['Update the mailer to the new SMTP settings', 'Aktualisiere den Mailer auf die neuen SMTP-Einstellungen'],
        ['Migrate the sessions table to UUID keys', 'Migriere die Sessions-Tabelle auf UUID-Schlüssel'],
        ['Optimize the dashboard query for large tenants', 'Optimiere die Dashboard-Abfrage für große Mandanten'],
        ['Document the webhook retry behaviour', 'Dokumentiere das Retry-Verhalten der Webhooks'],
        ['Configure the queue worker for the reports job', 'Konfiguriere den Queue-Worker für den Reports-Job'],
    ];
    const AC = ['the new behaviour is covered by a test'];

    for (const [en, de] of PAIRS) {
        it(`${en} ⇔ ${de}`, () => {
            const e = score({ raw: en, ac: AC });
            const d = score({ raw: de, ac: AC });
            expect(d.dimensions.goal_clarity).toBe(e.dimensions.goal_clarity);
            expect(d.band).toBe(e.band);
        });
    }

    it('a vague German prompt stays goal-less', () => {
        expect(score({ raw: 'mach es irgendwie schöner' }).dimensions.goal_clarity).toBe(0);
    });
});
