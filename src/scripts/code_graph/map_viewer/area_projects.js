/*
 * Projects — the hub only, the design's "Projects · globaler Scope" page: the
 * registry on the left, the links between the registered projects in the
 * centre, the picked link on the right. A link is a declared package
 * dependency, a guess from a unique name or a mention, a call of one project
 * that lands on a route of another, or a host port, image or external service
 * two projects share. A project map never has this area: its route list has no
 * `projects`.
 */
extendStrings({
    en: {
        pRegistry: 'Registry', pEdge: 'Link', pRegNote: 'Projects arrive only by use, never by crawling.',
        pIndexed: 'indexed', pNotIndexed: 'not indexed', pOpen: 'Open its map', pNoPage: 'no map drawn yet', pIndexedAt: 'indexed',
        pBudget: 'Budget', pBudgetWhy: 'the hub keeps no size budget or eviction yet',
        pKinds: { package: 'package · fact', call: 'contract · call → route', 'unique-name': 'unique-name · guess', mention: 'mention · never a dependency', shared: 'shared · port, image, service' },
        pChip: { package: 'fact', call: 'evidenced', 'unique-name': 'guess', mention: 'mention', shared: 'shared' },
        pKindOf: { package: 'package · fact', call: 'contract · call → route', 'unique-name': 'unique-name · guess', mention: 'mention', port: 'shared host port', image: 'shared image', service: 'shared external service' },
        pText: {
            package: function (a, b, d) { return a + ' depends on ' + d + ', which ' + b + ' publishes. Declared in the manifest, so certain.'; },
            'unique-name': function (a, b, d) { return 'Both declare the name ' + d + '. A same name is no dependency — only a candidate to check.'; },
            mention: function (a, b, d) { return a + ' mentions ' + b + ' (' + d + '). Never shown as an API dependency.'; },
            call: function (a, b, d) { return a + ' calls ' + d + '; ' + b + ' serves a route that matches it.'; },
            port: function (a, b, d) { return 'Both publish host port ' + d + ': only one of them can start at a time on this machine.'; },
            image: function (a, b, d) { return 'Both run the image ' + d + '.'; },
            service: function (a, b, d) { return 'Both reach the external service ' + d + '.'; }
        },
        pSource: 'source', pVersion: 'version', pEvidence: 'evidence', pProvider: 'provider', pConsumer: 'consumer', pService: 'service', pReason: 'reason', pUse: 'use',
        pEv: { package: 'declared', 'unique-name': 'heuristic', mention: 'heuristic · mention', call: 'call ↔ route', shared: 'declared in both' },
        pRailNote: 'No merged graph: each project keeps its own; the hub holds names, paths and the links between them only.',
        pNoIndexOff: 'Every registered project is in the estate index.',
        pBundle: function (n) { return n + ' links of this kind between these two projects'; },
        pUnplaced: function (n) { return n + ' more link(s) whose label found no free spot in the drawing'; },
        pIndexOff: function (n) { return n + ': not in the estate index — no package, name or mention link; facts from its files still count.'; },
        pNoEdges: function (r) { return 'No link from the estate index: ' + r; }, pUnmatched: { dynamic_baseurl: 'base or path unknown', no_endpoint_match: 'no route matches', ambiguous: 'several routes match' },
        pCalls: function (n) { return 'Calls without a target (' + n + ')'; }, pSkipped: function (n) { return n + ' project(s) could not be read'; },
        pScope: 'GLOBAL SCOPE', pOnly: '· this machine only · never in a project page or in git', pChipText: 'Projects · global scope', pBack: '← Project map',
        pBackWhy: 'the hub belongs to no single project; open a map from the registry', pCount: function (n, i) { return n + ' projects · ' + i + ' indexed'; },
        pSearch: 'Project, package, contract …', pLinks: 'links', pProjectKind: 'project'
    },
    de: {
        pRegistry: 'Registry', pEdge: 'Kante', pRegNote: 'Projekte kommen nur durch Nutzung dazu, nie durch Crawlen.',
        pIndexed: 'indiziert', pNotIndexed: 'nicht indiziert', pOpen: 'Seine Karte öffnen', pNoPage: 'noch keine Karte gezeichnet', pIndexedAt: 'indiziert',
        pBudget: 'Budget', pBudgetWhy: 'der Hub führt noch kein Größen-Budget und keine Verdrängung',
        pKinds: { package: 'package · Fakt', call: 'Vertrag · Aufruf → Route', 'unique-name': 'unique-name · Vermutung', mention: 'mention · nie eine Abhängigkeit', shared: 'geteilt · Port, Image, Dienst' },
        pChip: { package: 'Fakt', call: 'belegt', 'unique-name': 'Vermutung', mention: 'Erwähnung', shared: 'geteilt' },
        pKindOf: { package: 'package · Fakt', call: 'Vertrag · Aufruf → Route', 'unique-name': 'unique-name · Vermutung', mention: 'mention', port: 'geteilter Host-Port', image: 'geteiltes Image', service: 'geteilter externer Dienst' },
        pText: {
            package: function (a, b, d) { return a + ' hängt von ' + d + ' ab, das ' + b + ' veröffentlicht. Im Manifest deklariert, daher sicher.'; },
            'unique-name': function (a, b, d) { return 'Beide deklarieren den Namen ' + d + '. Ein gleicher Name ist keine Abhängigkeit – nur ein Kandidat zum Prüfen.'; },
            mention: function (a, b, d) { return a + ' erwähnt ' + b + ' (' + d + '). Wird nie als API-Abhängigkeit ausgegeben.'; },
            call: function (a, b, d) { return a + ' ruft ' + d + '; ' + b + ' stellt eine passende Route bereit.'; },
            port: function (a, b, d) { return 'Beide veröffentlichen den Host-Port ' + d + ': auf diesem Rechner kann nur einer von beiden zugleich starten.'; },
            image: function (a, b, d) { return 'Beide nutzen das Image ' + d + '.'; },
            service: function (a, b, d) { return 'Beide erreichen den externen Dienst ' + d + '.'; }
        },
        pSource: 'quelle', pVersion: 'version', pEvidence: 'evidence', pProvider: 'provider', pConsumer: 'consumer', pService: 'dienst', pReason: 'grund', pUse: 'nutzung',
        pEv: { package: 'declared', 'unique-name': 'heuristic', mention: 'heuristic · mention', call: 'Aufruf ↔ Route', shared: 'in beiden deklariert' },
        pRailNote: 'Kein gemergter Gesamtgraph: jedes Projekt behält seinen eigenen; der Hub hält nur Namen, Pfade und die Kanten dazwischen.',
        pNoIndexOff: 'Jedes registrierte Projekt ist im Estate-Index.',
        pBundle: function (n) { return n + ' Kanten dieser Art zwischen diesen beiden Projekten'; },
        pUnplaced: function (n) { return n + ' weitere Kante(n), deren Beschriftung im Bild keinen freien Platz fand'; },
        pIndexOff: function (n) { return n + ': nicht im Estate-Index – keine Paket-, Namens- oder Erwähnungskante; Fakten aus seinen Dateien zählen trotzdem.'; },
        pNoEdges: function (r) { return 'Keine Kante aus dem Estate-Index: ' + r; }, pUnmatched: { dynamic_baseurl: 'Basis oder Pfad unbekannt', no_endpoint_match: 'keine Route passt', ambiguous: 'mehrere Routen passen' },
        pCalls: function (n) { return 'Aufrufe ohne Ziel (' + n + ')'; }, pSkipped: function (n) { return n + ' Projekt(e) nicht lesbar'; },
        pScope: 'GLOBALER SCOPE', pOnly: '· nur auf diesem Rechner · nie in eine Projekt-HTML oder ins Git', pChipText: 'Projects · globaler Scope', pBack: '← Projekt-Map',
        pBackWhy: 'der Hub gehört zu keinem einzelnen Projekt; eine Karte aus der Registry öffnen', pCount: function (n, i) { return n + ' Projekte · ' + i + ' indiziert'; },
        pSearch: 'Projekt, Paket, Vertrag …', pLinks: 'Kanten', pProjectKind: 'Projekt'
    }
});

