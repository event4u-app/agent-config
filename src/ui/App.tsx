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
 *   - `/project*`        → Project tab (visible only under `config
 *                          --project` / while open); ProjectSettingsPage
 *   - `/workspace`       → Workspace (dev-mode-only tab; deep link works)
 *   - anything else      → NotFound
 *
 * Per ADR-014 the dispatcher stays a flat switch — no router library.
 * The placeholder surfaces (Tasks / Council / Memory / Explain) were
 * removed entirely (council 2026-07-08 Q1 — no half-finished stubs).
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
    readonly id: 'setup' | 'settings' | 'project' | 'workspace';
    readonly label: string;
    readonly hashPath: string;
    /** Hash-path prefixes that should mark this surface active. */
    readonly matches: readonly string[];
}

/**
 * Nav surfaces (council 2026-07-08): the placeholder tabs (Tasks, Council,
 * Memory, Explain) were removed — no half-finished stubs in the nav. The
 * Project tab renders only under explicit project intent (`config
 * --project` → `projectSurface`) or while the route is open; Workspace
 * (beta-internal employee product) renders only with
 * AGENT_CONFIG_DEV_MODE=1 (`devSurfaces`). Both stay deep-linkable.
 */
const SURFACES: readonly Surface[] = [
    { id: 'setup',     label: 'Setup',     hashPath: '/setup',     matches: ['/setup', '/wizard'] },
    { id: 'settings',  label: 'Settings',  hashPath: '/settings',  matches: ['/settings'] },
    { id: 'project',   label: 'Project',   hashPath: '/project',   matches: ['/project'] },
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

function visibleSurfaces(activePath: string): readonly Surface[] {
    const status = serverStatus.value;
    const active = activeSurface(activePath);
    return SURFACES.filter((s) => {
        if (s.id === 'project') return status?.projectSurface === true || active === 'project';
        if (s.id === 'workspace') return status?.devSurfaces === true || active === 'workspace';
        return true;
    });
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
                    {visibleSurfaces(path).map((s) => (
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
    // Placeholder surfaces (Tasks / Council / Memory / Explain) were removed
    // from the nav AND the dispatcher — council 2026-07-08 Q1: no stubs.
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
