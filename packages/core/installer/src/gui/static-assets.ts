/**
 * Static asset serving for the browser-wizard.
 *
 * Phase 6 § "Distribution" — the GUI is shipped as inlined HTML/CSS/JS
 * string constants so the published npm package needs no build step
 * and no `dist/` folder. Total inline budget: ≤ 200 KB.
 *
 * The CSRF token is injected into the HTML via a `__CSRF__` placeholder
 * on every `GET /` and `GET /index.html`. The token is per-server-
 * lifetime; the SPA reads it from a `<meta name="csrf">` tag and
 * passes it in the JSON body of every POST (per `handlers.ts`).
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
};

const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>@event4u/agent-config — Browser Wizard</title>
<meta name="csrf" content="__CSRF__">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/app.css">
</head>
<body>
<header>
  <h1>@event4u/agent-config</h1>
  <p class="sub">Browser Wizard</p>
  <nav class="topnav" aria-label="Surfaces">
    <button type="button" class="tab active" data-surface="setup">Setup</button>
    <button type="button" class="tab" data-surface="tasks">Tasks</button>
    <button type="button" class="tab" data-surface="council">Council</button>
    <button type="button" class="tab" data-surface="memory">Memory</button>
    <button type="button" class="tab" data-surface="explain">Explain</button>
    <button type="button" class="tab" data-surface="workspace">Workspace</button>
  </nav>
</header>
<main>
  <section id="surface-setup" class="surface active">
  <div id="recovery-banner" class="recovery" role="alert" hidden>
    <div class="recovery-text">
      <strong>Unfinished install detected.</strong>
      <span id="recovery-summary"></span>
    </div>
    <div class="actions">
      <button type="button" id="btn-recovery-rollback" class="primary">Roll back</button>
      <button type="button" id="btn-recovery-discard" class="ghost">Discard log</button>
    </div>
  </div>
  <nav class="steps" aria-label="Steps">
    <ol>
      <li data-step="workspaces" class="active">1. Workspaces</li>
      <li data-step="packs">2. Packs</li>
      <li data-step="apply">3. Apply</li>
    </ol>
  </nav>
  <section id="screen-workspaces" class="screen active" aria-labelledby="h-workspaces">
    <h2 id="h-workspaces">Select workspaces</h2>
    <p class="hint">Auto-detected workspaces are pre-selected. Toggle any to include or exclude.</p>
    <details class="help"><summary>What is this?</summary>
      <p>A <strong>workspace</strong> is a coarse-grained tag (engineering, product, founder, …) that groups packs by audience. Packs declare a <code>workspaces:</code> list in their manifest; selecting a workspace surfaces every pack tagged with it. The auto-detection in this wizard inspects your repo (lockfiles, framework markers, top-level paths) and pre-checks the workspaces that look applicable.</p>
    </details>
    <div id="workspaces-list" class="list"></div>
    <div class="actions">
      <button type="button" id="btn-to-packs" class="primary" disabled>Continue →</button>
    </div>
  </section>
  <section id="screen-packs" class="screen" aria-labelledby="h-packs">
    <h2 id="h-packs">Select packs</h2>
    <p class="hint">Required packs auto-add their dependencies. Advisory packs need explicit acceptance.</p>
    <div id="packs-list" class="list"></div>
    <div class="actions">
      <button type="button" id="btn-back-workspaces" class="ghost">← Back</button>
      <button type="button" id="btn-to-apply" class="primary" disabled>Continue →</button>
    </div>
  </section>
  <section id="screen-apply" class="screen" aria-labelledby="h-apply">
    <h2 id="h-apply">Review &amp; apply</h2>
    <div id="apply-summary" class="summary"></div>
    <fieldset class="telemetry-opt-in">
      <legend>Install funnel telemetry</legend>
      <label>
        <input type="checkbox" id="telemetry-opt-in" />
        Send anonymous install-funnel events for this run.
      </label>
      <p class="hint">
        Off by default. One session id per install, 8 stage events max, no IP, no project path, no pack content.
        Read the full spec in <a href="https://github.com/event4u/agent-config/blob/main/docs/distribution/telemetry-privacy.md" target="_blank" rel="noopener">telemetry-privacy.md</a>.
        Choice is never persisted — uncheck on the next run to opt out.
      </p>
    </fieldset>
    <div class="actions">
      <button type="button" id="btn-back-packs" class="ghost">← Back</button>
      <button type="button" id="btn-apply" class="primary">Apply changes</button>
    </div>
    <div id="apply-progress" class="progress" hidden>
      <progress id="progress-bar" value="0" max="100"></progress>
      <pre id="progress-log" class="log" aria-live="polite"></pre>
    </div>
    <div id="apply-success" class="success" hidden>
      <h3>Install complete</h3>
      <p class="hint"><span id="success-files"></span> files written · lockfile <code id="success-sha"></code></p>
      <p class="hint" id="success-path-hint" hidden>Lockfile: <code id="success-path"></code></p>
      <div class="actions">
        <button type="button" id="btn-open-lockfile" class="ghost">Open lockfile</button>
      </div>
    </div>
  </section>
  <div id="error-banner" class="error" role="alert" hidden>
    <span id="error-message"></span>
    <button type="button" id="btn-retry" class="ghost" hidden>Retry</button>
  </div>
  </section>
  <section id="surface-tasks" class="surface" aria-labelledby="h-tasks" hidden>
    <h2 id="h-tasks">Tasks</h2>
    <p class="hint">Run allowlisted Taskfile targets. Output streams live.</p>
    <details class="help"><summary>What is this?</summary>
      <p>A small, hard-coded allowlist of read-only / idempotent <code>task</code> targets you can run from the browser. The catalog is closed — the server cannot spawn arbitrary commands. Output streams over Server-Sent Events; only one task runs at a time. History keeps the last 20 runs in memory and is cleared on server restart.</p>
    </details>
    <div id="tasks-list" class="list" aria-live="polite"></div>
    <div id="tasks-runner" class="runner" hidden>
      <div class="runner-head">
        <strong id="runner-title"></strong>
        <span id="runner-state" class="badge auto">idle</span>
      </div>
      <pre id="runner-log" class="log" aria-live="polite"></pre>
    </div>
    <h3 class="sec-h">History</h3>
    <div id="tasks-history" class="list small"></div>
  </section>
  <section id="surface-council" class="surface" aria-labelledby="h-council" hidden>
    <h2 id="h-council">Council sessions</h2>
    <p class="hint">Read-only browser for past AI Council calls (newest first).</p>
    <details class="help"><summary>What is this?</summary>
      <p>Every AI Council call (multi-model deliberation triggered by <code>/council</code>, <code>/work</code>, or roadmap execution) writes a session folder under <code>agents/runtime/council/sessions/</code>. This surface lists them newest-first and shows manifest + response for the selected session. Read-only — no edits possible.</p>
    </details>
    <div id="council-layout" class="council-grid">
      <div id="council-list" class="list small council-list"></div>
      <div id="council-detail" class="council-detail">
        <p class="hint">Select a session to view manifest and response.</p>
      </div>
    </div>
  </section>
  <section id="surface-memory" class="surface" aria-labelledby="h-memory" hidden>
    <h2 id="h-memory">Memory inspection</h2>
    <p class="hint">Read-only browser for agent memory artefacts on disk.</p>
    <details class="help"><summary>What is this?</summary>
      <p>The agent persists curated knowledge under <code>agents/memory/</code> across six scopes: <code>contexts</code>, <code>decisions</code>, <code>evidence</code>, <code>features</code>, <code>overrides</code>, <code>reference</code>. This surface lists files per scope and shows raw plaintext (no markdown rendering — what you see is what's on disk). Read-only — writes still flow through the agent's normal proposal path.</p>
    </details>
    <div id="memory-layout" class="memory-grid">
      <div id="memory-tree" class="list small memory-tree"></div>
      <div id="memory-detail" class="memory-detail">
        <p class="hint">Select a file to view its content.</p>
      </div>
    </div>
  </section>
  <section id="surface-explain" class="surface" aria-labelledby="h-explain" hidden>
    <h2 id="h-explain">Explain last run</h2>
    <p class="hint">Decision chain behind the most recent <code>/work</code> or <code>/implement-ticket</code> run.</p>
    <details class="help"><summary>What is this?</summary>
      <p>The agent persists a state file (<code>.work-state.json</code>) plus council session, memory hits, and router activations for every run. This surface re-renders that chain as a timeline so you can see <em>why</em> the agent picked the rules / persona / provider it did. Powered by <code>agent-config explain last --json</code>; the wire format is <a href="https://event4u.app/agent-config/schemas/explain-trace.schema.json">ExplainTrace v1</a>.</p>
    </details>
    <div class="actions">
      <button type="button" id="btn-explain-refresh" class="primary">Refresh</button>
      <span id="explain-status" class="hint"></span>
    </div>
    <div id="explain-meta" class="explain-meta" hidden></div>
    <ol id="explain-timeline" class="explain-timeline" hidden></ol>
    <div id="explain-empty" class="hint" hidden>No trace available. Run <code>/work</code> or <code>/implement-ticket</code> first.</div>
  </section>
  <section id="surface-workspace" class="surface" aria-labelledby="h-workspace" hidden>
    <h2 id="h-workspace">Workspace</h2>
    <p class="hint">Pick a role, launch a task, see your recent sessions.</p>
    <details class="help"><summary>What is this?</summary>
      <p>The Workspace surface is the v0 employee-product floor (ADR-024). Roles live under <code>agents/roles/&lt;slug&gt;/</code> with per-role tasks; sessions are stored as JSONL under <code>~/.event4u/agent-config/workspace/sessions/</code>. All local-only.</p>
    </details>
    <div class="workspace-grid">
      <div>
        <label for="ws-role" class="small">Role</label>
        <select id="ws-role" class="ws-select"></select>
        <label for="ws-task" class="small">Task</label>
        <select id="ws-task" class="ws-select" disabled></select>
        <button type="button" id="btn-ws-start" class="primary" disabled>Start session</button>
        <p id="ws-status" class="hint" aria-live="polite"></p>
      </div>
      <div>
        <h3 class="small">Recent sessions</h3>
        <div id="ws-sessions" class="list small"></div>
      </div>
    </div>
  </section>
</main>
<footer>
  <p>Local-only · 127.0.0.1 · Telemetry off by default</p>
</footer>
<script src="/app.js"></script>
</body>
</html>`;

const APP_CSS = `*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;background:#0e1116;color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-size:14px;line-height:1.5}
header{padding:16px 24px;border-bottom:1px solid #21262d}
header h1{margin:0;font-size:18px;font-weight:600}
header .sub{margin:2px 0 0;color:#7d8590;font-size:13px}
main{max-width:880px;margin:0 auto;padding:24px}
footer{padding:16px 24px;border-top:1px solid #21262d;color:#7d8590;font-size:12px;text-align:center}
nav.steps ol{display:flex;gap:12px;list-style:none;margin:0 0 24px;padding:0}
nav.steps li{padding:6px 12px;border-radius:6px;background:#161b22;color:#7d8590;font-size:13px}
nav.steps li.active{background:#1f6feb;color:#fff}
nav.steps li.done{background:#238636;color:#fff}
.screen{display:none}
.screen.active{display:block}
h2{margin:0 0 8px;font-size:20px}
.hint{margin:0 0 16px;color:#7d8590}
fieldset.telemetry-opt-in{margin:16px 0;padding:12px 16px;border:1px solid #21262d;border-radius:6px;background:#161b22}
fieldset.telemetry-opt-in legend{padding:0 6px;color:#e6edf3;font-size:13px;font-weight:600}
fieldset.telemetry-opt-in label{display:flex;align-items:center;gap:8px;color:#e6edf3;font-size:13px;cursor:pointer}
fieldset.telemetry-opt-in input[type=checkbox]{margin:0;cursor:pointer}
fieldset.telemetry-opt-in .hint{margin:8px 0 0;font-size:12px}
fieldset.telemetry-opt-in a{color:#58a6ff}
.list{display:flex;flex-direction:column;gap:8px;margin-bottom:24px}
.row{display:flex;align-items:flex-start;gap:12px;padding:12px 16px;background:#161b22;border:1px solid #21262d;border-radius:8px}
.row:hover{border-color:#30363d}
.row input[type=checkbox]{margin-top:3px;width:16px;height:16px;cursor:pointer}
.row .meta{flex:1;min-width:0}
.row .title{font-weight:600;word-break:break-word}
.row .desc{color:#7d8590;font-size:13px;margin-top:2px}
.row .badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:6px;vertical-align:middle}
.badge.core{background:#1f6feb;color:#fff}
.badge.advisory{background:#9e6a03;color:#fff}
.badge.community{background:#6e7681;color:#fff}
.badge.auto{background:#238636;color:#fff}
.banner{margin-top:8px;padding:8px 12px;background:#3d2c0d;border:1px solid #9e6a03;border-radius:6px;font-size:13px}
.banner label{display:flex;gap:8px;align-items:flex-start;cursor:pointer}
.actions{display:flex;justify-content:space-between;gap:12px;margin-top:24px}
button{font:inherit;padding:8px 16px;border-radius:6px;border:1px solid transparent;cursor:pointer}
button:disabled{opacity:.5;cursor:not-allowed}
button.primary{background:#238636;color:#fff;border-color:#2ea043}
button.primary:hover:not(:disabled){background:#2ea043}
button.ghost{background:transparent;color:#e6edf3;border-color:#30363d}
button.ghost:hover:not(:disabled){background:#161b22}
.summary{background:#161b22;border:1px solid #21262d;border-radius:8px;padding:16px;margin-bottom:16px}
.summary h3{margin:0 0 8px;font-size:14px;color:#7d8590;text-transform:uppercase;letter-spacing:.05em}
.summary ul{margin:0 0 16px;padding-left:20px}
.summary li{margin:2px 0}
.summary .count{color:#7d8590;font-size:13px}
.progress{margin-top:16px}
progress{width:100%;height:8px}
.log{background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px;max-height:240px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:12px;color:#7d8590;white-space:pre-wrap}
.log .ok{color:#3fb950}
.log .err{color:#f85149}
.error{margin-top:16px;padding:12px 16px;background:#3c1414;border:1px solid #f85149;border-radius:6px;color:#ffa198;display:flex;justify-content:space-between;align-items:center;gap:12px}
.error button{flex-shrink:0}
.success{margin-top:16px;padding:16px;background:#0f2c19;border:1px solid #238636;border-radius:8px;color:#aff5b4}
.success h3{margin:0 0 8px;font-size:14px;color:#3fb950;text-transform:uppercase;letter-spacing:.05em}
.success code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:12px;background:#0d1117;padding:2px 6px;border-radius:4px;color:#e6edf3}
.recovery{margin-bottom:16px;padding:12px 16px;background:#3d2c0d;border:1px solid #9e6a03;border-radius:8px;color:#f0c674;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.recovery .recovery-text{flex:1;min-width:240px}
.recovery .recovery-text strong{display:block;margin-bottom:4px;color:#fff}
.recovery .actions{margin-top:0;gap:8px}
nav.topnav{display:flex;gap:4px;margin-top:12px}
nav.topnav .tab{background:transparent;border:1px solid #21262d;color:#7d8590;padding:6px 14px;border-radius:6px;font-size:13px;cursor:pointer}
nav.topnav .tab:hover{border-color:#30363d;color:#e6edf3}
nav.topnav .tab.active{background:#1f6feb;border-color:#1f6feb;color:#fff}
.surface{display:none}
.surface.active{display:block}
.list.small .row{padding:8px 12px;font-size:13px}
.sec-h{margin:24px 0 8px;font-size:14px;color:#7d8590;text-transform:uppercase;letter-spacing:.05em}
.row.task-row{cursor:pointer}
.row.task-row .desc{font-size:12px}
.row.history-row .meta{display:flex;flex-direction:column;gap:2px}
.row.history-row .ts{color:#7d8590;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace}
.row.history-row .exit-ok{color:#3fb950}
.row.history-row .exit-err{color:#f85149}
.runner{margin:16px 0;padding:12px;background:#161b22;border:1px solid #21262d;border-radius:8px}
.runner-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.runner .log{max-height:320px}
.council-grid{display:grid;grid-template-columns:280px 1fr;gap:16px}
.council-list .row{cursor:pointer;flex-direction:column;align-items:stretch}
.council-list .row.selected{border-color:#1f6feb;background:#1a2230}
.council-list .row .ts{color:#7d8590;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace}
.council-list .row .artefact{font-size:12px;color:#e6edf3;word-break:break-word}
.council-detail{background:#161b22;border:1px solid #21262d;border-radius:8px;padding:16px;min-height:240px}
.council-detail h3{margin:0 0 8px;font-size:16px}
.council-detail dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0 0 16px;font-size:13px}
.council-detail dt{color:#7d8590}
.council-detail dd{margin:0;color:#e6edf3;word-break:break-word}
.council-detail pre{background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:12px;max-height:480px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:12px;white-space:pre-wrap;color:#c9d1d9}
details.help{margin:0 0 16px;padding:8px 12px;background:#161b22;border:1px solid #21262d;border-radius:8px;font-size:13px}
details.help summary{cursor:pointer;color:#7d8590;font-weight:500;outline:none}
details.help[open] summary{color:#e6edf3;margin-bottom:8px}
details.help p{margin:0;color:#c9d1d9;line-height:1.6}
details.help code{background:#0d1117;border:1px solid #21262d;border-radius:4px;padding:1px 5px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:12px}
details.help a{color:#58a6ff;text-decoration:none}
details.help a:hover{text-decoration:underline}
.explain-meta{margin:16px 0;padding:12px 16px;background:#161b22;border:1px solid #21262d;border-radius:8px;display:grid;grid-template-columns:auto 1fr;gap:4px 16px;font-size:13px}
.explain-meta dt{color:#7d8590;font-weight:500}
.explain-meta dd{margin:0;color:#e6edf3;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:12px;word-break:break-all}
.explain-timeline{list-style:none;margin:16px 0 0;padding:0;position:relative}
.explain-timeline::before{content:"";position:absolute;left:11px;top:8px;bottom:8px;width:2px;background:#21262d}
.explain-step{position:relative;padding:0 0 16px 32px;margin:0}
.explain-step::before{content:"";position:absolute;left:6px;top:6px;width:12px;height:12px;border-radius:50%;background:#1f6feb;border:2px solid #0e1116;box-shadow:0 0 0 1px #1f6feb}
.explain-step.empty::before{background:#30363d;box-shadow:0 0 0 1px #30363d}
.explain-step.halt::before{background:#f85149;box-shadow:0 0 0 1px #f85149}
.explain-step h3{margin:0 0 6px;font-size:14px;color:#e6edf3;font-weight:600}
.explain-step.empty h3{color:#7d8590}
.explain-step .step-body{background:#161b22;border:1px solid #21262d;border-radius:6px;padding:10px 12px;font-size:13px;color:#c9d1d9}
.explain-step .step-body .empty-note{color:#7d8590;font-style:italic;margin:0}
.explain-step dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:2px 12px;font-size:12px}
.explain-step dl dt{color:#7d8590}
.explain-step dl dd{margin:0;color:#e6edf3;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;word-break:break-word}
.explain-step ul{margin:4px 0 0;padding-left:18px;font-size:12px;color:#c9d1d9}
.explain-step ul li{margin:2px 0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace}
.explain-step .tag{display:inline-block;font-size:11px;padding:1px 6px;border-radius:3px;background:#21262d;color:#7d8590;margin-right:4px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace}
.explain-step .tag.kernel{background:#1f6feb;color:#fff}
.explain-step .tag.tier1{background:#238636;color:#fff}
.memory-grid{display:grid;grid-template-columns:320px 1fr;gap:16px}
.memory-tree{padding:0}
.memory-tree .scope{margin:0 0 12px}
.memory-tree .scope-head{display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:#161b22;border:1px solid #21262d;border-radius:6px;font-size:12px;color:#7d8590;text-transform:uppercase;letter-spacing:0.05em;font-weight:600}
.memory-tree .scope-head .count{color:#e6edf3;background:#0d1117;border:1px solid #21262d;border-radius:10px;padding:1px 8px;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;text-transform:none;letter-spacing:0}
.memory-tree .scope-files{list-style:none;margin:4px 0 0;padding:0}
.memory-tree .scope-files li{padding:4px 8px;font-size:12px;color:#c9d1d9;cursor:pointer;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;word-break:break-all}
.memory-tree .scope-files li:hover{background:#161b22}
.memory-tree .scope-files li.selected{background:#1a2230;color:#e6edf3;border:1px solid #1f6feb}
.memory-tree .scope-files li .meta{display:block;color:#7d8590;font-size:10px;margin-top:2px}
.memory-tree .scope-files .empty{color:#7d8590;font-style:italic;cursor:default;font-family:inherit}
.memory-tree .scope-files .empty:hover{background:transparent}
.memory-detail{background:#161b22;border:1px solid #21262d;border-radius:8px;padding:16px;min-height:240px}
.memory-detail h3{margin:0 0 8px;font-size:14px;color:#e6edf3;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;word-break:break-all}
.memory-detail .meta-line{color:#7d8590;font-size:11px;margin:0 0 12px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace}
.memory-detail pre{background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:12px;max-height:560px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:12px;white-space:pre-wrap;color:#c9d1d9;margin:0;counter-reset:ln}
.memory-detail pre .ln{display:inline-block;width:3em;color:#484f58;user-select:none;text-align:right;padding-right:12px}
.workspace-grid{display:grid;grid-template-columns:320px 1fr;gap:16px;margin-top:16px}
.workspace-grid label.small{display:block;color:#7d8590;font-size:12px;margin:8px 0 4px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600}
.workspace-grid h3.small{margin:0 0 8px;font-size:12px;color:#7d8590;text-transform:uppercase;letter-spacing:0.05em;font-weight:600}
.ws-select{width:100%;background:#0d1117;border:1px solid #21262d;color:#e6edf3;padding:6px 8px;border-radius:6px;font-size:13px;margin-bottom:8px}
.ws-select:disabled{opacity:0.5;cursor:not-allowed}
#btn-ws-start{margin-top:8px;width:100%}
#ws-sessions .ws-session{padding:8px 10px;border:1px solid #21262d;background:#161b22;border-radius:6px;margin-bottom:6px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:12px}
#ws-sessions .ws-session .role{color:#7d8590}
#ws-sessions .ws-session .task{color:#e6edf3}
#ws-sessions .ws-session .ts{color:#7d8590;font-size:11px;display:block;margin-top:2px}
#ws-sessions .empty{color:#7d8590;font-style:italic}
@media (max-width:720px){.council-grid,.memory-grid,.workspace-grid{grid-template-columns:1fr}}`;


const APP_JS = `(function(){
"use strict";
var csrf = (document.querySelector("meta[name=csrf]") || {}).getAttribute ? document.querySelector("meta[name=csrf]").getAttribute("content") : "";
var manifest = null;
var detected = [];
var selectedWorkspaces = new Set();
var selectedPacks = new Set();
var acceptedAdvisory = new Set();
var activeScreen = "workspaces";

function $(id){ return document.getElementById(id); }
function escapeHtml(s){
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function setError(msg, opts){
  var b = $("error-banner");
  var m = $("error-message");
  var r = $("btn-retry");
  if (!msg) { b.hidden = true; m.textContent = ""; r.hidden = true; return; }
  b.hidden = false;
  m.textContent = msg;
  r.hidden = !(opts && opts.retry);
}
function showSuccess(filesWritten, sha){
  var s = $("apply-success");
  $("success-files").textContent = String(filesWritten);
  $("success-sha").textContent = (sha || "").slice(0, 12) + "…";
  s.hidden = false;
}
async function openLockfile(){
  setError("");
  try {
    var res = await fetch("/api/open-lockfile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csrf: csrf }),
    });
    var body = await res.json().catch(function(){ return {}; });
    if (!res.ok) { setError("Open failed: " + (body.error || res.status)); return; }
    if (body.ok === false) {
      var hint = $("success-path-hint");
      $("success-path").textContent = body.path || "";
      hint.hidden = false;
      setError("Could not launch editor (" + (body.reason || "unknown") + "). Path shown above.");
    }
  } catch (e) {
    setError("Open failed: " + e.message);
  }
}
function setScreen(name){
  activeScreen = name;
  var screens = document.querySelectorAll(".screen");
  for (var i = 0; i < screens.length; i++) screens[i].classList.remove("active");
  var el = $("screen-" + name);
  if (el) el.classList.add("active");
  var steps = document.querySelectorAll("nav.steps li");
  var order = ["workspaces", "packs", "apply"];
  var idx = order.indexOf(name);
  for (var j = 0; j < steps.length; j++){
    steps[j].classList.remove("active");
    steps[j].classList.remove("done");
    if (j < idx) steps[j].classList.add("done");
    else if (j === idx) steps[j].classList.add("active");
  }
  setError("");
}

async function bootstrap(){
  try {
    await checkRecovery();
    var mRes = await fetch("/api/manifest", { headers: { "Accept": "application/json" } });
    if (!mRes.ok) throw new Error("manifest_http_" + mRes.status);
    var mJson = await mRes.json();
    manifest = mJson.manifest;
    var dRes = await fetch("/api/auto-detect", { headers: { "Accept": "application/json" } });
    if (!dRes.ok) throw new Error("auto_detect_http_" + dRes.status);
    var dJson = await dRes.json();
    detected = dJson.signals || [];
    initWorkspaceSelection();
    renderWorkspaces();
  } catch (e) {
    setError("Failed to load: " + e.message);
  }
}

async function checkRecovery(){
  try {
    var res = await fetch("/api/recovery", { headers: { "Accept": "application/json" } });
    if (!res.ok) return;
    var body = await res.json();
    if (!body.open) return;
    var n = (body.plannedPaths || []).length;
    $("recovery-summary").textContent = " " + n + " planned path(s) recorded in " + (body.logPath || "the log") + ".";
    $("recovery-banner").hidden = false;
  } catch (e) { /* recovery is best-effort */ }
}