/** The hub's own header: the global-scope banner, the scope chip and the count; called by the shell on every header render. */
function hubHeader() {
    $('hub-scope').textContent = t('pScope');
    $('hub-only').textContent = t('pOnly');
    $('hub-chip').textContent = t('pChipText');
    var back = $('hub-back');
    clear(back);
    add(back, el('span', null, t('pBack')), ndTag(t('pBackWhy')));
    $('pin-commit').hidden = true;
    $('pin-fresh').className = 'chip';
    $('pin-fresh').textContent = t('pCount')(num(SHELL.hub.projects), num(SHELL.hub.indexed));
    searchInput.setAttribute('placeholder', t('pSearch'));
}

function projName(p, id) {
    for (var i = 0; i < p.projects.length; i++) if (p.projects[i].id === id) return p.projects[i].name;
    return id;
}
/** A witness inside one project, labelled with that project for the detail rail. */
function projWitness(p, use) {
    return { file: projName(p, use.project) + ' · ' + use.witness.file, line: use.witness.line, hash: use.witness.hash, confirm: use.witness.confirm || 'unconfirmed' };
}
function callText(c) { return (c.method ? c.method + ' ' : '') + (c.path || '–'); }
function shortName(s) { return s.length > 22 ? s.slice(0, 21) + '…' : s; }

