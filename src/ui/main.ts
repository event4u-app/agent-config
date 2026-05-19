/**
 * Placeholder entry point for the local UI bundle.
 *
 * The unified-setup-and-settings-gui and explainability-v2 roadmaps
 * replace this file with the real UI. For now it just proves the
 * Vite pipeline end-to-end: read the token from the URL, hit
 * `/api/v1/ping`, render the result. No framework dependency.
 */

interface PingResponse {
    ok: boolean;
    version: string;
    projectRoot: string;
}

function readToken(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
}

async function bootstrap(): Promise<void> {
    const target = document.getElementById('app');
    if (target === null) return;
    const token = readToken();
    if (token === null) {
        target.textContent = 'agent-config UI · missing token — re-open via `agent-config ui:serve`.';
        return;
    }
    try {
        const res = await fetch('/api/v1/ping', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            target.textContent = `agent-config UI · ping failed (${res.status}).`;
            return;
        }
        const body = (await res.json()) as PingResponse;
        target.textContent =
            `agent-config UI · placeholder · v${body.version} · ${body.projectRoot}`;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        target.textContent = `agent-config UI · ping error: ${message}`;
    }
}

void bootstrap();