async function recoveryAction(endpoint){
  var btnA = $("btn-recovery-rollback");
  var btnB = $("btn-recovery-discard");
  btnA.disabled = true; btnB.disabled = true;
  try {
    var res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csrf: csrf }),
    });
    var body = await res.json().catch(function(){ return {}; });
    if (!res.ok) { setError("Recovery failed: " + (body.error || res.status)); return; }
    $("recovery-banner").hidden = true;
  } catch (e) {
    setError("Recovery failed: " + e.message);
  } finally {
    btnA.disabled = false; btnB.disabled = false;
  }
}

function initWorkspaceSelection(){
  selectedWorkspaces = new Set();
  var detectedPackIds = new Set();
  for (var i = 0; i < detected.length; i++) detectedPackIds.add(detected[i].packId);
  for (var w = 0; w < manifest.workspaces.length; w++){
    var ws = manifest.workspaces[w];
    var hit = false;
    for (var p = 0; p < ws.default_packs.length; p++){
      if (detectedPackIds.has(ws.default_packs[p])) { hit = true; break; }
    }
    if (hit) selectedWorkspaces.add(ws.id);
  }
  if (selectedWorkspaces.size === 0 && manifest.workspaces.length > 0){
    selectedWorkspaces.add(manifest.workspaces[0].id);
  }
}

