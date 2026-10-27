/*
 * Bugs & Fixes — the 2026-10-bf handover's local-only page. A committed map
 * never carries bug data (error events hold personal data: no titles, no ids,
 * not even counts), so it draws the one "keine Daten" tab, the reason card and
 * why-empty tiles. A local map reads `areas.bugs` (sibling Stage H, written from
 * `.build/bugs/`):
 *   { reader, completeness, findings, adapters: { <source>: bool },
 *     bugs: [{ id, title, status, source, env, area, cause, symbolicated,
 *              fixes: [{ sha, title }], timeline: [{ at, kind, text }], frames: [{ file, line, fn }],
 *              hypotheses: [string], introducedBy?: { sha, why } }] }
 */
extendStrings({
    en: {
        bNoDataTab: 'Bugs & Fixes · no data', bReader: 'bugs lane · Stage H · planned', bNotCommitted: 'not in a committed map', bAbsent: function (c) { return 'areas.bugs: absent · committed map @ ' + c; },
        bHead: 'Bug data is local – this map holds none.', bWhy: 'Error events carry personal data. So nothing about bugs lands in the committed map – no titles, no ids, not even counts (K15 · O9). A local map shows open bugs here, fixed bugs with commit, PR, ticket and release, and regression paths through the graph.',
        bPlanned: 'The import stores a local snapshot; no local bug view is drawn from it yet (H.7).', bWhyEmpty: 'Why empty – the reason is always shown',
        bTiles: [['Committed map', 'never holds bug data. This case applies here.'], ['Not connected', 'no import, no tracker – locally: import a snapshot.'], ['No permission', 'the tracker answers 403 – a scope is missing.'], ['No events', 'connected, empty time window – not “all good”.'], ['Sync failed', 'the old state stays, marked stale.']],
        bLenses: [['overview', 'Overview'], ['bugs', 'Bugs'], ['fixed', 'Fixed'], ['paths', 'Regression paths'], ['time', 'Timeline']], bFilter: 'Filter', bBug: 'Bug',
        bGroups: [['status', 'Status'], ['source', 'Source'], ['env', 'Environment'], ['area', 'Area'], ['cause', 'Cause'], ['symbolicated', 'Symbolication']], bNoAdapter: 'no adapter',
        bFixes: 'Fix commits', bTimeline: 'Timeline', bFrames: 'Frames', bHyp: 'Hypotheses', bIntro: 'Introducing commit · candidate', bNone: '–', bPick: 'Pick a bug to see its fixes, timeline and frames.',
        bOpen: 'open', bFixedS: 'fixed', bSym: { true: 'symbolicated', false: 'not symbolicated' }, bCount: function (n) { return n + ' bugs'; }
    },
    de: {
        bNoDataTab: 'Bugs & Fixes · keine Daten', bReader: 'bugs lane · Stage H · geplant', bNotCommitted: 'nicht in committeter Map', bAbsent: function (c) { return 'areas.bugs: nicht vorhanden · committete Map @ ' + c; },
        bHead: 'Bug-Daten sind lokal – diese Map enthält keine.', bWhy: 'Fehler-Events tragen Personendaten. Darum landet nichts über Bugs in der committeten Map – keine Titel, keine IDs, nicht einmal Zählwerte (K15 · O9). Eine lokale Map zeigt hier offene Bugs, behobene Bugs mit Commit, PR, Ticket und Release, und Regressionspfade durch den Graphen.',
        bPlanned: 'Der Import legt einen lokalen Snapshot ab; eine lokale Bug-Ansicht daraus ist noch nicht verdrahtet (H.7).', bWhyEmpty: 'Warum leer – der Grund steht immer da',
        bTiles: [['Committete Map', 'enthält nie Bug-Daten. Dieser Fall gilt hier.'], ['Nicht verbunden', 'kein Import, kein Tracker – lokal: Snapshot importieren.'], ['Keine Berechtigung', 'Tracker antwortet 403 – Scope fehlt.'], ['Keine Events', 'verbunden, Zeitfenster leer – kein „alles gut“.'], ['Sync fehlgeschlagen', 'alter Stand bleibt, markiert als veraltet.']],
        bLenses: [['overview', 'Übersicht'], ['bugs', 'Bugs'], ['fixed', 'Behoben'], ['paths', 'Regressionspfade'], ['time', 'Zeitleiste']], bFilter: 'Filter', bBug: 'Bug',
        bGroups: [['status', 'Status'], ['source', 'Quelle'], ['env', 'Umgebung'], ['area', 'Area'], ['cause', 'Ursache'], ['symbolicated', 'Symbolisierung']], bNoAdapter: 'kein Adapter',
        bFixes: 'Fix-Commits', bTimeline: 'Zeitleiste', bFrames: 'Frames', bHyp: 'Hypothesen', bIntro: 'Verursachender Commit · Kandidat', bNone: '–', bPick: 'Bug wählen, um Fixes, Zeitleiste und Frames zu sehen.',
        bOpen: 'offen', bFixedS: 'behoben', bSym: { true: 'symbolisiert', false: 'nicht symbolisiert' }, bCount: function (n) { return n + ' Bugs'; }
    }
});