/** Every link the page draws, in a fixed order so `edge/<i>` stays stable for one payload. */
function hubLinks(p) {
    var out = [];
    p.edges.forEach(function (e) { out.push({ kind: e.via, style: e.via, a: e.source, b: e.target, label: e.via, detail: e.detail }); });
    var calls = Object.create(null);
    p.calls.forEach(function (c) {
        if (!c.match || c.match.project === c.project) return;
        var k = c.project + '>' + c.match.project + '>' + c.match.route;
        if (calls[k]) { calls[k].calls.push(c); return; }
        calls[k] = { kind: 'call', style: 'call', a: c.project, b: c.match.project, label: c.match.route, detail: callText(c), calls: [c] };
        out.push(calls[k]);
    });
    [['port', p.ports, 'port'], ['image', p.images, 'image'], ['service', p.services, 'identity']].forEach(function (g) {
        g[1].forEach(function (f) {
            var first = f.uses[0];
            f.uses.slice(1).forEach(function (u) {
                if (u.project === first.project) return;
                out.push({ kind: g[0], style: 'shared', a: first.project, b: u.project, label: f[g[2]], detail: f[g[2]], uses: [first, u], fact: f });
            });
        });
    });
    return out;
}
/**
 * The links of one pair of projects and one line style, drawn as one line with
 * one label: several shared ports between the same two projects would otherwise
 * be parallel lines whose labels cannot all fit between two nodes.
 */
function hubBundles(links) {
    var out = [];
    var at = Object.create(null);
    links.forEach(function (l, i) {
        var k = [l.a, l.b].sort().join('|') + '|' + l.style;
        if (at[k] === undefined) { at[k] = out.length; out.push({ a: l.a, b: l.b, style: l.style, links: [] }); }
        out[at[k]].links.push(i);
    });
    return out;
}
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
/** Chain order of linked projects: greedily the unplaced project most linked to the last one placed. */
function hubOrder(p, links) {
    var w = Object.create(null);
    function bump(a, b) { var k = a + '|' + b; w[k] = (w[k] || 0) + 1; }
    links.forEach(function (l) { bump(l.a, l.b); bump(l.b, l.a); });
    var deg = Object.create(null);
    links.forEach(function (l) { deg[l.a] = (deg[l.a] || 0) + 1; deg[l.b] = (deg[l.b] || 0) + 1; });
    var left = p.projects.map(function (x) { return x.id; }).sort(function (a, b) { return (deg[b] || 0) - (deg[a] || 0) || (projName(p, a) < projName(p, b) ? -1 : 1); });
    var out = [];
    while (left.length) {
        var last = out[out.length - 1];
        var best = 0;
        if (last) left.forEach(function (id, i) { if ((w[last + '|' + id] || 0) > (w[last + '|' + left[best]] || 0)) best = i; });
        out.push(left.splice(best, 1)[0]);
    }
    return out;
}
function linkChipClass(style) { return { package: 'ok', call: 'ok', 'unique-name': 'unkA', mention: 'unk', shared: 'raw' }[style] || 'unk'; }