function renderWorkspaces(){
  var list = $("workspaces-list");
  list.innerHTML = "";
  for (var i = 0; i < manifest.workspaces.length; i++){
    var ws = manifest.workspaces[i];
    var checked = selectedWorkspaces.has(ws.id);
    var row = document.createElement("div");
    row.className = "row";
    row.innerHTML =
      "<input type=\\"checkbox\\" id=\\"ws-" + escapeHtml(ws.id) + "\\" " +
      (checked ? "checked" : "") + ">" +
      "<div class=\\"meta\\">" +
        "<label for=\\"ws-" + escapeHtml(ws.id) + "\\" class=\\"title\\">" +
          escapeHtml(ws.label || ws.id) +
        "</label>" +
        "<div class=\\"desc\\">" + escapeHtml(ws.description || "") + "</div>" +
      "</div>";
    (function(id, input){
      input.addEventListener("change", function(){
        if (input.checked) selectedWorkspaces.add(id);
        else selectedWorkspaces.delete(id);
        $("btn-to-packs").disabled = selectedWorkspaces.size === 0;
      });
    })(ws.id, row.querySelector("input"));
    list.appendChild(row);
  }
  $("btn-to-packs").disabled = selectedWorkspaces.size === 0;
}

function packsForSelectedWorkspaces(){
  var result = [];
  var seen = new Set();
  for (var w = 0; w < manifest.workspaces.length; w++){
    var ws = manifest.workspaces[w];
    if (!selectedWorkspaces.has(ws.id)) continue;
    var pools = [ws.default_packs || [], ws.optional_packs || []];
    for (var k = 0; k < pools.length; k++){
      var pool = pools[k];
      for (var p = 0; p < pool.length; p++){
        var pid = pool[p];
        if (seen.has(pid)) continue;
        var pack = findPack(pid);
        if (pack) { result.push({ pack: pack, isDefault: k === 0 }); seen.add(pid); }
      }
    }
  }
  return result;
}