var bState = { lens: 'overview', off: {}, sel: null };
var bHist = pageHistory({
    snap: function () { return { lens: bState.lens, sel: bState.sel, off: JSON.parse(JSON.stringify(bState.off)) }; },
    apply: function (s) { bState.lens = s.lens; bState.sel = s.sel; bState.off = s.off; renderAreaPage('bugs', current.item); },
    key: function (s) { return s.sel || t('bLenses').filter(function (l) { return l[0] === s.lens; })[0][1]; }
});
function bNav(change) { bHist.nav(change); renderAreaPage('bugs', current.item); }
function bLocal() { var p = KA.bugs; return p && !p.empty && p.bugs ? p : null; }
function bVal(b, g) { return g === 'symbolicated' ? String(!!b.symbolicated) : String(b[g] || '–'); }
function bShown(p, skip) { return p.bugs.filter(function (b) { return t('bGroups').every(function (g) { return g[0] === skip || !(bState.off[g[0]] || {})[bVal(b, g[0])]; }); }); }

/** The committed map: the one tab, the reason card, the commands, the why-empty tiles. */
function bCommitted(bar, main) {
    var tabs = add(el('div', { class: 'lenses', role: 'tablist', 'aria-label': t('views') }), el('button', { type: 'button', role: 'tab', class: 'lens', 'aria-selected': 'true' }, t('bNoDataTab')));
    add(bar, tabs, add(el('span', { class: 'mono av-barmeta' }), el('span', null, t('bReader')), document.createTextNode(' '), stChip(t('bNotCommitted'), 'dash', null)));
    var pin = model.pin || { commit: meta.commit };
    var card = el('div', { class: 'empty-page b-empty', id: 'nodata-bugs' });
    add(card, add(el('span', { class: 'ep-chips' }), stChip('no data', 'dash'), el('span', { class: 'mono ep-rev' }, t('bAbsent')(String(pin.commit || '').slice(0, 8)))), el('span', { class: 'ep-head b-head' }, t('bHead')), el('span', { class: 'ep-what' }, t('bWhy')),
        add(el('div', { class: 'sy-chips' }), el('span', { class: 'mono st sy-line b-cmd' }, 'code-graph bugs import <sentry-export.json>')), el('span', { class: 'ep-note' }, t('bPlanned')));
    main.appendChild(card);
    var tiles = el('div', { class: 'b-tiles', id: 'b-why' });
    t('bTiles').forEach(function (x, i) { tiles.appendChild(add(el('div', { class: 'b-tile' + (i === 0 ? ' on' : '') }), el('b', null, x[0]), el('span', null, x[1]))); });
    main.appendChild(add(el('div', { class: 'b-whywrap' }), el('span', { class: 'cap' }, t('bWhyEmpty')), tiles));
}
function bFilter(p, left) {
    var pad = el('div', { class: 'sy-filter' });
    t('bGroups').forEach(function (g) {
        var vals = [];
        p.bugs.forEach(function (b) { var v = bVal(b, g[0]); if (vals.indexOf(v) < 0) vals.push(v); });
        if (g[0] === 'source') Object.keys(p.adapters || {}).forEach(function (a) { if (vals.indexOf(a) < 0) vals.push(a); });
        var box = add(el('div', { class: 'sy-fgroup', 'data-group': g[0] }), el('span', { class: 'cap' }, g[1]));
        vals.sort().forEach(function (v) {
            var noAdapter = g[0] === 'source' && p.adapters && p.adapters[v] === false;
            var on = !(bState.off[g[0]] || {})[v];
            var n = bShown(p, g[0]).filter(function (b) { return bVal(b, g[0]) === v; }).length;
            var label = g[0] === 'symbolicated' ? t('bSym')[v] : v;
            var b = el('button', { type: 'button', role: 'checkbox', 'aria-checked': String(on && !noAdapter), class: 'sy-wsrow', 'data-v': v, disabled: noAdapter ? true : null });
            add(b, el('span', { class: 'sy-tick' + (on && !noAdapter ? ' on' : '') }, on && !noAdapter ? '✓' : ''), el('span', { class: 'sy-wsname' }, label + (noAdapter ? ' · ' + t('bNoAdapter') : '')), el('span', { class: 'mono sy-n' }, noAdapter ? '–' : num(n)));
            if (!noAdapter) b.addEventListener('click', function () { bNav(function () { bState.off[g[0]] = Object.assign({}, bState.off[g[0]]); bState.off[g[0]][v] = on; }); });
            box.appendChild(b);
        });
        pad.appendChild(box);
    });
    left.appendChild(pad);
}
function bRow(b) {
    var r = el('button', { type: 'button', class: 'k-src' + (bState.sel === b.id ? ' on' : ''), 'data-id': b.id });
    add(r, add(el('span', { class: 'k-rowl' }), add(el('span', { class: 'k-rowt' }), el('span', { class: 'cap' }, b.id), el('b', null, b.title)), add(el('span', { class: 'sy-chips' }), stChip(b.status, b.status === 'fixed' || b.status === 'behoben' ? 'ok' : 'warn'), stChip(b.source, 'sy-line'), stChip(b.env || '–', 'dash'))), el('span', { class: 'mono k-right' }, b.area || ''));
    r.addEventListener('click', function () { if (bState.sel !== b.id) bNav(function () { bState.sel = b.id; }); });
    return r;
}
function bLocalPage(p, host) {
    var shown = bShown(p);
    var fixed = shown.filter(function (b) { return (b.fixes || []).length; });
    var tabs = el('div', { class: 'lenses', role: 'tablist', 'aria-label': t('views') });
    t('bLenses').forEach(function (o) {
        var n = o[0] === 'bugs' ? ' · ' + num(shown.length) : o[0] === 'fixed' ? ' · ' + num(fixed.length) : '';
        var b = el('button', { type: 'button', role: 'tab', class: 'lens', 'aria-selected': String(bState.lens === o[0]), 'data-lens': o[0] }, o[1] + n);
        b.addEventListener('click', function () { if (bState.lens !== o[0]) bNav(function () { bState.lens = o[0]; }); });
        tabs.appendChild(b);
    });
    add(host.bar, tabs, add(el('span', { class: 'mono av-barmeta' }), el('span', null, p.reader), document.createTextNode(' '), stChip(t('completeNames')[p.completeness] || p.completeness, COMPLETE_CLASS[p.completeness])));
    bFilter(p, host.left);
    var main = host.main;
    main.appendChild(add(el('div', { class: 'sy-sticky', id: 'b-bar' }), bHist.node(), el('span', { class: 'sy-flex' }), el('span', { class: 'mono sy-count' }, t('bCount')(num(shown.length)))));
    var list = bState.lens === 'fixed' ? fixed : shown;
    var box = el('div', { class: 'sy-box', id: 'b-list' });
    if (bState.lens === 'time') list.slice().sort(function (a, b) { return String(((b.timeline || [])[0] || {}).at || '') < String(((a.timeline || [])[0] || {}).at || '') ? -1 : 1; }).forEach(function (b) { box.appendChild(bRow(b)); });
    else if (bState.lens === 'paths') list.filter(function (b) { return (b.frames || []).length; }).forEach(function (b) { box.appendChild(bRow(b)); });
    else list.forEach(function (b) { box.appendChild(bRow(b)); });
    main.appendChild(box);
    var cur = p.bugs.filter(function (b) { return b.id === bState.sel; })[0];
    var pad = el('div', { class: 'sy-detail', id: 'b-detail' });
    if (!cur) pad.appendChild(el('span', { class: 'soft' }, t('bPick')));
    else {
        add(pad, el('span', { class: 'mono muted' }, cur.id), el('span', { class: 'sy-dn' }, cur.title));
        var sec = function (title, rows) { pad.appendChild(add.apply(null, [el('div', { class: 'sy-onbr' }), el('span', { class: 'cap' }, title)].concat(rows.length ? rows : [el('span', { class: 'muted' }, t('bNone'))]))); };
        sec(t('bFixes'), (cur.fixes || []).map(function (f) { return el('span', { class: 'mono' }, 'Fixes: ' + f.sha + ' · ' + f.title); }));
        sec(t('bTimeline'), (cur.timeline || []).map(function (e) { return el('span', { class: 'mono' }, e.at + ' · ' + e.kind + ' · ' + e.text); }));
        sec(t('bFrames'), (cur.frames || []).map(function (f) { return el('span', { class: 'mono' }, f.file + ':' + f.line + (f.fn ? ' ' + f.fn : '')); }));
        sec(t('bHyp'), (cur.hypotheses || []).map(function (h) { return el('span', null, h); }));
        sec(t('bIntro'), cur.introducedBy ? [el('span', { class: 'mono' }, cur.introducedBy.sha + ' · ' + cur.introducedBy.why)] : []);
    }
    host.right.appendChild(pad);
}

AREA_MODULES.bugs = {
    tabs: [],
    railTitles: ['bFilter', 'bBug'],
    ownsBar: true,
    // Live in both states: a committed map draws its empty page, a local one the lane.
    extra: function () { return true; },
    extraItems: function () { return []; },
    items: function (p) { return (p.bugs || []).map(function (b) { return { key: 'bug/' + b.id, kind: 'bug', label: b.id + ' · ' + b.title, sub: b.status, rows: [], witnesses: [] }; }); },
    meta: function (p) { return t('bCount')(num((p.bugs || []).length)); },
    page: function (p, view, key, host) {
        var local = bLocal();
        if (!local) {
            $('av-body').classList.add('no-left', 'no-side');
            bCommitted(host.bar, host.main);
            return;
        }
        bLocalPage(local, host);
    }
};
