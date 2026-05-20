/**
 * Root component for the agent-config local GUI.
 *
 * Dispatches on the current hash route:
 *   - `/`                → redirects to `/settings`
 *   - `/settings`        → SettingsPage
 *   - `/settings/user`   → UserMdPanel
 *   - `/wizard/:step`    → WizardPage (Phase 3)
 *   - anything else      → NotFound
 *
 * The dispatcher is a flat switch — the GUI has at most 8 screens, no
 * router library is justified per the framework-choice ADR-014.
 */

import { useEffect } from 'preact/hooks';
import { route, initRouter, navigate } from './router.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { UserMdPanel } from './pages/UserMdPanel.js';
import { WizardPage } from './pages/WizardPage.js';

function NotFound({ path }: { path: string }): preact.JSX.Element {
    return (
        <div class="ac-page ac-page--error">
            <h1>Page not found</h1>
            <p>
                Nothing routed to <code>{path}</code>. Try <a href="#/settings">Settings</a>.
            </p>
        </div>
    );
}

export function App(): preact.JSX.Element {
    useEffect(() => {
        initRouter();
        if (route.value === '/') navigate('/settings');
    }, []);

    const path = route.value;

    if (path === '/' || path === '/settings') return <SettingsPage />;
    if (path === '/settings/user') return <UserMdPanel />;
    if (path.startsWith('/wizard')) return <WizardPage path={path} />;

    return <NotFound path={path} />;
}