function findPack(id){
  for (var i = 0; i < manifest.packs.length; i++){
    if (manifest.packs[i].id === id) return manifest.packs[i];
  }
  return null;
}

function trustOf(pack){
  var t = (pack.trust_level_default || "").toLowerCase();
  return t || "professional";
}

function isAdvisory(pack){
  var t = trustOf(pack);
  return t === "advisory" || t === "experimental" || (pack.trust_summary && pack.trust_summary.advisory > 0);
}

function renderPacks(){
  var list = $("packs-list");
  list.innerHTML = "";
  var candidates = packsForSelectedWorkspaces();
  if (candidates.length === 0){
    list.innerHTML = "<p class=\\"hint\\">No packs match the selected workspaces.</p>";
    $("btn-to-apply").disabled = true;
    return;
  }
  // Default selection: include all default packs for selected workspaces on first entry.
  if (selectedPacks.size === 0){
    for (var d = 0; d < candidates.length; d++){
      if (candidates[d].isDefault) selectedPacks.add(candidates[d].pack.id);
    }
  }
  for (var i = 0; i < candidates.length; i++){
    var pack = candidates[i].pack;
    var checked = selectedPacks.has(pack.id);
    var trust = trustOf(pack);
    var advisory = isAdvisory(pack);
    var row = document.createElement("div");
    row.className = "row";
    var artefactCount = pack.artefact_count || 0;
    var html =
      "<input type=\\"checkbox\\" id=\\"pk-" + escapeHtml(pack.id) + "\\" " +
      (checked ? "checked" : "") + ">" +
      "<div class=\\"meta\\">" +
        "<label for=\\"pk-" + escapeHtml(pack.id) + "\\" class=\\"title\\">" +
          escapeHtml(pack.label || pack.id) +
          " <span class=\\"badge " + escapeHtml(trust) + "\\">" + escapeHtml(trust) + "</span>" +
          (candidates[i].isDefault ? " <span class=\\"badge auto\\">default</span>" : "") +
        "</label>" +
        "<div class=\\"desc\\">" + escapeHtml(pack.description || "") +
          " <span class=\\"count\\">· " + artefactCount + " artefacts</span></div>";
    if (advisory){
      html +=
        "<div class=\\"banner\\">" +
          "<label>" +
            "<input type=\\"checkbox\\" class=\\"adv\\" " +
              (acceptedAdvisory.has(pack.id) ? "checked" : "") + ">" +
            "<span>I understand this pack ships advisory or experimental content.</span>" +
          "</label>" +
        "</div>";
    }
    html += "</div>";
    row.innerHTML = html;
    (function(id, advisory, primary, advCheckbox){
      primary.addEventListener("change", function(){
        if (primary.checked) selectedPacks.add(id);
        else { selectedPacks.delete(id); acceptedAdvisory.delete(id); }
        updateApplyButton();
      });
      if (advCheckbox){
        advCheckbox.addEventListener("change", function(){
          if (advCheckbox.checked) acceptedAdvisory.add(id);
          else acceptedAdvisory.delete(id);
          updateApplyButton();
        });
      }
    })(pack.id, advisory, row.querySelector("input[type=checkbox]:not(.adv)"), row.querySelector("input.adv"));
    list.appendChild(row);
  }
  updateApplyButton();
}