function hubSelected(p, key) {
    var links = hubLinks(p);
    if (key.indexOf('edge/') === 0) return { link: links[Number(key.slice(5))] || null, index: Number(key.slice(5)) };
    if (key.indexOf('project/') === 0) return { project: key.slice(8) };
    if (key) return {};
    for (var i = 0; i < links.length; i++) if (links[i].kind === 'call') return { link: links[i], index: i };
    return links.length ? { link: links[0], index: 0 } : {};
}

function hubRegistry(p, left) {
    var pad = el('div', { class: 'ops-rail' });
    add(pad, add(el('div', { class: 'ops-col tight' }), el('span', { class: 'cap' }, t('pRegistry')), el('span', { class: 'ops-note' }, t('pRegNote'))));
    p.projects.forEach(function (x) {
        var card = el('div', { class: 'ops-reg' });
        var name = el('button', { type: 'button', class: 'mono ops-regname', title: x.id }, x.name);
        name.addEventListener('click', function () { avPick('projects', 'project/' + x.id); });
        add(card, add(el('div', { class: 'ops-row' }), name, opsChip(x.indexed ? t('pIndexed') : t('pNotIndexed'), x.indexed ? 'ok' : 'unk')));
        var meta = el('span', { class: 'mono ops-regmeta' });
        if (x.indexedAt) meta.appendChild(document.createTextNode(String(x.indexedAt).slice(0, 10) + ' · '));
        meta.appendChild(x.page ? el('a', { href: x.page }, t('pOpen')) : document.createTextNode(x.pageReason || t('pNoPage')));
        card.appendChild(meta);
        pad.appendChild(card);
    });
    if (p.skipped && p.skipped.length) pad.appendChild(el('span', { class: 'ops-note' }, t('pSkipped')(num(p.skipped.length)) + ': ' + p.skipped.map(function (s) { return projName(p, s.project) + ' — ' + s.reason; }).join('; ')));
    add(pad, add(el('div', { class: 'ops-col tight' }), el('span', { class: 'cap' }, t('pBudget')), el('div', { class: 'ops-budget' }), ndTag(t('pBudgetWhy'), true)));
    left.appendChild(pad);
}

/** The width the graph was laid out for; a resize to another width lays it out again. */
var hubDrawnWidth = 0;
window.addEventListener('resize', function () {
    var b = document.querySelector('.ops-graph');
    if (b && Math.abs(b.getBoundingClientRect().width - hubDrawnWidth) > 1) renderRoute();
});

