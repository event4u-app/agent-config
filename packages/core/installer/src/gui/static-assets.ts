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
</header>
<main>
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
</main>
<footer>
  <p>Local-only · 127.0.0.1 · No telemetry</p>
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
.success code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;font-size:12px;background:#0d1117;padding:2px 6px;border-radius:4px;color:#e6edf3}`;


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
  return {
    workspaces: Array.from(selectedWorkspaces),
    packs: Array.from(selectedPacks),
    acceptAdvisory: Array.from(acceptedAdvisory),
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