function updateApplyButton(){
  var disabled = selectedPacks.size === 0;
  // Block continue when any selected advisory pack is unacked.
  for (var i = 0; i < manifest.packs.length && !disabled; i++){
    var pack = manifest.packs[i];
    if (!selectedPacks.has(pack.id)) continue;
    if (isAdvisory(pack) && !acceptedAdvisory.has(pack.id)) disabled = true;
  }
  $("btn-to-apply").disabled = disabled;
}

async function showApplySummary(){
  var summary = $("apply-summary");
  summary.innerHTML = "<p class=\\"hint\\">Computing plan…</p>";
  setScreen("apply");
  try {
    var res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(buildSelectionPayload()),
    });
    var body = await res.json();
    if (!res.ok) { setError("Preview failed: " + (body && body.error ? body.error : res.status)); return; }
    renderSummary(body);
  } catch (e) {
    setError("Preview failed: " + e.message);
  }
}

function buildSelectionPayload(){
  var optIn = $("telemetry-opt-in");
  return {
    workspaces: Array.from(selectedWorkspaces),
    packs: Array.from(selectedPacks),
    acceptAdvisory: Array.from(acceptedAdvisory),
    telemetryOptIn: !!(optIn && optIn.checked),
    csrf: csrf,
  };
}

function renderSummary(preview){
  var summary = $("apply-summary");
  var auto = (preview.autoAdded || []);
  var advisory = (preview.advisory || []);
  var html = "";
  html += "<h3>Workspaces</h3><ul>";
  for (var i = 0; i < preview.workspaces.length; i++) html += "<li>" + escapeHtml(preview.workspaces[i]) + "</li>";
  html += "</ul>";
  html += "<h3>Packs (" + preview.packs.length + ")</h3><ul>";
  for (var j = 0; j < preview.packs.length; j++){
    var p = preview.packs[j];
    var tags = [];
    if (auto.indexOf(p.id) !== -1) tags.push("auto-added");
    if (advisory.indexOf(p.id) !== -1) tags.push("advisory");
    html += "<li>" + escapeHtml(p.label || p.id);
    if (tags.length) html += " <span class=\\"count\\">(" + tags.join(", ") + ")</span>";
    html += "</li>";
  }
  html += "</ul>";
  html += "<p class=\\"count\\">" + preview.files + " file(s) will be written.</p>";
  summary.innerHTML = html;
}

async function applyChanges(){
  $("btn-apply").disabled = true;
  $("btn-back-packs").disabled = true;
  $("apply-progress").hidden = false;
  $("apply-success").hidden = true;
  setError("");
  var logEl = $("progress-log");
  var bar = $("progress-bar");
  logEl.textContent = "";
  bar.value = 0;
  try {
    var res = await fetch("/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
      body: JSON.stringify(buildSelectionPayload()),
    });
    if (!res.ok || !res.body) {
      var text = await res.text().catch(function(){ return String(res.status); });
      setError("Apply failed: " + text, { retry: true });
      $("btn-back-packs").disabled = false;
      return;
    }
    await consumeSse(res.body, function(event){ handleApplyEvent(event, logEl, bar); });
  } catch (e) {
    setError("Apply failed: " + e.message, { retry: true });
    $("btn-back-packs").disabled = false;
  }
}

async function consumeSse(body, onEvent){
  var reader = body.getReader();
  var decoder = new TextDecoder("utf-8");
  var buffer = "";
  while (true){
    var chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    var idx;
    while ((idx = buffer.indexOf("\\n\\n")) !== -1){
      var raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      var line = raw.split("\\n").filter(function(l){ return l.indexOf("data:") === 0; }).map(function(l){ return l.slice(5).trim(); }).join("");
      if (!line) continue;
      try { onEvent(JSON.parse(line)); } catch (e) { /* malformed event — skip */ }
    }
  }
}

function handleApplyEvent(event, logEl, bar){
  if (event.type === "plan-file"){
    appendLog(logEl, "plan " + event.path);
  } else if (event.type === "progress"){
    var pct = event.total > 0 ? Math.round((event.written / event.total) * 100) : 0;
    bar.value = pct;
    appendLog(logEl, "progress " + event.written + "/" + event.total);
  } else if (event.type === "done"){
    bar.value = 100;
    appendLog(logEl, "done — " + event.filesWritten + " files (" + (event.lockfileSha256 || "").slice(0, 12) + "…)", "ok");
    showSuccess(event.filesWritten, event.lockfileSha256);
  } else if (event.type === "error"){
    appendLog(logEl, "error " + event.message, "err");
    setError(event.message, { retry: true });
    $("btn-back-packs").disabled = false;
  }
}

function appendLog(logEl, text, cls){
  var span = document.createElement("span");
  if (cls) span.className = cls;
  span.textContent = text + "\\n";
  logEl.appendChild(span);
  logEl.scrollTop = logEl.scrollHeight;
}

function wireEvents(){
  $("btn-to-packs").addEventListener("click", function(){
    selectedPacks = new Set();
    acceptedAdvisory = new Set();
    setScreen("packs");
    renderPacks();
  });
  $("btn-back-workspaces").addEventListener("click", function(){ setScreen("workspaces"); });
  $("btn-to-apply").addEventListener("click", function(){ showApplySummary(); });
  $("btn-back-packs").addEventListener("click", function(){ setScreen("packs"); $("apply-progress").hidden = true; $("apply-success").hidden = true; $("btn-apply").disabled = false; });
  $("btn-apply").addEventListener("click", function(){ applyChanges(); });
  $("btn-open-lockfile").addEventListener("click", function(){ openLockfile(); });
  $("btn-retry").addEventListener("click", function(){ applyChanges(); });
  $("btn-recovery-rollback").addEventListener("click", function(){ recoveryAction("/api/recovery/rollback"); });
  $("btn-recovery-discard").addEventListener("click", function(){ recoveryAction("/api/recovery/discard"); });
  wireSurfaces();
}

// surface (top-level nav) ────────────────────────────────────────────
var tasksLoaded = false;
var councilLoaded = false;
var memoryLoaded = false;
var explainLoaded = false;
var workspaceLoaded = false;
function wireSurfaces(){
  var tabs = document.querySelectorAll("nav.topnav .tab");
  for (var i = 0; i < tabs.length; i++){
    tabs[i].addEventListener("click", function(e){ setSurface(e.currentTarget.getAttribute("data-surface")); });
  }
  var refresh = $("btn-explain-refresh");
  if (refresh) refresh.addEventListener("click", function(){ loadExplain(); });
  var roleSel = $("ws-role");
  if (roleSel) roleSel.addEventListener("change", function(){ onWsRoleChange(); });
  var startBtn = $("btn-ws-start");
  if (startBtn) startBtn.addEventListener("click", function(){ wsStartSession(); });
}
function setSurface(name){
  var tabs = document.querySelectorAll("nav.topnav .tab");
  for (var i = 0; i < tabs.length; i++){
    var on = tabs[i].getAttribute("data-surface") === name;
    tabs[i].classList.toggle("active", on);
  }
  var surfaces = ["setup", "tasks", "council", "memory", "explain", "workspace"];
  for (var j = 0; j < surfaces.length; j++){
    var el = $("surface-" + surfaces[j]);
    if (!el) continue;
    var on2 = surfaces[j] === name;
    el.classList.toggle("active", on2);
    el.hidden = !on2;
  }
  if (name === "tasks" && !tasksLoaded){ tasksLoaded = true; loadTasks(); loadHistory(); }
  if (name === "council" && !councilLoaded){ councilLoaded = true; loadCouncil(); }
  if (name === "memory" && !memoryLoaded){ memoryLoaded = true; loadMemory(); }
  if (name === "explain" && !explainLoaded){ explainLoaded = true; loadExplain(); }
  if (name === "workspace" && !workspaceLoaded){ workspaceLoaded = true; loadWorkspace(); }
}