function hubGraph(p, sel, main) {
    var NS = 'http://www.w3.org/2000/svg';
    var legend = el('div', { class: 'ops-elegend' });
    ['package', 'call', 'unique-name', 'mention', 'shared'].forEach(function (k) {
        var sv = document.createElementNS(NS, 'svg');
        sv.setAttribute('width', '30');
        sv.setAttribute('height', '8');
        sv.setAttribute('aria-hidden', 'true');
        var ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', '0'); ln.setAttribute('y1', '4'); ln.setAttribute('x2', '30'); ln.setAttribute('y2', '4');
        ln.setAttribute('class', 'pe-' + k);
        sv.appendChild(ln);
        legend.appendChild(add(el('span'), sv, document.createTextNode(t('pKinds')[k])));
    });
    main.appendChild(legend);
    var scroll = el('div', { class: 'ops-gscroll' });
    var box = el('div', { class: 'ops-graph' });
    scroll.appendChild(box);
    main.appendChild(scroll);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'ops-gsvg');
    svg.setAttribute('aria-hidden', 'true');
    box.appendChild(svg);
    var n = p.projects.length;
    var links = hubLinks(p);
    var nodes = [];
    var nodeOf = Object.create(null);
    p.projects.forEach(function (x) {
        var nd = el('button', { type: 'button', class: 'ops-pnode' + (n > 8 ? ' compact' : '') + (x.indexed ? '' : ' off') + (sel.project === x.id ? ' on' : ''), title: x.id });
        add(nd, el('span', { class: 'mono ops-pname' }, x.name), el('span', { class: 'ops-pmeta' }, x.indexed ? t('pIndexed') : t('pNotIndexed')));
        nd.addEventListener('click', function () { avPick('projects', 'project/' + x.id); });
        box.appendChild(nd);
        nodes.push(nd);
        nodeOf[x.id] = nd;
    });
    var off = p.projects.filter(function (x) { return !x.indexed; }).map(function (x) { return x.name; });
    var note = el('div', { class: 'ops-gnote' }, off.length ? t('pIndexOff')(off.join(', ')) : !p.edges.length && p.edgesReason ? t('pNoEdges')(p.edgesReason) : t('pNoIndexOff'));
    box.appendChild(note);
    var W = box.getBoundingClientRect().width || 720;
    hubDrawnWidth = W;
    var nw = 0;
    var nh = 0;
    nodes.forEach(function (nd) { nw = Math.max(nw, nd.offsetWidth); nh = Math.max(nh, nd.offsetHeight); });
    var noteH = note.offsetHeight;
    // The ring is as wide as the canvas allows and as tall as it must be for no two project cards to touch.
    var order = hubOrder(p, links);
    var step = 1;
    for (var st = Math.floor(n / 2); st > 1; st--) if (gcd(st, n) === 1) { step = st; break; }
    var rx = Math.max(0, (W - nw) / 2 - 12);
    var top = nh / 2 + 16;
    function ring(ry) {
        var out = Object.create(null);
        order.forEach(function (id, i) {
            // Past six projects the ring turns a quarter step, so no two cards mirror each other at one height
            // and a taller ring always separates them.
            var a = -Math.PI / 2 + (n > 6 ? Math.PI / (2 * n) : 0) + 2 * Math.PI * ((i * step) % Math.max(1, n)) / Math.max(1, n);
            out[id] = n < 2 ? { x: W / 2, y: top + ry } : { x: W / 2 + rx * Math.cos(a), y: top + ry + ry * Math.sin(a) };
        });
        return out;
    }
    function crowded(pos) {
        var ids = Object.keys(pos);
        for (var i = 0; i < ids.length; i++) {
            for (var j = i + 1; j < ids.length; j++) {
                var a = pos[ids[i]];
                var b = pos[ids[j]];
                if (Math.abs(a.x - b.x) < nw + 12 && Math.abs(a.y - b.y) < nh + 12) return true;
            }
        }
        return false;
    }
    var ry = Math.max(120, Math.min(175, rx * 0.7));
    var pos;
    var H;
    if (n > 4 && W < nw * 3.4) {
        // Too narrow for a ring of this many cards (a phone): two staggered columns, the chain order alternating
        // between them, so linked projects sit across from each other.
        pos = Object.create(null);
        var rowH = nh + 20;
        order.forEach(function (id, i) {
            pos[id] = { x: i % 2 ? W - nw / 2 - 8 : nw / 2 + 8, y: top + i * rowH * 0.62 };
        });
        H = Math.max(top + (n - 1) * rowH * 0.62 + nh / 2 + 16 + noteH + 16, 320);
    } else {
        pos = ring(ry);
        while (crowded(pos) && ry < 4000) { ry += 16; pos = ring(ry); }
        H = Math.max(top + 2 * ry + nh / 2 + 16 + noteH + 16, 320);
    }
    box.style.height = H.toFixed(0) + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W.toFixed(1) + ' ' + H.toFixed(0));
    svg.style.height = H.toFixed(0) + 'px';
    p.projects.forEach(function (x) {
        var q = pos[x.id];
        var nd = nodeOf[x.id];
        nd.style.left = (q.x - nd.offsetWidth / 2).toFixed(1) + 'px';
        nd.style.top = (q.y - nd.offsetHeight / 2).toFixed(1) + 'px';
    });
    var origin = box.getBoundingClientRect();
    function rectOf(e) { var r = e.getBoundingClientRect(); return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }; }
    // Everything a label must not cover: the project cards and the note.
    var taken = nodes.map(rectOf).concat([rectOf(note)]);
    function hits(r, list) {
        var area = 0;
        list.forEach(function (o) {
            var w = Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x) + 4;
            var h = Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y) + 4;
            if (w > 0 && h > 0) area += w * h;
        });
        return area;
    }
    var bundles = hubBundles(links);
    var perPair = Object.create(null);
    bundles.forEach(function (bd) { var pk = [bd.a, bd.b].sort().join('|'); perPair[pk] = (perPair[pk] || 0) + 1; });
    var seen = Object.create(null);
    var ALONG = [0.5];
    for (var d = 0.05; d < 0.41; d += 0.05) ALONG.push(0.5 - d, 0.5 + d);
    var ACROSS = [0, 24, -24, 48, -48, 72, -72];
    var unplaced = [];
    bundles.forEach(function (bd) {
        var s = pos[bd.a];
        var g = pos[bd.b];
        if (!s || !g) return;
        var pk = [bd.a, bd.b].sort().join('|');
        var k = seen[pk] = (seen[pk] || 0) + 1;
        // Different kinds of link between one pair sit side by side, 10 px apart, centred on the pair.
        var shift = (k - 1 - (perPair[pk] - 1) / 2) * 10;
        var len = Math.max(1, Math.sqrt((g.x - s.x) * (g.x - s.x) + (g.y - s.y) * (g.y - s.y)));
        var ux = -(g.y - s.y) / len;
        var uy = (g.x - s.x) / len;
        var on = bd.links.indexOf(sel.index) >= 0;
        var line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', s.x + ux * shift); line.setAttribute('y1', s.y + uy * shift); line.setAttribute('x2', g.x + ux * shift); line.setAttribute('y2', g.y + uy * shift);
        line.setAttribute('class', 'pe-' + bd.style + (on ? ' on' : ''));
        svg.appendChild(line);
        var first = links[bd.links[0]];
        var text = shortName(String(first.label)) + (bd.links.length > 1 ? ' +' + (bd.links.length - 1) : '');
        var title = projName(p, bd.a) + ' – ' + projName(p, bd.b) + '\n' + bd.links.map(function (i) { return t('pKindOf')[links[i].kind] + ': ' + links[i].detail; }).join('\n');
        var b = el('button', { type: 'button', class: 'mono ops-elabel' + (on ? ' on' : ''), title: title }, text);
        b.style.left = '0px';
        b.style.top = '0px';
        b.addEventListener('click', function () { avPick('projects', 'edge/' + (on ? sel.index : bd.links[0])); });
        box.insertBefore(b, nodes[0] || null);
        var bw = b.getBoundingClientRect().width;
        var bh = b.getBoundingClientRect().height;
        // The first spot along the line, then beside it, that covers nothing and stays inside the canvas.
        var best = null;
        for (var i = 0; i < ALONG.length && !(best && best.cost === 0); i++) {
            for (var j = 0; j < ACROSS.length; j++) {
                var cx = s.x + (g.x - s.x) * ALONG[i] + ux * (shift + ACROSS[j]);
                var cy = s.y + (g.y - s.y) * ALONG[i] + uy * (shift + ACROSS[j]);
                var r = { x: Math.min(Math.max(4, cx - bw / 2), W - bw - 4), y: Math.min(Math.max(4, cy - bh / 2), H - bh - 4), w: bw, h: bh };
                var cost = hits(r, taken);
                if (!best || cost < best.cost) best = { r: r, cost: cost };
                if (cost === 0) break;
            }
        }
        // A label with no free spot leaves the drawing for the list below it, rather than covering another.
        if (best.cost > 0) {
            box.removeChild(b);
            b.className = 'mono ops-bundle' + (on ? ' on' : '');
            b.textContent = projName(p, bd.a) + ' – ' + projName(p, bd.b) + ' · ' + text;
            b.removeAttribute('style');
            unplaced.push(b);
            return;
        }
        b.style.left = best.r.x.toFixed(1) + 'px';
        b.style.top = best.r.y.toFixed(1) + 'px';
        taken.push(best.r);
    });
    var boxes = [];
    Array.prototype.forEach.call(box.querySelectorAll('.ops-pnode, .ops-elabel'), function (e) { boxes.push(rectOf(e)); });
    window.__mapLabelBoxes = { boxes: boxes, width: W, height: H };
    if (unplaced.length) {
        var more = el('div', { class: 'mono ops-boxlist ops-unplaced' });
        unplaced.forEach(function (b) { more.appendChild(b); });
        main.appendChild(add(el('div', { class: 'ops-col tight' }), el('span', { class: 'cap' }, t('pUnplaced')(num(unplaced.length))), more));
    }
    var lost = p.calls.filter(function (c) { return !c.match; });
    if (lost.length) {
        var sec = add(el('div', { class: 'ops-col tight' }), el('span', { class: 'cap' }, t('pCalls')(num(lost.length))));
        var list = el('div', { class: 'mono ops-boxlist' });
        lost.forEach(function (c) {
            list.appendChild(add(el('span'), document.createTextNode(projName(p, c.project) + ' · ' + callText(c) + ' · ' + c.service + ' — '),
                el('span', { class: 'muted' }, (t('pUnmatched')[c.unmatched] || c.unmatched) + (c.candidates ? ' (' + c.candidates + ')' : ''))));
        });
        sec.appendChild(list);
        main.appendChild(sec);
    }
}

