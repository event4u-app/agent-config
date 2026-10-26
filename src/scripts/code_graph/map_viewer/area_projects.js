/*
 * Projects — the hub only: the registered projects of this machine, the links
 * the estate index derived between them, and the facts only visible across
 * them — host ports two projects publish, images and external services they
 * share, and which HTTP call of one project lands on a route of another. A
 * project map never has this area: its route list has no `projects`.
 */
extendStrings({
    en: {
        pGraph: 'Projects', pCalls: 'Service map', pPorts: 'Port collisions', pImages: 'Shared images', pServices: 'Shared services',
        pMeta: function (n, k, c, m) { return n + ' projects · ' + k + ' indexed · ' + c + ' calls, ' + m + ' matched'; },
        pIndexed: 'indexed', pNotIndexed: 'not indexed', pOpen: 'Open its map', pNoPage: 'no map drawn yet', pEdges: 'Links',
        pVia: { package: 'package · fact', 'unique-name': 'unique name · guess', mention: 'mention · guess' },
        pNoEdges: function (r) { return 'No links: ' + r; }, pFrom: 'Calling project', pCall: 'Call', pTarget: 'Lands on', pService: 'Service',
        pUnmatched: { dynamic_baseurl: 'base or path unknown', no_endpoint_match: 'no route matches', ambiguous: 'several routes match' },
        pCandidates: function (n) { return n + ' routes at the same tier'; }, pPort: 'Host port', pImage: 'Image', pRefs: 'As written', pIdentity: 'Identity',
        pUsedBy: 'Used by', pNone: 'Nothing shared between the registered projects.', pNoCalls: 'No HTTP call was read in any registered project.',
        pProject: 'Project', pLegendFact: 'declared dependency', pLegendGuess: 'guess (unique name or mention)', pSkipped: function (n) { return n + ' project(s) could not be read'; }
    },
    de: {
        pGraph: 'Projekte', pCalls: 'Dienstkarte', pPorts: 'Port-Kollisionen', pImages: 'Gemeinsame Images', pServices: 'Gemeinsame Dienste',
        pMeta: function (n, k, c, m) { return n + ' Projekte · ' + k + ' indiziert · ' + c + ' Aufrufe, ' + m + ' zugeordnet'; },
        pIndexed: 'indiziert', pNotIndexed: 'nicht indiziert', pOpen: 'Seine Karte öffnen', pNoPage: 'noch keine Karte gezeichnet', pEdges: 'Verbindungen',
        pVia: { package: 'Paket · Fakt', 'unique-name': 'eindeutiger Name · Vermutung', mention: 'Erwähnung · Vermutung' },
        pNoEdges: function (r) { return 'Keine Verbindungen: ' + r; }, pFrom: 'Aufrufendes Projekt', pCall: 'Aufruf', pTarget: 'Landet bei', pService: 'Dienst',
        pUnmatched: { dynamic_baseurl: 'Basis oder Pfad unbekannt', no_endpoint_match: 'keine Route passt', ambiguous: 'mehrere Routen passen' },
        pCandidates: function (n) { return n + ' Routen auf derselben Stufe'; }, pPort: 'Host-Port', pImage: 'Image', pRefs: 'Wie geschrieben', pIdentity: 'Identität',
        pUsedBy: 'Genutzt von', pNone: 'Die registrierten Projekte teilen nichts.', pNoCalls: 'In keinem registrierten Projekt wurde ein HTTP-Aufruf gelesen.',
        pProject: 'Projekt', pLegendFact: 'deklarierte Abhängigkeit', pLegendGuess: 'Vermutung (eindeutiger Name oder Erwähnung)', pSkipped: function (n) { return n + ' Projekt(e) nicht lesbar'; }
    }
});

function projName(p, id) {
    for (var i = 0; i < p.projects.length; i++) if (p.projects[i].id === id) return p.projects[i].name;
    return id;
}
/** A witness inside one project, labelled with that project for the detail rail. */
function projWitness(p, use) {
    return { file: projName(p, use.project) + ' · ' + use.witness.file, line: use.witness.line, hash: use.witness.hash, confirm: use.witness.confirm || 'unconfirmed' };
}
function callText(c) { return (c.method ? c.method + ' ' : '') + (c.path || '–'); }
function shortName(s) { return s.length > 18 ? s.slice(0, 17) + '…' : s; }