// tasks surface ───────────────────────────────────────────────────────
function loadTasks(){
  fetch("/api/v1/task/catalog").then(function(r){ return r.json(); }).then(function(d){
    var list = $("tasks-list");
    list.innerHTML = "";
    (d.tasks || []).forEach(function(t){
      var row = document.createElement("div");
      row.className = "row task-row";
      row.innerHTML =
        '<div class="meta">' +
        '<div class="title">' + escapeHtml(t.label) + '</div>' +
        '<div class="desc">' + escapeHtml(t.description) + '</div>' +
        '</div>' +
        '<button type="button" class="primary" data-task-id="' + escapeHtml(t.id) + '">Run</button>';
      row.querySelector("button").addEventListener("click", function(){ runTask(t); });
      list.appendChild(row);
    });
  }).catch(function(err){ setError("Failed to load task catalog: " + err.message, {}); });
}
function loadHistory(){
  fetch("/api/v1/task/history").then(function(r){ return r.json(); }).then(function(d){
    var list = $("tasks-history");
    list.innerHTML = "";
    var runs = d.runs || [];
    if (runs.length === 0){ list.innerHTML = '<p class="hint">No runs yet.</p>'; return; }
    runs.forEach(function(r){
      var row = document.createElement("div");
      row.className = "row history-row small";
      var cls = r.exitCode === 0 ? "exit-ok" : "exit-err";
      row.innerHTML =
        '<div class="meta">' +
        '<div><strong>' + escapeHtml(r.id) + '</strong> <span class="' + cls + '">exit ' + r.exitCode + '</span> <span class="hint">(' + r.durationMs + ' ms)</span></div>' +
        '<div class="ts">' + escapeHtml(r.startedAt) + '</div>' +
        '</div>';
      list.appendChild(row);
    });
  }).catch(function(){ /* non-fatal */ });
}
function runTask(task){
  var runner = $("tasks-runner");
  var title = $("runner-title");
  var state = $("runner-state");
  var logEl = $("runner-log");
  runner.hidden = false;
  title.textContent = task.label;
  state.textContent = "running";
  state.className = "badge core";
  logEl.innerHTML = "";
  fetch("/api/v1/task/run", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ id: task.id, csrf: csrf }) })
    .then(function(res){
      if (!res.ok) throw new Error("HTTP " + res.status);
      return streamSse(res, function(event){ onTaskEvent(event, logEl, state); });
    })
    .then(function(){ loadHistory(); })
    .catch(function(err){ appendLog(logEl, "error " + err.message, "err"); state.textContent = "error"; state.className = "badge advisory"; });
}
function onTaskEvent(event, logEl, state){
  if (event.type === "start"){ appendLog(logEl, "$ " + event.command.join(" ")); }
  else if (event.type === "stdout"){ appendLog(logEl, event.line); }
  else if (event.type === "stderr"){ appendLog(logEl, event.line, "err"); }
  else if (event.type === "exit"){
    var ok = event.code === 0;
    appendLog(logEl, "exit " + event.code + " (" + event.durationMs + " ms)", ok ? "ok" : "err");
    state.textContent = ok ? "ok" : "failed";
    state.className = ok ? "badge auto" : "badge advisory";
  }
  else if (event.type === "error"){ appendLog(logEl, "error " + event.message, "err"); }
}

// council surface ─────────────────────────────────────────────────────
var councilSelected = null;
function loadCouncil(){
  fetch("/api/v1/council/recent").then(function(r){ return r.json(); }).then(function(d){
    var list = $("council-list");
    list.innerHTML = "";
    var sessions = d.sessions || [];
    if (sessions.length === 0){ list.innerHTML = '<p class="hint">No council sessions yet.</p>'; return; }
    sessions.forEach(function(s){
      var row = document.createElement("div");
      row.className = "row";
      row.setAttribute("data-session-id", s.id);
      row.innerHTML =
        '<div class="ts">' + escapeHtml(s.timestamp || s.id) + '</div>' +
        '<div class="artefact">' + escapeHtml(s.artefact || "(no artefact)") + '</div>' +
        '<div class="hint">' + escapeHtml((s.provider || "") + " · " + (s.model || "") + " · " + (s.mode || "")) + '</div>';
      row.addEventListener("click", function(){ openSession(s.id); });
      list.appendChild(row);
    });
  }).catch(function(err){ setError("Failed to load council sessions: " + err.message, {}); });
}
function openSession(id){
  councilSelected = id;
  var rows = document.querySelectorAll("#council-list .row");
  for (var i = 0; i < rows.length; i++){ rows[i].classList.toggle("selected", rows[i].getAttribute("data-session-id") === id); }
  fetch("/api/v1/council/session/" + encodeURIComponent(id)).then(function(r){ return r.json(); }).then(function(d){
    var detail = $("council-detail");
    var s = d.session || {};
    var dl = "";
    var fields = [["Timestamp", s.timestamp], ["Artefact", s.artefact], ["Mode", s.mode], ["Provider", s.provider], ["Model", s.model], ["Tokens (in/out)", (s.inputTokens || 0) + "/" + (s.outputTokens || 0)], ["Cost (USD)", s.actualUsd != null ? "$" + s.actualUsd.toFixed(4) : "—"]];
    for (var i = 0; i < fields.length; i++){
      if (fields[i][1] == null) continue;
      dl += "<dt>" + escapeHtml(fields[i][0]) + "</dt><dd>" + escapeHtml(String(fields[i][1])) + "</dd>";
    }
    var resp = d.response ? '<h3>Response</h3><pre>' + escapeHtml(d.response) + '</pre>' : '<p class="hint">No response captured.</p>';
    detail.innerHTML = '<h3>' + escapeHtml(s.id || id) + '</h3><dl>' + dl + '</dl>' + resp;
  }).catch(function(err){ $("council-detail").innerHTML = '<p class="error">' + escapeHtml(err.message) + '</p>'; });
}

// memory surface ─────────────────────────────────────────────────────
var memorySelected = null;
function formatBytes(n){
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KiB";
  return (n / (1024 * 1024)).toFixed(2) + " MiB";
}
function loadMemory(){
  var tree = $("memory-tree");
  tree.innerHTML = '<p class="hint">Loading…</p>';
  fetch("/api/v1/memory/list").then(function(r){ return r.json(); }).then(function(d){
    renderMemoryTree(d.scopes || []);
  }).catch(function(err){
    tree.innerHTML = '<p class="error">Failed to load: ' + escapeHtml(err.message) + '</p>';
  });
}
function renderMemoryTree(scopes){
  var tree = $("memory-tree");
  tree.innerHTML = "";
  for (var i = 0; i < scopes.length; i++){
    var s = scopes[i];
    var scopeEl = document.createElement("div");
    scopeEl.className = "scope";
    var head = document.createElement("div");
    head.className = "scope-head";
    head.innerHTML = '<span>' + escapeHtml(s.name) + '</span><span class="count">' + s.count + (s.truncated ? "+" : "") + '</span>';
    scopeEl.appendChild(head);
    var ul = document.createElement("ul");
    ul.className = "scope-files";
    if (s.entries.length === 0){
      var li = document.createElement("li");
      li.className = "empty";
      li.textContent = "(empty)";
      ul.appendChild(li);
    } else {
      for (var j = 0; j < s.entries.length; j++){
        var e = s.entries[j];
        var item = document.createElement("li");
        item.setAttribute("data-scope", s.name);
        item.setAttribute("data-id", e.id);
        item.innerHTML = escapeHtml(e.id) + '<span class="meta">' + formatBytes(e.sizeBytes) + ' · ' + escapeHtml(e.modifiedAtIso) + '</span>';
        item.addEventListener("click", (function(scope, id){ return function(){ openMemoryFile(scope, id); }; })(s.name, e.id));
        ul.appendChild(item);
      }
    }
    scopeEl.appendChild(ul);
    tree.appendChild(scopeEl);
  }
}
function openMemoryFile(scope, id){
  memorySelected = scope + "/" + id;
  var items = document.querySelectorAll("#memory-tree .scope-files li");
  for (var i = 0; i < items.length; i++){
    var match = items[i].getAttribute("data-scope") === scope && items[i].getAttribute("data-id") === id;
    items[i].classList.toggle("selected", match);
  }
  var detail = $("memory-detail");
  detail.innerHTML = '<p class="hint">Loading…</p>';
  var url = "/api/v1/memory/file?scope=" + encodeURIComponent(scope) + "&id=" + encodeURIComponent(id);
  fetch(url).then(function(res){
    if (!res.ok){
      return res.json().then(function(d){ throw new Error((d && d.error) || ("HTTP " + res.status)); });
    }
    var modified = res.headers.get("x-memory-modified-at") || "";
    return res.text().then(function(text){ return { text: text, modified: modified }; });
  }).then(function(d){
    var lines = d.text.split("\\n");
    var numbered = "";
    for (var i = 0; i < lines.length; i++){
      numbered += '<span class="ln">' + (i + 1) + '</span>' + escapeHtml(lines[i]) + (i < lines.length - 1 ? "\\n" : "");
    }
    detail.innerHTML =
      '<h3>' + escapeHtml(scope + "/" + id) + '</h3>' +
      '<p class="meta-line">Modified: ' + escapeHtml(d.modified) + '</p>' +
      '<pre>' + numbered + '</pre>';
  }).catch(function(err){
    detail.innerHTML = '<p class="error">Failed: ' + escapeHtml(err.message) + '</p>';
  });
}