function hubRail(p, sel, right) {
    var pad = el('div', { class: 'ops-rail' });
    if (sel.project) {
        var x = null;
        p.projects.forEach(function (y) { if (y.id === sel.project) x = y; });
        if (!x) { right.appendChild(add(pad, el('span', { class: 'soft' }, t('pickItem')))); return; }
        var count = hubLinks(p).filter(function (l) { return l.a === x.id || l.b === x.id; }).length;
        add(pad, railHead(t('pProjectKind') + ' · ' + x.id, x.name, opsChip(x.indexed ? t('pIndexed') : t('pNotIndexed'), x.indexed ? 'ok' : 'unk'), true),
            railRows([[t('pIndexedAt'), x.indexedAt ? String(x.indexedAt).slice(0, 10) : t('pNotIndexed')], [t('pOpen'), x.page ? el('a', { href: x.page }, x.page) : el('span', { class: 'muted' }, x.pageReason || t('pNoPage'))], [t('pLinks'), String(count)]]),
            el('span', { class: 'ops-railnote' }, t('pRailNote')));
        right.appendChild(pad);
        return;
    }
    var l = sel.link;
    if (!l) { right.appendChild(add(pad, el('span', { class: 'soft' }, t('pickItem')))); return; }
    var a = projName(p, l.a);
    var b = projName(p, l.b);
    var rows;
    if (l.kind === 'call') {
        var c = l.calls[0];
        rows = [[t('pProvider'), b + ' · ' + c.match.route + ' · ' + wloc(c.match.witness)], [t('pConsumer'), a + ' · ' + l.calls.map(function (k) { return wloc(k.witness); }).join(', ')],
            [t('pService'), c.service], [t('pEvidence'), t('pEv').call]];
    } else if (l.uses) {
        rows = l.uses.map(function (u) { return [t('pUse'), projName(p, u.project) + ' · ' + u.name + ' · ' + wloc(u.witness)]; }).concat([[t('pEvidence'), t('pEv').shared]]);
        if (l.fact.refs) rows.unshift([t('pVersion'), l.fact.refs.join(', ')]);
    } else rows = [[l.kind === 'package' ? t('pSource') : t('pReason'), l.detail], [t('pEvidence'), t('pEv')[l.kind] || l.kind]];
    add(pad, railHead(t('pKindOf')[l.kind] || l.kind, a + ' → ' + b, opsChip(t('pChip')[l.style], linkChipClass(l.style)), true),
        el('span', { class: 'ops-dtext' }, (t('pText')[l.kind] || function () { return l.detail; })(a, b, l.detail)), railRows(rows));
    if (l.kind === 'call' || l.uses) {
        var ws = l.kind === 'call' ? l.calls.map(function (k) { return projWitness(p, k); }).concat([projWitness(p, { project: l.b, witness: l.calls[0].match.witness })]) : l.uses.map(function (u) { return projWitness(p, u); });
        pad.appendChild(witnessList(ws));
    }
    var links = hubLinks(p);
    hubBundles(links).forEach(function (bd) {
        if (bd.links.length < 2 || bd.links.indexOf(sel.index) < 0) return;
        var list = el('div', { class: 'mono ops-boxlist' });
        bd.links.forEach(function (i) {
            var x = el('button', { type: 'button', class: 'ops-bundle' + (i === sel.index ? ' on' : ''), 'aria-pressed': String(i === sel.index) }, String(links[i].label));
            x.addEventListener('click', function () { avPick('projects', 'edge/' + i); });
            list.appendChild(x);
        });
        pad.appendChild(add(el('div', { class: 'ops-col tight' }), el('span', { class: 'cap' }, t('pBundle')(num(bd.links.length))), list));
    });
    pad.appendChild(el('span', { class: 'ops-railnote' }, t('pRailNote')));
    right.appendChild(pad);
}

