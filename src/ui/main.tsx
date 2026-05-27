/**
 * Entry point for the unified Setup-Wizard + Settings-GUI bundle.
 *
 * Mounts a single Preact App into `#app`; the App owns the hash-router
 * and dispatches to either the SettingsPage or the WizardPage.
 *
 * The token is parsed once from the URL search params and stored on
 * the `apiClient` module so every fetch picks it up. Roadmap reference:
 * `agents/roadmaps/unified-setup-and-settings-gui.md` Phase 2.
 */

import { render } from 'preact';
import { App } from './App.js';
import { setAuthToken } from './api.js';
import { startServerLifecycle } from './serverLifecycle.js';
import './tokens.css';
import './app.css';

function readToken(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
}

function bootstrap(): void {
    const target = document.getElementById('app');
    if (target === null) return;
    const token = readToken();
    if (token === null) {
        target.textContent = 'agent-config UI · missing token — re-open via `agent-config ui:serve`.';
        return;
    }
    setAuthToken(token);
    // Keep the server alive while open; ask it to exit when the window closes.
    startServerLifecycle(token);
    target.textContent = '';
    render(<App />, target);
}

bootstrap();