// explain surface ────────────────────────────────────────────────────
function loadExplain(){
  var status = $("explain-status");
  var meta = $("explain-meta");
  var timeline = $("explain-timeline");
  var empty = $("explain-empty");
  status.textContent = "Loading…";
  meta.hidden = true; timeline.hidden = true; empty.hidden = true;
  fetch("/api/v1/explain/last").then(function(res){
    if (res.status === 404){ return res.json().then(function(d){ throw { kind: "not_found", message: (d && d.message) || "No trace available." }; }); }
    if (!res.ok){ return res.json().then(function(d){ throw { kind: "error", message: (d && d.message) || ("HTTP " + res.status) }; }); }
    return res.json();
  }).then(function(d){
    status.textContent = "";
    renderExplain(d.trace || {});
  }).catch(function(err){
    if (err && err.kind === "not_found"){ status.textContent = ""; empty.hidden = false; return; }
    status.textContent = "Failed: " + ((err && err.message) || String(err));
  });
}
function renderExplain(trace){
  var meta = $("explain-meta");
  var fields = [["run_id", trace.run_id], ["subject", trace.subject], ["generated_at", trace.generated_at], ["schema", "ExplainTrace v" + (trace.version || "?")]];
  var html = "";
  for (var i = 0; i < fields.length; i++){
    if (fields[i][1] == null) continue;
    html += "<dt>" + escapeHtml(fields[i][0]) + "</dt><dd>" + escapeHtml(String(fields[i][1])) + "</dd>";
  }
  meta.innerHTML = html;
  meta.hidden = false;
  var timeline = $("explain-timeline");
  timeline.innerHTML = "";
  timeline.appendChild(stepInputs(trace.inputs));
  timeline.appendChild(stepRoute(trace.route));
  timeline.appendChild(stepCouncil(trace.council));
  timeline.appendChild(stepMemory(trace.memory));
  timeline.appendChild(stepPack(trace.pack));
  timeline.appendChild(stepAssumptions(trace.assumptions));
  timeline.appendChild(stepHalt(trace.halt));
  if (trace.provider) timeline.appendChild(stepProvider(trace.provider));
  timeline.hidden = false;
}
function makeStep(title, isEmpty, isHalt){
  var li = document.createElement("li");
  li.className = "explain-step" + (isEmpty ? " empty" : "") + (isHalt ? " halt" : "");
  var h = document.createElement("h3"); h.textContent = title; li.appendChild(h);
  var body = document.createElement("div"); body.className = "step-body"; li.appendChild(body);
  return { li: li, body: body };
}
function dlPairs(pairs){
  var dl = document.createElement("dl");
  for (var i = 0; i < pairs.length; i++){
    if (pairs[i][1] == null) continue;
    var dt = document.createElement("dt"); dt.textContent = pairs[i][0];
    var dd = document.createElement("dd"); dd.textContent = String(pairs[i][1]);
    dl.appendChild(dt); dl.appendChild(dd);
  }
  return dl;
}
function emptyNote(text){ var p = document.createElement("p"); p.className = "empty-note"; p.textContent = text; return p; }
function stepInputs(inputs){
  if (!inputs){ var s = makeStep("Inputs (profile / preset / cost)", true, false); s.body.appendChild(emptyNote("No profile / preset / cost_profile recorded.")); return s.li; }
  var s = makeStep("Inputs (profile / preset / cost)", false, false);
  s.body.appendChild(dlPairs([["profile", inputs.profile], ["preset", inputs.preset], ["cost_profile", inputs.cost_profile]]));
  var src = inputs.source_per_knob || {};
  var keys = Object.keys(src);
  if (keys.length > 0){
    var sub = document.createElement("div"); sub.style.marginTop = "8px";
    var label = document.createElement("div"); label.style.color = "#7d8590"; label.style.fontSize = "11px"; label.textContent = "Source per knob:"; sub.appendChild(label);
    var ul = document.createElement("ul");
    for (var i = 0; i < keys.length; i++){ var li = document.createElement("li"); li.textContent = keys[i] + " = " + src[keys[i]]; ul.appendChild(li); }
    sub.appendChild(ul); s.body.appendChild(sub);
  }
  return s.li;
}
function stepRoute(route){
  if (!route){ var s = makeStep("Route (rule activation)", true, false); s.body.appendChild(emptyNote("dist/router.json not loaded; no rule activation captured.")); return s.li; }
  var s2 = makeStep("Route (rule activation)", false, false);
  if (route.persona) s2.body.appendChild(dlPairs([["persona", route.persona]]));
  var addList = function(label, items, cls){
    if (!items || items.length === 0) return;
    var lbl = document.createElement("div"); lbl.style.color = "#7d8590"; lbl.style.fontSize = "11px"; lbl.style.marginTop = "6px"; lbl.textContent = label; s2.body.appendChild(lbl);
    var wrap = document.createElement("div");
    for (var i = 0; i < items.length; i++){ var t = document.createElement("span"); t.className = "tag " + cls; t.textContent = items[i]; wrap.appendChild(t); }
    s2.body.appendChild(wrap);
  };
  addList("Kernel rules (always active):", route.kernel_rules, "kernel");
  addList("Matched tier-1 rules:", route.matched_rules, "tier1");
  return s2.li;
}
function stepCouncil(council){
  if (!council || council.length === 0){ var s = makeStep("Council deliberation", true, false); s.body.appendChild(emptyNote("No council session attached to this run.")); return s.li; }
  var s2 = makeStep("Council deliberation (" + council.length + " member" + (council.length === 1 ? "" : "s") + ")", false, false);
  var ul = document.createElement("ul");
  for (var i = 0; i < council.length; i++){
    var m = council[i];
    var li = document.createElement("li");
    li.textContent = m.member_id + " \u2192 " + (m.verdict || "(no verdict)");
    ul.appendChild(li);
  }
  s2.body.appendChild(ul);
  return s2.li;
}
function stepMemory(memory){
  if (!memory || memory.length === 0){ var s = makeStep("Memory hits", true, false); s.body.appendChild(emptyNote("No memory entries consulted.")); return s.li; }
  var s2 = makeStep("Memory hits (" + memory.length + ")", false, false);
  var ul = document.createElement("ul");
  for (var i = 0; i < memory.length; i++){
    var m = memory[i];
    var li = document.createElement("li");
    li.textContent = m.entry_id + " (score " + m.hit_score + ", used in " + m.used_in + ")";
    ul.appendChild(li);
  }
  s2.body.appendChild(ul);
  return s2.li;
}
function stepPack(pack){
  if (!pack){ var s = makeStep("Active pack", true, false); s.body.appendChild(emptyNote("No workspace pack active.")); return s.li; }
  var s2 = makeStep("Active pack", false, false);
  s2.body.appendChild(dlPairs([["id", pack.id], ["reason", pack.reason]]));
  return s2.li;
}
function stepAssumptions(assumptions){
  if (!assumptions || assumptions.length === 0){ var s = makeStep("Assumptions", true, false); s.body.appendChild(emptyNote("No assumptions recorded.")); return s.li; }
  var s2 = makeStep("Assumptions (" + assumptions.length + ")", false, false);
  var ul = document.createElement("ul");
  for (var i = 0; i < assumptions.length; i++){
    var a = assumptions[i];
    var li = document.createElement("li");
    li.textContent = a.id + " \u2014 " + (a.accepted ? "accepted" : "rejected") + " (" + a.source + ")";
    ul.appendChild(li);
  }
  s2.body.appendChild(ul);
  return s2.li;
}
function stepHalt(halt){
  if (!halt){ var s = makeStep("Halt", true, false); s.body.appendChild(emptyNote("Clean run \u2014 no halt persisted.")); return s.li; }
  var s2 = makeStep("Halt \u2014 " + (halt.reason || "(unknown reason)"), false, true);
  s2.body.appendChild(dlPairs([["reason", halt.reason], ["step", halt.step]]));
  if (halt.surface && halt.surface.length){
    var lbl = document.createElement("div"); lbl.style.color = "#7d8590"; lbl.style.fontSize = "11px"; lbl.style.marginTop = "6px"; lbl.textContent = "Surface:"; s2.body.appendChild(lbl);
    var ul = document.createElement("ul");
    for (var i = 0; i < halt.surface.length; i++){ var li = document.createElement("li"); li.textContent = halt.surface[i]; ul.appendChild(li); }
    s2.body.appendChild(ul);
  }
  return s2.li;
}
function stepProvider(provider){
  var s2 = makeStep("Video provider", false, false);
  s2.body.appendChild(dlPairs([["id", provider.id], ["selection_reason", provider.selection_reason]]));
  return s2.li;
}