extendStrings({
    en: { pVersions: 'Versions across projects', pVersionsNote: 'Direct packages and runtimes two or more projects run, as each one locks or declares them.', pDiffers: 'differs', pSame: 'same', pSubject: 'package / runtime' },
    de: { pVersions: 'Versionen über Projekte', pVersionsNote: 'Direkte Pakete und Runtimes, die zwei oder mehr Projekte nutzen, so wie jedes sie lockt oder deklariert.', pDiffers: 'abweichend', pSame: 'gleich', pSubject: 'Paket / Runtime' }
});
/** The version matrix: one row per shared package or runtime, one column per registered project. */
function hubVersions(p, main) {
    var rows = p.versions || [];
    if (!rows.length) return;
    var sec = add(el('div', { class: 'ops-col tight' }), el('span', { class: 'cap' }, t('pVersions') + ' (' + rows.length + ')'), el('span', { class: 'ops-note' }, t('pVersionsNote')));
    var ids = p.projects.map(function (x) { return x.id; });
    main.appendChild(sec);
    sec.appendChild(factTable('projects', [t('pSubject')].concat(ids.map(function (id) { return projName(p, id); })).concat(['']), rows.map(function (r) {
        var at = Object.create(null);
        r.uses.forEach(function (u) { at[u.project] = (at[u.project] ? at[u.project] + ', ' : '') + u.name; });
        return { cells: [el('span', { class: 'mono' }, r.subject)].concat(ids.map(function (id) { return at[id] || '–'; })).concat([stChip(r.differs ? t('pDiffers') : t('pSame'), r.differs ? 'warn' : 'ok')]) };
    })));
}