function projectsGraph(p, main) {
    var NS = 'http://www.w3.org/2000/svg';
    var wrap = el('div', { class: 'card pgraph' });
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('pGraph'));
    wrap.appendChild(svg);
    main.appendChild(wrap);
    var w = Math.max(240, wrap.clientWidth - 24);
    var h = Math.round(Math.min(Math.max(200, w * 0.55), 380));
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    var gl = document.createElementNS(NS, 'g');
    var gn = document.createElementNS(NS, 'g');
    svg.appendChild(gl);
    svg.appendChild(gn);
    var texts = [];
    var maxw = 0;
    p.projects.forEach(function (x) {
        var tx = document.createElementNS(NS, 'text');
        tx.textContent = shortName(x.name);
        tx.setAttribute('text-anchor', 'middle');
        tx.setAttribute('class', 'plabel');
        gn.appendChild(tx);
        texts.push(tx);
        maxw = Math.max(maxw, tx.getComputedTextLength());
    });
    var n = p.projects.length;
    var r = n < 2 ? 0 : Math.max(24, Math.min(w / 2 - maxw / 2 - 12, h / 2 - 40));
    var cx = w / 2;
    var cy = h / 2 - 8;
    var pos = Object.create(null);
    p.projects.forEach(function (x, i) {
        var a = -Math.PI / 2 + 2 * Math.PI * i / Math.max(1, n);
        pos[x.id] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
    var sel = current.item.indexOf('project/') === 0 ? current.item.slice(8) : '';
    p.edges.forEach(function (e) {
        var s = pos[e.source];
        var tg = pos[e.target];
        if (!s || !tg) return;
        var l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', s.x);
        l.setAttribute('y1', s.y);
        l.setAttribute('x2', tg.x);
        l.setAttribute('y2', tg.y);
        l.setAttribute('class', (e.via === 'package' ? 'pfact' : 'pguess') + (sel && e.source !== sel && e.target !== sel ? ' dim' : ''));
        var tt = document.createElementNS(NS, 'title');
        tt.textContent = (t('pVia')[e.via] || e.via) + ': ' + e.detail;
        l.appendChild(tt);
        gl.appendChild(l);
    });
    var boxes = [];
    p.projects.forEach(function (x, i) {
        var q = pos[x.id];
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', q.x);
        c.setAttribute('cy', q.y);
        c.setAttribute('r', x.id === sel ? 9 : 7);
        c.setAttribute('class', 'pnode' + (x.indexed ? '' : ' off'));
        c.addEventListener('click', function () { avPick('projects', 'project/' + x.id); });
        gn.insertBefore(c, texts[0]);
        var tx = texts[i];
        tx.setAttribute('x', q.x);
        tx.setAttribute('y', q.y + 22);
        var b = tx.getBBox();
        boxes.push({ x: b.x, y: b.y, w: b.width, h: b.height });
    });
    window.__mapLabelBoxes = { boxes: boxes, width: w, height: h };
    add(wrap, add(el('div', { class: 'legend plegend' }), add(el('span'), el('span', { class: 'k' }), document.createTextNode(t('pLegendFact'))),
        add(el('span'), el('span', { class: 'k g' }), document.createTextNode(t('pLegendGuess')))));
    if (!p.edges.length && p.edgesReason) wrap.appendChild(el('p', { class: 'reason' }, t('pNoEdges')(p.edgesReason)));
    var ul = el('ul', { class: 'plist projlist' });
    p.projects.forEach(function (x) {
        var b = el('button', { type: 'button', 'aria-pressed': String(sel === x.id) });
        add(b, swatch(x.indexed ? cssVar('--brand') || '#3ec5ff' : cssVar('--muted') || '#888'), el('span', { class: 'fname', title: x.id }, x.name),
            stChip(x.indexed ? t('pIndexed') : t('pNotIndexed'), x.indexed ? 'ok' : 'dash'));
        b.addEventListener('click', function () { avPick('projects', 'project/' + x.id); });
        ul.appendChild(add(el('li'), b));
    });
    main.appendChild(ul);
}

function useTable(p, kind, head, list, label) {
    var rows = [];
    list.forEach(function (g) {
        g.uses.forEach(function (u) {
            rows.push({ key: kind + '/' + label(g), cells: [label(g), projName(p, u.project), u.name, u.witness.file + ':' + u.witness.line] });
        });
    });
    return factTable('projects', [head, t('pProject'), t('pUsedBy'), t('colWitness')], rows);
}

AREA_MODULES.projects = {
    tabs: [['graph', 'pGraph'], ['calls', 'pCalls'], ['ports', 'pPorts'], ['images', 'pImages'], ['services', 'pServices']],
    items: function (p) {
        var out = [];
        p.projects.forEach(function (x) {
            var link = x.page ? el('a', { href: x.page, class: 'mono' }, t('pOpen')) : el('span', { class: 'muted' }, x.pageReason || t('pNoPage'));
            out.push({ key: 'project/' + x.id, kind: 'project', label: x.name, sub: x.id, witnesses: [],
                rows: [[t('pIndexed'), x.indexed ? x.indexedAt || '✓' : t('pNotIndexed')], [t('pOpen'), link], [t('pEdges'), String(p.edges.filter(function (e) { return e.source === x.id || e.target === x.id; }).length)]] });
        });
        p.ports.forEach(function (g) {
            out.push({ key: 'port/' + g.port, kind: 'port', label: g.port, sub: g.uses.map(function (u) { return projName(p, u.project) + ':' + u.name; }).join(', '),
                rows: [[t('pPort'), g.port], [t('pUsedBy'), g.uses.map(function (u) { return projName(p, u.project) + ' · ' + u.name; }).join(', ')]],
                witnesses: g.uses.map(function (u) { return projWitness(p, u); }) });
        });
        p.images.forEach(function (g) {
            out.push({ key: 'image/' + g.image, kind: 'image', label: g.image, sub: g.refs.join(', '), rows: [[t('pImage'), g.image], [t('pRefs'), g.refs.join(', ')]],
                witnesses: g.uses.map(function (u) { return projWitness(p, u); }) });
        });
        p.services.forEach(function (g) {
            out.push({ key: 'service/' + g.identity, kind: 'service', label: g.identity, sub: g.uses.map(function (u) { return projName(p, u.project); }).join(', '),
                rows: [[t('pIdentity'), g.identity], [t('pUsedBy'), g.uses.map(function (u) { return projName(p, u.project) + ' · ' + u.name; }).join(', ')]],
                witnesses: g.uses.map(function (u) { return projWitness(p, u); }) });
        });
        p.calls.forEach(function (c, i) {
            var ws = [projWitness(p, { project: c.project, witness: c.witness })];
            if (c.match) ws.push(projWitness(p, { project: c.match.project, witness: c.match.witness }));
            out.push({ key: 'call/' + i, kind: 'operation', label: callText(c), sub: projName(p, c.project),
                rows: [[t('pFrom'), projName(p, c.project)], [t('pService'), c.service],
                    [t('pTarget'), c.match ? projName(p, c.match.project) + ' · ' + c.match.route : (t('pUnmatched')[c.unmatched] || c.unmatched) + (c.candidates ? ' (' + t('pCandidates')(c.candidates) + ')' : '')]],
                witnesses: ws });
        });
        return out;
    },
    meta: function (p) {
        var matched = p.calls.filter(function (c) { return !!c.match; }).length;
        var s = t('pMeta')(num(p.projects.length), num(p.projects.filter(function (x) { return x.indexed; }).length), num(p.calls.length), num(matched));
        return p.skipped && p.skipped.length ? s + ' · ' + t('pSkipped')(num(p.skipped.length)) : s;
    },
    render: function (p, view, main) {
        if (view === 'calls') {
            if (!p.calls.length) { main.appendChild(el('div', { class: 'box' }, t('pNoCalls'))); return; }
            main.appendChild(factTable('projects', [t('pCall'), t('pFrom'), t('pService'), t('pTarget')], p.calls.map(function (c, i) {
                var target = c.match ? add(el('span', { class: 'mono' }, projName(p, c.match.project) + ' · ' + c.match.route + ' '), stChip('✓', 'ok'))
                    : stChip(t('pUnmatched')[c.unmatched] || c.unmatched, c.unmatched === 'ambiguous' ? 'warn' : 'dash', c.candidates ? t('pCandidates')(c.candidates) : null);
                return { key: 'call/' + i, cells: [callText(c), projName(p, c.project), c.service, target] };
            })));
            return;
        }
        if (view === 'ports' || view === 'images' || view === 'services') {
            var list = p[view];
            if (!list.length) { main.appendChild(el('div', { class: 'box' }, t('pNone'))); return; }
            if (view === 'ports') main.appendChild(useTable(p, 'port', t('pPort'), list, function (g) { return g.port; }));
            if (view === 'images') main.appendChild(useTable(p, 'image', t('pImage'), list, function (g) { return g.image; }));
            if (view === 'services') main.appendChild(useTable(p, 'service', t('pIdentity'), list, function (g) { return g.identity; }));
            return;
        }
        projectsGraph(p, main);
    }
};