// minimal SSE reader (fetch + ReadableStream)
function streamSse(res, onEvent){
  var reader = res.body.getReader();
  var decoder = new TextDecoder();
  var buf = "";
  function pump(){
    return reader.read().then(function(chunk){
      if (chunk.done) return;
      buf += decoder.decode(chunk.value, { stream: true });
      var idx;
      while ((idx = buf.indexOf("\\n\\n")) >= 0){
        var frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        var lines = frame.split("\\n");
        for (var i = 0; i < lines.length; i++){
          var line = lines[i];
          if (line.indexOf("data: ") === 0){
            try { onEvent(JSON.parse(line.slice(6))); } catch (e) { /* skip */ }
          }
        }
      }
      return pump();
    });
  }
  return pump();
}

// workspace surface ───────────────────────────────────────────────────
function loadWorkspace(){
  setWsStatus("Loading roles…");
  fetch("/api/v1/workspace/roles").then(function(r){ return r.json(); }).then(function(d){
    var sel = $("ws-role");
    if (!sel) return;
    sel.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = ""; ph.textContent = "— pick a role —"; ph.disabled = true; ph.selected = true;
    sel.appendChild(ph);
    var roles = d.roles || [];
    roles.forEach(function(slug){
      var opt = document.createElement("option");
      opt.value = slug; opt.textContent = slug;
      sel.appendChild(opt);
    });
    if (roles.length === 0) setWsStatus("No roles found under agents/roles/.");
    else setWsStatus("");
  }).catch(function(err){ setWsStatus("Failed to load roles: " + err.message); });
  loadWsSessions();
}
function onWsRoleChange(){
  var roleSel = $("ws-role");
  var taskSel = $("ws-task");
  var startBtn = $("btn-ws-start");
  if (!roleSel || !taskSel || !startBtn) return;
  var role = roleSel.value;
  taskSel.innerHTML = "";
  taskSel.disabled = true;
  startBtn.disabled = true;
  if (!role) return;
  setWsStatus("Loading tasks for " + role + "…");
  fetch("/api/v1/workspace/roles/" + encodeURIComponent(role) + "/tasks").then(function(r){ return r.json(); }).then(function(d){
    var tasks = d.tasks || [];
    var ph = document.createElement("option");
    ph.value = ""; ph.textContent = "— pick a task —"; ph.disabled = true; ph.selected = true;
    taskSel.appendChild(ph);
    tasks.forEach(function(t){
      var opt = document.createElement("option");
      opt.value = t.slug; opt.textContent = t.title || t.slug;
      taskSel.appendChild(opt);
    });
    taskSel.disabled = tasks.length === 0;
    taskSel.addEventListener("change", function(){ startBtn.disabled = !taskSel.value; });
    setWsStatus(tasks.length === 0 ? "No tasks defined for this role." : "");
  }).catch(function(err){ setWsStatus("Failed to load tasks: " + err.message); });
}
function wsStartSession(){
  var role = ($("ws-role") || {}).value;
  var task = ($("ws-task") || {}).value;
  if (!role || !task) return;
  setWsStatus("Starting session…");
  fetch("/api/v1/workspace/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: role, task: task, csrf: csrf })
  }).then(function(r){ return r.json().then(function(b){ return { status: r.status, body: b }; }); })
  .then(function(o){
    if (o.status !== 200){ setWsStatus("Error: " + (o.body.error || "unknown")); return; }
    setWsStatus("Session " + o.body.session_id + " started.");
    loadWsSessions();
  }).catch(function(err){ setWsStatus("Failed to start session: " + err.message); });
}
function loadWsSessions(){
  fetch("/api/v1/workspace/sessions?limit=20").then(function(r){ return r.json(); }).then(function(d){
    var list = $("ws-sessions");
    if (!list) return;
    list.innerHTML = "";
    var sessions = d.sessions || [];
    if (sessions.length === 0){ list.innerHTML = '<p class="empty">No sessions yet.</p>'; return; }
    sessions.forEach(function(s){
      var row = document.createElement("div");
      row.className = "ws-session";
      row.innerHTML =
        '<span class="task">' + escapeHtml(s.task || "(no task)") + '</span> ' +
        '<span class="role">· ' + escapeHtml(s.role || "") + '</span>' +
        '<span class="ts">' + escapeHtml(s.session_id || "") + ' · ' + escapeHtml(s.started_at || "") + '</span>';
      list.appendChild(row);
    });
  }).catch(function(err){ setWsStatus("Failed to load sessions: " + err.message); });
}
function setWsStatus(msg){
  var s = $("ws-status");
  if (s) s.textContent = msg || "";
}

document.addEventListener("DOMContentLoaded", function(){
  wireEvents();
  bootstrap();
});
})();`;

function injectCsrf(html: string, csrfToken: string): string {
    return html.replace(/__CSRF__/g, csrfToken);
}

/**
 * Serve a GUI static asset. Returns `true` when the URL matched a known
 * asset and the response has been ended; returns `false` to let the
 * caller fall through to API or 404 handling.
 */
export function serveStatic(req: IncomingMessage, res: ServerResponse, csrfToken: string): boolean {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') return false;
    const path = url === '/' ? '/index.html' : url.split('?')[0];
    if (path === '/index.html') {
        sendBody(res, CONTENT_TYPES['.html']!, injectCsrf(INDEX_HTML, csrfToken));
        return true;
    }
    if (path === '/app.css') {
        sendBody(res, CONTENT_TYPES['.css']!, APP_CSS);
        return true;
    }
    if (path === '/app.js') {
        sendBody(res, CONTENT_TYPES['.js']!, APP_JS);
        return true;
    }
    return false;
}

function sendBody(res: ServerResponse, contentType: string, body: string): void {
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(Buffer.byteLength(body, 'utf8')));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
    );
    res.end(body);
}

export const __testing = { INDEX_HTML, APP_CSS, APP_JS, injectCsrf };