AREA_MODULES.projects = {
    tabs: [],
    railTitles: ['pRegistry', 'pEdge'],
    ownsBar: true,
    items: function (p) {
        var out = [];
        p.projects.forEach(function (x) {
            out.push({ key: 'project/' + x.id, kind: 'project', label: x.name, sub: x.id, witnesses: [], rows: [[t('pIndexedAt'), x.indexed ? x.indexedAt || '✓' : t('pNotIndexed')]] });
        });
        hubLinks(p).forEach(function (l, i) {
            out.push({ key: 'edge/' + i, kind: l.kind === 'call' ? 'operation' : l.kind === 'service' ? 'service' : 'link', label: projName(p, l.a) + ' → ' + projName(p, l.b) + ' · ' + l.label, sub: t('pKindOf')[l.kind] || l.kind,
                rows: [], witnesses: l.uses ? l.uses.map(function (u) { return projWitness(p, u); }) : l.calls ? l.calls.map(function (k) { return projWitness(p, k); }) : [] });
        });
        return out;
    },
    meta: function (p) { return t('pCount')(num(p.projects.length), num(p.projects.filter(function (x) { return x.indexed; }).length)); },
    render: function (p, view, main) { hubGraph(p, {}, main); hubVersions(p, main); },
    page: function (p, view, key, c) {
        c.bar.classList.add('ops-empty');
        var sel = hubSelected(p, key);
        hubRegistry(p, c.left);
        hubGraph(p, sel, c.main);
        hubVersions(p, c.main);
        hubRail(p, sel, c.right);
    }
};
