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
import { serverStatus, fetchServerStatus } from './serverStatus.js';

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

function DryRunBanner(): preact.JSX.Element | null {
    const status = serverStatus.value;
    if (status === null || status.dryRun !== true) return null;
    return (
        <div class="ac-dryrun-banner" role="status" aria-live="polite">
            <strong>DRY RUN</strong>
            <span> · no files will be written. Validation + rendering run normally; commits return a preview.</span>
        </div>
    );
}

export function App(): preact.JSX.Element {
    useEffect(() => {
        initRouter();
        if (route.value === '/') navigate('/settings');
        void fetchServerStatus();
    }, []);

    const path = route.value;

    let page: preact.JSX.Element;
    if (path === '/' || path === '/settings') page = <SettingsPage />;
    else if (path === '/settings/user') page = <UserMdPanel />;
    else if (path.startsWith('/wizard')) page = <WizardPage path={path} />;
    else page = <NotFound path={path} />;

    return (
        <>
            <DryRunBanner />
            {page}
        </>
    );
}
