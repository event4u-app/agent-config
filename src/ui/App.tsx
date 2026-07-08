/**
 * Root component for the agent-config local GUI.
 *
 * Dispatches on the current hash route:
 *   - `/`                → redirects to `/setup`
 *   - `/setup`           → Setup tab; alias for `/wizard`
 *   - `/wizard*`         → Setup tab; WizardPage
 *   - `/settings*`       → Settings tab; SettingsHubPage (simple/advanced
 *                          tiers, search, modified indicators —
 *                          road-to-setup-experience § Phase 5)
 *   - `/tasks`           → Tasks tab; legacy surface (port to Preact in Phase 5)
 *   - `/council`         → Council tab; legacy surface
 *   - `/memory`          → Memory tab; legacy surface
 *   - `/explain`         → Explain tab; legacy surface
 *   - `/workspace`       → Workspace tab; legacy surface
 *   - anything else      → NotFound
 *
 * Per ADR-014 the dispatcher stays a flat switch — no router library.
 * The top-level surfaces preserve the legacy installer GUI nav
 * (Option 2, road-to-unified-setup) so users keep the install/runtime
 * areas they know while the visual shell stays the modern Preact one.
 *
 * The wizard remains the guided first-run flow (`init` / `setup`);
 * the Settings hub is the edit-later surface (`agent-config config`).
 */

import { useEffect } from 'preact/hooks';
import { route, initRouter, navigate } from './router.js';
import { WizardPage } from './pages/WizardPage.js';
import { SettingsHubPage } from './pages/SettingsHubPage.js';
import { ProjectSettingsPage } from './pages/ProjectSettingsPage.js';
import { WorkspacePage } from './pages/WorkspacePage.js';
import { serverStatus, fetchServerStatus } from './serverStatus.js';
import { theme, toggleTheme } from './theme.js';

interface Surface {
    readonly id: 'setup' | 'settings' | 'project' | 'tasks' | 'council' | 'memory' | 'explain' | 'workspace';
    readonly label: string;
    readonly hashPath: string;
    /** Hash-path prefixes that should mark this surface active. */
    readonly matches: readonly string[];
}

const SURFACES: readonly Surface[] = [
    { id: 'setup',     label: 'Setup',     hashPath: '/setup',     matches: ['/setup', '/wizard'] },
    { id: 'settings',  label: 'Settings',  hashPath: '/settings',  matches: ['/settings'] },
    { id: 'project',   label: 'Projekt',   hashPath: '/project',   matches: ['/project'] },
    { id: 'tasks',     label: 'Tasks',     hashPath: '/tasks',     matches: ['/tasks'] },
    { id: 'council',   label: 'Council',   hashPath: '/council',   matches: ['/council'] },
    { id: 'memory',    label: 'Memory',    hashPath: '/memory',    matches: ['/memory'] },
    { id: 'explain',   label: 'Explain',   hashPath: '/explain',   matches: ['/explain'] },
    { id: 'workspace', label: 'Workspace', hashPath: '/workspace', matches: ['/workspace'] },
];

function activeSurface(path: string): Surface['id'] | null {
    for (const s of SURFACES) {
        for (const prefix of s.matches) {
            if (path === prefix || path.startsWith(`${prefix}/`)) return s.id;
        }
    }
    return null;
}

function TopNav(): preact.JSX.Element {
    const path = route.value;
    const active = activeSurface(path);
    return (
        <header class="ac-topnav">
            <div class="ac-topnav__inner">
                <div class="ac-topnav__brand">
                    <h1 class="ac-topnav__title">@event4u/agent-config</h1>
                    <p class="ac-topnav__subtitle">Browser Wizard</p>
                </div>
                <nav class="ac-topnav__tabs" aria-label="Surfaces">
                    {SURFACES.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            class={`ac-topnav__tab${active === s.id ? ' ac-topnav__tab--active' : ''}`}
                            aria-current={active === s.id ? 'page' : undefined}
                            onClick={(): void => navigate(s.hashPath)}
                        >
                            {s.label}
                        </button>
                    ))}
                </nav>
                <button
                    type="button"
                    class="ac-topnav__theme"
                    aria-label={theme.value === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                    title={theme.value === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                    onClick={(): void => { toggleTheme(); }}
                >
                    {theme.value === 'dark' ? '☀' : '☾'}
                </button>
            </div>
        </header>
    );
}

function ComingSoon({ name }: { name: string }): preact.JSX.Element {
    return (
        <div class="ac-page">
            <header class="ac-page__header">
                <h1>{name}</h1>
            </header>
            <section class="ac-section">
                <p class="ac-section__description">
                    The <strong>{name}</strong> surface is currently served by the
                    legacy installer GUI on port <code>41100</code>. It is being
                    ported to the modern shell in a follow-up phase
                    (road-to-unified-setup § Phase 5).
                </p>
                <p class="ac-section__description">
                    For now the legacy surface remains reachable via
                    {' '}<code>installer gui</code>.
                </p>
            </section>
        </div>
    );
}

function NotFound({ path }: { path: string }): preact.JSX.Element {
    return (
        <div class="ac-page ac-page--error">
            <h1>Page not found</h1>
            <p>
                Nothing routed to <code>{path}</code>. Try <a href="#/setup">Setup</a>.
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

function dispatch(path: string): preact.JSX.Element {
    if (path === '/' || path === '/setup' || path.startsWith('/setup/')) return <WizardPage path={path} />;
    if (path.startsWith('/wizard')) return <WizardPage path={path} />;
    // road-to-setup-experience § Phase 5.2 — Settings is a standalone hub
    // again (simple/advanced tiers, search, modified indicators). The
    // wizard stays the guided first-run flow; `agent-config config` and
    // the Settings tab land here.
    if (path === '/settings' || path.startsWith('/settings/')) return <SettingsHubPage />;
    if (path === '/project' || path.startsWith('/project/')) return <ProjectSettingsPage />;
    if (path === '/tasks')     return <ComingSoon name="Tasks" />;
    if (path === '/council')   return <ComingSoon name="Council" />;
    if (path === '/memory')    return <ComingSoon name="Memory" />;
    if (path === '/explain')   return <ComingSoon name="Explain" />;
    if (path === '/workspace') return <WorkspacePage />;
    return <NotFound path={path} />;
}

export function App(): preact.JSX.Element {
    useEffect(() => {
        initRouter();
        if (route.value === '/') navigate('/setup');
        void fetchServerStatus();
    }, []);
    return (
        <>
            <DryRunBanner />
            <TopNav />
            {dispatch(route.value)}
        </>
    );
}
